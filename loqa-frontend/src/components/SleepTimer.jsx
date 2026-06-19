/**
 * SleepTimer — sets a timer to pause playback after N minutes.
 * Rendered as a small panel.
 */
import React, { useEffect, useState } from 'react';

const OPTIONS = [15, 30, 45, 60, 90, 120];

export default function SleepTimer({ C, sleepTimerEnd, setSleepTimer, clearSleepTimer, onPause, onClose }) {
  const [remaining, setRemaining] = useState(null);

  // Countdown tick
  useEffect(() => {
    if (!sleepTimerEnd) { setRemaining(null); return; }
    const tick = () => {
      const rem = Math.max(0, sleepTimerEnd - Date.now());
      setRemaining(rem);
      if (rem === 0) {
        onPause();
        clearSleepTimer();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sleepTimerEnd]); // eslint-disable-line

  const fmt = (ms) => {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div style={{
      position: 'fixed', bottom: 100, right: 20, zIndex: 8500,
      background: C.surface, border: `1px solid ${C.border2}`,
      borderRadius: 16, padding: 20, minWidth: 240,
      boxShadow: '0 16px 48px rgba(0,0,0,.4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>😴 Sleep Timer</span>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 4 }}>✕</button>
      </div>

      {sleepTimerEnd ? (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.accent, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(remaining ?? 0)}
            </div>
            <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>remaining</div>
          </div>
          <button onClick={() => { clearSleepTimer(); }}
            style={{ width: '100%', padding: '9px 0', background: 'rgba(239,68,68,.15)',
              border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, cursor: 'pointer',
              color: '#ef4444', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
            Cancel Timer
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: C.text3, marginBottom: 10 }}>Pause after:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {OPTIONS.map(min => (
              <button key={min} onClick={() => { setSleepTimer(min); }}
                style={{ padding: '10px 0', background: C.bg3, border: `1px solid ${C.border}`,
                  borderRadius: 10, cursor: 'pointer', color: C.text, fontSize: 13,
                  fontWeight: 600, fontFamily: 'inherit', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = `rgba(${C.accentRgb},.15)`; e.currentTarget.style.borderColor = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.bg3; e.currentTarget.style.borderColor = C.border; }}>
                {min}m
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
