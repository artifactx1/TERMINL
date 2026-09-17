/** Two actual browser clients -> local authority -> journal -> authenticated replay.
 * No state injection. This is a short integration check, NOT a full online cup.
 */
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {startArcadeServer} from '../server/arcade/index.mjs';
import {CUP_TRACKS,TRACKS,RACE_RULES,raceHash,RACE_RULES_VERSION} from '../lib/arcade/race-sim.mjs';
import {replayFight} from '../lib/arcade/rollback.mjs';

const base=process.env.ARCADE_TEST_URL||'http://localhost:4000';
const dataDir=await mkdtemp(join(tmpdir(),'terminl-grand-tour-'));
const runtime=await startArcadeServer({port:0,dataDir,allowedOrigins:[new URL(base).origin]});
const browser=await chromium.launch({headless:true}),contexts=[],errors=[];
const authority=`http://127.0.0.1:${runtime.address.port}`;
const button=(page,name)=>page.getByRole('button',{name,exact:true});
try{
  const pages=[];
  for(const name of ['Tour A','Tour B']){
    const mobile=name==='Tour B';
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1000,height:800},isMobile:mobile,hasTouch:mobile});contexts.push(context);
    // Redirect transport to this test's isolated server; inputs still originate in the real UI.
    await context.addInitScript(url=>{
      const Original=window.WebSocket;
      window.WebSocket=class extends Original{constructor(){super(url);window.__socket=this;this.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.type==='joined'){window.__joined=m;window.__joins=(window.__joins||0)+1;}if(m.state)window.__state=m.state;if(m.type==='result')window.__result=m.result;});}};
    },`ws://127.0.0.1:${runtime.address.port}`);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}/os/lambo`);await page.getByLabel('YOUR CALLSIGN').fill(name);pages.push(page);
  }
  const [a,b]=pages;
  for(const track of CUP_TRACKS){
    await a.getByRole('button',{name:new RegExp(TRACKS[track].name+' route preview')}).click();
    await button(a,'CREATE RACE +').click();const link=await a.getByLabel('Room invitation').inputValue();
    await b.getByLabel('RACE INVITATION').fill(link);await button(b,'JOIN RACE →').click();
    await button(a,"I'M READY →").click();await button(b,"I'M READY →").click();
    await a.waitForFunction(track=>window.__state?.track===track&&window.__state.phase==='racing',track);
    const state=await a.evaluate(()=>window.__state);assert.equal(state.version,RACE_RULES_VERSION);assert.equal(state.tracks.length,6);
    if(track===CUP_TRACKS[0]){await b.evaluate(()=>window.__socket.close());await b.waitForFunction(()=>window.__joins>=2);}
    await a.keyboard.down('ArrowUp');await a.waitForFunction(()=>window.__state.players[0].speed>.2);await a.keyboard.up('ArrowUp');
    await a.getByTestId('rival-tracker').waitFor();await b.getByTestId('mobile-rival').waitFor();
    const cdp=await contexts[1].newCDPSession(b),pad=await b.getByRole('group',{name:'Steering thumb pad'}).boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:pad.x+pad.width*.69,y:pad.y+pad.height/2}]});
    await b.waitForFunction(()=>{const p=window.__state.players[1];return (p.previousInput>>7)>128&&p.steer>.05;});
    const axis=await b.evaluate(()=>((window.__state.players[1].previousInput>>7)-128)/127);
    assert.ok(axis>.25&&axis<.31,'authority receives actual mobile thumb magnitude');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    const old=await a.evaluate(()=>window.__result?.id);await button(b,'← LEAVE').click();
    await a.waitForFunction(old=>window.__result&&window.__result.id!==old,old);
    const {result,session}=await a.evaluate(()=>({result:window.__result,session:window.__joined.session}));
    assert.equal(result.winner,0);assert.equal(result.rulesVersion,RACE_RULES_VERSION);assert.equal(result.rewards,false);
    const response=await fetch(`${authority}/replays/${result.id}`,{headers:{authorization:`Bearer ${session}`}});assert.equal(response.status,200);
    const {replay}=await response.json();assert.equal(raceHash(replayFight(replay,RACE_RULES)),replay.hash);
    await button(a,'← LEAVE').click();
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,onlineCourseStarts:6,browserPlayers:2,mobileAnalogAuthority:true,reconnect:true,forfeit:true,authenticatedReplays:6,fullOnlineCup:false,errors}));
}finally{await Promise.all(contexts.map(c=>c.close()));await browser.close();await runtime.close();await rm(dataDir,{recursive:true,force:true});}
