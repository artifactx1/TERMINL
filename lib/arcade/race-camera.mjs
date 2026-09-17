/** One world projection for the road, both cars and the timing line. */
import {GATE_MARGIN} from './race-sim.mjs';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const CAR_WIDTH=43;
export function raceCameraLayout(width,height,roadWidth=150){
  const focal=Math.min(width*.92,height*1.04);
  return {focal,horizon:height*.4,feet:height*.87,back:Math.max(90,focal*(roadWidth+50)/width)};
}
export function raceCameraTarget(state,{width,height,slot=0,heading=state.players[slot].angle,roadWidth=150}){
  const layout=raceCameraLayout(width,height,roadWidth),p=state.players[slot],cos=Math.cos(heading),sin=Math.sin(heading);
  let back=layout.back;
  for(const car of state.players){
    if(car===p)continue;
    const dx=car.x-p.x,dy=car.y-p.y,forward=dx*cos+dy*sin,lateral=-dx*sin+dy*cos;
    // Widen for a close pass in either lane, including a rival entering from behind.
    // This changes the camera, never the rival's world position or race progress.
    const weight=clamp((300-Math.hypot(dx,dy))/100,0,1);
    const required=layout.focal*(Math.abs(lateral)+CAR_WIDTH/2)/(width*.43)-forward;
    back=Math.max(back,layout.back+(required-layout.back)*weight);
  }
  return back;
}
export function raceProjection(state,{width,height,slot=0,heading=state.players[slot].angle,roadWidth=150,back}={}){
  const layout=raceCameraLayout(width,height,roadWidth),p=state.players[slot];
  back=back??raceCameraTarget(state,{width,height,slot,heading,roadWidth});
  const cos=Math.cos(heading),sin=Math.sin(heading),camX=p.x-cos*back,camY=p.y-sin*back;
  const camHeight=(layout.feet-layout.horizon)*back/layout.focal;
  const view=(x,y,h=0)=>{const dx=x-camX,dy=y-camY;return {x:-dx*sin+dy*cos,z:dx*cos+dy*sin,h};};
  const project=v=>({x:width/2+v.x*layout.focal/v.z,y:layout.horizon+(camHeight-v.h)*layout.focal/v.z,z:v.z});
  const carFrame=car=>{const v=view(car.x,car.y);return {...project(v),width:CAR_WIDTH*layout.focal/v.z};};
  return {...layout,back,camHeight,view,project,carFrame};
}
export function finishLineTiles(g){
  // The stripe covers exactly the lateral span that credits a crossing.
  const gate=g.gates[0],half=g.width/2+GATE_MARGIN,columns=Math.ceil(half*2/12),step=half*2/columns;
  const at=(forward,lateral)=>({x:gate.x+Math.cos(gate.angle)*forward-Math.sin(gate.angle)*lateral,y:gate.y+Math.sin(gate.angle)*forward+Math.cos(gate.angle)*lateral});
  return Array.from({length:columns*2},(_,i)=>{
    const row=Math.floor(i/columns),col=i%columns,a=-8+row*8,b=-half+col*step;
    return {color:(row+col)%2?'#fff4d6':'#18232d',points:[at(a,b),at(a+8,b),at(a+8,b+step),at(a,b+step)]};
  });
}
