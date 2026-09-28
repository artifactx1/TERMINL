import {angleDelta,clamp} from './math.mjs';
import {trick} from './mall-score.mjs';

export const stanceYaw=p=>(p.fakie?Math.PI:0)+(p.catchYaw||0);
export function stepHeading(p,tick){
 const blend=p.headingBlend;if(!blend)return;
 const t=clamp((tick-blend.started)/blend.duration,0,1);
 p.catchYaw=blend.from*(1-t*t*(3-2*t));
 if(t===1){p.catchYaw=0;p.headingBlend=null;}
}
// Keep the orientation actually reached in the air, then gently align the wheels
// with travel. Odd half-turns land fakie; velocity never flips with the stance.
export function landHeading(p,tick){
 const rotation=(p.visualSpin||0)+(p.catchYaw||0),halfTurns=Math.round(rotation/Math.PI);
 if(Math.abs(halfTurns)%2)p.fakie=!p.fakie;
 p.catchYaw=angleDelta(rotation,halfTurns*Math.PI);
 p.headingBlend={from:p.catchYaw,started:tick,duration:12};
}
export function revert(s,steering){
 const p=s.player;
 if(!p.grounded||p.rail||p.speed<=2||s.tick-(p.revertAt??-999)<36)return false;
 const old=stanceYaw(p);p.fakie=!p.fakie;
 const delta=angleDelta(old,p.fakie?Math.PI:0);
 p.catchYaw=Math.abs(Math.abs(delta)-Math.PI)<.001?(steering<0?Math.PI:-Math.PI):delta;
 p.headingBlend={from:p.catchYaw,started:s.tick,duration:18};p.revertAt=s.tick;
 // A landing revert links a real aerial. Repeated floor pivots cannot farm a combo.
 if(s.combo.count&&s.tick-(p.landedAt??-999)<=18&&p.revertedLanding!==p.landedAt){
  p.revertedLanding=p.landedAt;trick(s,'REVERT',100);
 }
 return true;
}
