import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {mallCameraFrame} from '../lib/arcade/after-hours/mall-camera.mjs';
import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {floorAt,surfaceHeight} from '../lib/arcade/after-hours/math.mjs';
import {planLines} from './mall-lines-pilot.mjs';
import {planTour} from './mall-course-tour.mjs';

const plans=[...planLines(),{id:'district-tour',inputs:planTour().segments.flatMap(s=>s.inputs)}];
for(const aspect of [1280/850,390/800,844/354]){
 test(`full rider stays framed throughout real park lines at aspect ${aspect.toFixed(2)}`,()=>{
  for(const plan of plans){
   const s=createMall({practice:true,seed:123});stepMall(s);stepMall(s);
   const camera=new PerspectiveCamera(62,aspect,.1,260),probe=new Vector3();let previous;
   for(const input of plan.inputs){
    stepMall(s,input);const p=s.player,f=mallCameraFrame(s,previous,aspect);previous=f;
    camera.position.set(f.x,f.y,f.z);camera.lookAt(f.lookX,f.lookY,f.lookZ);camera.fov=f.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    probe.set(p.x,p.y+3.4,p.z).project(camera);assert.ok(Math.abs(probe.x)<.85&&Math.abs(probe.y)<.85,`${plan.id} head clipped at ${s.tick}`);
    probe.set(p.x,p.y,p.z).project(camera);assert.ok(Math.abs(probe.y)<.85,`${plan.id} deck clipped at ${s.tick}`);
    if(plan.id==='district-tour'&&s.zone==='LIQUIDITY BOWL'){
     assert.ok(Math.hypot(f.x-p.x,f.z-p.z)>8,'bowl keeps a readable chase distance');
     for(let t=.05;t<1;t+=.05){const x=f.x+(p.x-f.x)*t,z=f.z+(p.z-f.z)*t,y=f.y+(p.y+.4-f.y)*t;assert.ok(y>=floorAt(s.world,x,z)+.02,'terrain does not hide the deck on bowl entry');}
    }
    assert.ok(f.y-floorAt(s.world,f.x,f.z)>=.69,`${plan.id} lens beneath course at ${s.tick}`);
    assert.ok(Math.abs((f.x-p.x)*Math.cos(p.yaw)+(f.z-p.z)*Math.sin(p.yaw))<1e-7,'camera shares the travel heading');
   }
  }
 });
}
test('camera pose is stable across duplicate render ticks and clears a close wall',()=>{
 const s=createMall({practice:true});Object.assign(s.player,{x:0,z:0,y:0,yaw:0,speed:25});s.world.solids=[{x:0,z:6,w:8,d:1,y:0,h:8}];s.world.floors=[];
 const frame=mallCameraFrame(s,null,1);assert.ok(frame.z<5.2);assert.ok(frame.z>0);
 assert.deepEqual(mallCameraFrame(s,frame,1),frame);
});


test('bowl has smooth coping and a flat pocket without abrupt terrain drops',()=>{
 const bowl=createMall().world.floors.find(f=>f.bowl);
 assert.equal(surfaceHeight(bowl,bowl.x,bowl.z),-7.5);
 assert.equal(surfaceHeight(bowl,bowl.x+10,bowl.z),-7.5);
 assert.equal(surfaceHeight(bowl,bowl.x+30,bowl.z),0);
 let previous=surfaceHeight(bowl,bowl.x,bowl.z);
 for(let radius=.1;radius<=31;radius+=.1){const y=surfaceHeight(bowl,bowl.x+radius,bowl.z);assert.ok(y>=previous-1e-9);assert.ok((y-previous)/.1<.59,'transition slope is skateable');previous=y;}
 assert.ok(Math.abs(surfaceHeight(bowl,bowl.x+29.9,bowl.z))<.001,'coping approaches the deck smoothly');
});
