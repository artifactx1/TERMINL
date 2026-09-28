import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {planRailLine} from './mall-rail-lines.mjs';
const plan=planRailLine({releaseFrames:3}),browser=await chromium.launch({headless:true}),errors=[];
const base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4005';
const styles=process.argv.includes('--styles');
const viewports=process.argv.includes('--small')?[{width:375,height:667}]:[{width:1280,height:850},{width:390,height:844},{width:844,height:390}];
await mkdir('artifacts/mall-rails',{recursive:true});
try{
 for(const viewport of viewports){
  const mobile=viewport.width!==1280,context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{Date.now=()=>123;});
  await page.goto(base+'/os/mall-rat',{waitUntil:'domcontentloaded',timeout:90000});await page.getByLabel('Free skate / no timer').check();
  await page.evaluate(()=>{
   let now=performance.now(),id=0;const queue=new Map(),held={};performance.now=()=>now;window.requestAnimationFrame=f=>{queue.set(++id,f);return id;};window.cancelAnimationFrame=id=>queue.delete(id);
   window.railKeys=input=>{for(const[name,code]of Object.entries({forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',jump:'Space',grind:'KeyL',flip:'KeyJ'})){if(!!input[name]!==!!held[name])window.dispatchEvent(new KeyboardEvent(input[name]?'keydown':'keyup',{code,key:code==='Space'?' ':code.slice(3).toLowerCase(),bubbles:true}));held[name]=!!input[name];}};
   window.railFrame=()=>{now+=1000/60+.000001;const frames=[...queue.values()];queue.clear();frames.forEach(f=>f(now));};
   for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const fn=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return fn.apply(this,args);};}
  });
  const frames=n=>page.evaluate(n=>{for(let i=0;i<n;i++){window.skipGpu=i<n-1;window.railFrame();}window.skipGpu=false;},n);
  const play=async inputs=>{for(let i=0;i<inputs.length;i+=120)await page.evaluate(batch=>{batch.forEach((input,j)=>{window.skipGpu=j<batch.length-1;window.railKeys(input);window.railFrame();});window.skipGpu=false;},inputs.slice(i,i+120));};
  const data=()=>page.locator('canvas').evaluate(c=>({...c.dataset}));
  await page.getByRole('button',{name:'BREAK IN →'}).click();await page.waitForTimeout(900);await frames(2);
  if(styles){
   await play(plan.inputs.slice(0,plan.catches[0].frame));assert.equal((await data()).rail,'diamond-1');
   let client,touches,grindX;
   if(mobile){
    await page.evaluate(()=>window.railKeys({}));client=await context.newCDPSession(page);
    const stick=await page.getByRole('application').boundingBox(),grind=await page.getByRole('button',{name:'GRIND',exact:true}).boundingBox();
    grindX=grind.x+grind.width/2;touches=[{id:1,x:stick.x+stick.width/2,y:stick.y+stick.height/2},{id:2,x:grindX,y:grind.y+grind.height/2}];
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});
   }
   await frames(26);
   for(let index=1;index<=3;index++){
    if(mobile){touches[1].x=grindX-35;await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touches});await frames(1);touches[1].x=grindX;await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touches});}
    else await play([{forward:true,grind:true,flip:true},{forward:true,grind:true}]);
    await frames(26);const d=await data();assert.equal(d.grindStyle,String(index));assert.equal(d.grindChanges,String(index));assert.equal(d.rail,'diamond-1');assert.equal(d.trick,'');
    assert.ok(Math.abs(Number(d.bodyYaw)-Number(d.boardYaw))<.002,'board and rider turn together');
    if(viewport.height>viewport.width){
     const canvas=await page.locator('canvas').boundingBox(),combo=await page.locator('[class*="skateCombo"]').boundingBox();
     const head=canvas.y+(1-Number(d.cameraHeadY))/2*canvas.height;
     assert.ok(combo.y+combo.height<head-12,'portrait combo stays above the rider');
     const balance=await page.locator('[class*="rideStatus"]').boundingBox();
     assert.ok(balance.x>canvas.x+canvas.width*.67,'portrait balance stays beside the rider');
    }
    await page.screenshot({path:`artifacts/mall-rails/style-${index}-${viewport.width}.png`});
   }
   if(mobile)await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});else await page.evaluate(()=>window.railKeys({}));
   await frames(180);const d=await data();assert.equal(d.rail,'');assert.equal(d.manual,'false');assert.equal(d.grindStyle,'');assert.ok(Number(d.score)>0);
  }
  else if(!mobile){await play(plan.inputs);assert.equal((await data()).railChain,'3');assert.equal((await data()).railTransfers,'2');}
  else{
   await play(plan.inputs.slice(0,plan.catches[0].frame));assert.equal((await data()).rail,'diamond-1');await page.evaluate(()=>window.railKeys({}));
   const client=await context.newCDPSession(page),rect=await page.getByRole('application').boundingBox();
   const stick={id:1,x:rect.x+rect.width/2,y:rect.y+rect.height/2};
   const point=async name=>{const r=await page.getByRole('button',{name,exact:true}).boundingBox();return {id:2,x:r.x+r.width/2,y:r.y+r.height/2};};
   let touches=[{...stick},await point('GRIND')];const send=(type,points=touches)=>client.send('Input.dispatchTouchEvent',{type,touchPoints:points});
   await send('touchStart');await frames(2);
   for(const direction of [1,-1]){
    await send('touchEnd',[touches.pop()]);await frames(3);assert.equal((await data()).rail,'','grind releases immediately');
    touches[0].x=stick.x+direction*rect.width*.34;await send('touchMove');touches.push(await point('JUMP'));await send('touchStart');await frames(1);
    await send('touchEnd',[touches.pop()]);touches[0].x=stick.x;await send('touchMove');touches.push(await point('GRIND'));await send('touchStart');
    for(let i=0;i<20&&!(await data()).rail;i++)await frames(5);
    assert.equal((await data()).rail,direction===1?'diamond-2':'diamond-1');
   }
   assert.equal((await data()).railChain,'3');assert.equal((await data()).railTransfers,'2');
   await page.screenshot({path:`artifacts/mall-rails/chain-${viewport.width}.png`});touches=[];await send('touchEnd');await frames(180);
   const landed=await data();assert.equal(landed.manual,'false');assert.equal(landed.rail,'');assert.ok(Number(landed.score)>5000,'rail line banks after releasing');
  }
  await page.screenshot({path:`artifacts/mall-rails/${styles?'styles':'finish'}-${viewport.width}.png`});console.log(styles?'PASS grind styles, shared heading and release':'PASS rail transfers and release/jump/catch',viewport.width);await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
