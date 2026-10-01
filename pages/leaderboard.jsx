import Link from 'next/link';
import CampaignShell from '../components/arcade/CampaignShell';
import ArcadeMeta from '../components/arcade/ArcadeMeta';
import Leaderboard from '../components/arcade/Leaderboard';
import {POINTS} from '../lib/arcade/campaign-rules.mjs';
import s from '../styles/Campaign.module.css';

export default function LeaderboardPage(){
  return <CampaignShell><ArcadeMeta card='arcade-leaderboard'/>
    <span className={s.eyebrow}>BEAT THE BOTS / SERVER-VERIFIED</span><h1 className={s.title}>Arcade leaderboard.</h1>
    <p className={s.lede}>Points come only from official runs the server has replayed. Sign in on your Arcade Pass to put your runs on the board.</p>
    <Leaderboard banner/>
    <section className={s.card} style={{marginTop:28}}><h2>How points work</h2>
      <ul className={s.rules}>
        <li>Barry Cup: <b>{POINTS.raceWin}</b> per race you win, <b>+{POINTS.cupWin}</b> for taking the cup.</li>
        <li>Rekt Rumble circuit: <b>{POINTS.fightWin}</b> per fight you win, <b>+{POINTS.circuitClear}</b> for clearing all six.</li>
        <li>The original single-race Barry Sprint win counts <b>{POINTS.legacySprint}</b>.</li>
        <li>The top 100 when the campaign closes get GTD spots. Points don’t change FCFS spots, which come from clearing either route (one per person). CUP and RUMBLE show which routes a player has cleared.</li>
      </ul>
      <p className={s.fine}>Players appear as ANON unless they choose to show their handle. Runs under review and suspended accounts are left off.</p>
      <div className={s.actions}><Link className={s.primary} href='/beat-the-bots'>EARN POINTS →</Link><Link className={s.secondary} href='/arcade-pass'>MY ARCADE PASS</Link></div>
    </section>
  </CampaignShell>;
}
