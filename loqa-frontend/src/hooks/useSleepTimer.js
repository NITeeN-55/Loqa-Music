/**
 * useSleepTimer — auto-pause playback after a set duration.
 *
 * Usage:
 *   const { remaining, active, start, stop } = useSleepTimer(onPause);
 *
 *   remaining — seconds left (null when inactive)
 *   active    — bool
 *   start(minutes) — start a timer (e.g. start(30) → pause after 30 minutes)
 *   stop()    — cancel
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export function useSleepTimer(onPause) {
  const [endsAt,    setEndsAt]   = useState(null); // timestamp (ms)
  const [remaining, setRemaining] = useState(null); // seconds
  const tickRef = useRef(null);

  /* ── Tick every second to update display ──────────────────── */
  useEffect(() => {
    if (!endsAt) { setRemaining(null); return; }
    const tick = () => {
      const left = Math.ceil((endsAt - Date.now()) / 1000);
      if (left <= 0) {
        setEndsAt(null);
        setRemaining(null);
        onPause?.();
        return;
      }
      setRemaining(left);
    };
    tick();
    tickRef.current = setInterval(tick, 1000);
    return () => clearInterval(tickRef.current);
  }, [endsAt]); // eslint-disable-line

  const start = useCallback((minutes) => {
    if (!minutes || minutes <= 0) return;
    setEndsAt(Date.now() + minutes * 60 * 1000);
  }, []);

  const stop = useCallback(() => {
    clearInterval(tickRef.current);
    setEndsAt(null);
    setRemaining(null);
  }, []);

  const fmtRemaining = () => {
    if (remaining === null) return null;
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return m > 0 ? `${m}m ${s.toString().padStart(2,'0')}s` : `${s}s`;
  };

  return {
    remaining,
    remainingFmt: fmtRemaining(),
    active: endsAt !== null,
    start,
    stop,
  };
}
