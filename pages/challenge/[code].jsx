import Head from 'next/head';
import Link from 'next/link';
import {useEffect} from 'react';
import CampaignShell from '../../components/arcade/CampaignShell';
import {publicChallenge,campaignOrigin} from '../../lib/server/campaign';
import {campaignRequest,campaignEvent} from '../../lib/arcade/campaign-client';
import {raceTime} from '../../lib/arcade/bot-challenge.mjs';
import {TRACKS,VEHICLES} from '../../lib/arcade/race-sim.mjs';
import s from '../../styles/Campaign.module.css';
export default function Challenge({run,origin,unavailable}){
  useEffect(()=>{if(run)campaignRequest('/session').then(()=>campaignEvent('challenge_link_opened',run.code)).catch(()=>{});},[run]);
  if(unavailable)return <CampaignShell><h1 className={s.title}>The timing desk is offline.</h1><p>Try this challenge link again shortly. Saved results have not changed.</p><Link className={s.primary} href='/os'>PLAY THE ARCADE →</Link></CampaignShell>;
  const title=`${run.player} beat BarryBot in ${raceTime(run.result.playerTicks)}. Your turn.`,url=`${origin}/challenge/${run.code}`;
  return <CampaignShell><Head><title>{title} — TERMINL</title><meta name='description' content='One verified Wen Lambo win. One friend who thinks they can do better. No wallet required.'/><meta property='og:title' content={title}/><meta property='og:description' content='Barry would like a recount. You get a rematch.'/><meta property='og:url' content={url}/><meta property='og:type' content='website'/><meta property='og:image' content={`${origin}/api/challenge-card/${run.code}`}/><meta property='og:image:width' content='1200'/><meta property='og:image:height' content='630'/><meta name='twitter:card' content='summary_large_image'/><link rel='canonical' href={url}/></Head>
    <span className={s.eyebrow}>WEN LAMBO / SERVER-VERIFIED RUN</span><h1 className={s.title}>{run.player} beat Barry.<br/>Now beat {run.player==='ANON'?'that':'them'}.</h1>
    <div className={s.resultTimes}><div><small>THE TIME TO BEAT</small><strong>{raceTime(run.result.playerTicks)}</strong></div><div><small>BARRYBOT</small><strong>{raceTime(run.result.botTicks)}</strong></div></div>
    <p>{TRACKS[run.challenge.track].name} · {VEHICLES[run.challenge.vehicle].name} · Three laps.</p>
    <div className={s.actions}><Link className={s.primary} href={`/os/lambo?challenge=barrybot&ref=${run.code}`}>ACCEPT CHALLENGE →</Link><Link className={s.secondary} href='/beat-the-bots'>THE OFFICIAL TARGET</Link></div>
    <p className={s.fine}>Your friend’s time is for bragging rights. The current official bot target decides qualification. No wallet or sign-in needed to race.</p>
    {/* A regular image lets players save the exact card that link previews use. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className={s.shareCard} src={`/api/challenge-card/${run.code}`} width='1200' height='630' alt={title}/>
  </CampaignShell>;
}
export async function getServerSideProps({params,res}){
  res.setHeader('Cache-Control','no-store');
  try{const run=await publicChallenge(params.code);if(!run)return {notFound:true};return {props:{run,origin:campaignOrigin()}};}
  catch{res.statusCode=503;return {props:{run:null,origin:campaignOrigin(),unavailable:true}};}
}
