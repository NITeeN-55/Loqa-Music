/**
 * YouTube API client — all calls go through the Express backend proxy.
 * Dev: Vite proxies /api → localhost:3000
 * Prod: uses VITE_API_URL env var
 */
const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';

function normalise(items = [], source = 'youtube') {
  const seen = new Set();
  return items
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
      source,
    }))
    .filter(t => {
      if (!t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
}

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export const searchYT      = async q    => { try { return normalise((await get(`/api/youtube/search?q=${encodeURIComponent(q)}`)).items, 'search');   } catch { return []; } };
export const getTrending   = async ()   => { try { return normalise((await get('/api/youtube/trending')).items, 'trending');                            } catch { return []; } };
export const getRelated    = async id   => { try { return normalise((await get(`/api/youtube/related?v=${encodeURIComponent(id)}`)).items, 'related'); } catch { return []; } };
export const getSuggestions= async q    => { try { return (await get(`/api/youtube/suggestions?q=${encodeURIComponent(q)}`)).suggestions || [];        } catch { return []; } };
export const getGenre      = async g    => { try { return normalise((await get(`/api/youtube/genre?g=${encodeURIComponent(g)}`)).items, 'genre');       } catch { return []; } };
