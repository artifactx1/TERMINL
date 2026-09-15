// Fictional token-launch simulator. SOL uses integer micro-units; tokens are whole units.
export const SAVE_KEY = 'terminl:rug-or-bond:v2';
export const UNIT = 1_000_000;
export const INITIAL_CASH = 10 * UNIT;
export const DURATION = 180;
export const SUPPLY = 1_000_000_000;
export const START_RESERVE = 30 * UNIT;
export const GRADUATION_RESERVE = 85 * UNIT;
export const FEE_BPS = 100; // Authored game fee, not a live protocol fee schedule.
export const PROJECTS = [
  { ticker: 'SOUP', name: 'Soup Protocol', pitch: 'Decentralizing lunch. One suspicious bowl at a time.', icon: '≈', color: '#ffc384' },
  { ticker: 'GRASS', name: 'Touch Grass', pitch: 'The first outside-to-earn ecosystem. Allegedly.', icon: '✳', color: '#b2f48b' },
  { ticker: 'NAP', name: 'Proof of Nap', pitch: 'Passive income, aggressively interpreted.', icon: 'z', color: '#cbb7ff' },
  { ticker: 'BRICK', name: 'Brick Financial', pitch: 'Real-world assets. Literally one brick.', icon: '▥', color: '#ff9987' },
  { ticker: 'GOOSE', name: 'Goose Capital', pitch: 'No roadmap. Just honk.', icon: '↗', color: '#ffe796' },
  { ticker: 'COPE', name: 'Cope Foundation', pitch: 'Turning unrealized losses into a community.', icon: '⌁', color: '#8fdaff' },
  { ticker: 'SOCK', name: 'Sock Exchange', pitch: 'Finally, a use case for the missing one.', icon: '≋', color: '#ffa9da' },
  { ticker: 'BEAN', name: 'Bean Machine', pitch: 'One bean. Infinite whitepaper.', icon: '◒', color: '#b6dba0' },
];
const BOT_NAMES = ['dev', 'diamondhands', 'buyhighbrian', 'anon_420', 'whale.sol'];
function random(seed, key) {
  let h = (seed ^ 2166136261) >>> 0;
  for (const c of String(key)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
const ceilDiv = (a, b) => (a + b - 1n) / b;
export const price = market => market.pool.sol / UNIT / market.pool.tokens;
export const marketCap = market => price(market) * SUPPLY;
export const progress = market => market.graduated ? 1 : Math.max(0, Math.min(1, (market.pool.sol - START_RESERVE) / (GRADUATION_RESERVE - START_RESERVE)));
export function buyQuote(pool, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100 * UNIT) return null;
  const fee = Math.max(1, Math.ceil(amount * FEE_BPS / 10000));
  const net = amount - fee;
  if (net <= 0) return null;
  const tokens = Number(ceilDiv(BigInt(pool.sol) * BigInt(pool.tokens), BigInt(pool.sol + net)));
  const received = pool.tokens - tokens;
  if (received <= 0) return null;
  return { pool: { sol: pool.sol + net, tokens }, amount, tokens: received, fee };
}
export function sellQuote(pool, tokens) {
  if (!Number.isSafeInteger(tokens) || tokens <= 0 || tokens + pool.tokens > SUPPLY) return null;
  const sol = Number(ceilDiv(BigInt(pool.sol) * BigInt(pool.tokens), BigInt(pool.tokens + tokens)));
  const gross = pool.sol - sol;
  const fee = Math.max(1, Math.ceil(gross * FEE_BPS / 10000));
  if (gross <= fee) return null;
  return { pool: { sol, tokens: pool.tokens + tokens }, amount: gross - fee, tokens, fee };
}
export function exitValue(market) { return sellQuote(market.pool, market.held)?.amount || 0; }
export function equity(game) { return game.cash + game.markets.reduce((sum, m) => sum + exitValue(m), 0); }
function record(market, quote, side, who, tick) {
  const next = { ...market, pool: quote.pool, volume: market.volume + quote.amount };
  const value = marketCap(next);
  const candles = [...market.candles];
  const last = candles.at(-1);
  candles[candles.length - 1] = { ...last, high: Math.max(last.high, value), low: Math.min(last.low, value), close: value };
  next.candles = candles.slice(-90);
  next.tape = [{ id: `${tick}-${market.volume}-${who}`, who, side, amount: quote.amount, tokens: quote.tokens, tick }, ...market.tape].slice(0, 12);
  if (!next.graduated && next.pool.sol >= GRADUATION_RESERVE) {
    next.graduated = true;
    next.news = 'BONDED! The token graduated. Trading continues in the simulated pool.';
    next.newsTick = tick;
  }
  return next;
}
function openMarket(seed, project, index) {
  let market = { ...project, id: project.ticker, launchAt: [0, 0, 12, 32, 55][index], pool: { sol: START_RESERVE, tokens: SUPPLY },
    bots: BOT_NAMES.map(() => 0), held: 0, basis: 0, realized: 0, spent: 0, received: 0, volume: 0,
    graduated: false, dumped: false, candles: [{ tick: 0, open: 30, high: 30, low: 30, close: 30 }], tape: [],
    news: 'Trading is open. The dev and early wallets have taken positions.', newsTick: 0 };
  for (let bot = 0; bot < BOT_NAMES.length; bot++) {
    const amount = Math.round((bot === 0 ? 6 + random(seed, `${project.ticker}:dev`) * 7 : 1 + random(seed, `${project.ticker}:initial:${bot}`) * 2) * UNIT);
    const quote = buyQuote(market.pool, amount);
    market = record(market, quote, 'buy', BOT_NAMES[bot], 0);
    market.bots[bot] += quote.tokens;
  }
  market.openCap = marketCap(market);
  market.candles = [{ tick: market.launchAt, open: market.openCap, high: market.openCap, low: market.openCap, close: market.openCap }];
  market.tape = market.tape.map(t => ({ ...t, tick: market.launchAt }));
  return market;
}
export function newGame(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Invalid seed');
  const projects = [...PROJECTS].sort((a, b) => random(seed, a.ticker) - random(seed, b.ticker)).slice(0, 5);
  return { seed, tick: 0, phase: 'trading', cash: INITIAL_CASH, fees: 0, trades: 0, markets: projects.map((p, i) => openMarket(seed, p, i)), finalCash: null };
}
function fillPlayer(game, index, quote, side) {
  const old = game.markets[index];
  const market = record(old, quote, side, 'YOU', game.tick);
  let cash;
  if (side === 'buy') {
    market.held += quote.tokens; market.basis += quote.amount; market.spent += quote.amount;
    cash = game.cash - quote.amount;
  } else {
    const basis = quote.tokens === old.held ? old.basis : Number(BigInt(old.basis) * BigInt(quote.tokens) / BigInt(old.held));
    market.held -= quote.tokens; market.basis -= basis; market.realized += quote.amount - basis; market.received += quote.amount;
    cash = game.cash + quote.amount;
  }
  const markets = [...game.markets]; markets[index] = market;
  return { ...game, cash, markets, fees: game.fees + quote.fee, trades: game.trades + 1 };
}
function finish(game) {
  let next = game;
  for (let i = 0; i < next.markets.length; i++) {
    const m = next.markets[i];
    if (!m.held) continue;
    const quote = sellQuote(m.pool, m.held);
    if (quote) next = fillPlayer(next, i, quote, 'sell');
    else {
      const markets = [...next.markets];
      markets[i] = { ...m, held: 0, basis: 0, realized: m.realized - m.basis, pool: { ...m.pool, tokens: m.pool.tokens + m.held } };
      next = { ...next, markets };
    }
  }
  return { ...next, phase: 'finished', finalCash: next.cash };
}
function step(game) {
  const tick = game.tick + 1;
  const markets = game.markets.map(old => {
    if (tick < old.launchAt) return old;
    let m = { ...old, bots: [...old.bots], candles: [...old.candles, { tick, open: marketCap(old), high: marketCap(old), low: marketCap(old), close: marketCap(old) }].slice(-90) };
    const age = tick - m.launchAt;
    const profile = random(game.seed, `${m.id}:profile`);
    const dumpAt = 26 + Math.floor(random(game.seed, `${m.id}:dump`) * 80);
    const rugProne = profile < 0.48;
    if (rugProne && age === dumpAt - 6) { m.news = 'WALLET ALERT: dev tokens moved to a sell wallet. Six seconds to react.'; m.newsTick = tick; }
    if (rugProne && age === dumpAt && m.bots[0] > 0) {
      const quote = sellQuote(m.pool, m.bots[0]);
      if (quote) { m = record(m, quote, 'sell', 'dev', tick); m.bots[0] = 0; m.dumped = true; m.news = 'DEV DUMP. The creator sold their bag. Other wallets are heading for the exit.'; m.newsTick = tick; }
    }
    const panic = m.dumped && age < dumpAt + 14;
    for (let order = 0; order < 2; order++) {
      const key = `${m.id}:${tick}:${order}`;
      const bot = 1 + Math.floor(random(game.seed, `${key}:who`) * 4);
      const bias = panic ? 0.03 : m.dumped ? 0.37 : profile > 0.72 ? 0.77 : profile > 0.48 ? 0.58 : age < dumpAt ? 0.7 : 0.4;
      const buying = random(game.seed, `${key}:side`) < bias;
      const quote = buying ? buyQuote(m.pool, Math.round((0.1 + random(game.seed, `${key}:size`) * (profile > 0.72 ? 2.1 : 1.35)) * UNIT))
        : sellQuote(m.pool, Math.floor(m.bots[bot] * (panic ? 0.3 + random(game.seed, `${key}:size`) * 0.5 : 0.015 + random(game.seed, `${key}:size`) * 0.09)));
      if (quote) { m = record(m, quote, buying ? 'buy' : 'sell', BOT_NAMES[bot], tick); m.bots[bot] += buying ? quote.tokens : -quote.tokens; }
    }
    if (tick - m.newsTick > 12 && tick % 11 === 0) {
      m.news = m.dumped ? 'The dev is out. Some wallets are buying the dip; others are still selling.' : m.graduated ? 'Graduated and still trading. Bonding does not protect your entry price.' : marketCap(m) > m.candles.at(-1).open ? 'Buyers are pushing up the curve. Watch what your exit is actually worth.' : 'Sellers are taking profit. The curve is moving back down.';
      m.newsTick = tick;
    }
    return m;
  });
  const next = { ...game, tick, markets };
  return tick >= DURATION ? finish(next) : next;
}
export function act(game, action) {
  if (!action || game.phase !== 'trading') return game;
  if (action.type === 'tick') return step(game);
  if (action.type === 'finish') return finish(game);
  if (!['buy', 'sell'].includes(action.type) || game.trades >= 500) return game;
  const index = game.markets.findIndex(m => m.id === action.market);
  const market = game.markets[index];
  if (!market || market.launchAt > game.tick) return game;
  if (action.type === 'buy') {
    if (!Number.isSafeInteger(action.amount) || action.amount > game.cash) return game;
    const quote = buyQuote(market.pool, action.amount);
    return quote ? fillPlayer(game, index, quote, 'buy') : game;
  }
  if (![25, 50, 100].includes(action.percent)) return game;
  const quote = sellQuote(market.pool, Math.floor(market.held * action.percent / 100));
  return quote ? fillPlayer(game, index, quote, 'sell') : game;
}
export function createSession(seed) { return { version: 2, seed, actions: [] }; }
export function restoreSession(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 120000) return null;
    const session = JSON.parse(raw);
    if (session.version !== 2 || !Array.isArray(session.actions) || session.actions.length > 681) return null;
    let game = newGame(session.seed);
    for (const action of session.actions) { const next = act(game, action); if (next === game) return null; game = next; }
    return { session, game };
  } catch { return null; }
}
