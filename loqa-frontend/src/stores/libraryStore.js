/**
 * libraryStore v5
 *
 * Changes vs v4:
 *  - searchHistory persisted to localStorage (max 10 entries)
 *  - recentSongs: full song objects for "Continue Listening" on Home
 *  - cacheSong() called on every synced song so NowPlayingView can look them up
 */
import { create } from 'zustand';
import { loadLS, saveLS, cacheSong } from '../utils/constants.js';
import { apiFetch } from '../utils/api.js';
import { _regAddRecent } from './playerStore.js';
import useAuthStore from './authStore.js';

/* ── Auth headers — read from authStore (not localStorage directly) ── */
function getHeaders() {
  return useAuthStore.getState().headers();
}

/* ── Search history helpers ────────────────────────────────── */
const MAX_SEARCH_HIST = 10;
const HIST_KEY = 'lm_search_hist';
function loadSearchHistory() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch { return []; }
}
function saveSearchHistory(arr) {
  try { localStorage.setItem(HIST_KEY, JSON.stringify(arr)); } catch {}
}

const saved = loadLS();

const useLibraryStore = create((set, get) => ({
  /* Seed from localStorage so the UI is instant while server syncs */
  playlists:     saved.playlists || [],
  liked:         saved.liked     || [],   // array of song IDs
  recent:        saved.recent    || [],   // array of song IDs (play history)
  recentSongs:   [],                      // full song objects for Continue Listening
  searchHistory: loadSearchHistory(),
  synced:        false,
  syncing:       false,

  /* ── Sync from server ───────────────────────────────────── */
  syncFromServer: async () => {
    set({ syncing: true });
    try {
      const r = await apiFetch('/api/library', { headers: getHeaders() });
      if (!r.ok) { set({ syncing: false }); return; }
      const d = await r.json();

      /* Cache every song object for getCachedSong() lookups */
      d.liked.forEach(s => cacheSong(s));
      d.history.forEach(s => cacheSong(s));

      const likedIds  = d.liked.map(s => s.id);
      const recentIds = d.history.map(s => s.id);

      set({
        playlists:   d.playlists,
        liked:       likedIds,
        recent:      recentIds,
        recentSongs: d.history.slice(0, 12), // full objects for Continue Listening
        synced:      true,
        syncing:     false,
      });
      saveLS({ ...loadLS(), playlists: d.playlists, liked: likedIds, recent: recentIds });
    } catch (e) {
      console.warn('[Library] sync failed:', e.message);
      set({ syncing: false });
    }
  },

  /* ── addRecent (called by playerStore via _regAddRecent) ── */
  addRecent: (id) => {
    if (!id) return;
    set(s => {
      const recent = [id, ...s.recent.filter(x => x !== id)].slice(0, 50);
      saveLS({ ...loadLS(), recent });
      return { recent };
    });
  },

  /* ── Record a play (optimistic + server) ────────────────── */
  recordPlay: async (song) => {
    if (!song?.id) return;
    /* Optimistic: put this song at the front of recentSongs */
    set(s => {
      const recent    = [song.id, ...s.recent.filter(id => id !== song.id)].slice(0, 50);
      const recentSongs = [song, ...s.recentSongs.filter(x => x.id !== song.id)].slice(0, 12);
      saveLS({ ...loadLS(), recent });
      return { recent, recentSongs };
    });
    try {
      await apiFetch('/api/library/history', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({
          id: song.id, title: song.title,
          artist: song.artist, thumbnail: song.thumbnail, dur: song.dur,
        }),
      });
    } catch {}
  },

  /* ── Toggle like ─────────────────────────────────────────── */
  toggleLike: async (song) => {
    const { liked } = get();
    const id = song?.id;
    if (!id) return null;
    const wasLiked = liked.includes(id);

    set({ liked: wasLiked ? liked.filter(x => x !== id) : [id, ...liked] });
    saveLS({ ...loadLS(), liked: get().liked });

    try {
      const r = await apiFetch('/api/library/likes', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({
          id: song.id, title: song.title,
          artist: song.artist, thumbnail: song.thumbnail, dur: song.dur,
        }),
      });
      if (r.ok) { const d = await r.json(); return d.liked; }
    } catch {}
    /* Rollback on failure */
    set({ liked: wasLiked ? [...liked] : liked.filter(x => x !== id) });
    return null;
  },

  /* ── Create playlist ─────────────────────────────────────── */
  createPlaylist: async (name, desc = '') => {
    const r = await apiFetch('/api/library/playlists', {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ name, desc, ci: Math.floor(Math.random() * 8) }),
    });
    if (r.ok) {
      const pl = await r.json();
      set(s => {
        const playlists = [{ ...pl, songs: [] }, ...s.playlists];
        saveLS({ ...loadLS(), playlists });
        return { playlists };
      });
      return pl;
    }
  },

  /* ── Edit playlist ───────────────────────────────────────── */
  editPlaylist: async (id, name, desc) => {
    await apiFetch(`/api/library/playlists/${id}`, {
      method: 'PUT', headers: getHeaders(),
      body: JSON.stringify({ name, desc }),
    });
    set(s => {
      const playlists = s.playlists.map(p => p.id === id ? { ...p, name, desc } : p);
      saveLS({ ...loadLS(), playlists });
      return { playlists };
    });
  },

  /* ── Delete playlist ─────────────────────────────────────── */
  deletePlaylist: async (id) => {
    await apiFetch(`/api/library/playlists/${id}`, { method: 'DELETE', headers: getHeaders() });
    set(s => {
      const playlists = s.playlists.filter(p => p.id !== id);
      saveLS({ ...loadLS(), playlists });
      return { playlists };
    });
  },

  /* ── Add song to playlist ────────────────────────────────── */
  addToPlaylist: async (song, playlistId) => {
    const r = await apiFetch(`/api/library/playlists/${playlistId}/songs`, {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({
        id: song.id, title: song.title,
        artist: song.artist, thumbnail: song.thumbnail, dur: song.dur,
      }),
    });
    if (r.ok) {
      set(s => {
        const playlists = s.playlists.map(p => {
          if (p.id !== playlistId) return p;
          if (p.songs.includes(song.id)) return p;
          return { ...p, songs: [...p.songs, song.id] };
        });
        saveLS({ ...loadLS(), playlists });
        return { playlists };
      });
      return get().playlists.find(p => p.id === playlistId)?.name;
    }
  },

  /* ── Remove song from playlist ──────────────────────────── */
  removeFromPlaylist: async (songId, playlistId) => {
    await apiFetch(`/api/library/playlists/${playlistId}/songs/${songId}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    set(s => {
      const playlists = s.playlists.map(p =>
        p.id === playlistId ? { ...p, songs: p.songs.filter(id => id !== songId) } : p
      );
      saveLS({ ...loadLS(), playlists });
      return { playlists };
    });
  },

  /* ── Search history ──────────────────────────────────────── */
  addSearchHistory: (query) => {
    if (!query?.trim()) return;
    set(s => {
      const arr = [query.trim(), ...s.searchHistory.filter(q => q !== query.trim())]
        .slice(0, MAX_SEARCH_HIST);
      saveSearchHistory(arr);
      return { searchHistory: arr };
    });
  },
  clearSearchHistory: () => {
    saveSearchHistory([]);
    set({ searchHistory: [] });
  },
}));

/* ── Register addRecent with playerStore ── */
_regAddRecent(useLibraryStore.getState().addRecent);

export default useLibraryStore;
