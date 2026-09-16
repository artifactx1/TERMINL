/** Actual canvas render of close passes and a legally crossed finish, in both seats. */
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1170,height:1240}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.route('http://race-view.test/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/')return route.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#16202e"><canvas width="1170" height="1240"></canvas></body>'});
    const local=path.startsWith('/lib/arcade/')?'.'+path:path.startsWith('/arcade/')?'public'+path:null;
    if(!local||path.includes('..'))return route.abort();
    try{await route.fulfill({contentType:path.endsWith('.webp')?'image/webp':path.endsWith('.png')?'image/png':'text/javascript',body:await readFile(resolve(local))});}catch{await route.abort();}
  });
  await page.goto('http://race-view.test/');
  const result=await page.evaluate(async()=>{
    const {createRace,trackGeometry,roadAt,stepRace,CUP_TRACKS}=await import('/lib/arcade/race-sim.mjs');
    const {drawPerspectiveRace,preloadRaceArt}=await import('/lib/arcade/race-perspective.js');
    const {raceProjection}=await import('/lib/arcade/race-camera.mjs');
    await preloadRaceArt();const display=document.querySelector('canvas').getContext('2d'),checks=[];
    for(const track of CUP_TRACKS)for(const slot of [0,1]){
      const g=trackGeometry(track),gate=roadAt(g,350),position=(forward,lateral)=>({x:gate.x+Math.cos(gate.angle)*forward-Math.sin(gate.angle)*lateral,y:gate.y+Math.sin(gate.angle)*forward+Math.cos(gate.angle)*lateral,angle:gate.angle});
      const state=createRace({track,vehicles:['inferno','mirage'],cup:false});state.phase='racing';
      const canvas=document.createElement('canvas');canvas.width=390;canvas.height=600;
      const ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);let rivalDraws=0;
      ctx.drawImage=(image,...args)=>{if(image.src?.includes(slot===0?'mirage':'inferno'))rivalDraws++;draw(image,...args);};
      Object.assign(state.players[slot],position(0,-25));
      for(const [column,distance] of [-30,0,60].entries()){
        Object.assign(state.players[1-slot],position(distance,25));state.tick+=6;
        const before=JSON.stringify(state);rivalDraws=0;drawPerspectiveRace(ctx,state,{width:390,height:600,slot,reducedMotion:true});
        const p=raceProjection(state,{width:390,height:600,slot,roadWidth:g.width}).carFrame(state.players[1-slot]);
        checks.push({track,slot,distance,rivalDraws,visible:p.x-p.width/2>=0&&p.x+p.width/2<=390&&p.y-p.width*.72<600,readOnly:before===JSON.stringify(state)});
        if(track==='night-market'){display.drawImage(canvas,column*390,slot*620);display.fillStyle='#fff';display.font='14px monospace';display.fillText(`SEAT ${slot+1} · RIVAL ${distance<0?'APPROACHING':distance===0?'ALONGSIDE':'AHEAD'}`,column*390+12,slot*620+615);}
      }
    }
    return checks;
  });
  for(const c of result){assert.ok(c.rivalDraws>0,JSON.stringify(c));assert.equal(c.visible,true,JSON.stringify(c));assert.equal(c.readOnly,true);}
  await mkdir('artifacts/arcade',{recursive:true});await page.screenshot({path:'artifacts/arcade/rival-passes.png'});
  const finishes=await page.evaluate(async()=>{
    const {createRace,trackGeometry,stepRace,CUP_TRACKS}=await import('/lib/arcade/race-sim.mjs');const {drawPerspectiveRace}=await import('/lib/arcade/race-perspective.js');
    const display=document.querySelector('canvas').getContext('2d');display.clearRect(0,0,1170,1240);const checks=[];
    for(const [index,track] of CUP_TRACKS.entries()){
      const g=trackGeometry(track),gate=g.gates[0],c=Math.cos(gate.angle),s=Math.sin(gate.angle);
      let state=createRace({track,cup:false,vehicles:['inferno','mirage']});state.phase='racing';state.raceTicks=3000;
      Object.assign(state.players[0],{x:gate.x-c*110+s*25,y:gate.y-s*110-c*25,angle:gate.angle});
      Object.assign(state.players[1],{x:gate.x-c*2-s*25,y:gate.y-s*2+c*25,angle:gate.angle,vx:c*5,vy:s*5,speed:5,passed:g.gates.length*g.laps,nextCheckpoint:0,lap:2});
      state=stepRace(state,[0,4]);const canvas=document.createElement('canvas');canvas.width=390;canvas.height=600;const ctx=canvas.getContext('2d'),fill=ctx.fillText.bind(ctx),labels=[];
      ctx.fillText=(text,...args)=>{labels.push(text);fill(text,...args);};drawPerspectiveRace(ctx,state,{width:390,height:600,slot:0,reducedMotion:true});
      checks.push({track,finished:state.players[1].finishedTick!==null,nextCheckpoint:state.players[1].nextCheckpoint,labels});
      display.drawImage(canvas,(index%3)*390,Math.floor(index/3)*620);display.fillStyle='#fff';display.font='14px monospace';display.fillText(g.name,(index%3)*390+12,Math.floor(index/3)*620+615);
    }return checks;
  });
  for(const c of finishes){assert.equal(c.finished,true);assert.equal(c.nextCheckpoint,1);assert.ok(c.labels.includes('FINISH / START'));assert.ok(c.labels.includes('RIVAL · FINISHED'));}
  await page.screenshot({path:'artifacts/arcade/rival-finishes.png'});assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,passes:result.length,finishes:finishes.length,errors}));
}finally{await browser.close();}
