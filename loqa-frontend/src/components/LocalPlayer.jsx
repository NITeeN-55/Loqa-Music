import React, { useState, useRef, useEffect, useCallback } from 'react';
import { gradStr, fmtTime } from '../utils/constants.js';
import { Svg, I, EqBars } from './Icons.jsx';
import { Thumb } from './UI.jsx';

/* ── Local Music Player ─────────────────────────────────
   Full responsive rewrite:
   • Mobile: single-column, stacked controls, swipe-to-skip
   • Tablet/Desktop: side-by-side with waveform
   ────────────────────────────────────────────────────── */

export default function LocalPlayer({ C, isMobile, onSwitchToYT }) {
  const [files,    setFiles]    = useState([]);
  const [idx,      setIdx]      = useState(0);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume,   setVolume]   = useState(80);
  const [muted,    setMuted]    = useState(false);
  const [shuffle,  setShuffle]  = useState(false);
  const [repeat,   setRepeat]   = useState(false);
  const [drag,     setDrag]     = useState(null);
  const [barHov,   setBarHov]   = useState(false);

  const audioRef  = useRef(null);
  const seekRef   = useRef(null);
  const fileInput = useRef(null);
  const swRef     = useRef({ x: 0 });

  const cur = files[idx] || null;

  /* ── Audio event wiring ── */
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime    = () => { if (a.duration) setProgress((a.currentTime / a.duration) * 100); };
    const onLoaded  = () => setDuration(a.duration || 0);
    const onEnded   = () => { if (repeat) { a.currentTime = 0; a.play(); } else doNext(); };
    const onErr     = () => { console.warn('Audio error'); doNext(); };
    a.addEventListener('timeupdate',    onTime);
    a.addEventListener('loadedmetadata',onLoaded);
    a.addEventListener('ended',        onEnded);
    a.addEventListener('error',        onErr);
    return () => {
      a.removeEventListener('timeupdate',    onTime);
      a.removeEventListener('loadedmetadata',onLoaded);
      a.removeEventListener('ended',        onEnded);
      a.removeEventListener('error',        onErr);
    };
  }, [repeat]); // eslint-disable-line

  /* ── Sync src when file changes ── */
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !cur) return;
    const url = URL.createObjectURL(cur.file);
    a.src = url;
    a.volume = muted ? 0 : volume / 100;
    setProgress(0); setDuration(0);
    if (playing) a.play().catch(() => {});
    return () => URL.revokeObjectURL(url);
  }, [idx, cur?.file]); // eslint-disable-line

  /* ── Sync volume ── */
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = muted ? 0 : volume / 100;
  }, [volume, muted]);

  /* ── Play / Pause ── */
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !cur) return;
    if (playing) a.play().catch(() => setPlaying(false));
    else         a.pause();
  }, [playing]); // eslint-disable-line

  /* ── Navigation ── */
  const doNext = useCallback(() => {
    if (!files.length) return;
    if (shuffle) setIdx(Math.floor(Math.random() * files.length));
    else         setIdx(i => (i + 1) % files.length);
  }, [files, shuffle]);

  const doPrev = useCallback(() => {
    const a = audioRef.current;
    if (a && a.currentTime > 3) { a.currentTime = 0; return; }
    if (shuffle) setIdx(Math.floor(Math.random() * files.length));
    else         setIdx(i => (i - 1 + files.length) % files.length);
  }, [files, shuffle]);

  /* ── File picker ── */
  const onFiles = (e) => {
    const arr = Array.from(e.target.files || [])
      .filter(f => f.type.startsWith('audio/'))
      .map(f => ({ file: f, name: f.name.replace(/\.[^/.]+$/, ''), size: f.size }));
    if (!arr.length) return;
    setFiles(p => [...p, ...arr]);
    if (!files.length) { setIdx(0); setPlaying(true); }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const arr = Array.from(e.dataTransfer.files)
      .filter(f => f.type.startsWith('audio/'))
      .map(f => ({ file: f, name: f.name.replace(/\.[^/.]+$/, ''), size: f.size }));
    if (!arr.length) return;
    setFiles(p => [...p, ...arr]);
    if (!files.length) { setIdx(0); setPlaying(true); }
  };

  /* ── Seek bar drag ── */
  const calcSeek = (e) => {
    const bar = seekRef.current; if (!bar) return null;
    const { left, width } = bar.getBoundingClientRect();
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    return Math.min(100, Math.max(0, ((cx - left) / width) * 100));
  };

  const onSeekDown = (e) => {
    e.preventDefault();
    const p = calcSeek(e); if (p === null) return;
    setDrag(p);
    const mv = ev => { const v = calcSeek(ev); if (v !== null) setDrag(v); };
    const up = ev => {
      const v = calcSeek(ev);
      if (v !== null) {
        setDrag(null);
        setProgress(v);
        const a = audioRef.current;
        if (a && a.duration) a.currentTime = (v / 100) * a.duration;
      }
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', mv);
      window.removeEventListener('touchend', up);
    };
    window.addEventListener('mousemove', mv, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', mv, { passive: false });
    window.addEventListener('touchend', up);
  };

  /* ── Mobile swipe ── */
  const swStart = e => { swRef.current.x = e.touches[0].clientX; };
  const swEnd   = e => {
    const dx = e.changedTouches[0].clientX - swRef.current.x;
    if (Math.abs(dx) > 60) { if (dx < 0) doNext(); else doPrev(); }
  };

  const disp   = drag !== null ? drag : progress;
  const elapsed = (disp / 100) * (duration || 0);
  const vol    = muted ? 0 : volume;
  const vi     = muted || vol === 0 ? I.volX : vol < 50 ? I.volLow : I.volHigh;
  const [c1, c2] = cur ? (['#6C63FF','#B06AFF']) : ['#6C63FF','#B06AFF'];

  /* ── Empty / Upload state ── */
  if (!files.length) return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: gradStr(3),
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Svg d={I.download} size={20} stroke="#fff" />
        </div>
        <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, color: C.text, margin: 0 }}>Local Music</h2>
      </div>

      {/* Drop zone */}
      <div onDrop={onDrop} onDragOver={e => e.preventDefault()}
        onClick={() => fileInput.current?.click()}
        role="button" tabIndex={0} aria-label="Upload audio files"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.current?.click(); } }}
        style={{ border: `2px dashed ${C.border2}`, borderRadius: 20, textAlign: 'center',
          padding: isMobile ? '40px 20px' : '60px 40px',
          cursor: 'pointer', transition: 'border-color .2s',
          background: C.surface,
          // FIX: ensure box doesn't overflow
          boxSizing: 'border-box', overflow: 'hidden',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
        onMouseLeave={e => e.currentTarget.style.borderColor = C.border2}>
        <div style={{ fontSize: isMobile ? 40 : 48, marginBottom: 16 }}>📁</div>
        <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>
          {isMobile ? 'Tap to browse files' : 'Drop audio files here'}
        </div>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 20 }}>
          {isMobile ? '' : 'or click to browse · '}
          Supports MP3, WAV, FLAC, AAC, OGG
        </div>
        <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={e => { e.stopPropagation(); fileInput.current?.click(); }}
            style={{ padding: '10px 20px', minHeight: 44,
              background: gradStr(0), border: 'none', borderRadius: 12,
              color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', fontFamily: 'inherit' }}>
            Browse Files
          </button>
          <button onClick={e => { e.stopPropagation(); onSwitchToYT?.(); }}
            style={{ padding: '10px 20px', minHeight: 44,
              background: 'none', border: `1px solid ${C.border}`, borderRadius: 12,
              color: C.text2, fontWeight: 600, fontSize: 14,
              cursor: 'pointer', fontFamily: 'inherit' }}>
            Stream Online
          </button>
        </div>
      </div>
      <input ref={fileInput} type="file" accept="audio/*" multiple
        onChange={onFiles} style={{ display: 'none' }} tabIndex={-1} />
    </div>
  );

  /* ── Player UI ── */
  return (
    <div style={{ minWidth: 0 }}>
      <audio ref={audioRef} preload="metadata" />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: gradStr(3),
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Svg d={I.download} size={16} stroke="#fff" />
          </div>
          <h2 style={{ fontSize: isMobile ? 16 : 20, fontWeight: 900, color: C.text, margin: 0 }}>
            Local Music
          </h2>
          <span style={{ fontSize: 12, color: C.text3, background: C.bg3, padding: '3px 10px',
            borderRadius: 20, border: `1px solid ${C.border}`, flexShrink: 0 }}>
            {files.length} files
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => fileInput.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', minHeight: 40,
              background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 10,
              color: C.text2, fontWeight: 600, fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit' }}>
            <Svg d={I.plus} size={13} stroke="currentColor" />
            {isMobile ? 'Add' : 'Add Files'}
          </button>
          <button onClick={() => onSwitchToYT?.()}
            style={{ display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', minHeight: 40,
              background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 10,
              color: C.text2, fontWeight: 600, fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit' }}>
            🌐 {isMobile ? 'Stream' : 'Stream Online'}
          </button>
        </div>
      </div>
      <input ref={fileInput} type="file" accept="audio/*" multiple
        onChange={onFiles} style={{ display: 'none' }} tabIndex={-1} />

      {/* ── Player card ── */}
      <div onTouchStart={swStart} onTouchEnd={swEnd}
        style={{ background: C.surface, borderRadius: 20, overflow: 'hidden',
          border: `1px solid ${C.border}`, marginBottom: 20,
          // FIX: never overflow
          maxWidth: '100%',
        }}>
        {/* Accent bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg,${c1},${c2})` }} />

        <div style={{ padding: isMobile ? '16px 14px 20px' : '24px 28px 28px' }}>
          {/* FIX: stack on mobile, side-by-side on desktop */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'center' : 'flex-start', gap: isMobile ? 16 : 28 }}>

            {/* Album art */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: isMobile ? 120 : 160, height: isMobile ? 120 : 160,
                borderRadius: isMobile ? 16 : 20,
                background: gradStr(idx % 8),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 12px 40px rgba(0,0,0,.35)`,
              }}>
                <Svg d={I.music} size={isMobile ? 44 : 56}
                  fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.6)" />
              </div>
              {playing && (
                <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,.7)',
                  borderRadius: 8, padding: '4px 8px' }}>
                  <EqBars size={14} color="#fff" playing />
                </div>
              )}
            </div>

            {/* Controls */}
            <div style={{ flex: 1, minWidth: 0, width: isMobile ? '100%' : undefined }}>
              {/* Title */}
              <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
                <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: C.text,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  marginBottom: 4 }}>
                  {cur.name}
                </div>
                <div style={{ fontSize: 13, color: C.text2, marginBottom: isMobile ? 16 : 20 }}>
                  Local file · {(cur.size / (1024 * 1024)).toFixed(1)} MB
                </div>
              </div>

              {/* Seek bar */}
              <div style={{ marginBottom: isMobile ? 12 : 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  fontSize: 11, color: C.text3, marginBottom: 6,
                  fontVariantNumeric: 'tabular-nums' }}>
                  <span>{fmtTime(elapsed)}</span>
                  <span>{fmtTime(duration)}</span>
                </div>
                <div ref={seekRef} className="loqa-seek"
                  role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={100}
                  aria-valuenow={Math.round(disp)}
                  tabIndex={0}
                  onMouseDown={onSeekDown} onTouchStart={onSeekDown}
                  onMouseEnter={() => setBarHov(true)} onMouseLeave={() => setBarHov(false)}
                  onKeyDown={e => {
                    const a = audioRef.current;
                    if (!a || !a.duration) return;
                    if (e.key === 'ArrowRight') { e.preventDefault(); a.currentTime = Math.min(a.duration, a.currentTime + 5); }
                    if (e.key === 'ArrowLeft')  { e.preventDefault(); a.currentTime = Math.max(0, a.currentTime - 5); }
                  }}
                  style={{ height: 20, display: 'flex', alignItems: 'center', cursor: 'pointer', width: '100%' }}>
                  <div style={{ width: '100%', height: barHov || drag !== null ? 6 : 4,
                    background: C.bg4, borderRadius: 6, position: 'relative', overflow: 'hidden',
                    transition: 'height .18s' }}>
                    <div style={{ height: '100%',
                      background: `linear-gradient(90deg,${c1},${c2})`,
                      width: `${disp}%`,
                      transition: drag !== null ? 'none' : 'width .3s linear' }} />
                  </div>
                </div>
              </div>

              {/* Transport */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: isMobile ? 10 : 16 }}>
                {/* Shuffle */}
                <button onClick={() => setShuffle(p => !p)} aria-label="Shuffle" aria-pressed={shuffle}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                    color: shuffle ? C.accent : C.text3,
                    padding: 8, minWidth: 40, minHeight: 44,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Svg d={I.shuffle} size={17} stroke="currentColor" />
                </button>
                {/* Prev */}
                <button onClick={doPrev} aria-label="Previous"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2,
                    padding: 8, minWidth: 44, minHeight: 44,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Svg d={I.prev} size={isMobile ? 26 : 28} fill="currentColor" stroke="currentColor" />
                </button>
                {/* Play */}
                <button onClick={() => { if (!cur) return; setPlaying(p => !p); }}
                  aria-label={playing ? 'Pause' : 'Play'}
                  style={{ width: isMobile ? 56 : 64, height: isMobile ? 56 : 64,
                    borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg,${c1},${c2})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 8px 28px ${c1}55`, transition: 'transform .15s' }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(.93)'}
                  onMouseUp={e   => e.currentTarget.style.transform = ''}
                  onMouseLeave={e => e.currentTarget.style.transform = ''}>
                  <Svg d={playing ? I.pause : I.play} size={isMobile ? 22 : 26} fill="#fff" stroke="#fff" />
                </button>
                {/* Next */}
                <button onClick={doNext} aria-label="Next"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2,
                    padding: 8, minWidth: 44, minHeight: 44,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Svg d={I.next} size={isMobile ? 26 : 28} fill="currentColor" stroke="currentColor" />
                </button>
                {/* Repeat */}
                <button onClick={() => setRepeat(p => !p)} aria-label="Repeat" aria-pressed={repeat}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                    color: repeat ? C.accent : C.text3,
                    padding: 8, minWidth: 40, minHeight: 44,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Svg d={I.repeat} size={17} stroke="currentColor" />
                </button>
              </div>

              {/* Volume — desktop only; mobile uses system volume */}
              {!isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
                  <button onClick={() => setMuted(p => !p)} aria-label={muted ? 'Unmute' : 'Mute'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                      color: C.text3, padding: 4, flexShrink: 0 }}>
                    <Svg d={vi} size={16} stroke="currentColor" />
                  </button>
                  <input type="range" min={0} max={100} value={vol}
                    aria-label="Volume"
                    onChange={e => { setVolume(Number(e.target.value)); setMuted(false); }}
                    style={{ flex: 1, accentColor: c1, cursor: 'pointer' }} />
                  <span style={{ fontSize: 11, color: C.text3, minWidth: 28, textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums' }}>{vol}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── File list ── */}
      <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`,
        overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`,
          fontSize: 12, fontWeight: 700, color: C.text3,
          textTransform: 'uppercase', letterSpacing: 1 }}>
          {files.length} tracks
        </div>
        {files.map((f, i) => {
          const active = i === idx;
          return (
            <div key={i} onClick={() => { setIdx(i); setPlaying(true); }}
              role="row" tabIndex={0} aria-label={f.name}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIdx(i); setPlaying(true); } }}
              style={{ display: 'flex', alignItems: 'center', gap: 10,
                // FIX: responsive padding
                padding: isMobile ? '10px 12px' : '10px 16px',
                background: active ? `rgba(${C.accentRgb},.1)` : 'transparent',
                cursor: 'pointer', transition: 'background .15s',
                borderBottom: i < files.length - 1 ? `1px solid ${C.border}` : 'none',
                // FIX: no overflow
                overflow: 'hidden', minWidth: 0,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.bg3; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ width: 24, textAlign: 'center', fontSize: 12,
                color: active ? C.accent : C.text3, flexShrink: 0 }}>
                {active && playing ? <EqBars size={13} color={C.accent} playing />
                  : <span>{i + 1}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? C.accent : C.text,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.name}
                </div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>
                  {(f.size / (1024 * 1024)).toFixed(1)} MB
                </div>
              </div>
              <button onClick={e => {
                  e.stopPropagation();
                  setFiles(p => p.filter((_, j) => j !== i));
                  if (i === idx) { setIdx(0); setPlaying(false); }
                  else if (i < idx) setIdx(p => p - 1);
                }}
                aria-label={`Remove ${f.name}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3,
                  padding: 8, borderRadius: 6, flexShrink: 0,
                  // FIX: min touch target
                  minWidth: 36, minHeight: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0.5, transition: 'opacity .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
                <Svg d={I.close} size={12} stroke="currentColor" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
