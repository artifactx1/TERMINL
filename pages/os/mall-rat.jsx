import Head from 'next/head';
import dynamic from 'next/dynamic';
const MallRat=dynamic(()=>import('../../components/arcade/MallRat'),{ssr:false,loading:()=> <p style={{padding:40,color:'var(--terminl-accent)'}}>Opening the mall…</p>});
export default function MallRatPage(){return <><Head><title>MALL RAT — TERMINL Arcade</title><meta name='description' content='Four degens, seventeen districts and a mall security team updating their CVs. Skate, spin and chain tricks. Free to play.'/></Head><MallRat/></>;}
