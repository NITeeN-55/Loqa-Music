import{useRef,useState,useCallback}from'react';
export default function useDragSeek(onSeek){
  const barRef=useRef(null);
  const[drag,setDrag]=useState(null);
  const calc=useCallback((e)=>{
    const bar=barRef.current;if(!bar)return null;
    const{left,width}=bar.getBoundingClientRect();
    const cx='touches'in e?e.touches[0].clientX:e.clientX;
    return Math.min(100,Math.max(0,((cx-left)/width)*100));
  },[]);
  const down=useCallback((e)=>{
    e.preventDefault();
    const pct=calc(e);if(pct===null)return;
    setDrag(pct);
    const move=(ev)=>{const p=calc(ev);if(p!==null)setDrag(p);};
    const up=(ev)=>{const p=calc(ev);if(p!==null)onSeek(p);setDrag(null);window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up);window.removeEventListener('touchmove',move);window.removeEventListener('touchend',up);};
    window.addEventListener('mousemove',move,{passive:false});
    window.addEventListener('mouseup',up);
    window.addEventListener('touchmove',move,{passive:false});
    window.addEventListener('touchend',up);
  },[calc,onSeek]);
  return{barRef,down,drag};
}
