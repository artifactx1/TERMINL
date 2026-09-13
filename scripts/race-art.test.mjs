import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {drawRaceWheels,WHEEL_RIG} from '../lib/arcade/race-wheels.js';
import {drawPerspectiveRace,playerCarFrame} from '../lib/arcade/race-perspective.js';
import {createRace,CUP_TRACKS} from '../lib/arcade/race-sim.mjs';
import {drawRace} from '../lib/arcade/race-render.js';
function context(){const calls=[];let depth=0;const ctx=new Proxy({},{get:(_,key)=>{if(key==='createLinearGradient')return (...args)=>{calls.push([key,...args]);return {addColorStop(){}};};return (...args)=>{if(key==='save')depth++;if(key==='restore')depth--;for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${key} received ${value}`);calls.push([key,...args]);};},set:()=>true});return {ctx,calls,depth:()=>depth};}
test('all six course renderers and rival maps are finite, balanced and read-only on mobile',()=>{
  for(const track of CUP_TRACKS)for(const [width,height]of [[390,452],[568,104],[1000,600]])for(const slot of [0,1]){
    const state=createRace({track}),before=JSON.stringify(state),c=context();
    drawRace(c.ctx,state,{width,height,slot});assert.equal(JSON.stringify(state),before);assert.equal(c.depth(),0);
    assert.ok(c.calls.some(([fn,value])=>fn==='fillText'&&value==='▲ RIVAL'));
  }
});
test('wheels are separate, continuous, rotation-driven and balanced canvas rigs',()=>{
  const draw=options=>{const c=context();drawRaceWheels(c.ctx,{x:400,y:400,width:300,height:220,...options});assert.equal(c.depth(),0);return JSON.stringify(c.calls);};
  assert.equal(draw({rotation:0}),draw({rotation:0}));assert.notEqual(draw({rotation:0}),draw({rotation:1}));assert.notEqual(draw({steer:.25}),draw({steer:.26}));assert.ok(WHEEL_RIG.rear.x<.37);assert.equal(WHEEL_RIG.rear.y,0,'Rear tire contact equals the road anchor');
  assert.equal(draw({front:false,steer:-1}),draw({front:false,steer:1}),'Rear wheels must never steer');
});
test('player body anchor/scale is independent of speed, acceleration, camera lag and boost',()=>{
  assert.deepEqual(playerCarFrame(1000,600),playerCarFrame(1000,600));assert.equal(playerCarFrame(1000,600).y,522);
  const s=createRace(),before=JSON.stringify(s),c=context();drawPerspectiveRace(c.ctx,s,{width:1000,height:600,slot:0});assert.equal(JSON.stringify(s),before);assert.equal(c.depth(),0);
});
test('runtime Pepe body and scenery atlases have real transparent alpha, not baked checkerboards',async()=>{
  for(const name of ['california-pepe-bodies-v1.png','california-scenery-v1.png']){const p=`public/arcade/${name}`,m=await sharp(p).metadata(),stats=await sharp(p).stats();assert.equal(m.hasAlpha,true);assert.equal(stats.channels[3].min,0);assert.ok(stats.channels[3].max>240);assert.equal(m.width,1536);assert.equal(m.height,1024);}
});
