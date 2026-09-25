import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHARACTERS,MOVES,createFight,stepFight,botInput,stateHash,moveFor } from '../lib/arcade/rumble-sim.mjs';
import { RUMBLE_ROSTER,rosterFor } from '../lib/arcade/rumble-roster.mjs';
import { fighterPose,attachmentAnchors,ANIMATION_CLIPS,drawFighter } from '../lib/arcade/rumble-render.js';

test('six public roster entries agree with simulation, canonical assets and manifests',()=>{
  assert.equal(RUMBLE_ROSTER.length,6);assert.deepEqual(RUMBLE_ROSTER.map(r=>r.id),Object.keys(CHARACTERS));
  const manifest=JSON.parse(fs.readFileSync(new URL('../data/arcade-assets.json',import.meta.url)));
  for(const r of RUMBLE_ROSTER){assert.equal(rosterFor(r.id),r);assert.equal(CHARACTERS[r.id].name,r.name);assert.ok(fs.existsSync(new URL(`../public/degens/${r.portrait}.webp`,import.meta.url)));assert.ok(manifest.assets.some(a=>a.character===r.id&&a.role==='articulated-character-rig'));}
  assert.equal(rosterFor('__proto__'),null);assert.equal(rosterFor('missing'),null);
});

test('every fighter has eleven complete, finite moves and distinct gameplay tuning',()=>{
  const signatures=new Set();
  for(const [id,set] of Object.entries(MOVES)){
    assert.equal(Object.keys(set).length,11);assert.equal(new Set(Object.values(set).map(m=>m.name)).size,11);
    for(const move of Object.values(set)){
      for(const key of ['startup','active','recovery','damage','range','hitstun','blockstun','hitAdvantage','blockAdvantage'])assert.ok(Number.isFinite(move[key]),`${id}/${move.id}/${key}`);
      assert.ok(move.range>0&&move.startup>0&&move.active>0&&move.recovery>0);assert.equal(moveFor(id,move.id),move);assert.ok(move.counterplay.length>20);
    }
    signatures.add(JSON.stringify(Object.values(set).map(m=>[m.startup,m.damage,m.range,m.travel,m.armor])));
  }
  assert.equal(signatures.size,6);assert.ok(CHARACTERS.mia.speed>CHARACTERS.max.speed);assert.ok(MOVES.bernie.heavy.range>MOVES.diamond.heavy.range);assert.equal(MOVES.chloe.special.armor,1);assert.equal(MOVES.brian.special.armor,0);
});

test('all 36 ordered matchups advance deterministically without invalid positions or health',()=>{
  for(const a of Object.keys(CHARACTERS))for(const b of Object.keys(CHARACTERS)){
    let state=createFight({characters:[a,b],stage:'laundromat'}),mirror=structuredClone(state);
    for(let tick=0;tick<600;tick++){
      const inputs=[botInput(state,0),botInput(state,1)];state=stepFight(state,inputs);mirror=stepFight(mirror,inputs);
      for(const p of state.players){assert.ok([p.x,p.y,p.vx,p.vy,p.hp,p.meter].every(Number.isFinite),`${a}/${b} at ${tick}`);assert.ok(p.hp>=0&&p.hp<=1000&&p.meter>=0&&p.meter<=1000);}
    }
    assert.equal(stateHash(state),stateHash(mirror),`${a}/${b}`);assert.equal(state.tick,600);
  }
});

test('90 roster animation clips have finite articulated anchors',()=>{
  for(const character of Object.keys(CHARACTERS))for(const clip of ANIMATION_CLIPS){
    const fighter={character,hp:1000,grounded:true,x:500,y:0,face:1,previewClip:clip};
    assert.equal(fighterPose(fighter,30).clip,clip);
    for(const at of Object.values(attachmentAnchors(fighter,30)))assert.ok(at.every(Number.isFinite),`${character}/${clip}`);
  }
});

test('original v1 replay fixtures retain their pre-expansion state hashes',()=>{
  // Captured from the committed two-fighter engine before this expansion.
  const fixtures=[
    [['max','diamond'],'dead-mall','ebf21ab1'],[['max','diamond'],'laundromat','77d4e063'],
    [['diamond','max'],'dead-mall','2e2446ba'],[['diamond','max'],'laundromat','c25c6910'],
    [['max','max'],'dead-mall','d7258afc'],[['max','max'],'laundromat','0526e822'],
    [['diamond','diamond'],'dead-mall','b3eea187'],[['diamond','diamond'],'laundromat','5f9812c1'],
  ];
  for(const [characters,stage,hash] of fixtures){let state=createFight({characters,stage,rulesVersion:1});for(let i=0;i<1200;i++)state=stepFight(state,[botInput(state,0),botInput(state,1)]);assert.equal(stateHash(state),hash,`${characters}/${stage}`);}
});

test('every rig draws every clip and move in both directions with finite canvas coordinates',()=>{
  let depth=0,operations=0;
  const context=new Proxy({save(){depth++;},restore(){assert.ok(depth>0);depth--;},fillText(text,x,y){assert.equal(typeof text,'string');assert.ok(Number.isFinite(x)&&Number.isFinite(y));}}, {get(target,key){return key in target?target[key]:(...args)=>{operations++;for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),String(key));};}});
  for(const character of Object.keys(CHARACTERS))for(const face of [-1,1])for(const clip of ANIMATION_CLIPS){
    const actions=['anticipation','active','recovery'].includes(clip)?Object.keys(MOVES[character]):[null];
    for(const action of actions){
      const timing=action&&MOVES[character][action];
      const fighter={character,hp:1000,grounded:true,x:500,y:0,face,previewClip:clip,action:action?{id:action,frame:clip==='anticipation'?2:timing.startup+(clip==='active'?1:timing.active+6)}:null};
      drawFighter(context,fighter,{tick:30,pixelStyle:false});assert.equal(depth,0,`${character}/${clip}/${action}`);
    }
  }
  assert.ok(operations>10000);
});
