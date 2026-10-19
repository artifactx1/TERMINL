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
  const items=<>
    <span className={styles.mintTickerLead}>MINT OPENS</span>
    <span>{eastern.toUpperCase()}</span>
    <span className={styles.mintTickerSep}>✳</span>
    <span>YOUR TIME · {local||'LOADING…'}</span>
    <span className={styles.mintTickerSep}>✳</span>
    <span>{now===null?'COUNTDOWN LOADING…':now<target?`OPENS IN · ${timeLeft(target-now)}`:'SCHEDULED TIME REACHED · CHECK MINT STATUS BELOW'}</span>
    <span className={styles.mintTickerSep}>✳</span>
    <span className={styles.mintTickerJoke}>BUY HIGH BRIAN SET AN ALARM FOR 9:59</span>
    <span className={styles.mintTickerSep}>✳</span>
    <span className={styles.mintTickerJoke}>MARGIN CALL MAX IS WATCHING HIS LIQUIDATION PRICE</span>
    <span className={styles.mintTickerSep}>✳</span>
    <span className={styles.mintTickerJoke}>EXIT LIQUIDITY ARRIVES FASHIONABLY EARLY</span>
    <span className={styles.mintTickerSep}>✳</span>
  </>;
  return <div className={styles.mintTicker} role='region' aria-label={`Mint opens ${eastern}. ${local?`Your local time is ${local}. `:''}${now!==null&&now<target?`Countdown: ${timeLeft(target-now)}.`:''}`}>
    <div className={styles.mintTickerTrack}>
      <div className={styles.mintTickerGroup} aria-hidden='true'>{items}</div>
      <div className={styles.mintTickerGroup} aria-hidden='true'>{items}</div>
    </div>
  </div>;
}
