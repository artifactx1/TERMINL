/** Shared ranking and HUD distance along the last validated checkpoint sector.
 * Lateral/off-road distance never directly penalizes placement. A skipped gate
 * cannot move a car into a later sector, even near another piece of the circuit.
 */
export function courseProgress(g,p){
  if(p.finishedTick!==null)return g.length*g.laps;
  if(!p.passed){const gate=g.gates[0];return Math.min(0,(p.x-gate.x)*Math.cos(gate.angle)+(p.y-gate.y)*Math.sin(gate.angle));}
  const sector=(p.nextCheckpoint+g.gates.length-1)%g.gates.length;
  const start=g.gates[sector].s,end=sector+1===g.gates.length?g.length:g.gates[sector+1].s;
  const points=g.points.slice(sector*16,sector*16+17);
  if(points.length===16)points.push({...g.points[0],s:g.length});
  let road={distance:Infinity,s:start};
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    if(!length)continue;
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(length*length)));
    const distance=Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
    if(distance<road.distance)road={distance,s:a.s+length*t};
  }
  return Math.floor((p.passed-1)/g.gates.length)*g.length+Math.max(start,Math.min(end,road.s));
}
