import {ImageResponse} from 'next/og';
import {ARCADE_SHARES,arcadeShare} from '../../../lib/arcade/share.mjs';

/* ImageResponse renders raw image elements into the generated PNG. */
/* eslint-disable @next/next/no-img-element */

export const config={runtime:'edge'};

export default async function handler(request){
  const slug=new URL(request.url).pathname.split('/').at(-1);
  if(!Object.hasOwn(ARCADE_SHARES,slug||''))return new Response('Not found',{status:404});
  const origin=new URL(request.url).origin;
  const absolute=path=>new URL(path,origin).toString();
  const fontResponse=await fetch(absolute('/fonts/SpaceMono-Bold.ttf'));
  if(!fontResponse.ok)return new Response('Font unavailable',{status:503});
  const card=arcadeShare(slug),fontData=await fontResponse.arrayBuffer();
  return new ImageResponse(<div style={{display:'flex',width:'100%',height:'100%',background:'#060a07',color:'#f1ffe9',fontFamily:'Space Mono',position:'relative',overflow:'hidden'}}>
    {card.scene&&<img src={absolute(card.scene)} width='1200' height='630' alt='' style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:.48}}/>}
    <div style={{display:'flex',position:'absolute',inset:0,background:'linear-gradient(90deg,#060a07 0%,rgba(6,10,7,.98) 38%,rgba(6,10,7,.56) 68%,rgba(6,10,7,.18) 100%)'}}/>
    <div style={{display:'flex',position:'absolute',inset:0,background:'linear-gradient(0deg,rgba(6,10,7,.82) 0%,transparent 44%)'}}/>
    {card.figures?.map((figure,index)=><img key={figure} src={absolute(figure)} width={slug==='wen-lambo'||slug==='arcade'?380:330} height={slug==='wen-lambo'||slug==='arcade'?560:550} alt='' style={{position:'absolute',right:card.figures.length>1?index?18:290:slug==='wen-lambo'||slug==='arcade'?45:46,bottom:slug==='wen-lambo'||slug==='arcade'?-10:-30,width:slug==='wen-lambo'||slug==='arcade'?380:330,height:slug==='wen-lambo'||slug==='arcade'?560:550,objectFit:'contain',objectPosition:'center bottom',opacity:.98}}/>)}
    <div style={{display:'flex',flexDirection:'column',width:760,height:'100%',padding:'50px 54px',position:'relative'}}>
      <div style={{display:'flex',alignItems:'center',fontSize:19,letterSpacing:5,color:card.accent}}><span style={{display:'flex',width:48,height:3,background:card.accent,marginRight:17}}/>{card.eyebrow}</div>
      <div style={{display:'flex',whiteSpace:'pre-line',fontSize:82,lineHeight:.98,letterSpacing:-4,marginTop:55,color:'#f1ffe9'}}>{card.headline}</div>
      <div style={{display:'flex',fontSize:21,lineHeight:1.45,color:'#c5d2bf',width:650,marginTop:28}}>{card.description}</div>
      <div style={{display:'flex',position:'absolute',left:54,bottom:42,alignItems:'center',fontSize:17,color:'#f1ffe9',letterSpacing:2}}><span style={{display:'flex',color:card.accent,marginRight:18}}>TERMINL / ARCADE</span> FREE TO PLAY · NO WALLET</div>
    </div>
    <div style={{display:'flex',position:'absolute',right:35,bottom:30,fontSize:15,color:'#dbe8d4'}}>terminl.net</div>
  </div>,{width:1200,height:630,fonts:[{name:'Space Mono',data:fontData,weight:700,style:'normal'}]});
}
