/**
 * Lyrics Route — /api/lyrics
 * Fetches synced + plain lyrics from LRCLIB (free, open, no auth required).
 * Caches results in-memory for 2hrs to avoid hammering the upstream API.
 */
import { Router } from 'express';

const router = Router();

/* ── In-memory LRU cache (keyed by "artist::title") ─────────── */
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const cache = new Map(); // key → { data, ts }

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return hit.data;
}
function cacheSet(key, data) {
  // Keep cache from growing unbounded (max 500 entries)
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    cache.delete(oldest[0]);
  }
  cache.set(key, { data, ts: Date.now() });
}

/* ── LRCLIB fetcher ─────────────────────────────────────────── */
async function fetchFromLRCLIB(artist, title, duration) {
  const url = new URL('https://lrclib.net/api/get');
  url.searchParams.set('artist_name', artist.slice(0, 150));
  url.searchParams.set('track_name',  title.slice(0, 150));
  if (duration && Number(duration) > 0) url.searchParams.set('duration', String(duration));

  const r = await fetch(url.toString(), {
    headers: {
      'Lrclib-Client': 'Loqa Music v1.0 (https://github.com/your-repo)',
      'User-Agent': 'LoqaMusic/1.0',
    },
    signal: AbortSignal.timeout(6000),
  });

  if (r.status === 404) return { synced: null, plain: null };
  if (!r.ok) throw new Error(`LRCLIB ${r.status}`);

  const d = await r.json();
  return {
    synced: d.syncedLyrics || null,   // "[mm:ss.cs] Line text\n..."
    plain:  d.plainLyrics  || null,
  };
}

/* ── GET /api/lyrics?artist=...&title=...&duration=... ──────── */
router.get('/', async (req, res) => {
  const { artist, title, duration } = req.query;
  if (!artist?.trim() || !title?.trim()) {
    return res.status(400).json({ error: 'artist and title are required' });
  }

  const key = `${artist.trim().toLowerCase()}::${title.trim().toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return res.json(cached);

  try {
    const result = await fetchFromLRCLIB(artist.trim(), title.trim(), duration);
    cacheSet(key, result);
    res.json(result);
  } catch (err) {
    console.error('[lyrics]', err.message);
    // Don't fail the client — just return null lyrics
    res.json({ synced: null, plain: null });
  }
});

export default router;
