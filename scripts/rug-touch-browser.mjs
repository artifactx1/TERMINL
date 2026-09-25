import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts/after-hours-v2',{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[];
try{
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:1}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4000/os/rug-exe');await page.getByRole('button',{name:'ENTER THE PROTOCOL →'}).tap();await page.waitForTimeout(800);
  const client=await context.newCDPSession(page),stick=await page.getByRole('application',{name:'Movement thumbstick',exact:true}).boundingBox(),fire=await page.getByRole('button',{name:'Fire and aim. Hold to shoot, drag to aim.',exact:true}).boundingBox();
  for(const box of [stick,fire])assert.ok(box.y+box.height<=viewport.height&&box.x+box.width<=viewport.width,'Controls must be entirely reachable');
  let touches=[{x:stick.x+stick.width/2,y:stick.y+stick.height/2-30,id:1},{x:fire.x+fire.width/2,y:fire.y+fire.height/2,id:2}];
  const send=type=>client.send('Input.dispatchTouchEvent',{type,touchPoints:touches});
  const before=Number(await page.locator('canvas').getAttribute('data-z'));await send('touchStart');await page.waitForTimeout(600);
  assert.ok(Number(await page.locator('canvas').getAttribute('data-shots'))>0);assert.ok(Number(await page.locator('canvas').getAttribute('data-z'))<before-1);
  touches[1].x-=25;await send('touchMove');await page.waitForTimeout(150);assert.ok(Math.abs(Number(await page.locator('canvas').getAttribute('data-yaw')))>0.05);
  await page.screenshot({path:`artifacts/after-hours-v2/rug-touch-${viewport.width}.png`});
  touches=[];await send('touchEnd');const shots=Number(await page.locator('canvas').getAttribute('data-shots'));await page.waitForTimeout(400);assert.equal(Number(await page.locator('canvas').getAttribute('data-shots')),shots);
  await page.getByRole('button',{name:'2 SLIPPAGE',exact:true}).tap();await page.waitForTimeout(150);await page.getByText('SLIPPAGE',{exact:true}).waitFor();
  await page.getByRole('button',{name:'PAUSE / HELP'}).tap();const tick=await page.locator('canvas').getAttribute('data-tick');await page.waitForTimeout(200);assert.equal(await page.locator('canvas').getAttribute('data-tick'),tick);
  await page.getByRole('button',{name:'RESUME →'}).tap();await page.waitForTimeout(150);assert.equal(Number(await page.locator('canvas').getAttribute('data-shots')),shots);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);console.log('PASS simultaneous move + fire + aim, release, weapon switch, pause and bounds',viewport);await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
