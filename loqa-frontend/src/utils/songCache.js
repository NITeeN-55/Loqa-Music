/**
 * songCache — IndexedDB-backed song metadata cache.
 *
 * Replaces the localStorage-based cache in constants.js:
 *   - Async (never blocks main thread)
 *   - Quota-managed by the browser (GBs, not ~5MB)
 *   - Works in private browsing
 *   - Auto-evicts when store > 1000 entries (LRU)
 *
 * Exports the same API shape as the old constants.js cache
 * so it can be a drop-in replacement:
 *   cacheSong(song)         → void (async internally)
 *   getCachedSong(id)       → song | null  (sync from in-memory map)
 */

const DB_NAME    = 'loqa_cache';
const DB_VERSION = 1;
const STORE_NAME = 'songs';
const MAX_ENTRIES = 1000;

/* ── In-memory mirror for synchronous getCachedSong() reads ── */
const _mem = new Map();

/* ── DB connection (singleton promise) ───────────────────────── */
let _dbPromise = null;
function getDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('accessed_at', 'accessed_at', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => { _dbPromise = null; reject(e.target.error); };
  });
  return _dbPromise;
}

/* ── Load all cached songs into memory on startup ────────────── */
(async () => {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = (e) => {
      (e.target.result || []).forEach(s => _mem.set(s.id, s));
    };
  } catch { /* IDB unavailable (e.g. private mode in some browsers) */ }
})();

/* ── cacheSong ───────────────────────────────────────────────── */
export function cacheSong(s) {
  if (!s?.id) return;
  const entry = {
    id:         s.id,
    title:      s.title    || 'Unknown',
    artist:     s.artist   || 'Unknown',
    album:      s.album    || 'YouTube',
    dur:        s.dur      || 0,
    ci:         s.ci       ?? 0,
    ai:         s.ai       ?? 0,
    thumbnail:  s.thumbnail || '',
    views:      s.views    || '',
    isYoutube:  true,
    accessed_at: Date.now(),
  };

  // Always update in-memory mirror synchronously
  _mem.set(entry.id, entry);

  // Async write to IndexedDB (fire-and-forget)
  getDB().then(db => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);

    // Evict if over limit (async, best-effort)
    if (_mem.size > MAX_ENTRIES) evictOldest(db);
  }).catch(() => {});
}

/* ── getCachedSong (sync — uses in-memory mirror) ────────────── */
export function getCachedSong(id) {
  return id ? (_mem.get(id) || null) : null;
}

/* ── Evict oldest entries when over MAX_ENTRIES ──────────────── */
async function evictOldest(db) {
  try {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('accessed_at');
    const countReq = store.count();
    countReq.onsuccess = (e) => {
      const over = e.target.result - MAX_ENTRIES;
      if (over <= 0) return;
      const cursor = index.openCursor(); // oldest first
      let deleted = 0;
      cursor.onsuccess = (ev) => {
        const c = ev.target.result;
        if (!c || deleted >= over) return;
        _mem.delete(c.value.id);
        c.delete();
        deleted++;
        c.continue();
      };
    };
  } catch {}
}

/* ── Legacy localStorage constants for backward compat ──────── */
// These are re-exported here so imports from constants.js still work
// when gradually migrating. constants.js still exports its own versions.
export const CACHE_COMPAT = { cacheSong, getCachedSong };
