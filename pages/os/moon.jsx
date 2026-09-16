import Head from 'next/head';
import dynamic from 'next/dynamic';
const MoonCampaign=dynamic(()=>import('../../components/arcade/MoonCampaign'),{ssr:false,loading:()=> <p style={{padding:40,color:'#b2ed7a'}}>Preparing your mission…</p>});
export default function MoonPage(){return <><Head><title>Moon Mission — TERMINL Arcade</title><meta name='description' content='A ten-level platform adventure from the city to the moon. Double jump, discover new worlds, and defeat the final boss.'/></Head><MoonCampaign/></>;}
