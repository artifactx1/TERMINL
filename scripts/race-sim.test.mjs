import test from 'node:test';
import assert from 'node:assert/strict';
import { createRace, stepRace, raceBotInput, raceHash, trackGeometry, nearestRoad, RACE_RULES, CUP_TRACKS, VEHICLES, RACE_INPUT as I } from '../lib/arcade/race-sim.mjs';
import {createRace as legacyRace,stepRace as legacyStep} from '../lib/arcade/race-sim-v1.mjs';
import {raceProgress,rivalTelemetry} from '../lib/arcade/race-telemetry.mjs';
import { RollbackFight, replayFight, HISTORY_LIMIT } from '../lib/arcade/rollback.mjs';
import {encodeRaceInput} from '../lib/arcade/race-input.mjs';

function racing(options) { const s=createRace(options); s.phase='racing'; s.phaseTick=0; return s; }
function cross(s,index=0) {
  const g=trackGeometry(s.track).gates[index],p=s.players[0];
  Object.assign(p,{x:g.x-Math.cos(g.angle),y:g.y-Math.sin(g.angle),angle:g.angle,vx:Math.cos(g.angle)*3,vy:Math.sin(g.angle)*3,speed:3});
  return stepRace(s,[I.THROTTLE,0]);
}

test('race validates content IDs and rejects unknown input bits',()=>{
  assert.throws(()=>createRace({vehicles:['__proto__','comet']})); assert.throws(()=>createRace({track:'constructor'}));
  const s=racing(); assert.equal(raceHash(stepRace(s,[32768,NaN])),raceHash(stepRace(s,[0,0])));
  const engine=new RollbackFight({},RACE_RULES); assert.equal(engine.submit(0,0,32768,0).ok,false);
});
test('countdown, pure fixed-step driving, brake and boost consumption',()=>{
  let s=createRace(); const original=JSON.stringify(s);
  const moved=stepRace(s,[I.THROTTLE,I.THROTTLE]); assert.equal(JSON.stringify(s),original);assert.equal(moved.players[0].speed,0);
  for(let i=0;i<180;i++)s=stepRace(s);assert.equal(s.phase,'racing');
  for(let i=0;i<150;i++)s=stepRace(s,[I.THROTTLE,0]);assert.ok(s.players[0].speed>1.5);
  const slow=stepRace(s,[I.BRAKE,0]);assert.ok(slow.players[0].speed<s.players[0].speed);
  const boosted=stepRace(s,[I.THROTTLE|I.BOOST,0]);assert.ok(boosted.players[0].boost<s.players[0].boost);assert.equal(boosted.players[0].boosting,true);
});
test('brake transitions into reverse and steering ramps smoothly with reversed steering geometry',()=>{
  let s=racing(),start={...s.players[0]};for(let i=0;i<90;i++)s=stepRace(s,[I.BRAKE,0]);
  const p=s.players[0];assert.equal(p.gear,-1);assert.ok((p.x-start.x)*Math.cos(start.angle)+(p.y-start.y)*Math.sin(start.angle)<-15);assert.equal(p.passed,0);
  const turn=stepRace(s,[I.BRAKE|I.RIGHT,0]);assert.ok(turn.players[0].steer>0&&turn.players[0].steer<.2);assert.ok(turn.players[0].angle<p.angle);
  const release=stepRace(turn,[I.BRAKE,0]);assert.ok(release.players[0].steer>=0&&release.players[0].steer<turn.players[0].steer);
  const boost=stepRace(s,[I.BRAKE|I.BOOST,0]);assert.equal(boost.players[0].boosting,false);
});
test('only ordered forward checkpoint crossings advance laps; recovery cannot grant progress',()=>{
  let s=racing();s=cross(s,2);assert.equal(s.players[0].passed,0);
  s=cross(s,0);assert.equal(s.players[0].passed,1);assert.equal(s.players[0].lap,0);
  s=cross(s,0);assert.equal(s.players[0].passed,1);
  s=cross(s,1);assert.equal(s.players[0].passed,2);
  const before=s.players[0],reset=stepRace(s,[I.RESET,0]).players[0];
  assert.equal(reset.passed,before.passed);assert.equal(reset.nextCheckpoint,before.nextCheckpoint);assert.equal(reset.lap,before.lap);assert.ok(reset.boost<before.boost);assert.equal(reset.resetCooldown,180);
  const g=trackGeometry(s.track).gates[2];Object.assign(s.players[0],{x:g.x+Math.cos(g.angle),y:g.y+Math.sin(g.angle),angle:g.angle+Math.PI,vx:-Math.cos(g.angle)*3,vy:-Math.sin(g.angle)*3});
  assert.equal(stepRace(s,[I.THROTTLE,0]).players[0].passed,2);
});
test('off-road driving loses speed; collisions separate cars; drift release banks earned charge',()=>{
  let s=racing(),g=trackGeometry(s.track).gates[0];
  Object.assign(s.players[0],{x:g.x-Math.sin(g.angle)*100,y:g.y+Math.cos(g.angle)*100,angle:g.angle,vx:Math.cos(g.angle)*5,vy:Math.sin(g.angle)*5});
  s=stepRace(s,[I.THROTTLE,0]);assert.equal(s.players[0].offRoad,true);assert.ok(s.players[0].speed<=2.101);
  s=racing();Object.assign(s.players[1],{x:s.players[0].x,y:s.players[0].y});s.players.forEach(p=>p.ghost=0);s=stepRace(s);assert.ok(Math.hypot(s.players[0].x-s.players[1].x,s.players[0].y-s.players[1].y)>=30);
  s=racing();s.players[0].driftCharge=12;s.players[0].boost=20;s=stepRace(s);assert.equal(s.players[0].boost,32);assert.equal(s.events.at(-1).type,'drift');
  assert.ok(nearestRoad(trackGeometry(s.track),s.players[0].x,s.players[0].y).distance<75);
});
test('fractional finish times determine points, exact ties draw, DNF never awards a win',()=>{
  let s=racing({cup:false});s.players[0].finishedTick=100.25;s.players[1].finishedTick=100.75;s.players[0].cupTime=100.25;s.players[1].cupTime=100.75;s=stepRace(s);
  assert.deepEqual(s.wins,[10,6]);for(let i=0;i<480;i++)s=stepRace(s);assert.equal(s.winner,0);assert.equal(s.phase,'finished');
  s=racing({cup:false});s.players.forEach(p=>{p.finishedTick=100;p.cupTime=100;});s=stepRace(s);assert.deepEqual(s.wins,[8,8]);for(let i=0;i<480;i++)s=stepRace(s);assert.equal(s.winner,null);
  s=racing({cup:false});s.raceTicks=7199;s=stepRace(s);assert.deepEqual(s.wins,[0,0]);assert.deepEqual(s.raceResults[0].times,[null,null]);
});
test('both ordinary-input practice drivers finish all six tracks in a deterministic cup',()=>{
  let a=createRace(),b=createRace();while(a.phase!=='finished'&&a.tick<48000){const inputs=[raceBotInput(a,0),raceBotInput(a,1)];a=stepRace(a,inputs);b=stepRace(b,inputs);}
  assert.equal(a.phase,'finished');assert.equal(raceHash(a),raceHash(b));assert.equal(a.raceResults.length,6);
  assert.deepEqual(a.raceResults.map(r=>r.track),CUP_TRACKS);
  for(const r of a.raceResults)assert.ok(r.times.every(n=>n!==null&&n<7200),r.track);assert.equal(a.players[0].points+a.players[1].points,96);
});
test('racer shares bounded rollback, mask validation and exact authenticated-replay reproduction',()=>{
  const a=new RollbackFight({},RACE_RULES),b=new RollbackFight({},RACE_RULES);
  for(let i=0;i<500;i++){a.advance([i>180?I.THROTTLE:0,0]);b.advance([i>180?I.THROTTLE:0,0]);}
  assert.equal(a.submit(0,494,I.BRAKE,501).ok,true);assert.equal(b.submit(0,494,I.BRAKE,501).ok,true);assert.equal(a.corrections,1);assert.equal(raceHash(a.state),raceHash(b.state));
  assert.ok(a.history.size<=HISTORY_LIMIT+1);const replay=a.exportReplay();assert.equal(replay.game,'wen-lambo');assert.equal(raceHash(replayFight(replay,RACE_RULES)),replay.hash);assert.throws(()=>replayFight(replay));
});

test('late proportional steering reconciles to the on-time result and replays exactly',()=>{
  const onTime=new RollbackFight({},RACE_RULES),late=new RollbackFight({},RACE_RULES);
  const steering=encodeRaceInput(I.THROTTLE,.37);
  for(let tick=0;tick<500;tick++){
    onTime.advance([tick>=494?steering:I.THROTTLE,0]);late.advance([I.THROTTLE,0]);
  }
  // Remove the test harness's later held-input submissions: a real packet is held
  // until the next change, so replay the same steering input over those ticks.
  for(let tick=494;tick<500;tick++)assert.equal(late.submit(0,tick,steering,1000+tick).ok,true);
  assert.equal(raceHash(late.state),raceHash(onTime.state));
  const replay=late.exportReplay();assert.equal(raceHash(replayFight(replay,RACE_RULES)),replay.hash);
});
test('reverse escapes the outer shoulder and barrier sliding preserves tangential motion',()=>{
  let s=racing({cup:false});const g=trackGeometry(s.track),gate=g.gates[0],nx=-Math.sin(gate.angle),ny=Math.cos(gate.angle);
  // Parked beside the barrier, a little behind the timing plane, facing across the road.
  Object.assign(s.players[0],{x:gate.x+nx*(g.width/2+55)-Math.cos(gate.angle)*30,y:gate.y+ny*(g.width/2+55)-Math.sin(gate.angle)*30,angle:gate.angle+Math.PI/2});
  for(let i=0;i<85;i++)s=stepRace(s,[I.BRAKE,0]);
  assert.equal(s.players[0].gear,-1);assert.equal(s.players[0].offRoad,false);assert.equal(s.players[0].passed,0);
  s=racing({cup:false});Object.assign(s.players[0],{x:gate.x+nx*(g.width/2+57),y:gate.y+ny*(g.width/2+57),angle:gate.angle,vx:-Math.cos(gate.angle),vy:-Math.sin(gate.angle),speed:1});
  const next=stepRace(s,[I.BRAKE,0]);assert.ok(next.players[0].speed>.8,'barrier must not erase reverse velocity');
  Object.assign(s.players[0],{yawRate:.03,steer:.9,boosting:true,drifting:true});
  const reset=stepRace(s,[I.RESET,0]).players[0];assert.equal(reset.yawRate,0);assert.equal(reset.steer,0);assert.equal(reset.boosting,false);assert.equal(reset.offRoad,false);
});

test('brake overrides gas in authority, and reverse steering works on either lock',()=>{
  let s=racing({cup:false});const p=s.players[0];p.vx=Math.cos(p.angle)*3;p.vy=Math.sin(p.angle)*3;p.speed=3;
  for(let i=0;i<100;i++)s=stepRace(s,[I.BRAKE|I.THROTTLE,0]);
  assert.equal(s.players[0].gear,-1,'held brake must actually pass through zero into reverse after driving forward');
  for(let i=0;i<100;i++)s=stepRace(s,[I.THROTTLE,0]);assert.equal(s.players[0].gear,1);
  for(const input of [I.LEFT,I.RIGHT]){let a=racing({cup:false});for(let i=0;i<55;i++)a=stepRace(a,[I.BRAKE,0]);const angle=a.players[0].angle;for(let i=0;i<15;i++)a=stepRace(a,[I.BRAKE|input,0]);assert.ok((a.players[0].angle-angle)*(input===I.RIGHT?-1:1)>.03);}
});

test('rival telemetry follows ordered sectors, finish state and both seats',()=>{
  let s=racing({cup:false});s=cross(s,0);const g=trackGeometry(s.track),p=s.players[0];
  Object.assign(p,{x:g.gates[1].x,y:g.gates[1].y});assert.ok(raceProgress(s,0)<=g.gates[1].s+.01);
  const a=rivalTelemetry(s,0),b=rivalTelemetry(s,1);assert.equal(a.gap,-b.gap);assert.match(a.label,/BEHIND/);assert.match(b.label,/AHEAD/);
  const sectorEnd=g.gates[1].s;Object.assign(p,{x:g.gates[6].x,y:g.gates[6].y});assert.ok(raceProgress(s,0)<=sectorEnd);
  s.players[1].finishedTick=123;assert.equal(rivalTelemetry(s,0).label,'RIVAL FINISHED');
});

test('historical unversioned v1 racing replays still reproduce exactly',()=>{
  let old=legacyRace();for(let i=0;i<700;i++)old=legacyStep(old,[6,4]);
  const replay={version:1,game:'wen-lambo',options:{},ticks:700,inputs:[{tick:0,slots:[{input:6},{input:4}]}]};
  assert.equal(raceHash(replayFight(replay,RACE_RULES)),raceHash(old));
  assert.throws(()=>replayFight({...replay,rulesVersion:99},RACE_RULES));
});

test('off-road lateral movement does not hand the lead to a trailing car',async()=>{
  const {raceOrder,roadAt}=await import('../lib/arcade/race-sim.mjs');
  const s=racing({cup:false}),g=trackGeometry(s.track);
  const place=(slot,distance,offset=0)=>{const at=roadAt(g,distance);Object.assign(s.players[slot],{passed:1,nextCheckpoint:1,x:at.x-Math.sin(at.angle)*offset,y:at.y+Math.cos(at.angle)*offset});};
  // On this first sector the leader is 12 units ahead but 100 units sideways.
  // Euclidean distance to gate 1 incorrectly puts the trailing car first.
  place(0,360,100);place(1,348);
  assert.deepEqual(raceOrder(s),[0,1]);
  assert.ok(rivalTelemetry(s,0).gap<0);
  place(1,390);assert.deepEqual(raceOrder(s),[1,0],'actual longitudinal overtake changes the lead');
  place(0,360,-100);place(1,348);assert.deepEqual(raceOrder(s),[0,1]);
  place(0,100);place(1,90);assert.deepEqual(raceOrder(s),[0,1],'driving backwards may give up progress');
});

test('race order respects missed gates, finish time, recovery and stable exact ties',async()=>{
  const {raceOrder,roadAt}=await import('../lib/arcade/race-sim.mjs');
  const s=racing({cup:false}),g=trackGeometry(s.track);
  Object.assign(s.players[0],{passed:2,nextCheckpoint:2,...roadAt(g,g.gates[1].s+10)});
  Object.assign(s.players[1],{passed:1,nextCheckpoint:1,...roadAt(g,g.gates[7].s)});
  assert.deepEqual(raceOrder(s),[0,1],'cutting the infield does not skip validated sectors');
  const recovered=stepRace(s,[I.RESET,0]);assert.deepEqual(raceOrder(recovered),[0,1]);
  s.players[1].finishedTick=100;assert.deepEqual(raceOrder(s),[1,0]);
  s.players[0].finishedTick=99;assert.deepEqual(raceOrder(s),[0,1]);
  const tie=racing();Object.assign(tie.players[1],{x:tie.players[0].x,y:tie.players[0].y});
  tie.players[0].place=2;tie.players[1].place=1;assert.deepEqual(raceOrder(tie),[1,0]);
});

test('speed-sensitive steering retains low-speed lock and recenters without sticky yaw',()=>{
  const run=(speed,mask,count,initial)=>{
    let s=initial||racing({cup:false});const start={...s.players[0]};
    for(let i=0;i<count;i++){
      Object.assign(s.players[0],{x:start.x,y:start.y,angle:start.angle,vx:Math.cos(start.angle)*speed,vy:Math.sin(start.angle)*speed,speed});
      s=stepRace(s,[mask,0]);
    }return s;
  };
  const slow=run(.5,I.RIGHT,30),fast=run(5.6,I.RIGHT,30);
  assert.ok(slow.players[0].steer>.95);assert.ok(fast.players[0].steer<=.74);
  const centered=run(5.6,0,14,fast);assert.equal(centered.players[0].steer,0);assert.ok(Math.abs(centered.players[0].yawRate)<.001);
  const counter=run(5.6,I.LEFT,8,fast);assert.ok(counter.players[0].steer<0,'countersteer crosses center promptly');
});

test('keyboard steering reduces high-speed yaw and stops turning on release across all vehicles',async()=>{
  const old=await import('../lib/arcade/race-sim-v4.mjs');
  const sample=(create,step,vehicle,speed,input)=>{
    let s=create({vehicles:[vehicle,vehicle],cup:false});s.phase='racing';
    const origin={...s.players[0]};
    for(let i=0;i<45;i++){
      Object.assign(s.players[0],{x:origin.x,y:origin.y,angle:origin.angle,vx:Math.cos(origin.angle)*speed,vy:Math.sin(origin.angle)*speed});
      s=step(s,[input,0]);
    }
    return s;
  };
  for(const vehicle of Object.keys(VEHICLES))for(const input of [I.RIGHT,I.LEFT]){
    const previous=sample(old.createRace,old.stepRace,vehicle,5.6,input),current=sample(createRace,stepRace,vehicle,5.6,input);
    assert.ok(Math.abs(current.players[0].yawRate)<Math.abs(previous.players[0].yawRate)*.6,`${vehicle}: high-speed turning reduced`);
    const angle=current.players[0].angle,released=stepRace(current,[0,0]);
    assert.equal(released.players[0].angle,angle,`${vehicle}: no extra heading rotation on release`);
    assert.equal(released.players[0].yawRate,0);
    const slow=sample(createRace,stepRace,vehicle,1,input);assert.ok(Math.abs(slow.players[0].steer)>Math.abs(current.players[0].steer)*2,'tight slow turns remain available');
  }
});
test('mobile analog handling remains identical to v4 and takes over after keyboard use',async()=>{
  const old=await import('../lib/arcade/race-sim-v4.mjs');
  let previous=old.createRace(),current=createRace();
  for(let tick=0;tick<1000;tick++){
    const input=encodeRaceInput(tick%150<30?16|4:4,tick%180<100?Math.sin(tick/45)*.65:0);
    previous=old.stepRace(previous,[input,0]);current=stepRace(current,[input,0]);
    const comparable=structuredClone(current);comparable.version=4;
    comparable.players.forEach(p=>delete p.digitalSteering);
    assert.deepEqual(comparable,previous,`analog tick ${tick}`);
  }
  current=stepRace(current,[I.RIGHT,0]);assert.equal(current.players[0].digitalSteering,true);
  current=stepRace(current,[encodeRaceInput(0,0),0]);assert.equal(current.players[0].yawRate,0,'key-up centers via an analog zero packet');
  current=stepRace(current,[encodeRaceInput(0,.2),0]);assert.equal(current.players[0].digitalSteering,false);
});
test('archived v4 proportional inputs retain exact replay hashes',async()=>{
  const {createRace:oldCreate,stepRace:oldStep}=await import('../lib/arcade/race-sim-v4.mjs');
  const options={vehicles:['mirage','bike-tyson'],cup:false},inputs=[encodeRaceInput(4,.32),4];
  let old=oldCreate(options),archived=createRace({...options,rulesVersion:4});
  for(let tick=0;tick<900;tick++){old=oldStep(old,inputs);archived=stepRace(archived,inputs);}
  assert.equal(raceHash(old),raceHash(archived));
  const replay={version:1,game:'wen-lambo',rulesVersion:4,options,ticks:900,inputs:[{tick:0,slots:inputs.map(input=>({input}))}]};
  assert.equal(raceHash(replayFight(replay,RACE_RULES)),raceHash(old));
});
test('archived rules-v3 recordings retain exact state and hashes with Bike Tyson',async()=>{
  const {createRace:oldCreate,stepRace:oldStep}=await import('../lib/arcade/race-sim-v3.mjs');
  const options={vehicles:['bike-tyson','mirage']};let old=oldCreate(options);
  for(let i=0;i<900;i++)old=oldStep(old,[6,4]);
  const replay={version:1,game:'wen-lambo',rulesVersion:3,options,ticks:900,inputs:[{tick:0,slots:[{input:6},{input:4}]}]};
  assert.equal(raceHash(replayFight(replay,RACE_RULES)),raceHash(old));
});

test('archived rules-v2 recordings retain exact state and hashes',async()=>{
  const {createRace:oldCreate,stepRace:oldStep}=await import('../lib/arcade/race-sim-v2.mjs');
  let old=oldCreate();for(let i=0;i<900;i++)old=oldStep(old,[6,4]);
  const replay={version:1,game:'wen-lambo',rulesVersion:2,options:{},ticks:900,inputs:[{tick:0,slots:[{input:6},{input:4}]}]};
  assert.equal(raceHash(replayFight(replay,RACE_RULES)),raceHash(old));
});

test('all six vehicles finish all six courses in both grid slots using ordinary bot inputs',async()=>{
  const {VEHICLES}=await import('../lib/arcade/race-sim.mjs');
  for(const vehicle of Object.keys(VEHICLES))for(const track of CUP_TRACKS){
    let state=createRace({vehicles:[vehicle,vehicle],track,cup:false});
    while(state.phase!=='raceOver'&&state.tick<8000)state=stepRace(state,[raceBotInput(state,0),raceBotInput(state,1)]);
    assert.ok(state.players.every(p=>p.finishedTick!==null),`${vehicle} must finish ${track} in both grid slots`);
  }
});
