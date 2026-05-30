/**
 * useAudioEQ — Web Audio API 10-band equalizer
 *
 * Works with local files (HTML5 Audio → AudioContext chain).
 * YouTube audio cannot be captured due to CORS — EQ is visual-only there.
 *
 * Chain:  <audio> → MediaElementSource → Gain → [10x BiquadFilter] → Analyser → destination
 */
import { useRef, useEffect, useCallback } from 'react';
import { EQ_BANDS } from '../stores/eqStore.js';

export default function useAudioEQ({ audioRef, bands, gain, enabled, onAnalyserReady }) {
  const ctxRef      = useRef(null);
  const sourceRef   = useRef(null);
  const filtersRef  = useRef([]);
  const gainRef     = useRef(null);
  const analyserRef = useRef(null);
  const connectedRef= useRef(false);

  /* ── Build the audio graph ─────────────────────────── */
  const buildGraph = useCallback(() => {
    const audio = audioRef?.current;
    if (!audio || connectedRef.current) return;

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;

      const source = ctx.createMediaElementSource(audio);
      sourceRef.current = source;

      // 10-band BiquadFilters
      const filters = EQ_BANDS.map((freq, i) => {
        const f = ctx.createBiquadFilter();
        f.type      = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
        f.frequency.value = freq;
        f.Q.value         = 1.0;
        f.gain.value      = bands[i] ?? 0;
        return f;
      });
      filtersRef.current = filters;

      // Master gain
      const masterGain = ctx.createGain();
      masterGain.gain.value = gain ?? 1.0;
      gainRef.current = masterGain;

      // Analyser (for visualiser)
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // Connect chain: source → filter[0] → ... → filter[9] → gain → analyser → destination
      source.connect(filters[0]);
      for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
      filters[filters.length - 1].connect(masterGain);
      masterGain.connect(analyser);
      analyser.connect(ctx.destination);

      connectedRef.current = true;
      onAnalyserReady?.(analyser);
    } catch (e) {
      console.warn('[EQ] Could not build audio graph:', e.message);
    }
  }, []); // eslint-disable-line

  /* ── Sync band gains ───────────────────────────────── */
  useEffect(() => {
    if (!connectedRef.current) return;
    filtersRef.current.forEach((f, i) => {
      const target = enabled ? (bands[i] ?? 0) : 0;
      f.gain.setTargetAtTime(target, ctxRef.current.currentTime, 0.05);
    });
  }, [bands, enabled]);

  /* ── Sync master gain ──────────────────────────────── */
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.setTargetAtTime(gain ?? 1.0, ctxRef.current?.currentTime || 0, 0.05);
  }, [gain]);

  /* ── Resume ctx on user gesture ─────────────────────── */
  const resume = useCallback(() => {
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume();
  }, []);

  /* ── Cleanup ────────────────────────────────────────── */
  useEffect(() => () => {
    try { ctxRef.current?.close(); } catch {}
    connectedRef.current = false;
    filtersRef.current = [];
  }, []);

  return { buildGraph, resume, analyser: analyserRef, ctx: ctxRef };
}
