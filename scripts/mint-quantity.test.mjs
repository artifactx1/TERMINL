import test from 'node:test';
import assert from 'node:assert/strict';
import { maxMintQuantity } from '../lib/mint-quantity.mjs';
import { describeStage } from '../lib/allowlist.js';
import { describeDrop } from '../lib/mint.js';

const native = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const unlimited = (1n << 256n) - 1n;
const stage = (overrides = {}, counts = {}) => describeStage({
  stage: { stageIndex: 1, name: 'GTD', params: {
    pricePerToken: '0', currency: native, maxMintableByWallet: '50',
    maxSupplyForStage: '50', startTime: '1', endTime: '0', ...overrides,
  } },
  now: 100, lazySupply: 10000n, minted: 0n, stageClaimed: 0n, ...counts,
});
const publicPhase = (condition = {}, totals = {}, claimed = 0n) => ({
  ...describeDrop({ startsAt: 1n, maxClaimable: 10000n, claimed: 0n,
    perWallet: 250n, price: 0n, currency: native, ...condition }, 0n, 100n,
  { minted: 0n, lazySupply: 10000n, ...totals }),
  claimed,
});

test('GTD MAX offers all 50 in one transaction, then only the unspent allocation', () => {
  assert.equal(maxMintQuantity(stage()), 50);
  assert.equal(maxMintQuantity(stage({}, { stageClaimed: 20n, minted: 20n })), 30);
  assert.equal(maxMintQuantity(stage({}, { stageClaimed: 40n, minted: 40n })), 10);
});

test('FCFS uses its own wallet counter and a cumulative supply watermark', () => {
  const terms = { maxMintableByWallet: '250', maxSupplyForStage: '550' };
  assert.equal(maxMintQuantity(stage(terms, { minted: 50n })), 250);
  assert.equal(maxMintQuantity(stage(terms, { stageClaimed: 25n, minted: 75n })), 225);
  assert.equal(maxMintQuantity(stage(terms, { minted: 538n })), 12);
});

test('stage MAX respects the lazy-minted supply and unknown-supply wallet bound', () => {
  const terms = { maxSupplyForStage: '0', maxMintableByWallet: '250' };
  assert.equal(maxMintQuantity(stage(terms, { minted: 9991n })), 9);
  assert.equal(maxMintQuantity(stage(terms, { lazySupply: 0n })), 250);
});

test('public MAX offers the remaining wallet allocation without a batch ceiling', () => {
  assert.equal(maxMintQuantity(publicPhase()), 250);
  assert.equal(maxMintQuantity(publicPhase({}, {}, 20n)), 230);
});

test('public MAX respects both public claims and total supply spent by other stages', () => {
  assert.equal(maxMintQuantity(publicPhase({ maxClaimable: 50n, claimed: 43n })), 7);
  assert.equal(maxMintQuantity(publicPhase({}, { minted: 9995n })), 5);
});

test('unlimited wallet allocations are bounded by remaining supply', () => {
  assert.equal(maxMintQuantity(publicPhase({ perWallet: unlimited }, { minted: 9500n })), 500);
  assert.equal(maxMintQuantity(stage({ maxMintableByWallet: String(unlimited), maxSupplyForStage: '0' }, { minted: 9500n })), 500);
});

test('raw large wallet caps remain binding even when the UI calls them unlimited', () => {
  assert.equal(maxMintQuantity(publicPhase({ perWallet: 1000000n }, {}, 999993n)), 7);
});

test('unavailable and exhausted phases keep a valid idle picker', () => {
  assert.equal(maxMintQuantity(null), 1);
  assert.equal(maxMintQuantity(stage({}, { stageClaimed: 50n, minted: 50n })), 1);
  assert.equal(maxMintQuantity(publicPhase({}, {}, 250n)), 1);
});
