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
test('hidden map removes the entire circuit overlay without changing race authority',()=>{
  const state=createRace(),before=JSON.stringify(state),c=context();
  drawRace(c.ctx,state,{width:390,height:452,showMap:false});
  assert.equal(c.calls.some(([fn,value])=>fn==='fillText'&&['LIVE CIRCUIT','▲ YOU','▲ RIVAL'].includes(value)),false);
  assert.equal(JSON.stringify(state),before);assert.equal(c.depth(),0);
});
test('player body anchor/scale is independent of speed, acceleration, camera lag and boost',()=>{
  assert.deepEqual(playerCarFrame(1000,600),playerCarFrame(1000,600));assert.equal(playerCarFrame(1000,600).y,522);
  const s=createRace(),before=JSON.stringify(s),c=context();drawPerspectiveRace(c.ctx,s,{width:1000,height:600,slot:0});assert.equal(JSON.stringify(s),before);assert.equal(c.depth(),0);
});
test('runtime Pepe body and scenery atlases have real transparent alpha, not baked checkerboards',async()=>{
  for(const name of ['california-pepe-bodies-v1.png','california-scenery-v1.png']){const p=`public/arcade/${name}`,m=await sharp(p).metadata(),stats=await sharp(p).stats();assert.equal(m.hasAlpha,true);assert.equal(stats.channels[3].min,0);assert.ok(stats.channels[3].max>240);assert.equal(m.width,1536);assert.equal(m.height,1024);}
});

test('generated vehicles use transparent, distinct showroom and rear sprites in both racing seats',async(t)=>{
  const {VEHICLES}=await import('../lib/arcade/race-sim.mjs');
  const {drawRearCar,drawGarageVehicle}=await import('../lib/arcade/race-perspective.js');
  const {VEHICLE_ART,preloadVehicleArt}=await import('../lib/arcade/race-exotics.js');
  const prior=globalThis.Image;
  globalThis.Image=class{set src(value){this.url=value;queueMicrotask(()=>this.onload());}};
  t.after(()=>{if(prior===undefined)delete globalThis.Image;else globalThis.Image=prior;});
  await preloadVehicleArt();
  const signatures=new Set();
  for(const [id,art] of Object.entries(VEHICLE_ART)){
    assert.ok(VEHICLES[id].driverId);
    const path=`public${art.src}`,metadata=await sharp(path).metadata(),stats=await sharp(path).stats();
    assert.equal(metadata.hasAlpha,true);assert.equal(stats.channels[3].min,0);assert.ok(stats.channels[3].max>240);
    for(const frame of [art.rear,art.garage]){assert.ok(frame[0]>=0&&frame[1]>=0);assert.ok(frame[0]+frame[2]<=metadata.width);assert.ok(frame[1]+frame[3]<=metadata.height);}
    const c=context();drawRearCar(c.ctx,id,{x:250,y:235,width:350,steer:.4,tick:60});assert.equal(c.depth(),0);
    const rear=c.calls.find(([fn])=>fn==='drawImage');assert.equal(rear[1].url,art.src);assert.deepEqual(rear.slice(2,6),art.rear);
    const garage=context();drawGarageVehicle(garage.ctx,id);assert.equal(garage.depth(),0);
    assert.deepEqual(garage.calls.find(([fn])=>fn==='drawImage').slice(2,6),art.garage);
    signatures.add(JSON.stringify(c.calls));
    for(const slot of [0,1]){const state=createRace({vehicles:[id,id]}),before=JSON.stringify(state),r=context();drawRace(r.ctx,state,{width:390,height:452,slot});assert.equal(r.depth(),0);assert.equal(JSON.stringify(state),before);}
  }
  assert.equal(signatures.size,4);
});
