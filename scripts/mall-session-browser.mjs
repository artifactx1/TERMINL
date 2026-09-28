import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {MALL_TUNING} from '../lib/arcade/after-hours/mall-sim.mjs';
const browser=await chromium.launch({headless:true}),errors=[],base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4005';
await mkdir('artifacts/mall-session',{recursive:true});
try{
 for(const viewport of (process.argv.includes('--small')?[{width:375,height:667}]:[{width:1280,height:850},{width:375,height:667},{width:844,height:390}])){
  const mobile=viewport.width!==1280,context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();
  page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{Date.now=()=>123;});
  await page.goto(base+'/os/mall-rat',{waitUntil:'domcontentloaded',timeout:90000});
  await page.getByRole('button',{name:'BREAK IN →'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.mode==='menu');
  await page.evaluate(()=>{
   let now=performance.now(),id=0;const queue=new Map(),held={};performance.now=()=>now;window.requestAnimationFrame=f=>{queue.set(++id,f);return id;};window.cancelAnimationFrame=id=>queue.delete(id);
   window.sessionKeys=input=>{for(const[name,code]of Object.entries({jump:'Space',backflip:'KeyH'})){if(!!input[name]!==!!held[name])window.dispatchEvent(new KeyboardEvent(input[name]?'keydown':'keyup',{code,key:code==='Space'?' ':code.slice(3).toLowerCase(),bubbles:true}));held[name]=!!input[name];}};
   window.sessionFrame=(delta=1000/60+.000001)=>{now+=delta;const frames=[...queue.values()];queue.clear();frames.forEach(f=>f(now));};
   for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const fn=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return fn.apply(this,args);};}
  });
  const data=()=>page.locator('canvas').evaluate(c=>({...c.dataset}));
  const frames=(n,input={})=>page.evaluate(({n,input})=>{window.sessionKeys(input);for(let i=0;i<n;i++){window.skipGpu=i<n-1;window.sessionFrame();}window.skipGpu=false;},{n,input});
  const advanceTo=async target=>{
   // Execute all real physics ticks; only batch rendering and wall-clock waits.
   for(let batch=0;batch<50;batch++){
    const reached=await page.evaluate(target=>{window.sessionKeys({});window.skipGpu=true;const c=document.querySelector('canvas');let count=0;while(Number(c.dataset.tick)<target&&c.dataset.phase==='playing'&&count++<150){window.sessionFrame(target-Number(c.dataset.tick)>=6?100:1000/60+.000001);}window.skipGpu=false;return Number(c.dataset.tick)>=target;},target);
    if(reached)return;
   }
   throw Error('Run stopped before tick '+target+': '+JSON.stringify(await data()));
  };
  await page.getByRole('button',{name:'BREAK IN →'}).click();await page.waitForTimeout(800);await frames(2);
  if(mobile){await page.getByRole('button',{name:/CHOOSE TRICK/}).click();await page.getByRole('group',{name:'Choose your trick'}).getByRole('button',{name:'BACKFLIP',exact:true}).click();}
  await advanceTo(MALL_TUNING.duration-27);
  let client,touches=[];
  if(mobile){
   client=await context.newCDPSession(page);const point=async(name,id)=>{const r=await page.getByRole('button',{name,exact:true}).boundingBox();assert.ok(r.width>=44&&r.height>=44);return {id,x:r.x+r.width/2,y:r.y+r.height/2};};
   touches=[await point('JUMP',1)];await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});await frames(1);
   touches.push(await point('BACKFLIP',2));await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});await frames(1);await frames(25);
   await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{await frames(1,{jump:true});await frames(1,{jump:true,backflip:true});await frames(25,{jump:true});}
  const buzzer=await data();assert.equal(Number(buzzer.tick),MALL_TUNING.duration);assert.equal(buzzer.phase,'playing');assert.equal(buzzer.overtime,'true');assert.equal(buzzer.trick,'backflip');assert.ok(Number(buzzer.y)>2);assert.ok(Number(buzzer.combo)>0);
  await frames(5);const timer=page.getByRole('timer',{name:'Last line overtime'});await timer.waitFor();assert.match(await timer.innerText(),/LAST LINE/);
  const box=await timer.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width);assert.ok(box.height<65);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('terminl:after-hours:v1'))?.mall.records.length||0),0,'no result saved while the combo is alive');
  await page.screenshot({path:`artifacts/mall-session/overtime-${viewport.width}.png`});
  await page.getByRole('button',{name:'PAUSE / HELP'}).click();const paused=await data();await frames(120);assert.equal((await data()).tick,paused.tick);
  await page.getByRole('button',{name:'BACK TO IT →'}).click();await frames(150);
  const finish=await data();assert.equal(finish.phase,'finished');assert.equal(finish.score,'960');assert.equal(finish.combo,'0');assert.equal(finish.rail,'');assert.equal(finish.manual,'false');
  await page.getByText('LAST LINE LANDED',{exact:true}).waitFor();const retry=await page.getByRole('button',{name:'ONE MORE RUN →'}).boundingBox();assert.ok(retry.y>=0&&retry.y+retry.height<=viewport.height,'retry is visible without scrolling through stats');await page.screenshot({path:`artifacts/mall-session/result-${viewport.width}.png`});
  await page.getByText('RUN BREAKDOWN',{exact:true}).click();assert.equal(await page.getByText('LONGEST COMBO',{exact:true}).isVisible(),true);await page.getByText('RUN BREAKDOWN',{exact:true}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('terminl:after-hours:v1')));assert.equal(saved.mall.records.length,1);assert.equal(saved.mall.records[0].overtime.banked,960);assert.ok(saved.mall.records[0].overtime.ticks>0);assert.equal(saved.mall.ghost.at(-1)[0],Number(finish.tick));
  await frames(30);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('terminl:after-hours:v1')).mall.records.length),1,'result saves once');
  await page.getByRole('button',{name:'ONE MORE RUN →'}).click();await page.waitForTimeout(100);await frames(2);const fresh=await data();assert.equal(fresh.overtime,'false');assert.equal(fresh.score,'0');assert.ok(Number(fresh.tick)<10);
  await advanceTo(MALL_TUNING.duration);await frames(3);const idle=await data();assert.equal(idle.phase,'finished');assert.equal(idle.overtime,'false');assert.equal(idle.score,'0');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('terminl:after-hours:v1')).mall.records.length),2);
  console.log('PASS full timer, last backflip, overtime pause, landing, saved ghost, retry and idle finish',viewport.width);await context.close();
 }
 assert.deepEqual(errors,[]);
}catch(error){console.error('Browser page errors:',errors);throw error;}finally{await browser.close();}
