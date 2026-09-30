import dynamic from 'next/dynamic';
import ArcadeMeta from '../../components/arcade/ArcadeMeta';
const WenLambo=dynamic(()=>import('../../components/arcade/WenLambo'),{ssr:false,loading:()=> <p style={{padding:40,color:'var(--terminl-accent)',fontFamily:'var(--terminl-font)'}}>Opening the garage…</p>});
export default function LamboPage(){return <><ArcadeMeta card='wen-lambo'/><WenLambo/></>;}
