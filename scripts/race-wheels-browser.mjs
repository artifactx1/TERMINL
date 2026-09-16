/** Render the production sprite code in Chromium; compare actual stationary/rolling pixels. */
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:780}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.route('http://wheels.test/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/')return route.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#35414c"><canvas width="1280" height="780"></canvas></body>'});
    const local=path.startsWith('/lib/arcade/')?'.'+path:path.startsWith('/arcade/')?'public'+path:null;
    if(!local||path.includes('..'))return route.abort();
    try{await route.fulfill({contentType:path.endsWith('.webp')?'image/webp':'text/javascript',body:await readFile(resolve(local))});}catch{await route.abort();}
  });
  await page.goto('http://wheels.test/');
  const result=await page.evaluate(async()=>{
    const {drawVehicleArt,preloadVehicleArt,VEHICLE_ART}=await import('/lib/arcade/race-exotics.js');await preloadVehicleArt();
    const display=document.querySelector('canvas').getContext('2d'),checks=[];
    const frame=(id,rotation)=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=360;const c=canvas.getContext('2d');drawVehicleArt(c,id,{x:160,y:330,width:id==='bike-tyson'?185:305,rotation});return {canvas,data:c.getImageData(0,0,320,360).data};};
    Object.keys(VEHICLE_ART).forEach((id,index)=>{
      const a=frame(id,0),same=frame(id,0),b=frame(id,.28),reverse=frame(id,-.28);
      let changed=0,stationary=0,backward=0;
      for(let i=0;i<a.data.length;i+=4){
        if(a.data.slice(i,i+4).some((n,j)=>n!==b.data[i+j]))changed++;
        if(a.data.slice(i,i+4).some((n,j)=>n!==same.data[i+j]))stationary++;
        if(b.data.slice(i,i+4).some((n,j)=>n!==reverse.data[i+j]))backward++;
      }
      checks.push({id,changed,stationary,backward});
      for(const [row,canvas]of [[0,a.canvas],[1,b.canvas]]){display.drawImage(canvas,index*320,row*390);display.fillStyle='#fff';display.font='16px monospace';display.fillText(`${id} / ${row?'rolling':'stopped'}`,index*320+15,row*390+24);}
    });return checks;
  });
  for(const check of result){assert.equal(check.stationary,0);assert.ok(check.changed>100,`${check.id}: rolling tread must visibly change`);assert.ok(check.backward>100,`${check.id}: reverse must change rotation direction`);}
  assert.deepEqual(errors,[]);await mkdir('artifacts/arcade',{recursive:true});await page.screenshot({path:'artifacts/arcade/rolling-wheels.png'});
  console.log(JSON.stringify({ok:true,checks:result,errors}));
}finally{await browser.close();}
