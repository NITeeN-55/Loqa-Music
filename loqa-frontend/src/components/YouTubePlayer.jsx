import React,{useEffect,useRef,useState}from'react';
let _ready=false,_cbs=[];
function loadAPI(){
  if(_ready)return Promise.resolve();
  return new Promise(res=>{
    _cbs.push(res);
    if(!window._ytScriptLoaded){
      window._ytScriptLoaded=true;
      const prev=window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady=()=>{_ready=true;if(prev)prev();_cbs.forEach(c=>c());_cbs=[];};
      const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';document.head.appendChild(s);
    }
  });
}
const YTP=React.forwardRef(function YTP({song,playing,volume,muted,onEnded,onProgress,onError,onDuration},ref){
  const div=useRef(null);const yt=useRef(null);const[ready,setReady]=useState(false);
  const loadedId=useRef(null);const loading=useRef(false);const guard=useRef(false);
  const ipr=useRef(playing);const cbr=useRef({onEnded,onProgress,onError,onDuration});
  useEffect(()=>{ipr.current=playing;});
  useEffect(()=>{cbr.current={onEnded,onProgress,onError,onDuration};});

  React.useImperativeHandle(ref,()=>({
    seekTo:(pct)=>{try{const d=yt.current?.getDuration?.();if(d>0)yt.current.seekTo((pct/100)*d,true);}catch{}},
    lockSkip:()=>{guard.current=true;loading.current=true;setTimeout(()=>{guard.current=false;loading.current=false;},900);},
  }),[]);

  useEffect(()=>{
    let alive=true;
    loadAPI().then(()=>{
      if(!alive||!div.current)return;
      yt.current=new window.YT.Player(div.current,{
        height:'1',width:'1',
        playerVars:{autoplay:0,controls:0,rel:0,playsinline:1,modestbranding:1,iv_load_policy:3,disablekb:1,origin:window.location.origin},
        events:{
          onReady:()=>{if(alive)setReady(true);},
          onStateChange:({data:s})=>{
            const S=window.YT?.PlayerState;if(!S)return;
            if(s===S.ENDED){if(guard.current)return;guard.current=true;cbr.current.onEnded?.();setTimeout(()=>{guard.current=false;},700);return;}
            if(s===S.PLAYING){loading.current=false;try{const d=yt.current?.getDuration?.();if(d>0)cbr.current.onDuration?.(d);}catch{}if(!ipr.current)try{yt.current?.pauseVideo();}catch{}return;}
            if(s===S.PAUSED&&ipr.current&&!loading.current){setTimeout(()=>{if(ipr.current&&!loading.current)try{yt.current?.playVideo();}catch{}},200);}
          },
          onError:({data})=>{loading.current=false;cbr.current.onError?.(data);},
        },
      });
    });
    return()=>{alive=false;setReady(false);loadedId.current=null;try{yt.current?.destroy();}catch{}yt.current=null;};
  },[]);

  // Single effect handles BOTH song change AND play/pause
  useEffect(()=>{
    if(!ready||!yt.current)return;
    if(!song?.id){try{yt.current.pauseVideo();}catch{}return;}
    if(song.id!==loadedId.current){
      loadedId.current=song.id;loading.current=true;
      try{yt.current.loadVideoById({videoId:song.id,startSeconds:0});}
      catch(e){loading.current=false;console.warn('[YT]',e);}
      return;
    }
    if(loading.current)return;
    try{if(playing)yt.current.playVideo();else yt.current.pauseVideo();}catch{}
  },[song?.id,playing,ready]);

  useEffect(()=>{if(!ready)return;try{yt.current?.setVolume(muted?0:Math.max(0,Math.min(100,volume)));}catch{};},[volume,muted,ready]);

  useEffect(()=>{
    if(!ready||!playing)return;
    const id=setInterval(()=>{
      try{const t=yt.current?.getCurrentTime?.()??0,d=yt.current?.getDuration?.()??0;if(d>0)cbr.current.onProgress?.((t/d)*100);}catch{}
    },500);
    return()=>clearInterval(id);
  },[playing,ready]);

  return<div ref={div} aria-hidden="true" style={{position:'fixed',top:-9999,left:-9999,width:2,height:2,pointerEvents:'none'}}/>;
});
export default YTP;
