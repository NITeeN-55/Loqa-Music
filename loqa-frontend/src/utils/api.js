/**
 * Centralized API client for Loqa Music.
 *
 * All fetch calls go through `apiFetch()` which handles:
 *  - Correct base URL in dev (Vite proxy) and production (Render)
 *  - Render free-tier cold-start: auto-retry once after 3 s if the
 *    first attempt times out or fails with a network error
 *  - Consistent error shape so stores don't need their own try/catch boilerplate
 */

// Vite replaces import.meta.env.VITE_API_URL at build time.
// In production the value is baked in; the fallback is a safety net.
export const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  'https://loqa-music.onrender.com';

// How long to wait before giving up on a single attempt (ms)
const TIMEOUT_MS = 12_000;
// How long to wait before the retry attempt (Render wake-up buffer)
const RETRY_DELAY_MS = 4_000;
// Total retries on network-level failure (not 4xx/5xx)
const MAX_RETRIES = 1;

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      controller.signal.addEventListener('abort', () =>
        reject(Object.assign(new Error('Request timed out'), { isTimeout: true }))
      )
    ),
  ]).finally(() => clearTimeout(id));
}

/**
 * Drop-in replacement for fetch() that adds timeout + one cold-start retry.
 *
 * @param {string} path   - e.g. '/api/auth/login'
 * @param {object} init   - standard fetch init (method, headers, body …)
 * @param {object} opts
 * @param {number} opts.retries  - remaining retries (default MAX_RETRIES)
 * @param {function} opts.onWaking - called when we detect a cold-start retry
 */
export async function apiFetch(path, init = {}, { retries = MAX_RETRIES, onWaking } = {}) {
  const url = `${API_BASE}${path}`;
  try {
    const res = await withTimeout(fetch(url, init), TIMEOUT_MS);
    return res; // caller checks res.ok
  } catch (err) {
    // Only retry on network errors / timeouts, not on 4xx/5xx
    const isNetwork = err.isTimeout || err instanceof TypeError;
    if (isNetwork && retries > 0) {
      onWaking?.(); // signal UI that we're waiting for Render to wake
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      return apiFetch(path, init, { retries: retries - 1, onWaking });
    }
    throw err;
  }
}
