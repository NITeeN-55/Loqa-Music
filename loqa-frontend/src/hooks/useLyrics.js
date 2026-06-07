/**
 * useLyrics — fetches and tracks synced lyrics from the backend (/api/lyrics → LRCLIB).
 *
 * Returns:
 *   lines      — parsed array of { time: number (secs), text: string }
 *   plainText  — fallback plain lyrics string (when no .lrc available)
 *   loading    — bool
 *   activeIdx  — index of the currently playing line (-1 if none)
 *   hasLyrics  — true if any lyrics found
 */
import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api.js';

/* ── LRC parser ──────────────────────────────────────────────
   "[01:23.45] Some lyric line"  → { time: 83.45, text: "Some lyric line" }
   Handles optional centiseconds and various bracket formats.
──────────────────────────────────────────────────────────── */
function parseLRC(lrc) {
  if (!lrc || typeof lrc !== 'string') return [];
  return lrc
    .split('\n')
    .map(line => {
      const m = line.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/);
      if (!m) return null;
      const mins = parseInt(m[1], 10);
      const secs = parseInt(m[2], 10);
      const cs   = m[3] ? parseFloat(`0.${m[3].padEnd(3, '0')}`) : 0;
      const text = m[4].trim();
      return { time: mins * 60 + secs + cs, text };
    })
    .filter(l => l !== null)
    .sort((a, b) => a.time - b.time);
}

export function useLyrics(song, progress, duration) {
  const [lines,     setLines]    = useState([]);
  const [plainText, setPlain]    = useState('');
  const [loading,   setLoading]  = useState(false);
  const [activeIdx, setActive]   = useState(-1);
  const lastSongId = useRef(null);
  const lastFetch  = useRef(null); // abort controller

  /* ── Fetch when song changes ─────────────────────────────── */
  useEffect(() => {
    if (!song?.id) return;
    if (song.id === lastSongId.current) return;
    lastSongId.current = song.id;

    // Cancel any in-flight request
    lastFetch.current?.abort();
    setLines([]); setPlain(''); setActive(-1);

    // Skip if we don't have enough metadata
    const artist = (song.artist || '').replace(/\s*-\s*Topic\s*$/i, '').trim();
    const title  = (song.title  || '').trim();
    if (!artist || !title) return;

    setLoading(true);
    const ctrl = new AbortController();
    lastFetch.current = ctrl;

    const params = new URLSearchParams({ artist, title });
    if (song.dur > 0) params.set('duration', String(song.dur));

    apiFetch(`/api/lyrics?${params}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => {
        if (ctrl.signal.aborted) return;
        if (d.synced) {
          setLines(parseLRC(d.synced));
          setPlain('');
        } else if (d.plain) {
          setLines([]);
          setPlain(d.plain);
        }
        setLoading(false);
      })
      .catch(err => {
        if (err?.name === 'AbortError') return;
        setLoading(false);
      });

    return () => ctrl.abort();
  }, [song?.id]); // eslint-disable-line

  /* ── Track active line from playback position ──────────────── */
  useEffect(() => {
    if (!lines.length || !duration || duration <= 0) { setActive(-1); return; }
    const currentTime = (progress / 100) * duration;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentTime + 0.3) idx = i; // 0.3s lookahead
      else break;
    }
    setActive(prev => prev === idx ? prev : idx);
  }, [progress, lines, duration]);

  return {
    lines,
    plainText,
    loading,
    activeIdx,
    hasLyrics: lines.length > 0 || plainText.length > 0,
  };
}
