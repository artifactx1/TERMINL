import test from 'node:test';
import assert from 'node:assert/strict';
import {easternMintTime} from '../lib/mint-launch.mjs';

test('10 AM Eastern resolves across the daylight-saving change',()=>{
  assert.equal(new Date(easternMintTime('2026-10-26')).toISOString(),'2026-10-26T14:00:00.000Z');
  assert.equal(new Date(easternMintTime('2026-10-29')).toISOString(),'2026-10-29T14:00:00.000Z');
  assert.equal(new Date(easternMintTime('2026-11-02')).toISOString(),'2026-11-02T15:00:00.000Z');
  assert.equal(easternMintTime('2026-02-30'),null);
});
