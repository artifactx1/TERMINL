import Head from 'next/head';
import dynamic from 'next/dynamic';
const MoonCampaign=dynamic(()=>import('../../components/arcade/MoonCampaign'),{ssr:false,loading:()=> <p style={{padding:40,color:'var(--terminl-accent)',fontFamily:'var(--terminl-font)'}}>Preparing your mission…</p>});
export default function MoonPage(){return <><Head><title>Moon Mission — TERMINL Arcade</title><meta name='description' content='The token never reached the moon, so you’re walking. Ten levels, double jumps and one very annoyed Warden. Free to play.'/></Head><MoonCampaign/></>;}
