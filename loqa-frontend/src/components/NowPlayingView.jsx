/**
 * NowPlayingView — Full-Screen "Now Playing" modal
 *
 * Features implemented from audit:
 *  - Dynamic album art color extraction (no ColorThief dep — uses canvas pixel sampling)
 *  - Simulated waveform visualizer (Canvas, deterministic per song)
 *  - Real-time lyrics via LRCLIB API (synced + plain-text fallback)
 *  - Gesture controls (swipe left/right/down on mobile)
 *  - Queue preview panel
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { gradStr, fmtTime } from '../utils/constants.js';
import { Svg, I, EqBars } from './Icons.jsx';
import usePlayerStore from '../stores/playerStore.js';

const PORTAL_ROOT = document.getElementById('loqa-portals') || document.body;

/* ── Colour extraction from thumbnail ───────────────────── */
function extractColor(imgUrl, callback) {
  if (!imgUrl) { callback(null); return; }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 16;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 16, 16);
      const d = ctx.getImageData(0, 0, 16, 16).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        // Skip very dark / very light pixels — they skew the average
        const lum = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        if (lum > 20 && lum < 230) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
      }
      if (n) callback({ r: Math.round(r/n), g: Math.round(g/n), b: Math.round(b/n) });
      else   callback(null);
    } catch { callback(null); }
  };
  img.onerror = () => callback(null);
  img.src = imgUrl;
}

/* ── LRCLIB lyrics (via backend proxy to avoid CORS) ─────── */
async function fetchLyrics(artist, title) {
  if (!artist || !title) return null;
  try {
    const params = new URLSearchParams({ artist, title });
    const res = await fetch(`/api/lyrics?${params}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.synced) return { type: 'synced', lines: parseLrc(data.synced) };
    if (data.plain)  return { type: 'plain',  text: data.plain };
    return null;
  } catch { return null; }
}

function parseLrc(lrc) {
  return lrc.split('\n')
    .map(line => {
      const m = line.match(/^\[(\d+):(\d+\.\d+)\]\s*(.*)/);
      if (!m) return null;
      return { time: parseInt(m[1]) * 60 + parseFloat(m[2]), text: m[3] };
    })
    .filter(Boolean);
}

/* ── Waveform Canvas ─────────────────────────────────────── */
function WaveformCanvas({ songId, progress, C }) {
  const canvasRef = useRef(null);
  // Deterministic "random" wave seeded by song ID so same song = same wave
  const bars = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < (songId || '').length; i++) seed += songId.charCodeAt(i);
    const lcg = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
    return Array.from({ length: 80 }, () => 0.15 + lcg() * 0.85);
  }, [songId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const bw = W / bars.length - 1;
    const filled = progress / 100;
    bars.forEach((h, i) => {
      const x = i * (bw + 1);
      const barH = h * H;
      const y = (H - barH) / 2;
      const pct = i / bars.length;
      ctx.fillStyle = pct <= filled ? C.accent : C.border2 || 'rgba(255,255,255,.2)';
      ctx.beginPath();
      ctx.roundRect(x, y, bw, barH, 2);
      ctx.fill();
    });
  }, [bars, progress, C]);

  return (
    <canvas ref={canvasRef} width={320} height={48}
      style={{ width: '100%', height: 48, display: 'block', cursor: 'pointer' }}
      aria-hidden="true" />
  );
}

/* ── Main NowPlayingView ─────────────────────────────────── */
export default function NowPlayingView({
  song, playing, duration, volume, muted,
  shuffle, repeat, liked, queue,
  onTogglePlay, onPrev, onNext, onSeek, onVolume, onMute,
  onShuffle, onRepeat, onLike, onClose,
  C, isMobile,
}) {
  // Subscribe to progress locally so NowPlayingView re-renders on ticks
  // rather than App.jsx (same pattern as PlayerBar)
  const progress = usePlayerStore(s => s.progress);
  const [color, setColor]       = useState(null);
  const [lyrics, setLyrics]     = useState(null);
  const [lyricsLoading, setLL]  = useState(false);
  const [activeTab, setTab]     = useState('player'); // 'player' | 'lyrics' | 'queue'
  const [dragging, setDragging] = useState(false);
  const progressRef             = useRef(null);

  // Touch swipe handling
  const touchStart = useRef({ x: 0, y: 0 });
  const onTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (adx > ady && adx > 80) { if (dx < 0) onNext(); else onPrev(); }
    else if (dy > 100 && ady > adx) onClose();
  };

  // Extract dominant color from thumbnail
  useEffect(() => {
    if (!song?.thumbnail) { setColor(null); return; }
    extractColor(song.thumbnail, c => setColor(c));
  }, [song?.thumbnail]);

  // Fetch lyrics
  useEffect(() => {
    if (!song) { setLyrics(null); return; }
    setLL(true);
    setLyrics(null);
    fetchLyrics(song.artist, song.title).then(l => { setLyrics(l); setLL(false); });
  }, [song?.id]);

  // ESC closes
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Active lyric line index
  const activeLyricIdx = useMemo(() => {
    if (!lyrics?.lines || !duration) return -1;
    const sec = (progress / 100) * duration;
    let idx = -1;
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (lyrics.lines[i].time <= sec) idx = i;
    }
    return idx;
  }, [lyrics, progress, duration]);

  // Auto-scroll active lyric into view
  const lyricRef = useRef(null);
  useEffect(() => {
    if (activeLyricIdx < 0 || !lyricRef.current) return;
    const el = lyricRef.current.querySelector(`[data-idx="${activeLyricIdx}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeLyricIdx]);

  // Seek by clicking on progress bar / waveform
  const handleProgressClick = useCallback((e) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    onSeek(pct);
  }, [onSeek]);

  if (!song) return null;

  // Background gradient from dominant color
  const colorStr = color ? `rgb(${color.r},${color.g},${color.b})` : null;
  const bgGrad = colorStr
    ? `linear-gradient(160deg, ${colorStr} 0%, #0a0a10 60%, #06060a 100%)`
    : `linear-gradient(160deg, ${C.bg3} 0%, ${C.bg} 100%)`;

  const modal = (
    <div
      onTouchStart={isMobile ? onTouchStart : undefined}
      onTouchEnd={isMobile ? onTouchEnd : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 8000,
        background: bgGrad,
        display: 'flex', flexDirection: 'column',
        transition: 'background .6s ease',
      }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '16px 20px' : '20px 32px', flexShrink: 0 }}>
        {/* Chevron down */}
        <button onClick={onClose} aria-label="Minimize player"
          style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 10,
            padding: '8px 10px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.7)', letterSpacing: .5 }}>
          NOW PLAYING
        </span>
        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['player', 'lyrics', 'queue']).map(tab => (
            <button key={tab} onClick={() => setTab(tab)}
              aria-pressed={activeTab === tab}
              style={{ background: activeTab === tab ? 'rgba(255,255,255,.2)' : 'transparent',
                border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                color: activeTab === tab ? '#fff' : 'rgba(255,255,255,.5)',
                fontSize: 11, fontWeight: 600, textTransform: 'capitalize', fontFamily: 'inherit' }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content area ────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* PLAYER TAB */}
        {activeTab === 'player' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center', justifyContent: 'center', gap: isMobile ? 24 : 48,
            padding: isMobile ? '0 24px' : '0 64px', overflow: 'auto' }}>

            {/* Album art */}
            <div style={{ flexShrink: 0, position: 'relative' }}>
              <div style={{
                width: isMobile ? Math.min(window.innerWidth - 80, 300) : 320,
                height: isMobile ? Math.min(window.innerWidth - 80, 300) : 320,
                borderRadius: 20,
                overflow: 'hidden',
                boxShadow: colorStr
                  ? `0 32px 80px ${colorStr.replace(')', ',.5)')}`
                  : '0 32px 80px rgba(0,0,0,.6)',
                transition: 'box-shadow .6s',
              }}>
                {song.thumbnail
                  ? <img src={song.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', background: gradStr(song.ci ?? 0),
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="80" height="80" viewBox="0 0 24 24" fill="rgba(255,255,255,.3)" stroke="white">
                        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                      </svg>
                    </div>
                }
                {playing && (
                  <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0,
                    display: 'flex', justifyContent: 'center' }}>
                    <EqBars size={22} color="#fff" playing />
                  </div>
                )}
              </div>
            </div>

            {/* Info + controls */}
            <div style={{ flex: 1, minWidth: 0, maxWidth: 440, width: '100%' }}>
              {/* Song info */}
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: '#fff', margin: '0 0 6px',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {song.title}
                </h2>
                <p style={{ fontSize: 16, color: 'rgba(255,255,255,.65)', margin: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {song.artist}
                </p>
              </div>

              {/* Like + Share */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <button onClick={() => onLike(song.id)} aria-label={liked ? 'Unlike' : 'Like'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                    color: liked ? '#ff6b9d' : 'rgba(255,255,255,.5)', padding: 4 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24"
                    fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
                <span style={{ flex: 1 }} />
                <button onClick={() => setTab('lyrics')}
                  style={{ background: activeTab === 'lyrics' ? 'rgba(255,255,255,.15)' : 'transparent',
                    border: '1px solid rgba(255,255,255,.2)', borderRadius: 8,
                    padding: '6px 12px', cursor: 'pointer', color: 'rgba(255,255,255,.7)',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                  🎤 Lyrics
                </button>
              </div>

              {/* Waveform / progress */}
              <div style={{ marginBottom: 8 }}>
                <div ref={progressRef} onClick={handleProgressClick} style={{ cursor: 'pointer' }}>
                  <WaveformCanvas songId={song.id} progress={progress} C={{
                    accent: colorStr || C.accent, border2: 'rgba(255,255,255,.2)'
                  }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 24 }}>
                <span>{fmtTime(duration * (progress / 100))}</span>
                <span>{fmtTime(duration)}</span>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <button onClick={onShuffle} aria-label="Shuffle" aria-pressed={shuffle}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                    color: shuffle ? (colorStr || C.accent) : 'rgba(255,255,255,.5)', padding: 6 }}>
                  <Svg d={I.shuffle} size={20} stroke="currentColor" />
                </button>
                <button onClick={onPrev} aria-label="Previous"
                  style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: '50%',
                    width: 52, height: 52, cursor: 'pointer', color: '#fff', display: 'flex',
                    alignItems: 'center', justifyContent: 'center' }}>
                  <Svg d={I.prev} size={22} stroke="currentColor" fill="currentColor" />
                </button>
                <button onClick={onTogglePlay} aria-label={playing ? 'Pause' : 'Play'}
                  style={{ background: '#fff', border: 'none', borderRadius: '50%',
                    width: 68, height: 68, cursor: 'pointer', color: '#111', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    boxShadow: colorStr ? `0 8px 32px ${colorStr.replace(')', ',.5)')}` : '0 8px 24px rgba(0,0,0,.4)' }}>
                  <Svg d={playing ? I.pause : I.play} size={28} fill="#111" stroke="#111" />
                </button>
                <button onClick={onNext} aria-label="Next"
                  style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: '50%',
                    width: 52, height: 52, cursor: 'pointer', color: '#fff', display: 'flex',
                    alignItems: 'center', justifyContent: 'center' }}>
                  <Svg d={I.next} size={22} stroke="currentColor" fill="currentColor" />
                </button>
                <button onClick={onRepeat} aria-label="Repeat" aria-pressed={repeat}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                    color: repeat ? (colorStr || C.accent) : 'rgba(255,255,255,.5)', padding: 6 }}>
                  <Svg d={I.repeat} size={20} stroke="currentColor" />
                </button>
              </div>

              {/* Volume */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24 }}>
                <button onClick={onMute} aria-label={muted ? 'Unmute' : 'Mute'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,.5)', padding: 4 }}>
                  <Svg d={muted ? I.volX : volume < 50 ? I.volLow : I.volHigh} size={16} stroke="currentColor" />
                </button>
                <input type="range" min={0} max={100} value={muted ? 0 : volume}
                  onChange={e => onVolume(+e.target.value)}
                  style={{ flex: 1, accentColor: colorStr || C.accent, cursor: 'pointer' }}
                  aria-label="Volume" />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', minWidth: 28, textAlign: 'right' }}>
                  {muted ? 0 : volume}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* LYRICS TAB */}
        {activeTab === 'lyrics' && (
          <div ref={lyricRef} style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 28px' : '20px 80px',
            textAlign: 'center' }}>
            {lyricsLoading && (
              <div style={{ color: 'rgba(255,255,255,.5)', padding: '40px 0', fontSize: 14 }}>
                Loading lyrics…
              </div>
            )}
            {!lyricsLoading && !lyrics && (
              <div style={{ color: 'rgba(255,255,255,.35)', padding: '60px 20px' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎤</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No lyrics found</div>
                <div style={{ fontSize: 13 }}>Lyrics for {song.title} aren't available yet</div>
              </div>
            )}
            {!lyricsLoading && lyrics?.type === 'synced' && lyrics.lines.map((line, i) => (
              <div key={i} data-idx={i}
                style={{
                  fontSize: i === activeLyricIdx ? (isMobile ? 22 : 26) : (isMobile ? 16 : 18),
                  fontWeight: i === activeLyricIdx ? 800 : 400,
                  color: i === activeLyricIdx ? '#fff' : 'rgba(255,255,255,.3)',
                  margin: '10px 0',
                  transition: 'all .3s ease',
                  cursor: 'pointer',
                  lineHeight: 1.4,
                }}
                onClick={() => onSeek((line.time / duration) * 100)}>
                {line.text || '·'}
              </div>
            ))}
            {!lyricsLoading && lyrics?.type === 'plain' && (
              <pre style={{ fontFamily: 'inherit', fontSize: isMobile ? 16 : 18,
                color: 'rgba(255,255,255,.8)', whiteSpace: 'pre-wrap', textAlign: 'center',
                lineHeight: 1.8, margin: 0 }}>
                {lyrics.text}
              </pre>
            )}
            <div style={{ height: 40 }} />
          </div>
        )}

        {/* QUEUE TAB */}
        {activeTab === 'queue' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '8px 16px' : '8px 40px' }}>
            {queue.length === 0
              ? <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,.35)' }}>
                  Queue is empty
                </div>
              : queue.map((s, i) => (
                <div key={`${s.id}-${i}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                    borderRadius: 10, marginBottom: 2,
                    background: s.id === song.id ? 'rgba(255,255,255,.1)' : 'transparent' }}>
                  <span style={{ width: 20, fontSize: 12, color: 'rgba(255,255,255,.35)', textAlign: 'center' }}>
                    {i + 1}
                  </span>
                  <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                    background: gradStr(s.ci ?? 0) }}>
                    {s.thumbnail && <img src={s.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: s.id === song.id ? '#fff' : 'rgba(255,255,255,.8)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{s.artist}</div>
                  </div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>{fmtTime(s.dur)}</span>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* Swipe hint for mobile */}
      {isMobile && (
        <div style={{ textAlign: 'center', padding: '8px 0 20px', color: 'rgba(255,255,255,.2)', fontSize: 11 }}>
          Swipe left/right to skip · Swipe down to close
        </div>
      )}
    </div>
  );

  return createPortal(modal, PORTAL_ROOT);
}
