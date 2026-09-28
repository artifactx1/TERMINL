import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {GRIND_STYLES,stepGrind} from '../lib/arcade/after-hours/mall-grinds.mjs';
import {sampleSkatePose,skateViewYaw} from '../lib/arcade/after-hours/mall-animation.mjs';
import {makeSkateboard,poseSkaterRig} from '../lib/arcade/after-hours/skateboard.js';
import {bail} from '../lib/arcade/after-hours/mall-score.mjs';
import {planRailLine} from './mall-rail-lines.mjs';

function approach(){
 const plan=planRailLine(),s=createMall({practice:true,seed:123});stepMall(s);stepMall(s);
 for(const input of plan.inputs.slice(0,plan.catches[0].frame))stepMall(s,input);
 assert.equal(s.player.rail,'diamond-1');return s;
}
const roll={forward:true,grind:true,touchAssist:true};
function frames(s,n,input=roll){for(let i=0;i<n;i++)stepMall(s,input);}
test('all grind styles are playable in a real line from spawn; new styles score only after a hold',()=>{
 const s=approach();frames(s,24);
 for(let index=1;index<4;index++){
  stepMall(s,{...roll,flip:true});assert.equal(s.player.grind.index,index);assert.equal(s.player.airMove,null);
  const name=GRIND_STYLES[index].name;assert.equal(s.combo.seen[name],undefined);
  frames(s,17);assert.equal(s.combo.seen[name],undefined);
  frames(s,1);assert.equal(s.combo.seen[name],1);frames(s,6);
 }
 assert.equal(s.stats.grindChanges,3);assert.equal(s.player.rail,'diamond-1');
});
test('holding or rapidly tapping the change input cannot farm grind awards',()=>{
 const s=approach();frames(s,24);frames(s,35,{...roll,flip:true});
 assert.equal(s.player.grind.index,1);assert.equal(s.stats.grindChanges,1);
 frames(s,1);stepMall(s,{...roll,flip:true});frames(s,1);stepMall(s,{...roll,flip:true});
 assert.equal(s.player.grind.index,2);assert.equal(s.stats.grindChanges,1);
 // A cycle back to an already scored style does not add another style award.
 const p=s.player;p.grind.index=0;p.grind.started=s.tick-24;
 stepGrind(s,true);s.tick+=18;stepGrind(s,false);assert.equal(s.stats.grindChanges,1);
});
test('jump/release clears grind scoring and settles orientation; bails clear it immediately',()=>{
 for(const jump of [false,true]){
  const s=approach();frames(s,24);stepMall(s,{...roll,flip:true});frames(s,20);
  assert.ok(s.player.grindPose.yaw>1.5);
  stepMall(s,{forward:true,jump});assert.equal(s.player.rail,null);assert.equal(s.player.grind,null);
  const yaw=s.player.grindPose.yaw;assert.ok(yaw>0&&yaw<1.5,'exit blends the rider back toward travel');
  frames(s,30,{forward:true});assert.equal(s.player.grindPose.yaw,0);assert.equal(s.player.grindPose.weight,0);
  assert.equal(s.stats.grindChanges,1);bail(s);assert.equal(s.player.grindPose,null);assert.equal(s.player.grind,null);
 }
});
test('grind poses keep the rider on the deck and the selected truck or deck on the rail',()=>{
 const material=new THREE.MeshBasicMaterial(),scene={disposables:[],gripMaterial:material,mat:()=>material,
  plane(parent,x,y,z,w,h,mat){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);m.position.set(x,y,z);parent.add(m);return m;},
  mesh(parent,x,y,z,w,h,d){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);parent.add(m);return m;}};
 const board=makeSkateboard(scene),sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material),rig=new THREE.Group();rig.add(board,sprite);rig.userData={board,sprite};
 const frame={width:100,height:200,footX:47,footY:196},s=createMall();Object.assign(s.player,{grounded:false,rail:'test',yaw:.6});
 for(const [index,style]of GRIND_STYLES.entries()){
  s.player.grind={index,started:0,seen:[index]};
  for(let tick=0;tick<45;tick++){
   stepGrind(s,false);const pose=sampleSkatePose(s,.6);poseSkaterRig(rig,pose,frame,.01);rig.updateMatrixWorld(true);
   const feet=sprite.localToWorld(new THREE.Vector3(frame.footX/frame.width-.5,.5-frame.footY/frame.height,0));
   assert.ok(feet.distanceTo(board.userData.grip.getWorldPosition(new THREE.Vector3()))<1e-7);
   const boardYaw=-rig.rotation.y-board.rotation.y,riderYaw=-rig.rotation.y-sprite.rotation.y+skateViewYaw(pose.frame);
   assert.ok(Math.abs(boardYaw-riderYaw)<1e-7,'heading is shared after compensating authored view');
  }
  const {deck}=board.userData,contact=new THREE.Vector3(0,style.contactY,style.contactZ).sub(deck.position);deck.localToWorld(contact);
  assert.ok(Math.abs(contact.y-.05)<.002,`${style.name} rests on rail top`);
  const nose=new THREE.Vector3(0,0,-1).transformDirection(board.matrixWorld),travel=new THREE.Vector3(Math.sin(.6),0,-Math.cos(.6));
  assert.ok(index===1?Math.abs(nose.dot(travel))<.002:nose.dot(travel)>.96);
 }
 board.traverse(o=>o.geometry?.dispose());sprite.geometry.dispose();scene.disposables.forEach(d=>d.dispose());material.dispose();
});
