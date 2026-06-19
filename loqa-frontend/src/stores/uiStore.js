import { create } from 'zustand';
import { loadLS, saveLS } from '../utils/constants.js';

const DEF_SETTINGS = {
  autoplay: true, crossfade: false, normalize: false,
  showWave: true, reducedMotion: false, highContrast: false,
};

const saved = loadLS();

const useUIStore = create((set, get) => ({
  /* ── Theme ──────────────────────────────────────────── */
  theme:       saved.theme || 'dark',
  toggleTheme: () => set(s => {
    const t = s.theme === 'dark' ? 'light' : 'dark';
    saveLS({ ...loadLS(), theme: t });
    return { theme: t };
  }),

  /* ── Navigation ─────────────────────────────────────── */
  view:     'home',
  playlist: null,
  genre:    null,
  searchQ:  '',

  /**
   * go(view, extra) — atomic navigation.
   * Always resets all selection fields, then applies extra overrides.
   * This prevents stale playlist/genre data across navigations.
   */
  go: (view, extra = {}) => {
    if (!view) return;
    set({
      view,
      playlist: null,
      genre:    null,
      // Apply caller overrides (e.g. { playlist: pl } or { genre: 'Hip Hop' })
      ...extra,
    });
  },

  setSearchQ: (q) => set({ searchQ: q || '' }),

  /* ── Sidebar ─────────────────────────────────────────── */
  sidebarOpen: typeof window !== 'undefined' ? window.innerWidth > 768 : true,
  setSidebarOpen: (val) => set(s => ({
    sidebarOpen: typeof val === 'function' ? val(s.sidebarOpen) : !!val,
  })),

  /* ── Panels / Modals ─────────────────────────────────── */
  showQueue:    false,
  showSettings: false,
  showNowPlaying: false,
  plModal:      null,
  ctxMenu:      null,

  setShowQueue:      (v) => set({ showQueue:    !!v }),
  setShowSettings:   (v) => set({ showSettings: !!v }),
  setShowNowPlaying: (v) => set({ showNowPlaying: typeof v === 'function' ? v(get().showNowPlaying) : !!v }),
  setPlModal:        (v) => set({ plModal: v || null }),
  setCtxMenu:        (v) => set({ ctxMenu: v || null }),

  openCtxMenu: (e, song) => {
    if (!e || !song) return;
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth  - 240);
    const y = Math.min(e.clientY, window.innerHeight - 380);
    set({ ctxMenu: { x: Math.max(0, x), y: Math.max(0, y), song } });
  },

  /* ── Toasts ──────────────────────────────────────────── */
  toasts: [],
  toast: (msg, type = 'info', dur = 3200) => {
    if (!msg) return;
    const id = Date.now() + Math.random();
    set(s => ({ toasts: [...s.toasts.slice(-4), { id, msg: String(msg), type }] }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), dur);
  },

  /* ── Settings ────────────────────────────────────────── */
  settings: { ...DEF_SETTINGS, ...(saved.settings || {}) },
  saveSettings: (s) => {
    const merged = { ...DEF_SETTINGS, ...s };
    set({ settings: merged });
    saveLS({ ...loadLS(), settings: merged });
  },

  /* ── Sleep Timer ─────────────────────────────────────── */
  sleepTimerEnd: null,   // timestamp when timer expires (null = off)
  setSleepTimer: (minutes) => {
    if (!minutes) {
      set({ sleepTimerEnd: null });
      return;
    }
    set({ sleepTimerEnd: Date.now() + minutes * 60_000 });
  },
  clearSleepTimer: () => set({ sleepTimerEnd: null }),
}));

export default useUIStore;
