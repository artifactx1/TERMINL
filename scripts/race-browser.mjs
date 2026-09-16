/** Real browser players + spectator. Pilots use only normal controller inputs, never positions or scores. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';
import { replayFight } from '../lib/arcade/rollback.mjs';
import { RACE_RULES, raceHash } from '../lib/arcade/race-sim.mjs';
const base=process.env.ARCADE_TEST_URL||'http://localhost:4000',authority=process.env.ARCADE_TEST_AUTHORITY||'http://localhost:4010';
const browserName=process.env.ARCADE_TEST_BROWSER||'chromium',browser=await({chromium,firefox,webkit}[browserName]).launch({headless:true,...(process.env.ARCADE_BROWSER_EXECUTABLE?{executablePath:process.env.ARCADE_BROWSER_EXECUTABLE}:{})});
const dataModule=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const legacyURL=dataModule(await readFile(new URL('../lib/arcade/race-sim-v1.mjs',import.meta.url),'utf8'));
const v2URL=dataModule((await readFile(new URL('../lib/arcade/race-sim-v2.mjs',import.meta.url),'utf8')).replace('./race-sim-v1.mjs',legacyURL));
const progressURL=dataModule(await readFile(new URL('../lib/arcade/race-progress.mjs',import.meta.url),'utf8'));
const v3URL=dataModule((await readFile(new URL('../lib/arcade/race-sim-v3.mjs',import.meta.url),'utf8')).replace('./race-sim-v1.mjs',legacyURL).replace('./race-sim-v2.mjs',v2URL).replace('./race-progress.mjs',progressURL));
const inputURL=dataModule(await readFile(new URL('../lib/arcade/race-input.mjs',import.meta.url),'utf8'));
const moduleURL=dataModule((await readFile(new URL('../lib/arcade/race-sim.mjs',import.meta.url),'utf8')).replace('./race-sim-v1.mjs',legacyURL).replace('./race-sim-v2.mjs',v2URL).replace('./race-progress.mjs',progressURL).replace('./race-sim-v3.mjs',v3URL).replace('./race-input.mjs',inputURL));
const output='artifacts/arcade';await mkdir(output,{recursive:true});const contexts=[],pages=[],errors=[];
const click=(p,name)=>p.getByRole('button',{name,exact:true}).click();
async function guest(name){
  const c=await browser.newContext({viewport:{width:1440,height:900}});contexts.push(c);
  await c.addInitScript(()=>{const Original=window.WebSocket;window.__wire=[];window.__sockets=[];window.__tracks=new Set();window.WebSocket=class extends Original{constructor(...args){super(...args);window.__sockets.push(this);this.addEventListener('message',event=>{try{const m=JSON.parse(event.data);window.__wire.push(m);if(window.__wire.length>300)window.__wire.shift();if(m.state){window.__state=m.state;window.__tracks.add(m.state.track);}if(m.type==='room')window.__room=m.room;if(m.type==='result')window.__result=m.result;if(m.type==='joined')window.__joined=m;}catch{}});}};});
  const p=await c.newPage();pages.push(p);p.on('pageerror',e=>errors.push(`${name}: ${e.message}`));await p.goto(`${base}/os/lambo`);await p.getByLabel('YOUR CALLSIGN').fill(name);return p;
}
try{
  const a=await guest('Driver A'),b=await guest('Driver B'),watch=await guest('Observer');
  await a.screenshot({path:`${output}/${browserName}-garage.png`,fullPage:true});
  await click(a,'CREATE RACE +');await a.getByLabel('Room invitation').waitFor();const invitation=await a.getByLabel('Room invitation').inputValue();
  await b.getByRole('button',{name:/Spectre RX arcade roadster with Diamond Hands Pepe/}).click();await b.getByLabel('RACE INVITATION').fill(invitation);await click(b,'JOIN RACE →');
  await watch.getByLabel('RACE INVITATION').fill(invitation);await click(watch,'SPECTATE');await a.waitForFunction(()=>window.__room?.players.every(Boolean)&&window.__room.spectators===1);
  await click(a,"I'M READY →");await click(b,"I'M READY →");await a.waitForFunction(()=>window.__state?.phase==='racing');
  const match=await b.evaluate(()=>window.__room.matchId);await b.evaluate(()=>window.__sockets.find(s=>s.url.includes(':4010'))?.close());await b.waitForFunction(id=>window.__room?.matchId===id&&window.__wire.filter(m=>m.type==='joined').length>=2,match);
  for(const [page,slot]of [[a,0],[b,1]])await page.evaluate(async({slot,moduleURL})=>{
    const {raceBotInput}=await import(moduleURL);
    const pad={connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[pad],configurable:true});
    window.__pilot=setInterval(()=>{
      const s=window.__state;if(!s)return;const input=window.__result?0:raceBotInput(s,slot),axis=(input>>7)?((input>>7)-128)/127:0;
      pad.axes[0]=axis?Math.sign(axis)*(.18+.82*Math.pow(Math.abs(axis),1/1.5)):0;
      for(const [index,bit]of [[7,4],[6,8],[2,16],[5,32],[3,64]])pad.buttons[index]={pressed:!!(input&bit),value:input&bit?1:0};
      if(window.__result)clearInterval(window.__pilot);
    },16);
  },{slot,moduleURL});
  await watch.waitForFunction(()=>window.__state.players.every(p=>p.passed>=2),null,{timeout:60000});await a.screenshot({path:`${output}/${browserName}-race.png`});
  await Promise.all(pages.map(p=>p.waitForFunction(()=>window.__result?.status==='completed',null,{timeout:900000})));
  const results=await Promise.all(pages.map(p=>p.evaluate(()=>window.__result)));assert.deepEqual(results[0],results[1]);assert.deepEqual(results[0],results[2]);assert.equal(results[0].reason,'match_complete');assert.equal(results[0].game,'wen-lambo');assert.equal(results[0].races.length,6);
  assert.ok(results[0].races.every(r=>r.times.every(n=>n!==null)),'Both drivers must finish all six tracks through ordinary input');
  const session=await a.evaluate(()=>window.__joined.session),response=await fetch(`${authority}/replays/${results[0].id}`,{headers:{authorization:`Bearer ${session}`}});assert.equal(response.status,200);const {replay}=await response.json();assert.equal(replay.confirmed,true);assert.equal(raceHash(replayFight(replay,RACE_RULES)),replay.hash);
  await a.screenshot({path:`${output}/${browserName}-cup.png`});await click(a,'VOTE REMATCH →');await click(b,'VOTE REMATCH →');await a.waitForFunction(id=>window.__room.matchId!==id&&window.__state.phase==='countdown',results[0].id);await click(b,'← LEAVE');await a.getByRole('heading',{name:'BAG SECURED.',exact:true}).waitFor();
  await click(a,'← LEAVE');await a.setViewportSize({width:390,height:844});await click(a,'LEARN TO DRIVE ↗');await a.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='racing');await a.screenshot({path:`${output}/${browserName}-race-mobile.png`});assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await a.getByRole('button',{name:'GAS',exact:true}).dispatchEvent('pointerdown',{pointerId:1});await a.waitForTimeout(1800);await a.getByRole('button',{name:'GAS',exact:true}).dispatchEvent('pointercancel',{pointerId:1});
  await a.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));await a.waitForTimeout(100);const tick=await a.locator('canvas').getAttribute('data-tick');await a.waitForTimeout(250);assert.equal(await a.locator('canvas').getAttribute('data-tick'),tick);
  await click(a,'← LEAVE');for(let i=0;i<4;i++){await click(a,'SIX-COURSE CUP →');await click(a,'← LEAVE');}
  assert.deepEqual(errors,[]);const report={browser:browserName,contexts:3,result:results[0],replayHash:replay.hash,reconnect:true,rematch:true,forfeit:true,mobileNoOverflow:true,pause:true,repeatedMounts:4,pageErrors:errors};await writeFile(`${output}/${browserName}-race-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(e){for(let i=0;i<pages.length;i++){await pages[i].screenshot({path:`${output}/${browserName}-race-failure-${i}.png`}).catch(()=>{});console.error(i,await pages[i].evaluate(()=>({state:window.__state,room:window.__room,wire:window.__wire?.slice(-3)})).catch(()=>null));}console.error(errors);throw e;}
finally{await Promise.all(contexts.map(c=>c.close()));await browser.close();}
