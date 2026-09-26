import {ImageResponse} from 'next/og';

export const config={runtime:'edge'};
const time=ticks=>{if(ticks===null)return 'DNF';const ms=Math.round(ticks*1000/60);return `${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
export default async function handler(request){
  const code=new URL(request.url).pathname.split('/').at(-1);
  if(!/^[A-Za-z0-9_-]{16}$/.test(code||''))return new Response('Not found',{status:404});
  const base=process.env.CAMPAIGN_API_URL,secret=process.env.CAMPAIGN_SERVICE_TOKEN;
  if(!base||!secret)return new Response('Campaign unavailable',{status:503});
  try{
    const result=await fetch(base.replace(/\/$/,'')+'/campaign/results/'+code,{headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(10000)});
    if(!result.ok)return new Response('Result unavailable',{status:result.status===404?404:503});
    const run=await result.json(),origin=new URL(process.env.CAMPAIGN_SITE_ORIGIN||'https://terminl.net').origin;
    const font=await fetch(origin+'/fonts/SpaceMono-Bold.ttf').then(r=>{if(!r.ok)throw new Error('Font unavailable');return r.arrayBuffer();});
    return new ImageResponse(<div style={{display:'flex',width:'100%',height:'100%',background:'#080e09',color:'#f0ffe9',fontFamily:'Space Mono',padding:48,position:'relative'}}>
      <div style={{display:'flex',flexDirection:'column',width:780,position:'relative'}}>
        <div style={{display:'flex',fontSize:22,letterSpacing:7,color:'#b3ef8b'}}>TERMINL / WEN LAMBO</div>
        <div style={{display:'flex',fontSize:30,marginTop:45}}>{run.player}</div>
        <div style={{display:'flex',fontSize:54,marginTop:12}}>BEAT BARRYBOT.</div>
        <div style={{display:'flex',fontSize:104,lineHeight:1.3,color:'#b3ef8b'}}>{time(run.result.playerTicks)}</div>
        <div style={{display:'flex',fontSize:20,color:'#a2b39b',marginTop:8}}>Barry would like a recount.</div>
        <div style={{display:'flex',alignItems:'center',fontSize:18,borderTop:'1px solid #49643c',paddingTop:24,marginTop:36}}>VERIFIED WIN · ARCADE QUALIFIED</div>
        <div style={{display:'flex',fontSize:26,marginTop:20}}>YOUR TURN. →</div>
      </div>
      <div style={{display:'flex',position:'absolute',right:0,top:0,width:390,height:630,background:'linear-gradient(180deg,#162a16,#080e09)',alignItems:'flex-end',justifyContent:'center'}}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={origin+'/degens/diamond-hands-pepe-share.png'} width={310} height={511} alt=''/>
      </div>
      <div style={{display:'flex',position:'absolute',right:38,bottom:25,fontSize:15,color:'#91ad80'}}>terminl.net</div>
    </div>,{width:1200,height:630,fonts:[{name:'Space Mono',data:font,weight:700,style:'normal'}],headers:{'Cache-Control':'no-store'}});
  }catch{return new Response('Card temporarily unavailable',{status:503});}
}
