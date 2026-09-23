import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Fixture-only wallet and RPC: this check never signs or broadcasts a transaction.
const base = process.env.MINT_TEST_URL || 'http://localhost:4001';
const wallet = '0x1111111111111111111111111111111111111111';
const currency = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const word = n => `0x${BigInt(n).toString(16).padStart(64, '0')}`;
const browser = await chromium.launch({ headless: true });

try {
  for (const scenario of [
    { name: 'GTD', cap: 50, claimed: 0, expected: 50 },
    { name: 'GTD partly minted', cap: 50, claimed: 20, expected: 30 },
    { name: 'FCFS mobile', cap: 250, claimed: 0, expected: 250, mobile: true },
    { name: 'Public', cap: 250, claimed: 0, expected: 250, public: true },
  ]) {
    const context = await browser.newContext({ viewport: scenario.mobile
      ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    const simulated = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.addInitScript(({ wallet }) => {
      const listeners = new Map();
      const provider = {
        on: (name, fn) => { listeners.set(name, [...(listeners.get(name) || []), fn]); },
        removeListener: (name, fn) => listeners.set(name, (listeners.get(name) || []).filter(f => f !== fn)),
        request: async ({ method, params }) => {
          if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [wallet];
          if (method === 'eth_chainId') return '0x1237';
          if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
          if (method === 'wallet_getCapabilities') return {};
          throw new Error(`Unexpected wallet request: ${method}`);
        },
      };
      window.ethereum = provider;
      const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
        detail: { provider, info: { uuid: '12345678-1234-4234-8234-123456789abc',
          name: 'TERMINL Test Wallet', rdns: 'net.terminl.test',
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>' } },
      }));
      window.addEventListener('eip6963:requestProvider', announce);
      announce();
    }, { wallet });

    const now = Math.floor(Date.now() / 1000);
    const params = { pricePerToken: '0', currency,
      maxMintableByWallet: String(scenario.cap), maxSupplyForStage: '550',
      startTime: String(now - 60), endTime: String(now + 3600), stageIndex: 1 };
    const stage = { stageIndex: 1, name: scenario.name, kind: 'gtd', params, proof: [] };
    await page.route('**/api/drop', route => route.fulfill({ json: {
      condition: { startsAt: String(scenario.public ? now - 60 : now + 7200),
        maxClaimable: '10000', claimed: String(scenario.public ? scenario.claimed : 0),
        perWallet: String(scenario.cap), price: '0', currency },
      endsAt: '0', minted: String(scenario.claimed), lazySupply: '10000', chainNow: String(now),
    } }));
    await page.route('**/api/phases', route => route.fulfill({ json: {
      published: !scenario.public, stages: scenario.public ? [] : [{ ...params, name: scenario.name }],
    } }));
    await page.route('**/api/allowlist/*', route => route.fulfill({ json: {
      eligible: !scenario.public, stages: scenario.public ? [] : [stage],
    } }));
    await page.route(/https:\/\/rpc\.(mainnet|testnet)\.chain\.robinhood\.com/, route => {
      const answer = call => {
        let result = '0x';
        if (call.method === 'eth_chainId') result = '0x1237';
        if (call.method === 'eth_blockNumber') result = '0x1';
        if (call.method === 'eth_getBalance') result = '0x56bc75e2d63100000';
        if (call.method === 'eth_call') {
          const data = call.params[0].data;
          if (/^0x(dc7af7a8|35b65e1f)/.test(data)) result = word(scenario.claimed);
          if (/^0x(1ba84308|84bb1e42)/.test(data)) simulated.push(Number(BigInt(`0x${data.slice(74, 138)}`)));
        }
        return { jsonrpc: '2.0', id: call.id, result };
      };
      const calls = route.request().postDataJSON();
      return route.fulfill({ json: Array.isArray(calls) ? calls.map(answer) : answer(calls) });
    });

    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const max = page.getByRole('button', { name: `Mint the maximum, ${scenario.expected}`, exact: true }).first();
    const connect = page.getByRole('button', { name: 'CONNECT WALLET', exact: true }).first();
    await max.or(connect).first().waitFor({ state: 'visible' });
    if (!await max.isVisible()) await connect.click();
    // Reown presents the injected test wallet; the no-project-ID fallback connects directly.
    if (!await max.isVisible()) await page.getByText('TERMINL Test Wallet', { exact: true }).last().click();
    await max.waitFor({ state: 'visible' });
    await max.click();
    await page.getByRole('button', { name: `MINT ${scenario.expected} — FREE`, exact: true }).first().waitFor();
    for (let i = 0; i < 50 && !simulated.includes(scenario.expected); i++) await page.waitForTimeout(100);
    assert.ok(simulated.includes(scenario.expected), `Preflight must encode quantity ${scenario.expected}`);
    assert.deepEqual(errors, []);
    console.log(`PASS ${scenario.name}: MAX selects and simulates ${scenario.expected}`);
    await context.close();
  }
} finally {
  await browser.close();
}
