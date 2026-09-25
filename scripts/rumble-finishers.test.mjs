import test from 'node:test';
import assert from 'node:assert/strict';
import {createFight,stepFight,INPUT,CHARACTERS,botInput,stateHash} from '../lib/arcade/rumble-sim.mjs';
import {FINISHERS,FINISH_WINDOW_TICKS,FINISHER_DURATION_TICKS} from '../lib/arcade/rumble-finishers.mjs';
import {RollbackFight,replayFight} from '../lib/arcade/rollback.mjs';
const advance=(s,n,inputs=[0,0])=>{for(let i=0;i<n;i++)s=stepFight(s,inputs);return s;};
function finalKO(character='max',slot=0){const s=createFight({characters:slot===0?[character,'diamond']:['max',character]});s.phase='fight';s.wins[slot]=1;s.players[1-slot].hp=0;return advance(stepFight(s),120);}
test('every fighter can finish from either seat without changing the earned score',()=>{
 for(const character of Object.keys(CHARACTERS))for(const slot of [0,1]){
  let s=finalKO(character,slot);assert.equal(s.phase,'finishWindow');assert.equal(s.finisher.character,character);assert.ok(FINISHERS[character].description);
  const score=[...s.wins],hp=s.players.map(p=>p.hp),meter=s.players.map(p=>p.meter),inputs=slot===0?[INPUT.SUPER,0]:[0,INPUT.SUPER];
  s=stepFight(s,inputs);assert.equal(s.phase,'finisher');const before=structuredClone(s);
  s=advance(s,FINISHER_DURATION_TICKS,inputs);assert.equal(s.phase,'finished');assert.equal(s.winner,slot);assert.deepEqual(s.wins,score);assert.deepEqual(s.players.map(p=>p.hp),hp);assert.deepEqual(s.players.map(p=>p.meter),meter);
  assert.equal(s.events.filter(e=>e.type==='finisherImpact').length,1);assert.equal(s.events.filter(e=>e.type==='finish').length,1);assert.equal(stateHash(s),stateHash(advance(before,FINISHER_DURATION_TICKS,inputs)));
 }
});
test('only the winner can activate; held inputs must be released; the window expires',()=>{
 let s=finalKO();s.players[0].previousInput=INPUT.SUPER;
 s=stepFight(s,[INPUT.SUPER,INPUT.SUPER]);assert.equal(s.phase,'finishWindow');
 s=stepFight(s,[0,INPUT.SUPER]);assert.equal(s.phase,'finishWindow');
 s=stepFight(s,[INPUT.SUPER,INPUT.SUPER]);assert.equal(s.phase,'finisher');
 s=advance(finalKO(),FINISH_WINDOW_TICKS,[0,INPUT.SUPER]);assert.equal(s.phase,'finished');assert.equal(s.finisher.activated,false);assert.equal(s.winner,0);
});
test('regular rounds, timeout wins, double knockouts and legacy rules do not gain a finisher',()=>{
 for(const kind of ['round','timeout','double','legacy']){
  let s=createFight({rulesVersion:kind==='legacy'?1:2});s.phase='fight';s.wins=[kind==='round'?0:1,0];s.players[1].hp=kind==='timeout'?10:0;
  if(kind==='timeout')s.roundTicks=1;if(kind==='double')s.players[0].hp=0;
  s=advance(stepFight(s),120);assert.notEqual(s.phase,'finishWindow');assert.notEqual(s.phase,'finisher');
 }
});
test('practice bots only activate their own finisher',()=>{
 const s=finalKO('chloe',1);s.phaseTick=75;assert.equal(botInput(s,0),0);assert.equal(botInput(s,1),INPUT.SUPER);
});
test('late finisher input rewinds to exactly the same state and delays result confirmation',()=>{
 const a=new RollbackFight(),b=new RollbackFight();
 for(const game of [a,b]){game.state=finalKO();game.history=new Map([[game.state.tick,structuredClone(game.state)]]);}
 const tick=a.state.tick;
 a.submit(0,tick,INPUT.SUPER,1);for(let i=0;i<8;i++){a.advance();b.advance();}
 assert.equal(b.submit(0,tick,INPUT.SUPER,1).rolledBack,true);assert.equal(stateHash(a.state),stateHash(b.state));assert.equal(a.confirmed,false);
 for(let i=0;i<FINISHER_DURATION_TICKS+20;i++)a.advance();assert.equal(a.confirmed,true);
});
test('versioned replays reproduce current rules and retain legacy replay support',()=>{
 const a=new RollbackFight();for(let i=0;i<180;i++)a.advance([0,0]);const replay=a.exportReplay();assert.equal(replay.rulesVersion,2);assert.equal(stateHash(replayFight(replay)),replay.hash);
 const legacy={...replay,options:{},rulesVersion:undefined};assert.equal(replayFight(legacy).version,1);
});
