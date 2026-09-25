import test from 'node:test';import assert from 'node:assert/strict';
import {createMall,stepMall,MALL_TUNING} from '../lib/arcade/after-hours/mall-sim.mjs';
import {trick,bank,bail,comboValue} from '../lib/arcade/after-hours/mall-score.mjs';
import {readProgress,recordRun} from '../lib/arcade/after-hours/progress.mjs';
test('skater accelerates immediately, jumps, air-steers, lands and recovers quickly',()=>{const s=createMall();for(let i=0;i<30;i++)stepMall(s,{forward:true});assert.ok(s.player.speed>12);const yaw=s.player.yaw;stepMall(s,{jump:true,forward:true});assert.ok(!s.player.grounded);for(let i=0;i<12;i++)stepMall(s,{right:true,forward:true,flip:i===2});assert.ok(s.player.y>1.5);assert.ok(s.player.yaw>yaw);assert.ok(s.combo.history.includes('KICKFLIP')||s.combo.history.includes('IMPOSSIBLE'));for(let i=0;i<100;i++)stepMall(s,{});assert.ok(s.player.grounded);bail(s);for(let i=0;i<42;i++)stepMall(s,{});assert.equal(s.player.bail,0);});
test('rails snap from forgiving approach; manual and jump preserve combo',()=>{const s=createMall();Object.assign(s.player,{x:0,z:14.8,speed:12,yaw:Math.PI/2});s.tick=20;stepMall(s,{grind:true});assert.ok(s.player.rail);for(let i=0;i<20;i++)stepMall(s,{grind:true});assert.ok(s.combo.count);stepMall(s,{jump:true,flip:true});assert.equal(s.player.rail,null);assert.ok(s.player.vy>0);});
test('repeat tricks diminish, bank is safe, bail destroys only unbanked score',()=>{const s=createMall();trick(s,'FLIP',100);const first=s.combo.base;trick(s,'FLIP',100);assert.ok(s.combo.base-first<100);trick(s,'GRAB',200);const score=comboValue(s);bank(s);assert.equal(s.score,score);trick(s,'SPECIAL',2000);bail(s);assert.equal(s.score,score);assert.equal(s.combo.count,0);assert.ok(s.stats.biggestBail>0);});
test('150 second runs end, seeded challenges repeat, saves survive malformed data',()=>{const s=createMall({seed:17});assert.deepEqual(s.challengeIds,createMall({seed:17}).challengeIds);s.tick=MALL_TUNING.duration-1;stepMall(s);assert.equal(s.phase,'finished');const storage={getItem:()=>'{',setItem(){throw Error('quota');}};const result=recordRun(readProgress(storage),s,storage);assert.equal(result.saved,false);assert.equal(result.progress.mall.records.length,1);});
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
 assert.ok(s.combo.history.includes('KICKFLIP'));assert.equal(s.bankPending,true);
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
  input.stick({x:.4,y:-.5});assert.equal(input.read().steer,.4);input.touch('special',true,2);input.clear();const neutral=input.read();assert.equal(neutral.special,undefined);assert.equal(neutral.forward,undefined);assert.equal(neutral.steer,undefined);
 }finally{input.dispose();for(const [key,descriptor]of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
test('skaters remain stopped without input and braking never accelerates backward',()=>{
 const s=createMall({practice:true}),spawn={...s.player};for(let i=0;i<180;i++)stepMall(s,{});assert.equal(s.player.speed,0);assert.equal(s.player.x,spawn.x);assert.equal(s.player.z,spawn.z);
 for(let i=0;i<20;i++)stepMall(s,{forward:true});assert.ok(s.player.speed>0);for(let i=0;i<120;i++)stepMall(s,{back:true,forward:true});assert.equal(s.player.speed,0);
 const z=s.player.z;for(let i=0;i<30;i++)stepMall(s,{back:true});assert.equal(s.player.z,z);
});
