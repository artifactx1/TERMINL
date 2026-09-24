import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMintRpc } from '../lib/mint-rpc-policy.mjs';

process.env.NEXT_PUBLIC_TERMINL_CONTRACT = '0xc9A4088fD8D2A3327BE33b28646d789549f0188A';
process.env.NEXT_PUBLIC_CHAIN_ID = '4663';
process.env.NEXT_PUBLIC_RPC_URL = 'https://public.invalid';
process.env.RPC_URL = 'https://primary.invalid/private-key';
const mint = await import('../lib/mint.js');
const contract = mint.CONTRACT;
const wallet = '0x1111111111111111111111111111111111111111';
const native = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const word = n => BigInt(n).toString(16).padStart(64, '0');
const body = (method, params) => ({ jsonrpc: '2.0', id: 1, method, params });
const read = body('eth_call', [{ to: contract, data: '0x35b65e1f' + word(BigInt(wallet)) }, 'latest']);
const reply = (result, id = 1) => Response.json({ jsonrpc: '2.0', id, result });

test('RPC policy accepts real public/stage calldata and rejects unrelated or expensive methods', () => {
  assert.ok(validateMintRpc(read, contract));
  const publicTx = mint.buildClaimTx({ account: wallet, quantity: 2, drop: { native: true, price: 1n, currency: native } });
  assert.ok(validateMintRpc(body('eth_call', [publicTx, 'latest']), contract));
  const stageTx = mint.buildAllowlistClaimTx({ account: wallet, quantity: 2, stage: {
    params: { pricePerToken: '0', currency: native, maxMintableByWallet: '10', maxSupplyForStage: '2048', startTime: '1', endTime: '0', stageIndex: 1 },
    proof: Array.from({ length: 12 }, () => '0x' + 'ab'.repeat(32)),
  } });
  assert.ok(validateMintRpc(body('eth_call', [stageTx, 'latest']), contract));
  for (const request of [
    [read], body('eth_sendRawTransaction', ['0x1234']), body('eth_getLogs', [{}]),
    body('eth_call', [{ ...publicTx, to: wallet }, 'latest']),
    body('eth_call', [{ ...publicTx, from: contract }, 'latest']),
    body('eth_call', [{ ...publicTx, gas: '0xffffffff' }, 'latest']),
    body('eth_call', [publicTx, 'latest', {}]),
    body('eth_call', [{ ...publicTx, data: '0x' }, 'latest']),
    body('eth_call', [mint.buildClaimTx({ account: wallet, quantity: 2049, drop: { native: true, price: 0n, currency: native } }), 'latest']),
  ]) assert.equal(validateMintRpc(request, contract), null);
});

test('HTTP throttling, JSON-RPC throttling, malformed JSON and network failures fail over; reverts do not', async t => {
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  let version = 0;
  for (const failure of [
    () => new Response('', { status: 429 }),
    () => Response.json({ error: { code: -32005, message: 'rate limit exceeded' } }),
    () => new Response('not JSON'),
    () => { throw Error('private-key must not escape'); },
  ]) {
    const isolated = await import(`../lib/mint.js?case=${++version}`);
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push(url);
      assert.ok(options.signal);
      return url.includes('primary') ? failure() : reply('0x' + word(2));
    };
    assert.equal(await isolated.readClaimedBy(wallet), 2n);
    assert.equal(await isolated.readClaimedBy(wallet), 2n);
    assert.equal(calls.filter(x => x.includes('primary')).length, 1, 'circuit breaker prevents a provider failure stampede');
    assert.equal(calls.filter(x => x.includes('public')).length, 2);
  }
  const isolated = await import('../lib/mint.js?case=revert');
  let calls = 0;
  global.fetch = async () => { calls++; return Response.json({ error: { code: 3, message: 'execution reverted', data: '0x12345678' } }); };
  await assert.rejects(isolated.readClaimedBy(wallet), { code: 3, data: '0x12345678' });
  assert.equal(calls, 1);
});

test('1,000 concurrent cold drop requests share six RPC methods in two upstream requests', async t => {
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  let requests = 0, methods = 0;
  global.fetch = async (_url, options) => {
    requests++;
    await new Promise(resolve => setTimeout(resolve, 10));
    const input = JSON.parse(options.body);
    const answer = call => {
      methods++;
      let result = '0x' + word(0);
      if (call.method === 'eth_getBlockByNumber') result = { timestamp: '0x64' };
      if (call.params?.[0]?.data === '0xd637ed59') result = '0x' + [1, 2048, 0, 10, 0, 0, BigInt(native), 256, 0].map(word).join('');
      if (call.params?.[0]?.data === '0x63b45e2d') result = '0x' + word(1);
      if (call.params?.[0]?.data?.startsWith('0x2419f51b')) result = '0x' + word(2048);
      return { jsonrpc: '2.0', id: call.id, result };
    };
    return Response.json(Array.isArray(input) ? input.map(answer) : answer(input));
  };
  const { default: handler } = await import('../pages/api/drop.js');
  const results = await Promise.all(Array.from({ length: 1000 }, () => invoke(handler, { method: 'GET' })));
  assert.ok(results.every(r => r.status === 200 && r.body.lazySupply === '2048'));
  assert.equal(requests, 2);
  assert.equal(methods, 6);
  assert.ok(results.every(r => r.headers['Cache-Control'].includes('s-maxage=5')));
});

test('a stalled provider is aborted and browser fallback never exposes the server key', async t => {
  const original = global.fetch;
  t.after(() => { global.fetch = original; delete global.window; });
  const isolated = await import('../lib/mint.js?case=timeout');
  const keepAlive = setTimeout(() => {}, 8_000);
  global.fetch = async (url, options) => {
    if (url.includes('public')) return reply('0x' + word(4));
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(Error('aborted')), { once: true }));
  };
  const start = Date.now();
  try { assert.equal(await isolated.readClaimedBy(wallet), 4n); } finally { clearTimeout(keepAlive); }
  assert.ok(Date.now() - start < 7_500, 'Stalled primary must not hang the mint');
  global.window = {};
  const urls = [];
  global.fetch = async url => { urls.push(url); return url.startsWith('/') ? new Response('', { status: 503 }) : reply('0x' + word(5)); };
  assert.equal(await isolated.readClaimedBy(wallet), 5n);
  assert.deepEqual(urls, ['/api/mint-rpc', 'https://public.invalid']);
});

test('mint route deduplicates reads, retains revert data, rejects cross-origin traffic and rate limits', async t => {
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  let requests = 0;
  global.fetch = async () => { requests++; await new Promise(r => setTimeout(r, 10)); return reply('0x' + word(3)); };
  const { default: handler } = await import('../pages/api/mint-rpc.js');
  const results = await Promise.all(Array.from({ length: 1000 }, (_, i) => invoke(handler, {
    method: 'POST', body: read, headers: { host: 'terminl.net', origin: 'https://terminl.net', 'x-forwarded-for': `client-${i}` },
  })));
  assert.ok(results.every(r => r.status === 200 && r.body.result === '0x' + word(3)));
  assert.equal(requests, 1);
  global.fetch = async () => { requests++; return reply('0x' + word(4)); };
  const afterMint = await invoke(handler, { method: 'POST', body: read, headers: { 'x-forwarded-for': 'after-mint' } });
  assert.equal(afterMint.body.result, '0x' + word(4), 'Post-mint wallet count must not reuse a completed pre-mint read');
  assert.equal((await invoke(handler, { method: 'POST', body: read, headers: { host: 'terminl.net', origin: 'https://elsewhere.example' } })).status, 403);
  assert.equal((await invoke(handler, { method: 'POST', body: body('eth_sendTransaction', [{}]) })).status, 400);
  assert.equal((await invoke(handler, { method: 'GET' })).status, 405);
  let limited;
  for (let i = 0; i < 121; i++) limited = await invoke(handler, { method: 'POST', body: read, headers: { 'x-forwarded-for': 'abusive-client' } });
  assert.equal(limited.status, 429);
  global.fetch = async () => Response.json({ error: { code: 3, message: 'execution reverted', data: '0x12345678' } });
  const tx = mint.buildClaimTx({ account: wallet, quantity: 1, drop: { native: true, price: 0n, currency: native } });
  const reverted = await invoke(handler, { method: 'POST', body: body('eth_call', [tx, 'latest']) });
  assert.equal(reverted.body.error.data, '0x12345678');
});

function invoke(handler, input) {
  const result = { status: 200, headers: {} };
  const res = {
    setHeader(k, v) { result.headers[k] = v; },
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
    end() { return this; },
  };
  return handler({ headers: {}, ...input }, res).then(() => result);
}
