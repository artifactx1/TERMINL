import {trackGeometry,angleDelta} from './race-sim.mjs';

// Cosmetic course distance, never a position/checkpoint/finish authority.
// Project only onto the last validated sector so cutting across the infield
// cannot make the tracker jump half a lap ahead.
export function raceProgress(state,slot){
  const g=trackGeometry(state.track),p=state.players[slot];
  if(p.finishedTick!==null)return g.length*g.laps;
  if(!p.passed){const gate=g.gates[0];return Math.min(0,(p.x-gate.x)*Math.cos(gate.angle)+(p.y-gate.y)*Math.sin(gate.angle));}
  const sector=(p.nextCheckpoint+g.gates.length-1)%g.gates.length;
  const start=g.gates[sector].s,end=sector+1===g.gates.length?g.length:g.gates[sector+1].s;
  const points=g.points.slice(sector*16,sector*16+17);
  if(points.length===16)points.push({...g.points[0],s:g.length});
  let road={distance:Infinity,s:start};
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(length*length)));
    const distance=Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
    if(distance<road.distance)road={distance,s:a.s+length*t};
  }
  return Math.floor((p.passed-1)/g.gates.length)*g.length+Math.max(start,Math.min(end,road.s));
}

export function rivalTelemetry(state,slot=0){
  const me=state.players[slot],rival=state.players[1-slot];
  const gap=raceProgress(state,1-slot)-raceProgress(state,slot);
  const bearing=angleDelta(Math.atan2(rival.y-me.y,rival.x-me.x),me.angle);
  const direction=Math.abs(bearing)>Math.PI*.75?'BEHIND CAR':Math.abs(bearing)<Math.PI*.25?'IN FRONT':bearing<0?'LEFT OF CAR':'RIGHT OF CAR';
  // Match the existing arcade speed display: 1 sim-unit/tick = 42 km/h.
  const meters=Math.round(Math.abs(gap)*42/216);
  const label=rival.finishedTick!==null?'RIVAL FINISHED':me.finishedTick!==null?'YOU FINISHED':meters<2?'NECK AND NECK':`RIVAL ${meters}m ${gap>0?'AHEAD':'BEHIND'}`;
  return {gap,meters,bearing,direction,label};
}
