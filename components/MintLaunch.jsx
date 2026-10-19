import {useEffect,useState} from 'react';
import styles from '../styles/Terminl.module.css';
import {easternMintTime} from '../lib/mint-launch.mjs';

function timeLeft(ms){
  const seconds=Math.max(0,Math.floor(ms/1000));
  const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600);
  const minutes=Math.floor(seconds%3600/60),rest=seconds%60;
  return `${days}d ${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}m ${String(rest).padStart(2,'0')}s`;
}

export default function MintLaunch({date}){
  const target=easternMintTime(date);
  const [now,setNow]=useState(null);
  useEffect(()=>{
    setNow(Date.now());
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return ()=>clearInterval(timer);
  },[]);
  if(!target)return null;
  const eastern=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(target);
  const local=now===null?null:new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(target);
  return <section className={styles.mintLaunch} aria-label='Scheduled mint opening'>
    <span className={styles.mintLaunchLabel}>MINT OPENS</span>
    <strong>{eastern}</strong>
    <span className={styles.mintLaunchLocal}>YOUR TIME: {local||'Loading…'}</span>
    {now!==null&&<span className={styles.mintLaunchCountdown}>{now<target?<>COUNTDOWN <b>{timeLeft(target-now)}</b></>:<>SCHEDULED TIME REACHED <b>CHECK MINT STATUS BELOW</b></>}</span>}
  </section>;
}
