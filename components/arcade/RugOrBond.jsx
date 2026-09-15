import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SAVE_KEY, UNIT, INITIAL_CASH, DURATION, SUPPLY, newGame, act, marketCap, progress, buyQuote, sellQuote, exitValue, equity, createSession, restoreSession } from '../../lib/arcade/rug-or-bond.mjs';
import s from '../../styles/RugOrBond.module.css';

const sol = n => (n / UNIT).toFixed(4);
const short = n => Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
const signed = n => `${n < 0 ? '−' : '+'}${sol(Math.abs(n))}`;
const clock = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
const preview = newGame(20260915);

function Chart({ market }) {
  const candles = market.candles;
  const low = Math.min(...candles.map(c => c.low)) * 0.94;
  const high = Math.max(...candles.map(c => c.high)) * 1.06;
  const y = value => 245 - (value - low) / (high - low) * 215;
  const width = 635 / Math.max(35, candles.length);
  const left = 650 - candles.length * width;
  return <div className={s.chart}><div className={s.chartTop}><span>MARKET CAP · SIM SOL</span><span>1s CANDLES</span></div><svg viewBox="0 0 720 280" role="img" aria-label={`${market.ticker} candlestick chart. Market cap ${marketCap(market).toFixed(2)} simulated SOL.`}>
    {[0, 1, 2, 3].map(i => { const value = low + (high - low) * i / 3; return <g key={i}><line x1="15" x2="650" y1={y(value)} y2={y(value)} stroke="#263239" strokeDasharray="3 5" /><text x="660" y={y(value) + 4} fill="#8e9fa8" fontSize="10">{value.toFixed(1)}</text></g>; })}
    {candles.map((c, i) => { const color = c.close >= c.open ? '#87edbc' : '#ff8796'; const x = left + i * width + width / 2; return <g key={c.tick}><line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} /><rect x={x - width * .32} y={Math.min(y(c.open), y(c.close))} width={Math.max(2, width * .64)} height={Math.max(2, Math.abs(y(c.close) - y(c.open)))} fill={color} /></g>; })}
    <line x1="15" x2="650" y1={y(marketCap(market))} y2={y(marketCap(market))} stroke="#87edbc" strokeDasharray="4 5" opacity=".45" />
    <text x="15" y="270" fill="#8e9fa8" fontSize="10">{clock(candles[0].tick)}</text><text x="615" y="270" fill="#8e9fa8" fontSize="10">{clock(candles.at(-1).tick)}</text>
  </svg>{candles.length === 1 && <span className={s.chartEmpty}>First candle is forming. Trades draw the chart.</span>}</div>;
}

export default function RugOrBond() {
  const [frame, setFrame] = useState(null);
  const current = useRef(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(true);
  const [selected, setSelected] = useState(0);
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('0.5');
  const [fraction, setFraction] = useState(100);
  const [notice, setNotice] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const finishDialog = useRef(null);
  const summaryHeading = useRef(null);
  const game = frame?.game || preview;
  const market = game.markets[selected];
  const finished = game.phase === 'finished';
  const running = !!frame && !paused && !finished;
  const launched = game.tick >= market.launchAt;
  const commit = useCallback((next) => {
    current.current = next; setFrame(next);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(next.session)); } catch { setStorageWarning(true); }
  }, []);
  const dispatch = useCallback((action) => {
    const old = current.current;
    if (!old) return;
    const next = act(old.game, action);
    if (next === old.game) { if (action.type !== 'tick') setNotice('Order could not fill. Check your balance and position.'); return; }
    commit({ game: next, session: { ...old.session, actions: [...old.session.actions, action] } });
    if (action.type === 'buy' || action.type === 'sell') {
      const fill = next.markets.find(m => m.id === action.market).tape[0];
      setNotice(`${action.type === 'buy' ? 'Bought' : 'Sold'} ${short(fill.tokens)} $${action.market} for ${sol(fill.amount)} sim SOL.`);
    }
    if (next.phase === 'finished') { setPaused(true); setNotice('Session closed. All remaining tokens sold at the available pool prices.'); }
  }, [commit]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const restored = raw && restoreSession(raw);
      if (restored) { current.current = restored; setFrame(restored); setNotice('Session restored and paused. Resume when you’re ready.'); }
      else if (raw) setNotice('This save could not be restored. Start a new session.');
    } catch { setStorageWarning(true); }
    setReady(true);
    const hide = () => { if (document.hidden) setPaused(true); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => clearInterval(timer);
  }, [running, dispatch]);
  useEffect(() => { if (finished) summaryHeading.current?.focus(); }, [finished]);
  function start() {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    commit({ session: createSession(seed), game: newGame(seed) });
    setSelected(0); setSide('buy'); setAmount('0.5'); setPaused(false); setNotice('You’re live. Pick a token, take an entry, and watch your exit.');
  }
  const inputAmount = Number(amount);
  const units = Number.isFinite(inputAmount) && inputAmount > 0 ? Math.round(inputAmount * UNIT) : 0;
  const quote = side === 'buy' ? buyQuote(market.pool, units) : sellQuote(market.pool, Math.floor(market.held * fraction / 100));
  const disabled = !running || !launched || !quote || (side === 'buy' && units > game.cash) || game.trades >= 500;
  const pnl = exitValue(market) - market.basis;
  const total = equity(game);
  const change = (marketCap(market) / market.openCap - 1) * 100;

  return <div className={s.shell}>
    <header className={s.header}><Link href="/os" className={s.brand}>TERMINL<span> / ARCADE</span></Link><span className={s.simBadge}>SOLO SIMULATOR</span><Link href="/os">← ARCADE</Link></header>
    <main className={s.main}>
      <div className={s.titleRow}><div><h1>RUG <span>OR</span> BOND<span className={s.dot}>.</span></h1><p>The memecoin trading sim. Find your entry. Know your exit.</p></div><div className={s.wallet}><small>YOUR SIM WALLET</small><b>{sol(game.cash)} <span>SOL</span></b><span className={total >= INITIAL_CASH ? s.green : s.red}>{signed(total - INITIAL_CASH)} SOL TOTAL P&amp;L</span></div></div>
      <div className={s.toolbar}><span className={running ? s.green : s.muted}>● {finished ? 'SESSION CLOSED' : running ? 'MARKET RUNNING' : frame ? 'MARKET PAUSED' : 'READY WHEN YOU ARE'}</span><span>{clock(DURATION - game.tick)} LEFT</span><span>5 LAUNCHES · ALL TRADERS SIMULATED</span>{frame && !finished && <button onClick={() => setPaused(p => !p)}>{paused ? '▶ RESUME' : 'Ⅱ PAUSE'}</button>}</div>
      {!frame && <section className={s.startBanner}><div><b>10 fake SOL. Three minutes in the trenches.</b><p>Buy tokens, ride the candles, and sell before the dev does. A full curve means graduation. Your profit comes from your trades.</p></div><button className={s.primary} disabled={!ready} onClick={start}>{ready ? 'START TRADING →' : 'LOADING…'}</button></section>}
      {storageWarning && <p className={s.warning}>Storage unavailable. Progress lasts for this visit only.</p>}
      <p className={s.notice} role="status">{notice || 'No wallet connection. No real tokens. Just you and your questionable timing.'}</p>
      {finished ? <section className={s.final}><small>THE SESSION IS OVER</small><h2 ref={summaryHeading} tabIndex={-1}>{game.cash > INITIAL_CASH ? 'YOU LEFT WITH A BAG.' : game.cash === INITIAL_CASH ? 'STILL IN ONE PIECE.' : 'THE TRENCHES GOT YOU.'}</h2><strong className={game.cash >= INITIAL_CASH ? s.green : s.red}>{signed(game.cash - INITIAL_CASH)} <span>SOL</span></strong><p>Final wallet: {sol(game.cash)} sim SOL. All positions have been sold, including fees and price impact.</p><Portfolio game={game} select={setSelected} finished /><button className={s.primary} onClick={start}>BACK TO THE TRENCHES →</button></section> : <>
      <div className={s.desk}>
        <aside className={s.launchpad} aria-label="Token launches"><div className={s.sectionTitle}><h2>THE LAUNCHPAD</h2><span>5 COINS</span></div>{game.markets.map((m, index) => {
          const open = game.tick >= m.launchAt;
          const delta = (marketCap(m) / m.openCap - 1) * 100;
          return <button key={m.id} className={s.coinCard} aria-pressed={index === selected} onClick={() => { setSelected(index); setSide('buy'); }} aria-label={`View ${m.name}`}><div className={s.coinTop}><span className={s.tokenIcon} style={{ '--coin': m.color }} aria-hidden="true">{m.icon}</span><div><b>{m.ticker}</b><small>{m.name}</small></div></div><div className={s.coinNumbers}><span>{open ? `${short(marketCap(m))} SOL cap` : `OPENS IN ${m.launchAt - game.tick}s`}</span><b className={delta >= 0 ? s.green : s.red}>{open ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%` : 'SOON'}</b></div><div className={s.meter}><i style={{ width: `${open ? progress(m) * 100 : 0}%` }} /></div><div className={s.coinStatus}><span>{!open ? 'WAITING TO LAUNCH' : m.dumped ? '⚠ DEV SOLD' : m.graduated ? '✦ GRADUATED' : 'BONDING CURVE'}</span><span>{open ? `${(progress(m) * 100).toFixed(0)}%` : '—'}</span></div></button>;
        })}<p className={s.padHint}>Every open coin keeps moving, even when you’re watching another chart.</p></aside>
        <section className={s.market} aria-label="Selected token">
          <div className={s.tokenHeading}><span className={s.tokenIcon} style={{ '--coin': market.color }} aria-hidden="true">{market.icon}</span><div><h2>{market.name} <small>${market.ticker}</small></h2><p>{market.pitch}</p></div></div>
          <div className={s.marketStats}><div><small>MARKET CAP</small><b>{marketCap(market).toFixed(2)} <span>SOL</span></b></div><div><small>SINCE OPEN</small><b className={change >= 0 ? s.green : s.red}>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</b></div><div><small>DEV HOLDING</small><b>{(market.bots[0] / SUPPLY * 100).toFixed(1)}<span>%</span></b></div></div>
          <Chart market={market} />
          <div className={s.bonding}><div><b>{market.graduated ? '✦ GRADUATED' : 'BONDING CURVE PROGRESS'}</b><strong>{(progress(market) * 100).toFixed(1)}%</strong></div><div className={s.meter}><i style={{ width: `${progress(market) * 100}%` }} /></div><p>{market.graduated ? 'Bonded tokens keep trading. Price can still go down.' : 'Buys fill the curve. Sells move it back. Fill it to graduate.'}</p></div>
          <div className={`${s.news} ${market.dumped ? s.newsDanger : ''}`}><span>{!launched ? 'COMING SOON' : 'WALLET WATCH'}</span><p>{!launched ? `Trading opens in ${market.launchAt - game.tick} seconds.` : market.news}</p></div>
          <div className={s.sectionTitle}><h2>RECENT TRADES</h2><span>SIMULATED ACTIVITY</span></div><div className={s.tape}><table><thead><tr><th>TRADER</th><th>SIDE</th><th>SOL</th><th>AGE</th></tr></thead><tbody>{launched && market.tape.slice(0, 7).map(t => <tr key={t.id}><td className={t.who === 'YOU' ? s.you : ''}>{t.who}</td><td className={t.side === 'buy' ? s.green : s.red}>{t.side.toUpperCase()}</td><td>{sol(t.amount)}</td><td>{game.tick - t.tick}s</td></tr>)}</tbody></table></div>
        </section>
        <aside className={s.ticket} aria-label="Trade token"><div className={s.sectionTitle}><h2>TRADE ${market.ticker}</h2><span>SIM SOL</span></div><div className={s.ticketBody}>
          <div className={s.tabs}><button aria-pressed={side === 'buy'} onClick={() => setSide('buy')}>BUY</button><button aria-pressed={side === 'sell'} onClick={() => setSide('sell')}>SELL</button></div>
          <div className={s.balance}>Available <b>{side === 'buy' ? `${sol(game.cash)} SOL` : `${short(market.held)} ${market.ticker}`}</b></div>
          {side === 'buy' ? <><label htmlFor="sol-amount">AMOUNT IN SIM SOL</label><div className={s.amount}><input id="sol-amount" inputMode="decimal" type="number" min="0.0001" max="100" step="0.1" value={amount} onChange={e => setAmount(e.target.value)} /><span>SOL</span></div><div className={s.presets}>{['0.1', '0.5', '1', '2'].map(n => <button key={n} aria-pressed={amount === n} onClick={() => setAmount(n)}>{n}</button>)}</div></> : <><span className={s.fieldLabel}>SELL PART OF YOUR POSITION</span><div className={s.presets}>{[25, 50, 100].map(n => <button key={n} aria-pressed={fraction === n} onClick={() => setFraction(n)}>{n}%</button>)}</div><p className={s.sellAmount}>{short(Math.floor(market.held * fraction / 100))} <span>${market.ticker}</span></p></>}
          <div className={s.quote}><span>You receive<b>{quote ? side === 'buy' ? `${short(quote.tokens)} ${market.ticker}` : `${sol(quote.amount)} SOL` : '—'}</b></span><span>Trading fee (1%)<b>{quote ? `${sol(quote.fee)} SOL` : '—'}</b></span><small>Quote includes fees and your order’s price impact. Updates with the market.</small></div>
          <button className={side === 'buy' ? s.buyButton : s.sellButton} disabled={disabled} onClick={() => dispatch(side === 'buy' ? { type: 'buy', market: market.id, amount: units } : { type: 'sell', market: market.id, percent: fraction })}>{side === 'buy' ? `BUY $${market.ticker}` : `SELL ${fraction}% $${market.ticker}`}</button>
          <p className={s.orderHint}>{!frame ? 'Start the session to trade.' : paused ? 'Resume the market to place orders.' : !launched ? 'This token has not launched yet.' : game.trades >= 500 ? 'Trade limit reached. You can still cash out the session.' : side === 'buy' && units > game.cash ? 'Not enough SOL in your simulated wallet.' : side === 'sell' && !market.held ? 'Buy some tokens before selling.' : !quote ? 'Enter a valid amount to get a quote.' : 'Orders execute immediately at the current simulated pool price.'}</p>
          <div className={s.position}><span>YOUR POSITION</span><strong>{short(market.held)} <small>${market.ticker}</small></strong><dl><div><dt>Invested in open bag</dt><dd>{sol(market.basis)} SOL</dd></div><div><dt>Sell-all value</dt><dd>{sol(exitValue(market))} SOL</dd></div><div><dt>Unrealized P&amp;L</dt><dd className={pnl >= 0 ? s.green : s.red}>{signed(pnl)} SOL</dd></div><div><dt>Realized P&amp;L</dt><dd className={market.realized >= 0 ? s.green : s.red}>{signed(market.realized)} SOL</dd></div></dl></div>
          {frame && <button className={s.exitButton} onClick={() => { setPaused(true); finishDialog.current.showModal(); }}>CASH OUT & END SESSION ↗</button>}
        </div></aside>
      </div>
      <Portfolio game={game} select={setSelected} />
      </>}
      <details className={s.rules}><summary>HOW THIS SIM WORKS</summary><p>Start with 10 fake SOL. Five coins launch during a three-minute session. Pick a coin and buy its tokens. Simulated buyers push up the price; sellers push it down. Sell any part of your bag to realize profit or loss.</p><p>The bonding curve fills as SOL enters the pool. At 100%, the coin graduates and keeps trading. A dev dump means the creator sells tokens they actually hold; you can still sell at the remaining pool price. Watch the dev-wallet alert and trade tape.</p><p>Orders have a fictional 1% fee. Your sell-all value includes price impact and fees. At the end of three minutes, all positions are automatically sold. You can pause or cash out early. Switching tabs pauses the session; saved runs restore paused.</p><p>This is an original arcade simulation inspired by token launchpads. Curve settings, bot behavior, fees and graduation are simplified game rules. All coins, traders and SOL are fictional. No wallet, real trading, prizes, or connection to your OS credits.</p></details>
      <footer className={s.footer}><span>RUG OR BOND / TERMINL</span><span>ALL SOL, COINS & TRADERS ARE SIMULATED</span><span>KEEP YOUR SHIRT.</span></footer>
    </main>
    <dialog ref={finishDialog} className={s.dialog}><h2>Leave the trenches?</h2><p>Sell every open position at the current pool prices and finish this session. The market is paused.</p><button className={s.primary} onClick={() => { finishDialog.current.close(); dispatch({ type: 'finish' }); }}>SELL ALL & FINISH</button><button onClick={() => { finishDialog.current.close(); setPaused(false); }}>KEEP TRADING</button></dialog>
  </div>;
}

function Portfolio({ game, select, finished = false }) {
  const positions = game.markets.filter(m => m.spent > 0);
  return <section className={s.portfolio} aria-label="Your portfolio"><div className={s.sectionTitle}><h2>{finished ? 'YOUR SESSION RECEIPT' : 'YOUR BAGS'}</h2><span>{positions.length} TOKENS TRADED</span></div>{positions.length ? <div className={s.tableScroll}><table><thead><tr><th>TOKEN</th><th>BOUGHT</th><th>SOLD</th><th>{finished ? 'REMAINING' : 'SELL-ALL VALUE'}</th><th>TOTAL P&amp;L</th></tr></thead><tbody>{positions.map(m => { const net = m.realized + exitValue(m) - m.basis; return <tr key={m.id}><th>{finished ? `$${m.ticker}` : <button onClick={() => select(game.markets.indexOf(m))}>${m.ticker} ↗</button>}</th><td>{sol(m.spent)}</td><td>{sol(m.received)}</td><td>{sol(exitValue(m))}</td><td className={net >= 0 ? s.green : s.red}>{signed(net)} SOL</td></tr>; })}</tbody></table></div> : <p>Your bags are empty. Pick a token and take an entry—or wait for a better setup.</p>}</section>;
}
