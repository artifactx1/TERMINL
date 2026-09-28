import test from 'node:test';
import assert from 'node:assert/strict';
import {createMall,stepMall,MALL_TUNING} from '../lib/arcade/after-hours/mall-sim.mjs';
import {trick,bank,comboValue} from '../lib/arcade/after-hours/mall-score.mjs';
import {recordMallGhost,sampleMallGhost,validMallGhost,MAX_GHOST_FRAMES} from '../lib/arcade/after-hours/mall-ghost.mjs';
import {readProgress,recordRun} from '../lib/arcade/after-hours/progress.mjs';
import {planRailLine} from './mall-rail-lines.mjs';

function lastBackflip(){
 const s=createMall({seed:123});while(s.tick<MALL_TUNING.duration-27)stepMall(s);
 stepMall(s,{jump:true});stepMall(s,{jump:true,backflip:true});
 while(s.tick<MALL_TUNING.duration)stepMall(s,{jump:true});return s;
}
test('a real full-length run preserves the last backflip through the buzzer, catch, landing and bank',()=>{
 const s=lastBackflip();assert.equal(s.phase,'playing');assert.equal(s.player.airMove.id,'backflip');assert.equal(s.player.airMove.scored,false);
 assert.equal(s.overtime.started,MALL_TUNING.duration);assert.equal(s.player.bail,0);assert.equal(s.event,null,'closing time cannot start a random hazard or halve this line');
 let caught=false,landingWindow=false;
 for(let i=0;i<240&&s.phase==='playing';i++){stepMall(s);caught||=!!s.combo.seen.BACKFLIP;landingWindow||=s.player.grounded&&s.combo.count>0;}
 assert.ok(caught&&landingWindow);assert.equal(s.phase,'finished');assert.equal(s.overtime.landed,true);assert.equal(s.overtime.banked,960);assert.equal(s.score,960);assert.equal(s.combo.count,0);assert.equal(s.player.bail,0);
 assert.ok(s.tick>MALL_TUNING.duration);assert.equal(s.ghost.at(-1)[0],s.tick);
 const final=structuredClone(s);for(let i=0;i<100;i++)stepMall(s,{jump:true,backflip:true,forward:true});assert.deepEqual(s,final,'result cannot start a second line');
 let raw='';const storage={getItem:()=>raw,setItem:(_,v)=>{raw=v;}};recordRun(readProgress(storage),s,storage);const saved=readProgress(storage);
 assert.equal(saved.mall.records[0].overtime.banked,960);assert.equal(saved.mall.records[0].overtime.ticks,s.tick-MALL_TUNING.duration);assert.equal(saved.mall.ghost.at(-1)[0],s.tick);
});
test('a bail ends overtime immediately and only loses the unbanked line',()=>{
 const s=lastBackflip();s.score=1234;const loss=comboValue(s);stepMall(s,{bail:true});
 assert.equal(s.phase,'finished');assert.equal(s.score,1234);assert.equal(s.combo.count,0);assert.equal(s.overtime.landed,false);assert.equal(s.overtime.lost,loss);assert.equal(s.overtime.banked,0);
});
test('an aligned rail line can continue past zero, change style, then release and finish',()=>{
 const plan=planRailLine(),s=createMall({seed:123});stepMall(s);stepMall(s);
 for(const input of plan.inputs.slice(0,plan.catches[0].frame))stepMall(s,input);
 assert.equal(s.player.rail,'diamond-1');s.tick=MALL_TUNING.duration-1;
 stepMall(s,{forward:true,grind:true});assert.equal(s.phase,'playing');assert.ok(s.overtime);assert.equal(s.player.bail,0);
 stepMall(s,{forward:true,grind:true,flip:true});for(let i=0;i<25;i++)stepMall(s,{forward:true,grind:true});assert.equal(s.player.grind.index,1);
 for(let i=0;i<180&&s.phase==='playing';i++)stepMall(s);
 assert.equal(s.phase,'finished');assert.equal(s.player.rail,null);assert.equal(s.player.manual,false);assert.equal(s.overtime.landed,true);assert.ok(s.overtime.banked>500);
});
test('grounded combo grace and manuals survive the buzzer; explicit banking ends the last line once',()=>{
 const s=createMall({seed:123,character:'paul'});for(let i=0;i<12;i++)stepMall(s,{forward:true});stepMall(s,{manual:true});s.tick=MALL_TUNING.duration-1;
 stepMall(s,{manual:true});assert.ok(s.overtime);assert.equal(s.player.manual,true);assert.equal(s.phase,'playing');
 const beforeBank=s.score;stepMall(s,{manual:true,bank:true});assert.equal(s.phase,'finished');assert.equal(s.player.manual,false);const score=s.score;
 trick(s,'SECOND LINE',99999);bank(s);assert.equal(s.score,score);assert.equal(s.combo.count,0);assert.equal(s.overtime.banked,score-beforeBank);
 const grace=createMall();grace.tick=MALL_TUNING.duration-1;trick(grace,'KICKFLIP',180);stepMall(grace);assert.ok(grace.overtime);assert.equal(grace.phase,'playing');
 for(let i=0;i<80&&grace.phase==='playing';i++)stepMall(grace);assert.equal(grace.phase,'finished');assert.equal(grace.score,180);
});
test('idle and already-bailed runs end at zero; free skate remains untimed',()=>{
 for(const bailed of [false,true]){const s=createMall();s.tick=MALL_TUNING.duration-1;if(bailed)s.player.bail=10;stepMall(s);assert.equal(s.phase,'finished');assert.equal(s.overtime,null);assert.equal(s.player.bail,bailed?9:0);}
 const free=createMall({practice:true});free.tick=MALL_TUNING.duration-1;stepMall(free,{jump:true});for(let i=0;i<300;i++)stepMall(free);assert.equal(free.phase,'playing');assert.equal(free.overtime,null);assert.equal(free.ghost.length,0);
});
test('long overtime ghosts stay bounded, retain the entire timeline and interpolate at real timestamps',()=>{
 const s=createMall();
 for(let tick=1;tick<=100003;tick++){s.tick=tick;Object.assign(s.player,{x:tick/60,y:2,z:-tick/30,yaw:.4});recordMallGhost(s);assert.ok(s.ghost.length<=MAX_GHOST_FRAMES);}
 recordMallGhost(s,true);assert.equal(s.ghost.at(-1)[0],s.tick);assert.equal(s.ghost[0][0],6);assert.ok(s.ghostStride>6);assert.ok(validMallGhost(s.ghost));
 for(const tick of [500,12000,55555,99999]){const sample=sampleMallGhost(s.ghost,tick);assert.ok(Math.abs(sample.x-tick/60)<.011);assert.ok(Math.abs(sample.z+tick/30)<.011);assert.equal(sample.y,2);}
 assert.equal(sampleMallGhost(s.ghost,s.tick+1),null,'ghost leaves when its recorded run ends');
 let raw='';const storage={getItem:()=>raw,setItem:(_,v)=>{raw=v;}};s.phase='finished';recordRun(readProgress(storage),s,storage);assert.equal(readProgress(storage).mall.ghost.at(-1)[0],s.tick);
});
test('old sparse ghost timestamps and yaw wrap play correctly; invalid timelines are rejected',()=>{
 const frames=[[6,0,0,0,Math.PI-.1],[12,6,0,0,-Math.PI+.1],[60,54,0,0,-Math.PI+.1]];
 const turn=sampleMallGhost(frames,9);assert.equal(turn.x,3);assert.ok(Math.abs(turn.yaw-Math.PI)<1e-9);assert.equal(sampleMallGhost(frames,36).x,30);assert.ok(validMallGhost(frames));
 for(const malformed of [[[6,0,0,0,0],[6,1,0,0,0]],[[12,0,0,0,0],[6,0,0,0,0]],[[0,0,NaN,0,0]],null])assert.equal(validMallGhost(malformed),false);
});
