import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),errors=[];
await mkdir('artifacts/after-hours-v2',{recursive:true});
try{
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:1});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4000/os/mall-rat');await page.getByRole('button',{name:'BREAK IN →'}).waitFor();await page.screenshot({path:`artifacts/after-hours-v2/mall-menu-${viewport.width}.png`});
  await page.getByRole('button',{name:'BREAK IN →'}).tap();await page.waitForTimeout(1500);
  const client=await context.newCDPSession(page),stick=await page.getByRole('application').boundingBox(),action=await page.getByRole('button',{name:'OLLIE',exact:true}).boundingBox();
  let touches=[];const send=async type=>client.send('Input.dispatchTouchEvent',{type,touchPoints:touches});
  const point=(r,id,dx=0,dy=0)=>({x:r.x+r.width/2+dx,y:r.y+r.height/2+dy,id});
  touches=[point(stick,1)];await send('touchStart');await page.waitForTimeout(300);
  touches.push(point(action,2));await send('touchStart');await page.waitForTimeout(100);touches.pop();await send('touchEnd');
  await page.waitForTimeout(100);assert.ok(Number(await page.locator('canvas').getAttribute('data-y'))>0);
  touches.push(point(action,2));await send('touchStart');await page.waitForTimeout(100);touches.pop();await send('touchEnd');
  await page.waitForTimeout(100);assert.ok(Number(await page.locator('canvas').getAttribute('data-combo'))>=2);
  await page.screenshot({path:`artifacts/after-hours-v2/mall-touch-${viewport.width}.png`});
  touches=[];await send('touchEnd');await page.waitForTimeout(500);
  await page.getByRole('button',{name:'PAUSE / HELP'}).tap();const tick=await page.locator('canvas').getAttribute('data-tick');await page.waitForTimeout(200);assert.equal(await page.locator('canvas').getAttribute('data-tick'),tick);
  await page.getByRole('button',{name:'BACK TO IT →'}).tap();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log('PASS two-thumb ollie + flip, release, pause/resume and layout',viewport);await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
