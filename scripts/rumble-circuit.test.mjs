import test from 'node:test';
import assert from 'node:assert/strict';
import {newCircuit,readCircuit,circuitOpponent,advanceCircuit,circuitInput} from '../lib/arcade/rumble-circuit.mjs';
import {createFight,stepFight,CHARACTERS} from '../lib/arcade/rumble-sim.mjs';
test('every fighter faces five different opponents and a final mirror, with saved progress',()=>{
  for(const character of Object.keys(CHARACTERS)){let c=newCircuit(character);const seen=[];for(let i=0;i<6;i++){assert.equal(c.index,i);seen.push(circuitOpponent(c));assert.equal(advanceCircuit(c,1),c);assert.equal(advanceCircuit(c,-1),c);c=readCircuit(JSON.stringify(advanceCircuit(c,0)));}assert.equal(new Set(seen).size,6);assert.equal(seen.at(-1),character);assert.equal(c.complete,true);}
  assert.equal(readCircuit('{'),null);assert.equal(readCircuit(JSON.stringify({version:1,character:'max',index:99,complete:false})),null);
});
test('circuit opponents use legal inputs and later rounds reduce their hesitation',()=>{
  const attacks=16|32|64|512|1024,counts=[];
  for(let index=0;index<6;index++){let s=createFight(),count=0;const c={...newCircuit(),index};for(let tick=0;tick<2000;tick++){const before=JSON.stringify(s),input=circuitInput(s,c);assert.equal(JSON.stringify(s),before);assert.ok(input>=0&&input<=2047);if(input&attacks)count++;s=stepFight(s,[0,input]);}counts.push(count);}
  assert.ok(counts[5]>counts[0]);
});
