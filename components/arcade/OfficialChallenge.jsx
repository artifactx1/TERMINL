import {useEffect,useRef} from 'react';
import Link from 'next/link';
import {BARRY,ROUTES} from '../../lib/arcade/campaign-rules.mjs';
import {rosterFor} from '../../lib/arcade/rumble-roster.mjs';
import {campaignEvent} from '../../lib/arcade/campaign-client';
import ResultShareButton from './ResultShareButton';
import s from '../../styles/Campaign.module.css';

export function VerifiedPointsPrompt({official}){
  if(!official.attempt||!official.last||official.points<=0||official.signedIn)return null;
  return <aside className={s.savePointsPrompt} aria-label='Save verified arcade points'>
    <div><strong>{official.points} VERIFIED POINTS READY</strong><span>Sign in to put this score on the leaderboard, or keep playing and save later.</span></div>
    <Link className={s.primary} href={`/arcade-pass?run=${official.attempt.id}`} onClick={()=>campaignEvent('save_access_click')}>SAVE MY SCORE →</Link>
  </aside>;
}
export function VerifiedSegmentActions({official}){
  if(!official.attempt||!official.last||official.result)return null;
  return <div className={s.verifiedSegmentActions}><VerifiedPointsPrompt official={official}/><ResultShareButton runId={official.attempt.id} label='SHARE THIS VERIFIED RESULT →'/></div>;
}

/** The enrollment window has ended. Normal free-play controls remain available. */
export function OfficialPanel(){ return null; }
function Details({official}){
  const {result,kind}=official;
  if(kind==='cup'){
    const won=result.races.filter(r=>r.order[0]===0&&r.times[0]!==null&&r.times[0]!==r.times[1]).length;
    return <div className={s.resultTimes}><div><small>YOU</small><strong>{result.points[0]} PTS</strong></div><div><small>BARRYBOT</small><strong>{result.points[1]} PTS</strong></div><p>{won} of {result.races.length} races won.</p></div>;
  }
  return <div className={s.resultTimes}><div><small>FIGHTS WON</small><strong>6 / 6</strong></div><div><small>RETRIES</small><strong>{result.losses}</strong></div><p>As {rosterFor(result.character)?.name}.</p></div>;
}
/** Result dialog for a completed official run, or the wait while it is verified. */
export function OfficialResult({official,onRetry,onLeave,retryLabel}){
  const {result,status,error,kind,points}=official;
  const dialog=useRef(null);
  useEffect(()=>{const node=dialog.current;node.showModal();return ()=>node.close();},[]);
  const checking=!result&&status!=='retry',won=result?.qualified;
  const name=ROUTES[kind].name.toUpperCase();
  return <dialog ref={dialog} className={s.victory} aria-label='Official challenge result' onCancel={e=>{e.preventDefault();onLeave();}}><section>
    <span className={s.eyebrow}>TERMINL / OFFICIAL {name}</span>
    <h2>{checking?'CHECKING THE RESULT.':status==='retry'&&!result?'KEEP THIS PAGE OPEN.':won?(kind==='cup'?'CUP SECURED.':'CIRCUIT CLEARED.'):'BARRY TAKES THE CUP.'}</h2>
    {checking&&<p>The server is replaying your last {kind==='cup'?'race':'fight'}. Hang on to the victory speech.</p>}
    {result&&<>
      {kind==='cup'&&<p>{won?BARRY.beaten:BARRY.won}</p>}
      <Details official={official}/>
      <p className={s.points}>+{points} ARCADE POINTS THIS RUN</p>
      <p>Allowlist qualification has closed. This result does not grant new mint access.</p>
      <ResultShareButton runId={official.attempt?.id}/>
    </>}
    {error&&<p role='alert' className={s.error}>{error}</p>}
    {status==='retry'&&<button className={s.primary} onClick={official.retry}>RETRY VERIFICATION</button>}
    {!checking&&<button className={s.secondary} onClick={onRetry}>{retryLabel}</button>}
    <button className={s.textButton} onClick={onLeave}>BACK TO MENU</button>
    <Link className={s.textButton} href='/arcade-pass'>MY ARCADE PASS ↗</Link>
  </section></dialog>;
}
