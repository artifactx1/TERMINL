import Head from 'next/head';
import dynamic from 'next/dynamic';
const WenLambo=dynamic(()=>import('../../components/arcade/WenLambo'),{ssr:false,loading:()=> <p style={{padding:40,color:'var(--terminl-accent)',fontFamily:'var(--terminl-font)'}}>Opening the garage…</p>});
export default function LamboPage(){return <><Head><title>WEN LAMBO — TERMINL Arcade</title><meta name='robots' content='noindex'/></Head><WenLambo/></>;}
