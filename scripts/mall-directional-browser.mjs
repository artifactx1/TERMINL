import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {SKATERS} from '../lib/arcade/after-hours/mall-world.mjs';
import {planRailLine} from './mall-rail-lines.mjs';
const browser=await chromium.launch({headless:true}),errors=[],report=[];
const base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4005';
await mkdir('artifacts/mall-directional',{recursive:true});
try{
 const chosen=process.argv.find(a=>a.startsWith('--skater='))?.split('=')[1];
 for(const width of (process.argv.includes('--small')?[375]:[1280,375]))for(const skater of SKATERS.filter(s=>!chosen||s.id===chosen)){
  const plan=planRailLine({releaseFrames:3,character:skater.id});
  const context=await browser.newContext({viewport:{width,height:width===375?667:850},isMobile:width===375,hasTouch:width===375}),page=await context.newPage();
  page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{Date.now=()=>123;});
  await page.goto(base+'/os/mall-rat',{waitUntil:'domcontentloaded',timeout:90000});await page.getByRole('button',{name:skater.name,exact:true}).click();await page.getByLabel('Free skate / no timer').check();
  await page.evaluate(()=>{
   let now=performance.now(),id=0;const queue=new Map(),held={};performance.now=()=>now;window.requestAnimationFrame=f=>{queue.set(++id,f);return id;};window.cancelAnimationFrame=id=>queue.delete(id);
   window.poseKeys=input=>{for(const[name,code]of Object.entries({forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',jump:'Space',grab:'KeyK',spin:'KeyU',turn:'KeyC',grind:'KeyL',flip:'KeyJ'})){if(!!input[name]!==!!held[name])window.dispatchEvent(new KeyboardEvent(input[name]?'keydown':'keyup',{code,key:code==='Space'?' ':code.slice(3).toLowerCase(),bubbles:true}));held[name]=!!input[name];}};
   window.poseFrame=()=>{now+=1000/60+.000001;const frames=[...queue.values()];queue.clear();frames.forEach(f=>f(now));};
   for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const fn=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return fn.apply(this,args);};}
  });
  const frames=(n,input={})=>page.evaluate(({n,input})=>{window.poseKeys(input);for(let i=0;i<n;i++){window.skipGpu=i<n-1;window.poseFrame();}window.skipGpu=false;},{n,input});
  const data=()=>page.locator('canvas').evaluate(c=>({...c.dataset}));
  const captures=[];
  const capture=async name=>{const d=await data();assert.match(d.skateAtlas,new RegExp(skater.art+'-directional-atlas-v4'));assert.ok(Math.abs(Number(d.bodyYaw)-Number(d.boardYaw))<.002);const path=`artifacts/mall-directional/${skater.id}-${name}-${width}.png`;await page.screenshot({path});captures.push({name,path,action:d.skateAction,tick:d.tick});return d;};
  await page.getByRole('button',{name:'BREAK IN →'}).click();await page.waitForTimeout(1000);await frames(2);
  await frames(12,{forward:true});await frames(1,{turn:true});await frames(20,{forward:true});
  assert.equal((await capture('fakie')).skateAction,'front-coast');
  await frames(1,{jump:true});await frames(10,{jump:true});assert.equal((await capture('ollie')).skateAction,'front-air');
  await frames(1,{grab:true,jump:true});await frames(7,{jump:true});assert.equal((await capture('grab')).skateAction,'front-grab');
  const until=async(action,n,input={})=>{
   const found=await page.evaluate(({action,n,input})=>{window.poseKeys(input);window.skipGpu=true;let found=false;for(let i=0;i<n;i++){window.poseFrame();if(document.querySelector('canvas').dataset.skateAction===action){found=true;break;}}window.skipGpu=false;return found;},{action,n,input});
   await frames(1,input);return found;
  };
  assert.ok(await until('front-crouch',100),'fakie landing compresses');await capture('landing');
  // The entry ramp can launch the rider again after the first touchdown.
  await frames(18,{back:true});assert.ok(await until('front-coast',180,{back:true}),'landing pose clears once rolling');
  await frames(12,{forward:true});
  // A half-turn grab exposes a side pose using only normal controls.
  await frames(1,{jump:true});await frames(12,{jump:true,grab:true,right:true});assert.match((await capture('side-grab')).skateAction,/^(left|right)-grab$/);
  await page.keyboard.press('r');await page.waitForTimeout(100);await frames(2);
  const inputs=plan.inputs.slice(0,plan.catches[0].frame);
  for(let i=0;i<inputs.length;i+=120)await page.evaluate(batch=>{batch.forEach((input,j)=>{window.skipGpu=j<batch.length-1;window.poseKeys(input);window.poseFrame();});window.skipGpu=false;},inputs.slice(i,i+120));
  assert.equal((await data()).rail,'diamond-1');await frames(26,{forward:true,grind:true});await frames(1,{forward:true,grind:true,flip:true});await frames(26,{forward:true,grind:true});
  const grind=await capture('boardslide');assert.equal(grind.rail,'diamond-1');assert.match(grind.skateAction,/^(left|right)-grind$/);
  await frames(150);const released=await data();assert.equal(released.rail,'');assert.equal(released.manual,'false');assert.doesNotMatch(released.skateAction,/grind/);assert.ok(Number(released.score)>0);
  report.push({skater:skater.name,width,captures});console.log('PASS directional coast, ollie, grab, landing, side grab, boardslide and release',skater.id,width);await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile('artifacts/mall-directional/report.json',JSON.stringify(report,null,2));
}finally{await browser.close();}
