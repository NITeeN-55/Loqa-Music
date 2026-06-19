/**
 * IndexedDB wrapper for offline/local music storage.
 * Stores file metadata + File handles (where supported).
 */
const DB_NAME = 'loqa_local';
const DB_VER  = 1;
const STORE   = 'tracks';

function open() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
      }
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

function tx(db, mode = 'readonly') {
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function saveLocalTrack(track) {
  const db = await open();
  return new Promise((res, rej) => {
    const req = tx(db, 'readwrite').put(track);
    req.onsuccess = () => res(track);
    req.onerror   = e => rej(e.target.error);
  });
}

export async function getAllLocalTracks() {
  const db = await open();
  return new Promise((res, rej) => {
    const req = tx(db).getAll();
    req.onsuccess = e => res(e.target.result || []);
    req.onerror   = e => rej(e.target.error);
  });
}

export async function deleteLocalTrack(id) {
  const db = await open();
  return new Promise((res, rej) => {
    const req = tx(db, 'readwrite').delete(id);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

export async function clearLocalTracks() {
  const db = await open();
  return new Promise((res, rej) => {
    const req = tx(db, 'readwrite').clear();
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

/**
 * ── Song Metadata Cache (replaces localStorage song cache) ──
 *
 * Audit fix (P8): localStorage is synchronous, size-limited (~5MB),
 * and silently fails in private browsing. IndexedDB is async, quota-
 * managed (GBs available), and works everywhere.
 *
 * Drop-in replacement for cacheSong() / getCachedSong() in constants.js.
 * The in-memory Map in constants.js is kept as an L1 cache for instant
 * reads; IndexedDB is the L2 persistent backing store.
 */
const SONG_DB   = 'loqa_songs';
const SONG_VER  = 1;
const SONG_STORE= 'metadata';

function openSongDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(SONG_DB, SONG_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(SONG_STORE)) {
        const store = db.createObjectStore(SONG_STORE, { keyPath: 'id' });
        store.createIndex('artist',    'artist',    { unique: false });
        store.createIndex('cachedAt',  'cachedAt',  { unique: false });
      }
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

/** Persist a song object to IndexedDB. Fire-and-forget — never throws. */
export async function idbCacheSong(song) {
  if (!song?.id) return;
  try {
    const db = await openSongDB();
    await new Promise((res, rej) => {
      const req = db.transaction(SONG_STORE, 'readwrite')
                    .objectStore(SONG_STORE)
                    .put({ ...song, cachedAt: Date.now() });
      req.onsuccess = res;
      req.onerror   = e => rej(e.target.error);
    });
  } catch { /* silent — IndexedDB failure should never break the app */ }
}

/** Retrieve a song from IndexedDB. Returns null if not found. */
export async function idbGetSong(id) {
  if (!id) return null;
  try {
    const db = await openSongDB();
    return await new Promise((res, rej) => {
      const req = db.transaction(SONG_STORE, 'readonly')
                    .objectStore(SONG_STORE)
                    .get(id);
      req.onsuccess = e => res(e.target.result || null);
      req.onerror   = e => rej(e.target.error);
    });
  } catch { return null; }
}

/** Retrieve all cached songs (for offline browsing). */
export async function idbGetAllSongs() {
  try {
    const db = await openSongDB();
    return await new Promise((res, rej) => {
      const req = db.transaction(SONG_STORE, 'readonly')
                    .objectStore(SONG_STORE)
                    .getAll();
      req.onsuccess = e => res(e.target.result || []);
      req.onerror   = e => rej(e.target.error);
    });
  } catch { return []; }
}

/** Evict songs cached more than `maxAgeDays` days ago. Run periodically. */
export async function idbEvictOldSongs(maxAgeDays = 30) {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  try {
    const db = await openSongDB();
    const store = db.transaction(SONG_STORE, 'readwrite').objectStore(SONG_STORE);
    const idx   = store.index('cachedAt');
    const range = IDBKeyRange.upperBound(cutoff);
    const req   = idx.openCursor(range);
    req.onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
  } catch { /* silent */ }
}
