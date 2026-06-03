const GRADS=[
  ['#6C63FF','#B06AFF'],['#FF6584','#FF9A9A'],['#43E97B','#38F9D7'],
  ['#4FACFE','#00F2FE'],['#FA709A','#FEE140'],['#A18CD1','#FBC2EB'],
  ['#FDB99B','#CF8BF3'],['#A1C4FD','#C2E9FB'],
];
export const grad=(ci)=>GRADS[((ci||0)%GRADS.length+GRADS.length)%GRADS.length];
export const gradStr=(ci)=>`linear-gradient(135deg,${grad(ci)[0]},${grad(ci)[1]})`;
export const fmtTime=(s)=>{if(!s||s<0)return'0:00';const m=Math.floor(s/60);return`${m}:${String(Math.floor(s%60)).padStart(2,'0')}`;};
export const fmtViews=(v)=>{if(!v)return'';const n=parseInt(v);if(!n)return v;if(n>=1e9)return(n/1e9).toFixed(1)+'B views';if(n>=1e6)return(n/1e6).toFixed(1)+'M views';if(n>=1e3)return(n/1e3).toFixed(0)+'K views';return n+' views';};

const DARK={
  bg:'#0A0A0F',bg2:'#111118',bg3:'#16161E',bg4:'#1C1C26',
  surface:'#13131A',surface2:'#1A1A24',
  text:'#F0F0FF',text2:'#9090B0',text3:'#5A5A7A',
  accent:'#6C63FF',accent2:'#FF6584',accent3:'#43E97B',
  accentRgb:'108,99,255',
  border:'rgba(255,255,255,.07)',border2:'rgba(255,255,255,.12)',
  player:'rgba(10,10,15,.97)',glass:'rgba(13,13,20,.85)',overlay:'rgba(0,0,0,.75)',
};
const LIGHT={
  bg:'#F4F4F8',bg2:'#ECECF4',bg3:'#E2E2EE',bg4:'#D8D8E8',
  surface:'#FFFFFF',surface2:'#F8F8FC',
  text:'#0D0D1A',text2:'#4A4A6A',text3:'#9090A8',
  accent:'#5B52EE',accent2:'#E0506E',accent3:'#2ECC71',
  accentRgb:'91,82,238',
  border:'rgba(0,0,0,.08)',border2:'rgba(0,0,0,.14)',
  player:'rgba(255,255,255,.97)',glass:'rgba(255,255,255,.9)',overlay:'rgba(0,0,0,.55)',
};
export {DARK,LIGHT};

const LS='lm2';
export const loadLS=()=>{try{return JSON.parse(localStorage.getItem(LS))||{};}catch{return{};}};
export const saveLS=(d)=>{try{localStorage.setItem(LS,JSON.stringify(d));}catch{}};

let _cache={};
try{_cache=JSON.parse(localStorage.getItem('lm_cache'))||{};}catch{}
export function cacheSong(s){
  if(!s?.id)return;
  _cache[s.id]={id:s.id,title:s.title||'Unknown',artist:s.artist||'Unknown',
    album:s.album||'YouTube',dur:s.dur||0,ci:s.ci??0,ai:s.ai??0,
    thumbnail:s.thumbnail||'',views:s.views||'',isYoutube:true};
  try{const k=Object.keys(_cache);if(k.length>300)k.slice(0,100).forEach(x=>delete _cache[x]);
    localStorage.setItem('lm_cache',JSON.stringify(_cache));}catch{}
}
export const getCachedSong=(id)=>id?_cache[id]||null:null;
