import test from 'node:test';
import assert from 'node:assert/strict';
import {createPracticeRival,RIVAL_STYLES} from '../lib/arcade/race-bot.mjs';
import {createRace,stepRace,raceBotInput,raceHash,CUP_TRACKS,VEHICLES,RACE_RULES,RACE_RULES_VERSION} from '../lib/arcade/race-sim.mjs';
import {replayFight} from '../lib/arcade/rollback.mjs';

test('practice draws reproducible rivals and avoids repeating the previous car and style',()=>{
  let previous=null;const styles=new Set(),cars=new Set();
  for(let seed=1;seed<=80;seed++){
    const options={seed,playerVehicle:'mirage',previous},rival=createPracticeRival(options);
    assert.deepEqual(rival,createPracticeRival(options));assert.notEqual(rival.vehicle,'mirage');
    assert.notEqual(rival.vehicle,previous?.vehicle);assert.notEqual(rival.id,previous?.id);
    assert.ok(VEHICLES[rival.vehicle]);styles.add(rival.id);cars.add(rival.vehicle);previous=rival;
  }
  assert.equal(styles.size,4);assert.equal(cars.size,5);
  assert.equal(createPracticeRival({seed:4,teaching:true}).id,'cautious');
});

test('every rival style completes all six tracks in either seat with ordinary legal inputs',()=>{
  const results=[];
  for(const [index,style] of RIVAL_STYLES.entries())for(const [course,track] of CUP_TRACKS.entries()){
    const vehicles=Object.keys(VEHICLES),vehicle=vehicles[(index+course)%vehicles.length];
    const profiles=[{...style,seed:17+course*31,reactionTicks:15},{...style,seed:879+course*19,reactionTicks:37}];
    let state=createRace({vehicles:[vehicle,vehicle],track,cup:false});
    while(state.phase!=='raceOver'&&state.tick<8000){
      const inputs=profiles.map((p,slot)=>raceBotInput(state,slot,p));
      for(const input of inputs)assert.ok(Number.isInteger(input)&&input>=0&&input<=RACE_RULES.maxInput);
      state=stepRace(state,inputs);
    }
    assert.ok(state.players.every(p=>p.finishedTick!==null),`${style.id} / ${vehicle} / ${track}: ${state.players.map(p=>p.passed)}`);
    results.push({style:style.id,vehicle,track,seconds:state.players.map(p=>Math.round(p.finishedTick/6)/10)});
  }
  console.log('Rival course results:',JSON.stringify(results));
});

test('new seeds produce different laps, while a recorded rival run replays exactly',()=>{
  const times=[];
  for(const seed of [11,29,47,83,107,193]){
    const profile={...RIVAL_STYLES[3],seed,reactionTicks:20};
    const options={vehicles:['comet','comet'],cup:false};let state=createRace(options);
    const frames=[];let held=[-1,-1];
    while(state.phase!=='raceOver'&&state.tick<8000){
      const before=raceHash(state),inputs=[raceBotInput(state,0),raceBotInput(state,1,profile)];
      assert.equal(raceHash(state),before,'bot must never change game state');
      if(inputs.some((input,i)=>input!==held[i]))frames.push({tick:state.tick,slots:inputs.map((input,i)=>input===held[i]?null:{input})});
      held=inputs;state=stepRace(state,inputs);
    }
    assert.notEqual(state.players[1].finishedTick,null);times.push(state.players[1].finishedTick/60);
    if(seed===11){const replay={version:1,game:'wen-lambo',rulesVersion:RACE_RULES_VERSION,options,ticks:state.tick,inputs:frames};assert.equal(raceHash(replayFight(replay,RACE_RULES)),raceHash(state));}
  }
  assert.equal(new Set(times).size,times.length);assert.ok(Math.max(...times)-Math.min(...times)>1,'variability must be noticeable in race time');
  console.log('Same car/style, different seeds (seconds):',times.map(n=>n.toFixed(2)).join(', '));
});
