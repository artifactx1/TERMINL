import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.ARCADE_TEST_URL||'http://localhost:4000';
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];
page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.controlPointers={};window.addEventListener('pointerdown',e=>{const target=e.target.closest('[aria-label]');if(target)window.controlPointers[target.getAttribute('aria-label')]=e.pointerId;},true);});
const fingers=new Map(),button=name=>page.getByRole('button',{name,exact:true});
async function point(locator,x=.5,y=.5){const r=await locator.boundingBox();assert.ok(r);return{x:r.x+r.width*x,y:r.y+r.height*y};}
async function touch(type,id,p){const released=fingers.get(id);if(p)fingers.set(id,{id,...p,radiusX:5,radiusY:5,force:1});else fingers.delete(id);await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'&&released?[released]:[...fingers.values()]});}
const press=async(id,el,x=.5,y=.5)=>touch('touchStart',id,await point(el,x,y));
const lift=id=>touch('touchEnd',id);
const input=n=>page.waitForFunction(n=>Number(document.querySelector('canvas')?.dataset.input)===n,n);
const mask=n=>page.waitForFunction(n=>Number(document.querySelector('section[data-input]')?.dataset.input)===n,n);
const lostUp=label=>page.evaluate(label=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:window.controlPointers[label],pointerType:'touch'})),label);
const lastTouch=()=>page.evaluate(()=>document.dispatchEvent(new TouchEvent('touchend',{touches:[]})));
try{
  await mkdir('artifacts/controls',{recursive:true});
  await page.goto(base+'/os/moon');await button('START CAMPAIGN →').tap();await button('START LEVEL →').tap();
  await press(1,button('Run right'));await input(2);await press(2,button('Jump'));await input(6);
  await lostUp('Run right');await input(4);await lift(1);await lift(2);await input(0);
  await press(1,button('Run right'));await input(2);await touch('touchMove',1,await point(button('Run left')));await input(1);
  await touch('touchMove',1,{x:195,y:350});await input(0);await lift(1);
  await press(1,button('Run left'));await input(1);await lastTouch();await input(0);await lift(1);
  await press(1,button('Run right'));await input(2);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await input(0);await lift(1);
  console.log('PASS Moon: outside release, two fingers, direction slide, missing pointerup and page exit');
  await page.goto(base+'/os/lambo');await button('SIX-COURSE CUP →').tap();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='racing');
  if(await button('AUTO GAS ON').count())await button('AUTO GAS ON').tap();
  const pad=page.getByRole('group',{name:'Steering thumb pad'});
  await press(1,pad,.1);await press(2,button('GAS'));await mask(5);
  await lostUp('Steering thumb pad');await mask(4);await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.steeringTarget)===0);await lift(1);await lift(2);await mask(0);
  await press(1,pad,.9);await mask(2);await lastTouch();await mask(0);await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.steeringTarget)===0);await lift(1);
  await page.evaluate(()=>{window.testPad={connected:true,axes:[.8,0],buttons:Array.from({length:16},()=>({pressed:false}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.testPad?[window.testPad]:[]});});
  await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.steeringTarget)>.5);
  await page.evaluate(()=>{window.testPad=null;});await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.steeringTarget)===0);
  console.log('PASS Lambo: steering release preserves gas, missing pointerup and silently disconnected controller');
  await page.evaluate(()=>localStorage.setItem('terminl:rumble-prefs',JSON.stringify({keys:{ArrowLeft:1,ArrowRight:2,ArrowUp:4,ArrowDown:8,j:16,k:32,l:64,Shift:128,q:256,e:512,r:1024}})));
  await page.goto(base+'/os/rumble');await button('LEARN BY FIGHTING ↗').tap();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='fight');
  for(const label of ['PUNCH','KICK','SPECIAL','BLOCK','DASH','GRAB','SUPER'])assert.ok(await button(label).isVisible());
  await page.screenshot({path:'artifacts/controls/rumble-touch.png'});
  await page.setViewportSize({width:1280,height:900});
  for(const [key,bit]of [['a',1],['d',2],['w',4],['s',8],['j',16],['k',32],['l',64],['u',256],['i',512],['o',1024],['Space',128]]){await page.keyboard.down(key);await input(bit);await page.keyboard.up(key);await input(0);}
  await page.keyboard.down('d');await page.keyboard.down('j');await input(18);await page.keyboard.up('j');await input(2);await page.keyboard.up('d');await input(0);
  await page.keyboard.down('Shift');await page.keyboard.down('J');await input(16);await page.keyboard.up('Shift');await page.keyboard.up('j');await input(0);
  await button('SETTINGS').click();assert.equal(await page.getByLabel('Key for Block',{exact:true}).inputValue(),'SPACE');assert.equal(await page.getByLabel('Key for Grab',{exact:true}).inputValue(),'I');
  await page.getByLabel('Key for Punch',{exact:true}).press('h');assert.equal(await page.getByLabel('Key for Punch',{exact:true}).inputValue(),'H');
  await page.reload();await button('SETTINGS').click();assert.equal(await page.getByLabel('Key for Punch',{exact:true}).inputValue(),'H');
  await button('RESET KEYBOARD LAYOUT').click();assert.equal(await page.getByLabel('Key for Punch',{exact:true}).inputValue(),'J');
  await page.screenshot({path:'artifacts/controls/rumble-keyboard.png'});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,touchReleaseRecovery:true,moonSliding:true,controllerRecovery:true,clusteredKeyboard:true,legacyMigration:true,customMappingPreserved:true,errors}));
}catch(error){await page.screenshot({path:'artifacts/controls/failure.png'});console.error(await page.locator('body').innerText());throw error;}finally{await context.close();await browser.close();}
