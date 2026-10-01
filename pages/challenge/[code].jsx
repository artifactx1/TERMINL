import Link from 'next/link';
import {useEffect} from 'react';
import CampaignShell from '../../components/arcade/CampaignShell';
import ArcadeMeta from '../../components/arcade/ArcadeMeta';
import {publicChallenge,campaignOrigin} from '../../lib/server/campaign';
import {campaignRequest,campaignEvent} from '../../lib/arcade/campaign-client';
import {ROUTES,resultSummary} from '../../lib/arcade/campaign-rules.mjs';
import {rosterFor} from '../../lib/arcade/rumble-roster.mjs';
import s from '../../styles/Campaign.module.css';

/** What the run proved, and where the challenger goes to answer it. */
function claim(run){
  if(run.kind==='rumble')return {headline:`${run.player} cleared the Rekt Rumble circuit.`,detail:`All six fights as ${rosterFor(run.result.character)?.name||'a free fighter'}.`,play:`/os/rumble?ref=${run.code}`};
  if(run.kind==='cup')return {headline:`${run.player} took the Barry Cup.`,detail:`${run.result.points[0]}–${run.result.points[1]} on points across six courses.`,play:`/os/lambo?ref=${run.code}`};
  return {headline:`${run.player} beat BarryBot.`,detail:'An original Barry Sprint win.',play:`/os/lambo?ref=${run.code}`};
}
export default function Challenge({run,origin,unavailable}){
  useEffect(()=>{if(run)campaignRequest('/session').then(()=>campaignEvent('challenge_link_opened',run.code)).catch(()=>{});},[run]);
  if(unavailable)return <CampaignShell><h1 className={s.title}>The timing desk is offline.</h1><p>Try this challenge link again shortly. Saved results have not changed.</p><Link className={s.primary} href='/os'>PLAY THE ARCADE →</Link></CampaignShell>;
  const {headline,detail,play}=claim(run),title=`${headline} Your turn.`;
  return <CampaignShell><ArcadeMeta card='beat-the-bots' title={`${title} — TERMINL`} description='Beat the bots for an FCFS WL spot. No wallet required.' path={`/challenge/${run.code}`} image={`${origin}/api/challenge-card/${run.code}`} alt={title}/>
    <span className={s.eyebrow}>{(ROUTES[run.kind]?.game||'TERMINL ARCADE').toUpperCase()} / SERVER-VERIFIED RUN</span><h1 className={s.title}>{headline}<br/>Now it’s your turn.</h1>
    <p className={s.lede}>{detail} <b>{resultSummary(run.kind,run.result)}</b></p>
    <div className={s.actions}>{run.kind!=='sprint'&&<Link className={s.primary} href={play}>ACCEPT CHALLENGE →</Link>}<Link className={run.kind==='sprint'?s.primary:s.secondary} href='/beat-the-bots'>HOW TO EARN A WL SPOT</Link></div>
    <p className={s.fine}>Your friend’s result is for bragging rights. Completing a route earns an FCFS WL spot of your own. No wallet or sign-in needed to play.</p>
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
