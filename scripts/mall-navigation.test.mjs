import test from 'node:test';
import assert from 'node:assert/strict';
import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {parkRoute,routeCue,challengeProgress} from '../lib/arcade/after-hours/mall-navigation.mjs';
import {floorAt,inside} from '../lib/arcade/after-hours/math.mjs';

import {followParkRoute} from './mall-navigation-pilot.mjs';

test('every district guide is skateable from spawn without a bail, including roof and basement access',()=>{
 for(const zone of createMall().world.zones){
  const {state,path,arrived}=followParkRoute(zone.id);
  assert.ok(path.length>0,zone.id);assert.ok(arrived,`${zone.id}: reach destination at its actual elevation`);assert.equal(state.stats.rekt,0,zone.id);
  // Check the rendered route itself, between simplified corners, not only the pilot.
  for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i],length=Math.hypot(b.x-a.x,b.z-a.z);
   for(let d=0;d<=length;d+=.4){
    const x=a.x+(b.x-a.x)*d/length,z=a.z+(b.z-a.z)*d/length,y=floorAt(state.world,x,z);
    assert.ok(!state.world.solids.some(w=>inside({x,z},w,.7)&&y<(w.y||0)+w.h&&y+2>(w.y||0)),`${zone.id}: route crosses a wall`);
   }
  }
 }
});
test('guide turns match steering direction and the route advances toward the destination',()=>{
 const zone={x:40,z:-20,y:0},path=[{x:0,z:0,y:0},{x:0,z:-20,y:0},{x:40,z:-20,y:0}];
 const a=routeCue({x:0,z:0,y:0,yaw:0},path,zone),b=routeCue({x:0,z:-20,y:0,yaw:0},path,zone);
 assert.equal(a.angle,0);assert.equal(a.distance,60);assert.equal(b.angle,Math.PI/2);assert.equal(b.distance,40);
 assert.equal(routeCue({x:0,z:-20,y:0,yaw:Math.PI},path,zone).angle,-Math.PI/2);
 assert.ok(routeCue({x:25,z:-20,y:0,yaw:Math.PI/2},path,zone).distance<b.distance);
 assert.equal(routeCue({x:40,z:-20,y:0,yaw:0},path,zone).arrived,true);
 assert.equal(routeCue({x:40,z:-20,y:12,yaw:0},path,zone).arrived,false,'passing above destination does not count as arriving');
 assert.ok(routeCue({x:20,z:0,y:0,yaw:0},path,zone).offPath>12);
});
test('goal progress reflects awarded completion, and the guide does not award progress itself',()=>{
 const s=createMall({practice:true,seed:123});s.challengeIds=['roof','service','bag'];
 const before=JSON.stringify({score:s.score,completed:s.completed,challengeTimes:s.challengeTimes});parkRoute(s.world,s.player,'roof');
 assert.equal(JSON.stringify({score:s.score,completed:s.completed,challengeTimes:s.challengeTimes}),before);
 assert.equal(challengeProgress(s,'bag'),'0 / 3 ZONES / FIND THE BAG');
 const {state}=followParkRoute('service');
 assert.ok(state.completed.service); // Physical entry drives the objective.
 state.challengeIds=['service'];stepMall(state);assert.equal(challengeProgress(state,'service'),'COMPLETE / +2,500');
 const score=state.score;stepMall(state);assert.equal(state.score,score,'opening/rendering progress never awards twice');
 assert.deepEqual(parkRoute(s.world,s.player,'missing'),[]);
});
