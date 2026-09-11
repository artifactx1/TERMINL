import test from "node:test";
import assert from "node:assert/strict";
import { newGame, stepGame, buy, sell, sellValue, price, waveFor, botReplay, replayRun, validateReplay, END_TICK } from "../lib/rug-run.mjs";
import { dailySeed, encodeChallenge, decodeChallenge, freshProfile, readProfile, awardRun, purchaseTheme, STORAGE_KEY } from "../lib/terminl-game.mjs";
const day = new Date("2026-09-11T22:00:00Z");
function cleanRun(seed, endTick = END_TICK) {
  let state = newGame(seed), moves = [];
  while (state.tick < endTick && !state.ended) {
    const row = state.items.filter(i => i.hitAt === state.tick + 1);
    const safe = row.find(i => i.kind !== "red");
    if (safe && safe.lane !== state.lane) {
      state = {...state, lane: safe.lane};
      moves.push({tick:state.tick,lane:state.lane});
    }
    state = stepGame(state);
  }
  return {record:{seed,moves,endTick:state.tick}, state};
}
const run = (overrides={}) => ({id:"one",mode:"daily",seed:dailySeed(day),coin:"COPE",record:cleanRun(dailySeed(day),250).record,...overrides});

test("constant-product trades conserve the invariant and fees prevent round-trip profit",()=>{
  const pool={quote:10000,tokens:1000000}, bought=buy(pool,1000);
  assert.ok(price(bought.pool)>price(pool));
  assert.ok(Math.abs(bought.pool.quote*bought.pool.tokens-pool.quote*pool.tokens)<0.01);
  const sold=sell(bought.pool,bought.tokens);
  assert.ok(sold.quote<1000 && sold.quote>970);
  assert.ok(Math.abs(sold.pool.quote*sold.pool.tokens-pool.quote*pool.tokens)<0.01);
  assert.equal(sellValue(pool,0),0);
});
test("exit quote includes price impact instead of claiming mark-to-market proceeds",()=>{
  const pool={quote:10000,tokens:1000000};
  assert.ok(sellValue(pool,300000)<300000*price(pool)*0.99);
  assert.ok(sellValue(pool,100000000)<pool.quote);
});
test("every obstacle wave has an achievable safe pickup and travel time shortens",()=>{
  for(let tick=1;tick<END_TICK;tick+=18){
    const wave=waveFor("course",tick);
    assert.ok(wave.some(i=>i.kind!=="red"));
    assert.equal(new Set(wave.map(i=>i.lane)).size,wave.length);
  }
  assert.ok(waveFor("course",1)[0].hitAt-1>waveFor("course",721)[0].hitAt-721);
});
test("red hits cost a life and 30% of the bag, shields absorb hits, death wipes the bag",()=>{
  const initial={...newGame("collision"),bag:1000,items:[{id:"hit",kind:"red",lane:1,born:0,hitAt:1}]};
  const hit=stepGame(initial);
  assert.equal(hit.hp,2);assert.equal(hit.bag,700);assert.equal(hit.combo,0);
  const protectedState=stepGame({...initial,shield:true});
  assert.equal(protectedState.hp,3);assert.equal(protectedState.bag,1000);assert.equal(protectedState.shield,false);
  const dead=stepGame({...initial,hp:1});
  assert.equal(dead.dead,true);assert.equal(dead.bag,0);assert.equal(dead.lastBankValue,0);
  assert.equal(stepGame(dead),dead);
});
test("pickups grow the bag and combo milestones increase the allocation",()=>{
  const initial={...newGame("pickup"),items:[{id:"coin",kind:"green",lane:1,born:0,hitAt:1}]};
  const one=stepGame(initial),combo=stepGame({...initial,combo:3}),gold=stepGame({...initial,items:[{id:"gold",kind:"gold",lane:1,born:0,hitAt:1}]});
  assert.equal(one.coins,1);assert.ok(one.bag>0);assert.ok(combo.bag>one.bag);assert.ok(gold.bag>combo.bag);
});
test("recorded inputs reproduce the exact finish and perfect movement can survive every wave",()=>{
  for(const seed of ["course-a","course-b","daily-2026-09-11"]){
    const {record,state}=cleanRun(seed);
    const replay=replayRun(record);
    assert.equal(state.hp,3);assert.equal(state.tick,END_TICK);
    assert.equal(replay.lastBankValue,state.lastBankValue);
    assert.equal(replay.bag,state.bag);assert.equal(replay.coins,state.coins);
    assert.ok(state.lastBankValue>1000);
  }
});
test("early banking locks the quote and invalid or impossible replays are rejected",()=>{
  const {record,state}=cleanRun("bank",150);
  assert.equal(replayRun(record).lastBankValue,state.lastBankValue);
  assert.throws(()=>replayRun({...record,endTick:50,moves:[]}));
  assert.equal(validateReplay({...record,moves:[{tick:20,lane:0},{tick:10,lane:2}]}),null);
  assert.equal(validateReplay({...record,moves:[{tick:2,lane:3}]}),null);
  assert.equal(validateReplay({...record,endTick:901}),null);
  const dying={seed:"bank",moves:[],endTick:END_TICK};
  assert.throws(()=>replayRun(dying));
});
test("daily course changes at UTC midnight and bot ghosts replay deterministically",()=>{
  assert.equal(dailySeed(day),dailySeed(new Date("2026-09-11T00:00:00Z")));
  assert.notEqual(dailySeed(day),dailySeed(new Date("2026-09-12T00:00:00Z")));
  for(const id of ["max","chloe","brian"]){
    const record=botReplay("bot-test",id);
    assert.deepEqual(record,botReplay("bot-test",id));
    assert.ok(Number.isFinite(replayRun(record).lastBankValue));
  }
});
test("friend challenges round-trip inputs and reject malformed links and fake scores",()=>{
  const challenge={v:2,name:"ANON_2",coin:"REKT",...cleanRun("friend",300).record,score:999999};
  const decoded=decodeChallenge(encodeChallenge(challenge));
  assert.ok(decoded);assert.equal(decoded.score,undefined);assert.deepEqual(decoded.moves,challenge.moves);
  assert.equal(replayRun(decoded).lastBankValue,replayRun(challenge).lastBankValue);
  for(const invalid of ["","!bad","a".repeat(18001),btoa("null"),btoa("{}"),btoa("[2]")])assert.equal(decodeChallenge(invalid),null);
});
test("rewards are idempotent and the daily bonus is available only once",()=>{
  const first=awardRun(freshProfile(),run(),day);
  assert.equal(first.dailyBonus,100);
  assert.equal(first.profile.games,1);
  assert.ok(first.unlocked.includes("boot"));
  assert.equal(awardRun(first.profile,run(),day).reward,0);
  const second=awardRun(first.profile,run({id:"two"}),day);
  assert.equal(second.dailyBonus,0);assert.equal(second.unlocked.length,0);
  assert.equal(second.reward,60+(second.win?80:0));
  assert.equal(awardRun(freshProfile(),run({mode:"challenge"}),day).dailyBonus,0);
});
test("same-score friend ghosts draw and a higher score wins",()=>{
  const r=run(),tied=awardRun(freshProfile(),{...r,mode:"challenge",rivalRecord:r.record},day);
  assert.equal(tied.tie,true);assert.equal(tied.win,false);
  const better=run({record:cleanRun(dailySeed(day)).record,rivalRecord:r.record,mode:"challenge"});
  const result=awardRun(freshProfile(),better,day);
  assert.ok(result.win);assert.ok(result.unlocked.includes("friend"));
});
test("cosmetics charge once and damaged saves recover safely",()=>{
  const initial=freshProfile();
  assert.equal(purchaseTheme(initial,"amber"),initial);
  const purchased=purchaseTheme({...initial,credits:200},"amber");
  assert.equal(purchased.credits,80);assert.equal(purchased.theme,"amber");
  assert.equal(purchaseTheme(purchased,"amber").credits,80);
  assert.deepEqual(readProfile("not json"),freshProfile());
  assert.deepEqual(readProfile("null"),freshProfile());
  assert.deepEqual(readProfile(JSON.stringify(purchased)),purchased);
  assert.equal(readProfile(JSON.stringify({version:2,credits:-20,owned:["fake"]})).credits,0);
  assert.equal(STORAGE_KEY,"terminl-os:v2");
});
