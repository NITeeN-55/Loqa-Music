import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import './styles/index.css';
import { DARK, LIGHT, gradStr, loadLS, saveLS, getCachedSong } from './utils/constants.js';
import { Svg, I, EqBars } from './components/Icons.jsx';
import { Toaster, CtxMenu, PlayerBar } from './components/UI.jsx';
import YouTubePlayer from './components/YouTubePlayer.jsx';
import Equalizer from './components/Equalizer.jsx';
import LocalPlayer from './components/LocalPlayer.jsx';
import { HomeView, SearchView, GenreView, LibraryView, PlaylistDetailView } from './components/Views.jsx';
import { QueuePanel, AuthScreen, PlaylistModal, SettingsModal } from './components/Panels.jsx';
import usePlayerStore from './stores/playerStore.js';
import useAuthStore from './stores/authStore.js';
import useLibraryStore from './stores/libraryStore.js';
import useUIStore from './stores/uiStore.js';
import useEqStore from './stores/eqStore.js';
import { useMediaQuery, useKeyboardShortcuts, useMediaSession, useNetworkStatus } from './hooks/index.js';

const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'https://loqa-music.onrender.com';

// Stable portal container — never changes, never inside #root
const PORTAL_ROOT = document.getElementById('loqa-portals') || document.body;

export default function App() {
  const mob = useMediaQuery('(max-width:768px)');

  /* ── Auth ──────────────────────── */
  const authed  = useAuthStore(s => s.authed);
  const user    = useAuthStore(s => s.user);
  const logout  = useAuthStore(s => s.logout);
  const refresh = useAuthStore(s => s.refresh);
  const getHeaders = useAuthStore(s => s.headers);

  /* ── UI ────────────────────────── */
  const theme        = useUIStore(s => s.theme);
  const toggleTheme  = useUIStore(s => s.toggleTheme);
  const view         = useUIStore(s => s.view);
  const go           = useUIStore(s => s.go);
  const playlist     = useUIStore(s => s.playlist);
  const genre        = useUIStore(s => s.genre);
  const searchQ      = useUIStore(s => s.searchQ);
  const sidebarOpen  = useUIStore(s => s.sidebarOpen);
  const setSidebar   = useUIStore(s => s.setSidebarOpen);
  const showQueue    = useUIStore(s => s.showQueue);
  const showSettings = useUIStore(s => s.showSettings);
  const plModal      = useUIStore(s => s.plModal);
  const ctxMenu      = useUIStore(s => s.ctxMenu);
  const toasts       = useUIStore(s => s.toasts);
  const toast        = useUIStore(s => s.toast);
  const settings     = useUIStore(s => s.settings);
  const saveSettings = useUIStore(s => s.saveSettings);
  const setShowQueue    = useUIStore(s => s.setShowQueue);
  const setShowSettings = useUIStore(s => s.setShowSettings);
  const setPlModal      = useUIStore(s => s.setPlModal);
  const setCtxMenu      = useUIStore(s => s.setCtxMenu);
  const openCtx         = useUIStore(s => s.openCtxMenu);
  const [showEq, setShowEq] = useState(false);

  /* ── Player ────────────────────── */
  const song      = usePlayerStore(s => s.song);
  const playing   = usePlayerStore(s => s.playing);
  const progress  = usePlayerStore(s => s.progress);
  const duration  = usePlayerStore(s => s.duration);
  const volume    = usePlayerStore(s => s.volume);
  const muted     = usePlayerStore(s => s.muted);
  const shuffle   = usePlayerStore(s => s.shuffle);
  const repeat    = usePlayerStore(s => s.repeat);
  const queue     = usePlayerStore(s => s.queue);
  const related   = usePlayerStore(s => s.related);
  const setPlaying  = usePlayerStore(s => s.setPlaying);
  const setVolume   = usePlayerStore(s => s.setVolume);
  const setMuted    = usePlayerStore(s => s.setMuted);
  const setShuffle  = usePlayerStore(s => s.setShuffle);
  const setRepeat   = usePlayerStore(s => s.setRepeat);
  const setProgress = usePlayerStore(s => s.setProgress);
  const setDuration = usePlayerStore(s => s.setDuration);
  const doPlay    = usePlayerStore(s => s.play);
  const playAll   = usePlayerStore(s => s.playAll);
  const doSeek    = usePlayerStore(s => s.seek);
  const doNext    = usePlayerStore(s => s.next);
  const doPrev    = usePlayerStore(s => s.prev);
  const doEnded   = usePlayerStore(s => s.ended);
  const setQueue  = usePlayerStore(s => s.setQueue);

  /* ── Library ───────────────────── */
  const playlists      = useLibraryStore(s => s.playlists);
  const liked          = useLibraryStore(s => s.liked);
  const syncFromServer = useLibraryStore(s => s.syncFromServer);
  const recordPlay     = useLibraryStore(s => s.recordPlay);
  const toggleLike     = useLibraryStore(s => s.toggleLike);
  const createPl       = useLibraryStore(s => s.createPlaylist);
  const editPl         = useLibraryStore(s => s.editPlaylist);
  const deletePl       = useLibraryStore(s => s.deletePlaylist);
  const addToPl        = useLibraryStore(s => s.addToPlaylist);

  /* ── EQ ────────────────────────── */
  const eqStore = useEqStore();

  /* ── Recommendations ──────────────────────────────────── */
  const [recs,         setRecs]         = useState([]);
  const [recsLoading,  setRecsLoading]  = useState(false);
  const [recsBasedOn,  setRecsBasedOn]  = useState([]);
  const [lastRecsLoad, setLastRecsLoad] = useState(0);

  const C      = theme === 'dark' ? DARK : LIGHT;
  const ytRef  = useRef(null);
  const mainRef = useRef(null);
  const navRef  = useRef(null);

  /* ── Theme attr ─────────────────── */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  /* ── On auth change ─────────────── */
  useEffect(() => {
    if (!authed) return;
    refresh();
    syncFromServer();
    loadRecs({ force: true });
    eqStore.loadFromServer(getHeaders());
    saveLS({ ...loadLS(), volume });
  }, [authed]); // eslint-disable-line

  useNetworkStatus(toast);

  /* ── Load personalised recommendations ──────────────────
     seed_artist: currently-playing song's artist (optional)
     force: bypass 30-second cooldown
  ──────────────────────────────────────────────────────── */
  const loadRecs = useCallback(async (opts = {}) => {
    const { force = false, seedArtist = '', seedId = '' } = opts;
    const now = Date.now();
    // Don't refresh more often than every 30 s unless forced
    if (!force && now - lastRecsLoad < 30_000) return;

    setRecsLoading(true);
    setLastRecsLoad(now);
    try {
      const params = new URLSearchParams({ limit: 24 });
      if (seedArtist) params.set('seed_artist', seedArtist);
      if (seedId)     params.set('seed_id',     seedId);

      const r = await fetch(`${API}/api/recommendations?${params}`, {
        headers: getHeaders(),
      });
      if (r.ok) {
        const d = await r.json();
        setRecs(d.items    || []);
        setRecsBasedOn(d.basedOn || []);
      }
    } catch { /* offline — keep existing recs */ }
    setRecsLoading(false);
  }, [lastRecsLoad, getHeaders]); // eslint-disable-line

  /* ── Record play + refresh recs with seed artist ───────── */
  useEffect(() => {
    if (!song || !authed) return;
    recordPlay(song);
    // Refresh recommendations using the current artist as seed
    // (throttled to once per 30s so it doesn't hammer the server)
    loadRecs({ seedArtist: song.artist || '', seedId: song.id });
  }, [song?.id]); // eslint-disable-line

  /* ── ESC closes mobile sidebar ── */
  useEffect(() => {
    if (!mob || !sidebarOpen) return;
    const h = e => { if (e.key === 'Escape') setSidebar(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [mob, sidebarOpen, setSidebar]);

  /* ── Navigate helper ─────────────── */
  const nav = useCallback((v, extra = {}) => {
    go(v, extra);
    if (mob) setSidebar(false);
    requestAnimationFrame(() => mainRef.current?.focus());
  }, [go, mob, setSidebar]);

  /* ── Skip helpers — lockSkip() BEFORE store update ── */
  const safeNext = useCallback(() => { ytRef.current?.lockSkip(); doNext(); }, [doNext]);
  const safePrev = useCallback(() => {
    ytRef.current?.lockSkip();
    const r = doPrev();
    if (r === 'restart') ytRef.current?.seekTo(0);
  }, [doPrev]);
  const safeEnd = useCallback(() => {
    const r = doEnded();
    if (r === 'restart') ytRef.current?.seekTo(0);
  }, [doEnded]);

  /* ── Seek (numeric pct or symbolic string) ── */
  const seek = useCallback((p) => {
    if (typeof p === 'string') {
      const { progress: cur, duration: dur } = usePlayerStore.getState();
      const d = Math.max(dur, 1);
      if      (p === 'back5')        p = Math.max(0,   cur - (5 / d) * 100);
      else if (p === 'fwd5')         p = Math.min(100, cur + (5 / d) * 100);
      else if (p.startsWith('pct'))  p = parseInt(p.slice(3), 10);
      else return;
    }
    doSeek(p);
    ytRef.current?.seekTo(p);
  }, [doSeek]);

  /* ── Player error ─────────────── */
  const onErr = useCallback((code) => {
    toast(
      code === 101 || code === 150
        ? "This video can't be embedded — skipping"
        : 'Playback error — skipping',
      'error'
    );
    safeNext();
  }, [toast, safeNext]);

  const onDuration = useCallback(d => { if (d > 0) setDuration(d); }, [setDuration]);

  /* ── Like toggle ─────────────── */
  const doLike = useCallback(async (songOrId) => {
    const obj = typeof songOrId === 'string' ? { id: songOrId } : songOrId;
    const isNowLiked = await toggleLike(obj);
    toast(
      isNowLiked === false ? 'Removed from Liked Songs' : '♥ Added to Liked Songs',
      isNowLiked === false ? 'info' : 'success'
    );
  }, [toggleLike, toast]);

  /* ── Playlist helpers ─────────── */
  const onCreatePl = async (name, desc) => {
    await createPl(name, desc); setPlModal(null); toast('Playlist created!', 'success');
  };
  const onEditPl = async (id, name, desc) => {
    await editPl(id, name, desc); setPlModal(null); toast('Updated!', 'success');
  };
  const onDeletePl = async (id) => {
    await deletePl(id);
    if (playlist?.id === id) nav('library');
    toast('Playlist deleted');
  };
  const onAddToPl = async (song, pid) => {
    const n = await addToPl(song, pid);
    toast(`Added to ${n || 'playlist'}!`, 'success');
  };

  /* ── Volume keyboard ─────────── */
  const volUp   = useCallback(() => setVolume(Math.min(100, (muted ? 0 : volume) + 5)), [setVolume, volume, muted]);
  const volDown = useCallback(() => setVolume(Math.max(0,   (muted ? 0 : volume) - 5)), [setVolume, volume, muted]);

  /* ── MediaSession ─────────────── */
  useMediaSession({
    song, playing, duration,
    onPlay:  useCallback(() => setPlaying(true),  [setPlaying]),
    onPause: useCallback(() => setPlaying(false), [setPlaying]),
    onPrev: safePrev, onNext: safeNext, onSeek: seek,
  });

  /* ── Keyboard shortcuts ───────── */
  useKeyboardShortcuts({
    song, playing, shuffle, repeat, showQueue,
    onTogglePlay:    useCallback(() => setPlaying(p => !p), [setPlaying]),
    onPrev: safePrev, onNext: safeNext,
    onLike:          id => doLike({ id }),
    onToggleShuffle: useCallback(() => setShuffle(p => !p), [setShuffle]),
    onToggleRepeat:  useCallback(() => setRepeat(p => !p),  [setRepeat]),
    onToggleMute:    useCallback(() => setMuted(p => !p),   [setMuted]),
    onToggleQueue:   useCallback(() => setShowQueue(v => !v), [setShowQueue]),
    onVolUp: volUp, onVolDown: volDown, onSeek: seek, toast,
  });

  /* ── Context menu action ──────── */
  const onCtxAction = useCallback((action, s, data) => {
    setCtxMenu(null);
    switch (action) {
      case 'playNext':       setQueue(q => [s, ...q.filter(x => x.id !== s.id)]); toast('Playing next'); break;
      case 'addQueue':       setQueue(q => [...q, s]); toast('Added to queue'); break;
      case 'like':           doLike(s); break;
      case 'addToPlaylist':  onAddToPl(s, data); break;
      case 'share':
        navigator.clipboard?.writeText(`https://www.youtube.com/watch?v=${s.id}`)
          .then(() => toast('YouTube link copied!', 'success'))
          .catch(() => toast('Could not copy link', 'error'));
        break;
      default: break;
    }
  }, [setCtxMenu, setQueue, doLike, toast]); // eslint-disable-line

  /* ── Sidebar roving tabindex ───── */
  const onNavKey = useCallback(e => {
    const items = [...(navRef.current?.querySelectorAll('[data-nav]') || [])];
    const i = items.indexOf(document.activeElement);
    if (i === -1) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    if (e.key === 'Home')      { e.preventDefault(); items[0]?.focus(); }
    if (e.key === 'End')       { e.preventDefault(); items[items.length - 1]?.focus(); }
  }, []);

  const NAV = [
    { id: 'home',   label: 'Home',        icon: I.home     },
    { id: 'search', label: 'Search',       icon: I.search   },
    { id: 'library',label: 'Library',      icon: I.lib      },
    { id: 'local',  label: 'Local Music',  icon: I.download },
    { id: 'liked',  label: 'Liked',        icon: I.heart, badge: liked.length },
  ];

  /* ── Auth gate ────────────────── */
  if (!authed) return <AuthScreen C={C} isMobile={mob} />;

  /* ─────────────────────────────── */
  return (
    <div
      style={{ display:'flex', height:'100vh', background:C.bg, color:C.text,
               fontFamily:"'Inter',-apple-system,sans-serif", overflow:'hidden' }}
      onClick={() => ctxMenu && setCtxMenu(null)}
    >
      {/* a11y */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {song ? `${playing ? 'Playing' : 'Paused'}: ${song.title} by ${song.artist}` : 'No song selected'}
      </div>
      <a href="#main" className="sr-only sr-only-focusable">Skip to content</a>

      {/* Mobile backdrop */}
      {mob && sidebarOpen && (
        <div aria-hidden="true" onClick={() => setSidebar(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:49 }} />
      )}

      {/* ── Sidebar ─────────────────────────────────────── */}
      {sidebarOpen && (
        <aside
          role={mob ? 'dialog' : 'navigation'}
          aria-modal={mob || undefined}
          aria-label="Main navigation"
          style={{
            width:240, flexShrink:0, background:C.surface,
            borderRight:`1px solid ${C.border}`,
            display:'flex', flexDirection:'column', zIndex:50, overflow:'hidden',
            ...(mob ? { position:'fixed', left:0, top:0, bottom:0, boxShadow:'8px 0 40px rgba(0,0,0,.5)' } : {}),
          }}
        >
          {/* Logo */}
          <div style={{ padding:'20px 18px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:gradStr(0),
                            display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Svg d={I.music} size={16} fill="rgba(255,255,255,.3)" stroke="#fff" />
              </div>
              <span style={{ fontSize:16, fontWeight:900, background:gradStr(0),
                             WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                Loqa Music
              </span>
            </div>
            {mob && (
              <button onClick={() => setSidebar(false)} aria-label="Close menu"
                style={{ background:'none', border:'none', cursor:'pointer', color:C.text3, padding:4 }}>
                <Svg d={I.close} size={18} stroke="currentColor" />
              </button>
            )}
          </div>

          {/* Primary nav */}
          <nav aria-label="Primary" ref={navRef} onKeyDown={onNavKey} style={{ padding:'0 10px 10px' }}>
            {NAV.map(item => {
              const isLikedItem = item.id === 'liked';
              const active = view === item.id ||
                             (isLikedItem && view === 'playlist' && playlist?.id === 'liked');
              return (
                <button
                  key={item.id} data-nav tabIndex={active ? 0 : -1}
                  aria-current={active ? 'page' : undefined}
                  onClick={() =>
                    isLikedItem
                      ? nav('playlist', { playlist:{ id:'liked', name:'Liked Songs', songs:liked, ci:1 } })
                      : nav(item.id)
                  }
                  style={{
                    width:'100%', display:'flex', alignItems:'center', gap:12,
                    padding:'10px 14px', borderRadius:10, border:'none', cursor:'pointer', marginBottom:2,
                    background: active ? `rgba(${C.accentRgb},.15)` : 'transparent',
                    color: active ? C.accent : C.text2,
                    fontWeight: active ? 600 : 400, fontSize:13.5, textAlign:'left',
                    transition:'all .15s', fontFamily:'inherit',
                  }}
                >
                  <Svg d={item.icon} size={16} stroke="currentColor"
                       fill={isLikedItem && active ? C.accent2 : 'none'} />
                  {item.label}
                  {item.badge > 0 && (
                    <span style={{ marginLeft:'auto', background:C.accent2, color:'#fff',
                                   fontSize:10, fontWeight:700, borderRadius:10, padding:'1px 7px' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div style={{ height:1, background:C.border, margin:'0 14px 10px' }} />

          {/* Playlist list */}
          <div style={{ flex:1, overflowY:'auto', padding:'0 10px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'2px 14px 8px', color:C.text3, fontSize:10.5,
                          textTransform:'uppercase', letterSpacing:1.2, fontWeight:700 }}>
              <span>Playlists</span>
              <button onClick={() => setPlModal({ mode:'create' })} aria-label="New playlist"
                style={{ background:'none', border:'none', cursor:'pointer', color:C.text3, padding:2 }}>
                <Svg d={I.plus} size={13} stroke="currentColor" />
              </button>
            </div>
            {playlists.map(pl => {
              const active = view === 'playlist' && playlist?.id === pl.id;
              return (
                <button key={pl.id} onClick={() => nav('playlist', { playlist:pl })}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    width:'100%', display:'flex', alignItems:'center', gap:9,
                    padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', marginBottom:1,
                    background: active ? `rgba(${C.accentRgb},.12)` : 'transparent',
                    color: active ? C.accent : C.text2, fontSize:13, textAlign:'left',
                    transition:'all .15s', fontFamily:'inherit',
                  }}
                >
                  <div style={{ width:26, height:26, borderRadius:7, background:gradStr(pl.ci ?? 0), flexShrink:0 }} />
                  <span style={{ flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {pl.name}
                  </span>
                  <span style={{ fontSize:11, opacity:.5 }}>{pl.songs.length}</span>
                </button>
              );
            })}
            {playlists.length === 0 && (
              <p style={{ padding:'8px 14px', fontSize:12, color:C.text3, margin:0 }}>No playlists yet</p>
            )}
          </div>

          {/* User footer */}
          <div style={{ padding:'12px 14px', borderTop:`1px solid ${C.border}`,
                        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{
                width:30, height:30, borderRadius:'50%', background:gradStr(user?.avatarCi ?? 3),
                flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:700, color:'rgba(255,255,255,.9)',
              }}>
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span style={{ fontSize:12, fontWeight:500, color:C.text, whiteSpace:'nowrap',
                             overflow:'hidden', textOverflow:'ellipsis', maxWidth:90 }}>
                {user?.name}
              </span>
            </div>
            <div style={{ display:'flex', gap:2 }}>
              {[
                { icon: I.gear,                        label:'Settings',    fn:() => setShowSettings(true) },
                { icon: theme==='dark' ? I.sun : I.moon, label:'Theme',     fn:toggleTheme },
                { icon: I.logout,                      label:'Sign out',    fn:logout },
              ].map(({ icon, label, fn }, idx) => (
                <button key={idx} onClick={fn} aria-label={label}
                  style={{ background:'none', border:'none', cursor:'pointer', color:C.text3,
                           padding:4, borderRadius:6, transition:'color .15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = C.text}
                  onMouseLeave={e => e.currentTarget.style.color = C.text3}>
                  <Svg d={icon} size={13} stroke="currentColor" />
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* ── Main column ─────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* Header */}
        <header style={{
          background:C.glass, backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
          borderBottom:`1px solid ${C.border}`,
          padding: mob ? '10px 14px' : '12px 22px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          flexShrink:0, position:'sticky', top:0, zIndex:40,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={() => setSidebar(p => !p)}
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              aria-expanded={sidebarOpen}
              style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:9,
                       padding:'6px 8px', cursor:'pointer', color:C.text2 }}>
              <Svg d={I.menu} size={16} stroke="currentColor" />
            </button>
            <h1 style={{ fontSize: mob ? 16 : 19, fontWeight:800, color:C.text, margin:0 }}>
              {view==='home'     ? 'Discover'
              :view==='search'   ? 'Search'
              :view==='library'  ? 'Library'
              :view==='local'    ? 'Local Music'
              :view==='genre'    ? (genre || 'Genre')
              :view==='playlist' ? (playlist?.name || 'Playlist')
              : 'Loqa Music'}
            </h1>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={() => setShowEq(e => !e)} aria-label="Equalizer" aria-pressed={showEq}
              style={{
                padding:'6px 12px', display:'flex', alignItems:'center', gap:5,
                background: showEq ? `rgba(${C.accentRgb},.15)` : C.bg3,
                border:`1px solid ${showEq ? C.accent : C.border}`,
                borderRadius:10, color: showEq ? C.accent : C.text2,
                fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'inherit',
              }}>
              🎛️{!mob && ' EQ'}
            </button>
            {song && !mob && (
              <div style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 12px',
                            background:C.bg3, borderRadius:20, border:`1px solid ${C.border}`,
                            fontSize:12, maxWidth:180, overflow:'hidden' }}
                   aria-live="polite">
                {playing && <EqBars size={13} color={C.accent} />}
                <span style={{ color:C.text, fontWeight:500, whiteSpace:'nowrap',
                               overflow:'hidden', textOverflow:'ellipsis' }}>
                  {song.title}
                </span>
              </div>
            )}
            <div style={{ width:32, height:32, borderRadius:'50%', background:gradStr(user?.avatarCi ?? 3),
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:13, fontWeight:700, color:'rgba(255,255,255,.9)', flexShrink:0 }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Keyboard hint strip */}
        {!mob && (
          <div aria-hidden="true" style={{ padding:'4px 22px', background:C.bg2,
            borderBottom:`1px solid ${C.border}`, display:'flex', gap:14,
            fontSize:10.5, color:C.text3, flexShrink:0, flexWrap:'wrap' }}>
            {[['Space','Play/Pause'],['←→','Skip'],['Shift+←→','Seek ±5s'],
              ['↑↓','Volume'],['0-9','Jump %'],['L','Like'],
              ['S','Shuffle'],['R','Repeat'],['M','Mute'],['Q','Queue']
            ].map(([k,v]) => (
              <span key={k}>
                <kbd style={{ background:C.bg3, border:`1px solid ${C.border}`,
                              borderRadius:3, padding:'0 4px', fontFamily:'monospace', fontSize:10 }}>
                  {k}
                </kbd>{' '}{v}
              </span>
            ))}
          </div>
        )}

        {/* ── Main content ── */}
        <main id="main" ref={mainRef} tabIndex={-1} aria-label="Main content"
          style={{ flex:1, overflowY:'auto', padding: mob ? '14px 12px 0' : '24px 28px 0' }}>

          {view === 'home' && (
            <HomeView C={C} song={song} playing={playing} liked={liked}
              onPlay={(s, opts) => doPlay(s, opts)} onPlayAll={playAll}
              onLike={doLike} onCtx={openCtx} go={nav} isMobile={mob}
              recommendations={recs} recsLoading={recsLoading}
              recsBasedOn={recsBasedOn}
              onRefreshRecs={() => loadRecs({ force: true, seedArtist: song?.artist || '', seedId: song?.id || '' })} />
          )}
          {view === 'search' && (
            <SearchView C={C} song={song} playing={playing} liked={liked}
              onPlay={(s, opts) => doPlay(s, opts)}
              onLike={doLike} onCtx={openCtx} initialQ={searchQ} />
          )}
          {view === 'library' && (
            <LibraryView C={C} playlists={playlists} liked={liked}
              onOpen={pl => nav('playlist', { playlist:pl })}
              onDelete={onDeletePl}
              onEdit={pl => setPlModal({ mode:'edit', pl })}
              onCreate={() => setPlModal({ mode:'create' })} />
          )}
          {view === 'local' && (
            <LocalPlayer C={C} isMobile={mob} onSwitchToYT={() => nav('search')} />
          )}
          {view === 'playlist' && playlist && (
            <PlaylistDetailView C={C}
              playlist={playlist.id === 'liked'
                ? { ...playlist, songs:liked }
                : playlist}
              song={song} playing={playing} liked={liked}
              onPlay={(s, opts) => doPlay(s, opts)} onPlayAll={playAll}
              onLike={doLike} onCtx={openCtx}
              onBack={() => nav('library')} />
          )}
          {view === 'genre' && genre && (
            <GenreView C={C} genre={genre} song={song} playing={playing} liked={liked}
              onPlay={(s, opts) => doPlay(s, opts)}
              onLike={doLike} onCtx={openCtx}
              onBack={() => nav('home')} />
          )}

          <div style={{ height: mob ? 110 : 24 }} aria-hidden="true" />
        </main>

        {/* Player bar */}
        <PlayerBar C={C}
          song={song} playing={playing} progress={progress} duration={duration}
          volume={volume} muted={muted} shuffle={shuffle} repeat={repeat}
          liked={liked.includes(song?.id || '')}
          showQueue={showQueue} showLyrics={false}
          onTogglePlay={() => setPlaying(p => !p)}
          onPrev={safePrev} onNext={safeNext} onSeek={seek}
          onVolume={setVolume} onMute={() => setMuted(p => !p)}
          onShuffle={() => { setShuffle(p => !p); toast(!shuffle ? 'Shuffle on' : 'Shuffle off'); }}
          onRepeat={() => { setRepeat(p => !p);  toast(!repeat  ? 'Repeat on'  : 'Repeat off');  }}
          onLike={id => doLike({ id })}
          onToggleLyrics={() => {}}
          onToggleQueue={() => setShowQueue(!showQueue)}
          playlists={playlists}
          onAddToPlaylist={onAddToPl}
          isMobile={mob} />
      </div>

      {/* Mobile bottom nav */}
      {mob && (
        <nav aria-label="Mobile navigation"
          style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:50,
                   background:C.player, borderTop:`1px solid ${C.border}`,
                   display:'flex', justifyContent:'space-around', alignItems:'center', height:56 }}>
          {NAV.filter(n => n.id !== 'liked').map(item => {
            const active = view === item.id;
            return (
              <button key={item.id} onClick={() => nav(item.id)}
                aria-label={item.label} aria-current={active ? 'page' : undefined}
                style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                         background:'none', border:'none', cursor:'pointer',
                         color: active ? C.accent : C.text3, padding:'4px 0', transition:'color .15s',
                         fontFamily:'inherit' }}>
                <Svg d={item.icon} size={20} stroke="currentColor" />
                <span style={{ fontSize:10, fontWeight: active ? 700 : 500 }}>{item.label}</span>
              </button>
            );
          })}
          <button onClick={() => setSidebar(p => !p)} aria-label="More"
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                     background:'none', border:'none', cursor:'pointer',
                     color:C.text3, padding:'4px 0', fontFamily:'inherit' }}>
            <Svg d={I.menu} size={20} stroke="currentColor" />
            <span style={{ fontSize:10, fontWeight:500 }}>More</span>
          </button>
        </nav>
      )}

      {/* ── Portals — rendered into #loqa-portals (NOT document.body) ── */}

      {showQueue && createPortal(
        <QueuePanel C={C} queue={queue} related={related}
          song={song} playing={playing}
          onPlay={(s) => {
            ytRef.current?.lockSkip();
            setQueue(q => q.filter(x => x.id !== s.id));
            doPlay(s, { toggle:false, fromQ:true });
          }}
          onRemove={i => setQueue(q => q.filter((_, j) => j !== i))}
          onClose={() => setShowQueue(false)}
          isMobile={mob} />,
        PORTAL_ROOT
      )}

      {showEq && createPortal(
        <Equalizer C={C} eqStore={eqStore}
          onClose={() => setShowEq(false)}
          isMobile={mob}
          isYoutube={!!(song && !song.isLocal)} />,
        PORTAL_ROOT
      )}

      {plModal && createPortal(
        <PlaylistModal C={C} mode={plModal.mode} pl={plModal.pl}
          onSave={(name, desc) =>
            plModal.mode === 'edit'
              ? onEditPl(plModal.pl.id, name, desc)
              : onCreatePl(name, desc)
          }
          onClose={() => setPlModal(null)} />,
        PORTAL_ROOT
      )}

      {showSettings && createPortal(
        <SettingsModal C={C} settings={settings} user={user}
          onSave={s => { saveSettings(s); eqStore.syncToServer(getHeaders()); toast('Settings saved!', 'success'); }}
          onClose={() => setShowSettings(false)} />,
        PORTAL_ROOT
      )}

      {ctxMenu && createPortal(
        <CtxMenu C={C} menu={ctxMenu} playlists={playlists}
          onAction={onCtxAction} onClose={() => setCtxMenu(null)} />,
        PORTAL_ROOT
      )}

      {/* Hidden YouTube audio driver */}
      <YouTubePlayer
        ref={ytRef}
        song={song?.isLocal ? null : song}
        playing={playing} volume={volume} muted={muted}
        onEnded={safeEnd} onProgress={setProgress}
        onError={onErr} onDuration={onDuration} />

      <Toaster toasts={toasts} />
    </div>
  );
}
