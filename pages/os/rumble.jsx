import Head from "next/head";
import dynamic from "next/dynamic";
const Rumble=dynamic(()=>import("../../components/arcade/Rumble"),{ssr:false,loading:()=> <p style={{padding:40,color:"#9cec78"}}>Loading REKT RUMBLE…</p>});
export default function RumblePage(){return <><Head><title>REKT RUMBLE — TERMINL Arcade Labs</title><meta name="robots" content="noindex" /></Head><Rumble /></>;}
export function getServerSideProps(){return process.env.ARCADE_LABS==="1"?{props:{}}:{notFound:true};}
