import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {planRailLine} from './mall-rail-lines.mjs';
const browser=await chromium.launch({headless:true}),errors=[],plan=planRailLine({releaseFrames:3}),base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4005';
await mkdir('artifacts/mall-career',{recursive:true});
try{
 for(const viewport of [{width:1280,height:850},{width:375,height:667},{width:844,height:390}]){
 const context=await browser.newContext({viewport,isMobile:viewport.width!==1280,hasTouch:viewport.width!==1280}),page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{Date.now=()=>123;});
 await page.goto(base+'/os/mall-rat',{waitUntil:'domcontentloaded',timeout:90000});await page.getByLabel('Free skate / no timer').check();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.mode==='menu');
 await page.evaluate(()=>{
  let now=performance.now(),id=0;const queue=new Map(),held={};performance.now=()=>now;window.requestAnimationFrame=f=>{queue.set(++id,f);return id;};window.cancelAnimationFrame=id=>queue.delete(id);
  window.careerKeys=input=>{for(const[name,code]of Object.entries({forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',jump:'Space',grind:'KeyL'})){if(!!input[name]!==!!held[name])window.dispatchEvent(new KeyboardEvent(input[name]?'keydown':'keyup',{code,key:code==='Space'?' ':code.slice(3).toLowerCase(),bubbles:true}));held[name]=!!input[name];}};
  window.careerFrame=()=>{now+=1000/60+.000001;const frames=[...queue.values()];queue.clear();frames.forEach(f=>f(now));};
  for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const fn=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return fn.apply(this,args);};}
 });
 const frames=(n,input={})=>page.evaluate(({n,input})=>{window.careerKeys(input);for(let i=0;i<n;i++){window.skipGpu=i<n-1;window.careerFrame();}window.skipGpu=false;},{n,input});
 const data=()=>page.locator('canvas').evaluate(c=>({...c.dataset}));
 await page.getByRole('button',{name:'BREAK IN →'}).click();await page.waitForTimeout(900);await frames(2);
 for(let i=0;i<plan.inputs.length;i+=120)await page.evaluate(batch=>{batch.forEach((input,j)=>{window.skipGpu=j<batch.length-1;window.careerKeys(input);window.careerFrame();});window.skipGpu=false;},plan.inputs.slice(i,i+120));
 await frames(180);const landed=await data();assert.equal(landed.rail,'');assert.equal(landed.manual,'false');assert.ok(Number(landed.score)>9000);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('terminl:after-hours:v1')));
 console.log(JSON.stringify({score:landed.score,savedMilestones:saved.mall.milestones,savedGaps:saved.mall.gaps,savedTapes:saved.mall.tapes,savedRoutes:saved.mall.routes,records:saved.mall.records.length}));
 for(const id of ['first-line','big-air','long-jump'])assert.ok(saved.mall.milestones.includes(id),id+' saves immediately after the completed line');

 assert.equal(saved.mall.records.length,0);
 await page.getByRole('button',{name:'Open park map and goals'}).click();await frames(6);
 const dialog=page.getByRole('dialog');await dialog.locator('summary').filter({hasText:'SKATEBOOK'}).click();
 assert.equal(await dialog.locator('[data-career-goal]').count(),8);
 assert.match(await dialog.locator('[data-career-goal=first-line]').innerText(),/EARNED/);
 const tick=(await data()).tick;await page.keyboard.press('r');await frames(120);assert.equal((await data()).tick,tick,'skatebook pauses simulation and blocks restart');
 const goal=dialog.locator('[data-career-goal=five-figure-line]');await goal.scrollIntoViewIfNeeded();
 await page.screenshot({path:`artifacts/mall-career/goals-${viewport.width}.png`});
 assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'no horizontal overflow');
 const button=goal.getByRole('button');assert.ok((await button.boundingBox()).height>=44);await button.click();await frames(6);
 assert.equal((await data()).mode,'playing');assert.equal(await dialog.count(),0);await page.getByRole('button',{name:/Park guide:/}).waitFor();
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'BREAK IN →'}).waitFor();
 await page.locator('summary').filter({hasText:'SKATEBOOK'}).click();
 await page.getByText('3 / 8 EARNED',{exact:true}).waitFor();
 const afterReload=await page.evaluate(()=>JSON.parse(localStorage.getItem('terminl:after-hours:v1')));
 assert.deepEqual(afterReload.mall.career,saved.mall.career);
 await page.locator('summary').filter({hasText:'GAP HUNT'}).click();assert.equal(await page.getByRole('button',{name:/GUIDE TO/}).count(),5);
 await page.locator('summary').filter({hasText:'DISTRICTS'}).click();
 await page.locator('summary').filter({hasText:'ROUTE RECORDS'}).click();assert.equal(await page.getByText('NO FINISH YET',{exact:true}).count(),2);
 await page.getByLabel('Free skate / no timer').check();
 const practice=page.locator('[data-career-goal=five-figure-line]').getByRole('button');await practice.scrollIntoViewIfNeeded();
 await page.screenshot({path:`artifacts/mall-career/menu-${viewport.width}.png`});await practice.click();
 await page.getByRole('timer',{name:'Free skate'}).waitFor();await page.getByRole('button',{name:/Park guide:/}).waitFor();
 await page.getByRole('button',{name:'Open park map and goals'}).click();
 const pausedTick=(await data()).tick;await page.waitForTimeout(300);assert.equal((await data()).tick,pausedTick);
 console.log('PASS career reload, map pause, gap/route records and practice guide',viewport.width);
 assert.deepEqual(errors,[]);await context.close();
 }

}finally{await browser.close();}
