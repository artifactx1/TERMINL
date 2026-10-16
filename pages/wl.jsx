import Head from 'next/head';
import Link from 'next/link';
import {useState} from 'react';
import CampaignShell from '../components/arcade/CampaignShell';
import {campaignRequest} from '../lib/arcade/campaign-client';
import s from '../styles/Campaign.module.css';

const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const short=value=>`${value.slice(0,6)}…${value.slice(-4)}`;

export default function WlApplication(){
  const [address,setAddress]=useState(''),[email,setEmail]=useState(''),[requestedKind,setRequestedKind]=useState('fcfs');
  const [note,setNote]=useState(''),[emailConsent,setEmailConsent]=useState(false),[website,setWebsite]=useState('');
  const [lookup,setLookup]=useState(null),[lookupBusy,setLookupBusy]=useState(false),[applyBusy,setApplyBusy]=useState(false);
  const [error,setError]=useState(''),[received,setReceived]=useState(false);
  const check=async e=>{
    e.preventDefault();setError('');setLookup(null);
    if(!ADDRESS.test(address.trim())){setError('Paste a public 0x wallet address.');return;}
    setLookupBusy(true);
    try{setLookup(await campaignRequest('/wl/check/'+address.trim()));}
    catch(e){setError(e.message);}
    finally{setLookupBusy(false);}
  };
  const apply=async e=>{
    e.preventDefault();setError('');setReceived(false);
    if(!ADDRESS.test(address.trim())){setError('Paste a public 0x wallet address.');return;}
    setApplyBusy(true);
    try{await campaignRequest('/wl/apply',{address:address.trim(),email,requestedKind,note,emailConsent,website});setReceived(true);}
    catch(e){setError(e.message);}
    finally{setApplyBusy(false);}
  };
  return <CampaignShell><Head><title>WL application and checker — TERMINL</title><meta name='description' content='Check your TERMINL offchain WL spot or apply for GTD and FCFS access before mint.'/></Head>
    <span className={s.eyebrow}>TERMINL / PRE-MINT ACCESS</span><h1 className={s.title}>Check the list. Apply for a spot.</h1>
    <p className={s.lede}>The offchain list can update as spots are approved. Check a public wallet address here without connecting it. A saved spot appears before mint phases are published.</p>
    <div className={s.wlGrid}>
      <section className={s.card}><span className={s.eyebrow}>01 / WALLET CHECKER</span><h2>Are you on the list?</h2>
        <form onSubmit={check}><label>PUBLIC WALLET ADDRESS<input value={address} onChange={e=>{setAddress(e.target.value);setLookup(null);setReceived(false);}} placeholder='0x…' autoComplete='off' spellCheck={false} required/></label>
          <button className={s.primary} disabled={lookupBusy}>{lookupBusy?'CHECKING…':'CHECK MY WALLET →'}</button></form>
        {lookup&&<div className={s.notice} role='status'><b>{short(lookup.address)} — {lookup.eligible?'ON THE OFFCHAIN LIST':'NOT ON THE CURRENT LIST'}</b>
          {lookup.lists?.map(row=><p key={row.kind}>{row.kind.toUpperCase()} spot · {row.source==='arcade'?'earned with Arcade Pass':'approved'}</p>)}
          <small>{lookup.eligible?'This is a recorded spot. Mint eligibility follows the published phase and its final terms.':'Applications are reviewed separately; submitting one does not add a wallet to the list.'}</small>
        </div>}
        <p className={s.fine}>GTD means a guaranteed WL allocation once final mint terms are published. FCFS means access to a WL phase while its supply lasts. Neither is an NFT already minted.</p>
        <Link className={s.secondary} href='/arcade-pass'>CHECK MY ARCADE PASS →</Link>
      </section>
      <section className={s.card}><span className={s.eyebrow}>02 / WL APPLICATION</span><h2>Put your hand up.</h2>
        <p>Ask to be considered for a GTD or FCFS spot. Reviews are manual; applying does not reserve one.</p>
        <form onSubmit={apply}>
          <label>SPOT REQUEST<select value={requestedKind} onChange={e=>setRequestedKind(e.target.value)}><option value='fcfs'>FCFS WL</option><option value='gtd'>GTD WL</option><option value='both'>Either / both</option></select></label>
          <label>EMAIL FOR A DECISION<input type='email' value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} autoComplete='email' placeholder='you@example.com' required/></label>
          <label>WHY YOU? <span className={s.fine}>Optional · 500 characters max</span><textarea className={s.wlTextarea} value={note} onChange={e=>setNote(e.target.value)} maxLength={500} placeholder='Tell us about you and the collection.'/></label>
          <label className={s.check}><input type='checkbox' checked={emailConsent} onChange={e=>setEmailConsent(e.target.checked)} required/>Email me about this application and any WL decision.</label>
          <label className={s.wlHoneypot} aria-hidden='true'>Website<input tabIndex={-1} autoComplete='off' value={website} onChange={e=>setWebsite(e.target.value)}/></label>
          <button className={s.primary} disabled={applyBusy}>{applyBusy?'SENDING…':'SUBMIT APPLICATION →'}</button>
        </form>
        {received&&<p className={s.notice} role='status'>Application received. Check this wallet again as the offchain list updates. We’ll use the email you provided for a decision notice.</p>}
        <p className={s.fine}>Your email and note are private to the review team. Use a wallet you control; no seed phrase, signature, or transaction is needed. <Link href='/arcade-privacy'>Privacy and WL rules →</Link></p>
      </section>
    </div>
    {error&&<p role='alert' className={s.error}>{error}</p>}
  </CampaignShell>;
}
