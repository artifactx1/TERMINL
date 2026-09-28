import {angleDelta,clamp} from './math.mjs';
import {AIR_TRICKS} from './mall-tricks.mjs';
import {stanceYaw} from './mall-heading.mjs';
export const SKATE_CLIPS={coast:0,pushContact:1,pushExtend:2,pushRecover:3,crouch:4,ollie:5,flip:6,grab:7,grind:8,left:9,front:10,right:11};
export const skateViewYaw=frame=>frame===SKATE_CLIPS.front?Math.PI:frame===SKATE_CLIPS.right?Math.PI/2:frame===SKATE_CLIPS.left?-Math.PI/2:0;
// Side/front sheets were authored at different sizes. Match their standing
// height to the rear view while preserving the authored compression of actions.
export function skateFrameScale(sheet,index,height=3.15){
 return height/(index>=SKATE_CLIPS.left?sheet.frames[index].height:sheet.standingHeight);
}
/** Heading 0 is world -Z. A chase camera behind that heading sees the BACK. */
export function facingFrame(bodyYaw,cameraYaw,rearFrame=0){
 const angle=angleDelta(bodyYaw,cameraYaw);
 if(Math.abs(angle)<Math.PI/4)return rearFrame;
 if(Math.abs(angle)>Math.PI*3/4)return SKATE_CLIPS.front;
 return angle>0?SKATE_CLIPS.right:SKATE_CLIPS.left;
}
export function sampleSkatePose(s,cameraYaw){
 const p=s.player,age=s.tick-(p.trickStarted??-999),duration=p.trickDuration||28;
 const trickActive=!p.grounded&&!p.rail&&age>=0&&age<duration;
 const stance=stanceYaw(p),slope=p.grounded?Math.atan(p.rampSlope||0):0;
 let frame=SKATE_CLIPS.coast,bodyLift=0,boardPitch=slope*Math.cos(stance),boardRoll=-slope*Math.sin(stance)||0,boardYaw=0,somersault=0;
 const landing=clamp((s.tick-(p.landedAt??-999))/12,0,1);
 if(p.bail){frame=SKATE_CLIPS.crouch;}
 else if(p.rail){frame=SKATE_CLIPS.grind;}
 else if(!p.grounded){
  frame=trickActive?(p.trickType==='grab'?SKATE_CLIPS.grab:SKATE_CLIPS.flip):SKATE_CLIPS.ollie;
  // Ollies and grabs keep the feet on the board; only a flip separates them.
  const flightAge=s.tick-(p.jumpedAt??s.tick);boardPitch=Math.sin(clamp(flightAge/18,0,1)*Math.PI)*.34;
  if(trickActive&&p.trickType==='flip'){const progress=clamp(age/(duration*.8),0,1);boardRoll=progress===1?0:Math.PI*2*(progress*progress*(3-2*progress));bodyLift=Math.sin(progress*Math.PI)*.38;if(progress===1)frame=SKATE_CLIPS.ollie;}
  if(trickActive&&p.trickType==='grab'){boardRoll=-.28;boardPitch=.18;}
  const move=p.airMove&&AIR_TRICKS[p.airMove.id];
  if(move){
   const progress=clamp(age/(duration*.8),0,1),ease=progress*progress*(3-2*progress),wave=Math.sin(progress*Math.PI);
   if(move.somersault){somersault=move.somersault*ease*Math.PI*2;frame=SKATE_CLIPS.crouch;boardPitch=0;}
   else if(move.grab){boardRoll=(move.roll||-.2)*wave;boardPitch=(move.pitch||.2)*wave;frame=SKATE_CLIPS.grab;}
   else{boardRoll=(move.roll||0)*Math.PI*2*ease;boardYaw=(move.yaw||0)*Math.PI*ease;boardPitch=(move.pitch||0)*Math.PI*wave;bodyLift=wave*.45;if(progress===1){boardRoll=boardYaw=boardPitch=0;frame=SKATE_CLIPS.ollie;}}
  }
 }else if(landing<1){frame=SKATE_CLIPS.crouch;}
 else if(p.manual){frame=SKATE_CLIPS.crouch;boardPitch+=.16;}
 else if(p.pushing&&p.speed>1&&p.speed<20){const phase=Math.floor((p.pushPhase||0)/9)%6;frame=[0,1,2,2,3,0][phase];}
 const bodyYaw=p.yaw+stance+(p.visualSpin||0)+(p.grindPose?.yaw||0);
 boardPitch+=p.grindPose?.pitch||0;
 return {frame:facingFrame(bodyYaw,cameraYaw,frame),rearFrame:frame,bodyYaw,bodyLift,boardPitch,boardRoll,boardYaw,somersault,grindContact:p.grindPose,lean:(p.steer||0)*-.1,flipping:trickActive&&p.trickType==='flip'&&age<duration*.8,landing,bail:p.bail||0};
}
