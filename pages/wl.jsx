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
const PREVIOUS_POST='https://x.com/TERMINLnet/status/2108226120562995498';
const DEFAULT_POST='https://x.com/TERMINLnet/status/2112252357845090799?s=20';
const SHARE_IMAGE='https://terminl.net/wl-og.png?v=2026-10-19';

export default function WlApplication(){
  const {address:connectedAddress}=useAccount();
  const [address,setAddress]=useState(''),[email,setEmail]=useState('');
  const [website,setWebsite]=useState(''),[postUrl,setPostUrl]=useState(DEFAULT_POST);
  const [openedFollow,setOpenedFollow]=useState(false),[openedPost,setOpenedPost]=useState(false);
  const [applyBusy,setApplyBusy]=useState(false),[error,setError]=useState(''),[received,setReceived]=useState(false);
  useEffect(()=>{
    if(ADDRESS.test(connectedAddress||'')){setAddress(connectedAddress);setReceived(false);}
  },[connectedAddress]);
  useEffect(()=>{
    let active=true;
    void campaignRequest('/config').then(({config})=>{
      if(active&&config?.wlPostUrl&&config.wlPostUrl!==PREVIOUS_POST)setPostUrl(config.wlPostUrl);
    }).catch(()=>{});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{setOpenedPost(false);},[postUrl]);
  const socialReady=openedFollow&&openedPost;
  const apply=async e=>{
    e.preventDefault();setError('');setReceived(false);
    if(!socialReady){setError('Open both X links before applying.');return;}
    if(!ADDRESS.test(address.trim())){setError('Paste a public 0x wallet address.');return;}
    setApplyBusy(true);
    try{await campaignRequest('/wl/apply',{address:address.trim(),email,requestedKind:'both',socialConfirmed:socialReady,website});setReceived(true);}
    catch(e){setError(e.message);}
    finally{setApplyBusy(false);}
  };
  return <CampaignShell><Head>
    <title>Apply for WL — TERMINL</title>
    <meta name='description' content='Apply for a TERMINL allowlist spot. Draw on October 26, 2026.'/>
    <link rel='canonical' href='https://terminl.net/wl'/>
    <meta property='og:type' content='website'/>
    <meta property='og:title' content='Apply for WL — TERMINL'/>
    <meta property='og:description' content='Your wallet. Your shot. Apply for a TERMINL allowlist spot before the October 26 draw.'/>
    <meta property='og:url' content='https://terminl.net/wl'/>
    <meta property='og:image' content={SHARE_IMAGE}/>
    <meta property='og:image:secure_url' content={SHARE_IMAGE}/>
    <meta property='og:image:type' content='image/png'/>
    <meta property='og:image:width' content='1200'/>
    <meta property='og:image:height' content='630'/>
    <meta property='og:image:alt' content='TERMINL WL application with Buy High Brian and Margin Call Max'/>
    <meta name='twitter:card' content='summary_large_image'/>
    <meta name='twitter:title' content='Apply for WL — TERMINL'/>
    <meta name='twitter:description' content='Your wallet. Your shot. Draw October 26, 2026.'/>
    <meta name='twitter:image' content={SHARE_IMAGE}/>
  </Head>
    <section className={s.wlHero}>
      <div className={s.wlHeroCopy}><span className={s.eyebrow}>TERMINL / WL APPLICATION</span>
        <h1>Want a WL spot?<br/><em>Apply here.</em></h1>
        <p>Follow us on X, like and retweet the post, then enter your wallet and email.</p>
        <div className={s.wlDate}><strong>DRAW: OCT 26, 2026</strong><span>Winners will be emailed after the draw.</span></div>
        <a className={s.primary} href='#apply'>APPLY NOW ↓</a>
      </div>
      <div className={s.wlArt} aria-label='TERMINL collection art preview'>
        <figure className={s.wlArtMain}><Image src='/art/4b8ac4791a5855a4.webp' alt='Buy High Brian at the Dogecoin arcade terminal' width={650} height={650} priority/><figcaption>BUY HIGH BRIAN</figcaption></figure>
        <figure><Image src='/art/ce26e6ae12adc34d.webp' alt='Margin Call Max at the Zcash arcade terminal' width={400} height={400}/><figcaption>MARGIN CALL MAX</figcaption></figure>
        <figure><Image src='/art/d466f9bcb42e88c1.webp' alt='Pump Queen Priya at the Fartcoin arcade terminal' width={400} height={400}/><figcaption>PUMP QUEEN PRIYA</figcaption></figure>
      </div>
    </section>
    <section className={s.wlApply} id='apply'>
    <div className={`${s.card} ${s.wlFormCard}`}><span className={s.eyebrow}>WL APPLICATION / OCT 26 DRAW</span><h2>Apply in 3 steps.</h2><form onSubmit={apply}>
      <div className={s.wlFormSection}><h3>1. Follow and retweet</h3>
        <div className={s.wlSocialLinks}><a href={X_PROFILE} target='_blank' rel='noopener noreferrer' className={s.secondary} onClick={()=>setOpenedFollow(true)}>FOLLOW @TERMINLNET ↗</a>
          <a href={postUrl} target='_blank' rel='noopener noreferrer' className={s.secondary} onClick={()=>setOpenedPost(true)}>LIKE + RETWEET ↗</a></div>
      </div>
      <div className={s.wlFormSection}><h3>2. Add your wallet</h3>
        <label>WALLET ADDRESS<input value={address} onChange={e=>{setAddress(e.target.value);setReceived(false);}} placeholder='0x…' autoComplete='off' spellCheck={false} required/></label>
      </div>
      <div className={s.wlFormSection}><h3>3. Add your email</h3>
        <label>EMAIL ADDRESS<input type='email' value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} autoComplete='email' placeholder='you@example.com' required/></label>
        <label className={s.wlHoneypot} aria-hidden='true'>Website<input tabIndex={-1} autoComplete='off' value={website} onChange={e=>setWebsite(e.target.value)}/></label>
        <button className={s.primary} disabled={applyBusy||!socialReady}>{applyBusy?'SENDING…':'SUBMIT APPLICATION →'}</button>
        {!socialReady&&<p className={s.fine}>Open both X links to submit.</p>}
      </div></form>
      {received&&<p className={s.notice} role='status'>Application received. Winners will be emailed after October 26.</p>}
      {error&&<p role='alert' className={s.error}>{error}</p>}
      <p className={s.fine}>Applying doesn&apos;t guarantee a WL spot. <Link href='/arcade-privacy'>Privacy and rules →</Link></p>
    </div></section>
  </CampaignShell>;
}
