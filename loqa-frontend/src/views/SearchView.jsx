import React, { useState, useEffect, useRef, useCallback } from 'react';
import { gradStr, fmtTime, fmtViews, cacheSong, getCachedSong } from '../utils/constants.js';
import { Svg, I, EqBars, Spinner } from '../components/Icons.jsx';
import { Thumb, SongRow, SongCard, Section, HScroll } from '../components/UI.jsx';
import { searchYT, getTrending, getGenre, getSuggestions } from '../utils/youtubeApi.js';
import useLibraryStore from '../stores/libraryStore.js';

const GENRES = ['Pop Hits','Hip Hop','R&B Soul','Rock Classics','Electronic','Bollywood','Jazz & Blues','Lo-Fi Chill','K-Pop','Latin','Indie','Country','Reggae','Afrobeats','Classical'];
export function SearchView({ C, song: cur, playing, liked, onPlay, onLike, onCtx, initialQ = '' }) {
  const [q, setQ]               = useState(initialQ);
  const [results, setResults]   = useState([]);
  const [suggestions, setSugg]  = useState([]);
  const [loading, setLoading]   = useState(false);
  const [showSug, setShowSug]   = useState(false);
  const inputRef = useRef(null);
  const debRef   = useRef(null);

  // Search history stored in localStorage
  const [searchHistory, setSearchHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lm_search_hist') || '[]'); } catch { return []; }
  });

  const addToHistory = (query) => {
    if (!query.trim()) return;
    const updated = [query, ...searchHistory.filter(h => h !== query)].slice(0, 10);
    setSearchHistory(updated);
    localStorage.setItem('lm_search_hist', JSON.stringify(updated));
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('lm_search_hist');
  };

  useEffect(() => {
    setLoading(true);
    if (initialQ) doSearch(initialQ);
    else getTrending().then(t => { setResults(t); setLoading(false); });
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const doSearch = async (query) => {
    if (!query.trim()) return;
    setLoading(true); setShowSug(false);
    addToHistory(query.trim());
    const r = await searchYT(query);
    r.forEach(cacheSong);
    setResults(r); setLoading(false);
  };

  // Voice search via Web Speech API
  const [voiceActive, setVoiceActive] = useState(false);
  const startVoiceSearch = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Voice search is not supported in this browser.'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setVoiceActive(true);
    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setQ(text);
      doSearch(text);
      setVoiceActive(false);
    };
    recognition.onerror = () => setVoiceActive(false);
    recognition.onend   = () => setVoiceActive(false);
    recognition.start();
  }, [doSearch]); // eslint-disable-line

  const onInput = (v) => {
    setQ(v);
    clearTimeout(debRef.current);
    if (v.length > 1) {
      debRef.current = setTimeout(async () => {
        const s = await getSuggestions(v);
        setSugg(s); setShowSug(s.length > 0);
      }, 280);
    } else { setSugg([]); setShowSug(false); }
  };

  return (
    <div>
      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
          background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 14,
          boxShadow: '0 4px 24px rgba(0,0,0,.1)' }}>
          <Svg d={I.search} size={18} stroke={C.text3} />
          <input ref={inputRef} value={q} onChange={e => onInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); doSearch(q); setShowSug(false); } if (e.key === 'Escape') setShowSug(false); }}
            onFocus={() => (suggestions.length || (!q && searchHistory.length)) && setShowSug(true)}
            placeholder="Search songs, artists, albums…" aria-label="Search music"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 16, padding: '14px 0', fontFamily: 'inherit' }} />
          {q && <button onClick={() => { setQ(''); setResults([]); setShowSug(false); inputRef.current?.focus(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 4 }}>
            <Svg d={I.close} size={16} stroke="currentColor" />
          </button>}
          {/* Microphone button for voice search */}
          {'webkitSpeechRecognition' in window || 'SpeechRecognition' in window ? (
            <button onClick={startVoiceSearch} aria-label="Voice search"
              title="Search by voice"
              style={{ background: voiceActive ? `rgba(${C.accentRgb || '124,111,255'},.2)` : 'none',
                border: 'none', cursor: 'pointer', color: voiceActive ? C.accent : C.text3, padding: 6,
                borderRadius: 8, transition: 'all .2s', display: 'flex', alignItems: 'center' }}>
              {voiceActive
                ? <div style={{ width: 16, height: 16, borderRadius: '50%', background: C.accent,
                    animation: 'pulse 1s ease infinite' }} />
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
              }
            </button>
          ) : null}
          <button onClick={() => doSearch(q)}
            style={{ background: gradStr(0), border: 'none', borderRadius: 10, padding: '8px 16px',
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
            Search
          </button>
        </div>

        {/* Suggestions / History dropdown */}
        {showSug && (suggestions.length > 0 || (!q && searchHistory.length > 0)) && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface,
            border: `1px solid ${C.border}`, borderRadius: 12, marginTop: 4, zIndex: 100,
            boxShadow: '0 8px 32px rgba(0,0,0,.2)', overflow: 'hidden' }}>
            {/* Autocomplete suggestions */}
            {suggestions.map((s, i) => (
              <button key={`sug-${i}`} onClick={() => { setQ(s); doSearch(s); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px',
                  background: 'none', border: 'none', cursor: 'pointer', color: C.text, fontSize: 14, textAlign: 'left', fontFamily: 'inherit' }}
                onMouseEnter={e => e.currentTarget.style.background = C.bg3}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <Svg d={I.search} size={14} stroke={C.text3} />{s}
              </button>
            ))}
            {/* Recent searches (shown when input is empty) */}
            {!q && searchHistory.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 16px 4px', borderTop: suggestions.length ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ fontSize: 11, color: C.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Recent Searches
                  </span>
                  <button onClick={clearHistory}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 11, padding: '2px 4px' }}>
                    Clear
                  </button>
                </div>
                {searchHistory.map((h, i) => (
                  <button key={`hist-${i}`} onClick={() => { setQ(h); doSearch(h); setShowSug(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 16px',
                      background: 'none', border: 'none', cursor: 'pointer', color: C.text2, fontSize: 14, textAlign: 'left', fontFamily: 'inherit' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.bg3}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <Svg d={I.back} size={13} stroke={C.text3} />
                    {h}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>}
      {!loading && results.length > 0 && (
        <Section title={q ? `Results for "${q}"` : 'Trending'} C={C}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {results.map((s, i) => (
              <SongRow key={s.id} song={s} idx={i} current={cur} playing={playing}
                liked={liked.includes(s.id)}
                onPlay={t => onPlay(t, { toggle: true, list: results, source: 'search' })}
                onLike={onLike} onCtx={onCtx} C={C} />
            ))}
          </div>
        </Section>
      )}
      {!loading && !results.length && q && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.text2 }}>
          <Svg d={I.search} size={48} stroke={C.text3} /><br /><br />
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>No results found</div>
          <div>Try different keywords</div>
        </div>
      )}
    </div>
  );
}

/* ── Genre ────────────────────────────────────────────── */

export default SearchView;
