import Link from 'next/link';
import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';
import CampaignShell from '../components/arcade/CampaignShell';
import ArcadeMeta from '../components/arcade/ArcadeMeta';
import ResultShareButton from '../components/arcade/ResultShareButton';
import {campaignRequest} from '../lib/arcade/campaign-client';
import {FCFS_NOTE,GTD_NOTE,ROUTES,addressWindow,resultSummary,spotLabel} from '../lib/arcade/campaign-rules.mjs';
import s from '../styles/Campaign.module.css';

const FarcasterSignIn=dynamic(()=>import('../components/arcade/FarcasterSignIn'),{ssr:false,loading:()=>null});
const providerName=provider=>provider==='farcaster'?'Farcaster':provider==='discord'?'Discord':'X';
const date=ms=>new Date(ms).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});

function SignInChoices({campaign,runId,publicProfile,busy,onSignIn,onError}){
  const providers=campaign?.providers||{};
  return <div className={s.providerChoices}>
    {providers.farcaster&&<FarcasterSignIn key={String(publicProfile)} runId={runId} publicProfile={publicProfile} onError={onError}/>}
    {providers.discord&&<button className={s.secondary} disabled={busy} onClick={()=>onSignIn('discord')}>CONTINUE WITH DISCORD →</button>}
    {providers.x&&<button className={s.secondary} disabled={busy} onClick={()=>onSignIn('x')}>CONTINUE WITH X →</button>}
  </div>;
}

function WlStatus({pass}){
  const fcfs=pass.fcfs,gtd=pass.gtd;
  return <div className={s.spotGrid}>
    <section className={`${s.card} ${fcfs?.status==='qualified'?s.spotEarned:''}`}><span className={s.eyebrow}>FCFS WL</span><h2>{fcfs?ROUTES[fcfs.route]?.name || 'Saved qualification':'No saved qualification'}</h2><span className={s.badge}>{spotLabel(fcfs?.status)}</span><p>{fcfs?`Saved ${date(fcfs.at)}.`:'The qualification window has closed.'}</p></section>
    <section className={`${s.card} ${gtd?.held?s.spotEarned:''}`}><span className={s.eyebrow}>GTD WL</span><h2>{gtd?.held?'QUALIFIED':'NO SAVED QUALIFICATION'}</h2><p>Check the mint page for your wallet’s existing eligibility.</p></section>
  </div>;
}

function AddressStep({pass,qualified,gtdOpen,config,serverNow,address,setAddress,confirmed,setConfirmed,busy,onSubmit}){
  const window=addressWindow(config||{},serverNow),fcfsOpen=pass.fcfs?.status==='qualified'&&window.open,open=fcfsOpen||gtdOpen,frozen=window.frozen&&!gtdOpen,scheduled=window.scheduled,saved=!!pass.wallet;
  const windowCopy=[config?.addressStartsAt?`Opens ${new Date(config.addressStartsAt).toLocaleString()}`:'',config?.addressEndsAt?`Closes ${new Date(config.addressEndsAt).toLocaleString()}`:''].filter(Boolean).join(' · ');
  return <section id='mint-address' className={`${s.card} ${qualified&&!saved&&open?s.nextStep:''}`}>
    <span className={s.eyebrow}>{qualified&&!saved?'FINAL STEP / WL SETUP':'MINT ADDRESS / ROBINHOOD CHAIN MAINNET'}</span>
    <h2>{!qualified?'No saved mint eligibility.':frozen?'Address locked for mint.':saved?'Mint address saved.':open?'Add your mint address.':'Address submission opens later.'}</h2>
    {saved&&<p className={s.address}>{pass.wallet.address}</p>}
    {scheduled&&windowCopy&&<p className={s.fine}>{windowCopy}</p>}
    {qualified&&open?<form onSubmit={onSubmit}><label>ROBINHOOD CHAIN WALLET ADDRESS<input name='wallet' value={address} onChange={e=>setAddress(e.target.value)} placeholder='0x…' autoComplete='off' spellCheck={false} maxLength={42} required/></label><label className={s.check}><input type='checkbox' checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} required/>I control this address and want to use it to mint on Robinhood Chain mainnet.</label><button className={s.primary} disabled={busy||!confirmed}>{saved?'UPDATE MINT ADDRESS':'SAVE MINT ADDRESS'}</button></form>
      :<p>{qualified?(frozen?'The editing deadline has passed. Your recorded address is shown above.':'Your spot is saved. Come back here when address submission opens.'):'The qualification window has closed. Check your existing eligibility on the mint page.'}</p>}
    <p className={s.fine}>One address covers your FCFS and GTD spots. Paste a public address only: no wallet connection, signature or transaction. Never enter a seed phrase or private key.</p>
  </section>;
}

function Runs({runs,onPrompt}){
  if(!runs.length)return null;
  return <><div className={s.sectionHeading}><h2>RECENT OFFICIAL RUNS</h2></div><div className={s.tableWrap}><table className={s.table}><thead><tr><th>ROUTE</th><th>RESULT</th><th>POINTS</th><th>DATE</th><th>SHARE</th></tr></thead>
    <tbody>{runs.map(run=><tr key={run.id}><td>{ROUTES[run.kind]?.name}</td>
      <td>{run.invalidated?'INVALIDATED':run.result?`${run.result.qualified?'COMPLETED':'CUP LOST'} · ${resultSummary(run.kind,run.result)}`:run.open?(run.kind==='cup'?`IN PROGRESS · RACE ${run.progress.races+1}/6`:`IN PROGRESS · FIGHT ${run.progress.index+1}/6`):'UNFINISHED · EXPIRED'}</td>
      <td>{run.points}</td><td>{date(run.at)}</td><td>{!run.invalidated&&run.segments>0&&<ResultShareButton runId={run.id} shared={run.shareXp!==null} label='PREPARE RESULT →' onPrompt={onPrompt}/>}</td></tr>)}</tbody></table></div></>;
}

export default function ArcadePass(){
  const [pass,setPass]=useState(null),[campaign,setCampaign]=useState(null),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[publicProfile,setPublicProfile]=useState(false),[address,setAddress]=useState(''),[confirmed,setConfirmed]=useState(false),[notice,setNotice]=useState('');
  const [clock,setClock]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),15000);return()=>clearInterval(timer);},[]);
  const loadPass=next=>{setPass(next);setPublicProfile(!!next?.publicProfile);setAddress(next?.wallet?.address||'');};
  useEffect(()=>{let alive=true;
    (async()=>{try{
      const [session,config]=await Promise.all([campaignRequest('/session'),campaignRequest('/config')]);if(!alive)return;
      loadPass(session.pass);setCampaign({...config,clockSkew:(config.serverTime||Date.now())-Date.now()});
      const query=new URLSearchParams(location.search);
      const authProvider=providerName(query.get('provider'));
      if(query.get('auth')==='cancelled')setNotice(authProvider+' sign-in was cancelled. Your verified run is still here.');
      if(query.get('auth')==='failed')setError(authProvider+' sign-in did not finish. Your verified run is still here. Try again.');
    }catch(e){if(alive)setError(e.message);}finally{if(alive)setLoaded(true);}})();return()=>{alive=false;};
  },[]);
  const signIn=async provider=>{setBusy(true);setError('');try{
    const auth=await campaignRequest('/auth/start',{provider,publicProfile});location.assign(auth.url);
  }catch(e){setError(e.message);}finally{setBusy(false);}};
  const saveAddress=async e=>{e.preventDefault();setBusy(true);setError('');try{const result=await campaignRequest('/wallet',{address,chainId:4663,confirmed});loadPass(result.pass);setNotice('Mint address saved. Your WL setup is complete.');setConfirmed(false);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const privacy=async value=>{setBusy(true);try{const result=await campaignRequest('/profile',{publicProfile:value});loadPass(result.pass);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const shareSpot=pass?.fcfs?.status==='qualified'?pass.spots.filter(sp=>sp.route!=='sprint').at(-1):null;
  const shareRun=shareSpot&&pass.runs.find(run=>run.code===shareSpot.code);
  const latestScore=pass?.runs?.find(run=>!run.invalidated&&run.segments>0&&run.points>0);
  const recordShare=(runId,xp)=>setPass(current=>current?{...current,shareXp:(current.shareXp||0)+xp,runs:current.runs.map(run=>run.id===runId?{...run,shareXp:run.shareXp??xp}:run)}:current);
  const copy=async spot=>{try{await navigator.clipboard.writeText(location.origin+'/challenge/'+spot.code);setNotice('Challenge link copied. Send it to your loudest friend.');}catch{setNotice('Open your challenge card and copy its address.');}};
  const gtdOpen=!!pass?.gtd?.held&&pass.gtd.submitOpen,qualified=pass?.fcfs?.status==='qualified'||!!pass?.gtd?.held;
  const serverNow=clock+(campaign?.clockSkew||0);
  return <CampaignShell><ArcadeMeta card='arcade-pass' noindex/>
    <span className={s.eyebrow}>TERMINL ARCADE PASS</span><h1 className={s.title}>{pass?pass.display:'Your Arcade Pass.'}</h1>
    {!loaded&&<p>Finding your pass…</p>}{error&&<p role='alert' className={s.error}>{error}</p>}{notice&&<p role='status' className={s.notice}>{notice}</p>}
    <p className={s.notice}>Allowlist applications and game qualification are closed. Existing records remain available here.</p>
    {loaded&&!pass&&<section className={s.card}><h2>Sign in to view your Arcade Pass.</h2><p>View your saved results and existing WL status.</p><SignInChoices campaign={campaign} publicProfile={false} busy={busy} onSignIn={signIn} onError={setError}/><p className={s.fine}>We request identity only and never post for you.</p></section>}
    {pass&&<>
      {latestScore&&<section className={`${s.card} ${s.nextStep}`}><span className={s.eyebrow}>YOUR SCORE DESERVES A RECEIPT</span><h2>Share your {pass.points} verified points.</h2><p>Make a result card for your latest official run, then post it on X or send the link to a friend.</p><ResultShareButton runId={latestScore.id} shared={latestScore.shareXp!==null} label='MAKE MY SCORE CARD →' onPrompt={recordShare}/></section>}
      <div className={s.grid}>
        <section className={s.card}><span className={s.eyebrow}>ACCOUNT</span><h2>{pass.status==='banned'?'SUSPENDED':pass.status==='review'?'UNDER REVIEW':'ACTIVE'}</h2><p>Signed in with {providerName(pass.provider)}.</p></section>
        <section className={s.card}><span className={s.eyebrow}>ARCADE POINTS</span><h2>{pass.points}</h2><p>{pass.rank?`Rank #${pass.rank} on the `:'Not on the '}<Link href='/leaderboard'>leaderboard</Link>. <b>{pass.shareXp||0} result XP</b> earned from preparing verified result cards; XP does not affect rank or WL spots.</p></section>
        <section className={s.card}><span className={s.eyebrow}>WL</span><h2>{[pass.fcfs?.status==='qualified'&&'FCFS',pass.gtd?.held&&'GTD'].filter(Boolean).join(' + ')||'NONE'}</h2><p>The qualification window has ended.</p></section>
      </div>
      <WlStatus pass={pass} campaign={campaign}/>
      <p className={s.fine}>{FCFS_NOTE} {GTD_NOTE}</p>
      <AddressStep pass={pass} qualified={qualified} gtdOpen={gtdOpen} config={campaign?.config} serverNow={serverNow} address={address} setAddress={setAddress} confirmed={confirmed} setConfirmed={setConfirmed} busy={busy} onSubmit={saveAddress}/>
      {shareSpot&&<section className={s.card}><span className={s.eyebrow}>YOUR GROUP CHAT NEEDS THIS</span><h2>{shareSpot.route==='cup'?'Barry lost the cup.':'Six fights. Six wins.'}</h2><div className={s.actions}><ResultShareButton runId={shareSpot.runId} shared={shareRun?shareRun.shareXp!==null:false} label='PREPARE RESULT CARD →' onPrompt={recordShare}/><button className={s.secondary} onClick={()=>copy(shareSpot)}>COPY CHALLENGE LINK</button><Link className={s.secondary} href={'/challenge/'+shareSpot.code}>OPEN YOUR CARD →</Link></div><p className={s.fine}>Preparing a verified result card earns result XP. Posting it is your choice. New game results do not earn allowlist spots.</p></section>}
      <Runs runs={pass.runs} onPrompt={recordShare}/>
      <section className={s.card}><h2>PUBLIC DISPLAY</h2><label className={s.check}><input type='checkbox' checked={publicProfile} disabled={busy} onChange={e=>privacy(e.target.checked)}/>Show my {pass.provider==='farcaster'?'account ID':'handle'} on cards and the leaderboard</label><small>Off means ANON.</small></section>
      {campaign?.config?.announcementUrl&&<p><a className={s.secondary} href={campaign.config.announcementUrl} target='_blank' rel='noreferrer'>MINT ANNOUNCEMENTS ↗</a></p>}
      <div className={s.actions} style={{marginTop:25}}><Link className={s.primary} href='/os'>PLAY THE FREE ARCADE →</Link><button className={s.textButton} onClick={async()=>{try{await campaignRequest('/logout',{});setPass(null);}catch(e){setError(e.message);}}}>SIGN OUT</button></div>
    </>}
  </CampaignShell>;
}
