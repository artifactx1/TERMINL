import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import sharp from 'sharp';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4000';await mkdir('artifacts/mall-park-v3',{recursive:true});
async function frames(n){await page.evaluate(n=>{for(let i=0;i<n;i++){window.skipGpu=i<n-1;window.skateFrame();}window.skipGpu=false;},n);}
try{
 for(const [id,name]of [['max','MARGIN CALL MAX'],['pepe','DIAMOND HANDS PEPE'],['mia','MEV MIA'],['chloe','COLD STORAGE CHLOE']]){
  await page.goto(base+'/os/mall-rat');await page.getByRole('button',{name,exact:true}).click();
  await page.evaluate(()=>{let now=performance.now(),id=0;const q=new Map();performance.now=()=>now;window.requestAnimationFrame=f=>{q.set(++id,f);return id;};window.cancelAnimationFrame=id=>q.delete(id);window.skateFrame=()=>{now+=1000/60+.000001;const callbacks=[...q.values()];q.clear();callbacks.forEach(f=>f(now));};for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const orig=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){if(!window.skipGpu)return orig.apply(this,args);};}});
  await page.getByRole('button',{name:'BREAK IN →'}).click();await page.waitForTimeout(800);await frames(2);
  for(const [move,key]of [['backflip','h'],['frontflip','n']]){
   await page.keyboard.down('Space');await frames(7);await page.keyboard.up('Space');await page.keyboard.down(key);await frames(1);await page.keyboard.up(key);
   const images=[];
   for(const [i,n]of [1,7,8,8,18].entries()){
    await frames(n);const d=await page.locator('canvas').evaluate(c=>({...c.dataset}));assert.equal(d.riderRender,'shared-heading-mesh');assert.equal(d.boardPivot,'deck-center');
    if(i>0&&i<4)assert.match(d.acroFrame,/^[0-7]$/);if(i===4){assert.equal(d.acroFrame,'');assert.equal(Number(d.boardRoll),0);}
    const capture=await page.screenshot({clip:{x:420,y:220,width:440,height:470}});images.push({input:capture,left:i*440,top:0});
   }
   await sharp({create:{width:2200,height:470,channels:4,background:'#071b1a'}}).composite(images).png().toFile(`artifacts/mall-park-v3/${id}-${move}-sequence.png`);
   await frames(150);assert.ok(Number(await page.locator('canvas').getAttribute('data-score'))>=900);console.log('PASS',name,move,'takeoff / rotation / inversion / catch / bank');
  }
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
