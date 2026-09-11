import test from "node:test";
import assert from "node:assert/strict";
import { newMoon, stepMoon, moonBotReplay, replayMoon, validateMoonReplay, enemyAt, ENEMIES, RIGHT, LEFT, JUMP, MOON_END_TICK } from "../lib/moon-mission.mjs";
import { awardRun, freshProfile, readProfile, encodeChallenge, decodeChallenge, resultFor } from "../lib/terminl-game.mjs";

test("running accelerates, stops, and stays inside the world", () => {
  let s = {...newMoon("physics"), input: RIGHT};
  for(let i=0;i<30;i++)s=stepMoon(s);
  assert.ok(s.x>150);assert.equal(s.vx,245);assert.equal(s.grounded,true);
  s.input=0;for(let i=0;i<10;i++)s=stepMoon(s);
  assert.equal(s.vx,0);
  assert.equal(stepMoon({...newMoon("edge"),x:0,input:LEFT}).x,0);
});
test("jump supports variable height and exactly one midair double jump", () => {
  const initial={...newMoon("jump"),input:JUMP};
  const first=stepMoon(initial);
  assert.ok(first.y<initial.y);assert.equal(first.jumps,1);
  const held=stepMoon(first), released=stepMoon({...first,input:0});
  assert.ok(held.vy<released.vy);
  const second=stepMoon({...released,input:JUMP});
  assert.equal(second.jumps,2);assert.equal(second.vy,-555);
  const third=stepMoon({...stepMoon({...second,input:0}),input:JUMP});
  assert.equal(third.jumps,2);assert.ok(third.vy>second.vy);
});
test("one-way platforms catch falling players and rug bridges collapse then return", () => {
  const landed=stepMoon({...newMoon("platform"),x:280,y:329,vy:180,grounded:false});
  assert.equal(landed.y,331);assert.equal(landed.grounded,true);
  let rug=stepMoon({...newMoon("rug"),x:1800,y:354,vy:180,grounded:false});
  assert.equal(rug.crumbling.rug1,1);
  for(let i=0;i<33;i++)rug=stepMoon(rug);
  assert.equal(rug.grounded,false);assert.ok(rug.y>356);
  const restored=stepMoon({...newMoon("rug"),tick:241,x:1800,y:354,vy:180,grounded:false,crumbling:{rug1:1}});
  assert.equal(restored.grounded,true);assert.equal(restored.crumbling.rug1,242);
});
test("coins collect only once, purple gems give 500, and blue diamonds give a shield", () => {
  const coin=stepMoon({...newMoon("pickup"),x:105});
  assert.equal(coin.coins,1);assert.equal(coin.score,100);
  assert.equal(stepMoon(coin).score,100);
  const gem=stepMoon({...newMoon("pickup"),x:535,y:236,grounded:false});
  assert.ok(gem.collected.includes("top-p2-1"));assert.ok(gem.score>=500);assert.equal(gem.shield,true);
});
test("stomping defeats an enemy, side hits damage, and a shield absorbs a hit", () => {
  const seed="enemy", e=enemyAt(ENEMIES[0],1,seed);
  const stomp=stepMoon({...newMoon(seed),x:e.x,y:392,vy:200,grounded:false});
  assert.equal(stomp.stomps,1);assert.ok(stomp.defeated.includes(e.id));assert.equal(stomp.hp,3);
  const hit=stepMoon({...newMoon(seed),x:e.x,y:426,score:1000});
  assert.equal(hit.hp,2);assert.equal(hit.score,800);
  const shield=stepMoon({...newMoon(seed),x:e.x,y:426,shield:true});
  assert.equal(shield.hp,3);assert.equal(shield.shield,false);
  assert.equal(stepMoon(shield).hp,3);
});
test("falls restore the checkpoint, cost a life and score, and final death ends the run", () => {
  const checkpoint=stepMoon({...newMoon("fall"),x:1130});
  assert.equal(checkpoint.checkpoint,1120);
  const fall=stepMoon({...checkpoint,x:1800,y:621,score:1000});
  assert.equal(fall.x,1120);assert.equal(fall.hp,2);assert.equal(fall.score,800);
  const dead=stepMoon({...fall,y:621,hp:1});
  assert.equal(dead.ended,true);assert.equal(dead.dead,true);assert.equal(dead.score,0);assert.equal(stepMoon(dead),dead);
});
test("the complete course is beatable and input replays reproduce wins exactly", () => {
  for(const seed of ["moon-test","daily-2026-09-11","course-a","course-b"]){
    const record=moonBotReplay(seed,"chloe"), state=replayMoon(record);
    assert.equal(state.won,true);assert.ok(state.score>1000);assert.ok(state.tick<MOON_END_TICK);
    assert.deepEqual(record,moonBotReplay(seed,"chloe"));assert.deepEqual(state,replayMoon(record));
  }
});
test("invalid inputs, impossible early finishes, and post-finish records are rejected", () => {
  const record=moonBotReplay("moon-test");
  assert.equal(validateMoonReplay({...record,moves:[{tick:5,input:2},{tick:4,input:0}]}),null);
  assert.equal(validateMoonReplay({...record,moves:[{tick:0,input:8}]}),null);
  assert.equal(validateMoonReplay({...record,endTick:5401}),null);
  assert.throws(()=>replayMoon({seed:"early",endTick:50,moves:[]}));
  assert.throws(()=>replayMoon({...record,endTick:record.endTick+1}));
  const timeout=replayMoon({seed:"timeout",endTick:5400,moves:[]});
  assert.equal(timeout.won,false);assert.equal(timeout.ended,true);
});
test("Moon challenges round-trip, select the correct game, and identical ghosts draw", () => {
  const record=moonBotReplay("moon-test"), decoded=decodeChallenge(encodeChallenge({v:3,name:"PLAYER",coin:"MOON",...record}));
  assert.equal(decoded.game,"moon");assert.deepEqual(decoded.moves,record.moves);
  const result=resultFor({game:"moon",record,rivalRecord:decoded});
  assert.equal(result.tie,true);assert.equal(result.win,false);assert.equal(result.score,result.rival);
});
test("Moon shares existing saves and rewards without resetting cosmetics or duplicating daily credit", () => {
  const date=new Date("2026-09-11T12:00:00Z"), seed="daily-2026-09-11";
  const old={...freshProfile(),credits:500,owned:["phosphor","amber"],theme:"amber",dailyClaims:[seed]};
  const run={id:"moon-one",game:"moon",mode:"daily",seed,record:moonBotReplay(seed)};
  const earned=awardRun(readProfile(JSON.stringify(old)),run,date);
  assert.equal(earned.dailyBonus,0);assert.ok(earned.unlocked.includes("moon"));assert.equal(earned.profile.theme,"amber");
  assert.ok(earned.profile.credits>500);assert.equal(earned.profile.history[0].game,"moon");
  assert.equal(awardRun(earned.profile,run,date).reward,0);
  assert.equal(resultFor({game:"moon",record:{seed:"timeout",endTick:5400,moves:[]}}).win,false);
});
