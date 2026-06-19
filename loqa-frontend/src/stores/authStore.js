import { create } from 'zustand';
import { loadLS, saveLS } from '../utils/constants.js';
import { apiFetch } from '../utils/api.js';

/**
 * Auth store — updated for HttpOnly cookie + refresh token flow.
 *
 * Security improvement (audit P10):
 *  - Access token now lives in HttpOnly cookie (set by server) → XSS-safe
 *  - Refresh token also HttpOnly cookie → 30-day sessions without re-login
 *  - localStorage still used for user profile data (non-sensitive)
 *  - Bearer header kept as fallback during transition period
 *
 * Token is returned in response body AND cookie — store uses it for
 * the Authorization header fallback while browsers adopt cookie path.
 */

const useAuthStore = create((set, get) => ({
  authed:  !!loadLS().token,
  user:    loadLS().user  || null,
  token:   loadLS().token || null,  // kept for legacy Bearer fallback
  mode:    'login',
  loading: false,
  error:   '',
  waking:  false,

  setMode:  (m) => set({ mode: m, error: '' }),
  setError: (e) => set({ error: e }),

  headers: () => {
    const { token } = get();
    // Cookies are sent automatically; include Bearer as fallback for old clients
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
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',   // send/receive cookies
          body:        JSON.stringify({ email: email.trim(), password }),
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
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify({ name: name.trim(), email: email.trim(), password }),
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

  logout: async () => {
    // Tell server to clear the HttpOnly cookies
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch { /* ignore network errors on logout */ }
    const { theme, volume, eqBands, eqPreset, eqEnabled } = loadLS();
    saveLS({ theme, volume, eqBands, eqPreset, eqEnabled });
    set({ authed: false, user: null, token: null, error: '', loading: false, waking: false });
  },

  /**
   * refreshSession — called by apiFetch on 401 to transparently renew access token.
   * Uses the HttpOnly refresh cookie automatically via credentials: 'include'.
   */
  refreshSession: async () => {
    try {
      const r = await fetch('/api/auth/refresh', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
      });
      if (r.ok) {
        const d = await r.json();
        // Update legacy token in store/localStorage
        if (d.token) {
          const existing = loadLS();
          saveLS({ ...existing, token: d.token });
          set({ token: d.token });
        }
        return true;
      }
    } catch { /* network error */ }
    // Refresh failed — log out
    get().logout();
    return false;
  },

  updateProfile: async (name) => {
    const { headers } = get();
    set({ loading: true, error: '' });
    try {
      const r = await apiFetch('/api/auth/me', {
        method: 'PUT', headers: headers(), credentials: 'include',
        body: JSON.stringify({ name: name.trim() }),
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
        method: 'PUT', headers: headers(), credentials: 'include',
        body: JSON.stringify({ current, next }),
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

  // Re-validate session on app start — also re-hydrates user profile
  refresh: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const r = await apiFetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (r.ok) {
        const user = await r.json();
        set({ user });
        saveLS({ ...loadLS(), user });
      } else if (r.status === 401) {
        // Try refresh token before logging out
        const refreshed = await get().refreshSession();
        if (!refreshed) get().logout();
      }
    } catch { /* network unavailable — keep current state */ }
  },
}));

export default useAuthStore;
