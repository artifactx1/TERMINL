import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import * as THREE from 'three';
import {MALL_DIRECTIONAL} from '../lib/arcade/after-hours/mall-directional-data.mjs';
import {MALL_MOTION} from '../lib/arcade/after-hours/mall-motion-data.mjs';
import {resolveSkateFrame} from '../lib/arcade/after-hours/mall-directional.mjs';
import {sampleSkatePose,SKATE_CLIPS,skateViewYaw} from '../lib/arcade/after-hours/mall-animation.mjs';
import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {makeSkateboard,poseSkaterRig} from '../lib/arcade/after-hours/skateboard.js';

for(const [id,sheet]of Object.entries(MALL_DIRECTIONAL))test(`${id}: 15 isolated transparent poses with consistent scale and foot anchors`,async()=>{
 const {data,info}=await sharp('public'+sheet.src).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,sheet.width);assert.equal(info.height,sheet.height);assert.equal(sheet.frames.length,15);
 const alpha=(x,y)=>data[(y*info.width+x)*4+3];
 for(const [index,f]of sheet.frames.entries()){
  assert.ok(f.x>=0&&f.y>=0&&f.x+f.width<info.width&&f.y+f.height<info.height);
  assert.ok(f.footX>0&&f.footX<f.width&&f.footY>0&&f.footY<f.height);
  // Packed cells must not clip opaque clothing or bleed into their neighbours.
  let visible=0,footPixels=0;
  for(let y=f.y;y<f.y+f.height;y++)for(let x=f.x;x<f.x+f.width;x++)if(alpha(x,y)>128){visible++;if(y>=f.y+f.footY-8)footPixels++;}
  assert.ok(visible>f.width*f.height*.15,f.name+' contains a silhouette');assert.ok(footPixels>10,f.name+' has actual shoes at the anchor height');
  for(let x=f.x-4;x<f.x+f.width+4;x++)for(const y of [f.y-4,f.y+f.height+3])assert.ok(alpha(x,y)<26,'transparent gutter');
  for(let y=f.y-4;y<f.y+f.height+4;y++)for(const x of [f.x-4,f.x+f.width+3])assert.ok(alpha(x,y)<26,'transparent gutter');
  const resolved=resolveSkateFrame(MALL_MOTION[id],sheet,{frame:9+index%3,rearFrame:[0,4,5,7,8][Math.floor(index/3)]});
  assert.equal(resolved.frame,f);if(index<3)assert.ok(Math.abs(f.height*resolved.scale-3.15)<1e-9);
  if(index>=3&&index<12)assert.ok(f.height*resolved.scale<3,'crouches and tucks retain a lower silhouette');
 }
});

test('actual actions survive front and side view selection, and release clears the grind pose',()=>{
 const s=createMall({practice:true,seed:123}),sheet=MALL_MOTION['margin-call-max'],directional=MALL_DIRECTIONAL['margin-call-max'];
 for(let i=0;i<12;i++)stepMall(s,{forward:true});stepMall(s,{jump:true});stepMall(s,{grab:true,jump:true});
 const before=structuredClone(s);
 for(const [yaw,name]of [[Math.PI/2,'left-grab'],[Math.PI,'front-grab'],[-Math.PI/2,'right-grab']]){
  const pose=sampleSkatePose(s,yaw);assert.equal(resolveSkateFrame(sheet,directional,pose).frame.name,name);
 }
 const rear=resolveSkateFrame(sheet,directional,sampleSkatePose(s,0));assert.equal(rear.directional,false);assert.equal(rear.frame,sheet.frames[SKATE_CLIPS.grab]);
 assert.deepEqual(s,before,'view resolution cannot change physics or score');
 Object.assign(s.player,{grounded:false,rail:'test',airMove:null});assert.equal(resolveSkateFrame(sheet,directional,sampleSkatePose(s,Math.PI)).frame.name,'front-grind');
 s.player.rail=null;s.player.grounded=true;s.player.pushing=false;s.player.landedAt=-999;
 assert.equal(resolveSkateFrame(sheet,directional,sampleSkatePose(s,Math.PI)).frame.name,'front-coast');
});

test('all authored foot anchors stay on the transformed board across actions, headings and lean',()=>{
 const material=new THREE.MeshBasicMaterial(),scene={disposables:[],gripMaterial:material,mat:()=>material,
  plane(parent,x,y,z,w,h,mat){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);m.position.set(x,y,z);parent.add(m);return m;},
  mesh(parent,x,y,z,w,h,d){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);parent.add(m);return m;}};
 const board=makeSkateboard(scene),sprite=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material),rig=new THREE.Group();rig.add(board,sprite);rig.userData={board,sprite};
 for(const [id,sheet]of Object.entries(MALL_DIRECTIONAL))for(let index=0;index<15;index++)for(const heading of [-2.4,0,1.7]){
  const pose={frame:9+index%3,rearFrame:[0,4,5,7,8][Math.floor(index/3)],bodyYaw:heading,boardPitch:.2,boardRoll:-.15,boardYaw:0,bodyLift:0,flipping:false,bail:0,lean:.1};
  const {frame,scale}=resolveSkateFrame(MALL_MOTION[id],sheet,pose);poseSkaterRig(rig,pose,frame,scale);rig.updateMatrixWorld(true);
  const foot=sprite.localToWorld(new THREE.Vector3(frame.footX/frame.width-.5,.5-frame.footY/frame.height,0));
  assert.ok(foot.distanceTo(board.userData.grip.getWorldPosition(new THREE.Vector3()))<1e-7,`${id} ${frame.name} stays attached`);
  assert.ok(Math.abs((-rig.rotation.y-board.rotation.y)-(-rig.rotation.y-sprite.rotation.y+skateViewYaw(pose.frame)))<1e-7);
 }
 board.traverse(o=>o.geometry?.dispose());sprite.geometry.dispose();scene.disposables.forEach(d=>d.dispose());material.dispose();
});
