import Link from 'next/link';
import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';
import CampaignShell from '../components/arcade/CampaignShell';
import ArcadeMeta from '../components/arcade/ArcadeMeta';
import {campaignRequest,campaignEvent} from '../lib/arcade/campaign-client';
import {FCFS_NOTE,OPEN_ROUTES,ROUTES,addressWindow,resultSummary,spotLabel} from '../lib/arcade/campaign-rules.mjs';
import s from '../styles/Campaign.module.css';

const FarcasterSignIn=dynamic(()=>import('../components/arcade/FarcasterSignIn'),{ssr:false,loading:()=>null});
const providerName=provider=>provider==='farcaster'?'Farcaster':provider==='discord'?'Discord':'X';
const identityName=pass=>pass?.provider==='farcaster'?'FID #'+pass.username.replace(/^fid/,''):pass?'@'+pass.username:'';
const date=ms=>new Date(ms).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const PENDING_KEY='terminl:official-run';

function SignInChoices({campaign,runId,publicProfile,busy,onSignIn,onError}){
  const providers=campaign?.providers||{};
  return <div className={s.providerChoices}>
    {providers.farcaster&&<FarcasterSignIn key={String(publicProfile)} runId={runId} publicProfile={publicProfile} onError={onError}/>}
    {providers.discord&&<button className={s.secondary} disabled={busy} onClick={()=>onSignIn('discord')}>CONTINUE WITH DISCORD →</button>}
    {providers.x&&<button className={s.secondary} disabled={busy} onClick={()=>onSignIn('x')}>CONTINUE WITH X →</button>}
  </div>;
}

function Spots({pass,campaign}){
  const held=Object.fromEntries(pass.spots.map(sp=>[sp.route,sp]));
  const routes=[...OPEN_ROUTES,...pass.spots.map(sp=>sp.route).filter(route=>!OPEN_ROUTES.includes(route))];
  return <div className={s.spotGrid}>{routes.map(route=>{const r=ROUTES[route],spot=held[route];
    return <section key={route} className={`${s.card} ${spot?.status==='qualified'?s.spotEarned:''}`}>
      <span className={s.eyebrow}>{r.game.toUpperCase()}</span><h2>{r.name}</h2>
      <span className={s.badge}>{spotLabel(spot?.status)}</span>
      {spot?<p>Saved {date(spot.at)}.{spot.status==='review'?' A reviewer will check this run before the spot is confirmed.':spot.status==='waitlist'?' The pool was full when you saved. No spot is reserved unless one opens.':''}</p>
        :<p>{r.task}</p>}
      {spot?.status==='qualified'&&<Link className={s.textButton} href={'/challenge/'+spot.code}>YOUR CHALLENGE CARD →</Link>}
      {!spot&&!r.legacy&&(campaign?.routes?.[route]?<Link className={s.secondary} href={r.href}>PLAY {r.name.toUpperCase()} →</Link>:<p className={s.fine}>Not open for WL right now.</p>)}
    </section>;})}</div>;
}

function AddressStep({pass,qualified,config,serverNow,address,setAddress,confirmed,setConfirmed,busy,onSubmit}){
  const {open,frozen,scheduled}=addressWindow(config||{},serverNow),saved=!!pass.wallet;
  const windowCopy=[config?.addressStartsAt?`Opens ${new Date(config.addressStartsAt).toLocaleString()}`:'',config?.addressEndsAt?`Closes ${new Date(config.addressEndsAt).toLocaleString()}`:''].filter(Boolean).join(' · ');
  return <section id='mint-address' className={`${s.card} ${qualified&&!saved&&open?s.nextStep:''}`}>
    <span className={s.eyebrow}>{qualified&&!saved?'FINAL STEP / WL SETUP':'MINT ADDRESS / ROBINHOOD CHAIN MAINNET'}</span>
    <h2>{!qualified?'Earn a WL spot first.':frozen?'Address locked for mint.':saved?'Mint address saved.':open?'Add your mint address.':'Address submission opens later.'}</h2>
    {saved&&<p className={s.address}>{pass.wallet.address}</p>}
    {scheduled&&windowCopy&&<p className={s.fine}>{windowCopy}</p>}
    {qualified&&open?<form onSubmit={onSubmit}><label>ROBINHOOD CHAIN WALLET ADDRESS<input name='wallet' value={address} onChange={e=>setAddress(e.target.value)} placeholder='0x…' autoComplete='off' spellCheck={false} maxLength={42} required/></label><label className={s.check}><input type='checkbox' checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} required/>I control this address and want to use it to mint on Robinhood Chain mainnet.</label><button className={s.primary} disabled={busy||!confirmed}>{saved?'UPDATE MINT ADDRESS':'SAVE MINT ADDRESS'}</button></form>
      :<p>{qualified?(frozen?'The editing deadline has passed. Your recorded address is shown above.':'Your spot is saved. Come back here when address submission opens.'):'Complete the Barry Cup or the Rekt Rumble circuit and save the result. The address step unlocks with your first confirmed spot.'}</p>}
    <p className={s.fine}>One address covers every spot on this pass. Paste a public address only: no wallet connection, signature or transaction. Never enter a seed phrase or private key.</p>
  </section>;
}

function Runs({runs}){
  if(!runs.length)return null;
  return <><div className={s.sectionHeading}><h2>RECENT OFFICIAL RUNS</h2></div><div className={s.tableWrap}><table className={s.table}><thead><tr><th>ROUTE</th><th>RESULT</th><th>POINTS</th><th>DATE</th></tr></thead>
    <tbody>{runs.map(run=><tr key={run.id}><td>{ROUTES[run.kind]?.name}</td>
      <td>{run.invalidated?'INVALIDATED':run.result?`${run.result.qualified?'COMPLETED':'CUP LOST'} · ${resultSummary(run.kind,run.result)}`:run.open?(run.kind==='cup'?`IN PROGRESS · RACE ${run.progress.races+1}/6`:`IN PROGRESS · FIGHT ${run.progress.index+1}/6`):'UNFINISHED · EXPIRED'}</td>
      <td>{run.points}</td><td>{date(run.at)}</td></tr>)}</tbody></table></div></>;
}

export default function ArcadePass(){
  const [pass,setPass]=useState(null),[campaign,setCampaign]=useState(null),[loaded,setLoaded]=useState(false),[pending,setPending]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[publicProfile,setPublicProfile]=useState(false),[address,setAddress]=useState(''),[confirmed,setConfirmed]=useState(false),[notice,setNotice]=useState('');
  const [clock,setClock]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),15000);return()=>clearInterval(timer);},[]);
  const loadPass=next=>{setPass(next);setPublicProfile(!!next?.publicProfile);setAddress(next?.wallet?.address||'');};
  useEffect(()=>{let alive=true;
    (async()=>{try{
      const [session,config]=await Promise.all([campaignRequest('/session'),campaignRequest('/config')]);if(!alive)return;
      loadPass(session.pass);setCampaign({...config,clockSkew:(config.serverTime||Date.now())-Date.now()});
      const query=new URLSearchParams(location.search);let runId=query.get('run');try{runId||=sessionStorage.getItem(PENDING_KEY);}catch{}
      const authProvider=providerName(query.get('provider'));
      if(query.get('auth')==='cancelled')setNotice(authProvider+' sign-in was cancelled. Your verified run is still here.');
      if(query.get('auth')==='failed')setError(authProvider+' sign-in did not finish. Your verified run is still here. Try again.');
      if(query.get('saved')){
        const saved=session.pass?.spots.find(sp=>sp.code===query.get('saved'));
        if(saved)setNotice(saved.status==='qualified'?`${ROUTES[saved.route].name} FCFS WL spot saved.${session.pass.wallet?'':' Add your mint address below to finish setup.'}`:`${ROUTES[saved.route].name} result saved: ${spotLabel(saved.status).toLowerCase()}.`);
        try{sessionStorage.removeItem(PENDING_KEY);}catch{}
      }
      if(runId&&/^[a-f0-9]{32}$/.test(runId)){const run=await campaignRequest('/runs/'+runId).catch(()=>null);if(alive&&run?.result?.qualified&&!run.saved)setPending(run);}
    }catch(e){if(alive)setError(e.message);}finally{if(alive)setLoaded(true);}})();return()=>{alive=false;};
  },[]);
  const signIn=async provider=>{setBusy(true);setError('');try{
    if(pass&&pending){
      const result=await campaignRequest('/claim',{runId:pending.id,publicProfile});loadPass(result.pass);setPending(null);try{sessionStorage.removeItem(PENDING_KEY);}catch{}
      setNotice(result.already?`You already hold a ${ROUTES[result.route].name} spot. This run’s points are on your pass.`:result.status==='qualified'?`${ROUTES[result.route].name} FCFS WL spot saved.`:`${ROUTES[result.route].name} result saved: ${spotLabel(result.status).toLowerCase()}.`);
    }
    else {const auth=await campaignRequest('/auth/start',{provider,...(pending?{runId:pending.id}:{}),publicProfile});location.assign(auth.url);}
  }catch(e){setError(e.message);}finally{setBusy(false);}};
  const saveAddress=async e=>{e.preventDefault();setBusy(true);setError('');try{const result=await campaignRequest('/wallet',{address,chainId:4663,confirmed});loadPass(result.pass);setNotice('Mint address saved. Your WL setup is complete.');setConfirmed(false);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const privacy=async value=>{setBusy(true);try{const result=await campaignRequest('/profile',{publicProfile:value});loadPass(result.pass);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const shareSpot=pass?.spots.filter(sp=>sp.status==='qualified'&&sp.route!=='sprint').at(-1);
  const share=spot=>{const url=location.origin+'/challenge/'+spot.code;const text=spot.route==='cup'?'I took the Barry Cup off BarryBot in Wen Lambo.\nBarry would like a recount.\n\nYour turn:':'I cleared all six fights in the Rekt Rumble circuit.\n\nYour turn:';campaignEvent('share_click',spot.code);window.open('https://x.com/intent/post?'+new URLSearchParams({text,url}),'_blank','noopener,noreferrer');};
  const copy=async spot=>{try{await navigator.clipboard.writeText(location.origin+'/challenge/'+spot.code);setNotice('Challenge link copied. Send it to your loudest friend.');}catch{setNotice('Open your challenge card and copy its address.');}};
  const qualified=!!pass?.spots.some(sp=>sp.status==='qualified');
  const serverNow=clock+(campaign?.clockSkew||0);
  return <CampaignShell><ArcadeMeta card='arcade-pass' noindex/>
    <span className={s.eyebrow}>TERMINL ARCADE PASS</span><h1 className={s.title}>{pass?identityName(pass):'Your Arcade Pass.'}</h1>
    {!loaded&&<p>Finding your pass…</p>}{error&&<p role='alert' className={s.error}>{error}</p>}{notice&&<p role='status' className={s.notice}>{notice}</p>}
    {pending&&<section className={`${s.card} ${s.nextStep}`}><span className={s.badge}>{ROUTES[pending.kind].name.toUpperCase()} COMPLETE</span><h2>{resultSummary(pending.kind,pending.result)}</h2><p>Your run is verified. Save it to claim its FCFS WL spot.</p><label className={s.check}><input type='checkbox' checked={publicProfile} onChange={e=>setPublicProfile(e.target.checked)}/>Show my handle or account ID on public cards and the leaderboard</label>{pass?<button className={s.primary} disabled={busy} onClick={()=>signIn()}>SAVE TO MY ARCADE PASS →</button>:<SignInChoices campaign={campaign} runId={pending.id} publicProfile={publicProfile} busy={busy} onSignIn={signIn} onError={setError}/>}<p className={s.fine}>We request identity only. No wallet connection and nothing is posted on your behalf. {FCFS_NOTE}</p></section>}
    {loaded&&!pass&&!pending&&<section className={s.card}><h2>Log in to see your spots and points.</h2><p>Use the identity you saved your WL spot with. Your pass shows which spots you hold, your arcade points and leaderboard rank, and your mint address.</p><SignInChoices campaign={campaign} publicProfile={false} busy={busy} onSignIn={signIn} onError={setError}/><div className={s.actions}><Link className={s.secondary} href='/beat-the-bots'>HOW TO EARN A SPOT →</Link></div><p className={s.fine}>Identity is used to recover your Arcade Pass and stop duplicate claims. We request no email and never post for you.</p></section>}
    {pass&&<>
      <div className={s.grid}>
        <section className={s.card}><span className={s.eyebrow}>ACCOUNT</span><h2>{pass.status==='banned'?'SUSPENDED':pass.status==='review'?'UNDER REVIEW':'ACTIVE'}</h2><p>Signed in with {providerName(pass.provider)}.</p></section>
        <section className={s.card}><span className={s.eyebrow}>ARCADE POINTS</span><h2>{pass.points}</h2><p>{pass.rank?`Rank #${pass.rank} on the `:'Not on the '}<Link href='/leaderboard'>leaderboard</Link>.</p></section>
        <section className={s.card}><span className={s.eyebrow}>FCFS WL SPOTS</span><h2>{pass.spots.filter(sp=>sp.status==='qualified').length}</h2><p>{pass.referrals?`${pass.referrals} friend${pass.referrals===1?'':'s'} earned a spot from your link.`:'One spot per route.'}</p></section>
      </div>
      <Spots pass={pass} campaign={campaign}/>
      <p className={s.fine}>{FCFS_NOTE}</p>
      <AddressStep pass={pass} qualified={qualified} config={campaign?.config} serverNow={serverNow} address={address} setAddress={setAddress} confirmed={confirmed} setConfirmed={setConfirmed} busy={busy} onSubmit={saveAddress}/>
      {shareSpot&&<section className={s.card}><span className={s.eyebrow}>YOUR GROUP CHAT NEEDS THIS</span><h2>{shareSpot.route==='cup'?'Barry lost the cup.':'Six fights. Six wins.'}</h2><div className={s.actions}><button className={s.primary} onClick={()=>share(shareSpot)}>CHALLENGE ON X ↗</button><button className={s.secondary} onClick={()=>copy(shareSpot)}>COPY CHALLENGE LINK</button><Link className={s.secondary} href={'/challenge/'+shareSpot.code}>OPEN YOUR CARD →</Link></div><p className={s.fine}>Opens a composer. You decide whether to post. A referral counts when a new player saves a confirmed spot through your link.</p></section>}
      <Runs runs={pass.runs}/>
      <section className={s.card}><h2>PUBLIC DISPLAY</h2><label className={s.check}><input type='checkbox' checked={publicProfile} disabled={busy} onChange={e=>privacy(e.target.checked)}/>Show my {pass.provider==='farcaster'?'account ID':'handle'} on cards and the leaderboard</label><small>Off means ANON.</small></section>
      {campaign?.config?.announcementUrl&&<p><a className={s.secondary} href={campaign.config.announcementUrl} target='_blank' rel='noreferrer'>MINT ANNOUNCEMENTS ↗</a></p>}
      <div className={s.actions} style={{marginTop:25}}><Link className={s.primary} href='/beat-the-bots'>EARN MORE POINTS →</Link><button className={s.textButton} onClick={async()=>{try{await campaignRequest('/logout',{});setPass(null);setPending(null);}catch(e){setError(e.message);}}}>SIGN OUT</button></div>
    </>}
  </CampaignShell>;
}
