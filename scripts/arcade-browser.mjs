/** Real browser contexts, real WebSocket server, ordinary UI/keyboard inputs.
 * Start npm run dev:arcade + npm run arcade:server first.
 * npx playwright install chromium; npm run test:arcade:browser
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';
const base=process.env.ARCADE_TEST_URL||'http://localhost:4000';
const browserName=process.env.ARCADE_TEST_BROWSER||'chromium';
const browser=await ({chromium,firefox,webkit}[browserName]).launch({headless:true,...(process.env.ARCADE_BROWSER_EXECUTABLE?{executablePath:process.env.ARCADE_BROWSER_EXECUTABLE}:{})});
const output='artifacts/arcade';await mkdir(output,{recursive:true});
const errors=[],contexts=[],pages=[];
async function guest(name){
  const context=await browser.newContext({viewport:{width:1440,height:900}});contexts.push(context);
  await context.addInitScript(()=>{
    const Original=window.WebSocket;window.__wire=[];window.__sockets=[];
    window.WebSocket=class extends Original {constructor(...args){super(...args);window.__sockets.push(this);this.addEventListener('message',event=>{try{const data=JSON.parse(event.data);window.__wire.push(data);if(window.__wire.length>500)window.__wire.shift();if(data.state)window.__state=data.state;if(data.type==='room')window.__room=data.room;if(data.type==='result')window.__result=data.result;}catch{}});}};
  });
  const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(`${name}: ${e.message}`));
  await page.goto(`${base}/os/rumble`);await page.getByRole('button',{name:'CREATE A ROOM +',exact:true}).waitFor();
  await page.getByLabel('YOUR CALLSIGN').fill(name);return page;
}
async function click(page,name){await page.getByRole('button',{name,exact:true}).click();}
try{
  const a=await guest('Alice'),b=await guest('Bob'),spectator=await guest('Observer');
  await a.screenshot({path:`${output}/${browserName}-select.png`,fullPage:true});
  await click(a,'CREATE A ROOM +');await a.getByLabel('Room invitation').waitFor();const invite=await a.getByLabel('Room invitation').inputValue();
  await b.getByRole('button',{name:/02 Diamond Hands Pepe/}).click();await b.getByLabel('FRIEND INVITATION').fill(invite);await click(b,'JOIN FIGHT →');
  await spectator.getByLabel('FRIEND INVITATION').fill(invite);await click(spectator,'SPECTATE');
  await a.waitForFunction(()=>window.__room?.players.every(Boolean)&&window.__room.spectators===1);
  await click(a,"I'M READY →");await click(b,"I'M READY →");
  await Promise.all(pages.map(p=>p.waitForFunction(()=>window.__state?.phase==='fight')));
  const originalX=await b.evaluate(()=>window.__state.players[0].x);
  await a.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
  await b.waitForFunction(x=>window.__state.players[0].x>x+40,originalX);
  await a.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowRight',bubbles:true})));
  const movement=await b.evaluate(()=>window.__state.players[0].x);assert.ok(movement>originalX+40);
  const shared=await spectator.evaluate(()=>({tick:window.__state.tick,x:window.__state.players[0].x}));assert.ok(shared.x>originalX+40);
  // A real disconnect/reconnect uses the client's saved scoped session, not a new seat.
  const match=await b.evaluate(()=>window.__room.matchId);await b.evaluate(()=>window.__sockets.find(s=>s.url.includes(':4010'))?.close());
  await b.waitForFunction(id=>window.__room?.matchId===id&&window.__wire.filter(m=>m.type==='joined').length>=2,match);
  assert.equal(await b.evaluate(()=>window.__room.matchId),match);
  // Deliberately fight through normal DOM key handlers; no score/state injection.
  for(const [page,slot]of [[a,0],[b,1]])await page.evaluate(({slot})=>{
    let previous=0,started=performance.now();window.__combatEvents=new Set();
    window.__pilot=setInterval(()=>{
      const s=window.__state;if(!s)return;for(const e of s.events)window.__combatEvents.add(e.type);
      let input=0;
      if(s.phase==='fight'){
        const me=s.players[slot],other=s.players[1-slot],d=Math.abs(me.x-other.x),toward=other.x>me.x?2:1;
        if(slot===1){if(performance.now()-started<5000)input=d>75?toward:128;}
        else if(d>80)input=toward|(s.tick%70<10?256:0);
        else if(me.meter>=1000)input=s.tick%20<10?1024:0;
        else {const phase=s.tick%110;input=phase<12?32:phase>=42&&phase<52?512:phase>=75&&phase<85?72:0;}
      }
      for(const [bit,key]of [[1,'ArrowLeft'],[2,'ArrowRight'],[4,'ArrowUp'],[8,'ArrowDown'],[16,'j'],[32,'k'],[64,'l'],[128,'Shift'],[256,'q'],[512,'e'],[1024,'r']])if((previous&bit)!==(input&bit))window.dispatchEvent(new KeyboardEvent(input&bit?'keydown':'keyup',{key,bubbles:true}));
      previous=input;if(window.__result){clearInterval(window.__pilot);}
    },16);
  },{slot});
  await a.waitForFunction(()=>window.__state.players.some(p=>p.hp<950));
  await a.screenshot({path:`${output}/${browserName}-fight.png`});
  await Promise.all(pages.map(p=>p.waitForFunction(()=>window.__result?.status==='completed',null,{timeout:180000})));
  const results=await Promise.all(pages.map(p=>p.evaluate(()=>({id:window.__result.id,winner:window.__result.winner,wins:window.__result.wins,tick:window.__result.tick}))));
  assert.deepEqual(results[0],results[1]);assert.deepEqual(results[0],results[2]);
  await a.screenshot({path:`${output}/${browserName}-result.png`});
  const events=await a.evaluate(()=>[...window.__combatEvents]);assert.ok(events.includes('hit'));assert.ok(events.includes('block'));assert.ok(events.includes('throw'));
  await click(a,'VOTE REMATCH →');await a.getByRole('button',{name:'WAITING FOR OPPONENT…'}).waitFor();await click(b,'VOTE REMATCH →');
  await Promise.all(pages.map(p=>p.waitForFunction(id=>window.__room.matchId!==id&&window.__state.phase==='intro',results[0].id)));
  const rematch=await a.evaluate(()=>window.__room.matchId);assert.notEqual(rematch,results[0].id);
  // A forfeit must render the server's winner even when combat state had no KO.
  await click(b,'← LEAVE');await a.getByRole('heading',{name:'BAG SECURED.',exact:true}).waitFor();
  await click(a,'← LEAVE');await a.setViewportSize({width:390,height:844});await click(a,'PRACTICE VS. BOT →');
  await a.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='fight');
  await a.screenshot({path:`${output}/${browserName}-mobile.png`});
  assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await a.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  const paused=await a.locator('canvas').getAttribute('data-tick');await a.waitForTimeout(250);assert.equal(await a.locator('canvas').getAttribute('data-tick'),paused);
  await click(a,'← LEAVE');for(let i=0;i<4;i++){await click(a,'PRACTICE VS. BOT →');await click(a,'← LEAVE');}
  assert.equal(errors.length,0,errors.join('\n'));
  const report={browser:browserName,contexts:3,serverObservedMovement:{from:originalX,to:movement,spectator:shared},result:results[0],events,reconnectSameMatch:true,rematch:true,forfeitWinnerCorrect:true,mobileNoOverflow:true,pauseStable:true,repeatedMounts:4,pageErrors:errors};
  await writeFile(`${output}/${browserName}-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){for(let i=0;i<pages.length;i++){await pages[i].screenshot({path:`${output}/${browserName}-failure-${i}.png`}).catch(()=>{});console.error(i,await pages[i].evaluate(()=>({state:window.__state,room:window.__room,wire:window.__wire.slice(-5)})).catch(()=>null));}console.error(errors);throw error;}
finally{await Promise.all(contexts.map(c=>c.close()));await browser.close();}
