import test from 'node:test';
import assert from 'node:assert/strict';
import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {sampleSkatePose,skateFrameScale} from '../lib/arcade/after-hours/mall-animation.mjs';
import {angleDelta} from '../lib/arcade/after-hours/math.mjs';
import {MALL_MOTION} from '../lib/arcade/after-hours/mall-motion-data.mjs';
import {bail} from '../lib/arcade/after-hours/mall-score.mjs';

const pose=s=>sampleSkatePose(s,s.player.yaw);
function jump180(s,direction=1){
 stepMall(s,{jump:true});for(let i=0;i<28;i++)stepMall(s,{grab:true,steer:direction});
 let previous=pose(s).bodyYaw;
 while(!s.player.grounded){
  stepMall(s);const heading=pose(s).bodyYaw;
  assert.ok(Math.abs(angleDelta(heading,previous))<.03,'catch preserves the visible orientation instead of snapping 180');previous=heading;
 }
}
function start(){const s=createMall({practice:true,seed:123});for(let i=0;i<12;i++)stepMall(s,{forward:true});return s;}
test('real spawn jumps land 180s fakie in either direction; a second half-turn lands regular',()=>{
 for(const sign of [-1,1]){
  const s=start();jump180(s,sign);assert.equal(s.player.fakie,true);assert.equal(s.combo.seen['180 SPIN'],1);
  for(let i=0;i<12;i++)stepMall(s);assert.ok(Math.abs(Math.abs(angleDelta(pose(s).bodyYaw,s.player.yaw))-Math.PI)<1e-6);
  assert.equal(s.player.rail,null);assert.equal(s.player.manual,false);assert.equal(s.player.bail,0);
  jump180(s,sign);assert.equal(s.player.fakie,false);
  for(let i=0;i<12;i++)stepMall(s);assert.ok(Math.abs(angleDelta(pose(s).bodyYaw,s.player.yaw))<1e-6);
 }
});
test('540 catches fakie and 720 catches regular without changing horizontal momentum',()=>{
 for(const [frames,fakie]of [[84,true],[112,false]]){
  const s=start();Object.assign(s.player,{grounded:false,vy:23,y:0,jumpedAt:s.tick});
  for(let i=0;i<frames;i++)stepMall(s,{grab:true,right:true});
  let heading=pose(s).bodyYaw;
  while(!s.player.grounded){stepMall(s);assert.ok(Math.abs(angleDelta(pose(s).bodyYaw,heading))<.03);heading=pose(s).bodyYaw;}
  assert.equal(s.player.fakie,fakie);assert.equal(s.player.bail,0);
  const before={...s.player};stepMall(s);const dx=s.player.x-before.x,dz=s.player.z-before.z;
  assert.ok(dx*Math.sin(before.yaw)-dz*Math.cos(before.yaw)>0,'momentum continues forward through the catch');
 }
});
test('landing revert turns the stance smoothly, keeps momentum, and awards only one real landing link',()=>{
 const s=start();jump180(s);const before={...s.player},heading=pose(s).bodyYaw;
 stepMall(s,{turn:true});assert.equal(s.player.fakie,false);assert.ok(Math.abs(angleDelta(pose(s).bodyYaw,heading))<.01);
 assert.ok(Math.abs(angleDelta(s.player.yaw,before.yaw))<.01,'revert does not reverse travel');assert.equal(s.combo.seen.REVERT,1);
 let previous=pose(s).bodyYaw;
 for(let i=0;i<40;i++){
  stepMall(s,{turn:i%2===0});const current=pose(s).bodyYaw;
  assert.ok(Math.abs(angleDelta(current,previous))<.28,'revert has no single-frame pivot');previous=current;
 }
 assert.equal(s.combo.seen.REVERT,1,'repeated floor pivots cannot create more combo tricks');
});
test('fakie ramp pitch follows the same ground plane; bail clears all stance blending',()=>{
 const s=start();jump180(s);for(let i=0;i<12;i++)stepMall(s);
 s.player.rampSlope=.4;const fakie=pose(s);assert.ok(fakie.boardPitch<0,'fakie nose points downhill when travel climbs');
 s.player.fakie=false;assert.ok(pose(s).boardPitch>0);
 s.player.catchYaw=1;s.player.headingBlend={from:1,started:s.tick,duration:12};bail(s);
 assert.equal(s.player.catchYaw,0);assert.equal(s.player.headingBlend,null);assert.equal(s.player.fakie,false);
 for(let i=0;i<45;i++)stepMall(s,{link:true});assert.equal(s.player.manual,false);assert.equal(s.player.rail,null);
});
test('a held revert stays one pivot, and stopped or airborne input cannot trigger it',()=>{
 const s=createMall({practice:true});for(let i=0;i<20;i++)stepMall(s,{turn:true});assert.equal(s.player.fakie,false);
 for(let i=0;i<12;i++)stepMall(s,{forward:true});for(let i=0;i<100;i++)stepMall(s,{turn:true,forward:true});assert.equal(s.player.fakie,true);assert.equal(s.combo.seen.REVERT,undefined);
 stepMall(s,{jump:true});stepMall(s,{turn:true});assert.equal(s.player.fakie,true);
});

test('all four degens retain the same standing scale when the view turns around them',()=>{
 for(const sheet of Object.values(MALL_MOTION)){
  for(const index of [0,9,10,11])assert.ok(Math.abs(sheet.frames[index].height*skateFrameScale(sheet,index)-3.15)<1e-9);
  assert.ok(sheet.frames[4].height*skateFrameScale(sheet,4)<2.7,'crouch keeps its authored lower silhouette');
 }
});
