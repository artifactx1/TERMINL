import {useState} from 'react';
import {campaignRequest,campaignEvent} from '../../lib/arcade/campaign-client';
import {resultShareIntent} from '../../lib/arcade/result-share.mjs';
import s from '../../styles/Campaign.module.css';

/** Preparing a verified result card earns XP; opening X is a separate choice. */
export default function ResultShareButton({runId,shared=false,label='PREPARE MY RESULT CARD →',onPrompt}){
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [prepared,setPrepared]=useState(null);
  const prepare=async()=>{
    if(busy)return;
    setBusy(true);setNotice('');
    try{
      const {run,xpAwarded}=await campaignRequest('/prepare-result',{runId});
      onPrompt?.(runId,xpAwarded);
      setPrepared(run);
      setNotice(xpAwarded?`+${xpAwarded} result XP earned. Your card is ready.`:'Your result card is ready.');
    }catch(error){setNotice(error.message);}
    finally{setBusy(false);}
  };
  const copy=async()=>{
    try{await navigator.clipboard.writeText(`${window.location.origin}/challenge/${prepared.code}`);setNotice('Result link copied.');}
    catch{setNotice('Open your result card and copy its address.');}
  };
  return <span className={s.resultShare}>
    {!prepared?<button className={s.secondary} disabled={busy} onClick={prepare}>{busy?'PREPARING CARD…':shared?'SHOW RESULT OPTIONS →':label}</button>:<span className={s.actions}>
      <a className={s.primary} href={resultShareIntent(prepared,window.location.origin)} target='_blank' rel='noopener noreferrer' onClick={()=>campaignEvent('share_click',prepared.code)}>POST ON X ↗</a>
      <button className={s.secondary} onClick={copy}>COPY RESULT LINK</button>
      <a className={s.secondary} href={`/challenge/${prepared.code}`}>VIEW CARD ↗</a>
    </span>}
    {notice&&<small role='status'>{notice}</small>}
    {!prepared&&!shared&&<small>Prepare a card after a verified race or fight to earn 5 result XP, up to three rewarded runs in 24 hours. Posting is optional. XP does not affect WL spots or leaderboard rank.</small>}
  </span>;
}
