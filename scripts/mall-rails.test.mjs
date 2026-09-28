import test from 'node:test';
import assert from 'node:assert/strict';
import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {bank,bail} from '../lib/arcade/after-hours/mall-score.mjs';
import {readProgress,recordRun} from '../lib/arcade/after-hours/progress.mjs';
import {planRailLine} from './mall-rail-lines.mjs';

for(const releaseFrames of [0,3,7])test(`three-rail line is reachable from spawn with ${releaseFrames} release frames`,()=>{
 const {state:s,catches}=planRailLine({releaseFrames});
 assert.deepEqual(catches.map(c=>c.rail),['diamond-1','diamond-2','diamond-1']);
 assert.deepEqual(catches.map(c=>c.chain),[1,2,3]);assert.equal(s.stats.railTransfers,2);assert.equal(s.stats.longestRailChain,3);
 assert.equal(s.combo.seen['RAIL TRANSFER'],2);assert.equal(s.player.vy,0);
 assert.ok(Math.abs(Math.sin(s.player.yaw))<1e-9,'catch immediately aligns travel with the rail');
});
function caught(){const s=createMall({practice:true});s.world.props=[];s.world.solids=[];s.world.floors=[];s.world.rails=[{id:'line',x:0,z:100,bx:0,bz:-100,y:1}];Object.assign(s.player,{x:0,z:60,y:1,yaw:0,speed:25,grounded:false,rail:'line',railChain:1,rampSlope:1});return s;}
test('rail release is immediate; a late jump cannot revive the old grind',()=>{
 const s=caught();stepMall(s,{forward:true});assert.equal(s.player.rail,null);assert.ok(s.player.railExit);
 for(let i=0;i<10;i++)stepMall(s,{forward:true});const y=s.player.y;stepMall(s,{forward:true,jump:true,right:true});
 assert.ok(s.player.y<=y);assert.equal(s.player.railOrigin,undefined);assert.equal(s.player.rail,null);
});
test('rail pop does not inherit stale ramp lift or give transfer credit for the same rail',()=>{
 const s=caught();stepMall(s,{forward:true,grind:true,jump:true});assert.ok(s.player.vy<13.5&&s.player.vy>13);
 for(let i=0;i<160&&!s.player.rail;i++)stepMall(s,{forward:true,grind:true});
 assert.equal(s.player.rail,'line');assert.equal(s.stats.railTransfers||0,0);assert.equal(s.player.railChain,1);
});
test('banking and bailing break a transfer chain; personal chain records survive reload',()=>{
 const {state:s}=planRailLine();bank(s);assert.equal(s.player.railChain,1);assert.equal(s.player.railOrigin,null);
 stepMall(s,{jump:true,right:true,grind:true});bail(s);assert.equal(s.player.railOrigin,null);assert.equal(s.player.railExit,null);assert.equal(s.player.railChain,0);
 s.practice=false;s.phase='finished';let value='';const storage={getItem:()=>value,setItem:(k,v)=>{value=v;}};recordRun(readProgress(storage),s,storage);
 const saved=readProgress(storage);assert.equal(saved.mall.bests.longestRailChain,3);assert.equal(saved.mall.records[0].railTransfers,2);
});
