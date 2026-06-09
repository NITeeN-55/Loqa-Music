import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { Playlist, LikedSong, PlayHistory, SongCache } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/* ── URL validation helper ────────────────────────────────────
   Only allow http/https thumbnail URLs to prevent javascript: injection.
──────────────────────────────────────────────────────────────── */
function sanitizeThumb(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? url : '';
  } catch { return ''; }
}

/* Helper: normalise song fields from request body */
const songFields = (s) => ({
  song_id:     s.id     || s.song_id     || '',
  song_title:  s.title  || s.song_title  || 'Unknown',
  song_artist: s.artist || s.song_artist || 'Unknown',
  song_thumb:  sanitizeThumb(s.thumbnail || s.thumb || s.song_thumb || ''),
  song_dur:    s.dur    || s.song_dur    || 0,
});

/* Helper: silently cache a song (best-effort) */
const cacheS = (sf) =>
  SongCache.findByIdAndUpdate(
    sf.song_id,
    { $setOnInsert: { title: sf.song_title, artist: sf.song_artist, thumbnail: sf.song_thumb, duration: sf.song_dur } },
    { upsert: true, new: false }
  ).catch(() => {});

/* ── Full library snapshot ────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const [playlists, liked, history] = await Promise.all([
      Playlist.find({ user_id: req.userId }).sort({ created_at: -1 }),
      LikedSong.find({ user_id: req.userId }).sort({ liked_at: -1 }),
      PlayHistory.find({ user_id: req.userId }).sort({ played_at: -1 }).limit(50),
    ]);

    res.json({
      playlists: playlists.map(p => ({
        id:        p._id,
        name:      p.name,
        desc:      p.description,
        ci:        p.ci,
        createdAt: p.created_at,
        songs:     p.songs.map(s => s.song_id),
      })),
      liked: liked.map(l => ({
        id: l.song_id, title: l.song_title, artist: l.song_artist, thumbnail: l.song_thumb, dur: l.song_dur,
      })),
      history: history.map(h => ({
        id: h.song_id, title: h.song_title, artist: h.song_artist, thumbnail: h.song_thumb,
      })),
    });
  } catch (err) {
    console.error('library GET:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ── Playlists ────────────────────────────────────────── */
router.post('/playlists', async (req, res) => {
  const { name, desc = '', ci = 0 } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  const id = uuid();
  await Playlist.create({ _id: id, user_id: req.userId, name: name.trim(), description: desc.trim(), ci });
  res.status(201).json({ id, name: name.trim(), desc: desc.trim(), ci, songs: [] });
});

router.put('/playlists/:id', async (req, res) => {
  const { name, desc } = req.body;
  await Playlist.findOneAndUpdate(
    { _id: req.params.id, user_id: req.userId },
    { $set: { name, description: desc, updated_at: new Date() } }
  );
  res.json({ ok: true });
});

router.delete('/playlists/:id', async (req, res) => {
  await Playlist.findOneAndDelete({ _id: req.params.id, user_id: req.userId });
  res.json({ ok: true });
});

/* ── Playlist songs ───────────────────────────────────── */
router.post('/playlists/:id/songs', async (req, res) => {
  const sf = songFields(req.body);
  if (!sf.song_id) return res.status(400).json({ ok: false, error: 'song_id required' });

  try {
    // Only add if not already in the playlist (avoid duplicate)
    const playlist = await Playlist.findOne({ _id: req.params.id, user_id: req.userId });
    if (!playlist) return res.status(404).json({ ok: false, error: 'Playlist not found' });

    const alreadyIn = playlist.songs.some(s => s.song_id === sf.song_id);
    if (!alreadyIn) {
      const position = playlist.songs.length;
      await Playlist.findByIdAndUpdate(
        req.params.id,
        {
          $push: { songs: { ...sf, position, added_at: new Date() } },
          $set:  { updated_at: new Date() },
        }
      );
    }

    cacheS(sf);
    res.json({ ok: true });
  } catch (err) {
    console.error('playlist add song:', err);
    res.status(500).json({ ok: false });
  }
});

router.delete('/playlists/:id/songs/:songId', async (req, res) => {
  await Playlist.findOneAndUpdate(
    { _id: req.params.id, user_id: req.userId },
    {
      $pull: { songs: { song_id: req.params.songId } },
      $set:  { updated_at: new Date() },
    }
  );
  res.json({ ok: true });
});

/* ── Liked songs ──────────────────────────────────────── */
router.post('/likes', async (req, res) => {
  const sf = songFields(req.body);
  try {
    const exists = await LikedSong.findOne({ user_id: req.userId, song_id: sf.song_id });
    if (exists) {
      await LikedSong.deleteOne({ user_id: req.userId, song_id: sf.song_id });
      return res.json({ liked: false });
    }
    await LikedSong.create({ user_id: req.userId, ...sf, liked_at: new Date() });
    cacheS(sf);
    res.json({ liked: true });
  } catch (err) {
    console.error('like:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/likes', async (req, res) => {
  const rows = await LikedSong.find({ user_id: req.userId }).sort({ liked_at: -1 });
  res.json(rows.map(l => ({
    id: l.song_id, title: l.song_title, artist: l.song_artist, thumbnail: l.song_thumb, dur: l.song_dur,
  })));
});

/* ── Play history ─────────────────────────────────────── */
router.post('/history', async (req, res) => {
  const sf = songFields(req.body);
  await PlayHistory.create({ user_id: req.userId, ...sf, played_at: new Date() });
  cacheS(sf);
  res.json({ ok: true });
});

router.get('/history', async (req, res) => {
  const rows = await PlayHistory.aggregate([
    { $match: { user_id: req.userId } },
    { $sort:  { played_at: -1 } },
    { $group: {
        _id:         '$song_id',
        song_title:  { $first: '$song_title' },
        song_artist: { $first: '$song_artist' },
        song_thumb:  { $first: '$song_thumb' },
        last_played: { $max:   '$played_at' },
      },
    },
    { $sort:  { last_played: -1 } },
    { $limit: 30 },
  ]);
  res.json(rows.map(h => ({
    id: h._id, title: h.song_title, artist: h.song_artist, thumbnail: h.song_thumb,
  })));
});

/* ── Stats ────────────────────────────────────────────── */
router.get('/stats', async (req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [totalResult, topArtistResult, weekResult] = await Promise.all([
    PlayHistory.countDocuments({ user_id: req.userId }),
    PlayHistory.aggregate([
      { $match: { user_id: req.userId, song_artist: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: '$song_artist', plays: { $sum: 1 } } },
      { $sort:  { plays: -1 } },
      { $limit: 1 },
    ]),
    PlayHistory.countDocuments({ user_id: req.userId, played_at: { $gte: weekAgo } }),
  ]);

  res.json({
    totalPlays: totalResult || 0,
    topArtist:  topArtistResult[0]?._id || null,
    weekPlays:  weekResult || 0,
  });
});

export default router;
