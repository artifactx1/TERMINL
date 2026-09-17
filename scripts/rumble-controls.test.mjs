import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_KEYS,savedRumbleKeys,keyLabel,keyboardIdentity} from '../lib/arcade/rumble-controls.mjs';
import {watchPointerRelease} from '../lib/arcade/pointer-release.mjs';

test('existing default preferences migrate, while custom bindings survive',()=>{
  const old={ArrowLeft:1,ArrowRight:2,ArrowUp:4,ArrowDown:8,j:16,k:32,l:64,Shift:128,q:256,e:512,r:1024};
  assert.deepEqual(savedRumbleKeys({keys:old}),DEFAULT_KEYS);
  const custom={...old,h:16};delete custom.j;
  assert.deepEqual(savedRumbleKeys({keys:custom}),custom);
  assert.deepEqual(savedRumbleKeys({keys:old,controlsVersion:2}),old);
  assert.deepEqual(savedRumbleKeys({keys:[]}),DEFAULT_KEYS);
  assert.equal(keyLabel(DEFAULT_KEYS,128),'SPACE');
  assert.equal(keyLabel(DEFAULT_KEYS,512),'I');
});
test('releasing a shifted key identifies the same physical press',()=>{
  assert.equal(keyboardIdentity({code:'KeyJ',key:'J'}),keyboardIdentity({code:'KeyJ',key:'j'}));
  assert.equal(keyboardIdentity({key:'J'}),keyboardIdentity({key:'j'}));
});
test('lost control releases recover globally without canceling another held finger',()=>{
  const target=new EventTarget(),doc=new EventTarget(),held=new Set([1,2]);
  const off=watchPointerRelease({release:e=>held.delete(e.pointerId),clear:()=>held.clear(),hasPointers:()=>held.size>0},target,doc);
  const send=(where,type,props={})=>{const e=new Event(type);Object.assign(e,props);where.dispatchEvent(e);};
  send(target,'pointerup',{pointerId:1});assert.deepEqual([...held],[2]);
  send(doc,'touchend',{touches:[{}]});assert.deepEqual([...held],[2]);
  send(doc,'touchend',{touches:[]});assert.equal(held.size,0);
  held.add(3);send(target,'pointermove',{pointerId:3,buttons:0});assert.equal(held.size,0);
  held.add(4);send(target,'pagehide');assert.equal(held.size,0);
  off();held.add(5);send(target,'pointerup',{pointerId:5});assert.equal(held.size,1);
});
