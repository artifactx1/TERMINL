// Run only in a disposable Linux network namespace with loopback enabled.
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { rehearsalEnv } from './mint-rehearsal-safety.mjs';

assert.equal(process.platform, 'linux', 'Use the isolated GitHub Actions runner');
assert.deepEqual(readdirSync('/sys/class/net').sort(), ['lo'], 'Refusing to run with an external network interface');
assert.ok(Object.values(networkInterfaces()).flat().every(i => i.internal));
for (const file of ['.env', '.env.local', '.env.production.local', '.env.development.local', '.env.test.local']) assert.ok(!existsSync(file), `Remove private environment file before rehearsing: ${file}`);

const fixture = http.createServer(async (req, res) => {
  res.setHeader('content-type', 'application/json');
  if (req.method === 'GET') { res.statusCode = 503; res.end(JSON.stringify({ error: 'Optional service unavailable in rehearsal' })); return; }
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 8192) { res.writeHead(413).end(); return; } }
  try {
    const answer = call => ({ jsonrpc: '2.0', id: call.id, error: { code: -32601, message: 'Unmocked RPC: no transaction or upstream access permitted' } });
    const call = JSON.parse(raw);
    res.end(JSON.stringify(Array.isArray(call) ? call.map(answer) : answer(call)));
  } catch { res.writeHead(400).end('{}'); }
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:4007';
const env = rehearsalEnv(process.env, base, `http://127.0.0.1:${fixture.address().port}`);
let app;
const children = new Set();
function run(args, extra = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env: { ...env, ...extra }, stdio: 'inherit' });
    children.add(child);
    child.on('error', reject);
    child.on('exit', (code, signal) => { children.delete(child); code === 0 ? resolve() : reject(Error(`${args[0]} failed (${code ?? signal})`)); });
  });
}
const cleanup = () => { for (const child of children) child.kill('SIGTERM'); app?.kill('SIGTERM'); fixture.closeAllConnections(); fixture.close(); };
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
try {
  console.log('ISOLATED: only loopback exists; dummy contract; no keys, production services or broadcast access.');
  await run(['--test', 'scripts/mint-rehearsal-safety.test.mjs']);
  await run(['node_modules/next/dist/bin/next', 'build', '--webpack']);
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '4007'], { env, stdio: 'inherit' });
  let ready = false;
  for (let i = 0; i < 120; i++) {
    assert.equal(app.exitCode, null, 'Test server exited');
    try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await sleep(250);
  }
  assert.ok(ready, 'Test server did not start');
  for (const engine of ['chromium', 'webkit']) {
    console.log(`REHEARSAL: ${engine} / ${engine === 'chromium' ? 'desktop' : 'mobile viewport'}`);
    await run(['scripts/mint-flow-browser.mjs'], { MINT_TEST_BROWSER: engine, MINT_TEST_DESKTOP: engine === 'chromium' ? '1' : '0' });
  }
  console.log('PASS: both browser engines completed all mint scenarios');
} finally { cleanup(); }
