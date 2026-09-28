import test from 'node:test';
import assert from 'node:assert/strict';
import {createMall,stepMall} from '../lib/arcade/after-hours/mall-sim.mjs';
import {trick,bail} from '../lib/arcade/after-hours/mall-score.mjs';
import {readProgress,recordRun,SAVE_KEY} from '../lib/arcade/after-hours/progress.mjs';
import {CAREER_ZONES,CAREER_GOALS,GAP_GUIDES,ROUTE_GUIDES,careerCheckpoint,careerGoals,readCareer} from '../lib/arcade/after-hours/mall-career.mjs';
import {planRailLine} from './mall-rail-lines.mjs';
const memory=()=>{let value=null;return {getItem:()=>value,setItem:(key,next)=>{assert.equal(key,SAVE_KEY);value=next;}};};

test('a real free-skate rail line saves landed achievements without collectibles or timed records',()=>{
 const storage=memory(),{state:s}=planRailLine({releaseFrames:3});
 for(let i=0;i<180;i++)stepMall(s);
 assert.ok(s.score>9000);assert.deepEqual(s.tapes,[]);assert.equal(s.gaps?.length||0,0);assert.equal(s.routesCompleted?.length||0,0);
 const fresh=readProgress(storage);assert.notEqual(careerCheckpoint(s),careerCheckpoint(createMall()));recordRun(fresh,s,storage);
 const saved=readProgress(storage);for(const id of ['first-line','big-air','long-jump'])assert.ok(saved.mall.milestones.includes(id));
 assert.equal(saved.mall.career.bestCombo,s.stats.bestCombo);assert.equal(saved.mall.records.length,0);assert.equal(saved.mall.ghost,null);assert.deepEqual(saved.mall.bests,{});
 assert.deepEqual(fresh.mall.milestones,[],'recording does not mutate the previous profile');
 const earned=careerGoals(saved.mall).filter(g=>g.earned);assert.equal(earned.length,3);
});

test('different gaps and district visits accumulate across sessions without duplicate credit',()=>{
 const storage=memory();let progress=readProgress(storage);
 for(const [i,gap]of ['fountain','ath','street'].entries()){
  const s=createMall({practice:true});s.gaps=[gap,gap];s.visited=CAREER_ZONES.slice(i*6,(i+1)*6).map(z=>z.id);
  progress=recordRun(progress,s,storage).progress;
 }
 const saved=readProgress(storage);assert.ok(saved.mall.milestones.includes('gap-hunter'));assert.ok(saved.mall.milestones.includes('park-local'));
 assert.equal(saved.mall.career.districts.length,17);assert.equal(saved.mall.gaps.length,3);
 const empty=createMall({practice:true});const next=recordRun(saved,empty,storage).progress;assert.equal(next.mall.career.districts.length,17);
});

test('route improvements checkpoint even after the rolling run history reaches twenty entries',()=>{
 const storage=memory(),s=createMall({practice:true});s.routesCompleted=Array.from({length:20},()=>({id:'concourse',seconds:100}));
 let p=recordRun(readProgress(storage),s,storage).progress;const before=careerCheckpoint(s);
 s.routesCompleted=[...s.routesCompleted.slice(1),{id:'concourse',seconds:90}];assert.notEqual(careerCheckpoint(s),before);
 p=recordRun(p,s,storage).progress;assert.equal(p.mall.routes.concourse,90);
 s.routesCompleted=Array.from({length:20},()=>({id:'concourse',seconds:110}));p=recordRun(p,s,storage).progress;
 assert.equal(readProgress(storage).mall.routes.concourse,90);assert.ok(p.mall.milestones.includes('night-shift'));
});

test('old saves retain earned milestones, recover best run score, and reject malformed career values',()=>{
 const storage=memory();storage.setItem(SAVE_KEY,JSON.stringify({version:1,mall:{bests:{score:75000},milestones:['long-jump']}}));
 let p=readProgress(storage);assert.equal(p.mall.career.bestRunScore,75000);
 assert.ok(careerGoals(p.mall).find(g=>g.id==='long-jump').earned);assert.ok(careerGoals(p.mall).find(g=>g.id==='gold-run').earned);
 const bad=readCareer({bestCombo:-1,longestAir:'2',longestJump:Infinity,bestRunScore:NaN,districts:['atrium','fake','atrium']});
 assert.deepEqual(bad,{bestCombo:0,longestAir:0,longestJump:0,bestRunScore:0,districts:['atrium']});
 assert.deepEqual(readCareer(null).districts,[]);
});

test('unbanked tricks and bails do not earn combo achievements; idle ticks do not checkpoint',()=>{
 const s=createMall({practice:true}),before=careerCheckpoint(s);s.tick+=120;assert.equal(careerCheckpoint(s),before);
 trick(s,'UNLANDED TEST',20000);assert.equal(careerCheckpoint(s),before);assert.equal(careerGoals({},s).find(g=>g.id==='first-line').earned,false);
 bail(s,'TEST');assert.equal(careerGoals({},s).find(g=>g.id==='first-line').earned,false);
});

test('storage failure keeps the earned career in memory without claiming it was saved',()=>{
 const storage=memory(),s=createMall({practice:true});s.stats.bestCombo=1200;
 const result=recordRun(readProgress(storage),s,{setItem:()=>{throw Error('Quota');}});
 assert.equal(result.saved,false);assert.ok(result.progress.mall.milestones.includes('first-line'));assert.equal(readProgress(storage).mall.milestones.length,0);
});

test('all goal, gap and route guide destinations exist in the playable park',()=>{
 assert.equal(CAREER_GOALS.length,8);assert.equal(GAP_GUIDES.length,5);assert.equal(ROUTE_GUIDES.length,2);
 for(const g of [...CAREER_GOALS,...GAP_GUIDES,...ROUTE_GUIDES]){assert.ok(CAREER_ZONES.some(z=>z.id===g.destination),g.id);assert.ok(g.hint);assert.ok(g.name);}
});
