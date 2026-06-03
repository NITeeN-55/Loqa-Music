/**
 * libraryStore — syncs playlists, likes and history with MongoDB backend.
 * Loads liked IDs from localStorage immediately so the UI isn't empty
 * while waiting for the server sync.
 */
import { create } from 'zustand';
import { loadLS, saveLS, cacheSong } from '../utils/constants.js';
import { _regAddRecent } from './playerStore.js';

const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'https://loqa-music.onrender.com';

function getHeaders() {
  try {
    const token = JSON.parse(localStorage.getItem('lm2'))?.token;
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  } catch { return { 'Content-Type': 'application/json' }; }
}

const saved = loadLS();

const useLibraryStore = create((set, get) => ({
  // Seed from localStorage so UI is never blank while server syncs
  playlists: saved.playlists || [],
  liked:     saved.liked     || [],   // array of song IDs
  recent:    saved.recent    || [],
  synced:    false,
  syncing:   false,

  /* ── Full sync from server ─────────────────────────── */
  syncFromServer: async () => {
    set({ syncing: true });
    try {
      const r = await fetch(`${API}/api/library`, { headers: getHeaders() });
      if (!r.ok) { set({ syncing: false }); return; }
      const d = await r.json();

      // Cache all known song objects
      d.liked.forEach(s => cacheSong(s));
      d.history.forEach(s => cacheSong(s));

      const likedIds   = d.liked.map(s => s.id);
      const recentIds  = d.history.map(s => s.id);

      set({
        playlists: d.playlists,
        liked:     likedIds,
        recent:    recentIds,
        synced:    true,
        syncing:   false,
      });

      // Persist for next session
      saveLS({ ...loadLS(), playlists: d.playlists, liked: likedIds, recent: recentIds });
    } catch (e) {
      console.warn('[Library] sync failed:', e.message);
      set({ syncing: false });
    }
  },

  /* ── Recently played (local + server) ─────────────── */
  addRecent: (id) => {
    if (!id) return;
    set(s => {
      const recent = [id, ...s.recent.filter(x => x !== id)].slice(0, 50);
      saveLS({ ...loadLS(), recent });
      return { recent };
    });
  },

  recordPlay: async (song) => {
    if (!song?.id) return;
    get().addRecent(song.id);
    try {
      await fetch(`${API}/api/library/history`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(song),
      });
    } catch {}
  },

  /* ── Like / Unlike ─────────────────────────────────── */
  toggleLike: async (song) => {
    const id = typeof song === 'string' ? song : song?.id;
    if (!id) return false;

    const wasLiked = get().liked.includes(id);

    // Optimistic update
    set(s => {
      const liked = wasLiked ? s.liked.filter(x => x !== id) : [...s.liked, id];
      saveLS({ ...loadLS(), liked });
      return { liked };
    });

    try {
      // Build a proper song object even if only ID was passed
      const songObj = typeof song === 'object' ? song : { id };
      await fetch(`${API}/api/library/likes`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(songObj),
      });
    } catch {
      // Roll back on network failure
      set(s => {
        const liked = wasLiked ? [...s.liked, id] : s.liked.filter(x => x !== id);
        saveLS({ ...loadLS(), liked });
        return { liked };
      });
    }

    return !wasLiked; // new liked state
  },

  isLiked: (id) => get().liked.includes(id),

  /* ── Playlists CRUD ─────────────────────────────────── */
  createPlaylist: async (name, desc = '') => {
    const ci = get().playlists.length % 8;
    // Optimistic local creation
    const tempId = `temp_${Date.now()}`;
    const tempPl = { id: tempId, name, desc, ci, songs: [], createdAt: new Date().toISOString() };
    set(s => {
      const playlists = [tempPl, ...s.playlists];
      saveLS({ ...loadLS(), playlists });
      return { playlists };
    });

    try {
      const r = await fetch(`${API}/api/library/playlists`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ name, desc, ci }),
      });
      if (r.ok) {
        const pl = await r.json();
        // Replace temp with real server playlist
        set(s => {
          const playlists = s.playlists.map(p => p.id === tempId ? { ...pl, songs: [] } : p);
          saveLS({ ...loadLS(), playlists });
          return { playlists };
        });
        return pl;
      }
    } catch {}
    return tempPl;
  },

  editPlaylist: async (id, name, desc) => {
    set(s => {
      const playlists = s.playlists.map(p => p.id === id ? { ...p, name, desc } : p);
      saveLS({ ...loadLS(), playlists });
      return { playlists };
    });
    try {
      await fetch(`${API}/api/library/playlists/${id}`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify({ name, desc }),
      });
    } catch {}
  },

  deletePlaylist: async (id) => {
    set(s => {
      const playlists = s.playlists.filter(p => p.id !== id);
      saveLS({ ...loadLS(), playlists });
      return { playlists };
    });
    try {
      await fetch(`${API}/api/library/playlists/${id}`, {
        method: 'DELETE', headers: getHeaders(),
      });
    } catch {}
  },

  addToPlaylist: async (song, playlistId) => {
    const id  = typeof song === 'string' ? song : song?.id;
    if (!id) return '';

    let name = '';
    set(s => {
      const playlists = s.playlists.map(p => {
        if (p.id === playlistId && !p.songs.includes(id)) {
          name = p.name;
          return { ...p, songs: [...p.songs, id] };
        }
        return p;
      });
      saveLS({ ...loadLS(), playlists });
      return { playlists };
    });

    // Cache the song so playlist view can show it
    if (typeof song === 'object') cacheSong(song);

    try {
      await fetch(`${API}/api/library/playlists/${playlistId}/songs`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify(typeof song === 'object' ? song : { id }),
      });
    } catch {}
    return name;
  },

  removeFromPlaylist: async (songId, playlistId) => {
    set(s => {
      const playlists = s.playlists.map(p =>
        p.id === playlistId ? { ...p, songs: p.songs.filter(x => x !== songId) } : p
      );
      saveLS({ ...loadLS(), playlists });
      return { playlists };
    });
    try {
      await fetch(`${API}/api/library/playlists/${playlistId}/songs/${songId}`, {
        method: 'DELETE', headers: getHeaders(),
      });
    } catch {}
  },
}));

_regAddRecent(useLibraryStore.getState().addRecent);
export default useLibraryStore;
