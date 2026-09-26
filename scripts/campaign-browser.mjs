import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createChallengeRace} from '../lib/arcade/bot-challenge.mjs';
import {stepRace,raceBotInput} from '../lib/arcade/race-sim.mjs';

// This suite intercepts X only against the separate localhost test fixture.
const base=process.env.ARCADE_TEST_URL||'http://127.0.0.1:4005';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Use an isolated localhost campaign fixture');
await mkdir('artifacts/campaign',{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];
page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(base+'/beat-the-bots');await page.getByRole('link',{name:'RACE BARRYBOT →'}).click();
  await page.getByRole('button',{name:'PROVE HIM WRONG →'}).waitFor();
  await page.evaluate(()=>{
    let now=performance.now(),id=0;const frames=new Map();performance.now=()=>now;
    window.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};window.cancelAnimationFrame=id=>frames.delete(id);
    const pad={connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[pad];
    window.driveFrame=mask=>{const target=(mask>>7)?((mask>>7)-128)/127:0;pad.axes[0]=target?Math.sign(target)*(.18+.82*Math.pow(Math.abs(target),1/1.5)):0;
      for(let i=0;i<16;i++)pad.buttons[i]={pressed:false,value:0};
      for(const [bit,button]of [[1,14],[2,15],[4,7],[8,6],[16,2],[32,5],[64,3]])if(mask&bit)pad.buttons[button]={pressed:true,value:1};
      now+=1000/60+.000001;const queue=[...frames.values()];frames.clear();queue.forEach(fn=>fn(now));};
    for(const name of ['drawImage','fill','stroke','fillRect','strokeRect','fillText','strokeText','clearRect']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){if(!window.skipPaint)return original.apply(this,args);};}
  });
  const issued=page.waitForResponse(r=>r.url().endsWith('/api/campaign/runs')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'PROVE HIM WRONG →'}).click();const attempt=await (await issued).json();
  assert.ok(attempt.id);await page.locator('canvas[aria-label^="WEN LAMBO race"]').waitFor();
  const masks=[];let state=createChallengeRace(attempt.challenge);
  while(state.phase!=='finished'&&state.tick<18000){const input=raceBotInput(state,0,{...attempt.challenge.bot,pace:1.05,cornerPace:1.03,boostChance:1,seed:7});masks.push(input);state=stepRace(state,[input,raceBotInput(state,1,attempt.challenge.bot)]);}
  assert.equal(state.winner,0);
  for(let i=0;i<masks.length;i+=120)await page.evaluate(inputs=>{for(let j=0;j<inputs.length;j++){window.skipPaint=j<inputs.length-1;window.driveFrame(inputs[j]);}window.skipPaint=false;},masks.slice(i,i+120));
  // Flush the 100ms React HUD cadence after the simulation stops recording.
  await page.evaluate(()=>{for(let i=0;i<10;i++)window.driveFrame(0);});
  assert.equal(await page.locator('canvas[aria-label^="WEN LAMBO race"]').getAttribute('data-phase'),'finished');
  // The server intentionally refuses accelerated browser-clock submissions.
  const legalAt=attempt.startedAt+masks.length*1000/60+1000;
  while(Date.now()<legalAt){console.log('Waiting for real-time verification window',Math.ceil((legalAt-Date.now())/1000),'seconds');await page.waitForTimeout(Math.min(20000,legalAt-Date.now()));}
  if(await page.getByRole('button',{name:'RETRY VERIFICATION'}).isVisible())await page.getByRole('button',{name:'RETRY VERIFICATION'}).click();
  await page.getByRole('heading',{name:'BOT DEFEATED.',exact:true}).waitFor({timeout:30000});
  await page.screenshot({path:'artifacts/campaign/verified-win.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/campaign/mobile-win.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.route('https://x.com/i/oauth2/authorize*',async route=>{
    const url=new URL(route.request().url()),callback=new URL(url.searchParams.get('redirect_uri'));callback.searchParams.set('state',url.searchParams.get('state'));callback.searchParams.set('code','9991001');
    await route.fulfill({status:302,headers:{location:callback.href},body:''});
  });
  await page.getByLabel('Show my X handle on my public card and leaderboard entry').check();
  await page.getByRole('button',{name:'SAVE ACCESS WITH X →'}).click();
  await page.waitForURL('**/arcade-pass?*');await page.getByText('ARCADE QUALIFIED',{exact:true}).waitFor();
  await page.getByLabel('PUBLIC WALLET ADDRESS').fill('0x52908400098527886E0F7030069857D2E4169EE7');
  await page.getByLabel('I control this address and want to use it to mint on Robinhood Chain mainnet.').check();
  await page.getByRole('button',{name:'SAVE ADDRESS',exact:true}).click();await page.getByText('Mint address saved.',{exact:false}).waitFor();
  await page.screenshot({path:'artifacts/campaign/mobile-pass.png',fullPage:true});
  const share=page.getByRole('link',{name:'OPEN YOUR CARD →'});const url=await share.getAttribute('href');await share.click();
  await page.getByRole('heading',{name:/@testdegen beat Barry/}).waitFor();
  const card=await page.request.get(base+'/api/challenge-card/'+url.split('/').at(-1));assert.equal(card.status(),200,await card.text().catch(()=>''));assert.match(card.headers()['content-type'],/image\/png/);
  await writeFile('artifacts/campaign/share-card.png',await card.body());
  await page.screenshot({path:'artifacts/campaign/mobile-challenge.png',fullPage:true});
  assert.match(await page.locator('meta[property="og:image"]').getAttribute('content'),/api\/challenge-card/);
  await page.getByRole('link',{name:'ACCEPT CHALLENGE →'}).click();await page.waitForURL('**/os/lambo?*');assert.match(page.url(),/ref=/);await page.getByRole('button',{name:'PROVE HIM WRONG →'}).waitFor();
  await page.goto(base+'/admin/campaign');await page.getByLabel('CAMPAIGN ADMIN TOKEN').fill('local-admin-test');await page.getByRole('button',{name:'OPEN DASHBOARD'}).click();await page.getByRole('heading',{name:'Campaign and target'}).waitFor();await page.screenshot({path:'artifacts/campaign/mobile-admin.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS official input-driven race, verified win, X callback fixture, pass, address, public challenge, OG card and admin');
}catch(error){await page.screenshot({path:'artifacts/campaign/failure.png'}).catch(()=>{});console.error((await page.locator('body').innerText()).slice(-3500));throw error;}finally{await browser.close();}
