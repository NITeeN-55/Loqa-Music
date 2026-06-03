import{useEffect}from'react';
export default function useMediaSession({song,playing,duration,onPlay,onPause,onPrev,onNext,onSeek}){
  useEffect(()=>{
    if(!('mediaSession' in navigator)||!song)return;
    navigator.mediaSession.metadata=new MediaMetadata({
      title:song.title||'',artist:song.artist||'',album:song.album||'',
      artwork:song.thumbnail?[{src:song.thumbnail,sizes:'512x512',type:'image/jpeg'}]:[],
    });
  },[song?.id]);
  useEffect(()=>{
    if(!('mediaSession' in navigator))return;
    navigator.mediaSession.playbackState=playing?'playing':'paused';
  },[playing]);
  useEffect(()=>{
    if(!('mediaSession' in navigator))return;
    navigator.mediaSession.setActionHandler('play',onPlay||null);
    navigator.mediaSession.setActionHandler('pause',onPause||null);
    navigator.mediaSession.setActionHandler('previoustrack',onPrev||null);
    navigator.mediaSession.setActionHandler('nexttrack',onNext||null);
    navigator.mediaSession.setActionHandler('seekto',onSeek?e=>onSeek((e.seekTime/Math.max(duration,1))*100):null);
    return()=>{['play','pause','previoustrack','nexttrack','seekto'].forEach(a=>{try{navigator.mediaSession.setActionHandler(a,null);}catch{}});};
  },[onPlay,onPause,onPrev,onNext,onSeek,duration]);
}
