import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {followParkRoute} from './mall-navigation-pilot.mjs';
const browser=await chromium.launch({headless:true}),errors=[],base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4005';
const plan=followParkRoute('rails');
await mkdir('artifacts/mall-map',{recursive:true});
try{
 for(const viewport of (process.argv.includes('--landscape')?[{width:844,height:390}]:[{width:1280,height:850},{width:375,height:667},{width:844,height:390}])){
  const mobile=viewport.width!==1280,context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Date.now=()=>123;});
  await page.goto(base+'/os/mall-rat',{waitUntil:'domcontentloaded',timeout:90000});await page.getByLabel('Free skate / no timer').check();
  await page.evaluate(()=>{
   let now=performance.now(),id=0;const queue=new Map(),held={};performance.now=()=>now;
   window.requestAnimationFrame=f=>{queue.set(++id,f);return id;};window.cancelAnimationFrame=id=>queue.delete(id);
   window.mapKeys=input=>{for(const[name,code]of Object.entries({forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD'})){if(!!input[name]!==!!held[name])window.dispatchEvent(new KeyboardEvent(input[name]?'keydown':'keyup',{code,key:code.slice(3).toLowerCase(),bubbles:true}));held[name]=!!input[name];}};
   window.mapFrame=()=>{now+=1000/60+.000001;const frames=[...queue.values()];queue.clear();frames.forEach(f=>f(now));};
   for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const fn=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return fn.apply(this,args);};}
  });
  const frames=n=>page.evaluate(n=>{for(let i=0;i<n;i++){window.skipGpu=i<n-1;window.mapFrame();}window.skipGpu=false;},n);
  const data=()=>page.locator('canvas').evaluate(c=>({...c.dataset}));
  const play=async inputs=>{for(let i=0;i<inputs.length;i+=120)await page.evaluate(batch=>{batch.forEach((input,j)=>{window.skipGpu=j<batch.length-1;window.mapKeys(input);window.mapFrame();});window.skipGpu=false;},inputs.slice(i,i+120));};
  await page.getByRole('button',{name:'BREAK IN →'}).click();await page.waitForTimeout(1000);await frames(2);

  const mapButton=page.getByRole('button',{name:'Open park map and goals'}),rect=await mapButton.boundingBox();assert.ok(rect.width>=44&&rect.height>=44);assert.ok(rect.x+rect.width<=viewport.width);
  await page.evaluate(()=>window.mapKeys({forward:true}));
  if(mobile){
   const client=await context.newCDPSession(page),stick=await page.getByRole('application').boundingBox();
   const held={id:1,x:stick.x+stick.width/2,y:stick.y+stick.height/2},tap={id:2,x:rect.x+rect.width/2,y:rect.y+rect.height/2};
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[held]});
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[held,tap]});
   await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[held]});
   await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else await mapButton.click();
  await page.getByRole('dialog').waitFor({state:'visible'});await frames(2);const paused=await data();assert.equal(paused.mode,'paused');
  const dialog=page.getByRole('dialog');await dialog.waitFor({state:'visible'});assert.equal(await dialog.locator('article').count(),3);
  await page.keyboard.press('r');await frames(120);assert.equal((await data()).tick,paused.tick,'map freezes simulation and ignores game shortcuts');
  assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'no horizontal map overflow');
  await page.screenshot({path:`artifacts/mall-map/overview-${viewport.width}.png`});
  await page.getByRole('region',{name:'This run’s goals'}).scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/mall-map/goals-${viewport.width}.png`});
  await page.getByLabel('Choose a park district').selectOption('rails');await page.getByRole('button',{name:'GUIDE ME →'}).click();await frames(3);
  assert.equal((await data()).mode,'playing');assert.equal((await data()).speed,'0.00','opening and closing map clears held movement');
  await page.evaluate(()=>window.mapKeys({}));
  await page.getByRole('button',{name:/Park guide:.*Open map/}).waitFor();
  await play(plan.inputs);await frames(6);
  const arrived=await data();assert.ok(Math.hypot(Number(arrived.x)-140,Number(arrived.z))<10,'directions reach rail yard through actual game inputs');
  assert.match(await page.getByRole('button',{name:/Park guide:/}).innerText(),/YOU’RE HERE/);
  const cue=await page.getByRole('button',{name:/Park guide:/}).boundingBox(),zone=await page.locator('[class*=AfterHours_zone]').boundingBox();
  await page.screenshot({path:`artifacts/mall-map/arrived-${viewport.width}.png`});
  assert.ok(cue.y+cue.height<=zone.y-1,`direction cue (${cue.y+cue.height}) stays above the current location (${zone.y})`);
  await page.getByRole('button',{name:viewport.height<550?'Open park map and goals':'Expand park map'}).click();await page.keyboard.press('Escape');await frames(6);assert.equal((await data()).mode,'playing');assert.equal(await page.evaluate(()=>document.activeElement.tagName),'CANVAS');
  await page.getByRole('button',{name:'PAUSE / HELP'}).click();await page.getByRole('button',{name:'MAP + GOALS'}).click();await page.getByRole('button',{name:'CLEAR MY DESTINATION'}).click();await page.getByRole('button',{name:'Close park map and resume'}).click();await frames(6);assert.equal(await page.getByRole('button',{name:/Park guide:/}).count(),0);
  console.log('PASS park map, goals, route arrival, pause/input reset and Escape',viewport.width);await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
