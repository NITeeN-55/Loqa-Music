import { create } from 'zustand';
import { loadLS, saveLS } from '../utils/constants.js';
import { apiFetch } from '../utils/api.js';

const useAuthStore = create((set, get) => ({
  authed:  !!loadLS().token,
  user:    loadLS().user  || null,
  token:   loadLS().token || null,
  mode:    'login',
  loading: false,
  error:   '',
  waking:  false,   // true while waiting for Render cold-start retry

  setMode:  (m) => set({ mode: m, error: '' }),
  setError: (e) => set({ error: e }),

  headers: () => {
    const { token } = get();
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  },

  _save: (user, token) => {
    const existing = loadLS();
    saveLS({ ...existing, user, token });
    set({ authed: true, user, token, error: '', loading: false, waking: false });
  },

  login: async ({ email, password }) => {
    set({ loading: true, error: '', waking: false });
    try {
      const r = await apiFetch(
        '/api/auth/login',
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email: email.trim(), password }),
        },
        { onWaking: () => set({ waking: true }) }
      );
      const d = await r.json();
      if (r.ok) { get()._save(d.user, d.token); return { ok: true }; }
      set({ loading: false, waking: false, error: d.error || 'Login failed. Check your credentials.' });
      return { ok: false, err: d.error };
    } catch {
      set({ loading: false, waking: false, error: 'Cannot reach server. Please try again.' });
      return { ok: false, err: 'network' };
    }
  },

  register: async ({ name, email, password }) => {
    set({ loading: true, error: '', waking: false });
    try {
      const r = await apiFetch(
        '/api/auth/register',
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: name.trim(), email: email.trim(), password }),
        },
        { onWaking: () => set({ waking: true }) }
      );
      const d = await r.json();
      if (r.ok) { get()._save(d.user, d.token); return { ok: true }; }
      set({ loading: false, waking: false, error: d.error || 'Registration failed.' });
      return { ok: false, err: d.error };
    } catch {
      set({ loading: false, waking: false, error: 'Cannot reach server. Please try again.' });
      return { ok: false, err: 'network' };
    }
  },

  logout: () => {
    const { theme, volume, eqBands, eqPreset, eqEnabled } = loadLS();
    saveLS({ theme, volume, eqBands, eqPreset, eqEnabled });
    set({ authed: false, user: null, token: null, error: '', loading: false, waking: false });
  },

  updateProfile: async (name) => {
    const { headers } = get();
    set({ loading: true, error: '' });
    try {
      const r = await apiFetch('/api/auth/me', {
        method:  'PUT',
        headers: headers(),
        body:    JSON.stringify({ name: name.trim() }),
      });
      const d = await r.json();
      set({ loading: false });
      if (r.ok) {
        const updated = { ...get().user, name: name.trim() };
        saveLS({ ...loadLS(), user: updated });
        set({ user: updated });
        return { ok: true };
      }
      return { ok: false, err: d.error || 'Update failed' };
    } catch {
      set({ loading: false });
      return { ok: false, err: 'Cannot reach server' };
    }
  },

  changePassword: async (current, next) => {
    const { headers } = get();
    set({ loading: true, error: '' });
    try {
      const r = await apiFetch('/api/auth/password', {
        method:  'PUT',
        headers: headers(),
        body:    JSON.stringify({ current, next }),
      });
      const d = await r.json();
      set({ loading: false });
      if (r.ok) return { ok: true };
      return { ok: false, err: d.error || 'Password change failed' };
    } catch {
      set({ loading: false });
      return { ok: false, err: 'Cannot reach server' };
    }
  },

  refresh: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const r = await apiFetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const user = await r.json();
        set({ user });
        saveLS({ ...loadLS(), user });
      } else if (r.status === 401) {
        get().logout();
      }
    } catch { /* network unavailable — keep current state */ }
  },
}));

export default useAuthStore;
