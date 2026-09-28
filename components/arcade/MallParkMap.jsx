import {useEffect,useMemo,useRef,useState} from 'react';
import {MALL_CHALLENGES} from '../../lib/arcade/after-hours/mall-world.mjs';
import {parkRoute,routeCue,challengeProgress} from '../../lib/arcade/after-hours/mall-navigation.mjs';
import {practiceStart} from '../../lib/arcade/after-hours/mall-spots.mjs';
import MallCareer from './MallCareer';
import s from '../../styles/MallParkMap.module.css';

export function useParkGuide(view,destination){
 const [path,setPath]=useState([]),player=useRef(null);player.current=view?.player;
 const world=view?.world,bucket=Math.floor((view?.tick||0)/60);
 useEffect(()=>{setPath(world&&destination?parkRoute(world,player.current,destination):[]);},[world,destination]);
 useEffect(()=>{
  if(!world||!destination)return;
  const zone=world.zones.find(z=>z.id===destination);
  setPath(previous=>routeCue(player.current,previous,zone)?.offPath>12?parkRoute(world,player.current,destination):previous);
 },[world,destination,bucket]);
 const zone=world?.zones.find(z=>z.id===destination),cue=zone&&routeCue(view.player,path,zone);
 return {path,zone,cue};
}
export function ParkOverview({view,path=[],selected,onChoose,mini=false}){
 const {world,player}=view,b=world.bounds;
 return <svg viewBox={`${-b} ${-b} ${b*2} ${b*2}`} className={s.overview} role={mini?'img':undefined} aria-label={mini?'Your position in the skate park':undefined}>
  <rect x={-b} y={-b} width={b*2} height={b*2} fill='#071b1c'/>
  {world.zones.map(z=><g key={z.id} role={onChoose?'button':undefined} tabIndex={onChoose?0:undefined} aria-label={onChoose?`Guide me to ${z.name}`:undefined} onClick={onChoose?()=>onChoose(z.id):undefined} onKeyDown={onChoose?e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onChoose(z.id);}}:undefined} className={s.district}>
   <rect x={z.x-z.w/2+2} y={z.z-z.d/2+2} width={z.w-4} height={z.d-4} rx='3' fill={z.id===selected?'#476346':view.visited.includes(z.id)?'#244743':'#15302f'} stroke={z.id===selected?'#d1efa5':'#54776a'} strokeWidth={z.id===selected?2:1}/>
  </g>)}
  <g pointerEvents='none'>
   {world.floors.filter(f=>f.rise).map((r,i)=><rect key={`ramp-${i}`} x={r.x-r.w/2} y={r.z-r.d/2} width={r.w} height={r.d} fill='#bc9c61' opacity='.45'/>)}
   {world.solids.map((wall,i)=><rect key={i} x={wall.x-wall.w/2} y={wall.z-wall.d/2} width={wall.w} height={wall.d} fill='#9baf95'/>)}
   {world.rails.filter(r=>!r.id.startsWith('cart')).map(r=><line key={r.id} x1={r.x} y1={r.z} x2={r.bx} y2={r.bz} stroke='#7cbfbb' strokeWidth={mini?1.8:1}/>)}
   <circle cx='-140' cy='0' r='30' fill='none' stroke='#83b8ab' strokeWidth='1'/>
   {path.length>0&&<polyline points={path.map(p=>`${p.x},${p.z}`).join(' ')} fill='none' stroke='#dfeda7' strokeWidth={mini?4:2.5} strokeDasharray={mini?undefined:'5 3'}/>}
   {!mini&&world.zones.map(z=><text key={z.id} className={s.districtLabel} x={z.x} y={z.z+4} textAnchor='middle'>{z.id.toUpperCase()}</text>)}
   <g transform={`translate(${player.x} ${player.z}) rotate(${player.yaw*180/Math.PI})`}><circle r={mini?10:6} fill='#091d19' stroke='#e3f5bf'/><path d={mini?'M 0 -14 L 8 8 L 0 4 L -8 8 Z':'M 0 -8 L 5 5 L 0 2 L -5 5 Z'} fill='#e0ffa4'/></g>
  </g>
 </svg>;
}
export function ParkGuideCue({guide,onOpen}){
 if(!guide.zone)return null;
 const {cue,zone}=guide;
 return <button className={s.cue} onPointerDown={e=>{if(e.pointerType==='touch'){e.preventDefault();onOpen();}}} onClick={onOpen} aria-label={`Park guide: ${zone.name}. Open map to change destination.`}>
  <span aria-hidden='true' style={{transform:`rotate(${cue?.angle||0}rad)`}}>{cue?.arrived?'✓':'↑'}</span>
  <b>{zone.name}</b><small>{cue?.arrived?'YOU’RE HERE':cue?.unreachable?'OPEN MAP':`${cue?.distance||0}m`}</small>
 </button>;
}
export default function MallParkMap({view,progress,notice,destination,onChoose,onSession,onClear,onClose}){
 const dialog=useRef(null),[selected,setSelected]=useState(destination||(view.practiceSpot!=='atrium'?view.practiceSpot:null)||'rails');
 const {world,player:{x,y,z}}=view;
 const spot=practiceStart(world,selected);
 const route=useMemo(()=>parkRoute(world,{x,y,z},selected),[world,x,y,z,selected]);
 useEffect(()=>{const element=dialog.current;element.showModal();return()=>element.close();},[]);
 const close=()=>{dialog.current.close();onClose();};
 const choose=id=>{dialog.current.close();onChoose(id);};
 return <dialog ref={dialog} className={s.dialog} aria-labelledby='park-map-title' onKeyDown={e=>e.stopPropagation()} onCancel={e=>{e.preventDefault();close();}}>
  <header className={s.topBar}><div><small>THE MALL IS CLOSED. EVERYWHERE IS OPEN.</small><h2 id='park-map-title'>FIND YOUR NEXT LINE.</h2></div><button onClick={close} aria-label='Close park map and resume'>✕</button></header>
  <div className={s.body}><section className={s.overviewPanel}><ParkOverview view={view} path={route} selected={selected} onChoose={choose}/>
   <div className={s.legend}><span>▲ YOU</span><span>— RAILS</span><span>▧ RAMPS</span><span>┄ SUGGESTED ROUTE</span></div>
   <p>Choose a district for directions. Follow the arrow while you skate; roof and basement routes use the access ramps.</p>
   <div className={s.pick}><label>DESTINATION<select aria-label='Choose a park district' value={selected} onChange={e=>setSelected(e.target.value)}>{view.world.zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></label><button disabled={!route.length} onClick={()=>choose(selected)}>GUIDE ME →</button></div>
   {view.practice&&<div className={s.session}><b>SESSION {spot.name}</b><p>{spot.hint}</p><button onClick={()=>{dialog.current.close();onSession(selected);}}>START FREE SKATE HERE →</button><small>Fresh run at this spot. Earned goals stay; the current combo ends. Retry returns here.</small></div>}
   {destination&&<button className={s.clear} onClick={onClear}>CLEAR MY DESTINATION</button>}
  </section><section className={s.goals} aria-label='This run’s goals'><small>THIS RUN / {Object.keys(view.challengeTimes).length} OF 3 COMPLETE</small><h3>MAKE SECURITY EARN IT.</h3><p>Each goal pays 2,500 points. You keep skating while the paperwork piles up.</p>
   {view.challengeIds.map(id=>{const goal=MALL_CHALLENGES.find(c=>c.id===id),done=!!view.challengeTimes[id];return <article key={id} className={done?s.done:undefined}><h4>{done?'✓ ':''}{goal.name}</h4><p>{goal.hint}</p><strong>{challengeProgress(view,id)}</strong></article>;})}
   <MallCareer progress={progress} view={view} onGuide={choose} notice={notice}/><p className={s.note}>The clock is paused here. Your current combo stays intact.</p><button className={s.resume} onClick={close}>BACK TO SKATING →</button>
  </section></div>
 </dialog>;
}
