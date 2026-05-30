import{useEffect,useCallback}from'react';
export default function useKeyboardShortcuts({song,playing,shuffle,repeat,onTogglePlay,onPrev,onNext,onLike,onToggleShuffle,onToggleRepeat,onToggleMute,onToggleQueue,onVolUp,onVolDown,onSeek,toast}){
  const h=useCallback((e)=>{
    const t=e.target.tagName;
    if(t==='INPUT'||t==='TEXTAREA'||e.target.isContentEditable)return;
    switch(e.code){
      case'Space':e.preventDefault();onTogglePlay();break;
      case'ArrowLeft':e.preventDefault();e.shiftKey?onSeek?.('back5'):onPrev();break;
      case'ArrowRight':e.preventDefault();e.shiftKey?onSeek?.('fwd5'):onNext();break;
      case'ArrowUp':e.preventDefault();onVolUp?.();break;
      case'ArrowDown':e.preventDefault();onVolDown?.();break;
      case'KeyL':if(song)onLike(song.id);break;
      case'KeyS':onToggleShuffle();toast?.(!shuffle?'Shuffle on':'Shuffle off');break;
      case'KeyR':onToggleRepeat();toast?.(!repeat?'Repeat on':'Repeat off');break;
      case'KeyM':onToggleMute();break;
      case'KeyQ':onToggleQueue();break;
      default:
        if(e.code.startsWith('Digit')&&song){const n=parseInt(e.code.slice(5));if(n>=0&&n<=9)onSeek?.(`pct${n*10}`);}
    }
  },[song,playing,shuffle,repeat,onTogglePlay,onPrev,onNext,onLike,onToggleShuffle,onToggleRepeat,onToggleMute,onToggleQueue,onVolUp,onVolDown,onSeek,toast]);
  useEffect(()=>{window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);},[h]);
}
