import {useEffect,useState} from 'react';
import Link from 'next/link';
import {campaignRequest} from '../../lib/arcade/campaign-client';
import s from '../../styles/Campaign.module.css';
export default function CampaignInvite(){
  const [open,setOpen]=useState(false);
  useEffect(()=>{let alive=true;campaignRequest('/config').then(c=>{if(alive&&c.open)setOpen(true);}).catch(()=>{});return()=>{alive=false;};},[]);
  if(!open)return null;
  return <aside className={s.raceChallenge}><div><span className={s.eyebrow}>OFFICIAL CHALLENGES / VERIFIED LEADERBOARD</span><h2>Win one race or fight. Save your score.</h2><p>Barry Cup races and Rekt Rumble circuit fights earn verified leaderboard points. Sign in after your first win to save them. Clear a full route for an FCFS WL spot.</p><small>Other arcade games keep local achievements. No wallet or sign-in needed to start playing.</small></div><div className={s.officialChoices}><Link className={s.primary} href='/os/lambo#official'>PLAY BARRY CUP →</Link><Link className={s.secondary} href='/os/rumble#official'>FIGHT THE CIRCUIT →</Link></div></aside>;
}
