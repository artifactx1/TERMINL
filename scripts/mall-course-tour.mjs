import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {angleDelta} from '../lib/arcade/after-hours/math.mjs';
const waypoints=[['street',0,140],['garden',-140,140],['bowl',-140,0],['snake',-140,-140],['mega',0,-120],['roofs',140,-140],['rails',140,0],['canal',140,140],['basement',56,96],['basement',56,56],['service',0,56],['theater',-56,56],['food',-56,0],['arcade',-56,-56],['store',0,-56],['garage',56,0],['roof',56,-56],['atrium',0,0]];
export function planTour(){
 const s=createMall({practice:true,seed:123}),segments=[];stepMall(s);stepMall(s);
 for(const [id,x,z]of waypoints){const inputs=[];let frames=0;
  while(Math.hypot(s.player.x-x,s.player.z-z)>10&&frames++<2400){
   const p=s.player,delta=angleDelta(Math.atan2(x-p.x,-(z-p.z)),p.yaw),brake=Math.abs(delta)>1.1&&p.speed>8;
   const input={forward:!brake,back:brake,left:delta<-.07,right:delta>.07};
   if(p.grounded&&p.speed>10&&s.guards.some(g=>Math.hypot(g.x-p.x,g.z-p.z)<5))input.jump=s.tick%60<15;
   stepMall(s,input);inputs.push(input);
  }
  if(frames>=2400)throw Error(`Could not reach ${id} from ${s.player.x.toFixed(1)},${s.player.z.toFixed(1)}`);
  segments.push({id,x:s.player.x,z:s.player.z,inputs});
 }
 return {segments,visited:s.visited,ticks:s.tick,bails:s.stats.biggestBail};
}
if(process.argv.includes('--plan')){const plan=planTour();console.log(JSON.stringify({visited:plan.visited,ticks:plan.ticks,segments:plan.segments.map(s=>({id:s.id,frames:s.inputs.length}))},null,2));}
if(process.argv.includes('--browser')){
 const {chromium}=await import('playwright'),{mkdir}=await import('node:fs/promises'),assert=(await import('node:assert/strict')).default;
 const browser=await chromium.launch({headless:true}),plan=planTour(),errors=[];
 try{
  await mkdir('artifacts/mall-park-v3',{recursive:true});
  for(const viewport of [{width:1280,height:850},{width:390,height:844}]){
   const page=await browser.newPage({viewport,hasTouch:viewport.width===390,isMobile:viewport.width===390});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{Date.now=()=>123;});
   await page.goto((process.env.ARCADE_TEST_URL||'http://127.0.0.1:4000')+'/os/mall-rat');await page.getByLabel('Free skate / no timer').check();
   await page.evaluate(()=>{let now=performance.now(),id=0;const q=new Map();performance.now=()=>now;window.requestAnimationFrame=f=>{q.set(++id,f);return id;};window.cancelAnimationFrame=id=>q.delete(id);window.heldTour={};window.tickTour=input=>{const map={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',jump:'Space'};for(const [name,code]of Object.entries(map))if(!!input[name]!==!!window.heldTour[name])window.dispatchEvent(new KeyboardEvent(input[name]?'keydown':'keyup',{code,key:code==='Space'?' ':code.slice(3).toLowerCase(),bubbles:true}));window.heldTour=input;now+=1000/60+.000001;const callbacks=[...q.values()];q.clear();callbacks.forEach(f=>f(now));};for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const orig=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return orig.apply(this,args);};}});
   await page.getByRole('button',{name:'BREAK IN →'}).click();await page.waitForTimeout(1000);await page.evaluate(()=>{window.tickTour({});window.tickTour({});});
   for(const segment of plan.segments){
    await page.evaluate(inputs=>{for(let i=0;i<inputs.length;i++){window.skipGpu=i<inputs.length-1;window.tickTour(inputs[i]);}window.skipGpu=false;},segment.inputs);
    const d=await page.locator('canvas').evaluate(c=>({...c.dataset}));assert.ok(Math.hypot(Number(d.x)-segment.x,Number(d.z)-segment.z)<.2,`${segment.id} input replay diverged: ${d.x},${d.z} expected ${segment.x},${segment.z}`);
    await page.screenshot({path:`artifacts/mall-park-v3/course-${segment.id}-${viewport.width}.png`});console.log('PASS tour',viewport.width,segment.id,d.zone,'draws',d.drawCalls);
   }
   await page.close();
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
