import dynamic from 'next/dynamic';
import ArcadeMeta from '../../components/arcade/ArcadeMeta';
const MallRat=dynamic(()=>import('../../components/arcade/MallRat'),{ssr:false,loading:()=> <p style={{padding:40,color:'var(--terminl-accent)'}}>Opening the mall…</p>});
export default function MallRatPage(){return <><ArcadeMeta card='mall-rat'/><MallRat/></>;}
