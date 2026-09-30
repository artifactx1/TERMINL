import dynamic from "next/dynamic";
import ArcadeMeta from "../../components/arcade/ArcadeMeta";
const Rumble=dynamic(()=>import("../../components/arcade/Rumble"),{ssr:false,loading:()=> <p style={{padding:40,color:"var(--terminl-accent)",fontFamily:"var(--terminl-font)"}}>Loading REKT RUMBLE…</p>});
export default function RumblePage({assetLabEnabled}){return <><ArcadeMeta card='rekt-rumble'/><Rumble assetLabEnabled={assetLabEnabled} /></>;}
export function getServerSideProps(){return {props:{assetLabEnabled:process.env.ARCADE_LABS==="1"}};}
