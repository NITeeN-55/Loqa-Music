import React, { useRef, useEffect, useState } from 'react';
import { EQ_PRESETS } from '../stores/eqStore.js';
import { Svg, I } from './Icons.jsx';

const PRESET_NAMES = Object.keys(EQ_PRESETS);
const BAND_LABELS  = ['32','64','125','250','500','1K','2K','4K','8K','16K'];

export default function Equalizer({ C, eqStore, onClose, isMobile, isYoutube }) {
  const { enabled, preset, bands, gain, setEnabled, setBand, setPreset, setGain, reset } = eqStore;
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const frameData = useRef(Array.from({ length: 10 }, () => Math.random() * 40 + 10));
  const [dragging, setDragging] = useState(null);

  /* ── Animated visualiser (uses fillRect — works in ALL browsers) ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function draw() {
      animRef.current = requestAnimationFrame(draw);
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const count = frameData.current.length;
      const barW  = Math.max(1, (W / count) - 3);

      frameData.current = frameData.current.map(v =>
        Math.max(5, Math.min(H - 4, v + (Math.random() - 0.48) * 6))
      );

      frameData.current.forEach((h, i) => {
        const x   = i * (barW + 3);
        const hue = 240 + i * 12;
        ctx.fillStyle = enabled
          ? `hsla(${hue},80%,65%,.75)`
          : 'rgba(120,120,160,.25)';
        // Use fillRect (universally supported) instead of roundRect
        ctx.fillRect(x, H - h, barW, h);
      });
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [enabled]);

  /* ── Vertical drag-to-seek for each band ── */
  const onBandMouseDown = (i, e) => {
    e.preventDefault();
    setDragging(i);
    const startY   = e.clientY;
    const startVal = bands[i];

    const onMove = ev => {
      const val = Math.max(-12, Math.min(12, startVal + (startY - ev.clientY) / 6));
      setBand(i, Math.round(val * 2) / 2);
    };
    const onUp = () => {
      setDragging(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  /* Touch support for mobile sliders */
  const onBandTouchStart = (i, e) => {
    const startY   = e.touches[0].clientY;
    const startVal = bands[i];
    const onMove = ev => {
      const val = Math.max(-12, Math.min(12, startVal + (startY - ev.touches[0].clientY) / 6));
      setBand(i, Math.round(val * 2) / 2);
    };
    const onEnd = () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: isMobile ? 56 : 80,
      right: isMobile ? 0 : 24,
      left: isMobile ? 0 : 'auto',
      width: isMobile ? '100%' : 500,
      background: C.surface,
      border: `1px solid ${C.border2}`,
      borderRadius: isMobile ? '20px 20px 0 0' : 18,
      boxShadow: '0 -8px 48px rgba(0,0,0,.45)',
      zIndex: 300,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Equalizer</span>
          {isYoutube && (
            <span style={{ fontSize: 10, color: C.text3, background: C.bg3,
              padding: '2px 7px', borderRadius: 8, border: `1px solid ${C.border}` }}>
              Visual only · Local files get real EQ
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={reset}
            style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '4px 10px', cursor: 'pointer', color: C.text2, fontSize: 12, fontFamily: 'inherit' }}>
            Reset
          </button>
          {/* On/Off toggle */}
          <button onClick={() => setEnabled(!enabled)} role="switch" aria-checked={enabled}
            aria-label={enabled ? 'Disable EQ' : 'Enable EQ'}
            style={{ width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: enabled ? C.accent : C.bg4, position: 'relative', transition: 'background .2s',
              flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 3, left: enabled ? 20 : 3,
              width: 18, height: 18, borderRadius: '50%', background: '#fff',
              transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} />
          </button>
          <button onClick={onClose} aria-label="Close equalizer"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 4 }}>
            <Svg d={I.close} size={18} stroke="currentColor" />
          </button>
        </div>
      </div>

      {/* Visualiser */}
      <div style={{ padding: '12px 18px 0', background: C.bg2 }}>
        <canvas ref={canvasRef} width={464} height={56}
          style={{ width: '100%', height: 56, display: 'block', borderRadius: 8 }} />
      </div>

      {/* Preset chips */}
      <div style={{ padding: '10px 18px', background: C.bg2,
        display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {PRESET_NAMES.map(p => (
          <button key={p} onClick={() => setPreset(p)}
            style={{ padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0,
              background: preset === p ? C.accent : C.bg3,
              color: preset === p ? '#fff' : C.text2,
              fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
              transition: 'all .15s', fontFamily: 'inherit' }}>
            {p}
          </button>
        ))}
      </div>

      {/* 10-band sliders */}
      <div style={{ padding: '14px 18px 18px', display: 'flex', alignItems: 'flex-end',
        justifyContent: 'space-between', gap: 2 }}>
        {BAND_LABELS.map((label, i) => {
          const pct = ((bands[i] ?? 0) + 12) / 24; // 0..1 (centre = 0.5)
          const isDrag = dragging === i;
          const dB = bands[i] ?? 0;
          return (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
              <span style={{ fontSize: 10, fontWeight: 700, minWidth: 24, textAlign: 'center',
                color: dB > 0 ? C.accent : dB < 0 ? C.accent2 : C.text3 }}>
                {dB > 0 ? `+${dB}` : dB}
              </span>
              {/* Slider */}
              <div
                onMouseDown={e => onBandMouseDown(i, e)}
                onTouchStart={e => onBandTouchStart(i, e)}
                style={{ width: '100%', maxWidth: 32, height: 110, background: C.bg3,
                  borderRadius: 999, position: 'relative', cursor: isDrag ? 'grabbing' : 'grab',
                  userSelect: 'none', touchAction: 'none' }}>
                {/* Centre line */}
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0,
                  height: 1, background: C.border2, pointerEvents: 'none' }} />
                {/* Fill bar */}
                <div style={{
                  position: 'absolute',
                  ...(dB >= 0
                    ? { bottom: '50%', top: `${(1 - pct) * 100}%` }
                    : { top: '50%',    bottom: `${pct * 100}%` }),
                  left: '20%', right: '20%',
                  background: enabled
                    ? (dB >= 0 ? C.accent : C.accent2)
                    : C.bg4,
                  opacity: enabled ? 0.6 : 0.3,
                  transition: isDrag ? 'none' : 'all .1s',
                }} />
                {/* Thumb */}
                <div style={{
                  position: 'absolute',
                  top: `calc(${(1 - pct) * 100}% - 10px)`,
                  left: '50%', transform: 'translateX(-50%)',
                  width: 20, height: 20, borderRadius: '50%',
                  background: enabled ? C.accent : C.bg4,
                  boxShadow: isDrag ? `0 0 0 4px rgba(${C.accentRgb},.3)` : '0 2px 6px rgba(0,0,0,.35)',
                  transition: isDrag ? 'none' : 'top .1s, background .2s',
                  cursor: 'grab',
                }} />
              </div>
              <span style={{ fontSize: 10, color: C.text3 }}>{label}</span>
            </div>
          );
        })}
      </div>

      {/* Master gain */}
      <div style={{ padding: '0 18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: C.text2, whiteSpace: 'nowrap', fontWeight: 500 }}>
          Master gain
        </span>
        <input type="range" min={50} max={150} value={Math.round((gain ?? 1) * 100)}
          onChange={e => setGain(Number(e.target.value) / 100)}
          aria-label="Master gain"
          style={{ flex: 1, accentColor: C.accent, cursor: 'pointer' }} />
        <span style={{ fontSize: 12, color: C.text2, minWidth: 36, textAlign: 'right', fontWeight: 500 }}>
          {Math.round((gain ?? 1) * 100)}%
        </span>
      </div>
    </div>
  );
}
