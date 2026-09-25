import test from 'node:test';
import assert from 'node:assert/strict';
import {createFight,stepFight,stateHash,INPUT as I,MOVES,botInput,moveFor} from '../lib/arcade/rumble-sim.mjs';
import {RollbackFight,replayFight,ROLLBACK_WINDOW} from '../lib/arcade/rollback.mjs';

function fight(options){const s=createFight(options);s.phase='fight';s.players[0].x=400;s.players[1].x=480;return s;}
function frames(s,n,a=0,b=0){for(let t=0;t<n;t++)s=stepFight(s,[typeof a==='function'?a(t):a,typeof b==='function'?b(t):b]);return s;}
function attack(s,mask,defense=0,n=45){return frames(s,n,t=>t===0?mask:0,defense);}

test('pure deterministic steps preserve source and finite state',()=>{
  const start=fight(),before=JSON.stringify(start);let a=start,b=start;
  for(let n=0;n<700;n++){const input=[botInput(a,0),botInput(a,1)];a=stepFight(a,input);b=stepFight(b,input);}
  assert.equal(JSON.stringify(start),before);assert.equal(stateHash(a),stateHash(b));
  for(const p of a.players){assert.ok(Number.isFinite(p.x));assert.ok(p.hp>=0&&p.hp<=1000);assert.ok(p.meter>=0&&p.meter<=1000);}
});
test('authored roster has six normals, three specials, throw and super with full timing and counterplay',()=>{
  for(const set of Object.values(MOVES)){assert.equal(Object.keys(set).length,11);for(const m of Object.values(set)){assert.ok(m.startup>0&&m.active>0&&m.recovery>0);assert.ok(m.hitbox.top>m.hitbox.bottom);assert.ok(m.counterplay.length>25);assert.ok(Number.isFinite(m.blockAdvantage));}}
});
test('prototype properties are not valid fighter or move identifiers in fixtures or replays',()=>{
  for(const character of ['__proto__','constructor','toString',{}])assert.throws(()=>createFight({characters:[character,'diamond']}),/Unknown fighter/);
  assert.equal(moveFor('__proto__','light'),null);assert.equal(moveFor('max','constructor'),null);
  assert.throws(()=>replayFight({version:1,game:'rekt-rumble',ticks:0,inputs:[],options:{characters:['constructor','max']}}),/Unknown fighter/);
});
test('movement respects bounds, jump returns to floor and dash covers extra distance',()=>{
  const start=fight();start.players[1].x=950;
  const walk=frames(start,12,I.RIGHT),dash=frames(start,12,t=>I.RIGHT|(t===0?I.DASH:0));assert.ok(dash.players[0].x>walk.players[0].x+30);
  let jump=stepFight(start,[I.JUMP,0]);assert.ok(jump.players[0].y>0);assert.equal(jump.players[0].grounded,false);jump=frames(jump,65);assert.equal(jump.players[0].y,0);assert.equal(jump.players[0].grounded,true);
  assert.equal(frames(start,500,I.LEFT).players[0].x,42);
});
test('startup and spacing prevent instant or full-screen hits',()=>{
  let s=stepFight(fight(),[I.LIGHT,0]);s=frames(s,5);assert.equal(s.players[1].hp,1000);s=stepFight(s,[0,0]);assert.equal(s.players[1].hp,945);
  const far=fight();far.players[1].x=800;assert.equal(attack(far,I.HEAVY).players[1].hp,1000);
});
test('standing and crouching guard distinguish lows and overheads',()=>{
  const blocked=attack(fight(),I.LIGHT,I.GUARD);assert.ok(blocked.players[1].hp>=995);
  const low=attack(fight(),I.DOWN|I.LIGHT,I.GUARD);assert.equal(low.players[1].hp,955);
  const lowBlock=attack(fight(),I.DOWN|I.LIGHT,I.GUARD|I.DOWN);assert.ok(lowBlock.players[1].hp>=995);
  const high=fight();high.players[0].y=48;high.players[0].grounded=false;high.players[0].vy=4;
  const overhead=attack(high,I.LIGHT,I.GUARD|I.DOWN,12),standing=attack(high,I.LIGHT,I.GUARD,12);
  assert.equal(overhead.players[1].hp,940);assert.ok(standing.players[1].hp>=995);
});
test('throw bypasses guard but supports an explicit six-frame escape',()=>{
  const start=fight();start.players[1].x=455;
  const thrown=attack(start,I.THROW,I.GUARD,20);assert.equal(thrown.players[1].hp,855);assert.ok(thrown.players[1].knockdown>0);
  let tech=stepFight(start,[I.THROW,0]);tech=frames(tech,5);assert.ok(tech.players[1].throwPending);
  tech=stepFight(tech,[0,I.THROW]);assert.equal(tech.players[1].hp,1000);assert.equal(tech.players[1].throwPending,null);assert.ok(tech.events.some(e=>e.type==='tech'));
  const airborne=fight();airborne.players[1].x=455;airborne.players[1].y=140;airborne.players[1].grounded=false;
  assert.equal(attack(airborne,I.THROW,0,12).players[1].hp,1000);
});
test('equal-time throws tech and equal-time punches trade symmetrically',()=>{
  let s=fight();s.players[1].x=455;s=frames(s,10,t=>t===0?I.THROW:0,t=>t===0?I.THROW:0);assert.deepEqual(s.players.map(p=>p.hp),[1000,1000]);assert.ok(s.events.some(e=>e.type==='tech'));
  s=frames(fight(),9,t=>t===0?I.LIGHT:0,t=>t===0?I.LIGHT:0);assert.deepEqual(s.players.map(p=>p.hp),[945,945]);
});
test('specials differ: Max command grab, Diamond armor and anti-air vertical coverage',()=>{
  const grab=fight();grab.players[1].x=455;assert.equal(attack(grab,I.SPECIAL,I.GUARD,40).players[1].hp,830);
  const armor=fight({characters:['max','diamond']});const result=frames(armor,10,t=>t===0?I.LIGHT:0,t=>t===0?I.SPECIAL:0);assert.equal(result.players[1].hp,973);assert.equal(result.players[1].action.id,'special');
  const air=fight();air.players[1].y=160;air.players[1].vy=0;air.players[1].grounded=false;assert.ok(attack(air,I.DOWN|I.SPECIAL,0,20).players[1].hp<1000);
});
test('meter earns on contact, spends once and cannot cast an unfunded super',()=>{
  const denied=attack(fight(),I.SUPER,0,20);assert.equal(denied.players[1].hp,1000);assert.equal(denied.players[0].meter,0);
  const earned=attack(fight(),I.LIGHT,0,15);assert.equal(earned.players[0].meter,45);assert.ok(earned.players[1].meter>0);
  const funded=fight();funded.players[0].meter=1000;const cast=attack(funded,I.SUPER,0,30);assert.equal(cast.players[0].meter,0);assert.equal(cast.players[1].hp,700);
});
test('combo scaling and four-hit reset prevent indefinite touch-of-death chains',()=>{
  const s=fight();s.players[1].combo=3;s.players[1].comboTimer=60;
  const hit=attack(s,I.LIGHT,0,8);assert.equal(hit.players[1].hp,978);assert.equal(hit.players[1].combo,0);assert.ok(hit.players[1].invuln>=38);assert.ok(hit.players[1].knockdown>0);
});
test('hit-stop retains special-cancel input and guard may change height during blockstun',()=>{
  let s=attack(fight(),I.LIGHT,0,7);assert.ok(s.hitstop>0);s=stepFight(s,[I.DOWN|I.SPECIAL,0]);s=frames(s,4);assert.equal(s.players[0].action.id,'downSpecial');
  s=fight();s.players[1].blockstun=9;s=stepFight(s,[0,I.GUARD|I.DOWN]);assert.equal(s.players[1].crouching,true);assert.ok(s.players[1].blockstun>0);
});
test('laundromat telegraphs real boundary changes; mall geometry stays fixed',()=>{
  let s=fight({stage:'laundromat'});s.phaseTick=478;s=frames(s,2);assert.equal(s.bounds.warning,true);assert.equal(s.bounds.left,42);
  s.phaseTick=599;s.players[0].x=50;s=stepFight(s);assert.equal(s.bounds.active,true);assert.equal(s.players[0].x,160);
  s.phaseTick=959;s=stepFight(s);assert.equal(s.bounds.active,false);assert.equal(s.bounds.left,42);
  const mall=fight();mall.phaseTick=600;assert.equal(stepFight(mall).bounds.left,42);
});
test('best of three carries meter, resets health and confirms a two-round winner',()=>{
  let s=fight();s.players[0].meter=420;s.players[1].hp=0;s=stepFight(s);assert.equal(s.phase,'roundOver');assert.deepEqual(s.wins,[1,0]);
  s=frames(s,120);assert.equal(s.round,2);assert.equal(s.phase,'intro');assert.equal(s.players[1].hp,1000);assert.equal(s.players[0].meter,420);
  s=frames(s,90);s.players[1].hp=0;s=stepFight(s);s=frames(s,120);assert.equal(s.phase,'finishWindow');s=frames(s,240);assert.equal(s.phase,'finished');assert.equal(s.winner,0);
});
test('timeouts and repeated draws terminate by the fifth round with a declared draw',()=>{
  let s=fight();for(let r=0;r<5;r++){s.roundTicks=1;s=stepFight(s);assert.equal(s.roundWinner,null);s=frames(s,120);if(r<4)s=frames(s,90);}
  assert.equal(s.phase,'finished');assert.equal(s.round,5);assert.equal(s.winner,null);
});
test('late inputs reproduce the exact on-time state and exported replay',()=>{
  const onTime=new RollbackFight(),late=new RollbackFight();
  for(let t=0;t<160;t++){
    if(t===100)assert.ok(onTime.submit(0,100,I.RIGHT,1).ok);
    if(t===107)assert.ok(late.submit(0,100,I.RIGHT,1).rolledBack);
    if(t===135){onTime.submit(0,135,I.LIGHT,2);late.submit(0,135,I.LIGHT,2);}
    onTime.advance();late.advance();
  }
  assert.equal(stateHash(onTime.state),stateHash(late.state));assert.equal(late.corrections,1);assert.equal(stateHash(replayFight(late.exportReplay())),stateHash(late.state));
});
test('rollback rejects stale, duplicate, impossible and distant-future input',()=>{
  const game=new RollbackFight();for(let n=0;n<140;n++)game.advance();
  assert.equal(game.submit(0,140-ROLLBACK_WINDOW-1,1,1).reason,'late');assert.ok(game.submit(0,140-ROLLBACK_WINDOW,1,0).ok);assert.equal(game.submit(0,147,1,1).reason,'future');assert.equal(game.submit(0,140,4096,1).reason,'schema');
  assert.equal(game.submit(2,140,1,1).reason,'slot');assert.ok(game.submit(0,140,1,1).ok);assert.equal(game.submit(0,141,1,1).reason,'sequence');assert.equal(game.submit(0,140,2,2).ok,true);
  assert.ok(game.history.size<=121);
});
test('disconnect neutral clears queued movement without consuming client sequence numbers',()=>{
  const game=new RollbackFight();game.submit(0,0,I.RIGHT,0);game.submit(0,4,I.RIGHT|I.LIGHT,1);game.forceNeutral(0);assert.deepEqual(game.acks,[1,-1]);
  for(let i=0;i<6;i++)game.advance();assert.equal(game.held[0],0);assert.ok(game.submit(0,6,I.LEFT,2).ok);
});
test('a final result is not confirmed until the late-input window has elapsed',()=>{
  const game=new RollbackFight();game.state.phase='roundOver';game.state.phaseTick=119;game.state.wins=[2,0];game.advance();assert.equal(game.state.phase,'finished');assert.equal(game.confirmed,false);
  for(let n=0;n<ROLLBACK_WINDOW-1;n++)game.advance();assert.equal(game.confirmed,false);game.advance();assert.equal(game.confirmed,true);assert.equal(game.submit(0,game.clock,0,1).reason,'confirmed');
});
