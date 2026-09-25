import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),errors=[];
const base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4000';
await mkdir('artifacts/mall-park-v3',{recursive:true});
async function clock(page){await page.evaluate(()=>{
 let now=performance.now(),id=0;const q=new Map();performance.now=()=>now;window.requestAnimationFrame=f=>{q.set(++id,f);return id;};window.cancelAnimationFrame=id=>q.delete(id);
 window.stepSkate=()=>{now+=1000/60+.00001;const callbacks=[...q.values()];q.clear();callbacks.forEach(f=>f(now));};
 for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return original.apply(this,args);};}
});await page.waitForTimeout(100);}
async function frames(page,n){await page.evaluate(n=>{for(let i=0;i<n;i++){window.skipGpu=i<n-1;window.stepSkate();}window.skipGpu=false;},n);}
const data=page=>page.locator('canvas').evaluate(c=>({...c.dataset}));
try{
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/os/mall-rat');await page.getByRole('button',{name:'BREAK IN →'}).waitFor();await clock(page);await page.getByRole('button',{name:'BREAK IN →'}).tap();await page.waitForTimeout(900);await frames(page,2);
  const client=await context.newCDPSession(page),point=async(name,id)=>{const r=await page.getByRole('button',{name,exact:true}).boundingBox();assert.ok(r&&r.width>=43&&r.height>=43,name+' usable thumb target');return {id,x:r.x+r.width/2,y:r.y+r.height/2};};
  const choose=await page.getByRole('button',{name:/CHOOSE TRICK/}).boundingBox();assert.ok(choose.height>=44,'trick selector is a full touch target');
  const stick=await page.getByRole('application').boundingBox();let touches=[{id:1,x:stick.x+stick.width/2,y:stick.y+stick.height/2}];
  const send=async(type,points=touches)=>client.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  await send('touchStart');await frames(page,18);assert.equal((await data(page)).manual,'false');assert.equal((await data(page)).rail,'');
  touches.push(await point('JUMP',2));await send('touchStart');await frames(page,8);await send('touchEnd',[touches.pop()]);await frames(page,1);
  assert.ok(Number((await data(page)).y)>0);assert.equal(await page.getByRole('button',{name:'JUMP',exact:true}).count(),1,'jump label stays fixed in the air');
  touches.push(await point('KICKFLIP',2));await send('touchStart');await frames(page,1);await send('touchEnd',[touches.pop()]);await frames(page,10);assert.equal((await data(page)).trick,'kickflip');
  await page.screenshot({path:`artifacts/mall-park-v3/touch-kickflip-${viewport.width}.png`});touches=[];await send('touchEnd');await frames(page,280);assert.ok(Number((await data(page)).score)>0,'landing automatically banks');
  // A visible choice, followed by the same JUMP -> named trick sequence.
  for(const [choice,id]of [['FRONTFLIP','frontflip'],['BACKFLIP','backflip'],['VARIAL','varial'],['TRE FLIP','tre']]){
   await page.keyboard.press('r');await page.waitForTimeout(200);await frames(page,2);
   await page.getByRole('button',{name:/CHOOSE TRICK/}).tap();await page.getByRole('group',{name:'Choose your trick'}).getByRole('button',{name:choice,exact:true}).tap();
   touches=[await point('JUMP',2)];await send('touchStart');await frames(page,7);await send('touchEnd',[touches.pop()]);await frames(page,1);
   touches=[await point(choice,2)];await send('touchStart');await frames(page,1);touches=[];await send('touchEnd');await frames(page,14);assert.equal((await data(page)).trick,id);
   if(id==='frontflip'||id==='backflip')assert.notEqual((await data(page)).acroFrame,'');
   await page.screenshot({path:`artifacts/mall-park-v3/touch-${id}-${viewport.width}.png`});await frames(page,150);assert.ok(Number((await data(page)).score)>0);
  }
  await page.keyboard.press('r');await page.waitForTimeout(200);await frames(page,2);
  touches=[await point('JUMP',2)];await send('touchStart');await frames(page,8);await send('touchEnd',[touches.pop()]);
  touches=[await point('360',2)];await send('touchStart');await frames(page,1);touches=[];await send('touchEnd');await frames(page,44);
  const spin=await data(page);assert.ok(Math.abs(Number(spin.bodyYaw)-Number(spin.yaw))>6,'360 button completes an actual full rotation');
  await page.keyboard.press('r');await page.waitForTimeout(200);await frames(page,2);
  touches=[{id:1,x:stick.x+stick.width/2,y:stick.y+stick.height/2}];await send('touchStart');await frames(page,20);touches.push(await point('GRIND',2));await send('touchStart');await frames(page,6);assert.equal((await data(page)).manual,'true');await send('touchEnd',[touches.pop()]);await frames(page,2);assert.equal((await data(page)).manual,'false');
  for(const direction of [-1,1]){touches[0].x=stick.x+stick.width/2+direction*26;await send('touchMove');await frames(page,14);const d=await data(page);assert.equal(d.rail,'');assert.equal(d.manual,'false');assert.ok(Math.abs(Math.sin(Number(d.chaseYaw)-Number(d.yaw)))<.001);}
  touches=[];await send('touchEnd');await page.getByRole('button',{name:'PAUSE / HELP'}).tap();assert.ok(await page.getByText('1. ROLL',{exact:false}).isVisible());const tick=(await data(page)).tick;await frames(page,20);assert.equal((await data(page)).tick,tick);await page.getByRole('button',{name:'BACK TO IT →'}).tap();await frames(page,5);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`artifacts/mall-park-v3/touch-controls-${viewport.width}.png`});console.log('PASS clear mobile controls, visible picker, 4 advanced tricks, manual release, steering, banking and pause',viewport);await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
