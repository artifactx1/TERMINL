/* Private image responses must bypass Next's shared image optimizer cache. */
/* eslint-disable @next/next/no-img-element */
import Head from 'next/head';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import s from '../../styles/CollectionPreview.module.css';

const root='/api/admin/collection';
const padded=id=>String(id).padStart(4,'0');
const image=(id,size='thumb')=>`${root}/image/${padded(id)}?size=${size}`;

export default function CollectionPreview(){
  const [authenticated,setAuthenticated]=useState(false);
  const [checking,setChecking]=useState(true);
  const [token,setToken]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [items,setItems]=useState([]);
  const [ids,setIds]=useState([]);
  const [facets,setFacets]=useState({});
  const [next,setNext]=useState(null);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(false);
  const [search,setSearch]=useState('');
  const [query,setQuery]=useState('');
  const [trait,setTrait]=useState('');
  const [value,setValue]=useState('');
  const [sort,setSort]=useState('asc');
  const [selected,setSelected]=useState(null);
  const [detail,setDetail]=useState(null);
  const sentinel=useRef(null);
  const requestId=useRef(0);

  useEffect(()=>{fetch(`${root}/session`,{cache:'no-store'}).then(r=>r.json()).then(d=>setAuthenticated(!!d.authenticated)).catch(()=>{}).finally(()=>setChecking(false));},[]);
  useEffect(()=>{const timer=setTimeout(()=>setQuery(search.trim()),250);return ()=>clearTimeout(timer);},[search]);
  useEffect(()=>{
    if(!authenticated)return;
    const current=++requestId.current;
    const params=new URLSearchParams({q:query,trait,value,sort,offset:'0',limit:'48'});
    setLoading(true);setItems([]);setNext(null);setError('');
    fetch(`${root}/catalog?${params}`,{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error('Collection preview is unavailable.');return r.json();}).then(data=>{
      if(current!==requestId.current)return;
      setItems(data.items);setIds(data.ids);setFacets(data.facets||{});setNext(data.next);setTotal(data.total);
    }).catch(e=>{if(current===requestId.current)setError(e.message);}).finally(()=>{if(current===requestId.current)setLoading(false);});
  },[authenticated,query,trait,value,sort]);
  useEffect(()=>{
    if(selected===null){setDetail(null);return;}
    const cached=items.find(item=>item.id===selected);
    if(cached){setDetail(cached);return;}
    let active=true;
    fetch(`${root}/item/${padded(selected)}`,{cache:'no-store'}).then(r=>r.json()).then(data=>{if(active)setDetail(data);});
    return ()=>{active=false;};
  },[selected,items]);
  useEffect(()=>{
    if(selected===null)return;
    const onKey=e=>{
      if(e.key==='Escape')setSelected(null);
      const index=ids.indexOf(selected);
      if(e.key==='ArrowRight'&&index<ids.length-1)setSelected(ids[index+1]);
      if(e.key==='ArrowLeft'&&index>0)setSelected(ids[index-1]);
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[selected,ids]);

  const loadMore=useCallback(async()=>{
    if(next===null||loading)return;
    const current=requestId.current,offset=next;
    setLoading(true);
    try{
      const params=new URLSearchParams({q:query,trait,value,sort,offset:String(offset),limit:'48'});
      const response=await fetch(`${root}/catalog?${params}`,{cache:'no-store'});
      if(!response.ok)throw new Error('Could not load the next page.');
      const data=await response.json();
      if(current===requestId.current){setItems(rows=>[...rows,...data.items]);setNext(data.next);}
    }catch(e){if(current===requestId.current)setError(e.message);}finally{if(current===requestId.current)setLoading(false);}
  },[next,loading,query,trait,value,sort]);
  useEffect(()=>{
    if(!authenticated||next===null||loading||!sentinel.current)return;
    const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting)void loadMore();},{rootMargin:'600px'});
    observer.observe(sentinel.current);return ()=>observer.disconnect();
  },[authenticated,next,loading,loadMore]);

  const signIn=async e=>{
    e.preventDefault();setBusy(true);setError('');
    try{
      const response=await fetch(`${root}/session`,{method:'POST',headers:{'X-Campaign-Admin':token},cache:'no-store'});
      if(!response.ok)throw new Error(response.status===404?'Invalid admin token.':'Admin sign-in is unavailable.');
      setToken('');setAuthenticated(true);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const signOut=async()=>{await fetch(`${root}/session`,{method:'DELETE'});setAuthenticated(false);setSelected(null);setItems([]);setIds([]);};
  const choose=(type,name)=>{setTrait(type);setValue(name);};
  const selectedIndex=ids.indexOf(selected);

  return <main className={s.page}>
    <Head><title>Collection preview · TERMINL admin</title><meta name='robots' content='noindex,nofollow,noarchive'/></Head>
    <header className={s.header}><Link href='/' className={s.brand}>TERMINL<span>.net</span></Link><span className={s.adminTag}>PRIVATE COLLECTION / ADMIN</span><nav><Link href='/admin/campaign'>CAMPAIGN</Link><Link href='/admin/wl'>WL</Link>{authenticated&&<button onClick={signOut}>LOCK</button>}</nav></header>
    {checking?<div className={s.center}>CHECKING ACCESS…</div>:!authenticated?<section className={s.login}><span className={s.eyebrow}>ADMIN ACCESS</span><h1>The whole collection.</h1><p>Enter your campaign admin token to browse all 2,048 pieces and their traits.</p><form onSubmit={signIn}><label htmlFor='admin-token'>CAMPAIGN ADMIN TOKEN</label><input id='admin-token' type='password' value={token} onChange={e=>setToken(e.target.value)} autoComplete='off' required/><button disabled={busy}>{busy?'VERIFYING…':'OPEN COLLECTION →'}</button></form><small>The token stays in memory and is never saved in browser storage.</small>{error&&<p role='alert' className={s.error}>{error}</p>}</section>:<>
      <section className={s.hero}><span className={s.eyebrow}>TERMINL / COLLECTION FILES</span><h1>All 2,048. Every detail.</h1><p>Scroll the grid, filter by trait, and open any piece to inspect its full image and metadata.</p><div className={s.heroCounts}><span><b>2,048</b> FILES</span><span><b>{total.toLocaleString()}</b> MATCHING</span><span>ADMIN VIEW ONLY</span></div></section>
      <div className={s.toolbar}><input aria-label='Search collection' type='search' placeholder='Search number, name, or trait…' value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label='Sort collection' value={sort} onChange={e=>setSort(e.target.value)}><option value='asc'>NUMBER: LOW TO HIGH</option><option value='desc'>NUMBER: HIGH TO LOW</option></select></div>
      <div className={s.layout}><aside className={s.filters}><div className={s.filterHead}><h2>FILTERS</h2>{value&&<button onClick={()=>choose('','')}>CLEAR</button>}</div>{value&&<div className={s.activeFilter}>{trait}: {value} <button aria-label='Clear filter' onClick={()=>choose('','')}>×</button></div>}{Object.entries(facets).map(([type,values])=><details key={type} open={type===trait}><summary>{type}<span>{values.length}</span></summary><div className={s.options}>{values.map(([name,count])=><button key={name} className={trait===type&&value===name?s.active:''} onClick={()=>choose(type,name)}><span>{name}</span><small>{count}</small></button>)}</div></details>)}</aside>
        <section className={s.results} aria-label='Collection artwork'><div className={s.resultHead}><span>{total.toLocaleString()} RESULTS</span><span>SCROLL TO LOAD MORE ↓</span></div>{error&&<p role='alert' className={s.error}>{error}</p>}{!loading&&!items.length?<p className={s.empty}>No pieces match these filters.</p>:null}<div className={s.grid}>{items.map(item=><button key={item.id} className={s.card} onClick={()=>setSelected(item.id)}><span className={s.art}><img src={image(item.id)} alt={item.name} loading='lazy'/></span><span className={s.cardInfo}><strong>{item.name}</strong><small>{item.attributes.find(a=>a.trait_type==='Companion')?.value||item.attributes.find(a=>a.trait_type==='Screen / Face')?.value||'TERMINL'}</small></span></button>)}</div><div ref={sentinel} className={s.sentinel}>{loading?'LOADING…':next!==null?<button onClick={loadMore}>LOAD MORE ↓</button>:items.length?'END OF RESULTS':''}</div></section>
      </div>
      {selected!==null&&<div className={s.scrim} onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}} role='presentation'><section className={s.modal} role='dialog' aria-modal='true' aria-label={detail?.name||'Collection item'}><div className={s.modalTop}><span>FILE {padded(selected)} / {selectedIndex+1} OF {ids.length}</span><button onClick={()=>setSelected(null)} aria-label='Close detail'>CLOSE ×</button></div><div className={s.modalBody}><div className={s.fullArt}><img key={selected} src={image(selected,'full')} alt={detail?.name||`TERMINL #${padded(selected)}`}/></div><div className={s.detail}><span className={s.eyebrow}>TERMINL COLLECTION</span><h2>{detail?.name||`TERMINL #${padded(selected)}`}</h2><p>{detail?.description||'A celebration of art, memes, and degenerate behavior.'}</p>{detail?.screen_artist&&<a href={detail.screen_artist.x_url} target='_blank' rel='noreferrer'>SCREEN ARTIST: {detail.screen_artist.name} · {detail.screen_artist.x_handle} ↗</a>}<h3>PROPERTIES</h3><div className={s.traits}>{detail?.attributes?.map(a=><div key={a.trait_type}><small>{a.trait_type}</small><strong>{a.value}</strong></div>)}</div><a href={image(selected,'full')} target='_blank' rel='noreferrer'>OPEN FULL IMAGE ↗</a><div className={s.arrows}><button disabled={selectedIndex<=0} onClick={()=>setSelected(ids[selectedIndex-1])}>← PREVIOUS</button><button disabled={selectedIndex<0||selectedIndex>=ids.length-1} onClick={()=>setSelected(ids[selectedIndex+1])}>NEXT →</button></div></div></div></section></div>}
    </>}
  </main>;
}
