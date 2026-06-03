import React, { useState, useEffect, useRef } from 'react';
import { gradStr, fmtTime, fmtViews, cacheSong, getCachedSong } from '../utils/constants.js';
import { Svg, I, EqBars, Spinner } from './Icons.jsx';
import { Thumb, SongRow, SongCard, Section, HScroll } from './UI.jsx';
import { searchYT, getTrending, getGenre, getSuggestions } from '../utils/youtubeApi.js';

const GENRES = ['Pop Hits','Hip Hop','R&B Soul','Rock Classics','Electronic','Bollywood','Jazz & Blues','Lo-Fi Chill','K-Pop','Latin','Indie','Country','Reggae','Afrobeats','Classical'];

/* ── Home ─────────────────────────────────────────────── */
export function HomeView({ C, song: cur, playing, liked, onPlay, onPlayAll, onLike, onCtx, go, isMobile,
                           recommendations, recsLoading, recsBasedOn, onRefreshRecs }) {
  const [trending,   setTrending]   = useState([]);
  const [genreSongs, setGenreSongs] = useState({});
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    setLoading(true);
    getTrending().then(t => { setTrending(t); setLoading(false); });
    getGenre('Pop Hits').then(t => setGenreSongs(g => ({ ...g, 'Pop Hits': t })));
    getGenre('Hip Hop').then(t => setGenreSongs(g => ({ ...g, 'Hip Hop': t })));
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

      {/* ── Genre rows ───────────────────────────────────────────── */}
      {GENRES.filter(g => genreSongs[g]?.length).map(genre => (
        <Section key={genre} title={genre} C={C} action="More" onAction={() => go('genre', { genre })}>
          <HScroll>
            {(genreSongs[genre] || []).slice(0, 10).map(s => (
              <SongCard key={s.id} song={s} current={cur} playing={playing}
                liked={liked.includes(s.id)}
                onPlay={t => onPlay(t, { toggle: true, list: genreSongs[genre], source: 'genre' })}
                onLike={onLike} onCtx={onCtx} C={C} />
            ))}
          </HScroll>
        </Section>
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
export function SearchView({ C, song: cur, playing, liked, onPlay, onLike, onCtx, initialQ = '' }) {
  const [q, setQ]               = useState(initialQ);
  const [results, setResults]   = useState([]);
  const [suggestions, setSugg]  = useState([]);
  const [loading, setLoading]   = useState(false);
  const [showSug, setShowSug]   = useState(false);
  const inputRef = useRef(null);
  const debRef   = useRef(null);

  useEffect(() => {
    setLoading(true);
    if (initialQ) doSearch(initialQ);
    else getTrending().then(t => { setResults(t); setLoading(false); });
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const doSearch = async (query) => {
    if (!query.trim()) return;
    setLoading(true); setShowSug(false);
    const r = await searchYT(query);
    r.forEach(cacheSong);
    setResults(r); setLoading(false);
  };

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
            onFocus={() => suggestions.length && setShowSug(true)}
            placeholder="Search songs, artists, albums…" aria-label="Search music"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 16, padding: '14px 0', fontFamily: 'inherit' }} />
          {q && <button onClick={() => { setQ(''); setResults([]); setShowSug(false); inputRef.current?.focus(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 4 }}>
            <Svg d={I.close} size={16} stroke="currentColor" />
          </button>}
          <button onClick={() => doSearch(q)}
            style={{ background: gradStr(0), border: 'none', borderRadius: 10, padding: '8px 16px',
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
            Search
          </button>
        </div>
        {showSug && suggestions.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface,
            border: `1px solid ${C.border}`, borderRadius: 12, marginTop: 4, zIndex: 100,
            boxShadow: '0 8px 32px rgba(0,0,0,.2)', overflow: 'hidden' }}>
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => { setQ(s); doSearch(s); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px',
                  background: 'none', border: 'none', cursor: 'pointer', color: C.text, fontSize: 14, textAlign: 'left', fontFamily: 'inherit' }}
                onMouseEnter={e => e.currentTarget.style.background = C.bg3}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <Svg d={I.search} size={14} stroke={C.text3} />{s}
              </button>
            ))}
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
export function GenreView({ C, genre, song: cur, playing, liked, onPlay, onLike, onCtx, onBack }) {
  const [songs, setSongs]   = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); getGenre(genre).then(t => { t.forEach(cacheSong); setSongs(t); setLoading(false); }); }, [genre]);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button onClick={onBack} aria-label="Back"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4 }}>
          <Svg d={I.back} size={22} stroke="currentColor" />
        </button>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: 0 }}>{genre}</h2>
      </div>
      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {songs.map((s, i) => (
              <SongRow key={s.id} song={s} idx={i} current={cur} playing={playing}
                liked={liked.includes(s.id)}
                onPlay={t => onPlay(t, { toggle: true, list: songs, source: 'genre' })}
                onLike={onLike} onCtx={onCtx} C={C} />
            ))}
          </div>}
    </div>
  );
}

/* ── Library ──────────────────────────────────────────── */
export function LibraryView({ C, playlists, liked, onOpen, onDelete, onEdit, onCreate }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: 0 }}>Your Library</h2>
        <button onClick={onCreate}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
            background: gradStr(0), border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Svg d={I.plus} size={14} stroke="#fff" />New Playlist
        </button>
      </div>
      {/* Liked */}
      <div onClick={() => onOpen({ id: 'liked', name: 'Liked Songs', songs: liked, ci: 1 })}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14,
          background: C.surface, border: `1px solid ${C.border}`, marginBottom: 12, cursor: 'pointer' }}
        onMouseEnter={e => e.currentTarget.style.background = C.surface2}
        onMouseLeave={e => e.currentTarget.style.background = C.surface}>
        <div style={{ width: 54, height: 54, borderRadius: 12, background: gradStr(1),
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Svg d={I.heart} size={24} fill="rgba(255,255,255,.3)" stroke="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>Liked Songs</div>
          <div style={{ color: C.text2, fontSize: 12, marginTop: 2 }}>{liked.length} songs</div>
        </div>
        <Svg d={I.next} size={16} stroke={C.text3} />
      </div>
      {playlists.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.text2 }}>
          <Svg d={I.lib} size={48} stroke={C.text3} /><br /><br />
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>No playlists yet</div>
          <div>Create a playlist to organise your music</div>
        </div>
      )}
      {playlists.map(pl => <PlCard key={pl.id} pl={pl} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} C={C} />)}
    </div>
  );
}

function PlCard({ pl, onOpen, onEdit, onDelete, C }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14,
        background: hov ? C.surface2 : C.surface, border: `1px solid ${C.border}`, marginBottom: 10, cursor: 'pointer', transition: 'background .15s' }}
      onClick={() => onOpen(pl)}>
      <div style={{ width: 54, height: 54, borderRadius: 12, background: gradStr(pl.ci ?? 0), flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Svg d={I.music} size={22} fill="rgba(255,255,255,.2)" stroke="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{pl.name}</div>
        <div style={{ color: C.text2, fontSize: 12, marginTop: 2 }}>{pl.songs.length} songs{pl.desc ? ` · ${pl.desc}` : ''}</div>
      </div>
      <div style={{ display: 'flex', gap: 4, opacity: hov ? 1 : 0, transition: 'opacity .2s' }}>
        <button onClick={e => { e.stopPropagation(); onEdit(pl); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 6, borderRadius: 8 }}>
          <Svg d={I.edit} size={14} stroke="currentColor" />
        </button>
        <button onClick={e => { e.stopPropagation(); if (confirm(`Delete "${pl.name}"?`)) onDelete(pl.id); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 6, borderRadius: 8 }}>
          <Svg d={I.trash} size={14} stroke="currentColor" />
        </button>
      </div>
      <Svg d={I.next} size={16} stroke={C.text3} />
    </div>
  );
}

/* ── Playlist detail ──────────────────────────────────── */
export function PlaylistDetailView({ C, playlist, song: cur, playing, liked, onPlay, onPlayAll, onLike, onCtx, onBack }) {
  const isLiked = playlist.id === 'liked';
  const songs   = (playlist.songs || []).map(id => getCachedSong(id)).filter(Boolean);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <button onClick={onBack} aria-label="Back"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text2, padding: 4 }}>
          <Svg d={I.back} size={22} stroke="currentColor" />
        </button>
        <div style={{ width: 60, height: 60, borderRadius: 14, background: gradStr(playlist.ci ?? 1), flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Svg d={isLiked ? I.heart : I.music} size={26} fill="rgba(255,255,255,.2)" stroke="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: C.text, margin: 0 }}>{playlist.name}</h2>
          <div style={{ color: C.text2, fontSize: 13, marginTop: 2 }}>{songs.length} songs{playlist.desc ? ` · ${playlist.desc}` : ''}</div>
        </div>
        {songs.length > 0 && (
          <button onClick={() => onPlayAll(songs, 0, 'playlist')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
              background: gradStr(0), border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Svg d={I.play} size={14} fill="#fff" stroke="#fff" />Play All
          </button>
        )}
      </div>
      {songs.length === 0
        ? <div style={{ textAlign: 'center', padding: '60px 20px', color: C.text2 }}>
            <Svg d={isLiked ? I.heart : I.music} size={48} stroke={C.text3} /><br /><br />
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>
              {isLiked ? 'No liked songs yet' : 'Playlist is empty'}
            </div>
            <div>{isLiked ? 'Like songs while playing to see them here' : 'Search for songs and add them here'}</div>
          </div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {songs.map((s, i) => (
              <SongRow key={s.id} song={s} idx={i} current={cur} playing={playing}
                liked={liked.includes(s.id)}
                onPlay={t => onPlay(t, { toggle: true, list: songs, source: 'playlist' })}
                onLike={onLike} onCtx={onCtx} C={C} />
            ))}
          </div>}
    </div>
  );
}
