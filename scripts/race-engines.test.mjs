// Official Wen Lambo runs are played in the browser and replayed on the server, so the race
// simulation must produce bit-identical results in V8 (server, Chrome) and JavaScriptCore
// (every iPhone browser). Uses the jsc binary that ships with macOS; skipped elsewhere.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const JSC='/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc';
const sim=fileURLToPath(new URL('../lib/arcade/race-sim.mjs',import.meta.url));
// Bot driving plus stretches of analog steering and RECOVER taps, through a whole cup.
const program=`globalThis.structuredClone??=v=>JSON.parse(JSON.stringify(v));
import {createRace,stepRace,raceBotInput} from ${JSON.stringify(sim)};
const bot={id:'b',seed:42,vehicle:'spectre',pace:.82,cornerPace:.93,boostChance:.3,line:8,mistakeRate:.16,reactionTicks:24};
let s=createRace({track:'night-market',vehicles:['comet','spectre'],cup:true}),seed=99,mode=0;
const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
while(s.phase!=='finished'){if(rand()<.004)mode=Math.floor(rand()*4);let input=raceBotInput(s,0,{...bot,pace:1,seed:7});
  if(mode===1)input=((Math.floor(rand()*255)+1)<<7)|4;if(mode===2&&rand()<.02)input|=64;s=stepRace(s,[input,raceBotInput(s,1,bot)]);}
(typeof print==='function'?print:console.log)(JSON.stringify({ticks:s.tick,winner:s.winner,results:s.raceResults.map(r=>r.times),end:s.players.map(p=>[p.x,p.y,p.angle,p.speed])}));`;

test('a Wen Lambo cup plays out identically in V8 and JavaScriptCore',{skip:!existsSync(JSC)&&'JavaScriptCore (jsc) not available'},()=>{
  const dir=mkdtempSync(join(tmpdir(),'race-engines-')),file=join(dir,'cup.mjs');writeFileSync(file,program);
  try{
    const v8=execFileSync(process.execPath,[file],{encoding:'utf8'}).trim(),jsc=execFileSync(JSC,['-m',file],{encoding:'utf8'}).trim();
    assert.ok(JSON.parse(v8).results.length===6,'the cup ran');assert.equal(jsc,v8);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
