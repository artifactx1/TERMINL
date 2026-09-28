import {CAREER_ZONES,GAP_GUIDES,ROUTE_GUIDES,careerGoals,mergeCareer} from '../../lib/arcade/after-hours/mall-career.mjs';
import s from '../../styles/MallCareer.module.css';

const number=value=>(Math.floor(value*10)/10).toLocaleString('en-US');
const district=id=>CAREER_ZONES.find(zone=>zone.id===id)?.name;

export default function MallCareer({progress,view,onGuide,notice}){
 const mall=progress?.mall||{},goals=careerGoals(mall,view),career=mergeCareer(mall.career,view);
 const gaps=new Set([...(mall.gaps||[]),...(view?.gaps||[])]),next=goals.find(goal=>!goal.earned);
 return <details className={s.book}>
  <summary>SKATEBOOK <span>{goals.filter(goal=>goal.earned).length} / 8 EARNED</span></summary>
  <div className={s.content}>
   <p className={s.intro}>{next?`NEXT UP: ${next.name}. ${next.goal}`:'Every goal earned. Security still wants you gone.'}</p>
   <p className={s.note}>{notice||'Progress saves on this device in timed runs and free skate. Bank your combo. Land your jump.'}</p>
   <ol className={s.goals}>{goals.map(goal=><li key={goal.id} data-career-goal={goal.id} className={goal.earned?s.earned:undefined}>
    <div className={s.title}><h4>{goal.name}</h4><span>{goal.earned?'✓ EARNED':`${number(goal.value)} / ${number(goal.target)} ${goal.unit}`}</span></div>
    <progress aria-label={goal.name} value={goal.value} max={goal.target}/>
    <p>{goal.goal}</p>{!goal.earned&&<><p className={s.hint}>{goal.hint}</p><button onClick={()=>onGuide(goal.destination)}>PRACTISE IN {district(goal.destination)} →</button></>}
   </li>)}</ol>
   <details className={s.collection}><summary>GAP HUNT <span>{GAP_GUIDES.filter(g=>gaps.has(g.id)).length} / 5</span></summary><ul>{GAP_GUIDES.map(g=><li key={g.id}><h4>{gaps.has(g.id)?'✓ ':''}{g.name}</h4><p>{g.hint}</p><button onClick={()=>onGuide(g.destination)}>GUIDE TO {district(g.destination)} →</button></li>)}</ul></details>
   <details className={s.collection}><summary>DISTRICTS <span>{career.districts.length} / 17 VISITED</span></summary><p>Pick a district for directions. Visits count across sessions.</p><ul className={s.districts}>{CAREER_ZONES.map(z=><li key={z.id}><button onClick={()=>onGuide(z.id)}>{career.districts.includes(z.id)?'✓':'○'} {z.name} →</button></li>)}</ul></details>
   <details className={s.collection}><summary>ROUTE RECORDS</summary><ul>{ROUTE_GUIDES.map(r=>{
    const seconds=Math.min(mall.routes?.[r.id]??Infinity,...(view?.routesCompleted||[]).filter(done=>done.id===r.id).map(done=>done.seconds));
    return <li key={r.id}><h4>{r.name}</h4><b>{Number.isFinite(seconds)?`BEST ${seconds.toFixed(2)}s`:'NO FINISH YET'}</b><p>{r.hint}</p><button onClick={()=>onGuide(r.destination)}>GUIDE TO {district(r.destination)} →</button></li>;
   })}</ul></details>
   <details className={s.collection}><summary>DECK UNLOCKS</summary><ul><li>{(mall.tapes?.length||0)>=3?'✓':'○'} VHS VIOLET · Find 3 VHS tapes</li><li>{(mall.tapes?.length||0)>=6?'✓':'○'} AFTERGLOW MINT · Find 6 VHS tapes</li><li>{progress?.rug?.completed?'✓':'○'} CORRUPTED · Finish RUG.EXE</li></ul><p>Choose unlocked decks from the Board menu before your next run.</p></details>
  </div>
 </details>;
}
