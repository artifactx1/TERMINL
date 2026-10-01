import {ImageResponse} from 'next/og';
import {raceTime} from '../../../lib/arcade/campaign-rules.mjs';
import {rosterFor} from '../../../lib/arcade/rumble-roster.mjs';

export const config={runtime:'edge'};
/** PNG cut-outs that ImageResponse can draw; fighters without one get a text-only card. */
const FIGURES={max:'/arcade/og/margin-call-max.png',brian:'/arcade/og/buy-high-brian.png',chloe:'/arcade/og/cold-storage-chloe.png',diamond:'/degens/diamond-hands-pepe-share.png'};
function card(run){
  if(run.kind==='rumble')return {game:'REKT RUMBLE',claim:'CLEARED THE CIRCUIT.',big:'6 / 6',line:`Six fights as ${rosterFor(run.result.character)?.name||'a free fighter'}.`,figure:FIGURES[run.result.character]};
  if(run.kind==='cup')return {game:'WEN LAMBO',claim:'TOOK THE BARRY CUP.',big:`${run.result.points[0]}–${run.result.points[1]}`,line:'Barry would like a recount.',figure:FIGURES.diamond};
  return {game:'WEN LAMBO',claim:'BEAT BARRYBOT.',big:raceTime(run.result.playerTicks),line:'Barry would like a recount.',figure:FIGURES.diamond};
}
export default async function handler(request){
  const code=new URL(request.url).pathname.split('/').at(-1);
  if(!/^[A-Za-z0-9_-]{16}$/.test(code||''))return new Response('Not found',{status:404});
  const base=process.env.CAMPAIGN_API_URL,secret=process.env.CAMPAIGN_SERVICE_TOKEN;
  if(!base||!secret)return new Response('Campaign unavailable',{status:503});
  try{
    const result=await fetch(base.replace(/\/$/,'')+'/campaign/results/'+code,{headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(10000)});
    if(!result.ok)return new Response('Result unavailable',{status:result.status===404?404:503});
    const run=await result.json(),c=card(run),origin=new URL(process.env.CAMPAIGN_SITE_ORIGIN||'https://terminl.net').origin;
    const font=await fetch(origin+'/fonts/SpaceMono-Bold.ttf').then(r=>{if(!r.ok)throw new Error('Font unavailable');return r.arrayBuffer();});
    return new ImageResponse(<div style={{display:'flex',width:'100%',height:'100%',background:'#080e09',color:'#f0ffe9',fontFamily:'Space Mono',padding:48,position:'relative'}}>
      <div style={{display:'flex',flexDirection:'column',width:780,position:'relative'}}>
        <div style={{display:'flex',fontSize:22,letterSpacing:7,color:'#b3ef8b'}}>TERMINL / {c.game}</div>
        <div style={{display:'flex',fontSize:30,marginTop:45}}>{run.player}</div>
        <div style={{display:'flex',fontSize:54,marginTop:12}}>{c.claim}</div>
        <div style={{display:'flex',fontSize:104,lineHeight:1.3,color:'#b3ef8b'}}>{c.big}</div>
        <div style={{display:'flex',fontSize:20,color:'#a2b39b',marginTop:8}}>{c.line}</div>
        <div style={{display:'flex',alignItems:'center',fontSize:18,borderTop:'1px solid #49643c',paddingTop:24,marginTop:36}}>SERVER-VERIFIED · FCFS WL SPOT</div>
        <div style={{display:'flex',fontSize:26,marginTop:20}}>YOUR TURN. →</div>
      </div>
      {c.figure&&<div style={{display:'flex',position:'absolute',right:0,top:0,width:390,height:630,background:'linear-gradient(180deg,#162a16,#080e09)',alignItems:'flex-end',justifyContent:'center'}}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={origin+c.figure} width={310} height={511} alt=''/>
      </div>}
      <div style={{display:'flex',position:'absolute',right:38,bottom:25,fontSize:15,color:'#91ad80'}}>terminl.net</div>
    </div>,{width:1200,height:630,fonts:[{name:'Space Mono',data:font,weight:700,style:'normal'}],headers:{'Cache-Control':'no-store'}});
  }catch{return new Response('Card temporarily unavailable',{status:503});}
}
