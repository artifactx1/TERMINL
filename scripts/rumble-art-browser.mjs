/** Inspect the real renderer in Chromium and exercise the six in-app fighters. */
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.ARCADE_TEST_URL||'http://localhost:4000';
const out='artifacts/rumble-art';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1680,height:1020}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  // Serve unchanged ES modules through Playwright routes: no renderer mocks or
  // test-only exports in the shipped game, no second development server.
  await page.route('http://rumble-art.test/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/')return route.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#1b2326"><canvas width="1680" height="1020"></canvas></body>'});
    if(/^\/arcade\/fighters\/[a-z]+-atlas-v1\.webp$/.test(path))return route.fulfill({contentType:'image/webp',body:await readFile(new URL('../public'+path,import.meta.url))});
    if(!['/rumble-render.js','/rumble-sim.mjs','/rumble-sprites.mjs','/rumble-sprite-data.mjs'].includes(path))return route.abort();
    await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('../lib/arcade'+path,import.meta.url),'utf8')});
  });
  await page.goto('http://rumble-art.test/');
  const report=await page.evaluate(async()=>{
    const {drawFighter,ANIMATION_CLIPS,fighterPose}=await import('/rumble-render.js');
    const {MOVES}=await import('/rumble-sim.mjs');
    const {RUMBLE_SPRITES,spriteFrameFor}=await import('/rumble-sprites.mjs');
    const images=Object.fromEntries(await Promise.all(Object.entries(RUMBLE_SPRITES).map(async([id,sheet])=>{const image=new Image();image.src=sheet.src;await image.decode();return [id,image];})));
    const canvas=document.querySelector('canvas'),c=canvas.getContext('2d');
    const raster=document.createElement('canvas');raster.width=raster.height=700;
    const r=raster.getContext('2d',{willReadFrequently:true});
    let variants=0;const signatures=new Set(),poses=new Set();
    const bounds=ctx=>{const pixels=ctx.getImageData(0,0,700,700).data;let left=700,top=700,right=0,bottom=0,count=0;for(let y=0;y<700;y++)for(let x=0;x<700;x++)if(pixels[(y*700+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}return {left,top,right,bottom,count};};
    for(const [index,character] of Object.keys(MOVES).entries()){
      for(const face of [-1,1])for(const clip of ANIMATION_CLIPS){
        for(const move of ['anticipation','active','recovery'].includes(clip)?Object.keys(MOVES[character]):[null]){
          const f={character,face,x:350,y:0,hp:1000,grounded:true,previewClip:clip,action:move?{id:move}:null};
          r.clearRect(0,0,700,700);
          let draws=0;const measured=new Proxy(r,{get(target,key){const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;return (...args)=>{if(key==='drawImage'){if(args[0]!==images[character])throw new Error('Illustration replaced by fallback');draws++;}return value.apply(target,args);};},set(target,key,value){target[key]=value;return true;}});
          drawFighter(measured,f,{tick:30,image:images[character]});
          const rb=bounds(r),name=`${character}/${face}/${clip}/${move}`;
          if(draws!==1||rb.count<1000)throw new Error('Missing illustrated pose: '+name);
          if(rb.left===0||rb.right===699||rb.top===0||rb.bottom===699)throw new Error('Clipped pose: '+name);
          poses.add(character+'/'+spriteFrameFor(f,fighterPose(f,30)));
          variants++;
        }
      }
      for(const [row,clip] of ['idle','active','knockdown'].entries()){
        const x=140+index*280,y=285+row*315;
        c.fillStyle='#d6d0b7';c.font='13px monospace';c.textAlign='center';c.fillText(`${character} / ${clip}`,x,row*315+25);
        drawFighter(c,{character,face:row===1?-1:1,x:x+(row===2?85:row===1?45:0),y:500-y,hp:1000,grounded:true,previewClip:clip,action:clip==='active'?{id:'heavy'}:null},{tick:30,scale:1,image:images[character]});
      }
      r.clearRect(0,0,700,700);drawFighter(r,{character,face:1,x:350,y:0,hp:1000,grounded:true},{tick:30,image:images[character]});signatures.add(raster.toDataURL());
    }
    return {variants,distinctFighters:signatures.size,illustratedPoses:poses.size};
  });
  assert.equal(report.variants,540);assert.equal(report.distinctFighters,6);
  assert.equal(report.illustratedPoses,54);
  await page.screenshot({path:out+'/roster-poses.png'});
  console.log('PASS renderer',JSON.stringify(report));
  await page.unrouteAll();
  await page.setViewportSize({width:1440,height:960});
  await page.goto(base+'/os/rumble',{timeout:90000});
  for(const [i,name] of ['Margin Call Max','Diamond Hands Pepe','Buy-High Brian','MEV Mia','Bridge Burn Bernie','Cold Storage Chloe'].entries()){
    await page.getByRole('button',{name:new RegExp(`^0${i+1} ${name}`)}).click();
    await page.getByRole('button',{name:'LEARN BY FIGHTING ↗',exact:true}).click();
    await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.tick)>5);
    await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.fighterArt==='illustrated-sprites');
    await page.screenshot({path:`${out}/${i+1}-gameplay.png`});
    await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='fight');
    await page.keyboard.down('j');
    await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.action==='light');
    await page.keyboard.up('j');
    await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.action==='');
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.grounded==='false');
    await page.keyboard.up('ArrowUp');
    await page.getByRole('button',{name:'← LEAVE',exact:true}).click();
    console.log('PASS gameplay',name,'renders, attacks and jumps');
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'LEARN BY FIGHTING ↗',exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.tick)>5);
  await page.screenshot({path:out+'/mobile-gameplay.png'});
  assert.equal(await page.locator('[data-nextjs-dialog]').count(),0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,...report,gameplayFighters:6,mobile:true,errors}));
}finally{await browser.close();}
