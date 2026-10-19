import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useAccount} from 'wagmi';
import CampaignShell from '../components/arcade/CampaignShell';
import {campaignRequest} from '../lib/arcade/campaign-client';
import s from '../styles/Campaign.module.css';

const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const X_PROFILE='https://x.com/TERMINLnet';

export default function WlApplication(){
  const {address:connectedAddress}=useAccount();
  const [address,setAddress]=useState(''),[email,setEmail]=useState(''),[requestedKind,setRequestedKind]=useState('fcfs');
  const [emailConsent,setEmailConsent]=useState(false),[website,setWebsite]=useState(''),[postUrl,setPostUrl]=useState(X_PROFILE);
  const [openedFollow,setOpenedFollow]=useState(false),[openedPost,setOpenedPost]=useState(false),[socialConfirmed,setSocialConfirmed]=useState(false);
  const [applyBusy,setApplyBusy]=useState(false),[error,setError]=useState(''),[received,setReceived]=useState(false);
  useEffect(()=>{
    if(ADDRESS.test(connectedAddress||'')){setAddress(connectedAddress);setReceived(false);}
  },[connectedAddress]);
  useEffect(()=>{
    let active=true;
    void campaignRequest('/config').then(({config})=>{if(active&&config?.wlPostUrl)setPostUrl(config.wlPostUrl);}).catch(()=>{});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{setOpenedPost(false);setSocialConfirmed(false);},[postUrl]);
  const socialReady=openedFollow&&openedPost&&socialConfirmed;
  const apply=async e=>{
    e.preventDefault();setError('');setReceived(false);
    if(!socialReady){setError('Open both X links and confirm the follow, like, and repost steps.');return;}
    if(!ADDRESS.test(address.trim())){setError('Paste a public 0x wallet address.');return;}
    setApplyBusy(true);
    try{await campaignRequest('/wl/apply',{address:address.trim(),email,requestedKind,emailConsent,socialConfirmed,website});setReceived(true);}
    catch(e){setError(e.message);}
    finally{setApplyBusy(false);}
  };
  return <CampaignShell><Head><title>Enter the WL draw — TERMINL</title><meta name='description' content='Enter the TERMINL GTD or FCFS allowlist draw. Selected applicants will be emailed after October 26, 2026.'/></Head>
    <section className={s.wlHero}>
      <div className={s.wlHeroCopy}><span className={s.eyebrow}>TERMINL / ALLOWLIST APPLICATION</span>
        <h1>No time to grind?<br/><em>Get in the draw.</em></h1>
        <p>Can&apos;t live in the Arcade? Here&apos;s another way in. Put your wallet up for a GTD or FCFS spot, show TERMINL some love on X, and take your shot.</p>
        <div className={s.wlDate}><strong>OCT 26, 2026</strong><span>WL draw · selected applicants emailed after the draw</span></div>
        <a className={s.primary} href='#apply'>ENTER THE DRAW ↓</a>
      </div>
      <div className={s.wlArt} aria-label='TERMINL collection art preview'>
        <figure className={s.wlArtMain}><Image src='/art/4b8ac4791a5855a4.webp' alt='Buy High Brian at the Dogecoin arcade terminal' width={650} height={650} priority/><figcaption>BUY HIGH BRIAN</figcaption></figure>
        <figure><Image src='/art/ce26e6ae12adc34d.webp' alt='Margin Call Max at the Zcash arcade terminal' width={400} height={400}/><figcaption>MARGIN CALL MAX</figcaption></figure>
        <figure><Image src='/art/d466f9bcb42e88c1.webp' alt='Pump Queen Priya at the Fartcoin arcade terminal' width={400} height={400}/><figcaption>PUMP QUEEN PRIYA</figcaption></figure>
      </div>
    </section>
    <div className={s.wlFactStrip}><span><b>01</b> FOLLOW + BOOST ON X</span><span><b>02</b> ENTER YOUR WALLET</span><span><b>03</b> WATCH YOUR EMAIL AFTER OCT 26</span></div>
    <section className={s.wlApply} id='apply'><div className={s.wlApplyIntro}><span className={s.eyebrow}>YOUR SHOT / GTD OR FCFS</span><h2>Put your wallet in the mix.</h2>
      <p>Follow <strong>@TERMINLnet</strong>, like and repost the WL post, then send your entry. We&apos;ll make selections on October 26 and email selected applicants.</p>
      <p className={s.fine}>GTD means a guaranteed allowlist allocation under the final mint terms. FCFS gives access while the allowlist phase has supply. An application is an entry, not a guaranteed spot or mint.</p>
      <Link className={s.secondary} href='/beat-the-bots'>WANT TO EARN A SPOT? PLAY THE ARCADE ↗</Link>
    </div>
    <div className={`${s.card} ${s.wlFormCard}`}><span className={s.eyebrow}>APPLICATION / 01—03</span><form onSubmit={apply}>
      <div className={s.wlFormSection}><h3>01 / Show some love on X</h3><p>Open both links, then confirm you completed the steps. We can&apos;t verify X actions automatically.</p>
        <div className={s.wlSocialLinks}><a href={X_PROFILE} target='_blank' rel='noopener noreferrer' className={s.secondary} onClick={()=>setOpenedFollow(true)}>FOLLOW @TERMINLNET ↗</a>
          <a href={postUrl} target='_blank' rel='noopener noreferrer' className={s.secondary} onClick={()=>setOpenedPost(true)}>{postUrl===X_PROFILE?'FIND THE WL POST ↗':'OPEN THE WL POST ↗'}</a></div>
        {postUrl===X_PROFILE&&<p className={s.fine}>On the @TERMINLnet profile, find the WL post, like it, and repost it.</p>}
        <label className={s.check}><input type='checkbox' checked={socialConfirmed} onChange={e=>setSocialConfirmed(e.target.checked)} disabled={!openedFollow||!openedPost}/>I followed @TERMINLnet and liked and reposted the WL post.</label>
      </div>
      <div className={s.wlFormSection}><h3>02 / Choose your shot</h3>
        <label>PUBLIC WALLET ADDRESS<input value={address} onChange={e=>{setAddress(e.target.value);setReceived(false);}} placeholder='0x…' autoComplete='off' spellCheck={false} required/></label>
        <label>APPLY FOR<select value={requestedKind} onChange={e=>setRequestedKind(e.target.value)}><option value='fcfs'>FCFS WL</option><option value='gtd'>GTD WL</option><option value='both'>Either / both</option></select></label>
      </div>
      <div className={s.wlFormSection}><h3>03 / Where should we send the news?</h3>
        <label>EMAIL FOR WINNER NOTICE<input type='email' value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} autoComplete='email' placeholder='you@example.com' required/></label>
        <label className={s.check}><input type='checkbox' checked={emailConsent} onChange={e=>setEmailConsent(e.target.checked)} required/>Email me about this entry and any WL decision.</label>
        <label className={s.wlHoneypot} aria-hidden='true'>Website<input tabIndex={-1} autoComplete='off' value={website} onChange={e=>setWebsite(e.target.value)}/></label>
        <button className={s.primary} disabled={applyBusy||!socialReady}>{applyBusy?'SENDING…':'ENTER THE WL DRAW →'}</button>
        {!socialReady&&<p className={s.fine}>To unlock entry, open both X links and confirm the follow, like, and repost steps.</p>}
      </div></form>
      {received&&<p className={s.notice} role='status'>Entry received. If your wallet is selected on October 26, we&apos;ll email you at the address you provided.</p>}
      {error&&<p role='alert' className={s.error}>{error}</p>}
      <p className={s.fine}>Your email is private to the review team. Use a wallet you control; no seed phrase, signature, or transaction is needed. <Link href='/arcade-privacy'>Privacy and WL rules →</Link></p>
    </div></section>
  </CampaignShell>;
}
