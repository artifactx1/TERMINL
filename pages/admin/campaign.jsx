import Head from 'next/head';
import Link from 'next/link';
import {useState} from 'react';
import CampaignShell from '../../components/arcade/CampaignShell';
import {TRACKS,VEHICLES} from '../../lib/arcade/race-sim.mjs';
import s from '../../styles/Campaign.module.css';
const funnelColumns=[
  ['arcade_view','VISITORS','browsers'],['game_start','GAME STARTS'],['challenge_start','OFFICIAL STARTS'],
  ['verified','VERIFIED SEGMENTS'],['save_access_click','SAVE CLICKS'],['auth_success','SIGN-INS'],
  ['leaderboard_entry','NEW SCORES'],['result_card_prepared','CARDS'],['native_share_opened','SHARE SHEETS'],['result_link_copied','LINK COPIES'],['share_click','X DRAFTS'],
  ['challenge_link_opened','LINK VISITS'],['referred_player_started','INVITED STARTS'],
];
function DailyFunnel({days=[]}){
  const value=(events,key,field='total')=>key==='verified'?['cup_race_complete','rumble_fight_complete'].reduce((n,name)=>n+(events.find(e=>e.name===name)?.[field]||0),0)
    :key==='auth_success'?['x_oauth_success','discord_oauth_success','farcaster_auth_success'].reduce((n,name)=>n+(events.find(e=>e.name===name)?.[field]||0),0)
    :events.find(e=>e.name===key)?.[field]||0;
  return <section className={`${s.card} ${s.dailyFunnel}`}><h2>Daily arcade funnel</h2><p className={s.fine}>UTC days, newest first. Visitors are distinct browser IDs that day; other columns count events. New scores count signed-in players entering the verified leaderboard for the first time from this release onward. Draft clicks do not prove a post was published.</p>
    <div className={s.tableWrap}><table className={s.table}><thead><tr><th>DAY (UTC)</th>{funnelColumns.map(([,label])=><th key={label}>{label}</th>)}</tr></thead><tbody>{[...days].reverse().map(row=><tr key={row.day}><td>{row.day}</td>{funnelColumns.map(([key,label,field])=><td key={label}>{value(row.events,key,field)}</td>)}</tr>)}</tbody></table></div>
  </section>;
}
function WlChecker({data}){
  const summary=data?.summary||{},daily=data?.daily||[],sources=data?.sources||[];
  return <>
    <div className={s.sectionHeading}><h2>Allowlist checker</h2></div>
    <div className={s.grid} aria-label='Private allowlist checker activity in the last 30 days'>
      <section className={s.card}><span className={s.eyebrow}>COMPLETED CHECKS / 30 DAYS</span><h2>{summary.completed||0}</h2><p>Successful lookups, including repeat checks.</p></section>
      <section className={s.card}><span className={s.eyebrow}>BROWSERS CHECKING / 30 DAYS</span><h2>{summary.browsers||0}</h2><p>Distinct anonymous browser cookies.</p></section>
      <section className={s.card}><span className={s.eyebrow}>WALLETS SEARCHED / 30 DAYS</span><h2>{summary.wallets||0}</h2><p>Distinct wallet hashes; the addresses are not saved with these events.</p></section>
    </div>
    <p className={s.fine}>Tracking starts with this release. Of {summary.attempts||0} attempts, {summary.listed||0} returned listed, {summary.notListed||0} returned not listed and {summary.failed||0} failed. Browsers and wallets are estimates of interest, not a count of people or WL members. These figures are admin only.</p>
    <div className={s.tableWrap}><table className={s.table}><thead><tr><th>SOURCE</th><th>LIST</th><th>ATTEMPTS</th><th>COMPLETED</th><th>BROWSERS</th></tr></thead><tbody>{sources.map(row=><tr key={`${row.source}:${row.mode}`}><td>{row.source==='mint'?'Mint page':row.source==='wl'?'WL page':'Direct check'}</td><td>{row.mode==='published'?'Published mint list':'Rolling WL'}</td><td>{row.attempts}</td><td>{row.completed}</td><td>{row.browsers}</td></tr>)}</tbody></table></div>
    <div className={s.tableWrap}><table className={s.table}><thead><tr><th>DAY (UTC)</th><th>ATTEMPTS</th><th>COMPLETED</th><th>BROWSERS</th><th>WALLETS</th></tr></thead><tbody>{daily.map(row=><tr key={row.day}><td>{row.day}</td><td>{row.attempts}</td><td>{row.completed}</td><td>{row.browsers}</td><td>{row.wallets}</td></tr>)}</tbody></table></div>
  </>;
}
export default function CampaignAdmin(){
  const [token,setToken]=useState(''),[data,setData]=useState(null),[draft,setDraft]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[review,setReview]=useState({userId:'',status:'review',reason:''});
  const request=async(path,body)=>{const r=await fetch('/api/campaign/admin'+path,{method:body?'POST':'GET',headers:{'X-Campaign-Admin':token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const result=await r.json();if(!r.ok)throw new Error(result.error);return result;};
  const load=async()=>{setError('');setBusy(true);try{const next=await request('');setData(next);setDraft(next.config);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const update=(key,value)=>setDraft(d=>({...d,[key]:value}));
  const dateValue=ms=>ms?new Date(ms-new Date(ms).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  const date=(label,key)=><label key={key}>{label}<input type='datetime-local' value={dateValue(draft[key])} onChange={e=>update(key,e.target.value?new Date(e.target.value).getTime():0)}/></label>;
  const save=async e=>{e.preventDefault();setBusy(true);setError('');try{await request('/settings',{config:draft});setNotice('Campaign settings saved and audited.');await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
  const exportAddresses=async()=>{setBusy(true);setError('');try{const result=await request('/addresses');const csv='address,chain_id,route,updated_at\n'+result.addresses.map(row=>[row.address,row.chain_id,row.route,new Date(row.updated_at).toISOString()].join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const link=document.createElement('a');link.href=url;link.download=`terminl-${result.frozen?'frozen':'draft'}-addresses.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice(`${result.addresses.length} addresses with confirmed FCFS WL spots exported (${result.frozen?'submission window frozen':'draft — submissions can still change'}). This does not publish an onchain allowlist.`);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const download=(name,csv)=>{const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const exportGtd=async()=>{setBusy(true);setError('');try{const result=await request('/gtd');if(!result.closed)throw new Error('The leaderboard has not closed yet, so there is no GTD list.');
    download('terminl-gtd.csv','position,points,provider,handle,user_id,address\n'+result.holders.map(h=>[h.position,h.points,h.provider,h.username,h.id,h.address||''].join(',')).join('\n'));
    setNotice(`${result.holders.length} GTD holders exported; ${result.holders.filter(h=>!h.address).length} have not added an address yet.`);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const reviewUser=async e=>{e.preventDefault();setBusy(true);setError('');try{await request('/review',review);setNotice('Review decision saved and audited.');await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <CampaignShell><Head><title>Campaign admin — TERMINL</title><meta name='robots' content='noindex,nofollow'/></Head><h1 className={s.title}>Campaign controls.</h1><p><Link className={s.secondary} href='/admin/wl'>REVIEW WL APPLICATIONS →</Link></p>
    {!data?<form className={s.card} onSubmit={e=>{e.preventDefault();void load();}}><label>CAMPAIGN ADMIN TOKEN<input type='password' value={token} onChange={e=>setToken(e.target.value)} autoComplete='off' required/></label><button className={s.primary} disabled={busy}>OPEN DASHBOARD</button><p className={s.fine}>The token stays in memory for this page. It is not saved in browser storage.</p></form>:<>
      <p className={s.notice}>Identity providers: {Object.entries(data.providers||{}).filter(([,ready])=>ready).map(([provider])=>provider==='x'?'X':provider[0].toUpperCase()+provider.slice(1)).join(', ')||'none configured'}. Dates below use your local timezone. Spots are FCFS (mint while supply lasts), never advertised as GTD.</p>
      <WlChecker data={data.wlChecker}/>
      <div className={s.grid} aria-label='Arcade activity in the last 30 days'>
        <section className={s.card}><span className={s.eyebrow}>ARCADE / LAST 30 DAYS</span><h2>{data.funnel.find(e=>e.name==='arcade_view')?.players||0}</h2><p>Browsers that opened the arcade or a game.</p></section>
        <section className={s.card}><span className={s.eyebrow}>OFFICIAL CHALLENGES</span><h2>{data.funnel.find(e=>e.name==='challenge_start')?.total||0}</h2><p>Runs started against the bots.</p></section>
        <section className={s.card}><span className={s.eyebrow}>VERIFIED RESULTS</span><h2>{(data.funnel.find(e=>e.name==='cup_race_complete')?.total||0)+(data.funnel.find(e=>e.name==='rumble_fight_complete')?.total||0)}</h2><p>Races and fights replayed by the server.</p></section>
      </div><p className={s.fine}>These are 30-day totals, not a live player count. Arcade visits are counted once per browser per day, including direct game links.</p>
      <div className={s.grid} aria-label='Result sharing funnel in the last 30 days'>
        <section className={s.card}><span className={s.eyebrow}>RESULT CARDS PREPARED</span><h2>{data.funnel.find(e=>e.name==='result_card_prepared')?.total||0}</h2><p>Verified result cards created by players.</p></section>
        <section className={s.card}><span className={s.eyebrow}>NATIVE SHARE OPENS</span><h2>{data.funnel.find(e=>e.name==='native_share_opened')?.total||0}</h2><p>Players who opened their device share sheet. This does not prove a message was sent.</p></section>
        <section className={s.card}><span className={s.eyebrow}>RESULT LINKS COPIED</span><h2>{data.funnel.find(e=>e.name==='result_link_copied')?.total||0}</h2><p>Result URLs copied to the clipboard.</p></section>
        <section className={s.card}><span className={s.eyebrow}>X COMPOSER CLICKS</span><h2>{data.funnel.find(e=>e.name==='share_click')?.total||0}</h2><p>Players who chose to open an X draft. This does not prove a post was published.</p></section>
        <section className={s.card}><span className={s.eyebrow}>RESULT LINK VISITS</span><h2>{data.funnel.find(e=>e.name==='challenge_link_opened')?.total||0}</h2><p>Visits to player result cards.</p></section>
        <section className={s.card}><span className={s.eyebrow}>INVITED RUNS STARTED</span><h2>{data.funnel.find(e=>e.name==='referred_player_started')?.total||0}</h2><p>Official challenges started through a public result link.</p></section>
      </div>
      <DailyFunnel days={data.daily}/>
      <div className={s.tableWrap}><table className={s.table}><thead><tr><th>ROUTE</th><th>STATUS</th><th>SPOTS</th></tr></thead><tbody>{data.spots.map(row=><tr key={row.route+row.status}><td>{row.route}</td><td>{row.status}</td><td>{row.n}</td></tr>)}</tbody></table></div>
      <div className={s.adminGrid}><form className={s.card} onSubmit={save}><h2>Campaign and routes</h2><label className={s.check}><input type='checkbox' checked={draft.active} onChange={e=>update('active',e.target.checked)}/>Open official WL challenges</label>
        <label className={s.check}><input type='checkbox' checked={draft.cupEnabled} onChange={e=>update('cupEnabled',e.target.checked)}/>Barry Cup (Wen Lambo, six races)</label>
        <label className={s.check}><input type='checkbox' checked={draft.rumbleEnabled} onChange={e=>update('rumbleEnabled',e.target.checked)}/>Rekt Rumble circuit (six fights)</label>
        <label>Campaign name<input value={draft.name} onChange={e=>update('name',e.target.value)} maxLength={60} required/></label>
        {date('Challenges open','startsAt')}{date('Challenges close (blank = no scheduled end)','endsAt')}
        <label>Barry Cup opening track<select value={draft.track} onChange={e=>update('track',e.target.value)}>{Object.values(TRACKS).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Player car<select value={draft.vehicle} onChange={e=>update('vehicle',e.target.value)}>{Object.values(VEHICLES).map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <label>Barry’s car<select value={draft.botVehicle} onChange={e=>update('botVehicle',e.target.value)}>{Object.values(VEHICLES).map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <label>Barry’s pace (0.55–1.10)<input type='number' min='.55' max='1.1' step='.01' value={draft.botPace} onChange={e=>update('botPace',Number(e.target.value))}/></label>
        <label>FCFS WL spot limit, all routes (0 = no limit)<input type='number' min={0} max={1000000} value={draft.capacity} onChange={e=>update('capacity',Number(e.target.value))}/></label>
        <label>GTD spots for the leaderboard top (0 = none)<input type='number' min={0} max={10000} value={draft.gtdSlots} onChange={e=>update('gtdSlots',Number(e.target.value))}/></label>
        {date('Leaderboard closes / GTD list locks (end of marketing period)','gtdEndsAt')}{date('GTD address submissions close','gtdAddressEndsAt')}
        <p className={s.fine}>At the close, the top players by points (ties go to whoever reached their total first) become the GTD list. It cannot be changed afterwards.</p>
        {date('Address submission opens','addressStartsAt')}{date('Address submission closes / freezes','addressEndsAt')}<p className={s.fine}>Leave both address dates blank to collect addresses immediately with no scheduled freeze.</p>
        <label>Optional announcement URL<input type='url' value={draft.announcementUrl} onChange={e=>update('announcementUrl',e.target.value)} placeholder='https://x.com/…'/></label>
        <button className={s.primary} disabled={busy}>SAVE SETTINGS</button><p className={s.fine}>New settings apply to new attempts. Runs already issued keep their recorded challenge rules.</p>
      </form><div><section className={s.card}><h2>Last 30 days</h2><button className={s.secondary} onClick={exportAddresses} disabled={busy}>EXPORT FCFS ADDRESSES</button><button className={s.secondary} onClick={exportGtd} disabled={busy}>EXPORT GTD LIST</button><div className={s.tableWrap}><table className={s.table}><thead><tr><th>EVENT</th><th>TOTAL</th><th>BROWSERS</th></tr></thead><tbody>{data.funnel.map(e=><tr key={e.name}><td>{e.name}</td><td>{e.total}</td><td>{e.players}</td></tr>)}</tbody></table></div><p className={s.fine}>The BROWSERS column counts distinct anonymous browser IDs for each event, not signed-in accounts. Views and share clicks are deduplicated per browser/day. Starts and completed races or fights can include multiple attempts by one person. Race, fight and spot events come from verified server records.</p></section><section className={s.card}><h2>Game starts / last 30 days</h2><p className={s.fine}>Tracking begins when this update is deployed. Starts count attempts; browsers are distinct anonymous browser IDs, not people. Official starts also appear in the challenge_start event.</p><div className={s.tableWrap}><table className={s.table}><thead><tr><th>GAME</th><th>MODE</th><th>ATTEMPTS</th><th>BROWSERS</th></tr></thead><tbody>{(data.gameStarts||[]).map(row=><tr key={`${row.game}:${row.mode}`}><td>{row.game}</td><td>{row.mode}</td><td>{row.total}</td><td>{row.browsers}</td></tr>)}</tbody></table></div></section>
        <form className={s.card} onSubmit={reviewUser} style={{marginTop:20}}><h2>Review an account’s FCFS spot</h2><p className={s.fine}>Suspending an account also removes it from the leaderboard and the GTD export.</p><label>User ID<input value={review.userId} onChange={e=>setReview({...review,userId:e.target.value})} required/></label><label>Decision<select value={review.status} onChange={e=>setReview({...review,status:e.target.value})}><option value='review'>Under review</option><option value='qualified'>Confirm spots (capacity checked)</option><option value='banned'>Suspend</option></select></label><label>Audit reason<input value={review.reason} onChange={e=>setReview({...review,reason:e.target.value})} minLength={5} maxLength={300} required/></label><button className={s.secondary} disabled={busy}>SAVE REVIEW</button></form></div></div>
      <div className={s.sectionHeading}><h2>Recent players</h2><button className={s.secondary} onClick={load} disabled={busy}>REFRESH</button></div><div className={s.tableWrap}><table className={s.table}><thead><tr><th>ID</th><th>PROVIDER</th><th>HANDLE</th><th>WL SPOTS</th><th>POINTS</th><th>RESULT XP</th><th>ADDRESS</th></tr></thead><tbody>{data.users.map(u=><tr key={u.id}><td>{u.id}</td><td>{u.provider||'x'}</td><td>{u.provider==='farcaster'&&u.username==='fid'+u.id.slice(10)?'FID #'+u.id.slice(10):'@'+u.username}</td><td>{u.spots||'None'}</td><td>{u.points}</td><td>{u.share_xp||0}</td><td>{u.address||'Not submitted'}</td></tr>)}</tbody></table></div>
      <h2 className={s.sectionHeading}>Recent audit trail</h2><div className={s.tableWrap}><table className={s.table}><thead><tr><th>TIME</th><th>ACTOR</th><th>ACTION</th><th>DETAIL</th></tr></thead><tbody>{data.audit.map(a=><tr key={a.id}><td>{new Date(a.at).toLocaleString()}</td><td>{a.actor}</td><td>{a.action}</td><td><details><summary>VIEW</summary><pre>{JSON.stringify(JSON.parse(a.detail),null,2)}</pre></details></td></tr>)}</tbody></table></div>
      <button className={s.textButton} onClick={()=>{setToken('');setData(null);setDraft(null);}}>LOCK DASHBOARD</button>
    </>}
    {error&&<p role='alert' className={s.error}>{error}</p>}{notice&&<p role='status' className={s.notice}>{notice}</p>}
  </CampaignShell>;
}
