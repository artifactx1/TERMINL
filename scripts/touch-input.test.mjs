import test from 'node:test';
import assert from 'node:assert/strict';
import {directionMask, touchMask, raceSteeringTarget} from '../lib/arcade/touch-input.mjs';
import {createFight, stepFight, CHARACTERS} from '../lib/arcade/rumble-sim.mjs';
import {createRace, stepRace} from '../lib/arcade/race-sim.mjs';
import {encodeRaceInput,decodeRaceSteering,composeRaceInput,raceKeyboardInput} from '../lib/arcade/race-input.mjs';
import {fighterPose} from '../lib/arcade/rumble-render.js';
import {MOVES} from '../lib/arcade/rumble-sim.mjs';

test('thumb pad dead zone and eight directions preserve move combinations',()=>{
  assert.equal(directionMask(.05,.05),0);
  for(const [x,y,mask] of [[-1,0,1],[1,0,2],[0,-1,4],[0,1,8],[-1,-1,5],[1,-1,6],[-1,1,9],[1,1,10]]) assert.equal(directionMask(x,y),mask);
  assert.equal(directionMask(.1,1,true),0);assert.equal(directionMask(.5,-1,true),2);
  assert.equal(directionMask(NaN,0),0);
});

test('thumb steering responds near center and remains progressive and symmetric',()=>{
  for(const x of [0,.05,.12,-.12,NaN])assert.equal(raceSteeringTarget(x),0);
  assert.ok(raceSteeringTarget(.2)>0&&raceSteeringTarget(.2)<.05);
  assert.ok(raceSteeringTarget(.5)>.25&&raceSteeringTarget(.5)<.3);
  assert.ok(raceSteeringTarget(.75)>raceSteeringTarget(.5));
  assert.equal(raceSteeringTarget(1),1);assert.equal(raceSteeringTarget(-.75),-raceSteeringTarget(.75));
});

test('analog inputs hold a stable target at speed, center quickly and preserve drift banking',()=>{
  const run=(axis,speed,drift=false)=>{
    let state=createRace();state.phase='racing';const start={...state.players[0]},samples=[];
    const input=encodeRaceInput(drift?16:0,axis);
    for(let i=0;i<120;i++){
      Object.assign(state.players[0],{x:start.x,y:start.y,angle:start.angle,vx:Math.cos(start.angle)*speed,vy:Math.sin(start.angle)*speed,speed});
      state=stepRace(state,[input,0]);if(i>60)samples.push(state.players[0].steer);
    }
    assert.ok(Math.max(...samples)-Math.min(...samples)<.001,'held thumb must not flutter between digital pulses');
    return state;
  };
  const gentle=run(raceSteeringTarget(.5),5.6);assert.ok(gentle.players[0].steer>.17&&gentle.players[0].steer<.2);
  assert.equal(run(-raceSteeringTarget(.5),5.6).players[0].steer,-gentle.players[0].steer);
  assert.ok(run(1,5.6).players[0].steer<.7);assert.equal(run(1,0).players[0].steer,1);
  let centered=run(1,5.6);for(let i=0;i<8;i++)centered=stepRace(centered,[encodeRaceInput(0,0),0]);
  assert.equal(centered.players[0].steer,0);assert.ok(Math.abs(centered.players[0].yawRate)<.001);
  const drift=run(.35,4,true);assert.ok(drift.players[0].driftCharge>10,'steady analog drift retains charge');
  assert.ok(stepRace(drift,[encodeRaceInput(0,0),0]).events.some(e=>e.type==='drift'));
});

test('input composition handles device priority, exact centering and brake precedence',()=>{
  for(const axis of [-1,-.5,0,.5,1])assert.ok(Math.abs(decodeRaceSteering(encodeRaceInput(4,axis))-axis)<=1/127);
  assert.equal(decodeRaceSteering(composeRaceInput({touch:2,touchAxis:0,touchActive:true,padAxis:.8})),0,'centered touch overrides controller');
  assert.equal(decodeRaceSteering(composeRaceInput({keyboard:1,touch:2,touchAxis:1,touchActive:true})),-1,'keys override touch direction');
  assert.equal(decodeRaceSteering(composeRaceInput({padAxis:-.4})),decodeRaceSteering(encodeRaceInput(0,-.4)));
  const brake=composeRaceInput({keyboard:4|32,touch:8,touchAxis:.3,touchActive:true});assert.equal(brake&127,8);
  assert.equal(encodeRaceInput(4,NaN),4);assert.equal(decodeRaceSteering(encodeRaceInput(4,Infinity)),0);
});
test('overlapping keyboard directions countersteer immediately and restore the remaining held key',()=>{
  const held=new Set(['ArrowUp','a']);assert.equal(raceKeyboardInput(held),5);
  held.add('d');assert.equal(raceKeyboardInput(held),6);
  held.add('a');assert.equal(raceKeyboardInput(held),6,'OS key repeat must not steal priority');
  held.delete('d');assert.equal(raceKeyboardInput(held),5);
  held.delete('a');assert.equal(raceKeyboardInput(held),4);
});
test('independent fingers keep shared buttons held until the last release',()=>{
  const fingers=new Map([[1,16],[2,16],[3,2]]);
  fingers.delete(1);assert.equal(touchMask(fingers),18);
  fingers.delete(2);assert.equal(touchMask(fingers),2);
  fingers.clear();assert.equal(touchMask(fingers),0);
});
test('boost includes gas even in manual mode; brake beats boost and all gas sources',()=>{
  assert.equal(touchMask(new Map([[1,32],[2,1]]),{racing:true}),37);
  assert.equal(touchMask(new Map([[1,32],[2,8],[3,4]]),{racing:true,autoGas:true,engaged:true}),8);
  assert.equal(touchMask(new Map(),{racing:true,autoGas:true,engaged:false}),0);
  assert.equal(touchMask(new Map(),{racing:true,autoGas:true,engaged:true}),4);
});
test('touch BOOST consumes charge and accelerates faster in the actual race simulation',()=>{
  let normal=createRace(),boosted=createRace();normal.phase=boosted.phase='racing';
  for(let i=0;i<30;i++) { normal=stepRace(normal,[4,0]);boosted=stepRace(boosted,[touchMask(new Map([[1,32]]),{racing:true}),0]); }
  assert.ok(boosted.players[0].boost<normal.players[0].boost);
  assert.ok(boosted.players[0].speed>normal.players[0].speed);
  assert.equal(boosted.players[0].boosting,true);
});
test('all eleven moves activate from touch combinations for every fighter',()=>{
  const cases=[['light',16,0],['heavy',32,0],['crouchLight',16,8],['crouchHeavy',32,8],['airLight',16,0],['airHeavy',32,0],['special',64,0],['downSpecial',64,8],['forwardSpecial',64,2],['throw',512,0],['super',1024,0]];
  for(const character of Object.keys(CHARACTERS))for(const [move,button,direction]of cases){
    let state=createFight({characters:[character,'diamond']});state.phase='fight';state.players[0].meter=1000;
    if(move.startsWith('air')){state=stepFight(state,[directionMask(0,-1),0]);assert.equal(state.players[0].grounded,false);}
    const mask=touchMask(new Map([[1,direction],[2,button]]));
    state=stepFight(state,[mask,0]);assert.equal(state.players[0].action?.id,move,`${character}: ${move}`);
    if(move==='super')assert.equal(state.players[0].meter,0);
  }
});

test('all eleven attacks actually damage an unguarded opponent in reach',()=>{
  const cases=[['light',16],['heavy',32],['crouchLight',24],['crouchHeavy',40],['airLight',16],['airHeavy',32],['special',64],['downSpecial',72],['forwardSpecial',66],['throw',512],['super',1024]];
  for(const character of Object.keys(CHARACTERS))for(const [move,mask] of cases){
    let state=createFight({characters:[character,'diamond']});state.phase='fight';state.players[0].meter=1000;state.players[1].x=375;
    if(move.startsWith('air'))state=stepFight(state,[4,0]);
    state=stepFight(state,[mask,0]);
    for(let i=0;i<90;i++)state=stepFight(state,[0,0]);
    assert.ok(state.players[1].hp<1000,`${character} ${move} must hit in range`);
  }
});

test('heavy, uppercut, sweep, lunge, throw and super have different visible poses from the jab',()=>{
  for(const character of Object.keys(CHARACTERS)){
    const fighter=createFight({characters:[character,'diamond']}).players[0];
    const pose=id=>fighterPose({...fighter,action:{id,frame:MOVES[character][id].startup}},0);
    for(const id of ['heavy','crouchHeavy','downSpecial','forwardSpecial','throw','super'])assert.notDeepEqual(pose(id).frontHand,pose('light').frontHand,`${character} ${id}`);
  }
});
