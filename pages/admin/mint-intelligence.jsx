import Head from 'next/head';
import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {DEFAULT_SCENARIO,PRICE_POINTS,REVIEW_LABELS,hydrateWallet,scenarioInputs,analyzeWallets,allocationRisk,balanceMatrix,fundingFor,inPool,ethAmount,csvFor} from '../../lib/wallet-intelligence.mjs';
import {FundingDonut,PriceChart,CohortBars,BalanceHeatmap,ApplicationTimeline,ROUTES} from '../../components/admin/WalletCharts';
import s from '../../styles/WalletIntelligence.module.css';

const n=value=>Number(value).toLocaleString('en-US');
const time=value=>new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
const balance=value=>value>0n&&value<1000000000000n?'<0.000001':ethAmount(value,6);
const POOLS=[['eligible','Current allowlist'],['gtd','GTD, including both tiers'],['fcfs-only','FCFS only'],['applications','All applications'],['pending-new','Pending applicants not listed'],['checked','Recorded WL check'],['all','All unique addresses']];
const PER_PAGE=40;

function Metric({label,value,detail,tone}){return <div className={`${s.metric} ${tone==='warning'?s.metricWarning:''}`}><span>{label}</span><strong>{typeof value==='number'?n(value):value}</strong><small>{detail}</small></div>;}
function Input({label,name,value,onChange,...props}){return <label>{label}<input name={name} value={value} onChange={e=>onChange(name,e.target.value)} {...props}/></label>;}

export default function MintIntelligence(){
  const [token,setToken]=useState(''),[data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loadedAt,setLoadedAt]=useState(0);
  const [inputs,setInputs]=useState({...DEFAULT_SCENARIO}),[pool,setPool]=useState('eligible'),[activity,setActivity]=useState('all'),[reviewGroup,setReviewGroup]=useState('all');
  const [route,setRoute]=useState('all'),[query,setQuery]=useState(''),[sort,setSort]=useState('priority'),[page,setPage]=useState(1),[mode,setMode]=useState('bridge');
  const controller=useRef(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const load=async()=>{
    controller.current?.abort();const request=new AbortController();controller.current=request;setBusy(true);setError('');
    try{
      const response=await fetch('/api/admin/wallet-intelligence',{headers:{'X-Campaign-Admin':token},signal:request.signal,cache:'no-store'});
      const result=await response.json();
      if(!response.ok)throw new Error(response.status===404?'Admin token not accepted.':result.error||'Unable to load the analysis.');
      if(!request.signal.aborted){setData(result);setLoadedAt(Date.now());}
    }catch(e){if(e.name!=='AbortError')setError(e.message);}finally{if(controller.current===request)setBusy(false);}
  };
  const lock=()=>{controller.current?.abort();setToken('');setData(null);setError('');setBusy(false);};
  const parsed=useMemo(()=>{try{return {value:scenarioInputs(inputs)}}catch(e){return {error:e.message}}},[inputs]);
  const scenario=parsed.value||scenarioInputs(DEFAULT_SCENARIO);
  const wallets=useMemo(()=>data?data.wallets.map(row=>hydrateWallet(row,data.sourceNames)):[],[data]);
  const selected=useMemo(()=>wallets.filter(w=>inPool(w,pool)&&(activity==='all'||activity==='active'&&w.active||activity==='checked'&&w.checked)&&
    (reviewGroup==='all'||w.application?.reviewGroup===reviewGroup)),[wallets,pool,activity,reviewGroup]);
  const stats=useMemo(()=>analyzeWallets(selected,scenario),[selected,scenario]);
  const risk=useMemo(()=>allocationRisk(wallets,scenario),[wallets,scenario]);
  const applicationStats=useMemo(()=>analyzeWallets(wallets.filter(w=>w.application&&!w.eligible&&w.application.status==='pending'),scenario),[wallets,scenario]);
  const allocatedStats=useMemo(()=>analyzeWallets(wallets.filter(w=>w.eligible),scenario),[wallets,scenario]);
  const pricePoints=useMemo(()=>PRICE_POINTS.map(price=>({price,...analyzeWallets(selected,scenarioInputs({...scenario,price}))})),[selected,scenario]);
  const matrix=useMemo(()=>balanceMatrix(selected),[selected]);
  const cohorts=useMemo(()=>[
    ['GTD only',w=>w.gtd&&!w.fcfs],['GTD + FCFS',w=>w.gtd&&w.fcfs],['FCFS only',w=>w.fcfs&&!w.gtd],['Applicants not listed',w=>!w.eligible&&!!w.application],
  ].map(([label,filter])=>({label,stats:analyzeWallets(wallets.filter(filter),scenario)})),[wallets,scenario]);
  const rows=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    return selected.map(wallet=>({wallet,funding:fundingFor(wallet,scenario)})).filter(({wallet,funding})=>(route==='all'||funding.route===route)&&(!needle||wallet.address.includes(needle)||wallet.sources.some(source=>source.toLowerCase().includes(needle))))
      .sort((a,b)=>{if(sort==='rh')return a.wallet.robinhood.native===b.wallet.robinhood.native?a.wallet.address.localeCompare(b.wallet.address):a.wallet.robinhood.native>b.wallet.robinhood.native?-1:1;
        if(sort==='eth')return a.wallet.ethereum.native===b.wallet.ethereum.native?a.wallet.address.localeCompare(b.wallet.address):a.wallet.ethereum.native>b.wallet.ethereum.native?-1:1;
        const priority=x=>({ready:4,bridge:3,convert:2,underfunded:1,contract:0}[x.funding.route]*10+Number(x.wallet.active)*2+Number(x.wallet.checked));
        return priority(b)-priority(a)||a.wallet.address.localeCompare(b.wallet.address);});
  },[selected,scenario,route,query,sort]);
  const pages=Math.max(1,Math.ceil(rows.length/PER_PAGE)),currentPage=Math.min(page,pages),visible=rows.slice((currentPage-1)*PER_PAGE,currentPage*PER_PAGE);
  const change=(key,value)=>setInputs(previous=>({...previous,[key]:value}));
  const exportRows=()=>{const text=csvFor(rows.map(row=>row.wallet),scenario),url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`terminl-${pool}-${scenario.price}eth-${data.createdAt.slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const units=stats[mode+'Units'],scenarioSales=Math.min(scenario.available,Math.floor(units*scenario.participation/100));
  const currentApplications=wallets.filter(w=>w.application),pending=currentApplications.filter(w=>w.application.status==='pending').length;
  const stale=data&&Object.entries(data.liveCheck||{}).some(([key,value])=>key.endsWith('Changed')&&value);
  const snapshotAge=data?(loadedAt-Date.parse(data.chains.robinhood.endTimeUtc))/3600000:0;

  return <div className={s.shell}><Head><title>Mint intelligence — TERMINL admin</title><meta name='robots' content='noindex,nofollow'/></Head>
    <header className={s.header}><Link href='/admin/campaign' className={s.brand}>TERMINL<span> / ADMIN</span></Link><nav aria-label='Admin navigation'><Link href='/admin/campaign'>Campaign</Link><Link href='/admin/wl'>WL applications</Link><Link href='/admin/collection'>Collection</Link>{data&&<button onClick={lock}>Lock dashboard</button>}</nav></header>
    <main className={s.main}>
      <div className={s.hero}><div><span className={s.eyebrow}>SUPPLY / FUNDING / INTENT</span><h1>Mint intelligence<span>.</span></h1><p>A large allowlist is a starting point. See who can fund a mint, where bridging can help, and what your allocations promise.</p></div>{data&&<button className={s.button} onClick={load} disabled={busy}>{busy?'Loading…':'Reload latest snapshot'}</button>}</div>
      {error&&<p className={s.error} role='alert'>{error}</p>}
      {!data?<form className={s.login} onSubmit={e=>{e.preventDefault();void load();}}><span className={s.eyebrow}>PRIVATE DASHBOARD</span><h2>Open your mint briefing.</h2><label>Campaign admin token<input type='password' autoComplete='off' value={token} onChange={e=>setToken(e.target.value)} required/></label><button className={s.primary} disabled={busy}>{busy?'Verifying…':'Open dashboard'}</button><small>Your token stays in memory. Wallet data loads only after admin verification.</small></form>:<>
        <div className={s.snapshot}><span className={s.liveDot}/><span>Balances: {time(data.chains.robinhood.endTimeUtc)} · {n(wallets.length)} addresses checked on both chains</span><a href='#methods'>Snapshot details</a></div>
        {(stale||snapshotAge>6)&&<p className={s.warning} role='status'>{stale?'Applications or allocations have changed since this scan. The figures below reflect the labeled snapshot; review the current WL before making allocation decisions.':'This balance snapshot is more than six hours old. Funding can change before mint; use a fresh scan before final decisions.'} Reloading retrieves the latest completed scan.</p>}
        <div className={s.metrics}>
          <Metric label='ALLOCATED WALLETS' value={risk.eligible} detail={`${risk.ratio.toFixed(2)}× the available supply · tiers deduplicated`}/>
          <Metric label='GTD WALLETS' value={risk.gtd} tone={risk.excess?'warning':undefined} detail={`${n(risk.gtdCommitment)} possible units at your GTD cap`}/>
          <Metric label='WL APPLICATIONS' value={currentApplications.length} detail={`${n(pending)} pending · ${n(currentApplications.filter(w=>w.eligible).length)} already allocated`}/>
          <Metric label='NEW APPLICANT WALLETS' value={applicationStats.wallets} detail={`${n(applicationStats.ready)} funded on Robinhood at this price`}/>
        </div>

        <section className={s.planner} aria-labelledby='planner-title'><div className={s.sectionHeading}><div><span className={s.eyebrow}>PLANNING INPUTS</span><h2 id='planner-title'>Test the mint terms.</h2></div><span className={s.badge}>Illustrative price · not published mint terms</span></div>
          <p>These controls model capacity. They do not change prices, caps, phases, or allowlist entries.</p>
          <div className={s.inputs}>
            <Input label='Mint price · ETH' name='price' value={inputs.price} onChange={change} type='number' min='0.00000001' step='0.001'/>
            <Input label='Total collection supply' name='supply' value={inputs.supply} onChange={change} type='number' min='1' step='1'/>
            <Input label='Team / other reserve' name='reserved' value={inputs.reserved} onChange={change} type='number' min='0' step='1'/>
            <Input label='GTD total cap / wallet' name='gtdCap' value={inputs.gtdCap} onChange={change} type='number' min='1' step='1'/>
            <Input label='Other total cap / wallet' name='otherCap' value={inputs.otherCap} onChange={change} type='number' min='1' step='1'/>
            <Input label='Robinhood fee reserve · ETH' name='rhReserve' value={inputs.rhReserve} onChange={change} type='number' min='0' step='0.0001'/>
            <Input label='ETH bridge / unwrap reserve' name='bridgeReserve' value={inputs.bridgeReserve} onChange={change} type='number' min='0' step='0.001'/>
          </div><small>Caps apply once per wallet, including wallets on both tiers. Fee reserves are assumptions, not quotes. WETH scenarios require enough native gas; stablecoins remain outside ETH capacity.</small>
        </section>
        {parsed.error?<p className={s.error} role='alert'>{parsed.error}</p>:<>
          <section id='allocation' className={`${s.allocation} ${risk.excess?s.allocationWarning:''}`}><div><span className={s.eyebrow}>PROMISES VS INVENTORY</span><h2>{risk.excess?`${n(risk.excess)} units beyond supply if all GTD wallets claim.`:'Your modeled GTD commitment fits the available supply.'}</h2><p>Unfunded wallets can top up before mint. Measure the GTD promise using every eligible GTD wallet, independently of current balances.</p></div>
            <div className={s.allocationNumbers}><span><b>{n(scenario.available)}</b> available after reserves</span><span><b>{n(risk.gtdCommitment)}</b> GTD units at the selected cap</span><span><b>{n(risk.maximumFcfsAfterGtd)}</b> left after full GTD take-up</span></div>
          </section>

          <section className={s.filters} aria-label='Analysis filters'>
            <label>Analyze this audience<select value={pool} onChange={e=>{setPool(e.target.value);setPage(1);setRoute('all');}}>{POOLS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
            <label>Engagement<select value={activity} onChange={e=>{setActivity(e.target.value);setPage(1);}}><option value='all'>All activity levels</option><option value='active'>Observed activity in 30 days</option><option value='checked'>Recorded website WL check</option></select></label>
            <label>Application review period<select value={reviewGroup} onChange={e=>{setReviewGroup(e.target.value);setPage(1);}}><option value='all'>All review periods</option>{Object.entries(REVIEW_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          </section>
          {!stats.wallets&&<p className={s.warning}>No wallets match these audience and review filters. Choose another audience or reset the review period.</p>}
          <div className={s.fundingMetrics} role='group' aria-label='Funding summary'><Metric label='IN THIS AUDIENCE' value={stats.wallets} detail={`${n(stats.active)} show 30-day nonce activity`}/><Metric label='READY ON ROBINHOOD' value={stats.ready} detail={`${n(stats.readyActive)} active · ${n(stats.readyChecked)} checked WL`}/><Metric label='WITH ETH BRIDGING' value={stats.bridge} detail={`Includes ready wallets · ${n(stats.bridge-stats.ready)} additional`}/><Metric label='WITH WETH CONVERSION' value={stats.converted} detail='Potential only · requires funded gas and extra actions'/></div>

          <div className={s.twoColumns}>
            <section className={s.card}><div className={s.sectionHeading}><div><span className={s.eyebrow}>FUNDING ROUTES</span><h2>Where is the friction?</h2></div></div><FundingDonut analysis={stats} selected={route} onSelect={value=>{setRoute(value);setPage(1);}}/><p className={s.caption}>Mutually exclusive routes to afford at least one NFT. Select a segment to filter the wallet table.</p></section>
            <section className={s.card}><span className={s.eyebrow}>CAPACITY / PRICE</span><h2>How much can price change?</h2><PriceChart points={pricePoints} supply={scenario.available}/><p className={s.caption}>Maximum units if all wallets participate, capped per wallet. This is a capacity ceiling, not expected sales. Applicant pools assume future approval.</p></section>
          </div>

          <section className={s.demand}><div><span className={s.eyebrow}>PARTICIPATION SCENARIO</span><h2>Funding is not a commitment.</h2><p>Apply a hypothetical participation rate to affordable units in this audience. This assumes participation is independent of wallet size and each participating wallet uses its modeled cap.</p></div>
            <div className={s.demandControls}><label>Funding available<select value={mode} onChange={e=>setMode(e.target.value)}><option value='ready'>Robinhood native ETH only</option><option value='bridge'>Including ETH bridging</option><option value='converted'>Including WETH conversion</option></select></label><label>Assumed participation · {inputs.participation}%<input type='range' min='0' max='100' step='1' value={inputs.participation} onChange={e=>change('participation',e.target.value)}/></label></div>
            <div className={s.demandResult}><strong>{n(scenarioSales)}<span> / {n(scenario.available)} units</span></strong><div className={s.progress}><span style={{width:`${Math.min(100,scenarioSales/scenario.available*100)}%`}}/></div><p>{units?`${(scenario.available/units*100).toFixed(1)}% participation in modeled capacity needed to fill supply.`:'No affordable units in this audience at these terms.'} {units<scenario.available&&'Even 100% participation falls short under these assumptions.'}</p></div>
          </section>

          <div className={s.twoColumns}>
            <section className={s.card}><span className={s.eyebrow}>ALLOCATION COHORTS</span><h2>Which group needs help?</h2><CohortBars groups={cohorts}/><p className={s.caption}>All {n(wallets.length)} addresses, partitioned once. Applicants already allocated appear in their existing tier group. Colors match funding routes above.</p></section>
            <section className={s.card}><span className={s.eyebrow}>FUNDS ACROSS CHAINS</span><h2>Already here, or still on Ethereum?</h2><BalanceHeatmap matrix={matrix}/><p className={s.caption}>Wallet counts in this audience. Balances are native ETH; WETH and stablecoins are listed separately.</p></section>
          </div>

          <section id='applications' className={s.applicationSection}><div className={s.sectionHeading}><div><span className={s.eyebrow}>PENDING APPLICATIONS</span><h2>New demand, without counting it twice.</h2></div><button className={s.button} onClick={()=>{setPool('pending-new');setActivity('all');setReviewGroup('all');setRoute('all');setPage(1);document.getElementById('wallets')?.scrollIntoView({behavior:'smooth'});}}>Inspect new applicant wallets ↓</button></div>
            <div className={s.applicationGrid}><div><div className={s.miniMetrics}><Metric label='NOT CURRENTLY ALLOCATED' value={applicationStats.wallets}/><Metric label='READY ON ROBINHOOD' value={applicationStats.ready}/><Metric label='INCLUDING ETH BRIDGING' value={applicationStats.bridge}/></div><p>{n(applicationStats.active)} show recent nonce activity. These are potential additions, not approved mint allocations. Review funding together with submission context and opt-in intent.</p><div className={s.reviewBadges}>{Object.entries(REVIEW_LABELS).map(([key,label])=><span key={key}><b>{n(currentApplications.filter(w=>w.application.reviewGroup===key).length)}</b>{label}</span>)}</div><p className={s.caption}>Timing and blank notes are review hints only. They do not prove that a wallet is a bot.</p></div><div><h3>Application arrivals</h3><ApplicationTimeline wallets={wallets}/></div></div>
          </section>

          <section className={s.strategy}><span className={s.eyebrow}>A PRACTICAL MINT PLAN</span><h2>Work the gaps in this order.</h2><div className={s.strategyGrid}>
            <article><span>01 / ALLOCATION</span><h3>{risk.excess?'Resolve GTD overcommitment.':'Keep GTD headroom visible.'}</h3><p>{risk.excess?`The modeled GTD commitment exceeds available supply by ${n(risk.excess)} units. Reconcile mistakes and confirm the published entitlements before launch. Low balances are not grounds to silently revoke a promise.`:`Leave the modeled ${n(risk.maximumFcfsAfterGtd)} remaining units available for later phases, subject to the actual mint terms.`}</p></article>
            <article><span>02 / PREPARE</span><h3>Turn bridge capacity into readiness.</h3><p>{n(allocatedStats.bridge-allocatedStats.ready)} allocated wallets could afford at least one mint after moving native ETH from Ethereum. Give opted-in holders clear bridge instructions before mint, then recheck their Robinhood balances.</p><a href='https://docs.robinhood.com/chain/bridging/' target='_blank' rel='noreferrer'>Official Robinhood bridging guide ↗</a></article>
            <article><span>03 / QUALIFY</span><h3>Confirm interest before adding more.</h3><p>{n(applicationStats.ready)} unallocated pending applicants are funded on Robinhood at this price; {n(applicationStats.bridge)} could be funded after bridging. Review these wallets and collect explicit intent. An application, account balance, or WL check is not a purchase commitment.</p><Link href='/admin/wl'>Review applications →</Link></article>
            <article><span>04 / RELEASE</span><h3>Use actual claims to open later phases.</h3><p>If the published terms permit it, announce a clear GTD claim window, begin with a conservative per-wallet cap, then make only remaining inventory available to FCFS. Raise caps after observing real demand; plan from claims, not total wallet wealth.</p></article>
          </div></section>

          <section id='wallets' className={s.walletSection}><div className={s.sectionHeading}><div><span className={s.eyebrow}>WALLET EXPLORER</span><h2>The evidence behind the charts.</h2></div><button className={s.button} onClick={exportRows} disabled={!rows.length}>Export {n(rows.length)} filtered wallets</button></div>
            <div className={s.walletControls}><label>Find wallet or source<input value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder='0x… or community name'/></label><label>Funding route<select value={route} onChange={e=>{setRoute(e.target.value);setPage(1);}}><option value='all'>All routes</option>{ROUTES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Sort<select value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value='priority'>Funding, then recent activity</option><option value='rh'>Robinhood ETH balance</option><option value='eth'>Ethereum ETH balance</option></select></label></div>
            <div className={s.tableWrap}><table><thead><tr><th>Wallet / source</th><th>Eligibility / application</th><th>Robinhood ETH</th><th>Ethereum ETH</th><th>30-day activity</th><th>Funding / details</th></tr></thead><tbody>{visible.map(({wallet:w,funding:f})=><tr key={w.address}>
              <td><code title={w.address}>{w.address.slice(0,8)}…{w.address.slice(-6)}</code><div className={s.explorerLinks}><a href={`https://robinhoodchain.blockscout.com/address/${w.address}`} target='_blank' rel='noreferrer'>RH ↗</a><a href={`https://etherscan.io/address/${w.address}`} target='_blank' rel='noreferrer'>ETH ↗</a></div><small>{w.sources.join(' · ')||'Source not recovered'}</small></td>
              <td><div className={s.tierTags}>{w.gtd&&<span>GTD</span>}{w.fcfs&&<span>FCFS</span>}{!w.eligible&&<span className={s.mutedTag}>Not allocated</span>}</div>{w.application&&<small>{w.application.status} application · {REVIEW_LABELS[w.application.reviewGroup]}</small>}</td>
              <td className={s.numeric}>{balance(w.robinhood.native)}</td><td className={s.numeric}>{balance(w.ethereum.native)}</td>
              <td>{w.active?<span className={s.positive}>Observed</span>:w.ethereum.nonce30===null||w.robinhood.nonce30===null?'Partly unknown':'No nonce increase'}<small>ETH {w.ethereum.nonce30??'unknown'} · RH {w.robinhood.nonce30??'unknown'}</small>{w.checked&&<small>Recorded WL check</small>}</td>
              <td><span className={s.routeTag}>{ROUTES.find(([key])=>key===f.route)?.[1]}</span><details><summary>Balances & context</summary><dl><dt>Full wallet</dt><dd><code>{w.address}</code></dd><dt>RH shortfall for one mint + reserve</dt><dd>{balance(f.shortfall)} ETH</dd><dt>Robinhood WETH / USDG</dt><dd>{balance(w.robinhood.weth)} / {n(Number(w.robinhood.usdg)/1e6)}</dd><dt>Ethereum WETH / USDC / USDT</dt><dd>{balance(w.ethereum.weth)} / {n(Number(w.ethereum.usdc)/1e6)} / {n(Number(w.ethereum.usdt)/1e6)}</dd><dt>Units: native / bridge / converted</dt><dd>{f.ready} / {f.bridge} / {f.converted}</dd><dt>Lifetime nonce · ETH / RH</dt><dd>{w.ethereum.nonce??'unknown'} / {w.robinhood.nonce??'unknown'}</dd><dt>Account types · ETH / RH</dt><dd>{w.ethereum.type} / {w.robinhood.type}</dd></dl>{w.application&&<Link href={`/admin/wl?address=${w.address}`}>Open application review →</Link>}</details></td>
            </tr>)}</tbody></table></div>
            {!rows.length&&<p className={s.caption}>No matching wallets. Adjust the audience, funding route, or search.</p>}
            <div className={s.pagination}><span>{n(rows.length)} matching wallets · page {currentPage} of {pages}</span><div><button className={s.button} disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Previous</button><button className={s.button} disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>Next</button></div></div>
          </section>
        </>}
        <details id='methods' className={s.methods}><summary>Data coverage, snapshots, and assumptions</summary><div>
          <p>Allowlist / application snapshot: {time(data.allowlistAt)}. Ethereum finalized block {n(data.chains.ethereum.endBlock)} ({time(data.chains.ethereum.endTimeUtc)}); Robinhood finalized block {n(data.chains.robinhood.endBlock)} ({time(data.chains.robinhood.endTimeUtc)}). Both chains use a 30-day lookback. Reload retrieves the latest completed snapshot, not a new blockchain scan.</p>
          <p>Native ETH and canonical WETH are measured on both chains, plus Ethereum USDC/USDT and Robinhood USDG. Other assets, exchange accounts, DeFi positions, and NFT liquidation are outside this model. Stablecoins are token amounts, not converted purchasing power.</p>
          <p>Activity is the change in account nonce. Failed transactions and EIP-7702 authorizations can count; incoming transfers and smart-account operations can be missed. Contract activity is unknown. Contract funds are excluded from the relevant funding route. Zero nonce change does not prove inactivity.</p>
          <p>Bridge capacity deducts the Ethereum reserve and Robinhood reserve. WETH requires conversion, native gas and potentially bridging; assumed reserves must cover those actions. Actual fees, execution, approvals and mint compatibility are unverified. Every address is counted once per scenario, with the GTD cap taking precedence over the other cap for wallets on both tiers.</p>
          <p>GTD and FCFS totals overlap; the allocation-cohort chart is mutually exclusive. Pending applications do not add eligibility. A wallet may belong to the same person as another, or be controlled by a service. Recorded WL checks are completed manual checks matched during the available tracking period, not verified ownership or purchase intent.</p>
          <p>The scenario price and caps are illustrative; confirm published mint terms separately. Participation is an assumption, not a forecast. Capacity can change between snapshot and mint.</p>
          <p><a href='https://docs.robinhood.com/chain/contracts/' target='_blank' rel='noreferrer'>Canonical Robinhood tokens ↗</a> · <a href='https://eips.ethereum.org/EIPS/eip-7702' target='_blank' rel='noreferrer'>Nonce / authorization behavior ↗</a></p>
        </div></details>
      </>}
    </main><footer className={s.footer}>TERMINL / PRIVATE MINT INTELLIGENCE<span>Funding capacity ≠ confirmed demand.</span></footer>
  </div>;
}
