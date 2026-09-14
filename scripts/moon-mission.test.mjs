import test from "node:test";
import assert from "node:assert/strict";
import { newMoon, stepMoon, moonBotReplay, replayMoon, validateMoonReplay, enemyAt, ENEMIES, RIGHT, LEFT, JUMP, MOON_END_TICK } from "../lib/moon-mission.mjs";
import { awardRun, freshProfile, readProfile, encodeChallenge, decodeChallenge, resultFor } from "../lib/terminl-game.mjs";
import { MOON_WORLDS, moonWorld, PLAYER_W } from "../lib/moon-mission.mjs";
import { drawMoon } from "../lib/moon-draw.js";

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

test("ten distinct authored worlds have safe checkpoints, reachable gem routes and valid finishes", () => {
  assert.equal(MOON_WORLDS.length,10);
  assert.equal(new Set(MOON_WORLDS.map(w=>JSON.stringify(w.ground))).size,10);
  for(const w of MOON_WORLDS){
    assert.equal(moonWorld(w.level),w);
    for(const key of ["platforms","pickups","enemies"])assert.equal(new Set(w[key].map(p=>p.id)).size,w[key].length);
    for(const x of [65,...w.checkpoints,w.finish])assert.ok(w.ground.some(([a,b])=>x>=a&&x+PLAYER_W<=b));
    for(let i=1;i<w.ground.length;i++)assert.ok(w.ground[i][0]-w.ground[i-1][1]<=260);
    for(const p of w.platforms){assert.ok(p.w>0);assert.ok(p.x>=0&&p.x+p.w<=w.width);}
    assert.ok(w.pickups.filter(p=>p.kind==="gem").length>=5);
    const finish=stepMoon({...newMoon("finish",w.level),x:w.finish});
    assert.equal(finish.won,true);assert.equal(finish.ended,true);assert.equal(stepMoon(finish),finish);
    const fall=stepMoon({...newMoon("fall",w.level),checkpoint:w.checkpoints.at(-1),y:621});
    assert.equal(fall.x,w.checkpoints.at(-1));assert.equal(fall.hp,2);
  }
});

test("all ten worlds are beatable by ordinary inputs for all three bots across four seeds", () => {
  for(const world of MOON_WORLDS)for(const seed of ["moon-test","daily-2026-09-14","course-a","course-b"])for(const bot of ["chloe","max","brian"]){
    const record=moonBotReplay(seed,bot,world.level),state=replayMoon(record);
    assert.equal(state.won,true,`${world.name} / ${seed} / ${bot}`);
    assert.equal(state.level,world.level);assert.ok(state.tick<MOON_END_TICK);
    assert.deepEqual(state,replayMoon(record));
  }
});

test("world-aware challenges round-trip, reject bad worlds, and preserve legacy world-zero links", () => {
  for(const world of MOON_WORLDS){
    const record=moonBotReplay("world-link","chloe",world.level);
    const decoded=decodeChallenge(encodeChallenge({v:3,name:"PLAYER",coin:"MOON",...record}));
    assert.equal(decoded.level??0,world.level);assert.deepEqual(replayMoon(decoded),replayMoon(record));
    assert.equal(resultFor({game:"moon",record,rivalRecord:decoded}).tie,true);
  }
  for(const level of [-1,10,1.5,"1",null])assert.equal(validateMoonReplay({seed:"bad",moves:[],endTick:5400,level}),null);
  assert.throws(()=>newMoon("bad",10));
  const legacy=moonBotReplay("old-link");assert.equal(Object.hasOwn(legacy,"level"),false);
  assert.equal(decodeChallenge(encodeChallenge({v:3,name:"PLAYER",coin:"MOON",...legacy})).level,undefined);
  assert.throws(()=>resultFor({game:"moon",record:legacy,rivalRecord:moonBotReplay("old-link","chloe",1)}),/same world/);
});

test("cleared worlds survive reload, deduplicate, and don't multiply the daily bonus", () => {
  let profile=freshProfile();const seed="daily-2026-09-14",date=new Date("2026-09-14T12:00:00Z");
  for(const level of [0,3,9,3]){
    const result=awardRun(profile,{id:`clear-${profile.games}`,game:"moon",mode:"daily",seed,record:moonBotReplay(seed,"chloe",level)},date);
    assert.equal(result.dailyBonus,profile.games===0?100:0);profile=readProfile(JSON.stringify(result.profile));
  }
  assert.deepEqual(profile.moonClears,[0,3,9]);
  assert.deepEqual(readProfile(JSON.stringify({...profile,moonClears:[-1,0,"3",3,3,10,null]})).moonClears,[0,3]);
  assert.deepEqual(readProfile(JSON.stringify({version:2})).moonClears,[]);
});

test("every biome renders finite geometry on portrait and landscape canvases, including effects and collapsed bridges", () => {
  const fingerprints=[];
  for(const world of MOON_WORLDS){
    const calls=[];
    const gradient={addColorStop:(offset,color)=>{assert.ok(Number.isFinite(offset));assert.match(color,/^#[\da-f]{6}([\da-f]{2})?$/i);}};
    const ctx=new Proxy({}, {get:(_,key)=>(...args)=>{
      for(const a of args)if(typeof a==="number")assert.ok(Number.isFinite(a),`${world.name}: ${key}`);
      calls.push([key,...args]);return key.startsWith("create")?gradient:undefined;
    },set:(_,key,value)=>{if(key==="fillStyle"||key==="strokeStyle")assert.ok(value);return true;}});
    for(const width of [320,960,1800])for(const x of [65,world.width*.5,world.finish]){
      const state={...newMoon("render",world.level),x,tick:90,shield:true,input:RIGHT,vx:245,pulse:{kind:"coin",tick:80,text:"+100"},crumbling:{rug0:40,rug1:75}};
      drawMoon(ctx,state,width,{ghost:{...state,x:x+90}});
    }
    fingerprints.push(JSON.stringify(calls));
  }
  assert.equal(new Set(fingerprints).size,10);
});
