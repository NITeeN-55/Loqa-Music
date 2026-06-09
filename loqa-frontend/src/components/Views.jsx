/**
 * Views.jsx v5 — All page views.
 *
 * CHANGES v5:
 *  ✓ HomeView: Continue Listening grid, Made For You, lazy genre loading via IntersectionObserver
 *  ✓ SearchView: search history, voice search, trending chips, categories
 *  ✓ LibraryView: improved empty state with CTA
 *  ✓ PlaylistDetailView: better empty state, total duration
 *  ✓ All views: React.memo for performance
 */
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { gradStr, fmtTime, fmtViews, cacheSong, getCachedSong } from '../utils/constants.js';
import { Svg, I, EqBars, Spinner } from './Icons.jsx';
import { Thumb, SongRow, SongCard, Section, HScroll } from './UI.jsx';
import { searchYT, getTrending, getGenre, getSuggestions } from '../utils/youtubeApi.js';

const GENRES = [
  'Pop Hits','Hip Hop','R&B Soul','Rock Classics','Electronic',
  'Bollywood','Jazz & Blues','Lo-Fi Chill','K-Pop','Latin',
  'Indie','Country','Reggae','Afrobeats','Classical',
];

const GENRE_EMOJIS = {
  'Pop Hits':'🎵','Hip Hop':'🎤','R&B Soul':'💜','Rock Classics':'🎸',
  'Electronic':'⚡','Bollywood':'🎬','Jazz & Blues':'🎷','Lo-Fi Chill':'☕',
  'K-Pop':'✨','Latin':'🌴','Indie':'🌿','Country':'🤠','Reggae':'🌊',
  'Afrobeats':'🥁','Classical':'🎻',
};

/* ─── Lazy Genre Row ──────────────────────────────────────────
   Only fetches songs when the row scrolls into view.
──────────────────────────────────────────────────────────── */
const LazyGenreRow = memo(function LazyGenreRow({ genre, C, cur, playing, liked, onPlay, onLike, onCtx, go }) {
  const [songs, setSongs]     = useState([]);
  const [loaded, setLoaded]   = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const likedSet = useMemo(() => new Set(Array.isArray(liked) ? liked.map(s => typeof s === 'string' ? s : s?.id) : []), [liked]);

  useEffect(() => {
    if (loaded) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { obs.disconnect(); load(); } },
      { rootMargin: '200px' }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [loaded]); // eslint-disable-line

  const load = useCallback(async () => {
    if (loaded || loading) return;
    setLoading(true);
    const t = await getGenre(genre);
    t.forEach(cacheSong);
    setSongs(t);
    setLoaded(true);
    setLoading(false);
  }, [genre, loaded, loading]);

  if (!loaded && !loading) return (
    <div ref={ref} style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: C.text3 }}>{GENRE_EMOJIS[genre] || '🎵'} {genre}</div>
    </div>
  );

  return (
    <div ref={ref}>
      <Section title={`${GENRE_EMOJIS[genre] || '🎵'} ${genre}`} C={C} action="More" onAction={() => go('genre', { genre })}>
        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner size={24} /></div>
          : <HScroll>
              {songs.slice(0, 12).map(s => (
                <SongCard key={s.id} song={s} current={cur} playing={playing}
                  liked={likedSet.has(s.id)}
                  onPlay={t => onPlay(t, { toggle: true, list: songs, source: 'genre' })}
                  onLike={onLike} onCtx={onCtx} C={C} />
              ))}
            </HScroll>
        }
      </Section>
    </div>
  );
});

/* ─── Continue Listening Grid ─────────────────────────────── */
const ContinueListeningGrid = memo(function ContinueListeningGrid({ songs, cur, playing, onPlay, C, isMobile }) {
  if (!songs?.length) return null;
  const items = songs.slice(0, isMobile ? 4 : 6);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
      gap: 8, marginBottom: 28,
    }}>
      {items.map(s => {
        const isActive = cur?.id === s.id;
        return (
          <button key={s.id}
            onClick={() => onPlay(s, { toggle: true, source: 'recent' })}
            aria-label={`Play ${s.title}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 12,
              background: isActive ? `rgba(${C.accentRgb},.15)` : C.surface,
              border: `1px solid ${isActive ? C.accent : C.border}`,
              cursor: 'pointer', color: C.text,
              textAlign: 'left', fontFamily: 'inherit',
              overflow: 'hidden', transition: 'all .15s',
              minHeight: 64,
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.surface2; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = C.surface; }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Thumb song={s} size={44} radius={8} playing={false} />
              {isActive && playing && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.45)', borderRadius: 8 }}>
                  <EqBars size={14} color="#fff" playing={true} />
                </div>
              )}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? C.accent : C.text, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3 }}>
              {s.title}
            </span>
          </button>
        );
      })}
    </div>
  );
});

/* ─── Home View ───────────────────────────────────────────── */
export const HomeView = memo(function HomeView({
  C, song: cur, playing, liked, onPlay, onPlayAll, onLike, onCtx, go, isMobile,
  recommendations, recsLoading, recsBasedOn, onRefreshRecs,
  recentSongs,   // full song objects for Continue Listening
}) {
  const [trending,  setTrending]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  // PERFORMANCE FIX: O(1) liked lookup
  const likedSet = useMemo(() => new Set(liked.map(s => typeof s === 'string' ? s : s?.id)), [liked]);

  useEffect(() => {
    getTrending().then(t => { t.forEach(cacheSong); setTrending(t); setLoading(false); });
  }, []);

  const hour     = new Date().getHours();
  const greeting = hour < 5 ? 'Night' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  return (
    <div style={{ minWidth: 0 }}>

      {/* ── Continue Listening (hero replacement when user has history) ── */}
      {recentSongs?.length > 0 ? (
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: C.text, margin: '0 0 16px' }}>
            Good {greeting} 👋
          </h1>
          <ContinueListeningGrid
            songs={recentSongs} cur={cur} playing={playing}
            onPlay={onPlay} C={C} isMobile={isMobile}
          />
        </div>
      ) : (
        /* ── First-run hero ──────────────────────────────────────── */
        <div style={{
          borderRadius: isMobile ? 16 : 20,
          background: `linear-gradient(135deg,${C.bg3},${C.bg2})`,
          padding: isMobile ? '20px 18px' : '36px 40px',
          marginBottom: isMobile ? 24 : 32,
          position: 'relative', overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300, borderRadius: '50%', background: gradStr(0), opacity: .07, filter: 'blur(50px)' }} />
          <h1 style={{ fontSize: isMobile ? 20 : 32, fontWeight: 900, color: C.text, margin: '0 0 6px' }}>
            Good {greeting} 🎵
          </h1>
          <p style={{ color: C.text2, fontSize: isMobile ? 13 : 14, margin: '0 0 16px' }}>
            Your personal music stream — start playing to personalise your feed
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => go('search')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '10px 18px' : '11px 20px', background: gradStr(0), border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: isMobile ? 12 : 13, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>
              <Svg d={I.search} size={15} stroke="#fff" /> Discover Music
            </button>
            <button onClick={() => go('local')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '10px 18px' : '11px 20px', background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontWeight: 600, fontSize: isMobile ? 12 : 13, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>
              📁 Local Files
            </button>
          </div>
        </div>
      )}

      {/* ── Made For You / Recommendations ────────────────────────── */}
      {(recommendations?.length > 0 || recsLoading) && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
                ⭐ Made For You
              </h2>
              {recsBasedOn?.length > 0 && !recsLoading && (
                <p style={{ fontSize: 12, color: C.text3, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? '100%' : 340 }}>
                  Based on: {recsBasedOn.slice(0, isMobile ? 2 : 3).join(' · ')}
                </p>
              )}
            </div>
            <button onClick={onRefreshRecs} disabled={recsLoading} aria-label="Refresh recommendations"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', flexShrink: 0, minHeight: 36, background: recsLoading ? C.bg3 : `rgba(${C.accentRgb},.12)`, border: `1px solid ${recsLoading ? C.border : C.accent}`, borderRadius: 10, cursor: recsLoading ? 'wait' : 'pointer', color: recsLoading ? C.text3 : C.accent, fontWeight: 600, fontSize: 12, fontFamily: 'inherit', transition: 'all .15s' }}>
              <span style={{ display: 'inline-block', animation: recsLoading ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
              {recsLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {recsLoading
            ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={28} /></div>
            : <HScroll>
                {recommendations.slice(0, 18).map(s => (
                  <SongCard key={s.id} song={s} current={cur} playing={playing}
                    liked={likedSet.has(s.id)}
                    onPlay={t => onPlay(t, { toggle: true, list: recommendations, source: 'recommendations' })}
                    onLike={onLike} onCtx={onCtx} C={C} />
                ))}
              </HScroll>
          }
        </div>
      )}

      {/* ── Trending Now ─────────────────────────────────────────── */}
      <Section title="🔥 Trending Now" C={C} action="See all" onAction={() => go('search', { searchQ: 'trending music 2025' })}>
        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={32} /></div>
          : <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 2 : 4 }}>
              {trending.slice(0, isMobile ? 6 : 10).map((s, i) => (
                <SongRow key={s.id} song={s} idx={i} current={cur} playing={playing}
                  liked={likedSet.has(s.id)}
                  onPlay={t => onPlay(t, { toggle: true, list: trending, source: 'trending' })}
                  onLike={onLike} onCtx={onCtx} C={C} isMobile={isMobile} />
              ))}
            </div>
        }
      </Section>

      {/* ── Genre rows (lazy loaded) ─────────────────────────────── */}
      {GENRES.map(genre => (
        <LazyGenreRow key={genre} genre={genre} C={C} cur={cur} playing={playing}
          liked={liked} onPlay={onPlay} onLike={onLike} onCtx={onCtx} go={go} />
      ))}

      {/* ── Browse Genres grid ───────────────────────────────────── */}
      <Section title="Browse Genres" C={C}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isMobile ? 8 : 10 }}>
          {GENRES.map((g, i) => (
            <button key={g} onClick={() => go('genre', { genre: g })}
              style={{ padding: isMobile ? '14px 10px' : '18px 14px', borderRadius: 12, background: gradStr(i), border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: isMobile ? 12 : 13, textAlign: 'left', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.12)', minHeight: 44, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{GENRE_EMOJIS[g]}</span> {g}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
});

/* ─── Search View ─────────────────────────────────────────── */
export const SearchView = memo(function SearchView({
  C, song: cur, playing, liked, onPlay, onLike, onCtx,
  initialQ = '',
  searchHistory = [],
  onAddSearchHistory,
  onClearSearchHistory,
  isMobile,
}) {
  const [q, setQ]             = useState(initialQ);
  const [results, setResults] = useState([]);
  const [suggestions, setSugg] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSug, setShowSug] = useState(false);
  const likedSet = useMemo(() => new Set(Array.isArray(liked) ? liked.map(s => typeof s === 'string' ? s : s?.id) : []), [liked]);
  const [showHistory, setShowHistory] = useState(!initialQ);
  const inputRef = useRef(null);
  const debRef   = useRef(null);

  const TRENDING_CHIPS = ['Trending', 'New Releases', 'Lo-Fi Chill', 'Bollywood Hits', 'Hip Hop', 'K-Pop', 'Indie Vibes'];

  useEffect(() => {
    if (initialQ) { doSearch(initialQ); }
    else { getTrending().then(t => { t.forEach(cacheSong); setResults(t); }); }
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []); // eslint-disable-line

  const doSearch = useCallback(async (query) => {
    if (!query?.trim()) return;
    setLoading(true); setShowSug(false); setShowHistory(false);
    onAddSearchHistory?.(query.trim());
    const r = await searchYT(query);
    r.forEach(cacheSong);
    setResults(r);
    setLoading(false);
  }, [onAddSearchHistory]);

  const onInput = (v) => {
    setQ(v);
    setShowHistory(v.length === 0);
    clearTimeout(debRef.current);
    if (v.length > 1) {
      debRef.current = setTimeout(async () => {
        const s = await getSuggestions(v);
        setSugg(s); setShowSug(s.length > 0);
      }, 280);
    } else { setSugg([]); setShowSug(false); }
  };

  /* ── Voice search (Web Speech API) ─────────────────────── */
  const startVoiceSearch = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setQ(text); doSearch(text);
    };
    r.start();
  };

  const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  return (
    <div style={{ minWidth: 0 }}>
      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 14, boxShadow: '0 4px 24px rgba(0,0,0,.1)' }}>
          <Svg d={I.search} size={18} stroke={C.text3} style={{ flexShrink: 0 }} />
          <input ref={inputRef} value={q} onChange={e => onInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  { e.stopPropagation(); doSearch(q); setShowSug(false); }
              if (e.key === 'Escape') { setShowSug(false); setShowHistory(true); }
            }}
            onFocus={() => { if (q.length === 0) setShowHistory(true); else if (suggestions.length) setShowSug(true); }}
            placeholder="Songs, artists, albums…" aria-label="Search music"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 15, padding: '14px 0', fontFamily: 'inherit', minWidth: 0 }} />
          {q
            ? <button onClick={() => { setQ(''); setSugg([]); setShowSug(false); setShowHistory(true); inputRef.current?.focus(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 6, flexShrink: 0, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Svg d={I.close} size={15} stroke="currentColor" />
              </button>
            : hasSpeechAPI && (
                <button onClick={startVoiceSearch} aria-label="Search by voice" title="Voice search"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 6, flexShrink: 0, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Svg d={I.mic} size={16} stroke="currentColor" />
                </button>
              )
          }
          <button onClick={() => doSearch(q)}
            style={{ background: gradStr(0), border: 'none', borderRadius: 10, padding: '8px 14px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', minHeight: 36 }}>
            Search
          </button>
        </div>

        {/* Autocomplete suggestions */}
        {showSug && suggestions.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, marginTop: 4, zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,.2)', overflow: 'hidden' }}>
            {suggestions.slice(0, 7).map((s, i) => (
              <button key={i} onClick={() => { setQ(s); doSearch(s); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 16px', minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', color: C.text, fontSize: 14, textAlign: 'left', fontFamily: 'inherit' }}
                onMouseEnter={e => e.currentTarget.style.background = C.bg3}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <Svg d={I.search} size={13} stroke={C.text3} />
                <span>{s}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Pre-search state: history + trending chips ── */}
      {showHistory && !loading && (
        <div>
          {/* Search history */}
          {searchHistory.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Recent Searches</span>
                <button onClick={onClearSearchHistory}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.text3, fontFamily: 'inherit', padding: '4px 8px' }}>
                  Clear
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {searchHistory.map((h, i) => (
                  <button key={i} onClick={() => { setQ(h); doSearch(h); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 99, cursor: 'pointer', color: C.text2, fontSize: 13, fontFamily: 'inherit' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                    <Svg d={I.search} size={12} stroke="currentColor" />{h}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Trending chips */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Trending</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TRENDING_CHIPS.map((chip, i) => (
                <button key={chip} onClick={() => { setQ(chip); doSearch(chip); }}
                  style={{ padding: '8px 16px', background: gradStr(i % 8), border: 'none', borderRadius: 99, cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.15)' }}>
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>}
      {!loading && results.length > 0 && (
        <Section title={q ? `Results for "${q}"` : '🔥 Trending'} C={C}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {results.map((s, i) => (
              <SongRow key={s.id} song={s} idx={i} current={cur} playing={playing}
                liked={likedSet.has(s.id)}
                onPlay={t => onPlay(t, { toggle: true, list: results, source: 'search' })}
                onLike={onLike} onCtx={onCtx} C={C} />
            ))}
          </div>
        </Section>
      )}
      {!loading && !results.length && q && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.text2 }}>
          <Svg d={I.search} size={48} stroke={C.text3} />
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '16px 0 8px' }}>No results for "{q}"</div>
          <div style={{ marginBottom: 20, fontSize: 14 }}>Try different keywords or check the spelling</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {TRENDING_CHIPS.slice(0, 4).map((chip, i) => (
              <button key={chip} onClick={() => { setQ(chip); doSearch(chip); }}
                style={{ padding: '8px 16px', background: gradStr(i), border: 'none', borderRadius: 99, cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

/* ─── Genre View ──────────────────────────────────────────── */
export const GenreView = memo(function GenreView({ C, genre, song: cur, playing, liked, onPlay, onLike, onCtx, onBack }) {
  const [songs, setSongs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const likedSet = useMemo(() => new Set(Array.isArray(liked) ? liked.map(s => typeof s === 'string' ? s : s?.id) : []), [liked]);
  useEffect(() => {
    setLoading(true);
    getGenre(genre).then(t => { t.forEach(cacheSong); setSongs(t); setLoading(false); });
  }, [genre]);
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button onClick={onBack} aria-label="Back"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 8, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Svg d={I.back} size={22} stroke="currentColor" />
        </button>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          {GENRE_EMOJIS[genre] || '🎵'} {genre}
        </h2>
      </div>
      {loading
        ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {songs.map((s, i) => (
              <SongRow key={s.id} song={s} idx={i} current={cur} playing={playing}
                liked={likedSet.has(s.id)}
                onPlay={t => onPlay(t, { toggle: true, list: songs, source: 'genre' })}
                onLike={onLike} onCtx={onCtx} C={C} />
            ))}
          </div>
      }
    </div>
  );
});

/* ─── Library View ────────────────────────────────────────── */
export const LibraryView = memo(function LibraryView({ C, playlists, liked, onOpen, onDelete, onEdit, onCreate, go }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: 0 }}>Your Library</h2>
        <button onClick={onCreate}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', minHeight: 44, background: gradStr(0), border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          <Svg d={I.plus} size={14} stroke="#fff" />New Playlist
        </button>
      </div>

      {/* Liked Songs */}
      <div onClick={() => onOpen({ id: 'liked', name: 'Liked Songs', songs: liked, ci: 1 })}
        role="button" tabIndex={0} aria-label="Open Liked Songs"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen({ id: 'liked', name: 'Liked Songs', songs: liked, ci: 1 }); } }}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 12, cursor: 'pointer', overflow: 'hidden', minWidth: 0 }}
        onMouseEnter={e => e.currentTarget.style.background = C.surface2}
        onMouseLeave={e => e.currentTarget.style.background = C.surface}>
        <div style={{ width: 54, height: 54, borderRadius: 12, background: gradStr(1), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Svg d={I.heart} size={24} fill="rgba(255,255,255,.3)" stroke="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>Liked Songs</div>
          <div style={{ color: C.text2, fontSize: 12, marginTop: 2 }}>{liked.length} {liked.length === 1 ? 'song' : 'songs'}</div>
        </div>
        <Svg d={I.next} size={16} stroke={C.text3} style={{ flexShrink: 0 }} />
      </div>

      {/* Empty state with CTA */}
      {playlists.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: C.text2 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: `rgba(${C.accentRgb},.1)`, border: `1px solid rgba(${C.accentRgb},.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Svg d={I.lib} size={32} stroke={C.accent} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>Build your collection</div>
          <div style={{ fontSize: 14, marginBottom: 24, maxWidth: 280, margin: '0 auto 24px' }}>Create playlists to organise your favourite music and access it anytime</div>
          <button onClick={onCreate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 24px', background: gradStr(0), border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Svg d={I.plus} size={14} stroke="#fff" />Create Your First Playlist
          </button>
        </div>
      )}

      {playlists.map(pl => <PlCard key={pl.id} pl={pl} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} C={C} />)}
    </div>
  );
});

const PlCard = memo(function PlCard({ pl, onOpen, onEdit, onDelete, C }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14, background: hov ? C.surface2 : C.surface, border: `1px solid ${C.border}`, marginBottom: 10, cursor: 'pointer', transition: 'background .15s', overflow: 'hidden', minWidth: 0 }}
      onClick={() => onOpen(pl)} role="button" tabIndex={0} aria-label={`Open playlist ${pl.name}`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(pl); } }}>
      <div style={{ width: 54, height: 54, borderRadius: 12, background: gradStr(pl.ci ?? 0), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Svg d={I.music} size={22} fill="rgba(255,255,255,.2)" stroke="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: C.text, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</div>
        <div style={{ color: C.text2, fontSize: 12, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {pl.songs?.length ?? 0} songs{pl.desc ? ` · ${pl.desc}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, opacity: hov ? 1 : 0, transition: 'opacity .2s', flexShrink: 0 }}>
        <button onClick={e => { e.stopPropagation(); onEdit(pl); }} aria-label={`Edit ${pl.name}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 8, borderRadius: 8, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Svg d={I.edit} size={14} stroke="currentColor" />
        </button>
        <button onClick={e => { e.stopPropagation(); if (confirm(`Delete "${pl.name}"?`)) onDelete(pl.id); }} aria-label={`Delete ${pl.name}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 8, borderRadius: 8, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Svg d={I.trash} size={14} stroke="currentColor" />
        </button>
      </div>
      <Svg d={I.next} size={16} stroke={C.text3} style={{ flexShrink: 0 }} />
    </div>
  );
});

/* ─── Playlist Detail View ────────────────────────────────── */
export const PlaylistDetailView = memo(function PlaylistDetailView({ C, playlist, song: cur, playing, liked, onPlay, onPlayAll, onLike, onCtx, onBack }) {
  const isLiked = playlist.id === 'liked';
  const songs   = (playlist.songs || []).map(id => getCachedSong(id)).filter(Boolean);
  const totalDur = songs.reduce((acc, s) => acc + (s?.dur || 0), 0);
  // PERFORMANCE FIX: O(1) liked check
  const likedSet = useMemo(() => new Set(Array.isArray(liked) ? liked.map(s => typeof s === 'string' ? s : s?.id) : []), [liked]);

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={onBack} aria-label="Back"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 8, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Svg d={I.back} size={22} stroke="currentColor" />
        </button>
        <div style={{ width: 60, height: 60, borderRadius: 14, background: gradStr(playlist.ci ?? 1), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Svg d={isLiked ? I.heart : I.music} size={26} fill="rgba(255,255,255,.2)" stroke="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: C.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {playlist.name}
          </h2>
          <div style={{ color: C.text2, fontSize: 13, marginTop: 2 }}>
            {songs.length} songs{totalDur > 0 ? ` · ${fmtTime(totalDur)}` : ''}{playlist.desc ? ` · ${playlist.desc}` : ''}
          </div>
        </div>
        {songs.length > 0 && (
          <button onClick={() => onPlayAll(songs, 0, 'playlist')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', minHeight: 44, background: gradStr(0), border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            <Svg d={I.play} size={14} fill="#fff" stroke="#fff" />Play All
          </button>
        )}
      </div>

      {songs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: C.text2 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: `rgba(${C.accentRgb},.08)`, border: `1px solid rgba(${C.accentRgb},.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Svg d={isLiked ? I.heart : I.music} size={32} stroke={C.accent} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            {isLiked ? 'No liked songs yet' : 'Playlist is empty'}
          </div>
          <div style={{ fontSize: 14, maxWidth: 260, margin: '0 auto' }}>
            {isLiked ? 'Tap the ♥ on any song to add it here' : 'Search for songs and add them to this playlist'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {songs.map((s, i) => (
            <SongRow key={s.id} song={s} idx={i} current={cur} playing={playing}
              liked={likedSet.has(s.id)}
              onPlay={t => onPlay(t, { toggle: true, list: songs, source: 'playlist' })}
              onLike={onLike} onCtx={onCtx} C={C} />
          ))}
        </div>
      )}
    </div>
  );
});
