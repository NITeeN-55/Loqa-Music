import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { gradStr, fmtTime, fmtViews, cacheSong, getCachedSong } from '../utils/constants.js';
import { Svg, I, EqBars, Spinner } from './Icons.jsx';
import { Thumb, SongRow, SongCard, Section, HScroll } from './UI.jsx';
import { searchYT, getTrending, getGenre, getSuggestions } from '../utils/youtubeApi.js';
import useLibraryStore from '../stores/libraryStore.js';

const GENRES = ['Pop Hits','Hip Hop','R&B Soul','Rock Classics','Electronic','Bollywood','Jazz & Blues','Lo-Fi Chill','K-Pop','Latin','Indie','Country','Reggae','Afrobeats','Classical'];

// Row height for virtual list
const ROW_H = 64;
// Threshold: only virtualise playlists with more than this many songs
const VIRTUAL_THRESHOLD = 80;

/**
 * VirtualSongList — renders only visible rows using a manual scroll-based
 * virtual window. Avoids @tanstack/react-virtual dependency while still
 * handling 1000+ song playlists without DOM slowdown.
 *
 * Overscan: renders 5 extra rows above/below viewport for smooth scrolling.
 */
function VirtualSongList({ songs, cur, playing, liked, onPlay, onLike, onCtx, C }) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const OVERSCAN = 5;

  const totalHeight = songs.length * ROW_H;

  const handleScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Find the parent scrollable element (main) and attach listener
  useEffect(() => {
    // Walk up to find the scrollable ancestor
    let el = containerRef.current?.parentElement;
    while (el && el.tagName !== 'MAIN' && el.id !== 'main') el = el.parentElement;
    if (!el) return;
    const onScroll = (e) => setScrollTop(e.currentTarget.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    // Set initial scroll from parent
    setScrollTop(el.scrollTop);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Compute visible window
  const containerTop = containerRef.current?.getBoundingClientRect().top ?? 0;
  const viewportH    = window.innerHeight;
  const relScroll    = scrollTop - (containerRef.current?.offsetTop ?? 0);

  const startIdx = Math.max(0,             Math.floor(relScroll / ROW_H) - OVERSCAN);
  const endIdx   = Math.min(songs.length,  Math.ceil((relScroll + viewportH) / ROW_H) + OVERSCAN);

  const visibleSongs = songs.slice(startIdx, endIdx);

  return (
    <div ref={containerRef} style={{ position: 'relative', height: totalHeight }}>
      {/* Spacer above visible window */}
      <div style={{ height: startIdx * ROW_H }} aria-hidden="true" />
      {visibleSongs.map((s, i) => {
        const globalIdx = startIdx + i;
        return (
          <div key={s.id} style={{ height: ROW_H }}>
            <SongRow song={s} idx={globalIdx} current={cur} playing={playing}
              liked={liked.includes(s.id)}
              onPlay={t => onPlay(t, { toggle: true, list: songs, source: 'playlist' })}
              onLike={onLike} onCtx={onCtx} C={C} />
          </div>
        );
      })}
    </div>
  );
}

export function PlaylistDetailView({ C, playlist, song: cur, playing, liked, onPlay, onPlayAll, onLike, onCtx, onBack }) {
  const isLiked = playlist.id === 'liked';
  const songs   = useMemo(
    () => (playlist.songs || []).map(id => getCachedSong(id)).filter(Boolean),
    [playlist.songs]
  );

  // Sort state
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'title' | 'artist'
  const sorted = useMemo(() => {
    if (sortBy === 'title')  return [...songs].sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === 'artist') return [...songs].sort((a, b) => a.artist.localeCompare(b.artist));
    return songs;
  }, [songs, sortBy]);

  const useVirtual = sorted.length > VIRTUAL_THRESHOLD;

  return (
    <div>
      {/* Header */}
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
          <div style={{ color: C.text2, fontSize: 13, marginTop: 2 }}>
            {songs.length} song{songs.length !== 1 ? 's' : ''}{playlist.desc ? ` · ${playlist.desc}` : ''}
          </div>
        </div>
        {songs.length > 0 && (
          <button onClick={() => onPlayAll(sorted, 0, 'playlist')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
              background: gradStr(0), border: 'none', borderRadius: 12, color: '#fff',
              fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Svg d={I.play} size={14} fill="#fff" stroke="#fff" />Play All
          </button>
        )}
      </div>

      {/* Sort controls — only shown when there are songs */}
      {songs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['default','Default'],['title','Title'],['artist','Artist']].map(([v, label]) => (
            <button key={v} onClick={() => setSortBy(v)}
              style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                background: sortBy === v ? C.accent : C.bg3,
                color:      sortBy === v ? '#fff'   : C.text2,
                transition: 'all .15s' }}>
              {label}
            </button>
          ))}
          {useVirtual && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: C.text3,
              alignSelf: 'center', fontStyle: 'italic' }}>
              Virtual scroll active ({sorted.length} songs)
            </span>
          )}
        </div>
      )}

      {/* Empty state */}
      {songs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.text2 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{isLiked ? '💜' : '🎵'}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>
            {isLiked ? 'No liked songs yet' : 'This playlist is empty'}
          </div>
          <div style={{ fontSize: 14, color: C.text2, maxWidth: 280, margin: '0 auto' }}>
            {isLiked
              ? 'Tap the ♥ button on any song to save it here'
              : 'Search for songs, then use the ⋯ menu to add them'}
          </div>
        </div>
      ) : useVirtual ? (
        // Virtual list for large playlists
        <VirtualSongList
          songs={sorted} cur={cur} playing={playing} liked={liked}
          onPlay={onPlay} onLike={onLike} onCtx={onCtx} C={C} />
      ) : (
        // Standard list for small playlists
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sorted.map((s, i) => (
            <SongRow key={s.id} song={s} idx={i} current={cur} playing={playing}
              liked={liked.includes(s.id)}
              onPlay={t => onPlay(t, { toggle: true, list: sorted, source: 'playlist' })}
              onLike={onLike} onCtx={onCtx} C={C} />
          ))}
        </div>
      )}
    </div>
  );
}
