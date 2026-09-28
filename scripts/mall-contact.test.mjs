import test from 'node:test';
import assert from 'node:assert/strict';
import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {bail} from '../lib/arcade/after-hours/mall-score.mjs';
import {skateSoundState} from '../lib/arcade/after-hours/skate-audio.mjs';
import {recordRun,readProgress} from '../lib/arcade/after-hours/progress.mjs';

function catchRail(){
 const s=createMall({practice:true,practiceSpot:'rails',seed:123});
 for(let i=0;i<120;i++){stepMall(s,{forward:true,grind:true});if(s.player.rail)return s;}
 throw Error('The real rail runup did not catch');
}
function flat(){const s=createMall({practice:true});s.world.props=[];s.world.solids=[];s.world.zones=[];s.world.floors=[];s.world.rails=[];s.world.tapes=[];s.world.gaps=[];s.world.routes=[];s.guards=[];return s;}

test('a real rail catch records the completed flight immediately, before banking or touching ground',()=>{
 const s=catchRail();assert.equal(s.player.rail,'diamond-1');assert.equal(s.score,0);assert.ok(s.combo.count>0);
 assert.ok(s.stats.longestAir>.3&&s.stats.longestAir<.4);assert.ok(s.stats.longestJump>8&&s.stats.longestJump<9);
 assert.equal(s.player.airOrigin,null);assert.equal(s.player.airDistance,0);
 assert.equal(s.events.filter(e=>e.type==='land'&&e.surface==='rail').length,1);
 const stats={...s.stats};for(let i=0;i<60;i++)stepMall(s,{forward:true,grind:true});
 assert.equal(s.stats.longestAir,stats.longestAir);assert.equal(s.stats.longestJump,stats.longestJump);
 let raw=null;const storage={getItem:()=>raw,setItem:(k,v)=>{raw=v;}};recordRun(readProgress(storage),s,storage);
 assert.equal(readProgress(storage).mall.career.longestJump,stats.longestJump);assert.equal(readProgress(storage).mall.records.length,0);
});

test('riding off a rail starts a fresh measured fall and cannot include the approach or grind distance',()=>{
 const s=catchRail();for(let i=0;i<90;i++)stepMall(s,{forward:true,grind:true,touchAssist:true});
 const exit={x:s.player.x,z:s.player.z,y:s.player.y},tick=s.tick;stepMall(s,{});
 assert.deepEqual(s.player.airOrigin,exit);assert.equal(s.player.jumpedAt,tick+1);assert.ok(s.player.airDistance<.5);assert.equal(s.player.rail,null);
 assert.equal(s.player.airMove,null);assert.equal(s.player.spinMove,null);assert.equal(s.player.visualSpin,0);
 let distance=s.player.airDistance,airTicks=0;
 while(!s.player.grounded&&airTicks++<120){const x=s.player.x,z=s.player.z;stepMall(s);distance+=Math.hypot(s.player.x-x,s.player.z-z);}
 assert.ok(s.player.grounded);assert.ok(Math.abs(s.stats.longestJump-distance)<1e-8,'distance is only the flight from this exit');
 assert.equal(s.player.airOrigin,null);assert.equal(s.player.airDistance,0);
});

test('a gap can finish on a rail and scores once at the actual catch',()=>{
 const s=flat();s.world.gaps=[{id:'rail-gap',name:'RAIL GAP',axis:'z',line:0,cross:'x',min:-3,max:3,width:4,points:1000}];s.world.rails=[{id:'catch',x:0,z:-3,bx:0,bz:-60,y:1}];
 Object.assign(s.player,{x:0,z:8,y:0,yaw:0,speed:25});stepMall(s,{jump:true,grind:true,forward:true});
 for(let i=0;i<120&&!s.player.rail;i++)stepMall(s,{forward:true,grind:true});
 assert.equal(s.player.rail,'catch');assert.deepEqual(s.gaps,['rail-gap']);assert.equal(s.combo.seen['RAIL GAP'],1);
 for(let i=0;i<20;i++)stepMall(s,{forward:true,grind:true});assert.equal(s.combo.seen['RAIL GAP'],1);
 stepMall(s);while(!s.player.grounded)stepMall(s);assert.equal(s.combo.seen['RAIL GAP'],1,'the later floor landing cannot repeat the earlier gap');
});

test('bailing discards an unfinished flight without recording it or retaining trick state',()=>{
 const s=flat();stepMall(s,{jump:true,forward:true});for(let i=0;i<20;i++)stepMall(s,{forward:true});
 assert.ok(s.player.airDistance>0);bail(s);
 assert.equal(s.player.airOrigin,null);assert.equal(s.player.airDistance,0);assert.equal(s.player.airMove,null);
 for(let i=0;i<50;i++)stepMall(s);assert.equal(s.stats.longestAir,undefined);assert.equal(s.stats.longestJump,undefined);
});

test('contact sound follows wheels, manuals and rails, and stops in air, on a bail or at the result',()=>{
 const s=flat();s.player.speed=20;let sound=skateSoundState(s);assert.ok(sound.roll>0);assert.equal(sound.grind,0);
 const rolling=sound.roll;s.player.manual=true;assert.ok(skateSoundState(s).roll<rolling);
 s.player.grounded=false;sound=skateSoundState(s);assert.equal(sound.roll,0);assert.equal(sound.grind,0);
 s.player.rail='line';sound=skateSoundState(s);assert.equal(sound.roll,0);assert.ok(sound.grind>0);
 s.player.bail=42;assert.equal(skateSoundState(s).grind,0);s.player.bail=0;s.phase='finished';assert.equal(skateSoundState(s).grind,0);
 s.phase='playing';s.player.rail=null;s.player.grounded=true;s.player.speed=0;assert.equal(skateSoundState(s).roll,0);
});

test('faster skating changes contact tone and level within fixed limits',()=>{
 const s=flat();s.player.speed=5;const slow=skateSoundState(s);s.player.speed=25;const fast=skateSoundState(s);
 assert.ok(fast.roll>slow.roll);assert.ok(fast.rollHz>slow.rollHz);assert.ok(fast.grindHz>slow.grindHz);
 s.player.speed=1000;const capped=skateSoundState(s);assert.ok(capped.roll<=.1);assert.ok(capped.rollHz<=895);s.player.rail='line';assert.ok(skateSoundState(s).grind<=.14);
});
