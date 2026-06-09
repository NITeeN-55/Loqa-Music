/**
 * NowPlayingView v5.1 — Full-screen "Now Playing" overlay.
 *
 * FIX (v5.1): Removed createPortal entirely.
 *   - Position: fixed + z-index:300 covers everything without needing a portal.
 *   - Previously, rendering into the same #loqa-portals container as App.jsx's
 *     other portals caused "insertBefore" DOM errors during concurrent unmounts.
 *   - Exit animation now uses onAnimationEnd instead of setTimeout, so the
 *     parent's onClose() is only called after the CSS animation actually finishes.
 *
 * Features:
 *  ✓ Dynamic background color from album art (canvas pixel sampling)
 *  ✓ Animated album art (scales on play/pause)
 *  ✓ Synced lyrics with auto-scroll to active line
 *  ✓ Queue preview + autoplay list
 *  ✓ Sleep timer UI
 *  ✓ Swipe down to close / swipe left+right to skip (mobile)
 *  ✓ ESC to close
 *  ✓ Body scroll locked while open
 */
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { fmtTime, gradStr } from '../utils/constants.js';
import { Svg, I, EqBars, Spinner } from './Icons.jsx';
import { Thumb } from './UI.jsx';

/* ─── Color extraction ───────────────────────────────────────
   Samples a 50×50 canvas from the thumbnail to find the dominant colour.
   Skips near-black and near-white pixels for a more vibrant result.
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
        for (let i = 0; i < data.length; i += 16) {
          const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
          if (brightness < 30 || brightness > 220) continue;
          r += data[i]; g += data[i+1]; b += data[i+2]; n++;
        }
        resolve(n ? { r: r/n|0, g: g/n|0, b: b/n|0 } : null);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = thumbnailUrl;
  });
}

/* ─── Lyrics panel ──────────────────────────────────────────── */
const LyricsPanel = memo(function LyricsPanel({ lines, plainText, loading, activeIdx, color }) {
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIdx]);

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: .6 }}>
      <Spinner size={28} />
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>Finding lyrics…</span>
    </div>
  );

  if (!lines.length && !plainText) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: .5, padding: '0 24px', textAlign: 'center' }}>
      <Svg d={I.lyrics} size={40} stroke="rgba(255,255,255,.5)" />
      <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>No lyrics found</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Lyrics aren't available for this song</div>
    </div>
  );

  if (plainText) return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '0 28px 80px' }}>
      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.9, color: 'rgba(255,255,255,.75)' }}>
        {plainText}
      </pre>
    </div>
  );

  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '0 28px 80px' }}>
      {lines.map((line, i) => (
        <div key={i} ref={i === activeIdx ? activeRef : null}
          style={{
            fontSize: i === activeIdx ? 22 : 18,
            fontWeight: i === activeIdx ? 800 : 400,
            lineHeight: 1.55, marginBottom: 16,
            color: i === activeIdx ? '#fff' : i < activeIdx ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.55)',
            transition: 'all .3s ease',
            textShadow: i === activeIdx && color ? `0 0 40px rgb(${color.r},${color.g},${color.b})` : 'none',
          }}>
          {line.text || '♪'}
        </div>
      ))}
    </div>
  );
});

/* ─── Queue item ────────────────────────────────────────────── */
const QueueItem = memo(function QueueItem({ song, idx, onPlay, onRemove }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
      <div style={{ width: 20, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,.3)', flexShrink: 0 }}>{idx + 1}</div>
      <Thumb song={song} size={42} radius={8} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist}</div>
      </div>
      <button onClick={() => onPlay(song, idx)} style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#fff', fontSize: 12, flexShrink: 0, fontFamily: 'inherit' }}>
        Play
      </button>
      {onRemove && (
        <button onClick={() => onRemove(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(255,255,255,.4)', flexShrink: 0 }}>
          <Svg d={I.close} size={14} stroke="currentColor" />
        </button>
      )}
    </div>
  );
});

/* ─── Sleep timer panel ─────────────────────────────────────── */
function SleepTimerPanel({ sleepTimer }) {
  const OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90];
  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>⏰ Sleep Timer</div>
      {sleepTimer.active ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{sleepTimer.remainingFmt}</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', marginBottom: 24 }}>Music stops when timer ends</div>
          <button onClick={sleepTimer.stop}
            style={{ background: 'rgba(255,77,109,.2)', border: '1px solid rgba(255,77,109,.4)', borderRadius: 12, padding: '12px 32px', cursor: 'pointer', color: '#ff4d6d', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
            Cancel Timer
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {OPTIONS.map(min => (
            <button key={min} onClick={() => sleepTimer.start(min)}
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

/* ─── Main component ────────────────────────────────────────── */
export const NowPlayingView = memo(function NowPlayingView({
  C, song, playing, progress, duration, volume, muted,
  shuffle, repeat, liked, queue = [], related = [],
  lyrics = { lines: [], plainText: '', loading: false, activeIdx: -1, hasLyrics: false },
  sleepTimer = { active: false, remainingFmt: null, start: () => {}, stop: () => {} },
  onTogglePlay, onPrev, onNext, onSeek,
  onVolume, onMute, onShuffle, onRepeat,
  onLike, onClose,
  onPlayFromQueue, onRemoveFromQueue,
  isMobile,
}) {
  const [color,   setColor]   = useState(null);
  const [tab,     setTab]     = useState('queue');
  const [closing, setClosing] = useState(false);
  const touchRef = useRef({ x: 0, y: 0, t: 0 });
  const wrapRef  = useRef(null);

  /* ── Lock body scroll while open ─────────────────────────── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ── Extract dominant color when song changes ─────────────── */
  useEffect(() => {
    if (!song?.thumbnail) { setColor(null); return; }
    let cancelled = false;
    extractDominantColor(song.thumbnail).then(c => { if (!cancelled) setColor(c); });
    return () => { cancelled = true; };
  }, [song?.thumbnail]);

  /* ── Open lyrics tab when lyrics arrive ───────────────────── */
  useEffect(() => {
    if (lyrics.hasLyrics && tab === 'queue') setTab('lyrics');
  }, [lyrics.hasLyrics]); // eslint-disable-line

  /* ── ESC to close ────────────────────────────────────────── */
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []); // eslint-disable-line

  /* ── Animated close: set closing=true, wait for animation ── */
  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    // onClose() is called via onAnimationEnd on the wrapper div — no setTimeout needed
  }, [closing]);

  const onAnimationEnd = useCallback(() => {
    if (closing) onClose();
  }, [closing, onClose]);

  /* ── Touch gestures ──────────────────────────────────────── */
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e) => {
    const { x, y, t } = touchRef.current;
    const dx = e.changedTouches[0].clientX - x;
    const dy = e.changedTouches[0].clientY - y;
    const dt = Math.max(Date.now() - t, 1);
    const spd = Math.abs(dx) / dt;
    if (dy > 100 && Math.abs(dx) < 80 && e.changedTouches[0].clientY < window.innerHeight * 0.55) {
      handleClose(); return;
    }
    if (spd > 0.4 && Math.abs(dy) < 80 && Math.abs(dx) > 50) {
      dx < 0 ? onNext() : onPrev();
    }
  };

  if (!song) return null;

  const bg = color
    ? `linear-gradient(180deg, rgb(${color.r},${color.g},${color.b}) 0%, rgba(${color.r},${color.g},${color.b},.55) 35%, rgba(${color.r*.4|0},${color.g*.4|0},${color.b*.4|0},.3) 65%, ${C.bg} 100%)`
    : `linear-gradient(180deg, ${C.bg3} 0%, ${C.bg} 100%)`;

  const allQueue = [...queue, ...related.slice(0, 10)];

  return (
    <div
      ref={wrapRef}
      aria-modal="true"
      role="dialog"
      aria-label="Now Playing"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onAnimationEnd={onAnimationEnd}
      style={{
        /* ── Position: fixed covers everything, no portal needed ── */
        position: 'fixed', inset: 0,
        zIndex: 300,
        background: bg,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'hidden',
        animationName: closing ? 'npSlideDown' : 'npSlideUp',
        animationDuration: closing ? '280ms' : '300ms',
        animationTimingFunction: 'cubic-bezier(.32,.72,0,1)',
        animationFillMode: 'both',
      }}
    >
      {/* CSS for slide animations — injected inline once */}
      <style>{`
        @keyframes npSlideUp   { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes npSlideDown { from { transform: translateY(0) }    to { transform: translateY(100%) } }
      `}</style>

      {/* Ambient glow */}
      {color && (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: `radial-gradient(ellipse 70% 40% at 50% 0%, rgba(${color.r},${color.g},${color.b},.22) 0%, transparent 70%)`,
        }} />
      )}

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 8px', flexShrink: 0 }}>
        <button onClick={handleClose} aria-label="Minimise player"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.7)', padding: 8, borderRadius: 8, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Svg d="M19 9l-7 7-7-7" size={22} stroke="currentColor" strokeWidth={2.5} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>
            Now Playing
          </div>
          {sleepTimer.active && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>⏰ {sleepTimer.remainingFmt}</div>
          )}
        </div>
        <button onClick={() => setTab(t => t === 'sleep' ? 'queue' : 'sleep')} aria-label="Sleep timer"
          style={{ background: sleepTimer.active ? 'rgba(255,255,255,.15)' : 'none', border: 'none', cursor: 'pointer', color: sleepTimer.active ? '#fff' : 'rgba(255,255,255,.7)', padding: 8, borderRadius: 8, fontSize: 18, lineHeight: 1, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ⏰
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* ── LEFT: Art + Controls ─────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', width: isMobile ? '100%' : 400, flexShrink: 0 }}>

          {/* Album art */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: isMobile ? '8px 48px 16px' : '8px 40px 20px', flexShrink: 0 }}>
            <div style={{
              width: '100%', maxWidth: isMobile ? 300 : 340, aspectRatio: '1',
              borderRadius: 20, overflow: 'hidden',
              boxShadow: color
                ? `0 32px 80px rgba(${color.r},${color.g},${color.b},.4), 0 8px 32px rgba(0,0,0,.6)`
                : '0 24px 60px rgba(0,0,0,.5)',
              transform: playing ? 'scale(1)' : 'scale(0.92)',
              transition: 'transform .5s cubic-bezier(.34,1.56,.64,1), box-shadow .5s ease',
            }}>
              <Thumb song={song} size="100%" radius={0} playing={false} />
            </div>
          </div>

          {/* Song info + like */}
          <div style={{ padding: '0 28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: isMobile ? 21 : 24, fontWeight: 800, color: '#fff', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist}</div>
            </div>
            <button onClick={() => onLike(song.id)} aria-label={liked ? 'Unlike' : 'Like'} aria-pressed={liked}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, flexShrink: 0, marginLeft: 12, transition: 'transform .2s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
              onMouseLeave={e => e.currentTarget.style.transform = ''}>
              <Svg d={I.heart} size={26} fill={liked ? '#ff6b9d' : 'none'} stroke={liked ? '#ff6b9d' : 'rgba(255,255,255,.7)'} strokeWidth={liked ? 0 : 1.75} />
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ padding: '20px 28px 0', flexShrink: 0 }}>
            <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'rgba(255,255,255,.2)', cursor: 'pointer' }}
              onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); onSeek(((e.clientX - rect.left) / rect.width) * 100); }}>
              <div style={{ height: '100%', borderRadius: 2, background: '#fff', width: `${progress}%`, transition: 'width .5s linear', boxShadow: color ? `0 0 12px rgba(${color.r},${color.g},${color.b},.8)` : 'none' }} />
              <div style={{ position: 'absolute', top: '50%', left: `${progress}%`, transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,.4)' }} />
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
            <button onClick={onPrev} aria-label="Previous"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 10, opacity: .85 }}>
              <Svg d={I.prev} size={32} fill="currentColor" stroke="currentColor" />
            </button>
            <button onClick={onTogglePlay} aria-label={playing ? 'Pause' : 'Play'}
              style={{ width: 70, height: 70, borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: color ? `0 8px 32px rgba(${color.r},${color.g},${color.b},.5),0 2px 12px rgba(0,0,0,.4)` : '0 8px 32px rgba(0,0,0,.4)', transition: 'transform .15s' }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(.93)'}
              onMouseUp={e => e.currentTarget.style.transform = ''}
              onMouseLeave={e => e.currentTarget.style.transform = ''}>
              <Svg d={playing ? I.pause : I.play} size={24} fill="#111" stroke="#111" />
            </button>
            <button onClick={onNext} aria-label="Next"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 10, opacity: .85 }}>
              <Svg d={I.next} size={32} fill="currentColor" stroke="currentColor" />
            </button>
            <button onClick={onRepeat} aria-label="Repeat" aria-pressed={repeat}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: repeat ? '#fff' : 'rgba(255,255,255,.4)', padding: 10, borderRadius: 8, position: 'relative' }}>
              <Svg d={I.repeat} size={20} stroke="currentColor" />
              {repeat && <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />}
            </button>
          </div>

          {/* Volume (desktop only) */}
          {!isMobile && (
            <div style={{ padding: '0 28px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <button onClick={onMute} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', padding: 4 }}>
                <Svg d={muted || volume === 0 ? I.volX : volume < 50 ? I.volLow : I.volHigh} size={16} stroke="currentColor" />
              </button>
              <input type="range" min={0} max={100} value={muted ? 0 : volume}
                onChange={e => onVolume(Number(e.target.value))} aria-label="Volume"
                style={{ flex: 1, accentColor: color ? `rgb(${color.r},${color.g},${color.b})` : '#fff', cursor: 'pointer' }} />
            </div>
          )}

          {/* Tab bar (mobile) */}
          {isMobile && (
            <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,.1)', flexShrink: 0 }}>
              {[['queue','Queue',I.queue],['lyrics','Lyrics',I.lyrics],['sleep','Timer','⏰']].map(([id, label, icon]) => (
                <button key={id} onClick={() => setTab(id)}
                  style={{ flex: 1, padding: '12px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: tab === id ? '#fff' : 'rgba(255,255,255,.4)', borderBottom: tab === id ? '2px solid #fff' : '2px solid transparent', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  {typeof icon === 'string' ? <span>{icon}</span> : <Svg d={icon} size={13} stroke="currentColor" />}
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Tabs (desktop tab bar + content) ────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {!isMobile && (
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.1)', padding: '0 28px', flexShrink: 0 }}>
              {[['queue','Queue'],['lyrics','Lyrics'],['sleep','Sleep Timer']].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)}
                  style={{ padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: tab === id ? '#fff' : 'rgba(255,255,255,.4)', borderBottom: tab === id ? '2px solid #fff' : '2px solid transparent', fontFamily: 'inherit', transition: 'color .15s' }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {tab === 'lyrics' && (
            <LyricsPanel lines={lyrics.lines} plainText={lyrics.plainText} loading={lyrics.loading} activeIdx={lyrics.activeIdx} color={color} />
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
                  {queue.map((s, i) => <QueueItem key={`q-${s.id}-${i}`} song={s} idx={i} onPlay={() => onPlayFromQueue(s, i)} onRemove={() => onRemoveFromQueue(i)} />)}
                  {related.length > 0 && <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.35)', padding: '16px 0 8px' }}>Autoplay</div>}
                  {related.slice(0, 10).map((s, i) => <QueueItem key={`r-${s.id}-${i}`} song={s} idx={queue.length + i} onPlay={() => onPlayFromQueue(s, queue.length + i)} onRemove={null} />)}
                </>
              )}
            </div>
          )}

          {tab === 'sleep' && <SleepTimerPanel sleepTimer={sleepTimer} />}
        </div>
      </div>
    </div>
  );
});

export default NowPlayingView;
