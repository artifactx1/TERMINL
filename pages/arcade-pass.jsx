import Head from 'next/head';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import CampaignShell from '../components/arcade/CampaignShell';
import {campaignRequest,campaignEvent} from '../lib/arcade/campaign-client';
import {raceTime} from '../lib/arcade/bot-challenge.mjs';
import s from '../styles/Campaign.module.css';

export default function ArcadePass(){
  const [pass,setPass]=useState(null),[campaign,setCampaign]=useState(null),[loaded,setLoaded]=useState(false),[pending,setPending]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[publicProfile,setPublicProfile]=useState(false),[address,setAddress]=useState(''),[confirmed,setConfirmed]=useState(false),[notice,setNotice]=useState('');
  const [clock,setClock]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),15000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{let alive=true;
    (async()=>{try{
      const [session,config]=await Promise.all([campaignRequest('/session'),campaignRequest('/config')]);if(!alive)return;
      setPass(session.pass);setPublicProfile(!!session.pass?.publicProfile);setAddress(session.pass?.wallet?.address||'');setCampaign({...config,clockSkew:(config.serverTime||Date.now())-Date.now()});
      const query=new URLSearchParams(location.search);let runId=query.get('run');try{runId||=sessionStorage.getItem('terminl:official-run');}catch{}
      if(query.get('auth')==='cancelled')setNotice('X sign-in was cancelled. Your verified run is still here.');
      if(query.get('auth')==='failed')setError('X sign-in did not finish. Your verified run is still here. Try again.');
      if(runId&&/^[a-f0-9]{32}$/.test(runId)){const run=await campaignRequest('/runs/'+runId).catch(()=>null);if(alive&&run?.result?.qualified&&!run.saved)setPending(run);}
    }catch(e){if(alive)setError(e.message);}finally{if(alive)setLoaded(true);}})();return()=>{alive=false;};
  },[]);
  const signIn=async()=>{setBusy(true);setError('');try{
    if(pass&&pending){const result=await campaignRequest('/claim',{runId:pending.id,publicProfile});setPass(result.pass);setPending(null);setNotice('Your win is saved.');}
    else {const auth=await campaignRequest('/auth/start',{...(pending?{runId:pending.id}:{}),publicProfile});location.assign(auth.url);}
  }catch(e){setError(e.message);}finally{setBusy(false);}};
  const saveAddress=async e=>{e.preventDefault();setBusy(true);setError('');try{const result=await campaignRequest('/wallet',{address,chainId:4663,confirmed});setPass(result.pass);setNotice('Mint address saved. You can edit it until the displayed deadline.');setConfirmed(false);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const privacy=async value=>{setBusy(true);try{const result=await campaignRequest('/profile',{publicProfile:value});setPass(result.pass);setPublicProfile(value);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const share=run=>{const url=location.origin+'/challenge/'+run.code;const text=`I beat BarryBot in Wen Lambo. ${raceTime(run.result.playerTicks)}.\nBarry would like a recount.\n\nYour turn:`;campaignEvent('share_click',run.code);window.open('https://x.com/intent/post?'+new URLSearchParams({text,url}),'_blank','noopener,noreferrer');};
  const copy=async run=>{try{await navigator.clipboard.writeText(location.origin+'/challenge/'+run.code);setNotice('Challenge link copied. Send it to your loudest friend.');}catch{setNotice('Open your challenge page and copy its address.');}};
  const c=campaign?.config,status=pass?.qualification?.status;
  const serverNow=clock+(campaign?.clockSkew||0);
  const open=c?.addressStartsAt&&c?.addressEndsAt&&serverNow>=c.addressStartsAt&&serverNow<c.addressEndsAt;
  const frozen=c?.addressEndsAt&&serverNow>=c.addressEndsAt;
  return <CampaignShell><Head><title>Your Arcade Pass — TERMINL</title><meta name='robots' content='noindex'/></Head>
    <span className={s.eyebrow}>TERMINL ARCADE PASS</span><h1 className={s.title}>{pass?'@'+pass.username:'Save the win.'}</h1>
    {!loaded&&<p>Finding your pass…</p>}{error&&<p role='alert' className={s.error}>{error}</p>}{notice&&<p role='status' className={s.notice}>{notice}</p>}
    {pending&&<section className={s.card}><span className={s.badge}>BARRYBOT DEFEATED</span><h2>{raceTime(pending.result.playerTicks)}</h2><p>Your race is verified. Save it to your X account to register for the pre-mint pool.</p><label className={s.check}><input type='checkbox' checked={publicProfile} onChange={e=>setPublicProfile(e.target.checked)}/>Show my X handle on public cards and leaderboards</label><button className={s.primary} disabled={busy} onClick={signIn}>SAVE ACCESS WITH X →</button></section>}
    {loaded&&!pass&&!pending&&<section className={s.card}><h2>Already made Barry angry?</h2><p>Sign in with the X account you used to save your win. New here? Race first. We can do introductions afterwards.</p><div className={s.actions}><button className={s.primary} disabled={busy||!campaign?.oauthReady} onClick={signIn}>SIGN IN WITH X →</button><Link className={s.secondary} href='/beat-the-bots'>MEET BARRYBOT →</Link></div><p className={s.fine}>X is used to save your qualification and prevent duplicate claims. We do not post for you.</p></section>}
    {pass&&<>
      <span className={s.badge}>{status==='qualified'?'ARCADE QUALIFIED':status==='review'?'WIN SAVED / UNDER REVIEW':status==='waitlist'?'WIN SAVED / POOL FULL':status==='banned'?'ACCESS SUSPENDED':'PASS CREATED / RACE TO QUALIFY'}</span>
      <p className={s.fine}>{status==='qualified'?'You are eligible for the pre-mint pool. This is not a guaranteed allocation, free NFT or completed mint.':status==='review'?'Your result needs a review before access is awarded. Your win remains saved.':status==='waitlist'?'The current pool is full. Your win is saved; no allocation has been reserved.':'Your saved status appears here.'}</p>
      <div className={s.grid}><section className={s.card}><h2>{pass.runs.filter(r=>r.result.qualified&&!r.invalidated).length}</h2><p>SAVED BOT WINS</p></section><section className={s.card}><h2>{pass.referrals}</h2><p>FRIENDS WHO QUALIFIED</p><small>Only verified wins saved by distinct X accounts count. Clicks earn nothing.</small></section><section className={s.card}><h2>YOUR DISPLAY</h2><label className={s.check}><input type='checkbox' checked={publicProfile} disabled={busy} onChange={e=>privacy(e.target.checked)}/>Show my X handle publicly</label><small>Off means ANON on cards and leaderboards.</small></section></div>
      {status==='qualified'&&pass.runs.filter(r=>r.result.qualified&&!r.invalidated).slice(0,1).map(run=><section className={s.card} key={run.id}><span className={s.eyebrow}>YOUR GROUP CHAT NEEDS THIS</span><h2>Barry lost in {raceTime(run.result.playerTicks)}.</h2><div className={s.actions}><button className={s.primary} onClick={()=>share(run)}>CHALLENGE X ↗</button><button className={s.secondary} onClick={()=>copy(run)}>COPY CHALLENGE LINK</button><Link className={s.secondary} href={'/challenge/'+run.code}>OPEN YOUR CARD →</Link></div><p className={s.fine}>Opens a composer. You decide whether to post.</p></section>)}
      <section className={s.card} style={{marginTop:24}}><span className={s.eyebrow}>MINT ADDRESS / ROBINHOOD CHAIN MAINNET</span><h2>{frozen?'ADDRESS LOCKED FOR MINT':open?'Tell us where you want to mint.':'Address submission opens later.'}</h2>
        {pass.wallet&&<p className={s.address}>{pass.wallet.address}</p>}
        {c?.addressStartsAt>0&&<p className={s.fine}>Opens {new Date(c.addressStartsAt).toLocaleString()} · Closes {new Date(c.addressEndsAt).toLocaleString()}</p>}
        {open&&status==='qualified'?<form onSubmit={saveAddress}><label>PUBLIC WALLET ADDRESS<input name='wallet' value={address} onChange={e=>setAddress(e.target.value)} placeholder='0x…' autoComplete='off' spellCheck={false} maxLength={42} required/></label><label className={s.check}><input type='checkbox' checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} required/>I control this address and want to use it to mint on Robinhood Chain mainnet.</label><button className={s.primary} disabled={busy||!confirmed}>SAVE ADDRESS</button></form>:<p>{frozen?'The editing deadline has passed. Your recorded address is shown above.':'Your saved qualification stays on your Arcade Pass. Return here when the address window opens.'}</p>}
        <p className={s.fine}>Paste a public address only. No wallet connection, signature or transaction. Never enter a seed phrase or private key. Saving an address does not mint anything.</p>
      </section>
      {c?.announcementUrl&&<p><a className={s.secondary} href={c.announcementUrl} target='_blank' rel='noreferrer'>MINT ANNOUNCEMENTS ↗</a></p>}
      <div className={s.actions} style={{marginTop:25}}><Link className={s.primary} href='/os/lambo?challenge=barrybot'>RACE AGAIN →</Link><button className={s.textButton} onClick={async()=>{try{await campaignRequest('/logout',{});setPass(null);setPending(null);}catch(e){setError(e.message);}}}>SIGN OUT</button></div>
    </>}
  </CampaignShell>;
}
