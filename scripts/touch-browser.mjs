/** Real Chromium touch events, through React handlers into the actual game loop. No game state injection. */
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];
page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(90000);
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.__touchEvents=[];for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture'])window.addEventListener(type,e=>{window.__touchEvents.push({type,id:e.pointerId,target:e.target.getAttribute('aria-label')});window.__touchEvents=window.__touchEvents.slice(-30);},true);});
const base=process.env.ARCADE_TEST_URL||'http://localhost:4000',points=new Map();
const button=name=>page.getByRole('button',{name,exact:true});
const canvas=page.locator('canvas');
async function position(locator,x=.5,y=.5){const r=await locator.boundingBox();assert.ok(r);return{x:r.x+r.width*x,y:r.y+r.height*y};}
async function finger(type,id,point){const released=points.get(id);if(point)points.set(id,{id,...point,radiusX:5,radiusY:5,force:1});else points.delete(id);await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'&&released?[released]:[...points.values()]});}
async function press(id,locator,x=.5,y=.5){await finger('touchStart',id,await position(locator,x,y));}
async function lift(id){await finger('touchEnd',id);}
async function mask(value){await page.waitForFunction(n=>Number(document.querySelector('section[data-input]')?.dataset.input)===n,value);}
async function neutral(){points.clear();await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await mask(0);}
async function layout(game){
  for(const viewport of [{width:390,height:844},{width:844,height:390},{width:320,height:568},{width:568,height:320}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${game} overflow ${viewport.width}`);
    const arena=await canvas.boundingBox();assert.ok(arena.height>=90,`${game} arena ${arena.height} at ${viewport.width}`);
    if(game==='lambo'){
      await page.waitForFunction(()=>document.querySelector('canvas').dataset.mapVisible==='false');
      assert.equal(await page.getByTestId('rival-tracker').isVisible(),false);
      const toggle=page.getByTestId('mobile-rival'),box=await toggle.boundingBox();
      assert.ok(box.width>=44&&box.height>=44);assert.ok(box.y+box.height<=arena.y,'rival HUD stays outside the road');
      await toggle.tap();await page.waitForFunction(()=>document.querySelector('canvas').dataset.mapVisible==='true');
      await toggle.tap();await page.waitForFunction(()=>document.querySelector('canvas').dataset.mapVisible==='false');
    }
    const boxes=await page.locator('section[data-input] button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{label:n.getAttribute('aria-label')||n.textContent,w:r.width,h:r.height,x:r.x,y:r.y};}));
    for(const box of boxes){assert.ok(box.w>=44&&box.h>=44,`${game} target ${JSON.stringify(box)}`);assert.ok(box.x>=0&&box.x+box.w<=viewport.width+1&&box.y+box.h<=viewport.height+1,`${game} clipped ${JSON.stringify(box)}`);}
    await page.screenshot({path:`artifacts/arcade/touch-${game}-${viewport.width}.png`});
  }
  await page.setViewportSize({width:390,height:844});
}
try{
  await mkdir('artifacts/arcade',{recursive:true});
  await page.goto(`${base}/os/lambo`);await button('SIX-COURSE CUP →').tap();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='racing');
  await layout('lambo');
  await page.getByTestId('mobile-rival').tap();
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.mapVisible==='true');
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.mapVisible==='false',null,{timeout:6000});
  assert.equal(await page.getByTestId('mobile-rival').getAttribute('aria-pressed'),'false');
  // Manual mode: BOOST alone includes throttle and visibly consumes boost.
  await button('AUTO GAS ON').tap();await mask(0);
  const initial=Number(await canvas.getAttribute('data-boost'));
  await press(1,button('BOOST'));await mask(36);
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.boosting==='true');
  await page.waitForTimeout(180);
  assert.ok(Number(await canvas.getAttribute('data-boost'))<initial);
  assert.ok(Number(await canvas.getAttribute('data-speed'))>0);
  await lift(1);await mask(0);
  // Steering slides without lifting; the other thumb remains on gas.
  const steering=page.getByRole('group',{name:'Steering thumb pad'});
  await press(1,steering,.1);await press(2,button('GAS'));await mask(5);
  await finger('touchMove',1,await position(steering,.9));await mask(6);
  await lift(1);await mask(4);await lift(2);await mask(0);
  // A held half-travel correction must stay gentle, not ramp to full lock.
  await press(1,steering,.69);await press(2,button('GAS'));
  const gentleSamples=await page.evaluate(()=>new Promise(resolve=>{const values=[],until=performance.now()+1000;function sample(){values.push(Number(document.querySelector('canvas').dataset.steer));if(performance.now()<until)requestAnimationFrame(sample);else resolve(values);}sample();}));
  // Ignore the previous hard-direction test's brief return-to-center transient.
  const gentleMax=Math.max(...gentleSamples.slice(Math.floor(gentleSamples.length/2)).map(Math.abs));
  assert.ok(gentleMax>0&&gentleMax<.19,`gentle steering stayed at ${gentleMax}`);
  await lift(1);await lift(2);await mask(0);
  await press(1,steering,.58);await mask(0);
  await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.steer)===0);await lift(1);
  // Deliberate full-rim steering can now make a tight turn at low speed.
  await press(1,steering,.9);await press(2,button('BRAKE / REV'));
  await page.waitForFunction(()=>Math.abs(Number(document.querySelector('canvas').dataset.steer))>.75);
  await lift(1);await lift(2);await mask(0);
  // Auto-gas remains after a normal lift, but brake overrides it and reverse works.
  await button('AUTO GAS OFF').tap();await mask(4);
  await press(1,button('BRAKE / REV'));await mask(8);
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.gear==='-1');
  await lift(1);await mask(4);
  await press(1,steering,.1);await neutral();
  // Pausing clears ownership and does not restart cruise on resume.
  await press(1,button('GAS'));await lift(1);await button('SETTINGS').tap();await mask(0);
  await button('Close settings').tap();await button('BACK ON TRACK →').tap();await mask(0);
  await button('← LEAVE').tap();

  await page.goto(`${base}/os/rumble`);await page.getByRole('button',{name:/LEARN BY FIGHTING/}).tap();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='fight');
  await layout('rumble');
  const movement=page.getByRole('group',{name:'Movement thumb pad'});
  const observed=[];
  async function attack(label,expected,direction){
    await page.waitForFunction(()=>!document.querySelector('canvas').dataset.action);
    if(direction)await press(1,movement,...direction);
    await press(2,button(label));
    await page.waitForFunction(id=>document.querySelector('canvas').dataset.action===id,expected);
    observed.push(expected);await lift(2);if(direction)await lift(1);
  }
  await attack('LIGHT','light');await attack('HEAVY','heavy');await attack('SPECIAL','special');
  await attack('LIGHT','crouchLight',[.5,.9]);await attack('HEAVY','crouchHeavy',[.5,.9]);await attack('SPECIAL','downSpecial',[.5,.9]);
  await attack('THROW','throw');
  // Jump first, then attack: airborne variants are selected by actual simulation state.
  for(const [label,move] of [['LIGHT','airLight'],['HEAVY','airHeavy']]){
    await page.waitForFunction(()=>!document.querySelector('canvas').dataset.action&&document.querySelector('canvas').dataset.grounded==='true');
    await press(1,movement,.5,.1);await lift(1);
    await page.waitForFunction(()=>document.querySelector('canvas').dataset.grounded==='false');await attack(label,move);
  }
  await page.waitForFunction(()=>!document.querySelector('canvas').dataset.action&&document.querySelector('canvas').dataset.grounded==='true');
  await press(1,movement,.25,.75);await press(2,button('GUARD'));await mask(137);await lift(2);await lift(1);
  await attack('SPECIAL','forwardSpecial',[.9,.5]);
  await page.waitForFunction(()=>!document.querySelector('canvas').dataset.action);
  const beforeDash=Number(await canvas.getAttribute('data-p0'));await press(2,button('DASH'));
  await page.waitForFunction(x=>Math.abs(Number(document.querySelector('canvas').dataset.p0)-x)>20,beforeDash);await lift(2);
  // An unfunded super is explicitly explained, not mistaken for a broken button.
  await press(2,button('SUPER'));assert.match(await button('SUPER').innerText(),/100%/);await lift(2);
  await press(1,movement,.1);await neutral();
  await button('SETTINGS').tap();await mask(0);await button('Close panel').tap();await button('BACK TO IT →').tap();await mask(0);
  await button('← LEAVE').tap();assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,realMultiTouch:true,boostWithOneThumb:true,reverse:true,slideSteering:true,sharpTurn:true,gentleSteerMax:gentleMax,cancelAndPauseRelease:true,observedMoves:observed,layouts:[390,844,320,568],errors}));
}catch(error){await page.screenshot({path:'artifacts/arcade/touch-failure.png'});console.error(await page.evaluate(()=>({events:window.__touchEvents,mask:document.querySelector('section[data-input]')?.dataset.input})));console.error(await page.locator('body').innerText());throw error;}
finally{await context.close();await browser.close();}
