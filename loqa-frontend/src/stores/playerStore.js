/**
 * playerStore v4 — Spotify-style autoplay engine
 *
 * Autoplay pipeline (in priority order):
 *  1. Manual queue  (user explicitly added)
 *  2. Session list  (album / playlist / search results)
 *  3. Related queue (pre-fetched similar songs)
 *  4. On-demand related fetch (fallback, keeps music going)
 *
 * Key improvements over v3:
 *  • Related songs fetched IMMEDIATELY when a song starts (0 ms delay)
 *  • related[] is NOT wiped when autoplay moves to the next related track
 *  • Continuous top-up: when related drops below 3, fetch more
 *  • Shuffle applies to session list but never to autoplay (stays coherent)
 *  • play() exposes autoplayEnabled flag (default on)
 */
import { create } from 'zustand';
import { cacheSong, getCachedSong } from '../utils/constants.js';

const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';

/* ── Forward reference so libraryStore can register addRecent ── */
let _addRecent = null;
export const _regAddRecent = fn => { _addRecent = fn; };

/* ── Fetch similar songs from YouTube ──────────────────────────
   Returns normalised song objects, never throws.                */
async function fetchRelated(videoId, limit = 20) {
  if (!videoId) return [];
  try {
    const r = await fetch(`${API}/api/youtube/related?v=${encodeURIComponent(videoId)}`);
    if (!r.ok) return [];
    const { items = [] } = await r.json();
    return items
      .slice(0, limit)
      .map((t, i) => ({
        id:        t.id,
        title:     t.title     || 'Unknown',
        artist:    t.artist    || 'Unknown',
        album:     t.album     || 'YouTube',
        dur:       t.dur       || 0,
        ci:        t.ci        ?? (i % 8),
        thumbnail: t.thumbnail || '',
        views:     t.views     || '',
        isYoutube: true,
        source:    'autoplay',
      }))
      .filter(t => t.id);
  } catch { return []; }
}

/* ── Helpers ────────────────────────────────────────────────── */
const addToHistory = (history, id) =>
  id ? [id, ...history.filter(x => x !== id)].slice(0, 100) : history;

const usePlayerStore = create((set, get) => ({
  /* ── State ─────────────────────────────────────────────────── */
  song:     null,
  playing:  false,
  progress: 0,
  duration: 0,
  volume: (() => {
    try { return JSON.parse(localStorage.getItem('lm2'))?.volume ?? 80; } catch { return 80; }
  })(),
  muted:    false,
  shuffle:  false,
  repeat:   false,

  /* Manual queue — songs the user explicitly pushed */
  queue: [],

  /* Autoplay / related queue — pre-fetched similar songs */
  related:         [],
  relatedSeedId:   null,   // which song triggered the last fetch
  fetchingRelated: false,

  /* Session — current album / playlist / search results list */
  session: { list: [], idx: -1, source: 'manual' },

  /* Playback history (IDs) for prev navigation */
  history: [],

  /* ── Simple setters ─────────────────────────────────────────── */
  setPlaying:  v  => set(s => ({ playing:  typeof v === 'function' ? v(s.playing)  : v })),
  setProgress: p  => set({ progress: p }),
  setDuration: d  => set({ duration: d }),
  setVolume:   v  => set({ volume: Math.min(100, Math.max(0, v)) }),
  setMuted:    v  => set(s => ({ muted:   typeof v === 'function' ? v(s.muted)    : v })),
  setShuffle:  v  => set(s => ({ shuffle: typeof v === 'function' ? v(s.shuffle)  : v })),
  setRepeat:   v  => set(s => ({ repeat:  typeof v === 'function' ? v(s.repeat)   : v })),
  setQueue:    v  => set(s => ({ queue:   typeof v === 'function' ? v(s.queue)    : v })),

  /* ── Pre-fetch related songs in the background ──────────────── */
  prefetchRelated: async (songId) => {
    if (!songId) return;
    const state = get();
    // Skip if we already have fresh related songs for this seed
    if (state.relatedSeedId === songId && state.related.length > 0) return;
    if (state.fetchingRelated) return;

    set({ fetchingRelated: true });
    const items = await fetchRelated(songId, 20);
    items.forEach(cacheSong);

    // Only apply if this song is still playing (user hasn't skipped)
    if (get().song?.id === songId) {
      set({ related: items, relatedSeedId: songId, fetchingRelated: false });
    } else {
      set({ fetchingRelated: false });
    }
  },

  /* ── Top-up: fetch more when autoplay queue runs low ────────── */
  topUpRelated: async () => {
    const { song, related, fetchingRelated, relatedSeedId } = get();
    if (!song?.id || fetchingRelated || related.length >= 5) return;
    // Use current song as seed for the next batch
    if (song.id === relatedSeedId) return; // already fetched for this song
    set({ fetchingRelated: true });
    const items = await fetchRelated(song.id, 20);
    items.forEach(cacheSong);
    if (get().song?.id === song.id) {
      const existing = new Set(get().related.map(s => s.id));
      const fresh    = items.filter(s => !existing.has(s.id));
      set(st => ({
        related:         [...st.related, ...fresh],
        relatedSeedId:   song.id,
        fetchingRelated: false,
      }));
    } else {
      set({ fetchingRelated: false });
    }
  },

  /* ─────────────────────────────────────────────────────────────
     play() — the ONE place that changes the currently-playing song.

     Options:
       toggle    {bool}   true  → click same song pauses/resumes
       fromQ     {bool}   true  → called internally (autoplay/queue)
       list      {array}  session list to play through
       source    {string} 'search'|'trending'|'autoplay'|'manual'…
       keepRelated {bool} true  → don't wipe the related queue
  ─────────────────────────────────────────────────────────────── */
  play: (song, { toggle = true, fromQ = false, list = null,
                 source = 'manual', keepRelated = false } = {}) => {
    if (!song?.id) return;
    cacheSong(song);

    set(state => {
      const prev = state.song;

      // Same song clicked → toggle play/pause
      if (toggle && prev?.id === song.id) return { playing: !state.playing };

      // Build session list
      const L   = Array.isArray(list) && list.length ? list : (fromQ ? state.session.list : [song]);
      const idx = L.findIndex(s => s.id === song.id);
      const i   = idx >= 0 ? idx : 0;

      // Remaining songs in the session are tracked via session.idx (not duplicated into queue).
      // Manual queue entries (addQueue / playNext) are always preserved when fromQ=true.
      const newQueue = fromQ ? state.queue : [];

      // Only wipe related when explicitly starting a new manual session
      const newRelated = (keepRelated || fromQ) ? state.related : [];

      return {
        song,
        playing:        true,
        progress:       0,
        duration:       song.dur || 0,
        history:        addToHistory(state.history, prev?.id),
        session:        fromQ ? state.session : { list: L, idx: i, source },
        queue:          newQueue,
        related:        newRelated,
        relatedSeedId:  keepRelated ? state.relatedSeedId : null,
      };
    });

    // Pre-fetch related IMMEDIATELY (0 ms) whenever a new song starts
    if (song.isYoutube !== false) {
      get().prefetchRelated(song.id);
    }

    // Track recently played
    if (_addRecent) _addRecent(song.id);
  },

  /* ── playAll ─────────────────────────────────────────────────── */
  playAll: (songs, startIdx = 0, source = 'list') => {
    if (!songs?.length) return;
    const { shuffle: sh } = get();
    const list = sh ? [...songs].sort(() => Math.random() - 0.5) : songs;
    list.forEach(cacheSong);
    get().play(list[startIdx] || list[0], { toggle: false, source, list });
  },

  /* ─────────────────────────────────────────────────────────────
     next() — Spotify-style seamless skip.

     Priority:
       1. Manual queue (user's explicit "Play Next" additions)
       2. Session continuation (album/playlist/search list)
       3. Pre-fetched related (autoplay — no gap)
       4. On-demand related fetch (last resort)
  ─────────────────────────────────────────────────────────────── */
  next: () => {
    const { song, queue, session, related, history, play, topUpRelated } = get();
    if (!song) return;

    const histWith = addToHistory(history, song.id);

    /* 1 ── Manual queue */
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      set({ queue: rest, history: histWith });
      play(next, { toggle: false, fromQ: true, keepRelated: true });
      return;
    }

    /* 2 ── Session (album / playlist / search results) */
    if (session.list.length > 1 && session.idx < session.list.length - 1) {
      const ni   = session.idx + 1;
      const next = session.list[ni];
      set({ session: { ...session, idx: ni }, history: histWith });
      play(next, { toggle: false, fromQ: true, keepRelated: true });
      // Top-up related if running low
      topUpRelated();
      return;
    }

    /* 3 ── Pre-fetched autoplay (Spotify Radio style) */
    if (related.length > 0) {
      const [next, ...rest] = related;
      set({ related: rest, history: histWith });
      // Make the remaining related songs the new session so they all play
      play(next, {
        toggle:      false,
        fromQ:       false,
        list:        [next, ...rest],
        source:      'autoplay',
        keepRelated: true,   // keep rest of related as buffer
      });
      // Immediately fetch MORE related songs for the new song
      setTimeout(() => get().prefetchRelated(next.id), 0);
      return;
    }

    /* 4 ── On-demand fetch (user skipped before prefetch finished) */
    const seedId = song.id;
    fetchRelated(seedId, 20).then(items => {
      items.forEach(cacheSong);
      if (!items.length) { set({ playing: false, history: histWith }); return; }
      const [next, ...rest] = items;
      set({ related: rest, history: histWith, relatedSeedId: seedId });
      get().play(next, { toggle: false, list: [next, ...rest], source: 'autoplay', keepRelated: true });
    });
  },

  /* ── prev() ─────────────────────────────────────────────────── */
  prev: () => {
    const { song, progress, history, session, play } = get();
    if (!song) return;

    // Restart if more than 8% through
    if (progress > 8) { set({ progress: 0 }); return 'restart'; }

    // Go back in history
    if (history.length > 0) {
      const [prevId, ...rest] = history;
      const prevSong = getCachedSong(prevId);
      if (prevSong) { set({ history: rest }); play(prevSong, { toggle: false, fromQ: true, keepRelated: true }); return; }
    }

    // Go back in session
    if (session.list.length > 1 && session.idx > 0) {
      const ni = session.idx - 1;
      set({ session: { ...session, idx: ni } });
      play(session.list[ni], { toggle: false, fromQ: true, keepRelated: true });
    }
  },

  /* ── ended() ─────────────────────────────────────────────────── */
  ended: () => {
    const { repeat } = get();
    if (repeat) { set({ progress: 0 }); return 'restart'; }
    get().next();
  },

  /* ── seek() ─────────────────────────────────────────────────── */
  seek: p => set({ progress: Math.min(100, Math.max(0, p)) }),
}));

export default usePlayerStore;
