import Link from 'next/link';
import {useEffect,useState} from 'react';
import {campaignRequest,campaignEvent} from '../../lib/arcade/campaign-client';
import s from '../../styles/Campaign.module.css';

/** Qualification is closed; public notices never disclose phase allocations. */
export function GtdBanner(){
  return <p className={s.notice}>Allowlist qualification has closed. <Link href='/#allowlist-checker'>Check your existing mint eligibility →</Link></p>;
}
/** Public points leaderboard. Names are shown only for players who opted in. */
export default function Leaderboard({limit=100,compact=false,banner=false,quietOnError=false}){
  const [board,setBoard]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let alive=true;
    campaignRequest('/leaderboard').then(b=>{if(alive)setBoard(b);}).catch(e=>{if(alive)setError(e.message);});
    campaignRequest('/session').then(()=>campaignEvent('leaderboard_view')).catch(()=>{});
    return()=>{alive=false;};},[]);
  if(error)return <p role={quietOnError?'status':'alert'} className={quietOnError?s.empty:s.error}>{quietOnError?'Live scores are updating. Open the full leaderboard shortly.':error}</p>;
  if(!board)return <p className={s.empty}>Loading verified scores…</p>;
  const rows=board.entries.slice(0,limit);
  return <>{banner&&<GtdBanner gtd={board.gtd}/>}
    {rows.length?<div className={s.tableWrap}><table className={s.table}><thead><tr><th>RANK</th><th>PLAYER</th><th>POINTS</th></tr></thead>
    <tbody>{rows.map((row,i)=><tr key={i}><td>#{row.rank}</td><td>{row.player}</td><td>{row.points}</td></tr>)}</tbody></table></div>
    :<p className={s.empty}>No verified scores yet. Barry is unbearable about it.</p>}
    {compact&&<p><Link className={s.secondary} href='/leaderboard'>FULL LEADERBOARD →</Link></p>}
  </>;
}
