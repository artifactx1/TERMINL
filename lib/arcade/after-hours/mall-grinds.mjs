import {trick} from './mall-score.mjs';

export const GRIND_STYLES=[
 {name:'50-50',yaw:0,pitch:0,contactY:.1125,contactZ:0,points:250},
 {name:'BOARDSLIDE',yaw:Math.PI/2,pitch:0,contactY:.18,contactZ:0,points:350},
 {name:'5-0',yaw:0,pitch:.25,contactY:.1125,contactZ:.7,points:400},
 {name:'NOSEGRIND',yaw:0,pitch:-.25,contactY:.1125,contactZ:-.7,points:450},
];
const neutral=()=>({yaw:0,pitch:0,contactY:.1125,contactZ:0,weight:0});
export function beginGrind(s){
 s.player.grind={index:0,started:s.tick,seen:[0]};
 s.player.grindPose??=neutral();
}
export function clearGrind(p){p.grind=null;p.grindPose=null;}
export function stepGrind(s,change){
 const p=s.player;
 if(p.bail){clearGrind(p);return;}
 if(p.rail){
  if(!p.grind)beginGrind(s);
  const g=p.grind;
  if(change&&s.tick-g.started>=24){g.index=(g.index+1)%GRIND_STYLES.length;g.started=s.tick;}
  if(s.tick-g.started>=18&&!g.seen.includes(g.index)){
   const style=GRIND_STYLES[g.index];g.seen.push(g.index);trick(s,style.name,style.points);
   s.stats.grindChanges=(s.stats.grindChanges||0)+1;
  }
 }else p.grind=null;
 const target=p.rail?{...GRIND_STYLES[p.grind.index],weight:1}:neutral();
 const pose=p.grindPose??=neutral();
 // This is a whole-rider transition. Steering still controls travel, never
 // independently rotates the board underneath a camera-facing body.
 for(const key of ['yaw','pitch','contactY','contactZ','weight']){
  pose[key]+=(target[key]-pose[key])*.25;
  if(Math.abs(target[key]-pose[key])<.001)pose[key]=target[key];
 }
}
