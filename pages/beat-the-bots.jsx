import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import {useEffect,useState} from 'react';
import CampaignShell from '../components/arcade/CampaignShell';
import {campaignRequest,campaignEvent} from '../lib/arcade/campaign-client';
import {BARRY,raceTime} from '../lib/arcade/bot-challenge.mjs';
import {TRACKS,VEHICLES} from '../lib/arcade/race-sim.mjs';
import s from '../styles/Campaign.module.css';

export default function BeatTheBots(){
  const [campaign,setCampaign]=useState(null),[board,setBoard]=useState([]),[period,setPeriod]=useState('day'),[error,setError]=useState('');
  useEffect(()=>{let alive=true;campaignRequest('/config').then(c=>{if(alive)setCampaign(c);}).catch(e=>{if(alive)setError(e.message);});campaignRequest('/session').then(()=>campaignEvent('challenge_view')).catch(()=>{});return()=>{alive=false;};},[]);
  useEffect(()=>{if(!campaign?.open)return;let alive=true;campaignRequest('/leaderboard?period='+period).then(b=>{if(alive)setBoard(b.entries);}).catch(e=>{if(alive)setError(e.message);});campaignEvent('leaderboard_view');return()=>{alive=false;};},[campaign,period]);
  const c=campaign?.config;
  return <CampaignShell><Head><title>Beat the Bots — TERMINL</title><meta name='description' content='The bots usually take your allocation. Make one lose a race for a change. Play first. Save your verified win with X. No wallet connection.'/></Head>
    <section className={s.hero}><div><span className={s.eyebrow}>TERMINL VS. THE BOTS</span><h1>He bought the top.<br/><em>Beat him to the finish.</em></h1>
      <p>Barry thinks three laps in a borrowed supercar make him a racing driver. Please make this man log off.</p>
      {campaign?.open?<><Link className={s.primary} href='/os/lambo?challenge=barrybot'>RACE BARRYBOT →</Link><p>Beat the official challenge to qualify for the pre-mint pool. Save your win with X afterwards.</p></>:<><p className={s.notice}>{campaign?'Official qualification isn’t open yet. The arcade is.':'Checking the starting grid…'}</p><Link className={s.primary} href='/os/lambo'>PRACTISE IN WEN LAMBO →</Link></>}
      <small className={s.fine}>No wallet connection, signature, follow or repost required. Qualification is eligibility to register, not a guaranteed mint allocation.</small>
    </div><div className={s.portrait}><Image src={`/degens/${BARRY.portrait}.webp`} alt='BarryBot, represented by Diamond Hands Pepe' width={340} height={560} priority/><span>“{BARRY.taunt}”</span></div></section>
    {error&&<p role='alert' className={s.error}>{error}</p>}
    <div className={s.grid}><section className={s.card}><span className={s.eyebrow}>01 / THE RACE</span><h2>One bot. Three laps.</h2><p>{c?`${TRACKS[c.track].name}. Everyone drives the ${VEHICLES[c.vehicle].name}. Finish ahead of Barry in under ${c.targetSeconds} seconds.`:'The official track and target will appear here when qualification opens.'}</p></section>
      <section className={s.card}><span className={s.eyebrow}>02 / THE WIN</span><h2>Save it after you earn it.</h2><p>We verify the race. You save the win with X. Your Arcade Pass keeps your qualification and opens address submission when that window begins.</p></section>
      <section className={s.card}><span className={s.eyebrow}>03 / THE GROUP CHAT</span><h2>Send someone worse.</h2><p>Your time gets its own challenge page. Send it to the friend who blames the controller. They can play immediately.</p></section></div>
    {campaign?.open&&<section><div className={s.sectionHeading}><h2>THE PEOPLE BARRY IS MUTING</h2><div className={s.tabs}><button aria-pressed={period==='day'} onClick={()=>setPeriod('day')}>TODAY / UTC</button><button aria-pressed={period==='all'} onClick={()=>setPeriod('all')}>ALL TIME</button></div></div>
      {board.length?<div className={s.tableWrap}><table className={s.table}><thead><tr><th>RANK</th><th>PLAYER</th><th>TIME</th><th>CHALLENGE</th></tr></thead><tbody>{board.map(r=><tr key={r.code}><td>#{r.rank}</td><td>{r.player}</td><td>{raceTime(r.result.playerTicks)}</td><td><Link href={'/challenge/'+r.code}>BEAT THIS →</Link></td></tr>)}</tbody></table></div>:<p className={s.empty}>No verified, saved wins yet. Barry is unbearable about it.</p>}
      <p className={s.fine}>Best verified time per player on the current track and car. A leaderboard place does not change your mint allocation.</p></section>}
  </CampaignShell>;
}
