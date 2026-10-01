import {useEffect,useState} from 'react';
import Link from 'next/link';
import {campaignRequest,campaignEvent} from '../../lib/arcade/campaign-client';
import s from '../../styles/Campaign.module.css';
export default function CampaignInvite(){
  const [open,setOpen]=useState(false);
  useEffect(()=>{let alive=true;campaignRequest('/config').then(c=>{if(!alive||!c.open)return;setOpen(true);return campaignRequest('/session').then(()=>campaignEvent('arcade_view'));}).catch(()=>{});return()=>{alive=false;};},[]);
  if(!open)return null;
  return <aside className={s.raceChallenge}><div><span className={s.eyebrow}>BEAT THE BOTS / FCFS WL</span><h2>The bots usually take your allocation.</h2><p>Take a six-race cup off BarryBot, or clear all six fights in the Rekt Rumble circuit. Each route earns an FCFS WL spot.</p><small>No wallet connection. No follow gate. Play first.</small></div><Link className={s.primary} href='/beat-the-bots'>EARN A WL SPOT →</Link></aside>;
}
