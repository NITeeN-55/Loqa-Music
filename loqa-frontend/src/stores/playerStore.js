/**
 * playerStore v5 — continuous Spotify-style autoplay engine
 *
 * Autoplay priority:
 *   1. Manual queue
 *   2. Current album/playlist/search session
 *   3. Autoplay candidates (YouTube related + personalised recommendations)
 *   4. On-demand candidate fetch
 *
 * Autoplay candidates are kept as a rolling buffer. Every time a song starts,
 * the store asks for more songs based on the current artist/title and the
 * user's listening history. This makes playback continue indefinitely instead
 * of stopping after one related batch.
 */
import { create } from 'zustand';
import { cacheSong, getCachedSong } from '../utils/constants.js';
import { apiFetch } from '../utils/api.js';

let _addRecent = null;
export const _regAddRecent = fn => { _addRecent = fn; };

function getAuthHeaders() {
  try {
    const token = JSON.parse(localStorage.getItem('lm2'))?.token;
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}

async function fetchRelated(videoId, limit = 20) {
  if (!videoId) return [];
  try {
    const r = await apiFetch(`/api/youtube/related?v=${encodeURIComponent(videoId)}`);
    if (!r.ok) return [];
    const { items = [] } = await r.json();
    return items.slice(0, limit).map((t, i) => ({
      id: t.id,
      title: t.title || 'Unknown',
      artist: t.artist || 'Unknown',
      album: t.album || 'YouTube',
      dur: t.dur || 0,
      ci: t.ci ?? (i % 8),
      thumbnail: t.thumbnail || '',
      views: t.views || '',
      isYoutube: true,
      source: 'autoplay-related',
    })).filter(t => t.id);
  } catch {
    return [];
  }
}

async function fetchPersonalised(seedSong, limit = 24) {
  if (!seedSong?.id) return [];
  try {
    const params = new URLSearchParams({
      limit: String(Math.min(limit, 60)),
      seed_artist: seedSong.artist || '',
      seed_id: seedSong.id,
    });
    const r = await apiFetch(`/api/recommendations?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!r.ok) return [];
    const { items = [] } = await r.json();
    return items.map((s, i) => ({
      ...s,
      ci: s.ci ?? (i % 8),
      source: 'autoplay-recommendation',
      isYoutube: s.isYoutube !== false,
    })).filter(s => s?.id);
  } catch {
    return [];
  }
}

async function fetchAutoplayCandidates(seedSong, limit = 36) {
  if (!seedSong?.id) return [];
  const [related, personalised] = await Promise.allSettled([
    fetchRelated(seedSong.id, 20),
    fetchPersonalised(seedSong, 24),
  ]);

  const merged = [];
  const seen = new Set();
  const add = (items) => {
    for (const item of items || []) {
      if (!item?.id || seen.has(item.id) || item.id === seedSong.id) continue;
      seen.add(item.id);
      merged.push(item);
    }
  };
  add(related.status === 'fulfilled' ? related.value : []);
  add(personalised.status === 'fulfilled' ? personalised.value : []);

  // Keep the queue mixed so consecutive songs are not all from one source.
  const relatedItems = merged.filter(s => s.source === 'autoplay-related');
  const recommendedItems = merged.filter(s => s.source === 'autoplay-recommendation');
  const mixed = [];
  while (relatedItems.length || recommendedItems.length) {
    if (relatedItems.length) mixed.push(relatedItems.shift());
    if (recommendedItems.length) mixed.push(recommendedItems.shift());
  }
  return mixed.slice(0, limit);
}

const uniqueById = items => {
  const seen = new Set();
  return (items || []).filter(item => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const addToHistory = (history, id) =>
  id ? [id, ...history.filter(x => x !== id)].slice(0, 100) : history;

const usePlayerStore = create((set, get) => ({
  song: null,
  playing: false,
  progress: 0,
  duration: 0,
  volume: (() => {
    try { return JSON.parse(localStorage.getItem('lm2'))?.volume ?? 80; } catch { return 80; }
  })(),
  muted: false,
  shuffle: false,
  repeat: false,

  queue: [],

  // Rolling autoplay buffer. It is intentionally separate from the manual queue.
  related: [],
  relatedSeedId: null,
  fetchingRelated: false,
  autoplayEnabled: true,

  session: { list: [], idx: -1, source: 'manual' },
  history: [],

  setPlaying: v => set(s => ({ playing: typeof v === 'function' ? v(s.playing) : v })),
  setProgress: p => set({ progress: p }),
  setDuration: d => set({ duration: d }),
  setVolume: v => set({ volume: Math.min(100, Math.max(0, v)) }),
  setMuted: v => set(s => ({ muted: typeof v === 'function' ? v(s.muted) : v })),
  setShuffle: v => set(s => ({ shuffle: typeof v === 'function' ? v(s.shuffle) : v })),
  setRepeat: v => set(s => ({ repeat: typeof v === 'function' ? v(s.repeat) : v })),
  setQueue: v => set(s => ({ queue: typeof v === 'function' ? v(s.queue) : v })),
  setAutoplayEnabled: v => set(s => ({ autoplayEnabled: typeof v === 'function' ? v(s.autoplayEnabled) : v })),

  /* Fetch and APPEND to the autoplay buffer. Never replace good candidates. */
  prefetchRelated: async (songOrId) => {
    const song = typeof songOrId === 'object' ? songOrId : getCachedSong(songOrId) || get().song;
    if (!song?.id || song.isYoutube === false) return;

    const state = get();
    // Do not repeatedly fetch the same seed unless the buffer is running low.
    if (state.fetchingRelated) return;
    if (state.relatedSeedId === song.id && state.related.length >= 8) return;

    set({ fetchingRelated: true });
    const items = await fetchAutoplayCandidates(song, 36);

    if (get().song?.id === song.id) {
      const blocked = new Set([
        ...get().history,
        song.id,
        ...get().related.map(x => x.id),
      ]);
      const fresh = items.filter(item => !blocked.has(item.id));
      fresh.forEach(cacheSong);
      set(state2 => ({
        related: uniqueById([...state2.related, ...fresh]).slice(0, 60),
        relatedSeedId: song.id,
        fetchingRelated: false,
      }));
    } else {
      // The user skipped while this fetch was in flight. Release the lock and
      // immediately start a fetch for the song that is actually playing.
      set({ fetchingRelated: false });
      const current = get().song;
      if (current?.id && current.id !== song.id && get().autoplayEnabled) {
        queueMicrotask(() => get().prefetchRelated(current));
      }
    }
  },

  topUpRelated: async () => {
    const { song, related, fetchingRelated } = get();
    if (!song?.id || song.isYoutube === false || fetchingRelated || related.length >= 10) return;
    await get().prefetchRelated(song);
  },

  play: (song, { toggle = true, fromQ = false, list = null, source = 'manual', keepRelated = false } = {}) => {
    if (!song?.id) return;
    cacheSong(song);

    set(state => {
      const prev = state.song;
      if (toggle && prev?.id === song.id) return { playing: !state.playing };

      const L = Array.isArray(list) && list.length ? list : (fromQ ? state.session.list : [song]);
      const idx = L.findIndex(s => s.id === song.id);
      const i = idx >= 0 ? idx : 0;
      const newQueue = fromQ ? state.queue : [];

      return {
        song,
        playing: true,
        progress: 0,
        duration: song.dur || 0,
        history: addToHistory(state.history, prev?.id),
        session: fromQ ? state.session : { list: L, idx: i, source },
        queue: newQueue,
        related: keepRelated ? state.related : [],
        // Keep the seed when continuing an autoplay buffer.
        relatedSeedId: keepRelated ? state.relatedSeedId : null,
      };
    });

    if (song.isYoutube !== false) {
      // Start the next batch in the background as soon as playback changes.
      queueMicrotask(() => get().prefetchRelated(song));
    }

    if (_addRecent) _addRecent(song.id);
  },

  playAll: (songs, startIdx = 0, source = 'list') => {
    if (!songs?.length) return;
    const { shuffle: sh } = get();
    const list = sh ? [...songs].sort(() => Math.random() - 0.5) : [...songs];
    const deduped = uniqueById(list);
    deduped.forEach(cacheSong);
    get().play(deduped[startIdx] || deduped[0], { toggle: false, source, list: deduped });
  },

  next: async () => {
    const state = get();
    const { song, queue, session, related, autoplayEnabled } = state;
    if (!song) return;

    const histWith = addToHistory(state.history, song.id);

    // 1. Explicit manual queue.
    if (queue.length > 0) {
      const [nextSong, ...rest] = queue;
      set({ queue: rest, history: histWith });
      get().play(nextSong, { toggle: false, fromQ: true, keepRelated: true, source: 'manual' });
      return;
    }

    // 2. Continue the user's explicit album/playlist/search session.
    const isAutoplaySession = session.source === 'autoplay';
    if (!isAutoplaySession && session.list.length > 1 && session.idx < session.list.length - 1) {
      const ni = session.idx + 1;
      const nextSong = session.list[ni];
      set({ session: { ...session, idx: ni }, history: histWith });
      get().play(nextSong, { toggle: false, fromQ: true, keepRelated: true, source: session.source });
      get().topUpRelated();
      return;
    }

    if (!autoplayEnabled) {
      set({ playing: false, history: histWith });
      return;
    }

    // 3. Rolling autoplay buffer. Do NOT turn it into a session — that was the
    // bug that could exhaust the buffer and stop continuous playback.
    let candidates = get().related;
    if (!candidates.length) {
      set({ history: histWith });
      await get().prefetchRelated(song);
      candidates = get().related;
    }

    if (!candidates.length) {
      // Last fallback: try one direct fetch from the just-ended song.
      const fallback = await fetchRelated(song.id, 20);
      const blocked = new Set([song.id, ...get().history.slice(0, 60)]);
      let fresh = uniqueById(fallback).filter(x => !blocked.has(x.id));
      // If the source only returns songs the listener has already heard, allow
      // a controlled replay rather than stopping playback.
      if (!fresh.length) {
        fresh = uniqueById(fallback).filter(x => x.id !== song.id);
      }
      fresh.forEach(cacheSong);
      candidates = fresh;
      set({ related: candidates, history: histWith, relatedSeedId: song.id });
    }

    if (!candidates.length) {
      set({ playing: false, history: histWith });
      return;
    }

    const [nextSong, ...rest] = candidates;
    set({ related: rest, history: histWith });
    get().play(nextSong, {
      toggle: false,
      fromQ: false,
      source: 'autoplay',
      keepRelated: true,
    });

    // Keep the buffer alive while the current song plays.
    if (rest.length < 10) {
      setTimeout(() => get().topUpRelated(), 0);
    }
  },

  prev: () => {
    const { history, song, play } = get();
    if (!song) return;
    const prevId = history[0];
    if (!prevId) return 'none';
    const prevSong = getCachedSong(prevId);
    if (!prevSong) return 'none';
    set(s => ({ history: s.history.slice(1) }));
    play(prevSong, { toggle: false, keepRelated: true, source: 'history' });
    return 'played';
  },

  ended: () => {
    const { repeat } = get();
    if (repeat) { set({ progress: 0 }); return 'restart'; }
    void get().next();
    return 'next';
  },

  seek: p => set({ progress: Math.min(100, Math.max(0, p)) }),
}));

export default usePlayerStore;
