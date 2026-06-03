import{useEffect}from'react';
export default function useNetworkStatus(toast){
  useEffect(()=>{
    const on=()=>toast?.('Back online','success');
    const off=()=>toast?.('No internet connection','error',5000);
    window.addEventListener('online',on);window.addEventListener('offline',off);
    return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);};
  },[]);
}
