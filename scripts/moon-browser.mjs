import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {MOON_WORLDS,moonBotReplay,replayMoon} from '../lib/moon-mission.mjs';
import {decodeChallenge} from '../lib/terminl-game.mjs';

const browserName=process.env.ARCADE_TEST_BROWSER||'chromium';
const browser=await({chromium,webkit}[browserName]).launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800}});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.setDefaultTimeout(15000);
const base=process.env.ARCADE_TEST_URL||'http://localhost:4001';
await mkdir('artifacts/moon',{recursive:true});
try{
  if(!process.argv.includes('--flow-only')){
  await page.goto(base+'/os');
  await page.getByRole('button',{name:/MOON MISSION RUN/}).click();
  assert.equal(await page.getByRole('region',{name:'Moon Mission worlds',exact:true}).getByRole('button').count(),10);
  await page.screenshot({path:`artifacts/moon/${browserName}-world-select.png`,fullPage:true});
  for(const world of MOON_WORLDS){
    await page.getByRole('button',{name:new RegExp(world.name+' (EXPLORER|ADVENTURER|MOONSHOT)')}).click();
    await page.getByRole('button',{name:'PLAY MOON MISSION',exact:true}).click();
    const canvas=page.locator('canvas[data-level]');
    assert.equal(await canvas.getAttribute('data-level'),String(world.level));
    await page.getByRole('button',{name:/LAUNCH WORLD/}).click();
    await page.waitForFunction(()=>Number(document.querySelector('canvas[data-level]')?.dataset.tick)>5);
    await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);await page.keyboard.down(' ');await page.waitForTimeout(100);await page.keyboard.up(' ');await page.keyboard.up('ArrowRight');
    assert.ok(Number(await canvas.getAttribute('data-x'))>90);
    await page.getByRole('button',{name:'Ⅱ PAUSE',exact:true}).click();
    const tick=await canvas.getAttribute('data-tick');await page.waitForTimeout(80);assert.equal(await canvas.getAttribute('data-tick'),tick);
    await page.getByRole('button',{name:'BACK TO THE MISSION →',exact:true}).click();
    await page.screenshot({path:`artifacts/moon/${browserName}-world-${world.level+1}.png`});
    await page.getByRole('button',{name:'← ARCADE',exact:true}).click();
    await page.getByRole('button',{name:'End run',exact:true}).click();
  }
  // Real simultaneous Chromium touch input; verify rotation and input release.
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:/Cold Storage ADVENTURER/}).click();
  await page.getByRole('button',{name:'PLAY MOON MISSION',exact:true}).click();
  await page.getByRole('button',{name:/LAUNCH WORLD/}).click();
  const canvas=page.locator('canvas[data-level]');
  if(browserName==='chromium'){
    const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    const right=await page.getByRole('button',{name:'Run right',exact:true}).boundingBox(),jump=await page.getByRole('button',{name:'Jump',exact:true}).boundingBox();
    const point=(r,id)=>({x:r.x+r.width/2,y:r.y+r.height/2,id});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(right,1),point(jump,2)]});
    await page.waitForFunction(()=>document.querySelector('canvas[data-level]').dataset.input==='6');
    await page.waitForTimeout(300);assert.ok(Number(await canvas.getAttribute('data-x'))>90);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>document.querySelector('canvas[data-level]').dataset.input==='0');
    await cdp.detach();
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`artifacts/moon/${browserName}-mobile-portrait.png`});
  await page.setViewportSize({width:844,height:390});
  await page.screenshot({path:`artifacts/moon/${browserName}-mobile-landscape.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);

  }
  await page.close();

  // Drive a complete world via keyboard events and a controlled animation clock.
  // No game state, score, result, or local save is injected.
  const campaign=await context.newPage();campaign.on('pageerror',e=>errors.push(e.message));
  await campaign.addInitScript(()=>{
    let now=0,id=0;const callbacks=new Map();
    performance.now=()=>now;
    window.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};
    window.cancelAnimationFrame=key=>callbacks.delete(key);
    window.advanceMoonFrame=()=>{now+=16;const pending=[...callbacks.values()];callbacks.clear();for(const fn of pending)fn(now);};
  });
  await campaign.goto(base+'/os');
  // Native DOM clicks avoid Playwright's stability check depending on our paused RAF.
  const clickText=async text=>{await campaign.getByRole('button',{name:text,exact:true}).evaluate(el=>el.click());};
  await campaign.getByRole('button',{name:/MOON MISSION RUN/}).evaluate(el=>el.click());
  await campaign.getByRole('button',{name:/Orbital Shipyard MOONSHOT/}).evaluate(el=>el.click());
  await clickText('PLAY MOON MISSION');await clickText('LAUNCH WORLD 09 →');
  await campaign.waitForFunction(()=>document.querySelector('canvas[data-level]')?.dataset.phase==='running',{},{polling:50});
  const seed=await campaign.evaluate(()=>`daily-${new Date().toISOString().slice(0,10)}`),record=moonBotReplay(seed,'chloe',8),expected=replayMoon(record);
  for(let batch=0;batch<25;batch++){
    await campaign.evaluate(({moves,endTick})=>{
      const canvas=document.querySelector('canvas[data-level]');if(!canvas||canvas.dataset.phase!=='running')return;
      let mask=window.moonDriverMask||0;
      for(let i=0;i<120;i++){
        const tick=Math.max(window.moonDriverTick||0,Number(canvas.dataset.tick));if(tick>=endTick)break;
        const action=moves.find(m=>m.tick===tick);
        if(action){for(const [bit,key]of [[1,'ArrowLeft'],[2,'ArrowRight'],[4,' ']])if(!!(mask&bit)!==!!(action.input&bit))window.dispatchEvent(new KeyboardEvent(action.input&bit?'keydown':'keyup',{key,bubbles:true,cancelable:true}));mask=action.input;}
        window.advanceMoonFrame();
        window.moonDriverTick=Math.max(tick,Number(canvas.dataset.tick));
      }
      window.moonDriverMask=mask;
    },record);
    if(await campaign.getByText('WE MADE IT.',{exact:true}).count())break;
  }
  await campaign.getByRole('button',{name:'NEXT WORLD →',exact:true}).waitFor();
  const saved=await campaign.evaluate(()=>JSON.parse(localStorage.getItem('terminl-os:v2')));
  assert.ok(saved.moonClears.includes(8));assert.equal(saved.history[0].score,expected.score);
  await campaign.screenshot({path:`artifacts/moon/${browserName}-world-cleared.png`});
  await clickText('CHALLENGE A FRIEND');
  const link=await campaign.locator('textarea[readonly]').inputValue();
  const decoded=decodeChallenge(new URLSearchParams(new URL(link).hash.slice(1)).get('challenge'));
  assert.equal(decoded.level,8);assert.equal(replayMoon(decoded).score,expected.score);
  await campaign.getByRole('button',{name:'Close dialog',exact:true}).evaluate(el=>el.click());
  await clickText('NEXT WORLD →');assert.equal(await campaign.locator('canvas[data-level]').getAttribute('data-level'),'9');
  await campaign.reload();await campaign.getByRole('button',{name:/MOON MISSION RUN/}).evaluate(el=>el.click());
  assert.equal(await campaign.getByRole('button',{name:/09 CLEARED ✓ Orbital Shipyard/}).count(),1);
  await campaign.goto(base+'/os'+new URL(link).hash);
  await campaign.getByRole('button',{name:'Accept challenge',exact:true}).evaluate(el=>el.click());
  assert.equal(await campaign.locator('canvas[data-level]').getAttribute('data-level'),'8');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({browser:browserName,...(!process.argv.includes('--flow-only')?{worlds:10,keyboard:true,pause:true,mobilePortrait:true,mobileLandscape:true,multiTouch:browserName==='chromium'}:{}),completeRun:true,persistedClear:true,nextWorld:true,sharedWorld:true,errors}));
  await campaign.close();
}catch(error){for(const [i,openPage]of context.pages().entries()){await openPage.screenshot({path:`artifacts/moon/${browserName}-failure-${i}.png`});console.error(await openPage.locator('body').innerText());}throw error;}
finally{await context.close();await browser.close();}
