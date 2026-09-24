// Tests our built Next.js server with a local counting RPC. Never broadcasts,
// and never load-tests a third-party provider. --serve keeps it up for browsers.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const port = Number(process.env.MINT_LOAD_PORT || 4007);
const native = BigInt('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
const contract = '0xc9A4088fD8D2A3327BE33b28646d789549f0188A';
const word = n => BigInt(n).toString(16).padStart(64, '0');
let requests = 0, methods = 0;
const rpc = http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(req.url.includes('/claim/') ? { eligible: false, reason: 'no_allowlist', stages: [] } : { published: false, stages: [] }));
    return;
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  requests++;
  const answer = call => {
    methods++;
    let result = '0x' + word(0);
    if (call.method === 'eth_getTransactionReceipt') result = null;
    if (call.method === 'eth_getBlockByNumber') result = { timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16) };
    if (call.params?.[0]?.data === '0xd637ed59') result = '0x' + [1, 2048, 0, 10, 0, 0, native, 256, 0].map(word).join('');
    if (call.params?.[0]?.data === '0x63b45e2d') result = '0x' + word(1);
    if (call.params?.[0]?.data?.startsWith('0x2419f51b')) result = '0x' + word(2048);
    return { jsonrpc: '2.0', id: call.id, result };
  };
  const body = JSON.parse(raw);
  await sleep(15); // A real asynchronous boundary to exercise coalescing.
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(Array.isArray(body) ? body.map(answer) : answer(body)));
});
await new Promise(resolve => rpc.listen(0, '127.0.0.1', resolve));
const rpcUrl = `http://127.0.0.1:${rpc.address().port}`;
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
  env: { ...process.env, RPC_URL: rpcUrl, ALLOWLIST_API_URL: rpcUrl }, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
app.stdout.on('data', d => { output += d; });
app.stderr.on('data', d => { output += d; });
const base = `http://127.0.0.1:${port}`;
const close = () => { app.kill('SIGTERM'); rpc.closeAllConnections(); rpc.close(); };
process.on('SIGTERM', close);
process.on('SIGINT', close);
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (app.exitCode !== null) throw Error(output);
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await sleep(200);
  }
  assert.ok(ready, output);
  console.log(`Production test server ready: ${base}`);
  if (process.argv.includes('--serve')) {
    console.log('Counting RPC is local; all wallet transactions must remain fixtures.');
    await new Promise(resolve => app.on('exit', resolve));
  } else {
    const drop = await burst(1000, 100, () => fetch(base + '/api/drop'));
    assert.ok(drop.every(r => r.status === 200 && r.body.lazySupply === '2048'));
    assert.ok(requests <= 8, `Expected coalesced reads, got ${requests} upstream requests`);
    console.log(JSON.stringify({ scenario: '1000 drop HTTP requests, concurrency 100', upstreamRequests: requests, rpcMethods: methods, ...metrics(drop) }));
    const before = requests;
    const reads = await burst(1000, 40, i => fetch(base + '/api/mint-rpc', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.${Math.floor(i / 256)}.${i % 256}.1` },
      body: JSON.stringify({ jsonrpc: '2.0', id: i, method: 'eth_call', params: [{ to: contract, data: '0x35b65e1f' + word(i + 1) }, 'latest'] }),
    }));
    assert.ok(reads.every(r => r.status === 200 && r.body.result === '0x' + word(0)));
    console.log(JSON.stringify({ scenario: '1000 distinct wallet HTTP reads, concurrency 40', upstreamRequests: requests - before, ...metrics(reads) }));
  }
} finally { close(); }

async function burst(count, concurrency, send) {
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < count) {
      const i = next++, start = performance.now();
      const res = await send(i);
      results.push({ status: res.status, body: await res.json(), ms: performance.now() - start });
    }
  }));
  return results;
}
function metrics(results) {
  const sorted = results.map(r => r.ms).sort((a, b) => a - b);
  return { responses: results.length, errors: results.filter(r => r.status !== 200).length, p95ms: Math.round(sorted[Math.floor(sorted.length * .95)]), maxMs: Math.round(sorted.at(-1)) };
}
