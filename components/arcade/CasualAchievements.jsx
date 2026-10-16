import Link from 'next/link';
import {useEffect,useState} from 'react';
import {CAMPAIGN_KEY,readCampaign} from '../../lib/moon-campaign.mjs';
import {readProgress} from '../../lib/arcade/after-hours/progress.mjs';
import {medalFor} from '../../lib/arcade/after-hours/mall-awards.mjs';
import s from '../../styles/ArcadeHub.module.css';

export default function CasualAchievements(){
  const [saved,setSaved]=useState(null);
  useEffect(()=>{try{setSaved({moon:readCampaign(localStorage.getItem(CAMPAIGN_KEY)),afterHours:readProgress(localStorage)});}catch{setSaved({moon:readCampaign(null),afterHours:readProgress({getItem:()=>null})});}},[]);
  if(!saved)return null;
  const {moon,afterHours}=saved,mall=afterHours.mall,rug=afterHours.rug;
  const rugClears=new Set(rug.records.map(record=>record.level)).size;
  const cards=[
    {name:'MOON MISSION',href:'/os/moon',value:`${moon.completed.length}/10`,metric:'LEVELS CLEARED',detail:moon.completed.length?`Best level score ${Math.max(...moon.best).toLocaleString('en-US')}`:'Your first launch is waiting.'},
    {name:'MALL RAT',href:'/os/mall-rat',value:(mall.bests.score||0).toLocaleString('en-US'),metric:'PERSONAL BEST',detail:`${medalFor(mall.bests.score||0)} · ${mall.tapes.length}/9 VHS tapes found`},
    {name:'RUG.EXE',href:'/os/rug-exe',value:`${rugClears}/8`,metric:'SEGMENTS CLEARED',detail:rug.completed?'Protocol cleared. Corrupted board unlocked.':rug.records.length?`Last grade ${rug.records[0].grade||'—'}`:'Your first escape is waiting.'},
  ];
  return <section className={s.achievements} aria-label='Your local arcade achievements'>
    <div className={s.achievementHeading}><div><span className={s.eyebrow}>YOUR ARCADE / THIS BROWSER</span><h2>LOCAL ACHIEVEMENTS</h2></div><p>Moon Mission, Mall Rat, and Rug.exe save progress on this device. These records are personal and do not count toward the verified WL leaderboard.</p></div>
    <div className={s.achievementGrid}>{cards.map(card=><Link key={card.name} href={card.href} className={s.achievementCard}><small>{card.name}</small><strong>{card.value}</strong><span>{card.metric}</span><p>{card.detail}</p><b>PLAY AGAIN ↗</b></Link>)}</div>
  </section>;
}
