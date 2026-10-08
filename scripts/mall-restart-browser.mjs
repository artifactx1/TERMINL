import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import sharp from 'sharp';
import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {drive} from './mall-lines-pilot.mjs';
const baseline=process.argv.includes('--baseline'),base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4005';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];
const planner=createMall({practice:true}),probe=createMall({practice:true});
for(let i=0;i<3;i++){stepMall(planner);stepMall(probe);}
const damagePlan=drive(planner,[[-19,-1]]),damageInputs=[];
for(const input of damagePlan){stepMall(probe,input);damageInputs.push(input);if(probe.events.some(e=>e.type==='smash'))break;}
assert.ok(probe.damage>0,'input route must actually smash scenery');
page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
try{
 await mkdir('artifacts/mall-restart',{recursive:true});
 await page.addInitScript(()=>{
  window.gpuAudit={contexts:0,textures:0,deletedTextures:0,programs:0,deletedPrograms:0};
  const getContext=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2'&&this.getAttribute('aria-label')?.startsWith('Mall Rat'))window.gpuAudit.contexts++;return getContext.call(this,type,...args);};
  for(const [method,key]of Object.entries({createTexture:'textures',deleteTexture:'deletedTextures',createProgram:'programs',deleteProgram:'deletedPrograms'})){
   const original=WebGL2RenderingContext.prototype[method];WebGL2RenderingContext.prototype[method]=function(...args){window.gpuAudit[key]++;return original.apply(this,args);};
  }
 });
 await page.goto(base+'/os/mall-rat',{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.mode==='menu');
 await page.getByLabel('Free skate / no timer').check();
 await page.evaluate(()=>{
  let now=performance.now(),id=0;const queue=new Map();performance.now=()=>now;
  window.requestAnimationFrame=f=>{queue.set(++id,f);return id;};window.cancelAnimationFrame=id=>queue.delete(id);
  window.restartFrames=n=>{for(let i=0;i<n;i++){window.skipGpu=window.batchReplay||i<n-1;now+=1000/60+.000001;const callbacks=[...queue.values()];queue.clear();callbacks.forEach(f=>f(now));}window.skipGpu=false;};
  for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return original.apply(this,args);};}
 });
 const frames=n=>page.evaluate(n=>window.restartFrames(n),n);
 const snapshot=()=>page.evaluate(()=>({gpu:{...window.gpuAudit},game:{...document.querySelector('canvas').dataset}}));
 const menu=await snapshot();await page.getByRole('button',{name:'BREAK IN →'}).click();await page.waitForTimeout(600);await frames(3);
 const warm=await snapshot(),restarts=[];
 await page.evaluate(()=>document.fonts.ready);const initial=await page.screenshot();
 for(let i=0;i<(baseline?2:8);i++){
  if(!baseline&&i===7){
   await page.evaluate(inputs=>{
    const held={},keys={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD'};
    inputs.forEach((input,i)=>{for(const [name,code]of Object.entries(keys)){if(!!input[name]!==!!held[name])window.dispatchEvent(new KeyboardEvent(input[name]?'keydown':'keyup',{code,bubbles:true}));held[name]=!!input[name];}window.batchReplay=i<inputs.length-1;window.restartFrames(1);});
    for(const [name,code]of Object.entries(keys))if(held[name])window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));window.batchReplay=false;
   },damageInputs);
   await page.screenshot({path:'artifacts/mall-restart/smashed-before-retry.png'});
  }else{
   await page.keyboard.down('w');await frames(100);await page.keyboard.down('Space');await frames(5);await page.keyboard.up('Space');await page.keyboard.up('w');
  }
  const beforeRestart=await snapshot();
  const started=performance.now();await page.keyboard.press('r');await page.waitForTimeout(80);await frames(3);
  const next=await snapshot();restarts.push({ms:Math.round(performance.now()-started),...next});
  assert.ok(Number(next.game.tick)<10);assert.equal(next.game.combo,'0');assert.equal(next.game.score,'0');assert.equal(next.game.rail,'');assert.equal(next.game.manual,'false');
  assert.equal(next.game.x,warm.game.x);assert.equal(next.game.z,warm.game.z);assert.equal(next.game.speed,'0.00');
  if(!baseline){assert.equal(next.gpu.contexts,warm.gpu.contexts,'restart reuses the renderer');assert.equal(next.gpu.programs,beforeRestart.gpu.programs,'restart reuses shaders');assert.equal(next.gpu.textures,beforeRestart.gpu.textures,'restart reuses textures');}
 }
 if(!baseline){assert.equal(menu.gpu.contexts,warm.gpu.contexts,'first run reuses menu renderer');assert.deepEqual(errors,[]);}
 const final=await page.screenshot({path:`artifacts/mall-restart/${baseline?'before':'after'}.png`});
 if(!baseline){
  const region={left:0,top:300,width:1280,height:400};
  const [a,b]=await Promise.all([sharp(initial).extract(region).removeAlpha().raw().toBuffer(),sharp(final).extract(region).removeAlpha().raw().toBuffer()]);
  let changed=0;for(let i=0;i<a.length;i+=3)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>30)changed++;
  assert.ok(changed/(1280*400)<.01,`spawn scene restores props, camera and effects (${changed} changed pixels)`);
  await page.getByRole('button',{name:'PAUSE / HELP'}).click();await page.getByRole('button',{name:'SKATER SELECT',exact:true}).click();
  await page.getByRole('button',{name:'DIAMOND HANDS GLORP',exact:true}).click();await page.getByRole('button',{name:'BREAK IN →'}).click();await page.waitForTimeout(600);await frames(3);
  const changedSkater=await snapshot();assert.equal(changedSkater.gpu.contexts,warm.gpu.contexts+1,'changing skaters rebuilds their assets');
  await page.screenshot({path:'artifacts/mall-restart/changed-skater.png'});
  await page.getByRole('button',{name:'PAUSE / HELP'}).click();await page.getByRole('button',{name:'SKATER SELECT',exact:true}).click();
  await page.getByLabel('Graphics').selectOption('low');await page.getByRole('button',{name:'BREAK IN →'}).click();await page.waitForTimeout(100);await frames(3);
  const low=await snapshot();assert.equal(low.gpu.contexts,changedSkater.gpu.contexts+1);
  assert.ok(await page.locator('canvas').evaluate(c=>c.width/c.getBoundingClientRect().width<.66),'quality changes take effect');
  await page.keyboard.press('r');await page.waitForTimeout(80);await frames(3);assert.equal((await snapshot()).gpu.contexts,low.gpu.contexts,'low quality also reuses renderer');
  await page.locator('header a').click();await page.waitForURL('**/os');
  await page.waitForFunction(before=>window.gpuAudit.deletedPrograms>before,low.gpu.deletedPrograms,{polling:50});
  const disposed=await page.evaluate(()=>window.gpuAudit);assert.ok(disposed.deletedPrograms>low.gpu.deletedPrograms,'leaving the game disposes cached shaders');
  await page.goto(base+'/os/rug-exe',{waitUntil:'domcontentloaded',timeout:90000});
  await page.getByRole('button',{name:'ENTER THE PROTOCOL →'}).click();
  await page.keyboard.down('f');await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.shots)>0);await page.keyboard.up('f');
  await page.keyboard.press('r');await page.waitForFunction(()=>{const d=document.querySelector('canvas')?.dataset;return d?.mode==='playing'&&d.shots==='0'&&Number(d.tick)<30;});
  assert.deepEqual(errors,[]);console.log('PASS repeated retries, visual reset, skater/quality changes and route disposal');
  console.log('PASS shared RUG.EXE start, firing and retry');
 }
 console.log(JSON.stringify({menu:menu.gpu,warm:warm.gpu,restarts:restarts.map(r=>({ms:r.ms,gpu:r.gpu}))},null,2));
}finally{await browser.close();}
