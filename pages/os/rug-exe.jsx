import Head from 'next/head';
import dynamic from 'next/dynamic';
const RugExe=dynamic(()=>import('../../components/arcade/RugExe'),{ssr:false,loading:()=> <p style={{padding:40,color:'var(--terminl-accent)'}}>Starting RUG.EXE…</p>});
export default function RugExePage(){return <><Head><title>RUG.EXE — TERMINL Arcade</title><meta name='description' content='The dev vanished. The bots didn’t. Fight through eight levels of scheduled maintenance in this free retro shooter.'/></Head><RugExe/></>;}
