import React, { useState, useEffect, useRef, useCallback } from 'react';
import { gradStr, fmtTime, fmtViews, cacheSong, getCachedSong } from '../utils/constants.js';
import { Svg, I, EqBars, Spinner } from './Icons.jsx';
import { Thumb, SongRow, SongCard, Section, HScroll } from './UI.jsx';
import { searchYT, getTrending, getGenre, getSuggestions } from '../utils/youtubeApi.js';
import useLibraryStore from '../stores/libraryStore.js';

const GENRES = ['Pop Hits','Hip Hop','R&B Soul','Rock Classics','Electronic','Bollywood','Jazz & Blues','Lo-Fi Chill','K-Pop','Latin','Indie','Country','Reggae','Afrobeats','Classical'];
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
      {playlists.length === 0 ? (
        /* ── Rich empty state with step-by-step guide ─────── */
        <div style={{ textAlign: 'center', padding: '48px 20px 32px' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🎵</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8 }}>
            Your library is empty
          </div>
          <div style={{ fontSize: 14, color: C.text2, marginBottom: 32, maxWidth: 300, margin: '0 auto 32px' }}>
            Create your first playlist to organise your music
          </div>
          <button onClick={onCreate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px',
              background: gradStr(0), border: 'none', borderRadius: 14, color: '#fff',
              fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 8px 24px rgba(108,99,255,.35)' }}>
            <Svg d={I.plus} size={16} stroke="#fff" />
            Create first playlist
          </button>
          {/* Tip cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 40, textAlign: 'left' }}>
            {[
              { icon: '🔍', title: 'Search', desc: 'Find any song on YouTube' },
              { icon: '❤️', title: 'Like', desc: 'Save favourites instantly' },
              { icon: '📂', title: 'Playlist', desc: 'Organise into collections' },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ padding: '14px 12px', background: C.surface,
                border: `1px solid ${C.border}`, borderRadius: 12 }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 11, color: C.text2 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        playlists.map(pl => <PlCard key={pl.id} pl={pl} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} C={C} />)
      )}
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
