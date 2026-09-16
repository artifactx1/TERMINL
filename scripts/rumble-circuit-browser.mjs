import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createFight,stepFight,botInput} from '../lib/arcade/rumble-sim.mjs';
import {newCircuit,circuitInput,circuitOpponent,circuitStage,CIRCUIT_KEY} from '../lib/arcade/rumble-circuit.mjs';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));const base=process.env.ARCADE_TEST_URL||'http://localhost:4000';
try{
  await mkdir('artifacts/arcade-v1',{recursive:true});await page.goto(base+'/os/rumble');await page.getByRole('button',{name:'START SOLO CIRCUIT →',exact:true}).waitFor();
  await page.evaluate(()=>{let now=performance.now(),id=0;const queue=new Map();performance.now=()=>now;window.requestAnimationFrame=fn=>{queue.set(++id,fn);return id;};window.cancelAnimationFrame=id=>queue.delete(id);const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...args){return window.skipFightPaint?null:getContext.apply(this,args);};window.advanceFightFrame=()=>{now+=1000/60+.000001;const fns=[...queue.values()];queue.clear();fns.forEach(fn=>fn(now));};});
  const click=name=>page.getByRole('button',{name,exact:true}).evaluate(el=>el.click());await click('START SOLO CIRCUIT →');
  for(let index=0;index<6;index++){
    const circuit={...newCircuit('max'),index};let record;
    for(let shift=0;shift<200&&!record;shift+=17){let state=createFight({characters:['max',circuitOpponent(circuit)],stage:circuitStage(circuit)}),mask=0;const moves=[];
      while(state.phase!=='finished'&&state.tick<16000){const input=botInput({...state,tick:state.tick+shift},0);if(input!==mask){moves.push({tick:state.tick,input});mask=input;}state=stepFight(state,[input,circuitInput(state,circuit)]);}
      if(state.winner===0)record={moves,ticks:state.tick};
    }
    assert.ok(record,'An ordinary-input winning plan exists');
    await page.evaluate(moves=>{window.fightMoves=moves;window.fightMoveIndex=0;window.fightMask=0;window.advanceFightFrame();},record.moves);
    for(let batch=0;batch<190;batch++){
      await page.evaluate(()=>{const c=document.querySelector('canvas');for(let i=0;i<90;i++){const tick=Number(c.dataset.tick),action=window.fightMoves[window.fightMoveIndex];if(action?.tick===tick){for(const [bit,key]of [[1,'ArrowLeft'],[2,'ArrowRight'],[4,'ArrowUp'],[8,'ArrowDown'],[16,'j'],[32,'k'],[64,'l'],[128,'Shift'],[256,'q'],[512,'e'],[1024,'r']])if(!!(window.fightMask&bit)!==!!(action.input&bit))window.dispatchEvent(new KeyboardEvent(action.input&bit?'keydown':'keyup',{key,bubbles:true,cancelable:true}));window.fightMask=action.input;window.fightMoveIndex++;}window.skipFightPaint=i<89;window.advanceFightFrame();window.skipFightPaint=false;if(c.dataset.phase==='finished')break;}});
      if(await page.getByRole('button',{name:index===5?'PLAY CIRCUIT AGAIN →':'NEXT OPPONENT →',exact:true}).count())break;
    }
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),CIRCUIT_KEY);assert.equal(saved.index,Math.min(5,index+1));assert.equal(saved.complete,index===5);console.log(`PASS browser circuit fight ${index+1}`);
    if(index<5)await click('NEXT OPPONENT →');
  }
  await page.screenshot({path:'artifacts/arcade-v1/circuit-complete.png'});assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,fightsWon:6,mirrorFinale:true,savedProgress:true,errors}));
}catch(error){await page.screenshot({path:'artifacts/arcade-v1/circuit-failure.png'});console.error((await page.locator('body').innerText()).slice(-3000));throw error;}finally{await browser.close();}
