import {useState} from 'react';
import {campaignRequest,campaignEvent} from '../../lib/arcade/campaign-client';
import {resultShareIntent,resultShareText} from '../../lib/arcade/result-share.mjs';
import s from '../../styles/Campaign.module.css';

export function ResultShareActions({run,origin,publicCard=false}){
  const [notice,setNotice]=useState('');
  const url=new URL(`/challenge/${run.code}`,origin).toString();
  const draft=publicCard?`Can you beat this verified ${run.kind==='rumble'?'Rekt Rumble':'Barry Cup'} result?`:resultShareText(run);
  const copy=async()=>{
    try{await navigator.clipboard.writeText(url);campaignEvent('result_link_copied',run.code);setNotice('Result link copied.');}
    catch{setNotice(url);}
  };
  const share=async()=>{
    if(!navigator.share){await copy();return;}
    campaignEvent('native_share_opened',run.code);
    try{await navigator.share({title:'TERMINL Arcade result',text:draft,url});setNotice('Share sheet closed.');}
    catch(error){if(error?.name!=='AbortError')setNotice('Use Copy Link or Post on X to share this result.');}
  };
  return <span className={s.resultShare}>
    <span className={s.actions}>
      <a className={s.primary} href={resultShareIntent(run,origin,draft)} target='_blank' rel='noopener noreferrer' onClick={()=>campaignEvent('share_click',run.code)}>POST SCORE ON X ↗</a>
      <button className={s.secondary} onClick={share}>SHARE RESULT ↗</button>
      <button className={s.secondary} onClick={copy}>COPY RESULT LINK</button>
      {!publicCard&&<a className={s.secondary} href={`/challenge/${run.code}`}>VIEW CARD ↗</a>}
    </span>
    {notice&&<small role='status'>{notice}</small>}
  </span>;
}

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
  return <span className={s.resultShare}>
    {!prepared?<button className={s.primary} disabled={busy} onClick={prepare}>{busy?'PREPARING CARD…':shared?'SHOW RESULT OPTIONS →':label}</button>:<ResultShareActions run={prepared} origin={window.location.origin}/>}
    {notice&&<small role='status'>{notice}</small>}
    {!prepared&&!shared&&<small>Prepare a card after a verified race or fight to earn 5 result XP, up to three rewarded runs in 24 hours. Posting is optional. XP does not affect WL spots or leaderboard rank.</small>}
  </span>;
}
