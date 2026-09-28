import assert from 'node:assert/strict';
import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {parkRoute,routeCue} from '../lib/arcade/after-hours/mall-navigation.mjs';
import {angleDelta} from '../lib/arcade/after-hours/math.mjs';

// Only steering, pushing and braking: no position or world-state shortcuts.
export function followParkRoute(id){
 const state=createMall({practice:true,seed:123}),zone=state.world.zones.find(z=>z.id===id),path=parkRoute(state.world,state.player,id),inputs=[];
 let arrived=false;
 for(const point of path){
  let frames=0;
  while(Math.hypot(state.player.x-point.x,state.player.z-point.z)>3&&frames++<1200){
   const p=state.player,angle=angleDelta(Math.atan2(point.x-p.x,-(point.z-p.z)),p.yaw);
   const brake=p.speed>16||(Math.abs(angle)>1.1&&p.speed>8),input={forward:!brake,back:brake,left:angle<-.035,right:angle>.035};
   stepMall(state,input);inputs.push(input);arrived||=!!routeCue(p,path,zone)?.arrived;
  }
  assert.ok(frames<1200,`stalled en route to ${id}`);
 }
 return {state,path,inputs,arrived};
}
