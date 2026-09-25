import Head from 'next/head';
import dynamic from 'next/dynamic';
const MallRat=dynamic(()=>import('../../components/arcade/MallRat'),{ssr:false,loading:()=> <p style={{padding:40,color:'var(--terminl-accent)'}}>Opening the mall…</p>});
export default function MallRatPage(){return <><Head><title>MALL RAT — TERMINL Arcade</title><meta name='description' content='After-hours skateboarding. Chain tricks, find hidden routes and leave a spectacular repair bill.'/></Head><MallRat/></>;}
