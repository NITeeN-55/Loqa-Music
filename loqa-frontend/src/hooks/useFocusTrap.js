import{useEffect}from'react';
export default function useFocusTrap(ref,active){
  useEffect(()=>{
    if(!active||!ref.current)return;
    const el=ref.current;
    const sel='button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
    const all=()=>[...el.querySelectorAll(sel)];
    const h=e=>{
      if(e.key!=='Tab')return;
      const items=all().filter(x=>!x.closest('[hidden]'));
      if(!items.length){e.preventDefault();return;}
      const fi=items[0],li=items[items.length-1];
      if(e.shiftKey){if(document.activeElement===fi){e.preventDefault();li.focus();}}
      else{if(document.activeElement===li){e.preventDefault();fi.focus();}}
    };
    el.addEventListener('keydown',h);
    const first=all()[0];first?.focus();
    return()=>el.removeEventListener('keydown',h);
  },[active]);
}
