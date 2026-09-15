import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT, INITIAL_CASH, DURATION, SUPPLY, START_RESERVE, GRADUATION_RESERVE, newGame, act, buyQuote, sellQuote, price, progress, exitValue, equity, createSession, restoreSession } from '../lib/arcade/rug-or-bond.mjs';
const buy = (g, amount = UNIT, index = 0) => act(g, { type: 'buy', market: g.markets[index].id, amount });
const sell = (g, percent = 100, index = 0) => act(g, { type: 'sell', market: g.markets[index].id, percent });
const step = g => act(g, { type: 'tick' });
const invariant = pool => BigInt(pool.sol) * BigInt(pool.tokens);
function check(g) {
  assert.ok(Number.isSafeInteger(g.cash) && g.cash >= 0);
  for (const m of g.markets) {
    assert.equal(m.pool.tokens + m.held + m.bots.reduce((a, b) => a + b, 0), SUPPLY, 'Token supply conserved');
    assert.ok(Number.isSafeInteger(m.pool.sol) && m.pool.sol >= START_RESERVE);
    assert.ok(m.bots.every(n => Number.isSafeInteger(n) && n >= 0));
    assert.ok(Number.isSafeInteger(m.basis) && m.basis >= 0);
    assert.equal(m.realized + exitValue(m) - m.basis, m.received + exitValue(m) - m.spent);
    assert.ok(m.candles.every(c => [c.open, c.close, c.high, c.low].every(Number.isFinite) && c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close)));
  }
  assert.equal(equity(g) - INITIAL_CASH, g.markets.reduce((total, m) => total + m.realized + exitValue(m) - m.basis, 0));
}

test('curve buys raise prices, sells lower prices, integer rounding preserves the invariant', () => {
  for (const amount of [100, 1000, 100000, UNIT, 10 * UNIT]) {
    const pool = { sol: START_RESERVE, tokens: SUPPLY };
    const bought = buyQuote(pool, amount);
    assert.ok(bought && bought.tokens > 0);
    assert.ok(price({ pool: bought.pool }) > price({ pool }));
    assert.ok(invariant(bought.pool) >= invariant(pool));
    const sold = sellQuote(bought.pool, bought.tokens);
    assert.ok(sold.amount < amount, 'Round trip loses fees, never creates money');
    assert.ok(price({ pool: sold.pool }) < price({ pool: bought.pool }));
    assert.ok(invariant(sold.pool) >= invariant(bought.pool));
    assert.equal(sold.pool.tokens, SUPPLY);
  }
});

test('large orders include price impact and exit value is an executable sell quote', () => {
  const g = newGame(42), m = g.markets[0];
  const small = buyQuote(m.pool, UNIT), large = buyQuote(m.pool, 5 * UNIT);
  assert.ok(large.tokens / 5 < small.tokens);
  const bought = buy(g, UNIT);
  assert.equal(exitValue(bought.markets[0]), sellQuote(bought.markets[0].pool, bought.markets[0].held).amount);
  assert.ok(equity(bought) < INITIAL_CASH);
});

test('only launched coins trade; reject overdrafts, shorts and malformed orders', () => {
  const g = newGame(1);
  for (const amount of [0, -UNIT, 0.5, NaN, Infinity, '100', INITIAL_CASH + 1]) assert.equal(buy(g, amount), g);
  assert.equal(sell(g), g);
  assert.equal(buy(g, UNIT, 2), g);
  assert.equal(act(g, { type: 'buy', market: 'MISSING', amount: UNIT }), g);
  const bought = buy(g); assert.equal(sell(bought, 101), bought);
});

test('partial sells preserve cost basis and the final sale realizes the full position', () => {
  let g = buy(newGame(12), 2 * UNIT);
  const held = g.markets[0].held;
  g = sell(g, 25);
  assert.equal(g.markets[0].held, held - Math.floor(held / 4));
  check(g);
  g = buy(g, UNIT); g = step(g); g = sell(g, 50); check(g);
  g = sell(g, 100); check(g);
  assert.equal(g.markets[0].held, 0);
  assert.equal(g.markets[0].basis, 0);
  assert.equal(g.cash - INITIAL_CASH, g.markets[0].realized);
});

test('all markets advance together, preserve supply and settle exactly once across full sessions', () => {
  let graduates = 0, dumps = 0;
  for (let seed = 0; seed < 40; seed++) {
    let g = newGame(seed);
    for (let tick = 0; tick < DURATION; tick++) {
      if (tick % 13 === 0) g = buy(g, UNIT / 2, tick % 5);
      if (tick % 17 === 0) g = sell(g, 50, tick % 5);
      g = step(g); check(g);
    }
    assert.equal(g.phase, 'finished');
    assert.equal(g.finalCash, g.cash);
    assert.ok(g.markets.every(m => m.held === 0 && m.basis === 0));
    assert.equal(step(g), g);
    assert.equal(act(g, { type: 'finish' }), g);
    assert.equal(buy(g), g);
    for (const m of g.markets) {
      if (m.graduated) { graduates++; assert.equal(progress(m), 1); }
      if (m.dumped) { dumps++; assert.equal(m.bots[0], 0); }
    }
  }
  assert.ok(graduates > 0 && dumps > 0);
});

test('player buying can graduate a token; graduation never reverses after a sell', () => {
  let g = newGame(5);
  const initial = g.markets[0];
  // Author a test fixture just below the threshold with a supply-conserving bot purchase.
  const q = buyQuote(initial.pool, Math.floor((GRADUATION_RESERVE - initial.pool.sol - UNIT / 4) / .99));
  const m = { ...initial, pool: q.pool, bots: [...initial.bots] }; m.bots[1] += q.tokens;
  g = { ...g, markets: [m, ...g.markets.slice(1)] };
  g = buy(g, UNIT);
  assert.equal(g.markets[0].graduated, true);
  g = sell(g);
  assert.equal(g.markets[0].graduated, true);
  assert.equal(progress(g.markets[0]), 1);
});

test('dev warning precedes an inventory-backed dump and price drops on the dump tick', () => {
  let g = newGame(1), warned = false, caught = false;
  for (let tick = 0; tick < 150; tick++) {
    const previous = g.markets;
    g = step(g);
    for (let i = 0; i < g.markets.length; i++) {
      const m = g.markets[i];
      if (m.news.startsWith('WALLET ALERT')) warned = true;
      if (!previous[i].dumped && m.dumped) {
        assert.equal(m.bots[0], 0);
        assert.ok(previous[i].bots[0] > 0);
        assert.ok(price(m) < price(previous[i]));
        caught = true;
      }
    }
  }
  assert.ok(warned && caught);
});

test('early cash-out equals executable portfolio value and replay restores every phase', () => {
  let g = newGame(9); const session = createSession(9);
  const apply = action => { const next = act(g, action); assert.notEqual(next, g); g = next; session.actions.push(action); };
  apply({ type: 'buy', market: g.markets[0].id, amount: UNIT });
  for (let i = 0; i < 60; i++) apply({ type: 'tick' });
  apply({ type: 'buy', market: g.markets[2].id, amount: UNIT });
  assert.deepEqual(restoreSession(JSON.stringify(session)).game, g);
  const value = equity(g);
  apply({ type: 'finish' });
  assert.equal(g.cash, value);
  assert.deepEqual(restoreSession(JSON.stringify(session)).game, g);
});

test('sitting out retains 10 SOL and trade cap still allows automatic liquidation', () => {
  let g = newGame(3);
  for (let i = 0; i < DURATION; i++) g = step(g);
  assert.equal(g.cash, INITIAL_CASH);
  g = buy(newGame(3)); g = { ...g, trades: 500 };
  assert.equal(buy(g), g);
  assert.equal(sell(g), g);
  const finished = act(g, { type: 'finish' });
  assert.equal(finished.phase, 'finished'); assert.equal(finished.markets[0].held, 0);
});

test('invalid and previous-version saves cannot inject credits or break recovery', () => {
  for (const raw of ['nope', 'null', '{}', JSON.stringify({ version: 1, seed: 1, actions: [] }), JSON.stringify({ version: 2, seed: -1, actions: [] }), JSON.stringify({ version: 2, seed: 1, actions: [{ type: 'sell', market: 'SOUP', percent: 100 }] }), 'x'.repeat(120001)]) assert.equal(restoreSession(raw), null);
  const restored = restoreSession(JSON.stringify({ ...createSession(42), cash: 99999999 }));
  assert.equal(restored.game.cash, INITIAL_CASH);
});
