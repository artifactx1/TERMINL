import Head from 'next/head';
import Link from 'next/link';
import {useMemo,useState} from 'react';
import CampaignShell from '../../components/arcade/CampaignShell';
import s from '../../styles/Campaign.module.css';

const date=value=>value?new Date(value).toLocaleString():'—';
const requestLabel=kind=>kind==='both'?'ANY':kind.toUpperCase();
const PAGE_SIZE=100;
const EMPTY_APPLICATIONS=[];
const reviewLabels={likely_bot:'LIKELY BOT',review_during_burst:'REVIEW: DURING BURST',outside_burst:'BEFORE BURST',review_after_protection:'AFTER PROTECTION'};

export default function WlAdmin(){
  const [token,setToken]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [review,setReview]=useState({id:'',status:'',awardedKind:'fcfs',reason:''});
  const [entry,setEntry]=useState({address:'',kind:'fcfs',action:'add',reason:''});
  const [group,setGroup]=useState('all'),[search,setSearch]=useState(''),[page,setPage]=useState(1);
  const applications=data?.applications||EMPTY_APPLICATIONS;
  const counts=useMemo(()=>applications.reduce((result,row)=>{
    result[row.review_group]=(result[row.review_group]||0)+1;return result;
  },{}),[applications]);
  const filtered=useMemo(()=>{
    const query=search.trim().toLowerCase();
    return applications.filter(row=>(group==='all'||row.review_group===group)&&
      (!query||[row.address,row.email,row.id].some(value=>value.toLowerCase().includes(query))));
  },[applications,group,search]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)),currentPage=Math.min(page,pageCount);
  const visible=filtered.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  const request=async(path,body)=>{
    const response=await fetch('/api/campaign/admin/wl'+path,{method:body?'POST':'GET',headers:{'X-Campaign-Admin':token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Request failed');return result;
  };
  const load=async()=>{setBusy(true);setError('');try{setData(await request(''));}catch(e){setError(e.message);}finally{setBusy(false);}};
  const decide=async e=>{e.preventDefault();setBusy(true);setError('');try{await request('/review',review);setNotice('Decision saved to the WL.');setReview(v=>({...v,id:'',status:'',reason:''}));setData(await request(''));}catch(e){setError(e.message);}finally{setBusy(false);}};
  const change=async e=>{e.preventDefault();setBusy(true);setError('');try{await request('/entry',entry);setNotice('List entry updated.');setEntry(v=>({...v,address:'',reason:''}));setData(await request(''));}catch(e){setError(e.message);}finally{setBusy(false);}};
  const exportContacts=async()=>{setBusy(true);setError('');try{
    const {contacts}=await request('/contacts');
    const rows=['email,address,awarded_kind,reviewed_at',...contacts.map(row=>[row.email,row.address,row.awarded_kind,new Date(row.reviewed_at).toISOString()].join(','))];
    const url=URL.createObjectURL(new Blob([rows.join('\n')+'\n'],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='terminl-wl-approved-contacts.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice(`${contacts.length} approved contacts exported. Send the decision email before mint; export does not send it.`);
  }catch(e){setError(e.message);}finally{setBusy(false);}};
  const exportSubscribers=async()=>{setBusy(true);setError('');try{
    const response=await fetch('/api/campaign/admin/subscribers',{headers:{'X-Campaign-Admin':token}});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Export failed');
    const cell=value=>'"'+String(value).replaceAll('"','""')+'"';
    const rows=['email,subscribed_at',...result.subscribers.map(row=>[cell(row.email),cell(new Date(row.created_at).toISOString())].join(','))];
    const url=URL.createObjectURL(new Blob([rows.join('\n')+'\n'],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='terminl-launch-subscribers.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice(`${result.subscribers.length} launch subscribers exported. Exporting does not send email.`);
  }catch(e){setError(e.message);}finally{setBusy(false);}};
  return <CampaignShell><Head><title>WL applications — TERMINL admin</title><meta name='robots' content='noindex,nofollow'/></Head>
    <span className={s.eyebrow}>TERMINL / CAMPAIGN ADMIN</span><h1 className={s.title}>WL applications.</h1>
    <p className={s.fine}>Review applications, update the WL, and export approved email contacts. <Link href='/admin/campaign'>Arcade campaign controls →</Link></p>
    {!data?<form className={s.card} onSubmit={e=>{e.preventDefault();void load();}}><label>CAMPAIGN ADMIN TOKEN<input type='password' value={token} onChange={e=>setToken(e.target.value)} autoComplete='off' required/></label><button className={s.primary} disabled={busy}>OPEN APPLICATIONS</button><p className={s.fine}>The token stays in memory and is never saved in browser storage.</p></form>:<>
      <div className={s.actions}><button className={s.secondary} onClick={load} disabled={busy}>REFRESH</button><button className={s.secondary} onClick={exportContacts} disabled={busy}>EXPORT APPROVED EMAILS</button><button className={s.secondary} onClick={exportSubscribers} disabled={busy}>EXPORT LAUNCH SUBSCRIBERS</button></div>
      <p className={s.fine}>Master workbook loaded: {data.masterCounts?.find(row=>row.kind==='gtd')?.count||0} GTD and {data.masterCounts?.find(row=>row.kind==='fcfs')?.count||0} FCFS entries. Admin exclusions: {data.excludedCounts?.reduce((total,row)=>total+row.count,0)||0}. These totals are private to this dashboard.</p>
      <p className={s.fine}>The WL draw is October 26, 2026. Review and approve selected applications, then export approved contacts and send winner emails. Exporting the CSV does not send email. An approved application adds its wallet to the current WL; mint phases and final terms are published separately.</p>
      <div className={s.wlGrid}>
        <form className={s.card} onSubmit={decide}><h2>Review application</h2>
          <label>APPLICATION<select value={review.id} onChange={e=>setReview({...review,id:e.target.value})} required><option value=''>Choose an application</option>{applications.map(a=><option key={a.id} value={a.id}>{a.address.slice(0,10)}… · {reviewLabels[a.review_group]} · {a.status}</option>)}</select></label>
          {review.id&&<p className={s.fine}>Review label: {reviewLabels[applications.find(a=>a.id===review.id)?.review_group]||'—'}. This is a review hint, not a verified bot result.</p>}
          <label>DECISION<select value={review.status} onChange={e=>setReview({...review,status:e.target.value})} required><option value=''>Choose a decision</option><option value='approved'>Approve</option><option value='rejected'>Reject</option></select></label>
          {review.status==='approved'&&<label>AWARDED LIST<select value={review.awardedKind} onChange={e=>setReview({...review,awardedKind:e.target.value})}><option value='fcfs'>FCFS</option><option value='gtd'>GTD</option><option value='both'>Both</option></select></label>}
          <label>AUDIT REASON<input value={review.reason} onChange={e=>setReview({...review,reason:e.target.value})} minLength={5} maxLength={300} required/></label><button className={s.primary} disabled={busy}>SAVE DECISION</button>
        </form>
        <form className={s.card} onSubmit={change}><h2>Edit rolling list</h2><p>Use for partner, team, or corrected entries outside applications.</p>
          <label>WALLET<input value={entry.address} onChange={e=>setEntry({...entry,address:e.target.value})} placeholder='0x…' required/></label>
          <label>LIST<select value={entry.kind} onChange={e=>setEntry({...entry,kind:e.target.value})}><option value='fcfs'>FCFS</option><option value='gtd'>GTD</option></select></label>
          <label>ACTION<select value={entry.action} onChange={e=>setEntry({...entry,action:e.target.value})}><option value='add'>Add</option><option value='remove'>Remove</option></select></label>
          <label>AUDIT REASON<input value={entry.reason} onChange={e=>setEntry({...entry,reason:e.target.value})} minLength={5} maxLength={300} required/></label><button className={s.secondary} disabled={busy}>SAVE LIST CHANGE</button>
        </form>
      </div>
      <div className={s.sectionHeading}><h2>Applications ({applications.length})</h2></div>
      <p className={s.fine}>Review labels mark the October 19 traffic burst. They do not change WL status or automatically reject an application.</p>
      <div className={s.wlReviewCounts}>{Object.entries(reviewLabels).map(([key,label])=><span key={key}><b>{counts[key]||0}</b> {label}</span>)}</div>
      <div className={s.wlReviewControls}>
        <label>SHOW<select value={group} onChange={e=>{setGroup(e.target.value);setPage(1);}}><option value='all'>ALL APPLICATIONS</option>{Object.entries(reviewLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>FIND WALLET, EMAIL, OR ID<input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder='Search applications'/></label>
      </div>
      <p className={s.fine}>Showing {filtered.length?(currentPage-1)*PAGE_SIZE+1:0}–{Math.min(currentPage*PAGE_SIZE,filtered.length)} of {filtered.length} matching applications.</p>
      <div className={s.tableWrap}><table className={s.table}><thead><tr><th>RECEIVED</th><th>REVIEW LABEL</th><th>WALLET</th><th>EMAIL</th><th>REQUEST</th><th>STATUS</th><th>AWARDED</th><th>NOTE</th></tr></thead><tbody>{visible.map(a=><tr key={a.id}><td>{date(a.created_at)}</td><td><span className={`${s.wlReviewBadge} ${a.review_group==='likely_bot'?s.wlReviewFlag:''}`}>{reviewLabels[a.review_group]||'REVIEW'}</span></td><td>{a.address}</td><td>{a.email}</td><td>{requestLabel(a.requested_kind)}</td><td>{a.status.toUpperCase()}</td><td>{a.awarded_kind?.toUpperCase()||'—'}</td><td><details><summary>VIEW</summary><p>{a.note||'No note'}</p></details></td></tr>)}</tbody></table></div>
      {pageCount>1&&<div className={s.wlReviewPages}><button className={s.secondary} disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>PREVIOUS</button><span>PAGE {currentPage} OF {pageCount}</span><button className={s.secondary} disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>NEXT</button></div>}
      <div className={s.sectionHeading}><h2>Manual and approved entries</h2></div>
      <div className={s.tableWrap}><table className={s.table}><thead><tr><th>WALLET</th><th>LIST</th><th>SOURCE</th><th>ADDED</th></tr></thead><tbody>{data.entries.map(row=><tr key={row.address+row.kind}><td>{row.address}</td><td>{row.kind.toUpperCase()}</td><td>{row.source}</td><td>{date(row.created_at)}</td></tr>)}</tbody></table></div>
      <button className={s.textButton} onClick={()=>{setToken('');setData(null);}}>LOCK DASHBOARD</button>
    </>}
    {error&&<p role='alert' className={s.error}>{error}</p>}{notice&&<p role='status' className={s.notice}>{notice}</p>}
  </CampaignShell>;
}
