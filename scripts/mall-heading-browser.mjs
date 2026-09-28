import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),errors=[],base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4005';
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
await mkdir('artifacts/mall-heading',{recursive:true});
try{
 for(const viewport of (process.argv.includes('--small')?[{width:375,height:667}]:[{width:1280,height:850},{width:375,height:667},{width:844,height:390}])){
  const mobile=viewport.width!==1280,context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/os/mall-rat',{waitUntil:'domcontentloaded',timeout:90000});await page.getByLabel('Free skate / no timer').check();
  await page.evaluate(()=>{
   let now=performance.now(),id=0;const queue=new Map(),held={};performance.now=()=>now;window.requestAnimationFrame=f=>{queue.set(++id,f);return id;};window.cancelAnimationFrame=id=>queue.delete(id);
   window.headingKeys=input=>{for(const[name,code]of Object.entries({forward:'KeyW',right:'KeyD',jump:'Space',grab:'KeyK',spin:'KeyU',turn:'KeyC'})){if(!!input[name]!==!!held[name])window.dispatchEvent(new KeyboardEvent(input[name]?'keydown':'keyup',{code,key:code==='Space'?' ':code.slice(3).toLowerCase(),bubbles:true}));held[name]=!!input[name];}};
   window.headingFrame=()=>{now+=1000/60+.000001;const frames=[...queue.values()];queue.clear();frames.forEach(f=>f(now));};
   for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const fn=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return fn.apply(this,args);};}
  });
  const frames=(n,input={})=>page.evaluate(({n,input})=>{window.headingKeys(input);for(let i=0;i<n;i++){window.skipGpu=i<n-1;window.headingFrame();}window.skipGpu=false;},{n,input});
  const data=()=>page.locator('canvas').evaluate(c=>({...c.dataset}));
  await page.getByRole('button',{name:'BREAK IN →'}).click();await page.waitForTimeout(1000);await frames(2);
  await frames(12,{forward:true});await frames(1,{jump:true});await frames(28,{grab:true,right:true});
  let previous=await data(),landed;
  for(let i=0;i<70;i++){
   await frames(1);const current=await data();
   assert.ok(Math.abs(angle(Number(current.bodyYaw),Number(previous.bodyYaw)))<.03,'landing cannot snap the rider back around');
   assert.ok(Math.abs(angle(Number(current.bodyYaw),Number(current.boardYaw)))<.002,'rider and board share the landing heading');
   if(current.fakie==='true'){landed=current;break;}previous=current;
  }
  assert.ok(landed,'180 lands fakie');assert.equal(landed.rail,'');assert.equal(landed.manual,'false');
  await frames(5);await page.screenshot({path:`artifacts/mall-heading/fakie-${viewport.width}.png`});
  assert.match(await page.locator('[class*=rideStatus]').innerText(),/FAKIE/);
  let client,touches;
  if(mobile){
   client=await context.newCDPSession(page);const stick=await page.getByRole('application').boundingBox(),revert=await page.getByRole('button',{name:'REVERT',exact:true}).boundingBox();
   assert.ok(revert.width>=44&&revert.height>=44);
   touches=[{id:1,x:stick.x+stick.width/2,y:stick.y+stick.height/2},{id:2,x:revert.x+revert.width/2,y:revert.y+revert.height/2}];
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});await frames(1);
  }else await frames(1,{turn:true,forward:true});
  let last=await data();assert.equal(last.fakie,'false');assert.ok(Math.abs(angle(Number(last.yaw),Number(landed.yaw)))<.01);
  for(let i=0;i<20;i++){
   await frames(1,mobile?{}:{forward:true});const current=await data();
   assert.ok(Math.abs(angle(Number(current.bodyYaw),Number(last.bodyYaw)))<.28,'revert rotates smoothly');
   const dx=Number(current.x)-Number(last.x),dz=Number(current.z)-Number(last.z),yaw=Number(last.yaw);
   assert.ok(dx*Math.sin(yaw)-dz*Math.cos(yaw)>0,'revert keeps moving down the same line');last=current;
  }
  if(mobile)await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(Math.abs(angle(Number(last.bodyYaw),Number(last.yaw)))<.002);await page.screenshot({path:`artifacts/mall-heading/revert-${viewport.width}.png`});
  // The rotate action resolves against the simulation, not an 80ms-old UI label.
  await frames(1,{jump:true,spin:true});await frames(44,{jump:true});const spin=await data();assert.ok(Math.abs(Number(spin.bodyYaw)-Number(spin.yaw))>6);
  await frames(100);for(let i=0;i<10&&Number((await data()).combo)>0;i++)await frames(20);const finish=await data();await page.screenshot({path:`artifacts/mall-heading/finish-${viewport.width}.png`});assert.equal(finish.fakie,'false');assert.equal(finish.rail,'');assert.equal(finish.manual,'false');assert.ok(Number(finish.score)>0,JSON.stringify(finish));
  console.log('PASS 180 catch, shared board heading, fakie HUD, smooth two-thumb revert and 360',viewport.width);await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
