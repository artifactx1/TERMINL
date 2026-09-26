import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {planLines} from './mall-lines-pilot.mjs';
import {planTour} from './mall-course-tour.mjs';
import {mallCameraFrame} from '../lib/arcade/after-hours/mall-camera.mjs';
import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {floorAt} from '../lib/arcade/after-hours/math.mjs';
const plans=planLines().filter(p=>['ath','canal','snake'].includes(p.id));
for(const plan of plans){const s=createMall({practice:true,seed:123});stepMall(s);stepMall(s);let peak=0;plan.peak=0;plan.inputs.forEach((input,i)=>{stepMall(s,input);const air=s.player.y-floorAt(s.world,s.player.x,s.player.z);if(air>peak){peak=air;plan.peak=i;}});}
const tour=planTour().segments.slice(0,3),bowl={id:'bowl',inputs:tour.flatMap(s=>s.inputs),x:tour.at(-1).x,z:tour.at(-1).z};
{const s=createMall({practice:true,seed:123});stepMall(s);stepMall(s);let previous,closest=Infinity;bowl.peak=0;bowl.inputs.forEach((input,i)=>{stepMall(s,input);const f=mallCameraFrame(s,previous);previous=f;const bankDistance=Math.abs(s.player.y+3.75);if(s.zone==='LIQUIDITY BOWL'&&bankDistance<closest){closest=bankDistance;bowl.peak=i;}});}
if(process.argv.includes('--bowl-only'))plans.length=0;plans.push(bowl);
const base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4005';
const browser=await chromium.launch({headless:true}),errors=[];
await mkdir('artifacts/mall-camera',{recursive:true});
try{
 for(const viewport of [{width:1280,height:850},{width:390,height:844},{width:844,height:390}]){
  for(const plan of plans){
   const page=await browser.newPage({viewport,isMobile:viewport.width!==1280,hasTouch:viewport.width!==1280});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{Date.now=()=>123;});
   await page.goto(base+'/os/mall-rat',{waitUntil:'domcontentloaded',timeout:90000});await page.getByLabel('Free skate / no timer').check();
   await page.evaluate(()=>{
    let now=performance.now(),id=0;const frames=new Map(),held={};performance.now=()=>now;
    window.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};window.cancelAnimationFrame=id=>frames.delete(id);
    window.cameraSamples={frames:0,clipped:0,buried:0,head:-99,feet:99};
    window.driveCamera=input=>{
     for(const [name,code]of Object.entries({forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD'})){if(!!input[name]!==!!held[name])window.dispatchEvent(new KeyboardEvent(input[name]?'keydown':'keyup',{code,key:code.slice(3).toLowerCase(),bubbles:true}));held[name]=!!input[name];}
     now+=1000/60+.000001;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));
     const d=document.querySelector('canvas').dataset,s=window.cameraSamples,h=Number(d.cameraHeadY),f=Number(d.cameraFeetY);s.frames++;s.head=Math.max(s.head,h);s.feet=Math.min(s.feet,f);if(Math.abs(h)>.85||Math.abs(f)>.85)s.clipped++;if(Number(d.cameraClearance)<.69)s.buried++;
    };
    for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const fn=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return fn.apply(this,args);};}
   });
   await page.getByRole('button',{name:'BREAK IN →'}).click();await page.waitForTimeout(900);await page.evaluate(()=>{window.driveCamera({});window.driveCamera({});});
   const drive=async(inputs)=>{for(let i=0;i<inputs.length;i+=120)await page.evaluate(batch=>{batch.forEach((input,j)=>{window.skipGpu=j<batch.length-1;window.driveCamera(input);});window.skipGpu=false;},inputs.slice(i,i+120));};
   await drive(plan.inputs.slice(0,plan.peak+1));await page.screenshot({path:`artifacts/mall-camera/${plan.id}-peak-${viewport.width}.png`});
   await drive(plan.inputs.slice(plan.peak+1));
   const data=await page.locator('canvas').evaluate(c=>({...c.dataset}));assert.ok(Math.hypot(Number(data.x)-plan.x,Number(data.z)-plan.z)<.2,'ordinary input replay stayed on route');
   const samples=await page.evaluate(()=>window.cameraSamples);assert.equal(samples.clipped,0);assert.equal(samples.buried,0);assert.ok(samples.frames>100);assert.ok(Number.isFinite(samples.head));
   if(plan.id==='bowl')assert.equal(data.zone,'LIQUIDITY BOWL');else{const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('terminl:after-hours:v1')).mall);assert.ok(saved.gaps.includes(plan.id));}
   console.log('PASS camera, landing and gap',viewport.width,plan.id,JSON.stringify(samples));await page.close();
  }
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
