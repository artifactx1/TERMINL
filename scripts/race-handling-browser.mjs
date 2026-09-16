/** Real keyboard/gamepad events into practice. Touch and online have separate checks. */
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1365,height:900}}),page=await context.newPage(),errors=[];
const base=process.env.ARCADE_TEST_URL||'http://localhost:4000';
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
const button=name=>page.getByRole('button',{name,exact:true});
try{
  await mkdir('artifacts/arcade',{recursive:true});await page.goto(base+'/os/lambo');
  const rivals=[];
  for(let run=0;run<5;run++){
    await button('QUICK RACE →').click();
    await page.waitForFunction(()=>!!document.querySelector('canvas')?.dataset.rivalSeed);
    rivals.push(await page.locator('canvas').evaluate(c=>({name:c.dataset.rival,seed:c.dataset.rivalSeed})));
    if(run<4)await button('← LEAVE').click();
  }
  assert.equal(new Set(rivals.map(r=>r.seed)).size,5);
  for(let i=1;i<rivals.length;i++)assert.notEqual(rivals[i].name,rivals[i-1].name);
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='racing');
  await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.speed)>2);
  await page.keyboard.down('ArrowRight');await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.steer)>.15);
  await page.keyboard.down('ArrowLeft');await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.steer)<-.1);
  await page.keyboard.up('ArrowLeft');await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.steer)>.1);
  await page.keyboard.up('ArrowRight');await page.keyboard.up('ArrowUp');
  await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.steer)===0);
  await page.screenshot({path:'artifacts/arcade/steering-keyboard.png'});
  await button('← LEAVE').click();await button('QUICK RACE →').click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='racing');
  // A standard controller stick should keep its magnitude all the way to physics.
  await page.evaluate(()=>{window.__testPad={connected:true,axes:[.5,0],buttons:Array.from({length:16},(_,i)=>({pressed:i===7,value:i===7?1:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.__testPad]});});
  await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.steeringTarget)>.2);
  const targets=await page.evaluate(()=>new Promise(resolve=>{const values=[],until=performance.now()+300;const sample=()=>{values.push(Number(document.querySelector('canvas').dataset.steeringTarget));if(performance.now()<until)requestAnimationFrame(sample);else resolve(values);};sample();}));
  assert.equal(new Set(targets).size,1);assert.ok(targets[0]<.3);
  await button('SETTINGS').click();await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.steeringTarget)===0);
  await page.evaluate(()=>{window.__testPad.axes[0]=0;window.__testPad.buttons[7]={pressed:false,value:0};});
  await button('Close settings').click();await button('BACK ON TRACK →').click();
  await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.steer)===0);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/arcade/steering-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,keyboardCountersteer:true,release:true,controllerTarget:targets[0],rivals,errors}));
}finally{await context.close();await browser.close();}
