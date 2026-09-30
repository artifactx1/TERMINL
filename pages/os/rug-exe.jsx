import dynamic from 'next/dynamic';
import ArcadeMeta from '../../components/arcade/ArcadeMeta';
const RugExe=dynamic(()=>import('../../components/arcade/RugExe'),{ssr:false,loading:()=> <p style={{padding:40,color:'var(--terminl-accent)'}}>Starting RUG.EXE…</p>});
export default function RugExePage(){return <><ArcadeMeta card='rug-exe'/><RugExe/></>;}
