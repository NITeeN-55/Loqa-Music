import React, { useState, useEffect, useRef, useCallback } from 'react';
import { gradStr, fmtTime, fmtViews, cacheSong, getCachedSong } from '../utils/constants.js';
import { Svg, I, EqBars, Spinner } from '../components/Icons.jsx';
import { Thumb, SongRow, SongCard, Section, HScroll } from '../components/UI.jsx';
import { searchYT, getTrending, getGenre, getSuggestions } from '../utils/youtubeApi.js';
import useLibraryStore from '../stores/libraryStore.js';

const GENRES = ['Pop Hits','Hip Hop','R&B Soul','Rock Classics','Electronic','Bollywood','Jazz & Blues','Lo-Fi Chill','K-Pop','Latin','Indie','Country','Reggae','Afrobeats','Classical'];
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

export default GenreView;
