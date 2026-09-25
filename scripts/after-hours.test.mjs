import test from 'node:test';import assert from 'node:assert/strict';
import {createMall,stepMall,MALL_TUNING} from '../lib/arcade/after-hours/mall-sim.mjs';
import {trick,bank,bail,comboValue} from '../lib/arcade/after-hours/mall-score.mjs';
import {readProgress,recordRun} from '../lib/arcade/after-hours/progress.mjs';
test('skater accelerates immediately, jumps, air-steers, lands and recovers quickly',()=>{const s=emptySkatepark();for(let i=0;i<30;i++)stepMall(s,{forward:true});assert.ok(s.player.speed>12);const yaw=s.player.yaw;stepMall(s,{jump:true,forward:true});assert.ok(!s.player.grounded);for(let i=0;i<12;i++)stepMall(s,{right:true,forward:true,flip:i===2});assert.ok(s.player.y>1.5);assert.ok(s.player.yaw>yaw);assert.equal(s.player.airMove?.id,'tre');for(let i=0;i<100;i++)stepMall(s,{});assert.ok(s.player.grounded);bail(s);for(let i=0;i<42;i++)stepMall(s,{});assert.equal(s.player.bail,0);});
test('rails catch an airborne approach; jumping releases the rail and preserves combo',()=>{const s=createMall();Object.assign(s.player,{x:0,z:14.8,y:1.1,grounded:false,vy:-2,speed:12,yaw:Math.PI/2});s.tick=20;stepMall(s,{grind:true});assert.ok(s.player.rail);for(let i=0;i<20;i++)stepMall(s,{grind:true});assert.ok(s.combo.count);stepMall(s,{jump:true,flip:true});assert.equal(s.player.rail,null);assert.ok(s.player.vy>0);});
test('touch rail assistance never redirects a skater rolling past a rail',()=>{
 const s=createMall();Object.assign(s.player,{x:4,z:16,speed:12});s.tick=20;
 for(let i=0;i<16;i++){stepMall(s,{forward:true,grind:true,touchAssist:true});assert.equal(s.player.rail,null);assert.equal(s.player.yaw,0);assert.equal(s.player.grounded,true);}
 assert.ok(s.player.z<14);
});
test('repeat tricks diminish, bank is safe, bail destroys only unbanked score',()=>{const s=createMall();trick(s,'FLIP',100);const first=s.combo.base;trick(s,'FLIP',100);assert.ok(s.combo.base-first<100);trick(s,'GRAB',200);const score=comboValue(s);bank(s);assert.equal(s.score,score);trick(s,'SPECIAL',2000);bail(s);assert.equal(s.score,score);assert.equal(s.combo.count,0);assert.ok(s.stats.biggestBail>0);});
test('three minute runs end, seeded challenges repeat, saves survive malformed data',()=>{const s=createMall({seed:17});assert.deepEqual(s.challengeIds,createMall({seed:17}).challengeIds);s.tick=MALL_TUNING.duration-1;stepMall(s);assert.equal(s.phase,'finished');const storage={getItem:()=>'{',setItem(){throw Error('quota');}};const result=recordRun(readProgress(storage),s,storage);assert.equal(result.saved,false);assert.equal(result.progress.mall.records.length,1);});
import {createRug,stepRug} from '../lib/arcade/after-hours/rug-sim.mjs';
import {fireWeapon,damageEnemy,hurtPlayer,stepEnemies} from '../lib/arcade/after-hours/rug-combat.mjs';
import {spawnEnemy} from '../lib/arcade/after-hours/rug-world.mjs';
test('shooter strafe speed is normalized; dash, slide-jump and walls preserve control',()=>{const a=createRug({level:1}),b=createRug({level:1});a.enemies=[];b.enemies=[];for(let i=0;i<25;i++){stepRug(a,{forward:true});stepRug(b,{forward:true,right:true});}assert.ok(Math.abs(Math.hypot(a.player.vx,a.player.vz)-Math.hypot(b.player.vx,b.player.vz))<.01);stepRug(a,{dash:true,forward:true});assert.ok(Math.hypot(a.player.vx,a.player.vz)>25);stepRug(a,{crouch:true,jump:true});assert.ok(a.player.vy>9);Object.assign(a.player,{x:33.4,z:27,y:0,vx:20,vz:0});stepRug(a,{right:true});assert.ok(a.player.x<34);});
test('three slice weapons have different ranges, resources and damage',()=>{for(const weapon of [0,1,2]){const s=createRug({level:1});s.enemies=[spawnEnemy('whale',0,23,0)];s.weapon=weapon;const before=s.enemies[0].hp;fireWeapon(s);assert.ok(s.enemies[0].hp<before);if(weapon===0)assert.equal(s.ammo.shells,24);if(weapon===1)assert.equal(s.ammo.shells,23);if(weapon===2)assert.equal(s.ammo.gwei,178);}const s=createRug();s.enemies=[spawnEnemy('bot',0,23,0)];s.world.solids.push({x:0,z:25,w:5,d:1,y:0,h:4});fireWeapon(s);assert.equal(s.enemies[0].hp,45);});
test('sybils split, collateral absorbs damage and consecutive kills build leverage',()=>{const s=createRug();const e=spawnEnemy('sybil',0,0,900);s.enemies=[e];damageEnemy(s,e,22);assert.equal(s.enemies.length,3);damageEnemy(s,e,22);assert.equal(s.enemies.length,3);hurtPlayer(s,20);assert.equal(s.player.armor,37);assert.equal(s.player.hp,93);for(let i=0;i<9;i++){const b=spawnEnemy('bot',0,0,100+i);damageEnemy(s,b,100);s.tick+=30;}assert.equal(s.leverage,10);s.tick+=300;stepRug(s);assert.equal(s.leverage,1);});
test('pool controls and kill quota unlock exit; level completion persists unlock',()=>{const s=createRug({level:1});s.enemies=[];for(const control of s.world.switches){Object.assign(s.player,{x:control.x,z:control.z,y:0});stepRug(s,{interact:true});stepRug(s,{});}s.kills=s.initialEnemies;stepRug(s);assert.equal(s.exitOpen,true);Object.assign(s.player,s.world.exit);stepRug(s,{interact:true});assert.equal(s.phase,'complete');const storage={getItem:()=>null,setItem(){}};assert.equal(recordRun(readProgress(storage),s,storage).progress.rug.unlocked,2);});
test('MEV redirects actual projectiles and explosions can propel the player',()=>{const s=createRug();s.weapon=5;s.enemies=[spawnEnemy('bot',0,15,0)];s.projectiles=[{x:0,y:1,z:25,vx:0,vy:0,vz:10,owner:'enemy',life:50,damage:10}];fireWeapon(s);assert.equal(s.projectiles[0].owner,'player');assert.ok(s.projectiles[0].vz<0);});
import {makeRugWorld,RUG_LEVELS} from '../lib/arcade/after-hours/rug-world.mjs';
import {inside} from '../lib/arcade/after-hours/math.mjs';
import {openSecret} from '../lib/arcade/after-hours/rug-combat.mjs';
test('every campaign spawn, exit and required control is outside solid geometry',()=>{for(let i=0;i<RUG_LEVELS.length;i++){const w=makeRugWorld(i);for(const point of [w.spawn,w.exit,...w.switches])assert.equal(w.solids.some(b=>inside(point,b,.45)),false,`${RUG_LEVELS[i].name}: ${point.id||'spawn/exit'}`);}});
test('secret panels open side rooms; walking inside awards one discovery',()=>{const s=createRug({level:1});s.enemies=[];const secret=s.world.secrets[0];openSecret(s,secret);assert.equal(s.world.solids.find(b=>b.id===secret.panelId).broken,true);assert.equal(s.secrets.length,0);Object.assign(s.player,{x:secret.roomX,z:secret.roomZ,y:0});stepRug(s);stepRug(s);assert.deepEqual(s.secrets,[secret.id]);assert.ok(s.unlocked.includes(7));});
test('final level ends with escape, never a conventional boss fight',()=>{const s=createRug({level:7});s.enemies=[];s.world.switches.forEach(c=>c.used=true);s.kills=s.initialEnemies;Object.assign(s.player,s.world.exit);stepRug(s,{interact:true});assert.ok(s.escape>0);assert.equal(s.phase,'playing');assert.deepEqual(s.world.exit,s.world.spawn);Object.assign(s.player,s.world.spawn);stepRug(s);assert.equal(s.phase,'complete');});
test('long sessions bound defeated actors, health drops and free-skate replay data',()=>{const s=createRug();s.enemies=[];for(let i=0;i<600;i++){const e=spawnEnemy('bot',0,0,i+100);s.enemies.push(e);damageEnemy(s,e,100);}stepRug(s);assert.equal(s.enemies.length,0);assert.ok(s.world.pickups.length<=120);const mall=createMall({practice:true});for(let i=0;i<600;i++)stepMall(mall);assert.equal(mall.ghost.length,0);});
test('touch action ollies then flips, assisted rails release, bank waits for landing',()=>{
 const s=createMall({practice:true});
 for(let i=0;i<20;i++)stepMall(s,{forward:true,steer:.3});
 assert.ok(s.player.yaw>0&&s.player.yaw<.4);
 stepMall(s,{forward:true,action:true,grind:true});assert.equal(s.player.grounded,false);assert.equal(s.player.rail,null);
 stepMall(s,{forward:true,grind:true});stepMall(s,{forward:true,action:true,bank:true,grind:true});
 assert.equal(s.player.airMove?.id,'kickflip');assert.equal(s.bankPending,true);
 for(let i=0;i<80;i++)stepMall(s,{});assert.ok(s.score>0);assert.equal(s.bankPending,false);
 const rail=createMall();Object.assign(rail.player,{x:0,z:14,y:.8,rail:'atrium-rail',speed:12,grounded:false});rail.tick=30;
 stepMall(rail,{action:true,grind:true});assert.equal(rail.player.rail,null);assert.ok(rail.player.vy>0);
});
test('quick touch taps survive release before a simulation read; pause clears all inputs',async()=>{
 const {attachInput}=await import('../lib/arcade/after-hours/input.js');
 const originals=Object.fromEntries(['window','document','navigator'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 Object.defineProperty(globalThis,'window',{value:new EventTarget(),configurable:true});Object.defineProperty(globalThis,'document',{value:new EventTarget(),configurable:true});Object.defineProperty(globalThis,'navigator',{value:{getGamepads:()=>[]},configurable:true});
 const input=attachInput(new EventTarget(),{kind:'mall',pause(){},restart(){},debug(){}});
 try{
  input.touch('action',true,1);input.touch('action',false,1);assert.equal(input.read().action,true);assert.equal(input.read().action,undefined);
  const skate=createMall();input.touch('action',true,1);const firstTap=input.read();stepMall(skate,firstTap);assert.equal(skate.player.grounded,false);
  input.touch('action',false,1);input.touch('action',true,1);const secondTap=input.read();assert.notEqual(firstTap.pressIds.action,secondTap.pressIds.action);stepMall(skate,secondTap);assert.equal(skate.player.airMove?.id,'kickflip');
  const count=skate.combo.count;stepMall(skate,secondTap);assert.equal(skate.combo.count,count);input.touch('action',false,1);
  input.stick({x:.4,y:-.5});assert.equal(input.read().steer,.4);input.touch('special',true,2);input.clear();const neutral=input.read();assert.equal(neutral.special,undefined);assert.equal(neutral.forward,undefined);assert.equal(neutral.steer,undefined);
 }finally{input.dispose();for(const [key,descriptor]of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
test('skaters remain stopped without input and braking never accelerates backward',()=>{
 const s=createMall({practice:true}),spawn={...s.player};for(let i=0;i<180;i++)stepMall(s,{});assert.equal(s.player.speed,0);assert.equal(s.player.x,spawn.x);assert.equal(s.player.z,spawn.z);
 for(let i=0;i<20;i++)stepMall(s,{forward:true});assert.ok(s.player.speed>0);for(let i=0;i<120;i++)stepMall(s,{back:true,forward:true});assert.equal(s.player.speed,0);
 const z=s.player.z;for(let i=0;i<30;i++)stepMall(s,{back:true});assert.equal(s.player.z,z);
});

import {facingFrame,sampleSkatePose,SKATE_CLIPS} from '../lib/arcade/after-hours/mall-animation.mjs';
import {MALL_MOTION} from '../lib/arcade/after-hours/mall-motion-data.mjs';
test('chase view sees the back at every compass heading; spins expose side and front views',()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*7])assert.equal(facingFrame(yaw,yaw,5),5);
 assert.equal(facingFrame(Math.PI,0),SKATE_CLIPS.front);assert.equal(facingFrame(Math.PI/2,0),SKATE_CLIPS.right);assert.equal(facingFrame(-Math.PI/2,0),SKATE_CLIPS.left);
 for(const sheet of Object.values(MALL_MOTION)){assert.equal(sheet.frames.length,12);for(const f of sheet.frames){assert.ok(f.x+f.width<=sheet.width&&f.y+f.height<=sheet.height);assert.ok(f.width>0&&f.height>0);}}
});
function emptySkatepark(){const s=createMall({practice:true});s.world.props=[];s.world.solids=[];s.world.rails=[];s.world.floors=[{x:0,z:0,w:170,d:170,y:0}];Object.assign(s.player,{x:30,z:20,speed:18});return s;}
test('steering carves in the requested direction and cannot pivot a stopped board',()=>{
 for(const direction of [-1,1]){
  const s=emptySkatepark();s.player.speed=0;const start={...s.player};
  for(let i=0;i<90;i++)stepMall(s,{steer:direction});
  assert.equal(s.player.yaw,start.yaw);assert.equal(s.player.x,start.x);assert.equal(s.player.z,start.z);
  for(let i=0;i<20;i++)stepMall(s,{forward:true,steer:direction});
  assert.ok((s.player.x-start.x)*direction>0);assert.ok(s.player.yaw*direction>0);
  for(let i=0;i<60;i++)stepMall(s,{back:true,steer:direction});
  assert.equal(s.player.speed,0);const yaw=s.player.yaw;
  for(let i=0;i<30;i++)stepMall(s,{steer:direction});assert.equal(s.player.yaw,yaw);
 }
});
test('air spins preserve forward momentum and use the same heading for body and board',()=>{
 const s=emptySkatepark();stepMall(s,{jump:true});for(let i=0;i<30;i++)stepMall(s,{right:true,grab:true});
 assert.ok(s.player.spin>3);assert.ok(s.player.yaw<.25);assert.ok(s.player.z<13);assert.equal(sampleSkatePose(s,0).bodyYaw,s.player.yaw+s.player.visualSpin);
});
test('flip animation has a cooldown; landing compresses and a buffered ollie fires after touchdown',()=>{
 const s=emptySkatepark();stepMall(s,{jump:true});stepMall(s,{flip:true});const started=s.player.trickStarted;
 for(let i=0;i<10;i++)stepMall(s,{flip:i%2===0});assert.equal(s.player.trickStarted,started);assert.ok(sampleSkatePose(s,0).boardRoll>0);
 while(!s.player.grounded)stepMall(s,{});assert.equal(sampleSkatePose(s,0).rearFrame,SKATE_CLIPS.crouch);assert.equal(s.events.some(e=>e.type==='land'),true);
 Object.assign(s.player,{grounded:false,y:.06,vy:-5,coyote:0});stepMall(s,{jump:true});assert.equal(s.player.grounded,true);stepMall(s,{});assert.equal(s.player.grounded,false);assert.ok(s.player.vy>10);
});
test('ramp lip converts speed into an airborne transfer without pressing jump',()=>{
 const s=emptySkatepark();s.world.floors.push({x:30,z:5,w:7,d:6,y:0,rise:2.5});Object.assign(s.player,{z:2.1,y:.1,yaw:Math.PI,speed:20});
 let launched=false;for(let i=0;i<30;i++){stepMall(s,{forward:true});if(!s.player.grounded&&s.player.vy>4){launched=true;break;}}
 assert.equal(launched,true);assert.ok(s.combo.history.includes('RAMP TRANSFER'));
});
test('touch balance assistance sustains a manual; overbalancing loses the unbanked line',()=>{
 const s=emptySkatepark();trick(s,'OLLIE',60);for(let i=0;i<180;i++)stepMall(s,{forward:true,manual:true,touchAssist:true});assert.equal(s.player.bail,0);assert.ok(Math.abs(s.player.balance)<1);assert.ok(s.combo.count>0);
 s.player.balance=1.05;s.player.manual=true;stepMall(s,{forward:true,manual:true});assert.ok(s.player.bail>0);assert.equal(s.combo.count,0);
});

test('rolling down a ramp follows its surface without an accidental launch',()=>{
 const s=emptySkatepark();s.world.floors.push({x:30,z:5,w:7,d:6,y:0,rise:2.5});Object.assign(s.player,{z:7.5,y:2.3,yaw:0,speed:21});
 for(let i=0;i<14;i++){stepMall(s,{forward:true});assert.equal(s.player.grounded,true);assert.equal(s.player.vy,0);}
});

test('ordinary air steering keeps the board aligned with travel without a trick spin',()=>{
 const s=emptySkatepark();stepMall(s,{jump:true});
 for(let i=0;i<35;i++){stepMall(s,{right:true});const pose=sampleSkatePose(s,0);assert.equal(pose.bodyYaw,s.player.yaw);assert.equal(pose.boardRoll,0);}
 assert.ok(s.player.yaw>0);
});
test('wheel rotation follows distance, not run age or changes in speed',()=>{
 const a=emptySkatepark(),b=emptySkatepark();b.tick=4000;
 for(let i=0;i<20;i++){stepMall(a,{forward:true});stepMall(b,{forward:true});assert.equal(a.player.wheelAngle,b.player.wheelAngle);}
 a.player.speed=0;const rotation=a.player.wheelAngle;for(let i=0;i<20;i++)stepMall(a);assert.equal(a.player.wheelAngle,rotation);
});
test('a landing catches the board and a quick new ollie does not replay the previous flip',()=>{
 const s=emptySkatepark();Object.assign(s.player,{grounded:false,y:.01,vy:-1,visualSpin:2,trickType:'flip',trickStarted:s.tick,trickDuration:26});
 stepMall(s);assert.equal(s.player.visualSpin,0);stepMall(s,{jump:true});const pose=sampleSkatePose(s,0);assert.equal(pose.boardRoll,0);assert.equal(pose.rearFrame,SKATE_CLIPS.ollie);
});
test('grip clears the beveled deck and wheels rotate around a fixed axle',async()=>{
 const THREE=await import('three'),{makeSkateboard,poseSkateboard,poseSkaterRig}=await import('../lib/arcade/after-hours/skateboard.js');
 const material=new THREE.MeshBasicMaterial(),scene={disposables:[],gripMaterial:material,mat:()=>material,
  plane(parent,x,y,z,w,h,mat){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;},
  mesh(parent,x,y,z,w,h,d){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}};
 const board=makeSkateboard(scene),{slab,grip,wheels}=board.userData;board.updateMatrixWorld(true);
 assert.ok(new THREE.Box3().setFromObject(grip).min.y-new THREE.Box3().setFromObject(slab).max.y>.015);
 const ray=new THREE.Raycaster(new THREE.Vector3(.2,3,.4),new THREE.Vector3(0,-1,0));assert.equal(ray.intersectObjects([grip,slab])[0].object,grip);
 for(const angle of [0,.5,1.5,3,5]){for(const wheel of wheels){wheel.rotation.x=angle;board.updateMatrixWorld(true);const width=new THREE.Box3().setFromObject(wheel).getSize(new THREE.Vector3()).x;assert.ok(Math.abs(width-.12)<.00001);}}
 // Check the actual deck center through a full flip, not just Euler angles.
 const deckCenter=slab.geometry.boundingBox.getCenter(new THREE.Vector3()),fixedCenter=slab.localToWorld(deckCenter.clone());
 for(let i=0;i<=24;i++){
  const pose={bodyYaw:0,boardPitch:.2,boardRoll:i/24*Math.PI*2,bodyLift:.3,flipping:true,bail:0};poseSkateboard(board,pose);board.updateMatrixWorld(true);
  assert.ok(slab.localToWorld(deckCenter.clone()).distanceTo(fixedCenter)<1e-7,'deck center must not orbit during a flip');
 }
 for(const [pitch,roll,yaw]of [[0,0,0],[.4,0,.7],[.16,.08,2],[-.2,-.28,-1]]){
  const feet=poseSkateboard(board,{bodyYaw:yaw,boardPitch:pitch,boardRoll:roll,bodyLift:0,flipping:false,bail:0}).clone();board.updateMatrixWorld(true);
  assert.ok(feet.distanceTo(grip.getWorldPosition(new THREE.Vector3()))<1e-7,'planted feet must follow the deck contact point');
 }
 // Semantic yaw turns toward +X. Three.js rotates a -Z model toward -X for +Y.
 const rig=new THREE.Group(),rider=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);rig.add(board,rider);rig.userData={board,sprite:rider};
 const frame={width:100,height:200,footX:47,footY:196};
 for(const yaw of [-2,-.7,0,.7,2]){
  const pose={bodyYaw:yaw,boardPitch:0,boardRoll:0,bodyLift:0,flipping:false,bail:0,lean:0,frame:0};poseSkaterRig(rig,pose,frame,.01);rig.updateMatrixWorld(true);
  const nose=new THREE.Vector3(0,0,-1).transformDirection(board.matrixWorld),forward=new THREE.Vector3(Math.sin(yaw),0,-Math.cos(yaw));assert.ok(nose.dot(forward)>.999999,'board nose must point along actual travel');
  const riderForward=new THREE.Vector3(0,0,-1).transformDirection(rider.matrixWorld);assert.ok(riderForward.dot(nose)>.999999,'rider and board must turn together');
  const foot=new THREE.Vector3(frame.footX/frame.width-.5,.5-frame.footY/frame.height,0);rider.localToWorld(foot);assert.ok(foot.distanceTo(grip.getWorldPosition(new THREE.Vector3()))<1e-7,'feet remain planted while steering');
 }
 rider.geometry.dispose();
 board.traverse(o=>o.geometry?.dispose());for(const d of scene.disposables)d.dispose();material.dispose();
});

test('holding the touch ollie while steering does not request an air spin',()=>{
 const s=emptySkatepark();for(let i=0;i<12;i++){stepMall(s,{action:true,steer:.7,touchAssist:true});assert.equal(sampleSkatePose(s,0).bodyYaw,s.player.yaw);}
});

test('ollies stay connected and a flip catches the deck before the next trick',()=>{
 const s=emptySkatepark();stepMall(s,{jump:true});assert.equal(sampleSkatePose(s,0).bodyLift,0);
 stepMall(s,{flip:true});for(let i=0;i<22;i++)stepMall(s);const pose=sampleSkatePose(s,0);
 assert.equal(pose.boardRoll,0);assert.ok(pose.bodyLift<1e-7);assert.equal(pose.flipping,false);assert.equal(pose.rearFrame,SKATE_CLIPS.ollie);
});
