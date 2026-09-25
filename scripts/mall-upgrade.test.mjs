import test from 'node:test';
import assert from 'node:assert/strict';
import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {AIR_TRICKS,startAir} from '../lib/arcade/after-hours/mall-tricks.mjs';
import {sampleSkatePose,SKATE_CLIPS} from '../lib/arcade/after-hours/mall-animation.mjs';
import {floorAt,surfaceHeight} from '../lib/arcade/after-hours/math.mjs';
import {readProgress,recordRun} from '../lib/arcade/after-hours/progress.mjs';
function flat(){const s=createMall({practice:true});s.world.props=[];s.world.solids=[];s.world.rails=[];s.world.floors=[];Object.assign(s.player,{x:30,z:20,speed:18});return s;}
test('park has over five times the area, connected districts, profiles and distinct gaps',()=>{
 const s=createMall(),w=s.world;assert.ok((w.bounds/86)**2>5);assert.equal(w.zones.length,17);assert.equal(w.gaps.length,5);
 assert.equal(floorAt(w,-140,0),-7.5);assert.equal(floorAt(w,-180,0),0);
 const bank=w.floors.find(f=>f.id==='ath-takeoff');assert.equal(surfaceHeight(bank,0,-106),0);assert.equal(surfaceHeight(bank,0,-134),7);
 assert.ok(w.rails.some(r=>Math.hypot(r.bx-r.x,r.bz-r.z)>100));assert.ok(w.solids.every(b=>b.d<10));
 for(const z of w.zones)assert.ok(Number.isFinite(floorAt(w,z.x,z.z)));
});
test('each aerial move completes, animates and scores only once after the catch',()=>{
 for(const [id,m]of Object.entries(AIR_TRICKS)){
  const s=flat();stepMall(s,{jump:true});assert.equal(startAir(s,id),true,id);const initial=s.combo.count;
  for(let i=0;i<10;i++)stepMall(s,{jump:true});assert.equal(s.combo.count,initial,id+' must not score an unfinished move');
  const pose=sampleSkatePose(s,s.player.yaw);assert.ok(m.grab?pose.rearFrame===SKATE_CLIPS.grab:m.somersault?Math.abs(pose.somersault)>.1:Math.abs(pose.boardRoll)+Math.abs(pose.boardYaw)+Math.abs(pose.boardPitch)>.1,id+' visibly animates');
  for(let i=10;i<m.ticks+2;i++)stepMall(s,{jump:true});assert.equal(s.combo.seen[m.name],1,id);
  for(let i=0;i<180&&!s.player.grounded;i++)stepMall(s,{});assert.equal(s.player.grounded,true);assert.equal(s.player.airMove,null);
 }
});
test('late tricks cannot score; held jump produces measurably more height',()=>{
 const short=flat(),high=flat();stepMall(short,{jump:true});stepMall(high,{jump:true});let a=0,b=0;
 for(let i=0;i<90;i++){stepMall(short);stepMall(high,{jump:true});a=Math.max(a,short.player.y);b=Math.max(b,high.player.y);}
 assert.ok(b>a+.5);
 Object.assign(short.player,{grounded:false,y:.1,vy:-8});assert.equal(startAir(short,'backflip'),false);assert.equal(short.trickHint.text,'MORE AIR');
});
test('360 input finishes one full rotation, and held spins can reach 540 and 720',()=>{
 const s=flat();stepMall(s,{jump:true});stepMall(s,{spin:true,jump:true});for(let i=0;i<45;i++)stepMall(s,{jump:true});assert.ok(Math.abs(s.player.spin-Math.PI*2)<.001);
 while(!s.player.grounded)stepMall(s);assert.equal(s.combo.seen['360 SPIN'],1);
 for(const frames of [84,112]){const a=flat();Object.assign(a.player,{grounded:false,y:0,vy:23,jumpedAt:0});for(let i=0;i<frames;i++)stepMall(a,{grab:true,right:true});while(!a.player.grounded)stepMall(a);assert.ok(a.combo.history.includes(frames===84?'540 SPIN':'720 SPIN'));}
});
test('manual ends on release and banking cannot immediately re-enter a held manual',()=>{
 const s=flat();stepMall(s,{link:true,forward:true});assert.equal(s.player.manual,true);stepMall(s,{forward:true});assert.equal(s.player.manual,false);assert.notEqual(sampleSkatePose(s,0).rearFrame,SKATE_CLIPS.grind);
 stepMall(s,{link:true,forward:true,bank:true});assert.equal(s.player.manual,false);stepMall(s,{link:true,forward:true});assert.equal(s.player.manual,false);
 stepMall(s,{forward:true});stepMall(s,{link:true,forward:true});assert.equal(s.player.manual,true);
});
test('rail alignment and release cooldown prevent side-on catches and sticky recatches',()=>{
 const s=flat();s.world.rails=[{id:'rail',x:20,z:0,bx:40,bz:0,y:1}];Object.assign(s.player,{x:30,z:.1,y:1.3,vy:-2,grounded:false,yaw:0});
 stepMall(s,{link:true});assert.equal(s.player.rail,null);
 Object.assign(s.player,{y:1.3,vy:-2,yaw:Math.PI/2});stepMall(s,{link:true});assert.equal(s.player.rail,'rail');
 stepMall(s);assert.equal(s.player.rail,null);assert.ok(s.player.railCooldown>0);stepMall(s,{link:true});assert.equal(s.player.rail,null);
});
test('glancing wall contact preserves a playable line instead of bailing',()=>{
 const s=flat();s.world.solids=[{x:31,z:15,y:0,w:1,d:30,h:6}];Object.assign(s.player,{x:30,z:20,yaw:.7});for(let i=0;i<20;i++)stepMall(s,{forward:true});assert.equal(s.player.bail,0);assert.ok(s.player.z<16);assert.ok(s.player.speed>5);
});
test('named gap requires a completed crossing, and discoveries and route times survive reload',()=>{
 const s=flat();s.world.gaps=[{id:'test',name:'TEST GAP',axis:'z',line:0,cross:'x',min:20,max:40,width:6,points:1000}];Object.assign(s.player,{z:6});stepMall(s,{jump:true});while(!s.player.grounded)stepMall(s,{forward:true,jump:true});assert.deepEqual(s.gaps,['test']);
 s.routesCompleted=[{id:'concourse',seconds:42}];s.stats.bestCombo=12000;let saved='';const storage={getItem:()=>saved,setItem:(k,v)=>{saved=v;}};recordRun(readProgress(storage),s,storage);const p=readProgress(storage);assert.deepEqual(p.mall.gaps,['test']);assert.equal(p.mall.routes.concourse,42);assert.ok(p.mall.milestones.includes('five-figure-line'));
});

import {planLines} from './mall-lines-pilot.mjs';
test('all five named gaps and both routes can be completed from spawn using movement controls',()=>{
 for(const plan of planLines()){
  if(plan.gaps)assert.ok(plan.gaps.includes(plan.id),plan.id+' must award its real gap');
  else assert.ok(plan.completed.some(r=>r.id===plan.id&&r.seconds>0),plan.id+' must finish its gates');
 }
});
