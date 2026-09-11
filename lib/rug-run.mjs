// A deterministic skill arcade. The curve is a simplified fictional constant-product
// market, not a reproduction of any deployed protocol. No real tokens or payments.
export const TICK_MS = 50;
export const END_TICK = 900;
export const MIN_BANK_TICK = 100;
export const FEE = 0.01;
export const TARGET_SCORE = 1000;

export function hash(value) {
  let h = 2166136261;
  for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35); return (h ^ h >>> 16) >>> 0;
}
const rand = (seed, key) => hash(`${seed}:${key}`) / 4294967296;
export const price = pool => pool.quote / pool.tokens;
export function buy(pool, amount) {
  const net = Math.max(0, amount) * (1 - FEE);
  const tokens = pool.tokens - pool.quote * pool.tokens / (pool.quote + net);
  return { pool: { quote: pool.quote + net, tokens: pool.tokens - tokens }, tokens };
}
export function sellValue(pool, tokens) {
  return (pool.quote - pool.quote * pool.tokens / (pool.tokens + Math.max(0, tokens))) * (1 - FEE);
}
export function sell(pool, tokens) {
  const quote = sellValue(pool, tokens);
  // Fees leave the simulated system. The net reserve movement preserves x*y.
  const gross = quote / (1 - FEE);
  return { pool: { quote: pool.quote - gross, tokens: pool.tokens + tokens }, quote };
}
export function newGame(seed) {
  return { seed, tick: 0, lane: 1, hp: 3, shield: false, combo: 0, bestCombo: 0,
    coins: 0, hits: 0, bag: 0, pool: { quote: 10000, tokens: 1000000 }, items: [],
    prices: [0.01], pulse: null, feed: "Your bag is empty. Grab green candles.",
    dead: false, ended: false, rugTick: 320 + Math.floor(rand(seed, "rug-time") * 380),
    hasRug: rand(seed, "rug") < 0.8, lastBankValue: 0 };
}
export function waveFor(seed, tick) {
  const wave = Math.floor(tick / 18);
  const safe = Math.floor(rand(seed, `safe-${wave}`) * 3);
  const bonus = wave > 0 && wave % 9 === 0 ? "shield" : wave > 0 && wave % 6 === 0 ? "gold" : "green";
  const travel = Math.round(62 - Math.min(tick / END_TICK, 1) * 24);
  const double = rand(seed, `double-${wave}`) > 0.45;
  return [0, 1, 2].map(lane => ({ id: `${tick}-${lane}`, lane, born: tick, hitAt: tick + travel,
    kind: lane === safe ? bonus : double || lane === (safe + 1) % 3 ? "red" : "empty" })).filter(item => item.kind !== "empty");
}
export function stepGame(previous) {
  if (previous.ended) return previous;
  const tick = previous.tick + 1;
  let state = { ...previous, tick, items: previous.items.filter(i => i.hitAt >= tick),
    pulse: previous.pulse && tick - previous.pulse.tick < 15 ? previous.pulse : null };
  if (tick % 18 === 1 && tick < END_TICK - 65) state.items = [...state.items, ...waveFor(state.seed, tick)];
  if (tick % 10 === 0) {
    const crashing = state.hasRug && tick >= state.rugTick && tick < state.rugTick + 70;
    const pump = tick < 200 || (tick > 480 && tick < 650);
    const isBuy = !crashing && rand(state.seed, `flow-${tick}`) < (pump ? 0.8 : 0.53);
    const amount = crashing ? 1250 : 70 + rand(state.seed, `size-${tick}`) * (pump ? 380 : 500);
    const trade = isBuy ? buy(state.pool, amount) : sell(state.pool, amount / price(state.pool));
    state.pool = trade.pool;
    state.feed = crashing ? "RUG ALERT: the dev is dumping on the curve." : isBuy ? "New buyers are pumping your bags." : "Paper hands are selling. Watch your exit value.";
    state.prices = [...state.prices.slice(-59), price(state.pool)];
  }
  if (state.hasRug && tick >= state.rugTick - 45 && tick < state.rugTick) state.feed = "WHALE ALERT: dev wallet just woke up. Bank or risk it?";
  for (const item of state.items.filter(i => i.hitAt === tick && i.lane === state.lane)) {
    if (item.kind === "red") {
      if (state.shield) { state.shield = false; state.pulse = { tick, text: "SHIELD SAVED YOUR BAG", kind: "shield" }; }
      else { state.hp--; state.hits++; state.bag *= 0.7; state.combo = 0; state.pulse = { tick, text: "REKT! −30% OF YOUR BAG", kind: "red" }; }
    } else if (item.kind === "shield") {
      state.shield = true; state.pulse = { tick, text: "DIAMOND HANDS SHIELD", kind: "shield" };
    } else {
      state.combo++; state.bestCombo = Math.max(state.combo, state.bestCombo); state.coins++;
      const multiplier = Math.min(5, 1 + Math.floor(state.combo / 4));
      const allocation = (item.kind === "gold" ? 300 : 100) * multiplier;
      const acquired = buy(state.pool, allocation);
      state.pool = acquired.pool; state.bag += acquired.tokens;
      state.pulse = { tick, text: `${item.kind === "gold" ? "GOD CANDLE" : "BAG SECURED"} ×${multiplier}`, kind: item.kind };
    }
  }
  if (state.hp <= 0) { state.dead = true; state.bag = 0; }
  state.ended = state.dead || tick >= END_TICK;
  state.lastBankValue = Math.floor(sellValue(state.pool, state.bag));
  return state;
}
export function validateReplay(data) {
  if (!data || typeof data.seed !== "string" || !/^[a-zA-Z0-9-]{1,64}$/.test(data.seed)
    || !Number.isInteger(data.endTick) || data.endTick < 1 || data.endTick > END_TICK
    || !Array.isArray(data.moves) || data.moves.length > END_TICK) return null;
  let last = -1;
  for (const move of data.moves) {
    if (!move || !Number.isInteger(move.tick) || move.tick <= last || move.tick < 0 || move.tick >= data.endTick || ![0, 1, 2].includes(move.lane)) return null;
    last = move.tick;
  }
  return { seed: data.seed, endTick: data.endTick, moves: data.moves.map(({ tick, lane }) => ({ tick, lane })) };
}
export function replayRun(record) {
  const valid = validateReplay(record);
  if (!valid) throw new Error("Invalid run replay");
  let state = newGame(valid.seed), moveIndex = 0;
  while (state.tick < valid.endTick && !state.ended) {
    if (valid.moves[moveIndex]?.tick === state.tick) state.lane = valid.moves[moveIndex++].lane;
    state = stepGame(state);
  }
  if (state.tick !== valid.endTick || (!state.ended && state.tick < MIN_BANK_TICK)) throw new Error("Run ended before it could be banked");
  return state;
}
export function botReplay(seed, id) {
  let state = newGame(seed), moves = [];
  while (!state.ended) {
    const next = state.items.filter(i => i.hitAt - state.tick <= 8 && i.hitAt > state.tick).sort((a,b) => a.hitAt-b.hitAt);
    if (next.length) {
      const row = next.filter(i => i.hitAt === next[0].hitAt);
      const target = row.find(i => i.kind !== "red");
      const competence = id === "chloe" ? 0.96 : id === "max" ? 0.82 : 0.68;
      let lane = target?.lane ?? state.lane;
      if (rand(seed, `${id}-${next[0].born}`) > competence) lane = (lane + 1) % 3;
      if (lane !== state.lane) { state = { ...state, lane }; moves.push({ tick: state.tick, lane }); }
    }
    if (id === "chloe" && state.hasRug && state.tick === state.rugTick - 15 && state.lastBankValue > 500) break;
    state = stepGame(state);
  }
  return { seed, moves, endTick: state.tick };
}
