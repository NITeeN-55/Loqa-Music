/**
 * Equalizer Store — 10-band EQ state + presets
 * Bands: 32 64 125 250 500 1k 2k 4k 8k 16k Hz
 */
import { create } from 'zustand';
import { loadLS, saveLS } from '../utils/constants.js';

export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS = {
  flat:      [0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
  bass:      [8,  7,  5,  2,  0, -1, -1,  0,  0,  0],
  treble:    [0,  0,  0,  0,  0,  2,  4,  6,  7,  8],
  vocal:     [-2,-1,  0,  3,  5,  5,  3,  1,  0, -1],
  pop:       [-1,  0,  2,  4,  4,  2,  0, -1, -1, -1],
  rock:      [5,  4,  2,  0, -1, -1,  1,  3,  4,  5],
  hiphop:    [6,  5,  2,  3,  0, -2,  1,  2,  3,  2],
  classical: [0,  0,  0,  0,  0,  0, -2, -3, -3, -4],
  electronic:[5,  4,  1,  0, -2,  2,  1,  2,  5,  4],
  lofi:      [3,  2,  1,  0, -1, -2, -3, -4, -5, -6],
};

const saved = loadLS();
const useEqStore = create((set, get) => ({
  enabled:  saved.eqEnabled ?? true,
  preset:   saved.eqPreset  || 'flat',
  bands:    saved.eqBands   || [...EQ_PRESETS.flat],
  gain:     saved.eqGain    ?? 1.0,  // master gain 0.5–2.0

  setEnabled: (v) => { set({ enabled: v }); saveLS({ ...loadLS(), eqEnabled: v }); },

  setBand: (i, val) => {
    const bands = [...get().bands];
    bands[i] = Math.max(-12, Math.min(12, val));
    set({ bands, preset: 'custom' });
    saveLS({ ...loadLS(), eqBands: bands, eqPreset: 'custom' });
  },

  setPreset: (name) => {
    const bands = EQ_PRESETS[name] ? [...EQ_PRESETS[name]] : [...get().bands];
    set({ preset: name, bands });
    saveLS({ ...loadLS(), eqPreset: name, eqBands: bands });
  },

  setGain: (g) => { set({ gain: g }); saveLS({ ...loadLS(), eqGain: g }); },

  reset: () => {
    const bands = [...EQ_PRESETS.flat];
    set({ bands, preset: 'flat', gain: 1.0 });
    saveLS({ ...loadLS(), eqBands: bands, eqPreset: 'flat', eqGain: 1.0 });
  },

  /** Sync to backend */
  syncToServer: async (headers) => {
    const { preset, bands } = get();
    try {
      await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ eqPreset: preset, eqBands: bands }),
      });
    } catch {}
  },

  loadFromServer: async (headers) => {
    try {
      const r = await fetch('/api/preferences', { headers });
      if (!r.ok) return;
      const d = await r.json();
      if (d.eqBands?.length === 10) {
        set({ bands: d.eqBands, preset: d.eqPreset || 'flat' });
        saveLS({ ...loadLS(), eqBands: d.eqBands, eqPreset: d.eqPreset });
      }
    } catch {}
  },
}));

export default useEqStore;
