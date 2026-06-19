/**
 * YouTube Routes — /api/youtube/*
 * Server-side proxy to YouTube InnerTube API
 * Keeps API keys out of the client bundle
 */
import { Router } from 'express';

const router = Router();

const INNERTUBE_API_KEY = process.env.INNERTUBE_API_KEY;
if (!INNERTUBE_API_KEY) {
  console.error('[youtube] INNERTUBE_API_KEY is not set in environment variables. YouTube routes will fail.');
}
const CLIENT_CTX = {
  client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en', gl: 'US' },
};

/* ── Helpers ──────────────────────────────────────────── */

async function ytPost(endpoint, body) {
  const r = await fetch(
    `https://www.youtube.com/youtubei/v1/${endpoint}?key=${INNERTUBE_API_KEY}&prettyPrint=false`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  return r.json();
}

function parseVideoRenderers(obj) {
  const items = [];
  function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (o.videoRenderer?.videoId) { addVideo(o.videoRenderer, items); return; }
    if (o.compactVideoRenderer?.videoId) { addCompact(o.compactVideoRenderer, items); return; }
    for (const k of Object.keys(o)) {
      if (Array.isArray(o[k])) o[k].forEach(walk);
      else if (typeof o[k] === 'object') walk(o[k]);
    }
  }
  walk(obj);
  return items;
}

function addVideo(v, items) {
  const dur = parseDur(v.lengthText?.simpleText);
  if (dur < 10) return;
  items.push({
    id: v.videoId,
    title: v.title?.runs?.map(r => r.text).join('') || 'Unknown',
    artist: v.ownerText?.runs?.map(r => r.text).join('') || 'Unknown',
    album: 'YouTube',
    dur, ci: items.length % 8, ai: items.length,
    thumbnail: v.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || '',
    views: v.viewCountText?.simpleText || '',
  });
}

function addCompact(v, items) {
  const dur = parseDur(v.lengthText?.simpleText);
  if (dur < 10) return;
  items.push({
    id: v.videoId,
    title: v.title?.simpleText || v.title?.runs?.map(r => r.text).join('') || 'Unknown',
    artist: v.longBylineText?.runs?.map(r => r.text).join('') || v.shortBylineText?.runs?.map(r => r.text).join('') || 'Unknown',
    album: 'YouTube', dur, ci: items.length % 8, ai: items.length,
    thumbnail: v.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || '',
  });
}

function parseDur(s) {
  if (!s) return 0;
  const p = s.split(':').map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + (p[1] || 0);
}

/* ── Routes ───────────────────────────────────────────── */

router.get('/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Missing ?q=' });
  try {
    const d = await ytPost('search', {
      context: CLIENT_CTX,
      query: q,
      params: 'EgWKAQIIAWoMEAMQBBAJEAoQBRAW',
    });
    res.json({ items: parseVideoRenderers(d.contents) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/trending', async (_req, res) => {
  try {
    const d = await ytPost('browse', {
      context: CLIENT_CTX,
      browseId: 'FEtrending',
      params: '6gQJRkVleHBsb3Jl',
    });
    res.json({ items: parseVideoRenderers(d).slice(0, 30) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/related', async (req, res) => {
  const v = req.query.v;
  if (!v) return res.status(400).json({ error: 'Missing ?v=' });
  try {
    const d = await ytPost('next', { context: CLIENT_CTX, videoId: v });
    res.json({ items: parseVideoRenderers(d).slice(0, 20) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/suggestions', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json({ suggestions: [] });
  try {
    const r = await fetch(
      `https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(q)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const t = await r.text();
    const m = t.match(/\[.+\]/s);
    if (m) {
      const p = JSON.parse(m[0]);
      return res.json({
        suggestions: (p[1] || []).map(s => s[0]).filter(Boolean).slice(0, 10),
      });
    }
    res.json({ suggestions: [] });
  } catch {
    res.json({ suggestions: [] });
  }
});

router.get('/genre', async (req, res) => {
  const g = req.query.g || 'pop hits';
  try {
    const d = await ytPost('search', {
      context: CLIENT_CTX,
      query: `${g} songs 2024`,
      params: 'EgWKAQIIAWoMEAMQBBAJEAoQBRAW',
    });
    res.json({ items: parseVideoRenderers(d.contents).slice(0, 12) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
