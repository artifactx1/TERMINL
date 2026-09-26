import {clamp,floorAt,inside} from './math.mjs';

/** Chase framing stays in the travel frame, including the full height of a jump. */
export function mallCameraFrame(s,previous,aspect=1){
 const p=s.player,dt=clamp((s.tick-(previous?.tick??s.tick-1))/60,0,.1);
 const speed=clamp(p.speed/21,0,1),distance=8.5+speed*1.6;
 const dx=-Math.sin(p.yaw)*distance,dz=Math.cos(p.yaw)*distance;
 const bankHeight=floorAt(s.world,p.x+dx,p.z+dz)+3.4;
 const height=Math.max(p.y+4.6,bankHeight);
 let y=previous?previous.y+(height-previous.y)*(1-Math.exp(-10*dt)):height;
 // A fast transfer must not leave the lens below the rider or high above a landing.
 y=clamp(y,p.y+3.8,Math.max(p.y+6.5,bankHeight));
 let reach=1;
 for(let i=1;i<=32;i++){
  const t=i/32,x=p.x+dx*t,z=p.z+dz*t,eye=p.y+1.8+(y-p.y-1.8)*t;
  const wall=s.world.solids.some(b=>!b.broken&&eye<(b.y||0)+b.h&&eye>(b.y||0)&&inside({x,z},b,.35));
  if(wall||eye<floorAt(s.world,x,z)+.45){reach=Math.max(.1,t-.06);break;}
 }
 const x=p.x+dx*reach,z=p.z+dz*reach;
 y=Math.max(y,floorAt(s.world,x,z)+.7);
 const targetFov=(aspect<.8?67:61)+speed*6+(s.boost?3:0);
 return {tick:s.tick,x,y,z,lookX:p.x+Math.sin(p.yaw)*3.6*reach,lookY:p.y+1.35,lookZ:p.z-Math.cos(p.yaw)*3.6*reach,
  fov:previous?previous.fov+(targetFov-previous.fov)*(1-Math.exp(-4*dt)):targetFov};
}
