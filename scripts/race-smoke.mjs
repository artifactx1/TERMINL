import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,firefox,webkit} from 'playwright';
const name=process.env.ARCADE_TEST_BROWSER||'chromium',browser=await({chromium,firefox,webkit}[name]).launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
page.setDefaultNavigationTimeout(90000);
page.on('pageerror',e=>errors.push(e.message));await mkdir('artifacts/arcade',{recursive:true});
try{
  await page.goto((process.env.ARCADE_TEST_URL||'http://localhost:4000')+'/os/lambo');await page.getByRole('button',{name:'SIX-COURSE CUP →',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='racing');
  await page.screenshot({path:`artifacts/arcade/${name}-california-start.png`});
  await page.keyboard.down('ArrowDown');await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.gear==='-1');await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(200);const turning=await page.locator('canvas').getAttribute('data-steer');assert.ok(Number(turning)>0);await page.keyboard.up('ArrowRight');await page.keyboard.up('ArrowDown');
  await page.keyboard.down('r');await page.keyboard.up('r');await page.keyboard.down('ArrowUp');await page.waitForTimeout(2600);await page.keyboard.down('ArrowLeft');await page.waitForTimeout(250);await page.keyboard.up('ArrowLeft');await page.keyboard.up('ArrowUp');
  await page.screenshot({path:`artifacts/arcade/${name}-california-turn.png`});
  await page.getByRole('button',{name:'← LEAVE',exact:true}).click();await page.getByRole('button',{name:/Sunset Canyon route preview/}).click();await page.getByRole('button',{name:/Spectre RX arcade roadster with Diamond Hands Pepe/}).click();await page.getByRole('button',{name:'LEARN TO DRIVE ↗',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='racing');await page.screenshot({path:`artifacts/arcade/${name}-california-desert.png`});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`artifacts/arcade/${name}-california-mobile.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByRole('button',{name:'SETTINGS',exact:true}).click();await page.getByLabel('Reduced motion / no speed zoom or particles').check();await page.getByRole('button',{name:'MUTE ALL',exact:true}).click();await page.getByRole('button',{name:'Close settings'}).click();await page.getByRole('button',{name:'BACK ON TRACK →',exact:true}).click();
  for(const [id,label] of [['redwood-rally','Redwood Rush'],['alpine-pass','Diamondback Pass'],['neon-boulevard','Neon Afterhours'],['vineyard-run','Golden Hour GP']]){
    await page.getByRole('button',{name:'← LEAVE',exact:true}).click();
    await page.getByRole('button',{name:new RegExp(label+' route preview')}).click();
    await page.getByRole('button',{name:'QUICK RACE →',exact:true}).click();
    await page.waitForFunction(id=>document.querySelector('canvas')?.dataset.track===id,id);
    await page.waitForFunction(()=>{
      const canvas=document.querySelector('canvas');if(canvas?.dataset.phase!=='racing'||!canvas.width||!canvas.height)return false;
      const ctx=canvas.getContext('2d'),pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data,colors=new Set();
      for(let i=0;i<pixels.length;i+=404)colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
      return colors.size>24;
    });
    await page.getByTestId('mobile-rival').waitFor();
    await page.waitForFunction(()=>document.querySelector('canvas').dataset.mapVisible==='false');
    await page.screenshot({path:`artifacts/arcade/${name}-${id}-mobile.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.getByRole('button',{name:'← LEAVE',exact:true}).click();
  for(const [car,driver] of [['Mirage V12','MEV Mia'],['Glacier R','Cold Storage Chloe'],['Inferno X','Margin Call Max']]){
    await page.getByRole('button',{name:new RegExp(car+' arcade roadster with '+driver)}).click();
    await page.screenshot({path:`artifacts/arcade/${name}-${car.replaceAll(' ','-')}-garage.png`,fullPage:true});
    await page.getByRole('button',{name:'QUICK RACE →',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='racing');
    await page.getByTestId('race-position').waitFor();
    assert.match(await page.getByTestId('race-position').innerText(),/1st|2nd/);
    await page.keyboard.down('ArrowUp');await page.waitForTimeout(1200);await page.keyboard.up('ArrowUp');
    await page.screenshot({path:`artifacts/arcade/${name}-${car.replaceAll(' ','-')}-race.png`});
    await page.getByRole('button',{name:'← LEAVE',exact:true}).click();
  }
  await page.goto((process.env.ARCADE_TEST_URL||'http://localhost:4000')+'/os/rumble');
  for(const fighter of ['Buy-High Brian','MEV Mia','Bridge Burn Bernie','Cold Storage Chloe']){const choice=page.getByRole('button',{name:new RegExp(fighter)});await choice.waitFor();assert.equal(await choice.count(),1);}
  await page.screenshot({path:`artifacts/arcade/${name}-six-fighters.png`,fullPage:true});assert.deepEqual(errors,[]);console.log(JSON.stringify({browser:name,reverse:true,progressiveSteer:Number(turning),coast:true,desert:true,mobileOverflow:false,sixFighters:true,sixCourses:true,rivalTracker:true,errors}));
}catch(e){await page.screenshot({path:`artifacts/arcade/${name}-smoke-failure.png`});console.error(await page.locator('body').innerText());console.error(errors);throw e;}
finally{await context.close();await browser.close();}
