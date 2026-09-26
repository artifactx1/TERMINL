import {useEffect,useRef,useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {BARRY,raceTime} from '../../lib/arcade/bot-challenge.mjs';
import {TRACKS,VEHICLES} from '../../lib/arcade/race-sim.mjs';
import s from '../../styles/Campaign.module.css';

export function BotChallengePanel({official,onStart}){
  const c=official.campaign;if(!c?.open)return null;
  return <section className={s.raceChallenge} aria-label='Official bot challenge'>
    <Image src={`/degens/${BARRY.portrait}.webp`} alt='' width={85} height={140}/>
    <div><span className={s.eyebrow}>OFFICIAL CHALLENGE / PRE-MINT POOL</span><h2>Barry thinks you can’t drive.</h2>
      <p>Beat {BARRY.name} in {TRACKS[c.config.track].name}. Finish three laps in under {c.config.targetSeconds} seconds.</p>
      <small>Everyone drives the {VEHICLES[c.config.vehicle].name}. One verified win qualifies you to register. No wallet required.</small>
      {official.error&&<p role='alert' className={s.error}>{official.error}</p>}
    </div><button className={s.primary} disabled={official.status==='starting'} onClick={onStart}>{official.status==='starting'?'SETTING THE GRID…':'PROVE HIM WRONG →'}</button>
  </section>;
}
export function BotVictory({official,onRetry,onLeave}){
  const [publicProfile,setPublicProfile]=useState(false),{result,status,error}=official;
  const dialog=useRef(null);
  useEffect(()=>{const node=dialog.current;node.showModal();return ()=>node.close();},[]);
  const checking=['verifying','racing'].includes(status),won=result?.qualified;
  return <dialog ref={dialog} className={s.victory} aria-label='Official challenge result' onCancel={e=>{e.preventDefault();onLeave();}}><section>
    <span className={s.eyebrow}>TERMINL / OFFICIAL BOT CHALLENGE</span>
    <h2>{checking?'CHECKING THE FINISH.':status==='retry'?'KEEP THAT WIN HERE.':won?'BOT DEFEATED.':'BARRY GOT YOU.'}</h2>
    {checking?<p>Your race is being verified. Hang on to the victory speech.</p>:result&&<>
      <p>{won?BARRY.beaten:BARRY.won}</p>
      <div className={s.resultTimes}><div><small>YOU</small><strong>{raceTime(result.playerTicks)}</strong></div><div><small>BARRYBOT</small><strong>{raceTime(result.botTicks)}</strong></div></div>
      {won?<><h3>YOU QUALIFIED FOR THE PRE-MINT POOL.</h3><p>Save the win to your X account. No wallet connection. No post on your behalf.</p>
        <label className={s.check}><input type='checkbox' checked={publicProfile} onChange={e=>setPublicProfile(e.target.checked)}/>Show my X handle on my public card and leaderboard entry</label>
        <button className={s.primary} disabled={status==='saving'} onClick={()=>official.save(publicProfile)}>{status==='saving'?'SAVING…':'SAVE ACCESS WITH X →'}</button>
        <small className={s.fine}>Pool eligibility, subject to capacity and run review. This does not reserve an NFT or guarantee a mint allocation.</small>
      </>:<p>{result.playerTicks===null?'Finish all three laps next time.':result.winner===0?'You won the race but missed the time target. Trim a few corners.':'Brake before the corner. Boost out. Barry isn’t getting any younger.'}</p>}
    </>}
    {error&&<p role='alert' className={s.error}>{error}</p>}
    {status==='retry'&&<button className={s.primary} onClick={official.submit}>RETRY VERIFICATION</button>}
    {!checking&&<button className={s.secondary} onClick={onRetry}>RUN IT BACK →</button>}
    <button className={s.textButton} onClick={onLeave}>KEEP PLAYING</button>
    <Link className={s.textButton} href='/arcade-pass'>ARCADE PASS ↗</Link>
  </section></dialog>;
}
