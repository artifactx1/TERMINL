import Link from 'next/link';
import {useEffect,useState} from 'react';
import {campaignRequest,campaignEvent} from '../../lib/arcade/campaign-client';
import {ROUTES} from '../../lib/arcade/campaign-rules.mjs';
import s from '../../styles/Campaign.module.css';

/** Public points leaderboard. Names are shown only for players who opted in. */
export default function Leaderboard({limit=50,compact=false}){
  const [entries,setEntries]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let alive=true;
    campaignRequest('/leaderboard').then(b=>{if(alive)setEntries(b.entries);}).catch(e=>{if(alive)setError(e.message);});
    campaignRequest('/session').then(()=>campaignEvent('leaderboard_view')).catch(()=>{});
    return()=>{alive=false;};},[]);
  if(error)return <p role='alert' className={s.error}>{error}</p>;
  if(!entries)return <p className={s.empty}>Loading verified scores…</p>;
  const rows=entries.slice(0,limit);
  return <>{rows.length?<div className={s.tableWrap}><table className={s.table}><thead><tr><th>RANK</th><th>PLAYER</th><th>POINTS</th><th>WL SPOTS</th></tr></thead>
    <tbody>{rows.map((row,i)=><tr key={i}><td>#{row.rank}</td><td>{row.player}</td><td>{row.points}</td><td>{row.spots.length?row.spots.map(route=>ROUTES[route]?.short||route).join(' + '):'—'}</td></tr>)}</tbody></table></div>
    :<p className={s.empty}>No verified scores yet. Barry is unbearable about it.</p>}
    {compact&&<p><Link className={s.secondary} href='/leaderboard'>FULL LEADERBOARD →</Link></p>}
  </>;
}
