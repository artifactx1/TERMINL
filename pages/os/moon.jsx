import dynamic from 'next/dynamic';
import ArcadeMeta from '../../components/arcade/ArcadeMeta';
const MoonCampaign=dynamic(()=>import('../../components/arcade/MoonCampaign'),{ssr:false,loading:()=> <p style={{padding:40,color:'var(--terminl-accent)',fontFamily:'var(--terminl-font)'}}>Preparing your mission…</p>});
export default function MoonPage(){return <><ArcadeMeta card='moon-mission'/><MoonCampaign/></>;}
