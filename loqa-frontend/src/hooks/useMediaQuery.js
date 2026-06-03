import{useState,useEffect}from'react';
export default function useMediaQuery(q){
  const[m,setM]=useState(()=>window.matchMedia(q).matches);
  useEffect(()=>{const mq=window.matchMedia(q);const h=e=>setM(e.matches);mq.addEventListener('change',h);return()=>mq.removeEventListener('change',h);},[q]);
  return m;
}
