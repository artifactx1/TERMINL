import test from 'node:test';
import assert from 'node:assert/strict';
import {directionMask, touchMask, raceSteeringTarget, raceTouchSteeringInput} from '../lib/arcade/touch-input.mjs';
import {createFight, stepFight, CHARACTERS} from '../lib/arcade/rumble-sim.mjs';
import {createRace, stepRace} from '../lib/arcade/race-sim.mjs';
import {fighterPose} from '../lib/arcade/rumble-render.js';
import {MOVES} from '../lib/arcade/rumble-sim.mjs';

test('thumb pad dead zone and eight directions preserve move combinations',()=>{
  assert.equal(directionMask(.05,.05),0);
  for(const [x,y,mask] of [[-1,0,1],[1,0,2],[0,-1,4],[0,1,8],[-1,-1,5],[1,-1,6],[-1,1,9],[1,1,10]]) assert.equal(directionMask(x,y),mask);
  assert.equal(directionMask(.1,1,true),0);assert.equal(directionMask(.5,-1,true),2);
  assert.equal(directionMask(NaN,0),0);
});

test('racing has a forgiving center and a progressive, symmetric thumb curve',()=>{
  for(const x of [0,.1,.2,.28,-.28,NaN])assert.equal(raceSteeringTarget(x),0);
  assert.ok(raceSteeringTarget(.5)<.15);
  assert.ok(raceSteeringTarget(.75)>raceSteeringTarget(.5));
  assert.equal(raceSteeringTarget(1),1);
  assert.equal(raceSteeringTarget(-.75),-raceSteeringTarget(.75));
});

test('held touch corrections stay bounded instead of accumulating full steering lock',()=>{
  const run=(x,speed)=>{
    let steer=0,max=0;
    for(let i=0;i<600;i++){
      const mask=raceTouchSteeringInput(raceSteeringTarget(x),steer,speed);
      assert.ok([0,1,2].includes(mask));
      const target=mask===1?-1:mask===2?1:0,step=target===0?.075:.065;
      steer+=Math.max(-step,Math.min(step,target-steer));max=Math.max(max,Math.abs(steer));
    }
    return max;
  };
  assert.ok(run(.5,5.6)<.12);assert.ok(run(1,5.6)>.65&&run(1,5.6)<.77);
  assert.ok(run(1,0)>.95&&run(1,0)<=1);assert.ok(run(1,0)>run(1,5.6));
  assert.equal(run(.5,5.6),run(-.5,5.6));
  assert.equal(raceTouchSteeringInput(0,.4,6),0);
  assert.equal(raceTouchSteeringInput(-1,.4,6),1);
});

test('drift keeps a continuous direction so feathered steering cannot reset drift banking',()=>{
  for(const steer of [-1,0,1]){
    assert.equal(raceTouchSteeringInput(.5,steer,5.6,true),2);
    assert.equal(raceTouchSteeringInput(-.5,steer,5.6,true),1);
  }
  assert.equal(raceTouchSteeringInput(0,.5,5.6,true),0);
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
