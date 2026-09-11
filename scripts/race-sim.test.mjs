import test from 'node:test';
import assert from 'node:assert/strict';
import { createRace, stepRace, raceBotInput, raceHash, trackGeometry, nearestRoad, RACE_RULES, RACE_INPUT as I } from '../lib/arcade/race-sim.mjs';
import { RollbackFight, replayFight, HISTORY_LIMIT } from '../lib/arcade/rollback.mjs';

function racing(options) { const s=createRace(options); s.phase='racing'; s.phaseTick=0; return s; }
function cross(s,index=0) {
  const g=trackGeometry(s.track).gates[index],p=s.players[0];
  Object.assign(p,{x:g.x-Math.cos(g.angle),y:g.y-Math.sin(g.angle),angle:g.angle,vx:Math.cos(g.angle)*3,vy:Math.sin(g.angle)*3,speed:3});
  return stepRace(s,[I.THROTTLE,0]);
}

test('race validates content IDs and rejects unknown input bits',()=>{
  assert.throws(()=>createRace({vehicles:['__proto__','comet']})); assert.throws(()=>createRace({track:'constructor'}));
  const s=racing(); assert.equal(raceHash(stepRace(s,[9999,NaN])),raceHash(stepRace(s,[0,0])));
  const engine=new RollbackFight({},RACE_RULES); assert.equal(engine.submit(0,0,128,0).ok,false);
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
test('both ordinary-input practice drivers finish both tracks in a deterministic cup',()=>{
  let a=createRace(),b=createRace();while(a.phase!=='finished'&&a.tick<16000){const inputs=[raceBotInput(a,0),raceBotInput(a,1)];a=stepRace(a,inputs);b=stepRace(b,inputs);}
  assert.equal(a.phase,'finished');assert.equal(raceHash(a),raceHash(b));assert.equal(a.raceResults.length,2);
  for(const r of a.raceResults)assert.ok(r.times.every(n=>n!==null&&n<7200));assert.equal(a.players[0].points+a.players[1].points,32);
});
test('racer shares bounded rollback, mask validation and exact authenticated-replay reproduction',()=>{
  const a=new RollbackFight({},RACE_RULES),b=new RollbackFight({},RACE_RULES);
  for(let i=0;i<500;i++){a.advance([i>180?I.THROTTLE:0,0]);b.advance([i>180?I.THROTTLE:0,0]);}
  assert.equal(a.submit(0,494,I.BRAKE,501).ok,true);assert.equal(b.submit(0,494,I.BRAKE,501).ok,true);assert.equal(a.corrections,1);assert.equal(raceHash(a.state),raceHash(b.state));
  assert.ok(a.history.size<=HISTORY_LIMIT+1);const replay=a.exportReplay();assert.equal(replay.game,'wen-lambo');assert.equal(raceHash(replayFight(replay,RACE_RULES)),replay.hash);assert.throws(()=>replayFight(replay));
});
