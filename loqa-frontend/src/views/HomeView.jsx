import React, { useState, useEffect, useRef, useCallback } from 'react';
import { gradStr, fmtTime, fmtViews, cacheSong, getCachedSong } from '../utils/constants.js';
import { Svg, I, EqBars, Spinner } from './Icons.jsx';
import { Thumb, SongRow, SongCard, Section, HScroll } from './UI.jsx';
import { searchYT, getTrending, getGenre, getSuggestions } from '../utils/youtubeApi.js';
import useLibraryStore from '../stores/libraryStore.js';

const GENRES = ['Pop Hits','Hip Hop','R&B Soul','Rock Classics','Electronic','Bollywood','Jazz & Blues','Lo-Fi Chill','K-Pop','Latin','Indie','Country','Reggae','Afrobeats','Classical'];

/* ── Lazy-loaded Genre Row ─────────────────────────────── */
function LazyGenreRow({ genre, C, cur, playing, liked, onPlay, onLike, onCtx, go }) {
  const [songs, setSongs]     = useState(null); // null = not loaded yet
  const [loading, setLoading] = useState(false);
  const rowRef = useRef(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && songs === null && !loading) {
          setLoading(true);
          getGenre(genre).then(t => {
            t.forEach(cacheSong);
            setSongs(t);
            setLoading(false);
          });
          obs.disconnect();
        }
      },
      { rootMargin: '200px' } // load 200px before it scrolls into view
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [genre]); // eslint-disable-line

  return (
    <div ref={rowRef}>
      {songs !== null && songs.length > 0 && (
        <Section title={genre} C={C} action="More" onAction={() => go('genre', { genre })}>
          <HScroll>
            {songs.slice(0, 10).map(s => (
              <SongCard key={s.id} song={s} current={cur} playing={playing}
                liked={liked.includes(s.id)}
                onPlay={t => onPlay(t, { toggle: true, list: songs, source: 'genre' })}
                onLike={onLike} onCtx={onCtx} C={C} />
            ))}
          </HScroll>
        </Section>
      )}
      {loading && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>{genre}</h2>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${C.accent}`,
              borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
          </div>
        </div>
      )}
      {/* Sentinel for IntersectionObserver when not loaded yet */}
      {songs === null && !loading && <div style={{ height: 1 }} />}
    </div>
  );
}

/* ── Home ─────────────────────────────────────────────── */
export function HomeView({ C, song: cur, playing, liked, onPlay, onPlayAll, onLike, onCtx, go, isMobile,
                           recommendations, recsLoading, recsBasedOn, onRefreshRecs }) {
  const [trending,   setTrending]   = useState([]);
  const [loading,    setLoading]    = useState(true);

  // Pull recent play history — already populated from sync
  const recent = useLibraryStore(s => s.recent);
  // Resolve IDs to song objects from cache
  const recentSongs = recent.slice(0, 12).map(id => getCachedSong(id)).filter(Boolean);

  useEffect(() => {
    setLoading(true);
    getTrending().then(t => { setTrending(t); setLoading(false); });
    // Genre rows are now loaded lazily via IntersectionObserver as the user scrolls
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  return (
    <div>
      {/* Hero */}
      <div style={{ borderRadius: 20, background: `linear-gradient(135deg,${C.bg3},${C.bg2})`,
        padding: isMobile ? '24px 20px' : '36px 40px', marginBottom: 32,
        position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300,
          borderRadius: '50%', background: gradStr(0), opacity: .07, filter: 'blur(50px)' }} />
        <h1 style={{ fontSize: isMobile ? 22 : 32, fontWeight: 900, color: C.text, margin: '0 0 6px' }}>
          Good {greeting} 🎵
        </h1>
        <p style={{ color: C.text2, fontSize: 14, margin: '0 0 20px' }}>
          Your personal music stream, powered by YouTube
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => go('search')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px',
              background: gradStr(0), border: 'none', borderRadius: 12,
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Svg d={I.search} size={15} stroke="#fff" /> Search Music
          </button>
          <button onClick={() => go('local')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px',
              background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 12,
              color: C.text, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            📁 Local Files
          </button>
        </div>
      </div>

      {/* ── Continue Listening (recently played) ─────────────── */}
      {recentSongs.length > 0 && (
        <Section title="▶ Continue Listening" C={C}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3,1fr)', gap: 8 }}>
            {recentSongs.slice(0, 6).map(s => (
              <button key={s.id} onClick={() => onPlay(s, { toggle: true, list: recentSongs, source: 'recent' })}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: cur?.id === s.id ? `rgba(${C.accentRgb},.15)` : C.surface,
                  border: `1px solid ${cur?.id === s.id ? C.accent : C.border}`,
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  transition: 'all .15s', minWidth: 0 }}
                onMouseEnter={e => e.currentTarget.style.background = cur?.id === s.id ? `rgba(${C.accentRgb},.2)` : C.surface2}
                onMouseLeave={e => e.currentTarget.style.background = cur?.id === s.id ? `rgba(${C.accentRgb},.15)` : C.surface}>
                <Thumb song={s} size={40} radius={8} playing={cur?.id === s.id && playing} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: cur?.id === s.id ? C.accent : C.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: C.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.artist}
                  </div>
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* ── Personalised Recommendations ─────────────────────────── */}
      {(recommendations?.length > 0 || recsLoading) && (
        <div style={{ marginBottom: 32 }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
                ⭐ Recommended for You
              </h2>
              {recsBasedOn?.length > 0 && !recsLoading && (
                <p style={{ fontSize: 12, color: C.text3, margin: 0 }}>
                  Based on: {recsBasedOn.slice(0, 3).join(' · ')}
                </p>
              )}
            </div>
            <button
              onClick={onRefreshRecs}
              disabled={recsLoading}
              aria-label="Refresh recommendations"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', flexShrink: 0,
                background: recsLoading ? C.bg3 : `rgba(${C.accentRgb},.12)`,
                border: `1px solid ${recsLoading ? C.border : C.accent}`,
                borderRadius: 10, cursor: recsLoading ? 'wait' : 'pointer',
                color: recsLoading ? C.text3 : C.accent,
                fontWeight: 600, fontSize: 12, fontFamily: 'inherit',
                transition: 'all .15s',
              }}
            >
              <span style={{ display: 'inline-block', animation: recsLoading ? 'spin 1s linear infinite' : 'none' }}>
                🔄
              </span>
              {recsLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {recsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spinner size={28} />
            </div>
          ) : (
            <HScroll>
              {recommendations.slice(0, 16).map(s => (
                <SongCard key={s.id} song={s} current={cur} playing={playing}
                  liked={liked.includes(s.id)}
                  onPlay={t => onPlay(t, { toggle: true, list: recommendations, source: 'recommendations' })}
                  onLike={onLike} onCtx={onCtx} C={C} />
              ))}
            </HScroll>
          )}
        </div>
      )}

      {/* ── Trending ─────────────────────────────────────────────── */}
      <Section title="🔥 Trending Now" C={C} action="See all"
        onAction={() => go('search', { searchQ: 'trending music' })}>
        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={32} /></div>
          : <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 4 }}>
              {trending.slice(0, isMobile ? 6 : 10).map((s, i) => (
                <SongRow key={s.id} song={s} idx={i} current={cur} playing={playing}
                  liked={liked.includes(s.id)}
                  onPlay={t => onPlay(t, { toggle: true, list: trending, source: 'trending' })}
                  onLike={onLike} onCtx={onCtx} C={C} />
              ))}
            </div>
        }
      </Section>

      {/* ── Genre rows — lazy loaded via IntersectionObserver ───── */}
      {GENRES.map(genre => (
        <LazyGenreRow key={genre} genre={genre} C={C} cur={cur} playing={playing}
          liked={liked} onPlay={onPlay} onLike={onLike} onCtx={onCtx} go={go} />
      ))}

      {/* Genre grid */}
      <Section title="Browse Genres" C={C}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}>
          {GENRES.map((g, i) => (
            <button key={g} onClick={() => go('genre', { genre: g })}
              style={{ padding: '16px 14px', borderRadius: 12, background: gradStr(i),
                border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 13, textAlign: 'left',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)' }}>
              {g}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ── Search ───────────────────────────────────────────── */
