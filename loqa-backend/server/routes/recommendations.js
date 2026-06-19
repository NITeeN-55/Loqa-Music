/**
 * Personalised Recommendations Engine v4.0 (MongoDB)
 *
 * Strategy (like Spotify Radio):
 *  1. Score artists from play_history (recency-weighted) using aggregation
 *  2. Bonus for liked artists
 *  3. Seed from currently-playing song's artist
 *  4. Fetch YouTube results for top artists in parallel
 *  5. Deduplicate + exclude recently played + weighted shuffle
 *  6. Return up to `limit` songs
 */
import { Router } from 'express';
import { PlayHistory, LikedSong } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const IK = process.env.INNERTUBE_API_KEY;
if (!IK) {
  console.error('[recommendations] INNERTUBE_API_KEY not set — recommendation searches will fail.');
}
const BASE = 'https://www.youtube.com/youtubei/v1';
const CTX  = {
  context: {
    client: {
      clientName: 'WEB_REMIX', clientVersion: '1.20240101.01.00',
      hl: 'en', gl: 'US', userAgent: 'Mozilla/5.0', visitorData: '',
    },
  },
};

async function ytPost(endpoint, body) {
  const r = await fetch(`${BASE}/${endpoint}?key=${IK}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ ...CTX, ...body }),
  });
  if (!r.ok) throw new Error(`YT ${r.status}`);
  return r.json();
}

function parseMusicSearch(data) {
  const out = [];
  try {
    const tabs = data?.contents?.tabbedSearchResultsRenderer?.tabs || [];
    for (const tab of tabs) {
      const sections = tab?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      for (const sec of sections) {
        const items = sec?.musicShelfRenderer?.contents || [];
        for (const item of items) {
          const r = item?.musicResponsiveListItemRenderer;
          if (!r) continue;
          const videoId = r.playlistItemData?.videoId
            || r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer
               ?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;
          if (!videoId) continue;
          const title  = r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || '';
          const artist = r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || '';
          const thumb  = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.pop()?.url || '';
          if (title) out.push({ id: videoId, title, artist, thumbnail: thumb, isYoutube: true });
        }
      }
    }
  } catch {}
  return out;
}

async function searchYT(q, limit = 6) {
  try {
    const d = await ytPost('search', {
      query: q,
      params: 'Eg-KAQwIARAAGAAgACgAMABqChAEEAMQCRAFEAo%3D',
    });
    return parseMusicSearch(d).slice(0, limit);
  } catch { return []; }
}

function weightedShuffle(arr) {
  return arr
    .map(item => ({ ...item, _r: Math.random() }))
    .sort((a, b) => a._r - b._r)
    .map(({ _r, ...item }) => item);
}

/** Fetch up to 5 similar artists from Last.fm (free, no auth if key set) */
async function getLastFmSimilar(artist) {
  const key = process.env.LASTFM_API_KEY;
  if (!key || !artist) return [];
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getSimilar`
      + `&artist=${encodeURIComponent(artist)}&api_key=${key}&format=json&limit=5`;
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.similarartists?.artist || []).map(a => a.name).filter(Boolean);
  } catch { return []; }
}

router.get('/', async (req, res) => {
  try {
    const limit      = Math.min(parseInt(req.query.limit) || 30, 60);
    const seedArtist = req.query.seed_artist || '';
    const seedId     = req.query.seed_id     || '';

    const now    = new Date();
    const days7  = new Date(now - 7  * 24 * 3600 * 1000);
    const days30 = new Date(now - 30 * 24 * 3600 * 1000);
    const days90 = new Date(now - 90 * 24 * 3600 * 1000);
    const hours6 = new Date(now - 6  * 3600 * 1000);

    /* ── 1. Score top artists from history (recency-weighted) ── */
    const histRows = await PlayHistory.aggregate([
      {
        $match: {
          user_id:     req.userId,
          song_artist: { $exists: true, $nin: [null, ''] },
          played_at:   { $gte: days90 },
        },
      },
      {
        $group: {
          _id:   '$song_artist',
          plays: { $sum: 1 },
          score: {
            $sum: {
              $switch: {
                branches: [
                  { case: { $gte: ['$played_at', days7]  }, then: 3 },
                  { case: { $gte: ['$played_at', days30] }, then: 2 },
                ],
                default: 1,
              },
            },
          },
        },
      },
      { $sort: { score: -1, plays: -1 } },
      { $limit: 8 },
    ]);

    /* ── 2. Bonus for liked artists ─────────────────────────── */
    const likedRows = await LikedSong.aggregate([
      {
        $match: {
          user_id:     req.userId,
          song_artist: { $exists: true, $nin: [null, ''] },
        },
      },
      { $group: { _id: '$song_artist', cnt: { $sum: 1 } } },
      { $sort:  { cnt: -1 } },
      { $limit: 8 },
    ]);

    /* ── 3. Merge + deduplicate artists with scoring ─────────── */
    const artistScore = new Map();
    for (const { _id: a, score } of histRows)  artistScore.set(a, (artistScore.get(a) || 0) + score * 2);
    for (const { _id: a, cnt }   of likedRows) artistScore.set(a, (artistScore.get(a) || 0) + cnt   * 3);
    if (seedArtist) artistScore.set(seedArtist, (artistScore.get(seedArtist) || 0) + 20);

    const topArtists = [...artistScore.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 7);

    /* ── 4. Build search queries — incl. Last.fm discovery ─── */
    const queries = [];
    if (seedArtist) {
      queries.push(`${seedArtist} best songs`);
      queries.push(`${seedArtist} similar artists music`);
    }
    for (const a of topArtists.slice(0, 5)) {
      if (a !== seedArtist) queries.push(`${a} music hits`);
    }

    // Last.fm: fetch similar artists for top 2 scored artists → genuine discovery
    const discoveryArtists = [];
    if (topArtists.length > 0) {
      const [sim1, sim2] = await Promise.all([
        getLastFmSimilar(topArtists[0]),
        topArtists[1] ? getLastFmSimilar(topArtists[1]) : Promise.resolve([]),
      ]);
      // Only add artists the user hasn't heard (not in artistScore)
      const newArtists = [...sim1, ...sim2]
        .filter(a => !artistScore.has(a))
        .slice(0, 3);
      for (const a of newArtists) {
        queries.push(`${a} music hits`);
        discoveryArtists.push(a);
      }
    }

    // 20% novelty: inject 1-2 random genre searches to surface unknown artists
    const NOVELTY_GENRES = ['indie music 2024', 'emerging artists pop', 'underground hip hop'];
    if (Math.random() < 0.2) {
      queries.push(NOVELTY_GENRES[Math.floor(Math.random() * NOVELTY_GENRES.length)]);
    }
    if (topArtists.length < 2) {
      queries.push('top music hits 2024', 'trending songs this week');
    }

    /* ── 5. Fetch all queries in parallel ────────────────────── */
    const batches = await Promise.allSettled(
      queries.slice(0, 8).map(q => searchYT(q, 6))
    );

    /* ── 6. Merge + deduplicate ──────────────────────────────── */
    const seen   = new Set();
    const result = [];
    for (const b of batches) {
      if (b.status !== 'fulfilled') continue;
      for (const song of b.value) {
        if (!song?.id || seen.has(song.id)) continue;
        seen.add(song.id);
        result.push({ ...song, source: 'recommendation' });
      }
    }

    /* ── 7. Exclude recently played (last 6 hours) ───────────── */
    const recentIds = new Set(
      await PlayHistory.distinct('song_id', { user_id: req.userId, played_at: { $gte: hours6 } })
    );
    if (seedId) recentIds.delete(seedId);

    const filtered = result.filter(s => !recentIds.has(s.id));

    /* ── 8. Diversity cap: max 2 songs per artist ────────────── */
    const artistCount = new Map();
    const diverse = filtered.filter(s => {
      const a = (s.artist || '').toLowerCase();
      const count = artistCount.get(a) || 0;
      if (count >= 2) return false;
      artistCount.set(a, count + 1);
      return true;
    });

    /* ── 9. Weighted shuffle + assign gradient colours ────────── */
    const shuffled = weightedShuffle(diverse)
      .slice(0, limit)
      .map((s, i) => ({ ...s, ci: i % 8, ai: i }));

    res.json({
      items:           shuffled,
      basedOn:         topArtists.slice(0, 4),
      discoveryArtists: discoveryArtists,
      seedUsed:        !!seedArtist,
    });
  } catch (err) {
    console.error('[recommendations]', err.message);
    res.status(500).json({ error: 'Server error', items: [] });
  }
});

export default router;
