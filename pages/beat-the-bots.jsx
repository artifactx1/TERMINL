import Link from 'next/link';
import Image from 'next/image';
import {useEffect,useState} from 'react';
import CampaignShell from '../components/arcade/CampaignShell';
import ArcadeMeta from '../components/arcade/ArcadeMeta';
import Leaderboard from '../components/arcade/Leaderboard';
import {campaignRequest,campaignEvent} from '../lib/arcade/campaign-client';
import {BARRY,FCFS_NOTE,POINTS,ROUTES} from '../lib/arcade/campaign-rules.mjs';
import s from '../styles/Campaign.module.css';

function Route({route,open,children}){
  const r=ROUTES[route];
  return <section className={s.card}><span className={s.eyebrow}>{r.game.toUpperCase()} / ONE FCFS WL SPOT</span><h2>{r.name}</h2>{children}
    {open?<Link className={s.primary} href={r.href}>PLAY {r.name.toUpperCase()} →</Link>:<p className={s.fine}>Not open for WL right now. The game is free to practise.</p>}
  </section>;
}

export default function BeatTheBots(){
  const [campaign,setCampaign]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let alive=true;campaignRequest('/config').then(c=>{if(alive)setCampaign(c);}).catch(e=>{if(alive)setError(e.message);});campaignRequest('/session').then(()=>campaignEvent('challenge_view')).catch(()=>{});return()=>{alive=false;};},[]);
  const routes=campaign?.routes||{};
  return <CampaignShell><ArcadeMeta card='beat-the-bots'/>
    <section className={s.hero}><div><span className={s.eyebrow}>TERMINL VS. THE BOTS / FCFS WL</span><h1>The bots take your allocation.<br/><em>Take it back.</em></h1>
      <p>Two ways in. Beat BarryBot across a full six-race cup, or fight your way through all six opponents in the Rekt Rumble circuit. Each one earns its own FCFS WL spot.</p>
      {!campaign?<p className={s.notice}>Checking the starting grid…</p>:!campaign.open&&<p className={s.notice}>WL challenges aren’t open right now. The arcade is, and practice is free.</p>}
      {campaign?.open&&<p className={s.fine}>{campaign.claimed} FCFS WL spots saved so far{campaign.capacity?` (limit ${campaign.capacity})`:''}.</p>}
      <small className={s.fine}>No wallet connection, signature, follow or repost required. {FCFS_NOTE}</small>
    </div><div className={s.portrait}><Image src={`/degens/${BARRY.portrait}.webp`} alt='BarryBot, represented by Diamond Hands Pepe' width={340} height={560} priority/><span>“{BARRY.taunt}”</span></div></section>
    {error&&<p role='alert' className={s.error}>{error}</p>}
    <div className={s.routes}>
      <Route route='cup' open={routes.cup}><p>Six courses, three laps each, one BarryBot. 1st place scores 10, 2nd scores 6. Finish the cup with more points than Barry. Winning a single race isn’t enough.</p><small>Everyone drives the same car. Each race is checked by the server as soon as you cross the line.</small></Route>
      <Route route='rumble' open={routes.rumble}><p>Pick a fighter and beat all six circuit opponents in one official run, mirror-match finale included. Lose a fight and you retry that fight, not the whole circuit.</p><small>The circuit stays open for 30 minutes between fights. Each fight is checked by the server.</small></Route>
    </div>
    <div className={s.grid}>
      <section className={s.card}><span className={s.eyebrow}>01 / PLAY</span><h2>Play first.</h2><p>No sign-in needed to start. The server replays every race and fight from your inputs. Scores claimed by the browser count for nothing.</p></section>
      <section className={s.card}><span className={s.eyebrow}>02 / SAVE</span><h2>Save with X, Farcaster or Discord.</h2><p>Finish a route, then save the spot to your Arcade Pass. Your spot is confirmed when you save it.</p></section>
      <section className={s.card}><span className={s.eyebrow}>03 / CHECK</span><h2>Log in any time.</h2><p>Your Arcade Pass shows which WL spots you hold, your points and rank, and where to add your mint address.</p><Link className={s.secondary} href='/arcade-pass'>MY ARCADE PASS →</Link></section>
    </div>
    <div className={s.sectionHeading}><h2>LEADERBOARD</h2><span className={s.fine}>Race win {POINTS.raceWin} · Cup +{POINTS.cupWin} · Fight win {POINTS.fightWin} · Circuit +{POINTS.circuitClear}</span></div>
    <Leaderboard limit={10} compact/>
    <p className={s.fine}>Points rank players. They don’t change WL spots.</p>
  </CampaignShell>;
}
