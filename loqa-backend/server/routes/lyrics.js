/**
 * /api/lyrics — LRCLIB proxy
 *
 * Proxies requests to lrclib.net so the frontend avoids CORS issues.
 * LRCLIB is free, open, no auth required.
 * We add a 1-hour in-memory cache to avoid hammering their servers.
 *
 * GET /api/lyrics?artist=Adele&title=Hello
 * GET /api/lyrics?artist=Adele&title=Hello&duration=295
 */
import { Router } from 'express';

const router = Router();

// Simple in-memory LRU-lite cache: key → { data, ts }
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

router.get('/', async (req, res) => {
  const { artist, title, duration } = req.query;

  if (!artist || !title) {
    return res.status(400).json({ error: 'artist and title are required' });
  }

  const cacheKey = `${artist}||${title}||${duration || ''}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    const url = new URL('https://lrclib.net/api/get');
    url.searchParams.set('artist_name', artist);
    url.searchParams.set('track_name', title);
    if (duration) url.searchParams.set('duration', duration);

    const r = await fetch(url.toString(), {
      headers: {
        'Lrclib-Client': 'Loqa Music v1.0 (https://loqa-music.vercel.app)',
        'User-Agent':    'Loqa Music/1.0',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!r.ok) {
      const empty = { synced: null, plain: null };
      cache.set(cacheKey, { data: empty, ts: Date.now() });
      return res.json(empty);
    }

    const data = await r.json();
    const result = {
      synced:   data.syncedLyrics  || null,  // "[MM:SS.mm] line text"
      plain:    data.plainLyrics   || null,
      duration: data.duration      || null,
      source:   'lrclib',
    };

    // Evict old entries if cache is getting large (simple size cap)
    if (cache.size > 2000) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      cache.delete(oldest[0]);
    }

    cache.set(cacheKey, { data: result, ts: Date.now() });
    res.json(result);
  } catch (err) {
    // Network errors / timeouts — return empty rather than 500
    res.json({ synced: null, plain: null, error: 'lyrics_unavailable' });
  }
});

export default router;
