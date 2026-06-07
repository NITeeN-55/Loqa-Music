/**
 * libraryStore v5 — playlists, likes, history, search history.
 *
 * CHANGES v5:
 *  - Token sourced from authStore.getState() instead of direct localStorage read
 *  - Search history persisted to localStorage (max 10 entries)
 *  - syncFromServer caches full song objects for NowPlayingView / Continue Listening
 */
import { create } from 'zustand';
import { loadLS, saveLS, cacheSong } from '../utils/constants.js';
import { apiFetch } from '../utils/api.js';
import { _regAddRecent } from './playerStore.js';

/* ── Get auth headers — always from authStore to stay in sync ── */
function getHeaders() {
  // Dynamic import avoids circular dep; authStore is always initialized before libraryStore
  try {
    const { default: useAuthStore } = require('../stores/authStore.js'); // eslint-disable-line
    return useAuthStore.getState().headers();
  } catch {
    // Fallback for SSR or test environments
    const token = loadLS().token;
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }
}

// Since require() isn't available in ESM, use a lazy getter approach
let _authStore = null;
async function ensureAuthStore() {
  if (_authStore) return _authStore;
  const m = await import('./authStore.js');
  _authStore = m.default;
  return _authStore;
}
async function getHeadersAsync() {
  const store = await ensureAuthStore();
  return store.getState().headers();
}

const saved = loadLS();

/* ── Search history helpers ────────────────────────────────── */
const MAX_SEARCH_HISTORY = 10;
function loadSearchHistory() { try { return JSON.parse(localStorage.getItem('lm_search_hist')) || []; } catch { return []; } }
function saveSearchHistory(arr) { try { localStorage.setItem('lm_search_hist', JSON.stringify(arr)); } catch {} }

const useLibraryStore = create((set, get) => ({
  // Seed from localStorage so UI is never blank while server syncs
  playlists:     saved.playlists    || [],
  liked:         saved.liked        || [],   // array of song IDs
  recent:        saved.recent       || [],   // array of song IDs (play history)
  recentSongs:   [],                         // full song objects for Continue Listening
  searchHistory: loadSearchHistory(),        // array of search query strings
  synced:        false,
  syncing:       false,

  /* ── Full sync from server ──────────────────────────────── */
  syncFromServer: async () => {
    set({ syncing: true });
    try {
      const headers = await getHeadersAsync();
      const r = await apiFetch('/api/library', { headers });
      if (!r.ok) { set({ syncing: false }); return; }
      const d = await r.json();

      // Cache all known song objects
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

  /* ── Record a play ──────────────────────────────────────── */
  recordPlay: async (song) => {
    if (!song?.id) return;
    // Optimistic update: add to front of recent
    set(s => {
      const newRecent = [song.id, ...s.recent.filter(id => id !== song.id)].slice(0, 50);
      const newSongs  = [song, ...s.recentSongs.filter(x => x.id !== song.id)].slice(0, 12);
      saveLS({ ...loadLS(), recent: newRecent });
      return { recent: newRecent, recentSongs: newSongs };
    });
    try {
      const headers = await getHeadersAsync();
      await apiFetch('/api/library/history', {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: song.id, title: song.title, artist: song.artist, thumbnail: song.thumbnail, dur: song.dur }),
      });
    } catch {}
  },

  /* ── Toggle like ────────────────────────────────────────── */
  toggleLike: async (song) => {
    const { liked } = get();
    const id        = song?.id;
    if (!id) return null;
    const wasLiked  = liked.includes(id);

    // Optimistic update
    set({ liked: wasLiked ? liked.filter(x => x !== id) : [id, ...liked] });
    saveLS({ ...loadLS(), liked: get().liked });

    try {
      const headers = await getHeadersAsync();
      const r = await apiFetch('/api/library/likes', {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: song.id, title: song.title, artist: song.artist, thumbnail: song.thumbnail, dur: song.dur }),
      });
      if (r.ok) {
        const d = await r.json();
        return d.liked; // true = now liked, false = unliked
      }
    } catch {}
    // Rollback on failure
    set({ liked: wasLiked ? [...liked] : liked.filter(x => x !== id) });
    return null;
  },

  /* ── Create playlist ─────────────────────────────────────── */
  createPlaylist: async (name, desc = '') => {
    const headers = await getHeadersAsync();
    const r = await apiFetch('/api/library/playlists', {
      method: 'POST', headers,
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

  /* ── Edit playlist ────────────────────────────────────────── */
  editPlaylist: async (id, name, desc) => {
    const headers = await getHeadersAsync();
    await apiFetch(`/api/library/playlists/${id}`, {
      method: 'PUT', headers,
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
    const headers = await getHeadersAsync();
    await apiFetch(`/api/library/playlists/${id}`, { method: 'DELETE', headers });
    set(s => {
      const playlists = s.playlists.filter(p => p.id !== id);
      saveLS({ ...loadLS(), playlists });
      return { playlists };
    });
  },

  /* ── Add song to playlist ────────────────────────────────── */
  addToPlaylist: async (song, playlistId) => {
    const headers = await getHeadersAsync();
    const r = await apiFetch(`/api/library/playlists/${playlistId}/songs`, {
      method: 'POST', headers,
      body: JSON.stringify({ id: song.id, title: song.title, artist: song.artist, thumbnail: song.thumbnail, dur: song.dur }),
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
    const headers = await getHeadersAsync();
    await apiFetch(`/api/library/playlists/${playlistId}/songs/${songId}`, { method: 'DELETE', headers });
    set(s => {
      const playlists = s.playlists.map(p =>
        p.id === playlistId ? { ...p, songs: p.songs.filter(id => id !== songId) } : p
      );
      saveLS({ ...loadLS(), playlists });
      return { playlists };
    });
  },

  /* ── Search history ─────────────────────────────────────── */
  addSearchHistory: (query) => {
    if (!query?.trim()) return;
    set(s => {
      const arr = [query.trim(), ...s.searchHistory.filter(q => q !== query.trim())].slice(0, MAX_SEARCH_HISTORY);
      saveSearchHistory(arr);
      return { searchHistory: arr };
    });
  },
  clearSearchHistory: () => {
    saveSearchHistory([]);
    set({ searchHistory: [] });
  },
}));

/* ── Register addRecent for playerStore ────────────────────── */
_regAddRecent((id) => {
  const store = useLibraryStore.getState();
  store.recent;  // touch to ensure hydration
});

export default useLibraryStore;
