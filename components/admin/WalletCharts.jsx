import {useId} from 'react';
import s from '../../styles/WalletIntelligence.module.css';

const number=n=>n.toLocaleString('en-US');
export const ROUTES=[['ready','Ready on Robinhood','#8bffc0'],['bridge','Needs ETH bridging','#79b5ff'],['convert','Needs WETH conversion','#c3a4ff'],['underfunded','Below modeled price','#687786'],['contract','Contract · review needed','#ffb879']];

export function FundingDonut({analysis,selected,onSelect}){
  const title=useId();let offset=0;
  const slices=ROUTES.map(([key,label,color])=>{const count=analysis.routes[key],from=offset;offset+=analysis.wallets?count/analysis.wallets*100:0;return {key,label,color,count,from,to:offset};});
  return <div className={s.donutLayout}>
    <div className={s.donut} role='img' aria-labelledby={title} style={{background:analysis.wallets?`conic-gradient(${slices.filter(x=>x.count).map(x=>`${x.color} ${x.from}% ${x.to}%`).join(',')})`:'#273443'}}>
      <div><strong>{number(analysis.ready)}</strong><span id={title}>of {number(analysis.wallets)} ready</span></div>
    </div>
    <div className={s.legend}>{slices.map(x=><button key={x.key} type='button' className={selected===x.key?s.legendSelected:''} aria-pressed={selected===x.key} onClick={()=>onSelect(selected===x.key?'all':x.key)}>
      <i style={{background:x.color}}/><span>{x.label}</span><b>{number(x.count)}</b>
    </button>)}</div>
  </div>;
}

export function PriceChart({points,supply}){
  const title=useId(),width=720,height=280,pad={left:62,right:18,top:20,bottom:48};
  const top=Math.max(supply,...points.flatMap(p=>[p.readyUnits,p.bridgeUnits,p.convertedUnits]),1)*1.08;
  const x=i=>pad.left+i/(points.length-1)*(width-pad.left-pad.right),y=v=>height-pad.bottom-v/top*(height-pad.top-pad.bottom);
  const series=[['readyUnits','Native on Robinhood','#8bffc0'],['bridgeUnits','Including ETH bridging','#79b5ff'],['convertedUnits','Including WETH conversion','#c3a4ff']];
  return <>
    <svg className={s.chart} viewBox={`0 0 ${width} ${height}`} role='img' aria-labelledby={title}>
      <title id={title}>Maximum affordable units by mint price, with wallet caps and fee reserves. Available supply is {number(supply)}.</title>
      {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={pad.left} x2={width-pad.right} y1={y(top*t)} y2={y(top*t)} stroke='#293743'/><text x={pad.left-10} y={y(top*t)+4} textAnchor='end'>{number(Math.round(top*t))}</text></g>)}
      <line x1={pad.left} x2={width-pad.right} y1={y(supply)} y2={y(supply)} stroke='#ffcc80' strokeDasharray='5 5'/>
      <text x={width-pad.right} y={y(supply)-7} textAnchor='end' fill='#ffcc80'>Supply {number(supply)}</text>
      {series.map(([key,label,color])=><g key={key}><polyline fill='none' stroke={color} strokeWidth='2.5' points={points.map((p,i)=>`${x(i)},${y(p[key])}`).join(' ')}/>{points.map((p,i)=><circle key={p.price} cx={x(i)} cy={y(p[key])} r='4' fill={color}><title>{p.price} ETH · {label}: {number(p[key])} units</title></circle>)}</g>)}
      {points.map((p,i)=><text key={p.price} x={x(i)} y={height-22} textAnchor='middle'>{p.price}</text>)}
      <text x={width/2} y={height-2} textAnchor='middle'>Mint price in ETH · categorical price steps</text>
    </svg>
    <div className={s.inlineLegend}>{series.map(([key,label,color])=><span key={key}><i style={{background:color}}/>{label}</span>)}</div>
    <details className={s.chartDetails}><summary>View chart values</summary><div className={s.tableWrap}><table><thead><tr><th>Price ETH</th>{series.map(([key,label])=><th key={key}>{label}</th>)}</tr></thead><tbody>{points.map(p=><tr key={p.price}><td>{p.price}</td>{series.map(([key])=><td key={key}>{number(p[key])}</td>)}</tr>)}</tbody></table></div></details>
  </>;
}

export function CohortBars({groups}){
  const max=Math.max(...groups.map(g=>g.stats.wallets),1);
  return <div className={s.cohortBars}>{groups.map(g=><div key={g.label} className={s.cohortRow}>
    <div><span>{g.label}</span><b>{number(g.stats.wallets)}</b></div>
    <div className={s.barTrack} role='img' aria-label={`${g.label}: ${ROUTES.map(([key,label])=>`${g.stats.routes[key]} ${label}`).join(', ')}`}>
      {ROUTES.map(([key,label,color])=><span key={key} style={{width:`${g.stats.routes[key]/max*100}%`,background:color}} title={`${label}: ${number(g.stats.routes[key])}`}/>)}
    </div><small>{number(g.stats.ready)} ready · {number(g.stats.active)} recently active</small>
  </div>)}</div>;
}

export function BalanceHeatmap({matrix}){
  const title=useId(),max=Math.max(...matrix.cells.flat(),1),cell=54,left=96,top=16;
  return <>
    <svg className={s.heatmap} viewBox='0 0 380 360' role='img' aria-labelledby={title}>
      <title id={title}>Wallet counts by native ETH balance on Ethereum and Robinhood. Darker cells have fewer wallets.</title>
      {matrix.cells.map((row,ei)=>row.map((count,ri)=><g key={`${ei}-${ri}`}>
        <rect x={left+ri*cell} y={top+(4-ei)*cell} width={cell-4} height={cell-4} rx='5' fill={`rgba(139,255,192,${count ? .16+.84*Math.sqrt(count/max) : .04})`}><title>Ethereum {matrix.labels[ei]} ETH; Robinhood {matrix.labels[ri]} ETH: {number(count)} wallets</title></rect>
        <text x={left+ri*cell+(cell-4)/2} y={top+(4-ei)*cell+29} textAnchor='middle' fill={count>max*.1?'#081b14':'#c6d4df'}>{number(count)}</text>
      </g>))}
      {matrix.labels.map((label,i)=><g key={label}><text x={left+i*cell+24} y={top+5*cell+15} textAnchor='middle'>{label}</text><text x={left-8} y={top+(4-i)*cell+29} textAnchor='end'>{label}</text></g>)}
      <text x='225' y='330' textAnchor='middle'>Robinhood native ETH</text><text transform='translate(16 150) rotate(-90)' textAnchor='middle'>Ethereum native ETH</text>
    </svg>
  </>;
}

export function ApplicationTimeline({wallets}){
  const groups=new Map();
  for(const w of wallets){if(!w.application)continue;const day=new Date(w.application.createdAt).toISOString().slice(0,10);groups.set(day,(groups.get(day)||0)+1);}
  const rows=[...groups].sort(([a],[b])=>a.localeCompare(b)),max=Math.max(...rows.map(([,count])=>count),1);
  return <div className={s.timeline}>{rows.map(([day,count])=><div key={day}><span>{day.slice(5)}</span><div className={s.barTrack}><span style={{width:`${count/max*100}%`,background:day==='2026-10-19'?'#ffcc80':'#79b5ff'}}/></div><b>{number(count)}</b></div>)}<small>Received date in UTC. A traffic spike is a review signal, not proof of bots.</small></div>;
}
