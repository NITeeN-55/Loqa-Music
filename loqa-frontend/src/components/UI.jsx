import React,{useState,useRef,useEffect}from'react';
import{gradStr,grad,fmtTime,fmtViews}from'../utils/constants.js';
import{Svg,I,EqBars,Spinner}from'./Icons.jsx';

/* ── Thumbnail ─────────────────────────────────────────── */
export function Thumb({song,size=48,radius=10,playing=false}){
  const[err,setErr]=useState(false);
  const g=gradStr(song?.ci??0);
  if(song?.thumbnail&&!err)return(
    <div style={{width:size,height:size,borderRadius:radius,overflow:'hidden',flexShrink:0,position:'relative'}}>
      <img src={song.thumbnail} alt="" onError={()=>setErr(true)}
        style={{width:'100%',height:'100%',objectFit:'cover'}}/>
      {playing&&<div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <EqBars size={size*0.35} color='#fff' playing/>
      </div>}
    </div>
  );
  return(
    <div style={{width:size,height:size,borderRadius:radius,background:g,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
      <Svg d={I.music} size={size*0.38} stroke="rgba(255,255,255,.7)" fill="rgba(255,255,255,.15)"/>
      {playing&&<div style={{position:'absolute',inset:0,borderRadius:radius,background:'rgba(0,0,0,.35)',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <EqBars size={size*0.35} color='#fff' playing/>
      </div>}
    </div>
  );
}

/* ── SongRow ───────────────────────────────────────────── */
export function SongRow({song,idx,current,playing,liked,onPlay,onLike,onCtx,C,showIdx=true,showDur=true}){
  const[hov,setHov]=useState(false);
  const active=current?.id===song.id;
  return(
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onContextMenu={e=>onCtx?.(e,song)}
      className="loqa-song-row" style={{display:'flex',alignItems:'center',gap:12,padding:'8px 12px',borderRadius:10,
        background:active?`rgba(${C.accentRgb},.1)`:hov?C.bg3:'transparent',
        transition:'background .15s',cursor:'pointer',minHeight:56}}
      onClick={()=>onPlay(song)} role="row" tabIndex={0}
      aria-label={`${song.title} by ${song.artist}`}
      onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPlay(song);}}}>
      {showIdx&&<div style={{width:22,textAlign:'center',fontSize:12,color:active?C.accent:C.text3,flexShrink:0}}>
        {active&&playing?<EqBars size={14} color={C.accent} playing/>:
         hov?<Svg d={I.play} size={14} fill={C.text2} stroke={C.text2}/>:
         <span>{idx+1}</span>}
      </div>}
      <Thumb song={song} size={42} radius={8} playing={active&&playing}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:active?600:400,color:active?C.accent:C.text,
          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{song.title}</div>
        <div style={{fontSize:12,color:C.text2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginTop:1}}>
          {song.artist}{song.views?` · ${fmtViews(song.views)}`:''}
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
        <button onClick={e=>{e.stopPropagation();onLike?.(song.id);}}
          aria-label={liked?'Unlike':'Like'} aria-pressed={liked}
          style={{background:'none',border:'none',cursor:'pointer',padding:4,opacity:liked||hov?1:0,transition:'opacity .2s'}}>
          <Svg d={I.heart} size={14} fill={liked?C.accent2:'none'} stroke={liked?C.accent2:C.text3}/>
        </button>
        {showDur&&<span style={{fontSize:12,color:C.text3,minWidth:32,textAlign:'right'}}>{fmtTime(song.dur)}</span>}
        {onCtx&&<button onClick={e=>{e.stopPropagation();onCtx(e,song);}}
          style={{background:'none',border:'none',cursor:'pointer',padding:4,opacity:hov?1:0,transition:'opacity .2s'}}>
          <Svg d={I.dot3} size={14} stroke={C.text3}/>
        </button>}
      </div>
    </div>
  );
}

/* ── SongCard (grid card) ──────────────────────────────── */
export function SongCard({song,current,playing,liked,onPlay,onLike,onCtx,C}){
  const[hov,setHov]=useState(false);
  const active=current?.id===song.id;
  return(
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onContextMenu={e=>onCtx?.(e,song)}
      style={{background:C.surface,borderRadius:14,overflow:'hidden',cursor:'pointer',
        transition:'transform .2s,box-shadow .2s',transform:hov?'translateY(-3px)':'none',
        boxShadow:hov?`0 12px 40px rgba(${C.accentRgb},.18)`:'none',border:`1px solid ${C.border}`}}
      onClick={()=>onPlay(song)} tabIndex={0}
      onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();onPlay(song);}}}>
      <div style={{position:'relative',paddingTop:'100%'}}>
        <div style={{position:'absolute',inset:0}}>
          <Thumb song={song} size="100%" radius={0} playing={active&&playing}/>
        </div>
        {(hov||active)&&<div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.3)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <button onClick={e=>{e.stopPropagation();onPlay(song);}}
            style={{width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,.95)',border:'none',
              cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
              boxShadow:'0 4px 16px rgba(0,0,0,.3)'}}>
            <Svg d={active&&playing?I.pause:I.play} size={18} fill='#111' stroke='#111'/>
          </button>
        </div>}
      </div>
      <div style={{padding:'10px 12px 12px'}}>
        <div style={{fontSize:13,fontWeight:600,color:active?C.accent:C.text,
          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{song.title}</div>
        <div style={{fontSize:11,color:C.text2,marginTop:2,
          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{song.artist}</div>
      </div>
    </div>
  );
}

/* ── Section ───────────────────────────────────────────── */
export function Section({title,action,onAction,children,C}){
  return(
    <div style={{marginBottom:32}}>
      <div className="loqa-section-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,gap:8}}>
        <h2 style={{fontSize:18,fontWeight:800,color:C.text,margin:0}}>{title}</h2>
        {action&&<button onClick={onAction}
          style={{background:'none',border:'none',cursor:'pointer',color:C.accent,fontSize:13,fontWeight:600,padding:'4px 8px',borderRadius:8}}>
          {action}
        </button>}
      </div>
      {children}
    </div>
  );
}

/* ── HScroll grid ──────────────────────────────────────── */
export function HScroll({children}){
  return(
    <div className="loqa-hscroll" style={{display:'grid',gridAutoFlow:'column',gridAutoColumns:'160px',gap:14,
      overflowX:'auto',paddingBottom:8,scrollSnapType:'x mandatory'}}>
      {React.Children.map(children,c=>c?<div className="loqa-hscroll-item" style={{scrollSnapAlign:'start'}}>{c}</div>:null)}
    </div>
  );
}

/* ── Toast ─────────────────────────────────────────────── */
function Toast({msg,type}){
  const bg={success:'#22c55e',error:'#ef4444',info:'var(--accent)',warning:'#f59e0b'}[type]||'var(--accent)';
  return(
    <div className="fade-up" style={{background:bg,color:'#fff',padding:'10px 16px',borderRadius:10,
      fontSize:13,fontWeight:500,boxShadow:'0 4px 20px rgba(0,0,0,.3)',maxWidth:280,
      display:'flex',alignItems:'center',gap:8}}>
      {msg}
    </div>
  );
}
export function Toaster({toasts}){
  if(!toasts?.length)return null;
  return(
    <div className="loqa-toaster" style={{position:'fixed',bottom:90,right:20,zIndex:9999,display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end'}}>
      {toasts.map(t=><Toast key={t.id} msg={t.msg} type={t.type}/>)}
    </div>
  );
}

/* ── Context Menu ──────────────────────────────────────── */
export function CtxMenu({menu,playlists,onAction,onClose,C}){
  const ref=useRef(null);
  useEffect(()=>{
    const h=(e)=>{if(ref.current&&!ref.current.contains(e.target))onClose();};
    const k=(e)=>{if(e.key==='Escape')onClose();};
    setTimeout(()=>{document.addEventListener('mousedown',h);document.addEventListener('keydown',k);},0);
    return()=>{document.removeEventListener('mousedown',h);document.removeEventListener('keydown',k);};
  },[]);
  const{song}=menu;
  // Clamp to viewport so menu never overflows on small screens
  const vw=window.innerWidth; const vh=window.innerHeight;
  const menuW=210; const menuH=280; // approx
  const x=Math.min(menu.x, vw-menuW-8);
  const y=Math.min(menu.y, vh-menuH-8);
  const item=(label,icon,action,data,danger)=>(
    <button key={action} onClick={()=>onAction(action,song,data)}
      style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'9px 14px',
        background:'none',border:'none',cursor:'pointer',color:danger?'#ef4444':C.text,
        fontSize:13,textAlign:'left',borderRadius:8,transition:'background .1s'}}
      onMouseEnter={e=>e.currentTarget.style.background=C.bg3}
      onMouseLeave={e=>e.currentTarget.style.background='none'}>
      <Svg d={I[icon]} size={14} stroke="currentColor"/>{label}
    </button>
  );
  return(
    <div ref={ref} className="loqa-ctx-menu" style={{position:'fixed',top:y,left:x,zIndex:9000,background:C.surface,
      border:`1px solid ${C.border2}`,borderRadius:14,padding:6,minWidth:210,
      boxShadow:'0 16px 48px rgba(0,0,0,.4)',animation:'fadeIn .15s ease'}}>
      <div style={{padding:'8px 14px 6px',borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:13,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{song.title}</div>
        <div style={{fontSize:11,color:C.text2}}>{song.artist}</div>
      </div>
      <div style={{paddingTop:6}}>
        {item('Play Next','next','playNext')}
        {item('Add to Queue','queue','addQueue')}
        {item('Like','heart','like')}
        {playlists?.length>0&&<div>
          <div style={{fontSize:10,color:C.text3,padding:'4px 14px',fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>Add to Playlist</div>
          {playlists.slice(0,5).map(p=>(
            <button key={p.id} onClick={()=>onAction('addToPlaylist',song,p.id)}
              style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'7px 14px',
                background:'none',border:'none',cursor:'pointer',color:C.text,fontSize:12,textAlign:'left',borderRadius:8}}
              onMouseEnter={e=>e.currentTarget.style.background=C.bg3}
              onMouseLeave={e=>e.currentTarget.style.background='none'}>
              <div style={{width:18,height:18,borderRadius:4,background:gradStr(p.ci),flexShrink:0}}/>
              <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</span>
            </button>
          ))}
        </div>}
        {item('Share','share','share')}
      </div>
    </div>
  );
}

/* ── Player Bar ────────────────────────────────────────── */

// Inject player styles once
let _stylesInjected = false;
function injectPlayerStyles() {
  if (_stylesInjected || document.getElementById('loqa-pb-styles')) { _stylesInjected=true; return; }
  _stylesInjected = true;
  const s = document.createElement('style');
  s.id = 'loqa-pb-styles';
  s.textContent = `
    @keyframes loqa-pulse { 0%,100%{opacity:.55} 50%{opacity:1} }
    @keyframes loqa-pop { from{transform:translateX(-50%) scale(.9);opacity:0} to{transform:translateX(-50%) scale(1);opacity:1} }
    @keyframes loqa-pop-up { from{transform:translateX(-50%) translateY(6px) scale(.95);opacity:0} to{transform:translateX(-50%) translateY(0) scale(1);opacity:1} }
    .loqa-play:hover { transform: scale(1.07) !important; }
    .loqa-ctrl { transition: color .15s, transform .15s, opacity .15s; }
    .loqa-ctrl:hover { opacity:1 !important; transform: scale(1.12); }
    .loqa-like { transition: transform .18s, color .18s; }
    .loqa-like:hover { transform: scale(1.22) !important; }
    .loqa-like:active { transform: scale(.82) !important; }
    .loqa-seek-track { transition: height .18s; }
    .loqa-seek:hover .loqa-seek-track { height: 5px !important; }
    .loqa-vol::-webkit-slider-thumb { -webkit-appearance:none; width:11px; height:11px; border-radius:50%; background:#fff; cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,.5); }
    .loqa-vol::-moz-range-thumb { width:11px; height:11px; border:none; border-radius:50%; background:#fff; cursor:pointer; }
    .loqa-vol { -webkit-appearance:none; appearance:none; height:3px; border-radius:6px; outline:none; cursor:pointer; }
  `;
  document.head.appendChild(s);
}

export function PlayerBar({song,playing,progress,duration,volume,muted,shuffle,repeat,liked,
  onTogglePlay,onPrev,onNext,onSeek,onVolume,onMute,onShuffle,onRepeat,onLike,
  onToggleLyrics,onToggleQueue,showLyrics,showQueue,isMobile,C,playlists,onAddToPlaylist}) {

  const {barRef,down,drag} = useDragSeekLocal(onSeek);
  const [plPop, setPlPop]   = useState(false);
  const [barHov, setBarHov] = useState(false);
  const [volHov, setVolHov] = useState(false);

  useEffect(() => { injectPlayerStyles(); }, []);

  // Close playlist popover on outside click
  useEffect(() => {
    if (!plPop) return;
    const h = () => setPlPop(false);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [plPop]);

  const disp    = drag !== null ? drag : progress;
  const elapsed = (disp / 100) * (duration || 0);
  const vol     = muted ? 0 : volume;
  const vi      = muted || vol === 0 ? I.volX : vol < 50 ? I.volLow : I.volHigh;

  // Pull the song's accent colors from the gradient palette
  const songColor  = song?.ci != null ? grad(song.ci) : ['#6C63FF','#B06AFF'];
  const [c1, c2]   = songColor;
  const glowColor  = c1 + '55';

  // Mobile swipe-to-skip
  const sw = useRef({x:0,y:0});
  const swStart = e => { sw.current = {x:e.touches[0].clientX, y:e.touches[0].clientY}; };
  const swEnd   = e => {
    const dx = e.changedTouches[0].clientX - sw.current.x;
    const dy = Math.abs(e.changedTouches[0].clientY - sw.current.y);
    if (Math.abs(dx) > 50 && dy < 60) { if (dx < 0) onNext(); else onPrev(); try{navigator.vibrate?.(10);}catch{} }
  };

  /* ── Empty state ── */
  if (!song) return (
    <div role="region" aria-label="Music player" style={{
      height: isMobile ? 62 : 80,
      background: C.player,
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderTop: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{color:C.text3, fontSize:13, letterSpacing:.3}}>
        {isMobile ? 'Tap a song to play' : '🎵  Search and play music  ·  Space to play/pause'}
      </span>
    </div>
  );

  /* ── MOBILE ── */
  if (isMobile) return (
    <div role="region" aria-label="Music player" className="loqa-player-mobile" onTouchStart={swStart} onTouchEnd={swEnd}
      style={{
        background: C.player,
        backdropFilter:'blur(32px)', WebkitBackdropFilter:'blur(32px)',
        flexShrink: 0,
        boxShadow: `0 -8px 32px rgba(0,0,0,.35)`,
      }}>
      {/* Accent top line */}
      <div style={{height:2, background:`linear-gradient(90deg,transparent,${c1} 30%,${c2} 70%,transparent)`, opacity:.7}}/>
      {/* Progress */}
      <div style={{height:2, background:C.bg4}}>
        <div style={{height:'100%', background:`linear-gradient(90deg,${c1},${c2})`, width:`${progress}%`, transition:'width .5s linear'}}/>
      </div>
      <div className="loqa-player-mobile-inner" style={{display:'flex', alignItems:'center', gap:10, padding:'10px 14px 13px'}}>
        {/* Thumbnail with glow ring */}
        <div style={{position:'relative', flexShrink:0}}>
          <Thumb song={song} size={46} radius={11} playing={playing}/>
          {playing && <div style={{
            position:'absolute', inset:-3, borderRadius:14,
            border:`1.5px solid ${c1}`, opacity:.7,
            animation:'loqa-pulse 2s ease infinite', pointerEvents:'none',
          }}/>}
        </div>
        {/* Info */}
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{song.title}</div>
          <div style={{fontSize:11,color:C.text3,marginTop:2}}>{song.artist}</div>
        </div>
        {/* Like */}
        <button className="loqa-like" onClick={()=>onLike(song.id)} aria-label={liked?'Unlike':'Like'}
          style={{background:'none',border:'none',cursor:'pointer',padding:7,color:liked?C.accent2:C.text3}}>
          <Svg d={I.heart} size={18} fill={liked?C.accent2:'none'} stroke="currentColor"/>
        </button>
        {/* Prev */}
        <button className="loqa-ctrl" onClick={onPrev} aria-label="Previous"
          style={{background:'none',border:'none',cursor:'pointer',padding:6,color:C.text2,opacity:.8}}>
          <Svg d={I.prev} size={22} fill="currentColor" stroke="currentColor"/>
        </button>
        {/* Play */}
        <button className="loqa-play" onClick={onTogglePlay} aria-label={playing?'Pause':'Play'}
          style={{
            width:46,height:46,borderRadius:'50%',border:'none',cursor:'pointer',
            background:`linear-gradient(135deg,${c1},${c2})`,
            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
            boxShadow:`0 4px 18px ${glowColor}`,
            transition:'transform .15s',
          }}>
          <Svg d={playing?I.pause:I.play} size={17} fill='#fff' stroke='#fff'/>
        </button>
        {/* Next */}
        <button className="loqa-ctrl" onClick={onNext} aria-label="Next"
          style={{background:'none',border:'none',cursor:'pointer',padding:6,color:C.text2,opacity:.8}}>
          <Svg d={I.next} size={22} fill="currentColor" stroke="currentColor"/>
        </button>
      </div>
    </div>
  );

  /* ── DESKTOP ── */
  return (
    <div role="region" aria-label="Music player" style={{
      background: C.player,
      backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
      borderTop: `1px solid rgba(255,255,255,.045)`,
      boxShadow: `0 -1px 0 ${C.border}, 0 -32px 60px rgba(0,0,0,.3)`,
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Dynamic color accent line at very top */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, transparent 4%, ${c1} 32%, ${c2} 68%, transparent 96%)`,
        opacity: .5, pointerEvents:'none',
      }}/>

      <div style={{height:86, display:'flex', alignItems:'center', padding:'0 28px', gap:20}}>

        {/* ── Left: Song info ── */}
        <div style={{width:270, display:'flex', alignItems:'center', gap:14, flexShrink:0}}>

          {/* Thumbnail + glow */}
          <div style={{position:'relative', flexShrink:0}}>
            <Thumb song={song} size={56} radius={13} playing={playing}/>
            {/* Subtle ambient glow behind art */}
            <div style={{
              position:'absolute', inset:-6, borderRadius:18,
              background:`linear-gradient(135deg,${c1},${c2})`,
              opacity: playing ? .28 : .12,
              zIndex:-1, filter:'blur(10px)',
              transition:'opacity .5s',
              pointerEvents:'none',
            }}/>
          </div>

          {/* Title + artist */}
          <div style={{minWidth:0, flex:1}}>
            <div title={song.title} style={{
              fontSize:13.5, fontWeight:700, color:C.text,
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              letterSpacing:-.1,
            }}>{song.title}</div>
            <div style={{
              fontSize:11.5, color:C.text3, marginTop:4,
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            }}>{song.artist}</div>
          </div>

          {/* Like */}
          <button className="loqa-like" onClick={()=>onLike(song.id)}
            aria-label={liked?'Unlike':'Like'} aria-pressed={liked}
            style={{background:'none',border:'none',cursor:'pointer',
              padding:6,color:liked?C.accent2:C.text3,flexShrink:0}}>
            <Svg d={I.heart} size={16} fill={liked?C.accent2:'none'} stroke="currentColor"/>
          </button>

          {/* Add to playlist */}
          {playlists && onAddToPlaylist && (
            <div style={{position:'relative', flexShrink:0}}>
              <button className="loqa-like"
                onClick={e=>{e.stopPropagation(); setPlPop(p=>!p);}}
                aria-label="Add to playlist" aria-expanded={plPop}
                style={{
                  background: plPop ? `rgba(${C.accentRgb},.13)` : 'none',
                  border:'none', borderRadius:8, padding:'5px 6px',
                  cursor:'pointer',
                  color: plPop ? C.accent : C.text3,
                }}>
                <Svg d={I.plus} size={15} stroke="currentColor"/>
              </button>
              {plPop && (
                <div onClick={e=>e.stopPropagation()} style={{
                  position:'absolute', bottom:'calc(100% + 12px)', left:'50%',
                  transform:'translateX(-50%)',
                  background:C.surface, border:`1px solid ${C.border2}`,
                  borderRadius:14,
                  boxShadow:`0 16px 48px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04)`,
                  zIndex:300, minWidth:195, overflow:'hidden',
                  animation:'loqa-pop-up .16s ease',
                }}>
                  <div style={{padding:'11px 14px 6px',fontSize:10,fontWeight:700,
                    color:C.text3,textTransform:'uppercase',letterSpacing:1.3}}>
                    Add to playlist
                  </div>
                  {playlists.length===0 && (
                    <div style={{padding:'8px 14px 12px',fontSize:12,color:C.text2}}>No playlists yet</div>
                  )}
                  {playlists.map(pl=>(
                    <button key={pl.id}
                      onClick={()=>{ onAddToPlaylist(song, pl.id); setPlPop(false); }}
                      style={{display:'flex',alignItems:'center',gap:9,width:'100%',
                        padding:'9px 14px',background:'none',border:'none',cursor:'pointer',
                        color:C.text,fontSize:13,textAlign:'left',fontFamily:'inherit',transition:'background .1s'}}
                      onMouseEnter={e=>e.currentTarget.style.background=C.bg3}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}>
                      <div style={{width:22,height:22,borderRadius:6,background:gradStr(pl.ci??0),flexShrink:0,
                        boxShadow:'0 1px 4px rgba(0,0,0,.3)'}}/>
                      <span style={{flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{pl.name}</span>
                    </button>
                  ))}
                  {/* Bottom padding */}
                  <div style={{height:6}}/>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Center: Controls + Progress ── */}
        <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:11, minWidth:0}}>

          {/* Transport controls */}
          <div style={{display:'flex', alignItems:'center', gap:24}}>

            {/* Shuffle */}
            <div style={{position:'relative'}}>
              <button className="loqa-ctrl" onClick={onShuffle} aria-label="Shuffle" aria-pressed={shuffle}
                style={{background:'none',border:'none',cursor:'pointer',padding:5,
                  color:shuffle?C.accent:C.text3, opacity: shuffle?1:.65}}>
                <Svg d={I.shuffle} size={15} stroke="currentColor"/>
              </button>
              {shuffle && <div style={{
                position:'absolute',bottom:-4,left:'50%',transform:'translateX(-50%)',
                width:4,height:4,borderRadius:'50%',background:C.accent,
              }}/>}
            </div>

            {/* Prev */}
            <button className="loqa-ctrl" onClick={onPrev} aria-label="Previous"
              style={{background:'none',border:'none',cursor:'pointer',color:C.text,padding:5,opacity:.8}}>
              <Svg d={I.prev} size={22} fill="currentColor" stroke="currentColor"/>
            </button>

            {/* Play/Pause — the hero button */}
            <button className="loqa-play" onClick={onTogglePlay} aria-label={playing?'Pause':'Play'}
              style={{
                width:52,height:52,borderRadius:'50%',border:'none',cursor:'pointer',
                background:`linear-gradient(135deg,${c1},${c2})`,
                display:'flex',alignItems:'center',justifyContent:'center',
                flexShrink:0,
                boxShadow:`0 6px 26px ${glowColor}, 0 2px 8px rgba(0,0,0,.35)`,
                transition:'transform .15s, box-shadow .35s',
              }}
              onMouseDown={e=>{e.currentTarget.style.transform='scale(.9)';}}
              onMouseUp={e=>{e.currentTarget.style.transform='';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='';}}>
              <Svg d={playing?I.pause:I.play} size={20} fill='#fff' stroke='#fff'/>
            </button>

            {/* Next */}
            <button className="loqa-ctrl" onClick={onNext} aria-label="Next"
              style={{background:'none',border:'none',cursor:'pointer',color:C.text,padding:5,opacity:.8}}>
              <Svg d={I.next} size={22} fill="currentColor" stroke="currentColor"/>
            </button>

            {/* Repeat */}
            <div style={{position:'relative'}}>
              <button className="loqa-ctrl" onClick={onRepeat} aria-label="Repeat" aria-pressed={repeat}
                style={{background:'none',border:'none',cursor:'pointer',padding:5,
                  color:repeat?C.accent:C.text3, opacity:repeat?1:.65}}>
                <Svg d={I.repeat} size={15} stroke="currentColor"/>
              </button>
              {repeat && <div style={{
                position:'absolute',bottom:-4,left:'50%',transform:'translateX(-50%)',
                width:4,height:4,borderRadius:'50%',background:C.accent,
              }}/>}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{display:'flex', alignItems:'center', gap:10, width:'100%', maxWidth:570}}>

            <span style={{
              fontSize:10.5, color:C.text3, minWidth:36, textAlign:'right',
              fontVariantNumeric:'tabular-nums', letterSpacing:.2,
            }}>{fmtTime(elapsed)}</span>

            {/* Seek area */}
            <div className="loqa-seek"
              ref={barRef} role="slider" aria-label="Seek"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(disp)}
              tabIndex={0}
              onMouseDown={down} onTouchStart={down}
              onMouseEnter={()=>setBarHov(true)} onMouseLeave={()=>setBarHov(false)}
              onKeyDown={e=>{
                if(e.key==='ArrowRight'){e.stopPropagation();onSeek(Math.min(100,progress+2));}
                if(e.key==='ArrowLeft') {e.stopPropagation();onSeek(Math.max(0,progress-2));}
                if(e.key==='Home'){e.preventDefault();onSeek(0);}
                if(e.key==='End') {e.preventDefault();onSeek(100);}
              }}
              style={{flex:1, height:20, display:'flex', alignItems:'center', cursor:'pointer', position:'relative'}}>

              {/* Track */}
              <div className="loqa-seek-track" style={{
                width:'100%', height: barHov || drag!==null ? 5 : 3,
                background:C.bg4, borderRadius:6, position:'relative', overflow:'hidden',
              }}>
                {/* Fill */}
                <div style={{
                  height:'100%', borderRadius:6,
                  background:`linear-gradient(90deg,${c1},${c2})`,
                  width:`${disp}%`,
                  boxShadow: barHov || drag!==null ? `0 0 12px ${c1}70` : 'none',
                  transition: drag!==null ? 'none' : 'width .5s linear, box-shadow .2s',
                }}/>
              </div>

              {/* Thumb dot */}
              <div style={{
                position:'absolute', top:'50%',
                left:`calc(${disp}% - 7px)`,
                transform:`translateY(-50%) scale(${barHov || drag!==null ? 1 : 0})`,
                width:14, height:14, borderRadius:'50%',
                background:'#fff',
                boxShadow:`0 1px 6px rgba(0,0,0,.5), 0 0 0 3px ${c1}35`,
                transition: drag!==null ? 'none' : 'transform .15s',
                pointerEvents:'none',
              }}/>
            </div>

            <span style={{
              fontSize:10.5, color:C.text3, minWidth:36,
              fontVariantNumeric:'tabular-nums', letterSpacing:.2,
            }}>{fmtTime(duration||0)}</span>
          </div>
        </div>

        {/* ── Right: Secondary controls + Volume ── */}
        <div style={{width:250, display:'flex', alignItems:'center', gap:5, justifyContent:'flex-end', flexShrink:0}}>

          {/* Lyrics & Queue pill buttons */}
          <PillBtn label="Lyrics" icon={I.lyrics} active={showLyrics} onClick={onToggleLyrics} C={C}/>
          <PillBtn label="Queue"  icon={I.queue}  active={showQueue}  onClick={onToggleQueue}  C={C}/>

          {/* Thin separator */}
          <div style={{width:1, height:18, background:C.border, margin:'0 5px', flexShrink:0}}/>

          {/* Mute */}
          <button className="loqa-ctrl" onClick={onMute} aria-label={muted?'Unmute':'Mute'}
            style={{background:'none',border:'none',cursor:'pointer',
              color:C.text3,padding:5,flexShrink:0,opacity:.75}}>
            <Svg d={vi} size={16} stroke="currentColor"/>
          </button>

          {/* Volume slider */}
          <div onMouseEnter={()=>setVolHov(true)} onMouseLeave={()=>setVolHov(false)}
            style={{width:82, flexShrink:0}}>
            <input type="range" className="loqa-vol" min={0} max={100} value={vol}
              aria-label="Volume"
              onChange={e=>onVolume(Number(e.target.value))}
              style={{
                width:'100%',
                background:`linear-gradient(90deg,${c1} ${vol}%,${C.bg4} ${vol}%)`,
                opacity: volHov ? 1 : 0.6,
                transition:'opacity .2s',
                accentColor: c1,
              }}/>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Pill button (Lyrics / Queue) ─ */
function PillBtn({label, icon, active, onClick, C}) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={active}
      style={{
        display:'flex', alignItems:'center', gap:5,
        padding:'5px 11px',
        background: active ? `rgba(${C.accentRgb},.14)` : 'transparent',
        border: `1px solid ${active ? `rgba(${C.accentRgb},.28)` : C.border}`,
        borderRadius:8, cursor:'pointer',
        color: active ? C.accent : C.text3,
        fontSize:11, fontWeight:600, fontFamily:'inherit',
        transition:'all .15s',
      }}
      onMouseEnter={e=>{ if(!active){e.currentTarget.style.borderColor=C.border2; e.currentTarget.style.color=C.text2;} }}
      onMouseLeave={e=>{ if(!active){e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.text3;} }}>
      <Svg d={icon} size={13} stroke="currentColor"/>
      {label}
    </button>
  );
}

// Local drag seek (same as hook but inline for PlayerBar)
function useDragSeekLocal(onSeek){
  const barRef=useRef(null);
  const[drag,setDrag]=useState(null);
  const calc=(e)=>{
    const bar=barRef.current;if(!bar)return null;
    const{left,width}=bar.getBoundingClientRect();
    const cx='touches'in e?e.touches[0].clientX:e.clientX;
    return Math.min(100,Math.max(0,((cx-left)/width)*100));
  };
  const down=(e)=>{
    e.preventDefault();const p=calc(e);if(p===null)return;setDrag(p);
    const mv=ev=>{const p=calc(ev);if(p!==null)setDrag(p);};
    const up=ev=>{const p=calc(ev);if(p!==null)onSeek(p);setDrag(null);
      window.removeEventListener('mousemove',mv);window.removeEventListener('mouseup',up);
      window.removeEventListener('touchmove',mv);window.removeEventListener('touchend',up);};
    window.addEventListener('mousemove',mv,{passive:false});window.addEventListener('mouseup',up);
    window.addEventListener('touchmove',mv,{passive:false});window.addEventListener('touchend',up);
  };
  return{barRef,down,drag};
}

