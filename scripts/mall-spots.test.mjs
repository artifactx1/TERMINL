import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {PRACTICE_SPOTS} from '../lib/arcade/after-hours/mall-spots.mjs';
import {floorAt,inside} from '../lib/arcade/after-hours/math.mjs';
import {mallCameraFrame} from '../lib/arcade/after-hours/mall-camera.mjs';
import {readProgress,recordRun} from '../lib/arcade/after-hours/progress.mjs';

test('every district has a clear, grounded free-skate start with a usable forward runup',()=>{
 const world=createMall().world;assert.deepEqual(PRACTICE_SPOTS.map(s=>s.id).sort(),world.zones.map(z=>z.id).sort());
 for(const spot of PRACTICE_SPOTS){
  const s=createMall({practice:true,practiceSpot:spot.id,seed:123}),p=s.player,start={...p};
  assert.equal(s.practiceSpot,spot.id);assert.deepEqual(s.visited,[spot.id]);assert.equal(p.y,floorAt(s.world,p.x,p.z));
  assert.ok(inside(p,world.zones.find(z=>z.id===spot.id)),spot.id+' starts in its district');
  assert.ok(!world.solids.some(b=>inside(p,b,1)&&p.y<b.y+b.h&&p.y+1.3>b.y),spot.id+' is clear');
  for(let i=0;i<60;i++)stepMall(s,{forward:true});
  assert.equal(p.bail,0);assert.ok(Math.hypot(p.x-start.x,p.z-start.z)>12,spot.id+' has a clear first second');
 }
});

test('all starting spots frame the full rider above terrain on desktop and both phone orientations',()=>{
 for(const aspect of [1280/850,375/623,844/346])for(const spot of PRACTICE_SPOTS){
  const s=createMall({practice:true,practiceSpot:spot.id}),p=s.player,f=mallCameraFrame(s,null,aspect);
  const camera=new PerspectiveCamera(f.fov,aspect,.1,260);camera.position.set(f.x,f.y,f.z);camera.lookAt(f.lookX,f.lookY,f.lookZ);camera.updateMatrixWorld();
  for(const height of [0,3.4]){const v=new Vector3(p.x,p.y+height,p.z).project(camera);assert.ok(Math.abs(v.x)<.85&&Math.abs(v.y)<.85,spot.id+' rider is framed');}
  assert.ok(f.y>=floorAt(s.world,f.x,f.z)+.69,spot.id+' camera is above ground');
 }
});

test('rail session start catches the rail from normal push and grind inputs in under two seconds',()=>{
 const s=createMall({practice:true,practiceSpot:'rails'});let caught=false;
 for(let i=0;i<120;i++){stepMall(s,{forward:true,grind:true});if(s.player.rail){caught=true;break;}}
 assert.ok(caught);assert.equal(s.player.rail,'diamond-1');assert.equal(s.player.bail,0);
});

test('gap session starts lead into real transfers without teleporting the skater after spawn',()=>{
 for(const [spot,gap]of [['mega','ath'],['street','street'],['canal','canal'],['snake','snake']]){
  const s=createMall({practice:true,practiceSpot:spot,seed:123});for(let i=0;i<260;i++)stepMall(s,{forward:true});
  assert.ok(s.gaps.includes(gap),spot+' clears its real gap');assert.equal(s.player.bail,0);
 }
});

test('timed runs ignore free-skate spot preferences, and invalid spots fall back to the atrium',()=>{
 const standard=createMall({seed:123});for(const practiceSpot of [...PRACTICE_SPOTS.map(s=>s.id),'invalid',null]){
  const s=createMall({practiceSpot,seed:123});assert.deepEqual(s,standard);
 }
 const unknown=createMall({practice:true,practiceSpot:'invalid'});assert.equal(unknown.practiceSpot,'atrium');assert.equal(unknown.player.z,20);
});

test('session retries start fresh while earned progress stays outside timed leaderboards',()=>{
 let raw=null;const storage={getItem:()=>raw,setItem:(k,v)=>{raw=v;}},s=createMall({practice:true,practiceSpot:'street',seed:123});
 for(let i=0;i<270;i++)stepMall(s,{forward:true});assert.ok(s.score>1000);recordRun(readProgress(storage),s,storage);
 const retry=createMall({practice:true,practiceSpot:s.practiceSpot,seed:123});assert.equal(retry.score,0);assert.equal(retry.combo.count,0);assert.equal(retry.player.speed,0);assert.equal(retry.player.rail,null);assert.equal(retry.player.manual,undefined);
 const saved=readProgress(storage);assert.ok(saved.mall.gaps.includes('street'));assert.ok(saved.mall.milestones.includes('first-line'));assert.equal(saved.mall.records.length,0);assert.equal(saved.mall.ghost,null);
});


test('starting at a destination gives no free arrival points or already-completed session objective',()=>{
 for(const spot of PRACTICE_SPOTS){
  const s=createMall({practice:true,practiceSpot:spot.id,seed:123});
  for(let i=0;i<3;i++)stepMall(s);
  assert.equal(s.score,0,spot.id);assert.equal(s.combo.count,0,spot.id);
  assert.ok(s.challengeIds.every(id=>!s.completed[id]),spot.id+' goals still need earning');
 }
});
