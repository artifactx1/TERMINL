import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createChallengeRace} from '../lib/arcade/bot-challenge.mjs';
import {circuitFight} from '../lib/arcade/rumble-challenge.mjs';
import {stepRace,raceBotInput} from '../lib/arcade/race-sim.mjs';
import {stepFight,botInput,INPUT} from '../lib/arcade/rumble-sim.mjs';
import {circuitInput} from '../lib/arcade/rumble-circuit.mjs';

// Runs only against the separate localhost fixture (scripts/campaign-browser-service.mjs),
// which simulates identity providers and runs a 20x clock.
const base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4005';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Use an isolated localhost campaign fixture');
await mkdir('artifacts/campaign',{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];
page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));

/** Replaces animation frames and the gamepad so the test feeds exact input masks. */
async function installController(buttons){
  await page.evaluate(map=>{
    let now=performance.now(),id=0;const frames=new Map();performance.now=()=>now;
    window.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};window.cancelAnimationFrame=id=>frames.delete(id);
    const pad={connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[pad];
    window.driveFrame=mask=>{
      const analog=map.analog&&(mask>>7)?((mask>>7)-128)/127:0;pad.axes[0]=analog?Math.sign(analog)*(.18+.82*Math.pow(Math.abs(analog),1/1.5)):0;
      for(let i=0;i<16;i++)pad.buttons[i]={pressed:false,value:0};
      for(const [bit,button]of map.buttons)if(mask&bit)pad.buttons[button]={pressed:true,value:1};
      now+=1000/60+.000001;const queue=[...frames.values()];frames.clear();queue.forEach(fn=>fn(now));};
    for(const name of ['drawImage','fill','stroke','fillRect','strokeRect','fillText','strokeText','clearRect']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){if(!window.skipPaint)return original.apply(this,args);};}
  },buttons);
}
const fixtureMs=ticks=>Math.ceil(ticks*1000/60/20)+500;
/** The game submits a result on its final tick, so wait out the run's duration first. */
async function driveInRealTime(masks){await drive(masks.slice(0,-1));await page.waitForTimeout(fixtureMs(masks.length));await drive(masks.slice(-1));}
async function drive(masks){
  for(let i=0;i<masks.length;i+=240)await page.evaluate(inputs=>{for(let j=0;j<inputs.length;j++){window.skipPaint=j<inputs.length-1;window.driveFrame(inputs[j]);}window.skipPaint=false;},masks.slice(i,i+240));
}
/** Extra neutral frames after a result flush the 100ms React HUD cadence. Only safe
 * once the simulation has stopped consuming input for this run. */
const settle=()=>page.evaluate(()=>{for(let i=0;i<10;i++)window.driveFrame(0);});
const pressure=s=>{if(s.phase==='finishWindow')return botInput(s,0);const p=s.players[0],e=s.players[1];return Math.abs(p.x-e.x)>90?(p.x<e.x?INPUT.RIGHT:INPUT.LEFT):INPUT.DOWN|(s.tick%14<2?INPUT.HEAVY:0);};
try{
  // Barry Cup: six real races through the game, each verified by the service as it ends.
  await page.goto(base+'/beat-the-bots');await page.getByRole('link',{name:'PLAY BARRY CUP →'}).click();
  await page.getByRole('button',{name:'START THE BARRY CUP →'}).waitFor();
  await installController({analog:true,buttons:[[1,14],[2,15],[4,7],[8,6],[16,2],[32,5],[64,3]]});
  const issued=page.waitForResponse(r=>r.url().endsWith('/api/campaign/runs')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'START THE BARRY CUP →'}).click();const attempt=await (await issued).json();
  assert.equal(attempt.kind,'cup');await page.locator('canvas[aria-label^="WEN LAMBO race"]').waitFor();
  let race=createChallengeRace(attempt.challenge);const raceMasks=[],cuts=[];
  while(race.phase!=='finished'){const input=raceBotInput(race,0,{...attempt.challenge.bot,pace:1.05,cornerPace:1.03,boostChance:1,seed:7});raceMasks.push(input);const before=race.raceResults.length;race=stepRace(race,[input,raceBotInput(race,1,attempt.challenge.bot)]);if(race.raceResults.length>before)cuts.push(raceMasks.length);}
  assert.equal(race.winner,0);assert.equal(cuts.length,6);
  // Each race reaches the server only after its duration on the 20x fixture clock.
  let from=0;
  for(const to of cuts){await driveInRealTime(raceMasks.slice(from,to));from=to;}
  await drive(raceMasks.slice(from));await settle();
  assert.equal(await page.locator('canvas[aria-label^="WEN LAMBO race"]').getAttribute('data-phase'),'finished');
  await page.getByRole('heading',{name:'CUP SECURED.',exact:true}).waitFor({timeout:60000});
  await page.screenshot({path:'artifacts/campaign/cup-secured.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/campaign/mobile-cup.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.route('https://x.com/i/oauth2/authorize*',async route=>{
    const url=new URL(route.request().url()),callback=new URL(url.searchParams.get('redirect_uri'));callback.searchParams.set('state',url.searchParams.get('state'));callback.searchParams.set('code','9991001');
    await route.fulfill({status:302,headers:{location:callback.href},body:''});
  });
  await page.getByRole('button',{name:'SAVE MY WL SPOT →'}).click();await page.waitForURL('**/arcade-pass?run=*');
  await page.getByLabel('Show my handle or account ID on public cards and the leaderboard').check();
  await page.getByRole('button',{name:'CONTINUE WITH X →'}).click();
  await page.waitForURL('**/arcade-pass?*');await page.getByText('Barry Cup FCFS WL spot saved.',{exact:false}).waitFor();
  await page.getByText('FINAL STEP / WL SETUP',{exact:true}).waitFor();
  await page.getByLabel('ROBINHOOD CHAIN WALLET ADDRESS').fill('0x52908400098527886E0F7030069857D2E4169EE7');
  await page.getByLabel('I control this address and want to use it to mint on Robinhood Chain mainnet.').check();
  await page.getByRole('button',{name:'SAVE MINT ADDRESS',exact:true}).click();await page.getByText('Your WL setup is complete.',{exact:false}).waitFor();
  await page.screenshot({path:'artifacts/campaign/mobile-pass.png',fullPage:true});
  const share=page.getByRole('link',{name:'OPEN YOUR CARD →'});const url=await share.getAttribute('href');await share.click();
  await page.getByRole('heading',{name:/@testdegen took the Barry Cup/}).waitFor();
  const card=await page.request.get(base+'/api/challenge-card/'+url.split('/').at(-1));assert.equal(card.status(),200,await card.text().catch(()=>''));assert.match(card.headers()['content-type'],/image\/png/);
  await writeFile('artifacts/campaign/share-card.png',await card.body());
  await page.screenshot({path:'artifacts/campaign/mobile-challenge.png',fullPage:true});
  assert.match(await page.locator('meta[property="og:image"]').getAttribute('content'),/api\/challenge-card/);
  await page.getByRole('link',{name:'ACCEPT CHALLENGE →'}).click();await page.waitForURL('**/os/lambo?*');assert.match(page.url(),/ref=/);await page.getByRole('button',{name:'START THE BARRY CUP →'}).waitFor();

  // Rekt Rumble circuit: six seeded fights, retries included, while signed in.
  await page.setViewportSize({width:1280,height:900});
  await page.goto(base+'/os/rumble');await page.getByRole('button',{name:/^START AS /}).waitFor();
  await installController({analog:false,buttons:[[1,14],[2,15],[4,0],[8,13],[16,2],[32,3],[64,1],[128,4],[256,5],[512,6],[1024,7]]});
  const circuitIssued=page.waitForResponse(r=>r.url().endsWith('/api/campaign/runs')&&r.request().method()==='POST');
  await page.getByRole('button',{name:/^START AS /}).click();const circuit=await (await circuitIssued).json();
  assert.equal(circuit.kind,'rumble');let progress={index:0,attempts:0,fights:[]};
  while(progress.index<6){
    let {circuit:c,seed,state}=circuitFight(circuit.challenge,progress);const masks=[];
    while(state.phase!=='finished'){const input=pressure(state);masks.push(input);state=stepFight(state,[input,circuitInput(state,c,seed)]);}
    await driveInRealTime(masks);await settle();progress={index:progress.index+(state.winner===0?1:0),attempts:progress.attempts+1,fights:[]};
    if(progress.index===6)break;
    const next=page.getByRole('button',{name:state.winner===0?'NEXT OPPONENT →':'RETRY FIGHT →'});await next.waitFor();await next.click();
  }
  await page.getByRole('heading',{name:'CIRCUIT CLEARED.',exact:true}).waitFor({timeout:60000});
  await page.screenshot({path:'artifacts/campaign/circuit-cleared.png'});
  await page.getByRole('button',{name:'SAVE MY WL SPOT →'}).click();await page.waitForURL('**/arcade-pass?saved=*');
  await page.getByText('Rekt Rumble Circuit FCFS WL spot saved.',{exact:false}).waitFor();
  assert.equal(await page.getByText('FCFS WL SPOT',{exact:true}).count(),2,'both routes show a confirmed spot');
  await page.screenshot({path:'artifacts/campaign/pass-two-spots.png',fullPage:true});

  await page.goto(base+'/leaderboard');await page.getByRole('cell',{name:'@testdegen'}).waitFor();
  await page.getByRole('cell',{name:'CUP + RUMBLE'}).waitFor();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/campaign/mobile-leaderboard.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.goto(base+'/admin/campaign');await page.getByLabel('CAMPAIGN ADMIN TOKEN').fill('local-admin-test');await page.getByRole('button',{name:'OPEN DASHBOARD'}).click();await page.getByRole('heading',{name:'Campaign and routes'}).waitFor();await page.screenshot({path:'artifacts/campaign/mobile-admin.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log(`PASS input-driven Barry Cup, ${progress.attempts}-attempt Rekt Rumble circuit, X sign-in fixture, two FCFS spots, address, challenge page, OG card, leaderboard and admin`);
}catch(error){await page.screenshot({path:'artifacts/campaign/failure.png'}).catch(()=>{});console.error((await page.locator('body').innerText()).slice(-3500));throw error;}finally{await browser.close();}
