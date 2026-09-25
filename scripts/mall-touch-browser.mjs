import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),errors=[];
await mkdir('artifacts/after-hours-v2',{recursive:true});
// CDP calls can stall for seconds under software WebGL. Keep gameplay time exact
// while still sending real simultaneous touch contacts and rendering captures.
async function frames(page,count){await page.evaluate(count=>{for(let i=0;i<count;i++){window.skipGpu=i<count-1;window.advanceTouch();}window.skipGpu=false;},count);}
async function clock(page){await page.evaluate(()=>{
 let now=performance.now(),id=0;const queue=new Map();performance.now=()=>now;
 window.requestAnimationFrame=fn=>{queue.set(++id,fn);return id;};window.cancelAnimationFrame=id=>queue.delete(id);
 window.advanceTouch=()=>{now+=1000/60+.000001;const callbacks=[...queue.values()];queue.clear();callbacks.forEach(fn=>fn(now));};
 for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return original.apply(this,args);};}
 });await page.waitForTimeout(100);}
try{
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:1});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.ARCADE_TEST_URL||'http://127.0.0.1:4000')+'/os/mall-rat');await page.getByRole('button',{name:'BREAK IN →'}).waitFor();await page.screenshot({path:`artifacts/after-hours-v2/mall-menu-${viewport.width}.png`});
  await clock(page);await page.getByRole('button',{name:'BREAK IN →'}).tap();await page.waitForTimeout(1000);await frames(page,2);
  const client=await context.newCDPSession(page),stick=await page.getByRole('application').boundingBox(),action=await page.getByRole('button',{name:'OLLIE',exact:true}).boundingBox();
  let touches=[];const send=async(type,points=touches)=>client.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  const point=(r,id,dx=0,dy=0)=>({x:r.x+r.width/2+dx,y:r.y+r.height/2+dy,id});
  touches=[point(stick,1)];await send('touchStart');await frames(page,18);
  touches.push(point(action,2));await send('touchStart');await frames(page,6);const ended=touches.pop();await send('touchEnd',[ended]);
  await frames(page,6);assert.ok(Number(await page.locator('canvas').getAttribute('data-y'))>0);
  touches.push(point(action,2));await send('touchStart');await frames(page,6);const endedFlip=touches.pop();await send('touchEnd',[endedFlip]);
  await frames(page,6);assert.ok(Number(await page.locator('canvas').getAttribute('data-combo'))>=2);assert.equal(await page.locator('canvas').getAttribute('data-skate-pose'),'flip');
  await page.screenshot({path:`artifacts/after-hours-v2/mall-touch-${viewport.width}.png`});
  touches=[];await send('touchEnd');await frames(page,16);
  const grab=await page.getByRole('button',{name:'GRAB',exact:true}).boundingBox();touches=[point(grab,3)];await send('touchStart');await frames(page,1);touches=[];await send('touchEnd');await frames(page,1);
  assert.equal(await page.locator('canvas').getAttribute('data-skate-pose'),'grab');await frames(page,30);
  await page.getByRole('button',{name:'PAUSE / HELP'}).tap();const tick=await page.locator('canvas').getAttribute('data-tick');await frames(page,12);assert.equal(await page.locator('canvas').getAttribute('data-tick'),tick);
  await page.getByRole('button',{name:'BACK TO IT →'}).tap();await frames(page,18);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.keyboard.press('r');await page.waitForTimeout(100);await frames(page,2);
  touches=[point(stick,1)];await send('touchStart');await frames(page,18);
  for(const direction of [-1,1]){
   touches=[point(stick,1,direction*26,-12)];await send('touchMove');
   for(let i=0;i<3;i++){
    await frames(page,6);const d=await page.locator('canvas').evaluate(c=>({...c.dataset}));
    assert.equal(Number(d.combo),0,'rolling past a rail must not auto-grind');
    const delta=Number(d.chaseYaw)-Number(d.yaw);assert.ok(Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))<.001);
    assert.equal(Number(d.riderYaw),Number(d.boardYaw));
   }
   await page.screenshot({path:`artifacts/after-hours-v2/mall-carve-${direction}-${viewport.width}.png`});
  }
  touches=[];await send('touchEnd');
  console.log('PASS two-thumb ollie + flip + grab, release, pause/resume and layout',viewport);await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
