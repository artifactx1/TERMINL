import Link from 'next/link';
import {useEffect,useState} from 'react';
import {campaignRequest,campaignEvent} from '../../lib/arcade/campaign-client';
import {GTD_NOTE} from '../../lib/arcade/campaign-rules.mjs';
import s from '../../styles/Campaign.module.css';

const when=ms=>new Date(ms).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
/** How the top of the board becomes GTD spots, and when. */
export function GtdBanner({gtd}){
  if(!gtd?.slots)return null;
  return <p className={s.notice}>{gtd.closed?<>The leaderboard has closed. The top {gtd.slots} hold GTD WL spots{gtd.submitOpen?' and can add their mint address on the Arcade Pass':''}.</>
    :gtd.scheduled?<>The top {gtd.slots} when the leaderboard closes on <b>{when(gtd.endsAt)}</b> get GTD WL spots.</>
    :<>The top {gtd.slots} when the leaderboard closes get GTD WL spots. The closing time will be announced.</>} {GTD_NOTE}</p>;
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
