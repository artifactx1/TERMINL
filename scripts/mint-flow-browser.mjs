// Exercises real UI/wagmi logic with an injected fixture wallet. No signatures
// or real transactions are produced; RPC and mint API responses are fixtures.
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd(), false);
const contract = process.env.NEXT_PUBLIC_TERMINL_CONTRACT;
assert.match(contract || '', /^0x[0-9a-f]{40}$/i);
const base = process.env.MINT_TEST_URL || 'http://127.0.0.1:4007';
const wallet = '0x1111111111111111111111111111111111111111';
const hash = '0x' + 'ab'.repeat(32);
const currency = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const word = n => '0x' + BigInt(n).toString(16).padStart(64, '0');
const engine = process.env.MINT_TEST_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true });
const scenarios = ['public success', 'last token', 'allowlist success', 'wallet rejection', 'simulation revert', 'failed receipt', 'late configuration', 'allowlist recovery', 'wrong chain', 'slow receipt', 'reload pending'];
try {
  for (const name of scenarios) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await context.addInitScript(({ wallet, hash, name }) => {
      const listeners = new Map();
      let chain = name === 'wrong chain' ? '0x1' : '0x1237';
      let authorized = sessionStorage.getItem('test-wallet-authorized') === 'true';
      window.mintSends = [];
      const provider = {
        on: (event, fn) => listeners.set(event, [...(listeners.get(event) || []), fn]),
        removeListener: (event, fn) => listeners.set(event, (listeners.get(event) || []).filter(f => f !== fn)),
        request: async ({ method, params }) => {
          if (method === 'eth_accounts') return authorized ? [wallet] : [];
          if (method === 'eth_requestAccounts') {
            authorized = true; sessionStorage.setItem('test-wallet-authorized', 'true'); return [wallet];
          }
          if (method === 'eth_chainId') return chain;
          if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') {
            chain = '0x1237';
            for (const fn of listeners.get('chainChanged') || []) fn(chain);
            return null;
          }
          if (method === 'wallet_getCapabilities') return {};
          if (method === 'eth_sendTransaction') {
            window.mintSends.push(params[0]);
            if (name === 'wallet rejection') throw Object.assign(Error('User rejected the request.'), { code: 4001 });
            return hash;
          }
          throw Error('Unexpected wallet method: ' + method);
        },
      };
      window.ethereum = provider;
      const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: {
        provider, info: { uuid: '12345678-1234-4234-8234-123456789abc', name: 'TERMINL Test Wallet', rdns: 'net.terminl.test', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>' },
      } }));
      window.addEventListener('eip6963:requestProvider', announce); announce();
    }, { wallet, hash, name });
    const now = Math.floor(Date.now() / 1000);
    let configured = name !== 'late configuration';
    let allowFailed = name === 'allowlist recovery';
    let confirmed = false;
    let receiptReady = !['slow receipt', 'reload pending'].includes(name);
    let simulations = 0;
    const stageMode = name.startsWith('allowlist');
    const params = { pricePerToken: '0', currency, maxMintableByWallet: '10', maxSupplyForStage: '2048', startTime: String(now - 10), endTime: String(now + 3600), stageIndex: 1 };
    const stage = { stageIndex: 1, name: 'GTD', kind: 'gtd', params, proof: [] };
    await page.route('**/api/drop', route => route.fulfill({ json: {
      condition: { startsAt: String(stageMode ? now + 7200 : now - 10), maxClaimable: configured ? '2048' : '0', claimed: confirmed ? '1' : '0', perWallet: '10', price: '0', currency },
      endsAt: '0', minted: name === 'last token' ? confirmed ? '2048' : '2047' : confirmed ? '1' : '0', lazySupply: '2048', chainNow: String(Math.floor(Date.now() / 1000)),
    } }));
    await page.route('**/api/phases', route => route.fulfill({ json: { published: stageMode, stages: stageMode ? [{ ...params, name: 'GTD' }] : [] } }));
    await page.route('**/api/allowlist/*', route => route.fulfill(allowFailed ? { status: 503, json: { error: 'Temporary failure' } } : { json: { eligible: stageMode, stages: stageMode ? [stage] : [], reason: stageMode ? null : 'no_allowlist' } }));
    await page.route(/\/api\/mint-rpc$|https:\/\/rpc\.(mainnet|testnet)\.chain\.robinhood\.com/, async route => {
      const answer = call => {
        let result = '0x';
        if (call.method === 'eth_chainId') result = '0x1237';
        if (call.method === 'eth_blockNumber') result = '0x100';
        if (call.method === 'eth_getBalance') result = '0x56bc75e2d63100000';
        if (call.method === 'eth_getTransactionReceipt') {
          result = receiptReady ? { transactionHash: hash, status: name === 'failed receipt' ? '0x0' : '0x1', blockNumber: '0x100' } : null;
          if (result?.status === '0x1') confirmed = true;
        }
        if (call.method === 'eth_call') {
          const data = call.params[0].data;
          if (/^0x(dc7af7a8|35b65e1f)/.test(data)) result = word(confirmed ? 1 : 0);
          if (/^0x(1ba84308|84bb1e42)/.test(data)) {
            simulations++;
            if (name === 'simulation revert' || (name === 'failed receipt' && call.params[1] !== 'latest')) return { jsonrpc: '2.0', id: call.id, error: { code: 3, message: 'execution reverted', data: '0x12345678' } };
          }
        }
        return { jsonrpc: '2.0', id: call.id, result };
      };
      const call = route.request().postDataJSON();
      return route.fulfill({ json: Array.isArray(call) ? call.map(answer) : answer(call) });
    });
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      if (name === 'late configuration') {
        await page.getByText('MINT NOT OPEN YET', { exact: true }).waitFor();
        await page.clock.install(); configured = true;
        await page.clock.fastForward(21_000);
        await page.clock.resume();
        await page.getByRole('button', { name: 'CONNECT WALLET', exact: true }).first()
          .or(page.getByRole('button', { name: 'MINT 1 — FREE', exact: true }).first()).first().waitFor();
      }
      const connect = page.getByRole('button', { name: 'CONNECT WALLET', exact: true }).first();
      const connected = page.getByRole('button', { name: /0x1111/ }).first();
      await connect.or(connected).first().waitFor();
      if (await connect.isVisible()) {
        await connect.click();
        const chooser = page.getByText('TERMINL Test Wallet', { exact: true }).last();
        await chooser.or(connected).first().waitFor();
        if (await chooser.isVisible()) await chooser.click();
      }
      if (name === 'allowlist recovery') {
        await page.getByText('COULD NOT CHECK THE ALLOWLIST', { exact: true }).waitFor();
        allowFailed = false;
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
      }
      if (name === 'wrong chain') {
        const switchButton = page.getByRole('button', { name: 'SWITCH TO ROBINHOOD', exact: true }).first();
        // Some connectors switch during connection; both paths must work.
        if (await switchButton.isVisible()) await switchButton.click();
      }
      const mint = page.getByRole('button', { name: 'MINT 1 — FREE', exact: true }).first();
      await mint.waitFor();
      for (let i = 0; i < 50 && simulations === 0; i++) await page.waitForTimeout(100);
      assert.ok(simulations > 0, 'Preflight ran');
      if (name === 'slow receipt') await page.clock.install();
      // Deliberately trigger two clicks in one JS turn, before React can render.
      await mint.evaluate(button => { button.click(); button.click(); });
      if (name === 'wallet rejection') {
        await page.getByText(/rejected|declined|cancelled/i).first().waitFor();
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await page.waitForTimeout(300);
        assert.ok(await page.getByText(/rejected|declined|cancelled/i).first().isVisible(), 'Background refresh must preserve the rejection');
      } else if (name === 'simulation revert') {
        await page.getByText(/contract rejected/i).first().waitFor();
        assert.equal(await page.evaluate(() => window.mintSends.length), 0);
      } else if (name === 'failed receipt') {
        await page.getByRole('link', { name: 'TRANSACTION FAILED ↗', exact: true }).waitFor();
        assert.equal(await page.getByText(/MINTED ✓/).count(), 0);
      } else {
        if (name === 'reload pending') {
          await page.getByRole('link', { name: 'WAITING FOR CONFIRMATION ↗', exact: true }).waitFor();
          assert.equal(await page.evaluate(() => window.mintSends.length), 1);
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.getByRole('link', { name: 'WAITING FOR CONFIRMATION ↗', exact: true }).waitFor();
          receiptReady = true;
        }
        if (name === 'slow receipt') {
          await page.getByRole('link', { name: 'WAITING FOR CONFIRMATION ↗', exact: true }).waitFor();
          await page.clock.fastForward(181_000);
          await page.clock.resume();
          await page.getByRole('link', { name: 'STILL PENDING — FOLLOW IT ON THE EXPLORER ↗', exact: true }).waitFor();
          assert.ok(await page.getByRole('button', { name: 'MINT 1 — FREE', exact: true }).first().isDisabled());
          receiptReady = true;
          await page.getByRole('button', { name: 'CHECK CONFIRMATION', exact: true }).click();
        }
        await page.getByRole('link', { name: 'MINTED ✓ VIEW TRANSACTION ↗', exact: true }).waitFor();
        if (name === 'last token') await page.getByText('SOLD OUT', { exact: true }).waitFor();
      }
      const sends = await page.evaluate(() => window.mintSends);
      assert.equal(sends.length, ['simulation revert', 'reload pending'].includes(name) ? 0 : 1, 'Only one transaction request, no resubmission after reload');
      if (sends.length) {
        assert.equal(sends[0].to.toLowerCase(), contract.toLowerCase());
        assert.equal(sends[0].data.slice(0, 10), stageMode ? '0x1ba84308' : '0x84bb1e42');
      }
      assert.deepEqual(errors, []);
      console.log('PASS ' + name);
    } catch (error) {
      console.error(name, (await page.locator('body').innerText()).slice(0, 5000));
      throw error;
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
