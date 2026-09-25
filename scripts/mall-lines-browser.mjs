import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {planLines} from './mall-lines-pilot.mjs';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{Date.now=()=>123;});
try{
 for(const plan of planLines()){
  await page.goto((process.env.ARCADE_TEST_URL||'http://127.0.0.1:4000')+'/os/mall-rat');await page.getByLabel('Free skate / no timer').check();
  await page.evaluate(()=>{let now=performance.now(),id=0;const q=new Map();performance.now=()=>now;window.requestAnimationFrame=f=>{q.set(++id,f);return id;};window.cancelAnimationFrame=id=>q.delete(id);window.held={};window.tickLine=input=>{for(const[name,code]of Object.entries({forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD'}))if(!!input[name]!==!!window.held[name])window.dispatchEvent(new KeyboardEvent(input[name]?'keydown':'keyup',{code,key:code.slice(3).toLowerCase(),bubbles:true}));window.held=input;now+=1000/60+.000001;const callbacks=[...q.values()];q.clear();callbacks.forEach(f=>f(now));};for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const orig=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return orig.apply(this,args);};}});
  await page.getByRole('button',{name:'BREAK IN →'}).click();await page.waitForTimeout(600);await page.evaluate(()=>{window.tickLine({});window.tickLine({});});
  await page.evaluate(inputs=>{for(let i=0;i<inputs.length;i++){window.skipGpu=i<inputs.length-1;window.tickLine(inputs[i]);}window.skipGpu=false;},plan.inputs);
  const d=await page.locator('canvas').evaluate(c=>({...c.dataset}));assert.ok(Math.hypot(Number(d.x)-plan.x,Number(d.z)-plan.z)<.2,plan.id+' input replay');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('terminl:after-hours:v1')).mall);
  if(plan.gaps)assert.ok(saved.gaps.includes(plan.id),plan.id+' persists on landing');else assert.ok(saved.routes[plan.id]>0,plan.id+' route time persists');
  await page.screenshot({path:`artifacts/mall-park-v3/line-${plan.id}.png`});console.log('PASS playable line, awarded result and saved discovery',plan.id);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
