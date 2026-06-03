import React from 'react';
export const Svg=({d,d2,size=20,fill='none',stroke='currentColor',strokeWidth=1.75,...p})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}} {...p}>
    <path d={d}/>{d2&&<path d={d2}/>}
  </svg>
);
export const I={
  home:'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  search:'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  lib:'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  heart:'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  play:'M5 3l14 9-14 9V3z',
  pause:'M6 4h4v16H6zM14 4h4v16h-4z',
  prev:'M19 20L9 12l10-8v16zM5 4v16',
  next:'M5 4l10 8-10 8V4zM19 4v16',
  skip10f:'M11 5L6 9H2v6h4l5 4V5z M18 8a6 6 0 0 1 0 8 M15 5l5 5-5 5',
  shuffle:'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  repeat:'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  volX:'M23 9l-6 6M17 9l6 6 M11 5L6 9H2v6h4l5 4V5z',
  volLow:'M11 5L6 9H2v6h4l5 4V5z M15.54 8.46a5 5 0 0 1 0 7.07',
  volHigh:'M11 5L6 9H2v6h4l5 4V5z M15.54 8.46a5 5 0 0 1 0 7.07 M19.07 4.93a10 10 0 0 1 0 14.14',
  queue:'M4 6h16M4 12h16M4 18h16',
  plus:'M12 5v14M5 12h14',
  close:'M18 6 6 18M6 6l12 12',
  menu:'M3 12h18M3 6h18M3 18h18',
  back:'M19 12H5M12 19l-7-7 7-7',
  gear:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  music:'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  logout:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  edit:'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  trash:'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3-3h8',
  share:'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13',
  download:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  trend:'M23 6l-9.5 9.5-5-5L1 18',
  fire:'M12 2c0 0-5 5.5-5 10a5 5 0 0 0 10 0c0-2-1-3.5-1-3.5s-1 1.5-2 1.5-2-2.5-2-4.5z',
  star:'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  dot3:'M5 12h.01M12 12h.01M19 12h.01',
  yt:'M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z M9.75 15.02l5.75-3.02-5.75-3.02v6.04z',
  wave:'M2 12h3l3-8 4 16 3-10 3 6 2-4',
  mic:'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8',
  check:'M20 6 9 17l-5-5',
  info:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8h.01M11 12h1v4h1',
  globe:'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  sun:'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 1 0 0 14A7 7 0 0 0 12 5z',
  moon:'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  lyrics:'M9 18V5l12-2v13 M9 9l12-2 M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M18 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
};
export const EqBars=({size=16,color='currentColor',playing=true})=>(
  <div aria-hidden="true" style={{display:'flex',alignItems:'flex-end',gap:2,height:size,width:size*0.9}}>
    {[0,1,2,3].map(i=>(
      <div key={i} style={{flex:1,background:color,borderRadius:2,minHeight:3,
        animation:playing?`eq${i} ${[0.8,0.6,0.9,0.7][i]}s ease-in-out infinite alternate`:'none',
        height:playing?'100%':'30%',transition:'height .3s'}} />
    ))}
  </div>
);
export const Spinner=({size=20,color='var(--accent)'})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="spin">
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" strokeOpacity="0.2"/>
    <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
