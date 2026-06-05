/**
 * LocalPlayer — plays files from the user's device.
 *
 * Uses:
 *  • File System Access API (Chrome 86+) for persistent handles
 *  • HTMLAudioElement + Web Audio API for playback + EQ
 *  • IndexedDB for track metadata persistence across sessions
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Svg, I, Spinner, EqBars } from './Icons.jsx';
import { fmtTime, gradStr } from '../utils/constants.js';
import { saveLocalTrack, getAllLocalTracks, deleteLocalTrack } from '../utils/indexedDB.js';
import useAudioEQ from '../hooks/useAudioEQ.js';
import useEqStore from '../stores/eqStore.js';

function parseFileMeta(file) {
  // Try "Artist - Title.mp3" pattern
  const base  = file.name.replace(/\.[^.]+$/, '');
  const parts = base.split(' - ');
  return parts.length >= 2
    ? { title: parts.slice(1).join(' - ').trim(), artist: parts[0].trim() }
    : { title: base.trim(), artist: 'Unknown Artist' };
}

export default function LocalPlayer({ C, isMobile, onSwitchToYT }) {
  const [tracks,    setTracks]    = useState([]);
  const [current,   setCurrent]   = useState(null);  // track object
  const [playing,   setPlaying]   = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [volume,    setVolume]    = useState(80);
  const [loading,   setLoading]   = useState(true);
  const [shuffle,   setShuffle]   = useState(false);
  const [repeat,    setRepeat]    = useState(false);
  const [showEq,    setShowEq]    = useState(false);

  const audioRef    = useRef(null);
  const objectURLs  = useRef({});  // trackId → objectURL
  const progTimer   = useRef(null);
  const eqStore     = useEqStore();
  const { buildGraph, resume } = useAudioEQ({
    audioRef,
    bands:   eqStore.bands,
    gain:    eqStore.gain,
    enabled: eqStore.enabled,
  });

  /* ── Load tracks from IndexedDB ─────────────────────── */
  useEffect(() => {
    getAllLocalTracks().then(t => { setTracks(t); setLoading(false); });
  }, []);

  /* ── Add files ──────────────────────────────────────── */
  const addFiles = useCallback(async () => {
    let files = [];
    if ('showOpenFilePicker' in window) {
      try {
        const handles = await window.showOpenFilePicker({
          multiple: true,
          types: [{ description: 'Audio', accept: { 'audio/*': ['.mp3','.wav','.flac','.aac','.ogg','.m4a','.opus'] } }],
        });
        files = await Promise.all(handles.map(h => h.getFile()));
      } catch (e) { if (e.name !== 'AbortError') console.warn(e); return; }
    } else {
      // Fallback: <input type="file">
      files = await new Promise(res => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.multiple = true; inp.accept = 'audio/*';
        inp.onchange = () => res([...inp.files]);
        inp.click();
      });
    }

    const newTracks = [];
    for (const file of files) {
      const id   = `local_${file.name}_${file.lastModified}`;
      const meta = parseFileMeta(file);
      const url  = URL.createObjectURL(file);
      objectURLs.current[id] = url;
      const track = { id, ...meta, size: file.size, type: file.type, lastModified: file.lastModified, ci: newTracks.length % 8 };
      await saveLocalTrack(track);
      newTracks.push(track);
    }
    setTracks(prev => {
      const ids = new Set(prev.map(t => t.id));
      return [...prev, ...newTracks.filter(t => !ids.has(t.id))];
    });
    if (newTracks[0]) playTrack(newTracks[0]);
  }, []);

  /* ── Play a track ───────────────────────────────────── */
  const playTrack = useCallback(async (track) => {
    setCurrent(track);
    setProgress(0);
    const audio = audioRef.current;
    if (!audio) return;

    // Get object URL (re-create if needed)
    let url = objectURLs.current[track.id];
    if (!url) {
      // File not available this session (needs re-selection)
      setCurrent({ ...track, needsFile: true });
      setPlaying(false);
      return;
    }
    audio.src = url;
    audio.volume = volume / 100;
    await audio.play().catch(e => console.warn('[LocalPlayer]', e));
    setPlaying(true);
    buildGraph();
    resume();
  }, [volume, buildGraph, resume]);

  /* ── Audio element events ───────────────────────────── */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (repeat) { audio.currentTime = 0; audio.play(); return; }
      const idx = tracks.findIndex(t => t.id === current?.id);
      if (idx === -1) return;
      const next = shuffle
        ? tracks[Math.floor(Math.random() * tracks.length)]
        : tracks[(idx + 1) % tracks.length];
      if (next) playTrack(next);
      else setPlaying(false);
    };
    const onDuration = () => setDuration(audio.duration || 0);
    const onPlay  = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime  = () => {
      if (audio.duration > 0) setProgress((audio.currentTime / audio.duration) * 100);
    };
    audio.addEventListener('ended',        onEnded);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('play',         onPlay);
    audio.addEventListener('pause',        onPause);
    audio.addEventListener('timeupdate',   onTime);
    return () => {
      audio.removeEventListener('ended',        onEnded);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('play',         onPlay);
      audio.removeEventListener('pause',        onPause);
      audio.removeEventListener('timeupdate',   onTime);
    };
  }, [tracks, current, repeat, shuffle, playTrack]);

  /* ── Volume sync ────────────────────────────────────── */
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  /* ── Seek ───────────────────────────────────────────── */
  const seek = useCallback((pct) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    audio.currentTime = (pct / 100) * audio.duration;
    setProgress(pct);
  }, []);

  /* ── Toggle play ────────────────────────────────────── */
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else { audio.play(); resume(); }
  }, [playing, resume]);

  /* ── Remove track ───────────────────────────────────── */
  const removeTrack = useCallback(async (id) => {
    await deleteLocalTrack(id);
    if (objectURLs.current[id]) { URL.revokeObjectURL(objectURLs.current[id]); delete objectURLs.current[id]; }
    setTracks(prev => prev.filter(t => t.id !== id));
    if (current?.id === id) { audioRef.current?.pause(); setCurrent(null); setPlaying(false); }
  }, [current]);

  const elapsed = (progress / 100) * duration;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="metadata" aria-hidden="true" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: 0 }}>Local Music</h2>
          <p style={{ color: C.text2, fontSize: 13, margin: '4px 0 0' }}>{tracks.length} songs from your device</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowEq(e => !e)} aria-pressed={showEq} aria-label="Equalizer"
            style={{ padding: '8px 14px', background: showEq ? C.accent : C.bg3, border: 'none',
              borderRadius: 10, color: showEq ? '#fff' : C.text2, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            🎛️ EQ
          </button>
          <button onClick={addFiles}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
              background: gradStr(0), border: 'none', borderRadius: 10, color: '#fff',
              fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <Svg d={I.plus} size={14} stroke="#fff" />
            Add Music
          </button>
        </div>
      </div>

      {/* Mini player (when a local track is active) */}
      {current && (
        <div style={{ background: C.bg3, borderRadius: 16, padding: '16px 20px', marginBottom: 20,
          border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: gradStr(current.ci ?? 0),
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {playing ? <EqBars size={22} color="#fff" /> : <Svg d={I.music} size={22} stroke="#fff" fill="rgba(255,255,255,.2)" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {current.needsFile ? '⚠️ File not available — re-add it' : current.title}
              </div>
              <div style={{ fontSize: 12, color: C.text2 }}>{current.artist} · Local file · EQ active</div>
            </div>
            <div className="loqa-local-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => { const idx = tracks.findIndex(t => t.id === current.id); if (idx > 0) playTrack(tracks[idx - 1]); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text }}>
                <Svg d={I.prev} size={18} fill="currentColor" stroke="currentColor" />
              </button>
              <button onClick={togglePlay} disabled={current.needsFile}
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: gradStr(current.ci ?? 0), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Svg d={playing ? I.pause : I.play} size={17} fill="#fff" stroke="#fff" />
              </button>
              <button onClick={() => { const idx = tracks.findIndex(t => t.id === current.id); if (idx < tracks.length - 1) playTrack(tracks[idx + 1]); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text }}>
                <Svg d={I.next} size={18} fill="currentColor" stroke="currentColor" />
              </button>
              <button onClick={() => setShuffle(s => !s)} aria-pressed={shuffle}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: shuffle ? C.accent : C.text3 }}>
                <Svg d={I.shuffle} size={15} stroke="currentColor" />
              </button>
              <button onClick={() => setRepeat(r => !r)} aria-pressed={repeat}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: repeat ? C.accent : C.text3 }}>
                <Svg d={I.repeat} size={15} stroke="currentColor" />
              </button>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: C.text3, minWidth: 32 }}>{fmtTime(elapsed)}</span>
            <div onClick={e => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * 100); }}
              style={{ flex: 1, height: 16, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '100%', height: 4, background: C.bg4, borderRadius: 4, position: 'relative' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: gradStr(current.ci ?? 0), borderRadius: 4 }}>
                  <div style={{ position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)',
                    width: 12, height: 12, borderRadius: '50%', background: '#fff', boxShadow: '0 0 4px rgba(0,0,0,.4)' }} />
                </div>
              </div>
            </div>
            <span style={{ fontSize: 11, color: C.text3, minWidth: 32 }}>{fmtTime(duration)}</span>
            <input type="range" min={0} max={100} value={volume} onChange={e => setVolume(Number(e.target.value))}
              aria-label="Volume" style={{ width: 70, accentColor: C.accent }} />
          </div>
        </div>
      )}

      {/* EQ Panel (inline) */}
      {showEq && (
        <div style={{ background: C.bg3, borderRadius: 16, padding: '16px 20px', marginBottom: 20, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>
            Equalizer <span style={{ fontSize: 11, color: C.accent, fontWeight: 500 }}>Active — real-time audio processing</span>
          </div>
          <div className="loqa-eq-presets" style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
            {['flat','bass','treble','vocal','pop','rock','hiphop','electronic','lofi'].map(p => (
              <button key={p} onClick={() => eqStore.setPreset(p)}
                style={{ padding: '4px 10px', borderRadius: 14, border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: eqStore.preset === p ? C.accent : C.bg4,
                  color: eqStore.preset === p ? '#fff' : C.text2, fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>
                {p}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {['32','64','125','250','500','1K','2K','4K','8K','16K'].map((lbl, i) => (
              <div key={lbl} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 9, color: eqStore.bands[i] > 0 ? C.accent : C.text3 }}>
                  {eqStore.bands[i] > 0 ? '+' : ''}{eqStore.bands[i]}
                </span>
                <input type="range" min={-12} max={12} step={0.5} value={eqStore.bands[i]}
                  onChange={e => eqStore.setBand(i, parseFloat(e.target.value))}
                  style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 80, accentColor: C.accent, cursor: 'pointer' }} />
                <span style={{ fontSize: 9, color: C.text3 }}>{lbl}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Track list */}
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={32} /></div>}
      {!loading && tracks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.text2 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎵</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>No local music yet</div>
          <div style={{ marginBottom: 20 }}>Add MP3, WAV, FLAC, AAC or OGG files from your device</div>
          <button onClick={addFiles}
            style={{ padding: '12px 28px', background: gradStr(0), border: 'none', borderRadius: 12,
              color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Browse Files
          </button>
        </div>
      )}
      {!loading && tracks.length > 0 && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tracks.map((track, i) => {
            const active = current?.id === track.id;
            return (
              <div key={track.id} onClick={() => playTrack(track)}
                className="loqa-song-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, minHeight: 56,
                  background: active ? `rgba(${C.accentRgb},.1)` : 'transparent', cursor: 'pointer',
                  transition: 'background .15s' }}>
                <span style={{ width: 24, textAlign: 'center', fontSize: 12, color: active ? C.accent : C.text3 }}>
                  {active && playing ? <EqBars size={14} color={C.accent} /> : i + 1}
                </span>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: gradStr(track.ci ?? i % 8),
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Svg d={I.music} size={16} stroke="#fff" fill="rgba(255,255,255,.2)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: active ? 600 : 400, color: active ? C.accent : C.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                  <div style={{ fontSize: 12, color: C.text2 }}>{track.artist}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); removeTrack(track.id); }}
                  aria-label="Remove"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 6,
                    opacity: 0, transition: 'opacity .2s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                  <Svg d={I.trash} size={14} stroke="currentColor" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
