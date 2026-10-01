import {useEffect,useRef} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {BARRY,FCFS_NOTE,ROUTES} from '../../lib/arcade/campaign-rules.mjs';
import {rosterFor} from '../../lib/arcade/rumble-roster.mjs';
import s from '../../styles/Campaign.module.css';

/** Entry card shown in a game menu while that route is open. */
export function OfficialPanel({official,portrait,eyebrow,title,children,action,startLabel,onStart}){
  if(!official.open)return null;
  return <section className={s.raceChallenge} aria-label='Official WL challenge'>
    <Image src={`/degens/${portrait}.webp`} alt='' width={85} height={140}/>
    <div><span className={s.eyebrow}>{eyebrow}</span><h2>{title}</h2>{children}
      <small>Verified by the server. Earns one FCFS WL spot. No wallet required.</small>
      {official.error&&<p role='alert' className={s.error}>{official.error}</p>}
    </div>{action||<button className={s.primary} disabled={official.status==='starting'} onClick={onStart}>{official.status==='starting'?'SETTING UP…':startLabel}</button>}
  </section>;
}
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
      {won?<><h3>YOU EARNED AN FCFS WL SPOT.</h3><p>Save it with X, Farcaster or Discord. No wallet connection and nothing is posted for you.</p>
        <button className={s.primary} disabled={status==='saving'} onClick={official.save}>{status==='saving'?'SAVING…':'SAVE MY WL SPOT →'}</button>
        <small className={s.fine}>{FCFS_NOTE} Spots are awarded in save order while the pool has room.</small>
      </>:<p>Most points across the six races takes the cup. Your race points still count on the leaderboard once you sign in.</p>}
    </>}
    {error&&<p role='alert' className={s.error}>{error}</p>}
    {status==='retry'&&<button className={s.primary} onClick={official.retry}>RETRY VERIFICATION</button>}
    {!checking&&<button className={s.secondary} onClick={onRetry}>{retryLabel}</button>}
    <button className={s.textButton} onClick={onLeave}>BACK TO MENU</button>
    <Link className={s.textButton} href='/arcade-pass'>MY ARCADE PASS ↗</Link>
  </section></dialog>;
}
