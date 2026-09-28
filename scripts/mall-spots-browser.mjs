import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {PRACTICE_SPOTS} from '../lib/arcade/after-hours/mall-spots.mjs';
import {createMall} from '../lib/arcade/after-hours/mall-sim.mjs';
const base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4005',browser=await chromium.launch({headless:true}),errors=[];
await mkdir('artifacts/mall-spots',{recursive:true});
try{
 for(const viewport of [{width:1280,height:850},{width:375,height:667},{width:844,height:390}]){
  const mobile=viewport.width!==1280,context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Date.now=()=>123;});
  await page.goto(base+'/os/mall-rat',{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.mode==='menu');
  assert.equal(await page.getByLabel('Free-skate starting spot').count(),0);
  await page.getByLabel('Free skate / no timer').check();await page.getByLabel('Free-skate starting spot').selectOption('rails');
  await page.evaluate(()=>{
   let now=performance.now(),id=0;const queue=new Map(),held={};performance.now=()=>now;window.requestAnimationFrame=f=>{queue.set(++id,f);return id;};window.cancelAnimationFrame=id=>queue.delete(id);
   window.spotKeys=input=>{for(const[name,code]of Object.entries({forward:'KeyW',grind:'KeyL',jump:'Space',backflip:'KeyH'})){if(!!input[name]!==!!held[name])window.dispatchEvent(new KeyboardEvent(input[name]?'keydown':'keyup',{code,key:code==='Space'?' ':code.slice(3).toLowerCase(),bubbles:true}));held[name]=!!input[name];}};
   window.spotFrame=()=>{now+=1000/60+.000001;const frames=[...queue.values()];queue.clear();frames.forEach(f=>f(now));};
   for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const fn=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return fn.apply(this,args);};}
  });
  const frames=(n,input={})=>page.evaluate(({n,input})=>{window.spotKeys(input);for(let i=0;i<n;i++){window.skipGpu=i<n-1;window.spotFrame();}window.skipGpu=false;},{n,input});
  const data=()=>page.locator('canvas').evaluate(c=>({...c.dataset}));
  const settled=async()=>{await page.waitForTimeout(250);await frames(3);};
  const assertSpot=async id=>{const d=await data(),p=createMall({practice:true,practiceSpot:id}).player;assert.equal(d.mode,'playing');assert.equal(Number(d.x),p.x);assert.equal(Number(d.z),p.z);assert.ok(Math.abs(Number(d.y)-p.y)<.011);assert.equal(d.speed,'0.00');assert.equal(d.rail,'');assert.equal(d.manual,'false');assert.equal(d.score,'0');assert.equal(d.combo,'0');assert.ok(Math.abs(Number(d.cameraHeadY))<.85);assert.ok(Math.abs(Number(d.cameraFeetY))<.85);};
  await page.getByRole('button',{name:'BREAK IN →'}).click();await settled();await assertSpot('rails');
  await frames(112,{forward:true,grind:true});assert.equal((await data()).rail,'diamond-1');
  await page.screenshot({path:`artifacts/mall-spots/rail-catch-${viewport.width}.png`});
  await frames(6,{forward:true,jump:true});await frames(1,{forward:true,backflip:true});assert.equal((await data()).trick,'backflip');await frames(180);
  assert.ok(Number((await data()).score)>2500);const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('terminl:after-hours:v1')));assert.ok(saved.mall.milestones.includes('first-line'));
  await page.getByRole('button',{name:'PAUSE / HELP'}).click();await page.getByRole('button',{name:'RETRY THIS SPOT'}).click();await settled();await assertSpot('rails');assert.equal((await data()).score,'0');
  await frames(40,{forward:true});await page.keyboard.press('r');await settled();await assertSpot('rails');assert.equal((await data()).combo,'0');
  // Enter the map with movement held; the new session must not inherit it.
  await page.evaluate(()=>window.spotKeys({forward:true}));
  if(mobile){
   const client=await context.newCDPSession(page),stick=await page.getByRole('application').boundingBox(),button=await page.getByRole('button',{name:'Open park map and goals'}).boundingBox();
   const held={id:1,x:stick.x+stick.width/2,y:stick.y+stick.height/2},tap={id:2,x:button.x+button.width/2,y:button.y+button.height/2};
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[held]});await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[held,tap]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else await page.getByRole('button',{name:'Open park map and goals'}).click();
  await page.getByLabel('Choose a park district').selectOption('mega');
  const startHere=page.getByRole('button',{name:'START FREE SKATE HERE →'});await startHere.scrollIntoViewIfNeeded();assert.ok((await startHere.boundingBox()).height>=44);
  assert.ok(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:`artifacts/mall-spots/map-session-${viewport.width}.png`});
  await startHere.click();await settled();await assertSpot('mega');assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await page.evaluate(()=>document.activeElement.tagName),'CANVAS');await page.screenshot({path:`artifacts/mall-spots/mega-start-${viewport.width}.png`});
  if(mobile){const hint=await page.locator('[class*=startHint]').boundingBox(),status=await page.locator('[class*=rideStatus]').boundingBox();assert.ok(hint.x+hint.width<=status.x||hint.y+hint.height<=status.y||hint.y>=status.y+status.height,'session hint does not overlap ride status');}
  const ids=mobile?['bowl','roof','basement','street']:PRACTICE_SPOTS.map(s=>s.id);
  for(const id of ids){await page.getByRole('button',{name:'Open park map and goals'}).click();await page.getByLabel('Choose a park district').selectOption(id);await startHere.click();await settled();await assertSpot(id);if(['roof','basement','bowl'].includes(id))await page.screenshot({path:`artifacts/mall-spots/${id}-start-${viewport.width}.png`});}
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('terminl:after-hours:v1')));assert.ok(after.mall.milestones.includes('first-line'));assert.equal(after.mall.career.bestCombo,saved.mall.career.bestCombo);assert.equal(after.mall.records.length,0);assert.equal(after.mall.ghost,null);
  // Leaving free skate removes the start selector and restores the timed start.
  await page.getByRole('button',{name:'PAUSE / HELP'}).click();await page.getByRole('button',{name:'SKATER SELECT'}).click();await page.getByLabel('Free skate / no timer').uncheck();assert.equal(await page.getByLabel('Free-skate starting spot').count(),0);
  await page.getByRole('button',{name:'BREAK IN →'}).click();await settled();await assertSpot('atrium');await page.getByRole('timer',{name:'Time remaining'}).waitFor();
  await page.getByRole('button',{name:'Open park map and goals'}).click();assert.equal(await startHere.count(),0);
  assert.deepEqual(errors,[]);console.log('PASS selectable spots, real rail/backflip, both retries, touch release, terrain starts and timed isolation',viewport.width);await context.close();
 }
}finally{await browser.close();}
