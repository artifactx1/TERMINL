import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const plans=JSON.parse(await readFile(process.env.AFTER_HOURS_PLANS||'/tmp/terminl-rug-plans.json','utf8'));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];
const base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4000';
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
async function clock(){await page.evaluate(()=>{let now=performance.now(),id=0;const q=new Map();performance.now=()=>now;window.requestAnimationFrame=fn=>{q.set(++id,fn);return id;};window.cancelAnimationFrame=id=>q.delete(id);window.advance=(delta=1000/60+.000001)=>{now+=delta;const callbacks=[...q.values()];q.clear();callbacks.forEach(fn=>fn(now));};window.held={};window.controls=input=>{const map={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',jump:'Space',flip:'KeyJ',grab:'KeyK',grind:'KeyL',manual:'KeyM',bank:'KeyB',fire:'KeyF',dash:'ShiftLeft',interact:'KeyE'};for(const [action,code]of Object.entries(map))if(!!input[action]!==!!window.held[action])window.dispatchEvent(new KeyboardEvent(input[action]?'keydown':'keyup',{key:code==='Space'?' ':code.startsWith('Key')?code.slice(3).toLowerCase():code,code,bubbles:true,cancelable:true}));window.held={...input};if(input.weapon!==undefined)window.dispatchEvent(new KeyboardEvent('keydown',{code:`Digit${input.weapon+1}`,key:String(input.weapon+1),bubbles:true}));if(input.lookX||input.lookY){const c=document.querySelector('canvas');c.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',clientX:0,clientY:0,bubbles:true}));window.dispatchEvent(new PointerEvent('pointermove',{clientX:input.lookX||0,clientY:input.lookY||0,bubbles:true}));window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));}};for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return original.apply(this,args);};}});}
async function advance(count,input,delta){await page.evaluate(({count,input,delta})=>{window.controls(input);for(let i=0;i<count;i++){window.skipGpu=i<count-1;window.advance(delta);}window.skipGpu=false;},{count,input,delta});}
try{
 await mkdir('artifacts/after-hours',{recursive:true});
 await page.goto(base+'/os');await page.getByRole('link',{name:'Play MALL RAT',exact:true}).waitFor();await page.getByRole('link',{name:'Play RUG.EXE',exact:true}).waitFor();
 await page.goto(base+'/os/mall-rat');await page.getByRole('button',{name:'BREAK IN →'}).waitFor();await clock();await page.getByRole('button',{name:'BREAK IN →'}).click();
 await advance(30,{forward:true});await advance(1,{forward:true,jump:true});await advance(12,{forward:true,flip:true});await advance(75,{forward:true,manual:true});assert.ok(Number(await page.locator('canvas').getAttribute('data-combo'))>0);
 await advance(1,{bank:true});for(let i=0;i<18&&Number(await page.locator('canvas').getAttribute('data-score'))===0;i++)await advance(10,{});assert.ok(Number(await page.locator('canvas').getAttribute('data-score'))>0);await page.screenshot({path:'artifacts/after-hours/mall-combo.png'});
 await page.getByRole('button',{name:'PAUSE / HELP'}).click();const pausedTick=await page.locator('canvas').getAttribute('data-tick');await advance(10,{});assert.equal(await page.locator('canvas').getAttribute('data-tick'),pausedTick);await page.getByRole('button',{name:'BACK TO IT →'}).click();
 for(let batch=0;batch<16;batch++)await advance(100,{},100);await advance(8,{});assert.equal(await page.locator('canvas').getAttribute('data-phase'),'finished');await page.getByRole('heading',{name:'ONE MORE LINE?'}).waitFor();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('terminl:after-hours:v1')));assert.equal(saved.mall.records.length,1);assert.ok(saved.mall.ghost.length>1000);await page.screenshot({path:'artifacts/after-hours/mall-result.png'});console.log('PASS Mall Rat combo, bank, pause, full timer, result, local record and ghost');
 await page.goto(base+'/os/rug-exe');await page.getByRole('button',{name:'ENTER THE PROTOCOL →'}).waitFor();await clock();await page.getByRole('button',{name:'ENTER THE PROTOCOL →'}).click();
 for(let level=0;level<8;level++){
  const plan=plans[level];assert.ok(plan,`Missing plan ${level}`);await page.evaluate(plan=>{window.plan=plan;window.planIndex=0;window.planTick=0;window.held={};},plan);
  for(let batch=0;batch<Math.ceil(plan.ticks/100);batch++){
   await page.evaluate(()=>{for(let i=0;i<100&&window.planTick<window.plan.ticks;i++){const next=window.plan.moves[window.planIndex];if(next?.tick===window.planTick){window.controls(next.input);window.planIndex++;}window.skipGpu=i<99;window.advance();window.planTick++;}window.skipGpu=false;});
  }
  await advance(8,{});assert.equal(await page.locator('canvas').getAttribute('data-phase'),'complete',`Level ${level}`);console.log('PASS RUG.EXE',level,'complete through real input, objective controls and exit');
  await page.screenshot({path:`artifacts/after-hours/rug-level-${level}-result.png`});if(level<7)await page.getByRole('button',{name:'NEXT SEGMENT →'}).click();
 }
 const rugSaved=await page.evaluate(()=>JSON.parse(localStorage.getItem('terminl:after-hours:v1')));assert.equal(rugSaved.rug.unlocked,7);assert.equal(rugSaved.rug.completed,true);assert.equal(rugSaved.rug.records.length,8);
 await page.goto(base+'/os/mall-rat');await page.getByRole('combobox',{name:/Board/}).selectOption('corrupt');assert.equal(await page.getByRole('combobox',{name:/Board/}).inputValue(),'corrupt');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'artifacts/after-hours/mobile-menu.png'});
 assert.deepEqual(errors,[]);console.log('PASS campaign save, cross-game cosmetic, mobile menu, no browser errors');
}finally{await browser.close();}
