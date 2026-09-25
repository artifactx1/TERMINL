import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4000';
async function clock(){await page.evaluate(()=>{let now=performance.now(),id=0;const q=new Map();performance.now=()=>now;window.requestAnimationFrame=fn=>{q.set(++id,fn);return id;};window.cancelAnimationFrame=id=>q.delete(id);window.advance=(delta=1000/60+.000001)=>{now+=delta;const callbacks=[...q.values()];q.clear();callbacks.forEach(fn=>fn(now));};window.held={};window.controls=input=>{const map={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',jump:'Space',flip:'KeyJ',grab:'KeyK',grind:'KeyL',manual:'KeyM',bank:'KeyB',fire:'KeyF',dash:'ShiftLeft',interact:'KeyE'};for(const [action,code]of Object.entries(map))if(!!input[action]!==!!window.held[action])window.dispatchEvent(new KeyboardEvent(input[action]?'keydown':'keyup',{key:code==='Space'?' ':code.startsWith('Key')?code.slice(3).toLowerCase():code,code,bubbles:true,cancelable:true}));window.held={...input};if(input.weapon!==undefined)window.dispatchEvent(new KeyboardEvent('keydown',{code:`Digit${input.weapon+1}`,key:String(input.weapon+1),bubbles:true}));if(input.lookX||input.lookY){const c=document.querySelector('canvas');c.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',clientX:0,clientY:0,bubbles:true}));window.dispatchEvent(new PointerEvent('pointermove',{clientX:input.lookX||0,clientY:input.lookY||0,bubbles:true}));window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));}};for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return original.apply(this,args);};}});}
async function advance(count,input,delta){await page.evaluate(({count,input,delta})=>{window.controls(input);for(let i=0;i<count;i++){window.skipGpu=i<count-1;window.advance(delta);}window.skipGpu=false;},{count,input,delta});}
try{
 await mkdir('artifacts/mall-motion-v2',{recursive:true});
 for(const [id,name]of [['max','MARGIN CALL MAX'],['pepe','DIAMOND HANDS PEPE'],['mia','MEV MIA'],['chloe','COLD STORAGE CHLOE']]){
  await page.goto(base+'/os/mall-rat');await page.getByRole('button',{name,exact:true}).click();
  await clock();await page.getByRole('button',{name:'BREAK IN →'}).click();
  // Allow real image decoding while the deterministic simulation clock is stopped.
  await page.waitForTimeout(700);await advance(2,{});
  const capture=async label=>{const data=await page.locator('canvas').evaluate(c=>({...c.dataset}));assert.equal(Number(data.bodyYaw),Number(data.boardYaw));assert.equal(data.boardPivot,'deck-center');assert.equal(data.riderRender,'shared-heading-mesh');await page.screenshot({path:`artifacts/mall-motion-v2/${id}-${label}.png`});return data;};
  assert.equal((await capture('coast')).skatePose,'coast');
  await advance(18,{forward:true});assert.match((await capture('push')).skatePose,/push/);
  await advance(1,{forward:true,jump:true});await advance(8,{forward:true});assert.equal((await capture('ollie')).skatePose,'ollie');
  await advance(1,{flip:true});if(id==='max')await capture('flip-0');
  await advance(5,{});if(id==='max')await capture('flip-5');
  await advance(5,{});assert.equal((await capture('flip')).skatePose,'flip');
  await advance(5,{});if(id==='max')await capture('flip-15');
  await advance(7,{});if(id==='max')await capture('flip-catch');
  assert.equal(Number(await page.locator('canvas').getAttribute('data-board-roll')),0);
  await advance(4,{});await advance(1,{grab:true});assert.equal((await capture('grab')).skatePose,'grab');
  await advance(32,{manual:true});await capture('landing');
  await advance(1,{jump:true});await advance(30,{right:true,grab:true});assert.equal((await capture('spin')).skatePose,'front');
  await advance(50,{bank:true});assert.ok(Number(await page.locator('canvas').getAttribute('data-score'))>0);
  await page.keyboard.press('r');await page.waitForTimeout(100);await advance(18,{forward:true});await advance(1,{jump:true});
  for(let i=0;i<6;i++){await advance(4,{right:true});const data=await page.locator('canvas').evaluate(c=>({...c.dataset}));assert.equal(Number(data.boardYaw),Number(data.yaw));assert.equal(Number(data.boardRoll),0);assert.equal(Number(data.riderYaw),Number(data.boardYaw));const yaw=Number(data.yaw);assert.ok(Math.abs(Number(data.boardForwardX)-Math.sin(yaw))<.001);assert.ok(Math.abs(Number(data.boardForwardZ)+Math.cos(yaw))<.001);}
  await capture('steering-no-spin');
  if(id==='max'){
   await page.keyboard.press('r');await page.waitForTimeout(100);await advance(18,{forward:true});
   for(const direction of ['left','right']){for(let i=0;i<3;i++){
    const before=await page.locator('canvas').evaluate(c=>({...c.dataset}));await advance(6,{forward:true,[direction]:true});const after=await page.locator('canvas').evaluate(c=>({...c.dataset}));
    const dx=Number(after.x)-Number(before.x),dz=Number(after.z)-Number(before.z),distance=Math.hypot(dx,dz);
    assert.ok((dx*Number(after.boardForwardX)+dz*Number(after.boardForwardZ))/distance>.98,'board nose follows actual displacement');
    assert.equal(Number(after.riderYaw),Number(after.boardYaw));await capture(`ground-${direction}-${i}`);
   }}
  }
  console.log('PASS',name,'rear push / ollie / animated flip / grab / landing / directional spin / board heading / bank');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
