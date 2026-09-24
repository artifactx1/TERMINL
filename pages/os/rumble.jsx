import Head from "next/head";
import dynamic from "next/dynamic";
const Rumble=dynamic(()=>import("../../components/arcade/Rumble"),{ssr:false,loading:()=> <p style={{padding:40,color:"var(--terminl-accent)",fontFamily:"var(--terminl-font)"}}>Loading REKT RUMBLE…</p>});
export default function RumblePage({assetLabEnabled}){return <><Head><title>REKT RUMBLE — TERMINL Arcade</title><meta name="robots" content="noindex" /></Head><Rumble assetLabEnabled={assetLabEnabled} /></>;}
export function getServerSideProps(){return {props:{assetLabEnabled:process.env.ARCADE_LABS==="1"}};}
