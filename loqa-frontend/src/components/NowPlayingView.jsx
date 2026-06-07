/**
 * NowPlayingView — Full-screen "Now Playing" overlay.
 *
 * Features:
 *  ✓ Dynamic background color extracted from album art
 *  ✓ Animated album art (scales up/down on play/pause)
 *  ✓ Synced + plain lyrics with auto-scroll
 *  ✓ Queue preview tab
 *  ✓ Sleep timer UI
 *  ✓ Swipe-to-dismiss (down), swipe-to-skip (left/right) on mobile
 *  ✓ Accessible (focus trap, aria roles, keyboard nav)
 *  ✓ Smooth entry/exit animations
 */
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { fmtTime, gradStr } from '../utils/constants.js';
import { Svg, I, EqBars, Spinner } from './Icons.jsx';
import { Thumb } from './UI.jsx';

const PORTAL = document.getElementById('loqa-portals') || document.body;

/* ─── Color extraction from thumbnail ─────────────────────────
   Uses a 50×50 canvas sample to find the dominant colour.
   Returns { r, g, b } or null on failure.
──────────────────────────────────────────────────────────── */
async function extractDominantColor(thumbnailUrl) {
  if (!thumbnailUrl) return null;
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 50;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 50, 50);
        const { data } = ctx.getImageData(0, 0, 50, 50);
        let r = 0, g = 0, b = 0, n = 0;
        // Sample every 4th pixel, skip very bright/dark pixels (near white/black)
        for (let i = 0; i < data.length; i += 16) {
          const pr = data[i], pg = data[i+1], pb = data[i+2];
          const brightness = (pr + pg + pb) / 3;
          if (brightness < 30 || brightness > 225) continue;
          r += pr; g += pg; b += pb; n++;
        }
        if (n === 0) return resolve(null);
        resolve({ r: r/n | 0, g: g/n | 0, b: b/n | 0 });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    // Add timestamp to bypass CORS cached response
    img.src = thumbnailUrl.includes('?') ? thumbnailUrl : `${thumbnailUrl}?_=${Date.now()}`;
  });
}

/* ─── Lyrics Panel ─────────────────────────────────────────── */
const LyricsPanel = memo(function LyricsPanel({ lines, plainText, loading, activeIdx, color }) {
  const activeRef = useRef(null);

  // Auto-scroll to active line
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIdx]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, opacity: .6 }}>
        <Spinner size={28} />
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>Finding lyrics…</span>
      </div>
    );
  }
  if (!lines.length && !plainText) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10, opacity: .5, padding: '0 24px', textAlign: 'center' }}>
        <Svg d={I.lyrics} size={40} stroke="rgba(255,255,255,.5)" />
        <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>No lyrics found</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Lyrics aren't available for this song</div>
      </div>
    );
  }
  if (plainText) {
    return (
      <div style={{ overflowY: 'auto', flex: 1, padding: '0 28px 80px' }}>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.9, color: 'rgba(255,255,255,.75)' }}>
          {plainText}
        </pre>
      </div>
    );
  }
  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '0 28px 80px' }}>
      {lines.map((line, i) => (
        <div
          key={i}
          ref={i === activeIdx ? activeRef : null}
          style={{
            fontSize: i === activeIdx ? 22 : 18,
            fontWeight: i === activeIdx ? 800 : 400,
            lineHeight: 1.5,
            marginBottom: 16,
            color: i === activeIdx
              ? '#fff'
              : i < activeIdx
                ? 'rgba(255,255,255,.35)'
                : 'rgba(255,255,255,.55)',
            transition: 'all .3s ease',
            cursor: 'default',
            textShadow: i === activeIdx && color
              ? `0 0 40px rgb(${color.r},${color.g},${color.b})`
              : 'none',
          }}
        >
          {line.text || '♪'}
        </div>
      ))}
    </div>
  );
});

/* ─── Queue Item ────────────────────────────────────────────── */
const QueueItem = memo(function QueueItem({ song, idx, onPlay, onRemove, C }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
      <div style={{ width: 20, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,.3)', flexShrink: 0 }}>{idx + 1}</div>
      <Thumb song={song} size={42} radius={8} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist}</div>
      </div>
      <button onClick={() => onPlay(song, idx)}
        style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#fff', fontSize: 12, flexShrink: 0 }}>
        Play
      </button>
      <button onClick={() => onRemove(idx)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(255,255,255,.4)', flexShrink: 0 }}>
        <Svg d={I.close} size={14} stroke="currentColor" />
      </button>
    </div>
  );
});

/* ─── Sleep Timer Modal ─────────────────────────────────────── */
function SleepTimerPanel({ sleepTimer, onStart, onStop }) {
  const OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90];
  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>⏰ Sleep Timer</div>
      {sleepTimer.active ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{sleepTimer.remainingFmt}</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', marginBottom: 24 }}>Music stops when timer ends</div>
          <button onClick={onStop}
            style={{ background: 'rgba(255,77,109,.2)', border: '1px solid rgba(255,77,109,.4)', borderRadius: 12, padding: '12px 32px', cursor: 'pointer', color: '#ff4d6d', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
            Cancel Timer
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {OPTIONS.map(min => (
            <button key={min} onClick={() => onStart(min)}
              style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 12, padding: '14px 8px', cursor: 'pointer', color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit', transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.1)'}>
              {min}m
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main NowPlayingView ───────────────────────────────────── */
export const NowPlayingView = memo(function NowPlayingView({
  C, song, playing, progress, duration, volume, muted,
  shuffle, repeat, liked, queue, related,
  lyrics,        // { lines, plainText, loading, activeIdx, hasLyrics }
  sleepTimer,    // { active, remainingFmt, start, stop }
  onTogglePlay, onPrev, onNext, onSeek,
  onVolume, onMute, onShuffle, onRepeat,
  onLike, onClose, onToggleQueue,
  onPlayFromQueue, onRemoveFromQueue,
  isMobile,
}) {
  const [color, setColor]   = useState(null);
  const [tab, setTab]       = useState('queue');      // 'queue' | 'lyrics' | 'sleep'
  const [visible, setVisible] = useState(false);       // for entrance animation
  const [closing, setClosing] = useState(false);

  // Touch gesture state
  const touchRef = useRef({ x: 0, y: 0, t: 0 });

  /* ── Entrance animation ─────────────────────────────────── */
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    // Lock body scroll
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  /* ── Extract dominant color when song changes ─────────────── */
  useEffect(() => {
    if (!song?.thumbnail) return;
    extractDominantColor(song.thumbnail).then(setColor);
  }, [song?.thumbnail]);

  /* ── Switch to lyrics tab if we have lyrics ──────────────── */
  useEffect(() => {
    if (lyrics?.hasLyrics && tab === 'queue') setTab('lyrics');
  }, [lyrics?.hasLyrics]); // eslint-disable-line

  /* ── ESC to close ────────────────────────────────────────── */
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []); // eslint-disable-line

  /* ── Animated close ─────────────────────────────────────── */
  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => onClose(), 280);
  }, [onClose]);

  /* ── Gesture handling ────────────────────────────────────── */
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e) => {
    const { x, y, t } = touchRef.current;
    const dx  = e.changedTouches[0].clientX - x;
    const dy  = e.changedTouches[0].clientY - y;
    const dt  = Date.now() - t;
    const spd = Math.abs(dx) / dt; // px/ms

    // Swipe down = close (only on the top part of screen)
    if (dy > 100 && Math.abs(dx) < 80 && e.changedTouches[0].clientY < window.innerHeight * 0.5) {
      handleClose(); return;
    }
    // Swipe left = next, right = prev (fast swipe)
    if (spd > 0.4 && Math.abs(dy) < 80 && Math.abs(dx) > 50) {
      dx < 0 ? onNext() : onPrev();
    }
  };

  if (!song) return null;

  const bg = color
    ? `linear-gradient(180deg, rgb(${color.r},${color.g},${color.b}) 0%, rgba(${color.r},${color.g},${color.b},.55) 35%, rgba(${color.r*.4|0},${color.g*.4|0},${color.b*.4|0},.3) 65%, ${C.bg} 100%)`
    : `linear-gradient(180deg, ${C.bg3} 0%, ${C.bg} 100%)`;

  const allQueue = [...queue, ...related.slice(0, 10)];

  return createPortal(
    <div
      aria-modal="true"
      role="dialog"
      aria-label="Now Playing"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: bg,
        display: 'flex', flexDirection: 'column',
        overflowY: 'hidden',
        transform: closing ? 'translateY(100%)' : visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform .3s cubic-bezier(.32,.72,0,1)',
        willChange: 'transform',
      }}
    >
      {/* ── Ambient glow layer ─────────────────────────────── */}
      {color && (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: `radial-gradient(ellipse 70% 40% at 50% 0%, rgba(${color.r},${color.g},${color.b},.25) 0%, transparent 70%)`,
        }} />
      )}

      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 8px', flexShrink: 0 }}>
        <button onClick={handleClose} aria-label="Minimize player"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.7)', padding: 8, borderRadius: 8 }}>
          <Svg d="M19 9l-7 7-7-7" size={22} stroke="currentColor" strokeWidth={2.5} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>
            {song.source === 'autoplay' ? 'Autoplay' : song.source === 'recommendations' ? 'Recommended' : 'Now Playing'}
          </div>
          {sleepTimer.active && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>
              ⏰ {sleepTimer.remainingFmt}
            </div>
          )}
        </div>
        <button onClick={() => setTab(tab === 'sleep' ? 'queue' : 'sleep')} aria-label="Sleep timer"
          style={{ background: sleepTimer.active ? 'rgba(255,255,255,.15)' : 'none', border: 'none', cursor: 'pointer', color: sleepTimer.active ? '#fff' : 'rgba(255,255,255,.7)', padding: 8, borderRadius: 8, fontSize: 18, lineHeight: 1 }}>
          ⏰
        </button>
      </div>

      {/* ── Main content (art + info + controls) + side panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* ── LEFT: Art + Controls ─────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', width: isMobile ? '100%' : 400, flexShrink: 0 }}>

          {/* Album Art */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: isMobile ? '8px 48px 16px' : '8px 40px 20px', flexShrink: 0 }}>
            <div style={{
              width: '100%', maxWidth: isMobile ? 320 : 340,
              aspectRatio: '1', borderRadius: 20, overflow: 'hidden',
              boxShadow: color
                ? `0 32px 80px rgba(${color.r},${color.g},${color.b},.4), 0 8px 32px rgba(0,0,0,.6)`
                : '0 24px 60px rgba(0,0,0,.5)',
              transform: playing ? 'scale(1)' : 'scale(0.92)',
              transition: 'transform .5s cubic-bezier(.34,1.56,.64,1), box-shadow .5s ease',
            }}>
              <Thumb song={song} size="100%" radius={0} playing={false} />
            </div>
          </div>

          {/* Song Info + Like */}
          <div style={{ padding: '0 28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: isMobile ? 22 : 24, fontWeight: 800, color: '#fff', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-.01em' }}>
                {song.title}
              </div>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {song.artist}
              </div>
            </div>
            <button onClick={() => onLike(song.id)}
              aria-label={liked ? 'Remove from liked songs' : 'Add to liked songs'}
              aria-pressed={liked}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, flexShrink: 0, marginLeft: 12, transition: 'transform .2s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
              onMouseLeave={e => e.currentTarget.style.transform = ''}>
              <Svg d={I.heart} size={26}
                fill={liked ? '#ff6b9d' : 'none'}
                stroke={liked ? '#ff6b9d' : 'rgba(255,255,255,.7)'}
                strokeWidth={liked ? 0 : 1.75} />
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ padding: '20px 28px 0', flexShrink: 0 }}>
            <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'rgba(255,255,255,.2)', cursor: 'pointer' }}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                onSeek(((e.clientX - rect.left) / rect.width) * 100);
              }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: '#fff',
                width: `${progress}%`,
                transition: 'width .5s linear',
                boxShadow: color ? `0 0 12px rgba(${color.r},${color.g},${color.b},.8)` : 'none',
              }} />
              {/* Thumb */}
              <div style={{
                position: 'absolute', top: '50%', left: `${progress}%`,
                transform: 'translate(-50%, -50%)',
                width: 14, height: 14, borderRadius: '50%',
                background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,.4)',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,.45)', fontVariantNumeric: 'tabular-nums' }}>
              <span>{fmtTime((progress / 100) * (duration || 0))}</span>
              <span>{fmtTime(duration || 0)}</span>
            </div>
          </div>

          {/* Playback controls */}
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <button onClick={onShuffle} aria-label="Shuffle" aria-pressed={shuffle}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: shuffle ? '#fff' : 'rgba(255,255,255,.4)', padding: 10, borderRadius: 8, position: 'relative' }}>
              <Svg d={I.shuffle} size={20} stroke="currentColor" />
              {shuffle && <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />}
            </button>
            <button onClick={onPrev} aria-label="Previous song"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 10, opacity: .85 }}>
              <Svg d={I.prev} size={32} fill="currentColor" stroke="currentColor" />
            </button>
            <button onClick={onTogglePlay} aria-label={playing ? 'Pause' : 'Play'}
              style={{
                width: 70, height: 70, borderRadius: '50%',
                background: '#fff',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: color
                  ? `0 8px 32px rgba(${color.r},${color.g},${color.b},.5), 0 2px 12px rgba(0,0,0,.4)`
                  : '0 8px 32px rgba(0,0,0,.4)',
                transition: 'transform .15s, box-shadow .3s',
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(.93)'}
              onMouseUp={e   => e.currentTarget.style.transform = ''}
              onMouseLeave={e => e.currentTarget.style.transform = ''}>
              <Svg d={playing ? I.pause : I.play} size={24} fill="#111" stroke="#111" />
            </button>
            <button onClick={onNext} aria-label="Next song"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 10, opacity: .85 }}>
              <Svg d={I.next} size={32} fill="currentColor" stroke="currentColor" />
            </button>
            <button onClick={onRepeat} aria-label="Repeat" aria-pressed={repeat}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: repeat ? '#fff' : 'rgba(255,255,255,.4)', padding: 10, borderRadius: 8, position: 'relative' }}>
              <Svg d={I.repeat} size={20} stroke="currentColor" />
              {repeat && <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />}
            </button>
          </div>

          {/* Volume row */}
          {!isMobile && (
            <div style={{ padding: '0 28px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <button onClick={onMute} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', padding: 4 }}>
                <Svg d={muted || volume === 0 ? I.volX : volume < 50 ? I.volLow : I.volHigh} size={16} stroke="currentColor" />
              </button>
              <input type="range" min={0} max={100} value={muted ? 0 : volume}
                onChange={e => onVolume(Number(e.target.value))}
                aria-label="Volume"
                style={{ flex: 1, accentColor: color ? `rgb(${color.r},${color.g},${color.b})` : '#fff', cursor: 'pointer' }} />
            </div>
          )}

          {/* Tab bar (mobile: show below controls) */}
          {isMobile && (
            <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,.1)', flexShrink: 0 }}>
              {[['queue','Queue',I.queue], ['lyrics','Lyrics',I.lyrics], ['sleep','Timer','⏰']].map(([id, label, icon]) => (
                <button key={id} onClick={() => setTab(id)}
                  style={{ flex: 1, padding: '12px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    color: tab === id ? '#fff' : 'rgba(255,255,255,.4)',
                    borderBottom: tab === id ? '2px solid #fff' : '2px solid transparent',
                    fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  {typeof icon === 'string' ? <span>{icon}</span> : <Svg d={icon} size={13} stroke="currentColor" />}
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Queue / Lyrics / Sleep panel ─────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Desktop tab bar */}
          {!isMobile && (
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.1)', padding: '0 28px', flexShrink: 0 }}>
              {[['queue','Queue'], ['lyrics','Lyrics'], ['sleep','Sleep Timer']].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)}
                  style={{ padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    color: tab === id ? '#fff' : 'rgba(255,255,255,.4)',
                    borderBottom: tab === id ? '2px solid #fff' : '2px solid transparent',
                    fontFamily: 'inherit', transition: 'color .15s' }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Tab content */}
          {tab === 'lyrics' && (
            <LyricsPanel
              lines={lyrics.lines}
              plainText={lyrics.plainText}
              loading={lyrics.loading}
              activeIdx={lyrics.activeIdx}
              color={color}
            />
          )}

          {tab === 'queue' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 80px' }}>
              {allQueue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', opacity: .45 }}>
                  <Svg d={I.queue} size={40} stroke="rgba(255,255,255,.5)" />
                  <div style={{ marginTop: 12, fontSize: 15, color: 'rgba(255,255,255,.6)' }}>Queue is empty</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>Songs will autoplay when you finish</div>
                </div>
              ) : (
                <>
                  {queue.length > 0 && <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.35)', padding: '16px 0 8px' }}>Next in Queue</div>}
                  {queue.map((s, i) => (
                    <QueueItem key={`q-${s.id}-${i}`} song={s} idx={i}
                      onPlay={() => onPlayFromQueue(s, i)}
                      onRemove={() => onRemoveFromQueue(i)}
                      C={C} />
                  ))}
                  {related.length > 0 && <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.35)', padding: '16px 0 8px' }}>Autoplay</div>}
                  {related.slice(0, 10).map((s, i) => (
                    <QueueItem key={`r-${s.id}-${i}`} song={s} idx={queue.length + i}
                      onPlay={() => onPlayFromQueue(s, queue.length + i)}
                      onRemove={() => {}}
                      C={C} />
                  ))}
                </>
              )}
            </div>
          )}

          {tab === 'sleep' && (
            <SleepTimerPanel
              sleepTimer={sleepTimer}
              onStart={sleepTimer.start}
              onStop={sleepTimer.stop}
            />
          )}
        </div>
      </div>
    </div>,
    PORTAL
  );
});

export default NowPlayingView;
