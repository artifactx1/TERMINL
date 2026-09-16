import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {CAMPAIGN_WORLDS,newCampaignLevel,stepCampaign,CAMPAIGN_KEY} from '../lib/moon-campaign.mjs';
import {campaignPilot} from './moon-campaign-pilot.mjs';
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1365,height:900}}),page=await context.newPage(),errors=[];
const base=process.env.ARCADE_TEST_URL||'http://localhost:4000';
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
const button=name=>page.getByRole('button',{name,exact:true});
try{
  await mkdir('artifacts/arcade-v1',{recursive:true});await page.goto(base+'/os');
  const flagship=page.getByRole('region',{name:'Flagship games'});
  assert.deepEqual(await flagship.getByRole('heading',{level:2}).allTextContents(),['WEN LAMBO','REKT RUMBLE']);
  assert.doesNotMatch(await page.locator('body').innerText(),/receipt|pixel shop|rug runner|credits|trophy cabinet/i);
  console.log('PASS flagship launcher');await page.screenshot({path:'artifacts/arcade-v1/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'artifacts/arcade-v1/mobile.png',fullPage:true});
  await page.getByRole('link',{name:'GO TO THE MOON ↗',exact:true}).click();
  await button('START CAMPAIGN →').click();await button('START LEVEL →').click();
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  const point=async(name,id)=>{const b=await button(name).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2,id};};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await point('Run right',1),await point('Jump',2)]});
  await page.waitForFunction(()=>document.querySelector('canvas[data-level]')?.dataset.input==='6');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(()=>document.querySelector('canvas[data-level]')?.dataset.input==='0');
  await button('PAUSE').click();const tick=await page.locator('canvas[data-level]').getAttribute('data-tick');await page.waitForTimeout(100);assert.equal(await page.locator('canvas[data-level]').getAttribute('data-tick'),tick);
  await page.screenshot({path:'artifacts/arcade-v1/moon-mobile.png'});await button('LEVEL SELECT').click();await cdp.detach();
  await page.goto(base+'/os/rumble');await button('START SOLO CIRCUIT →').click();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='fight');
  assert.match(await page.locator('body').innerText(),/SOLO CIRCUIT · FIGHT 1\/6/);await page.keyboard.press('j');await button('← LEAVE').click();
  await button('CONTINUE CIRCUIT · 1/6 →').waitFor();await page.reload();await button('CONTINUE CIRCUIT · 1/6 →').waitFor();
  await page.close();

  // Real DOM keys on an accelerated animation clock. Never inject positions, health,
  // save data, results, or unlocks. Every level is reached through the real UI.
  const campaign=await context.newPage();campaign.on('pageerror',e=>errors.push(e.message));
  await campaign.setViewportSize({width:1100,height:760});
  await campaign.goto(base+'/os/moon');await campaign.getByRole('button',{name:'START CAMPAIGN →',exact:true}).waitFor();
  await campaign.evaluate(()=>{let now=performance.now(),id=0;const queue=new Map();performance.now=()=>now;window.requestAnimationFrame=fn=>{queue.set(++id,fn);return id;};window.cancelAnimationFrame=id=>queue.delete(id);const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...args){return window.skipCampaignPaint&&this.dataset.level!==undefined?null:getContext.apply(this,args);};window.advanceCampaignFrame=()=>{now+=1000/60+.000001;const callbacks=[...queue.values()];queue.clear();callbacks.forEach(fn=>fn(now));};});
  const click=async name=>campaign.getByRole('button',{name,exact:true}).evaluate(el=>el.click());
  await click('START CAMPAIGN →');
  const clears=[],trapShots=new Set();let bossShot=false;
  for(const world of CAMPAIGN_WORLDS){
    assert.equal(await campaign.locator('canvas[data-level]').getAttribute('data-level'),String(world.level));await click('START LEVEL →');
    await campaign.waitForFunction(()=>document.querySelector('canvas[data-level]')?.dataset.phase==='running',{},{polling:25});
    let state=newCampaignLevel(world.level);
    for(let attempt=0;attempt<4;attempt++){
      let pilot={},prior=0;const moves=[];
      while(!state.ended){const input=campaignPilot(state,pilot);if(input!==prior){moves.push({tick:state.tick,input});prior=input;}state=stepCampaign({...state,input});}
      if(attempt===3)assert.equal(state.won,true,`Level ${world.level+1} must be clearable within three retries`);
      await campaign.evaluate(moves=>{window.campaignPilotMoves=moves;window.campaignPilotIndex=0;window.campaignPilotMask=0;},moves);
      for(let batch=0;batch<150;batch++){
        await campaign.evaluate(()=>{const el=document.querySelector('canvas[data-level]');for(let i=0;i<90;i++){const tick=Number(el.dataset.tick),action=window.campaignPilotMoves[window.campaignPilotIndex];if(action?.tick===tick){for(const [bit,code]of [[1,'ArrowLeft'],[2,'ArrowRight'],[4,'Space']])if(!!(window.campaignPilotMask&bit)!==!!(action.input&bit))window.dispatchEvent(new KeyboardEvent(action.input&bit?'keydown':'keyup',{code,key:code==='Space'?' ':code,bubbles:true,cancelable:true}));window.campaignPilotMask=action.input;window.campaignPilotIndex++;}window.skipCampaignPaint=i<89;window.advanceCampaignFrame();window.skipCampaignPaint=false;if(el.dataset.phase==='complete')break;}});
        const position=Number(await campaign.locator('canvas[data-level]').getAttribute('data-x'));
        for(const trap of world.hazards){if(!trapShots.has(trap.type)&&position>trap.x-260&&position<trap.x-30){await campaign.screenshot({path:`artifacts/arcade-v1/moon-${trap.type}.png`});trapShots.add(trap.type);}}
        if(world.level===9&&!bossShot){const hp=Number(await campaign.locator('canvas[data-level]').getAttribute('data-boss-hp'));if(hp>0&&hp<6){await campaign.screenshot({path:'artifacts/arcade-v1/moon-boss.png'});bossShot=true;}}
        if(await campaign.locator('canvas[data-level]').getAttribute('data-phase')==='complete')break;
      }
      if(state.won)break;
      await campaign.getByRole('button',{name:'RETRY CHECKPOINT →',exact:true}).waitFor();
      const checkpoint=Number(await campaign.locator('canvas[data-level]').getAttribute('data-checkpoint'));assert.equal(checkpoint,state.checkpointIndex);
      await click('RETRY CHECKPOINT →');await click(checkpoint>=0?'RESUME CHECKPOINT →':'START LEVEL →');
      await campaign.waitForFunction(()=>document.querySelector('canvas[data-level]')?.dataset.phase==='running',{},{polling:25});
      state=newCampaignLevel(world.level,checkpoint);
    }
    const saved=await campaign.evaluate(key=>JSON.parse(localStorage.getItem(key)),CAMPAIGN_KEY);
    assert.ok(saved.completed.includes(world.level),`Level ${world.level+1} saved after actual play`);assert.equal(saved.best[world.level],state.score);
    clears.push(world.level+1);console.log(`PASS browser campaign level ${world.level+1}, score ${state.score}`);
    if([0,5,9].includes(world.level))await campaign.screenshot({path:`artifacts/arcade-v1/moon-clear-${world.level+1}.png`});
    if(world.level<9)await click('NEXT LEVEL →');
  }
  await click('VIEW CAMPAIGN →');await campaign.reload();await campaign.getByText('10 / 10 LEVELS CLEARED · CHECKPOINTS SAVE AUTOMATICALLY',{exact:true}).waitFor();
  assert.equal(await campaign.getByRole('region',{name:'Campaign levels'}).getByRole('button',{disabled:true}).count(),0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,flagshipOrder:true,removedClutter:true,touch:true,pause:true,circuitResume:true,campaignClears:clears,finalBoss:true,persistence:true,trapScreenshots:[...trapShots],errors}));await campaign.close();
}catch(error){for(const [i,p]of context.pages().entries()){await p.screenshot({path:`artifacts/arcade-v1/failure-${i}.png`});console.error((await p.locator('body').innerText()).slice(-4000));}throw error;}
finally{await context.close();await browser.close();}
