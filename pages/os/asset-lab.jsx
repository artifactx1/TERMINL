import Head from "next/head";
import dynamic from "next/dynamic";
const AssetLab=dynamic(()=>import("../../components/arcade/AssetLab"),{ssr:false});
export default function AssetLabPage(){return <><Head><title>Asset lab — TERMINL</title><meta name="robots" content="noindex" /></Head><AssetLab /></>;}
export function getServerSideProps(){return process.env.ARCADE_LABS==="1"?{props:{}}:{notFound:true};}
