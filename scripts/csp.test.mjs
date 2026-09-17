import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createCspReportHandler } from '../lib/security/csp-report.mjs';
const { cspHeaders } = createRequire(import.meta.url)('../lib/security/csp.cjs');

const legacy = { 'csp-report': {
  'document-uri': 'https://terminl.net/os/rumble?wallet=secret#token=secret',
  'effective-directive': 'connect-src', 'blocked-uri': 'https://rpc.example/v2/private-key?token=secret',
  'source-file': 'https://terminl.net/_next/static/chunk.js?secret', disposition: 'report',
  'script-sample': 'private data', referrer: 'https://example.com/secret', 'original-policy': 'private policy',
} };
function request(handler, body = legacy, headers = {}, method = 'POST') {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, end() { return this; } };
  handler({ method, headers: { 'content-type': 'application/csp-report', ...headers }, body }, res);
  return res;
}

test('policy is report-only, uses same-origin reporting, and retains the existing headers', async () => {
  const headers = cspHeaders({ NODE_ENV: 'production' });
  assert.equal(headers.some(h => h.key === 'Content-Security-Policy'), false);
  const policy = headers.find(h => h.key === 'Content-Security-Policy-Report-Only').value;
  assert.match(policy, /report-uri \/api\/csp-report/);
  assert.match(policy, /report-to csp/);
  assert.equal(headers.find(h => h.key === 'Reporting-Endpoints').value, 'csp="/api/csp-report"');
  assert.ok(!policy.includes('unsafe-eval'));
  assert.ok(!policy.includes('localhost'));
  const config = createRequire(import.meta.url)('../next.config.js');
  const actual = (await config.headers())[0].headers;
  assert.equal(actual.find(h => h.key === 'X-Frame-Options').value, 'DENY');
  assert.equal(actual.find(h => h.key === 'X-Content-Type-Options').value, 'nosniff');
  assert.ok(actual.some(h => h.key === 'Content-Security-Policy-Report-Only'));
});

test('configured RPC and arcade origins are included without leaking URL credentials or paths', () => {
  const value = cspHeaders({ NODE_ENV: 'production', NEXT_PUBLIC_RPC_URL: 'https://user:pass@rpc.example/v2/secret?key=hidden',
    NEXT_PUBLIC_ARCADE_WS_URL: 'wss://arcade.example/socket?token=hidden' })[0].value;
  assert.ok(value.includes('https://rpc.example'));
  assert.ok(value.includes('wss://arcade.example'));
  assert.ok(value.includes('https://arcade.example'));
  for (const secret of ['user:', 'pass', '/v2/', 'hidden', '/socket']) assert.ok(!value.includes(secret));
  assert.ok(cspHeaders({ NODE_ENV: 'development' })[0].value.includes('ws://localhost:*'));
  assert.ok(!cspHeaders({ NEXT_PUBLIC_RPC_URL: 'javascript:alert(1)' })[0].value.includes('javascript:'));
});

test('legacy report string is accepted and only sanitized fields reach the logger', () => {
  const logs = [], handler = createCspReportHandler({ log: r => logs.push(r) });
  const res = request(handler, JSON.stringify(legacy));
  assert.equal(res.code, 204);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.deepEqual(logs, [{ event: 'csp_violation', disposition: 'report', directive: 'connect-src',
    document: 'https://terminl.net/os/rumble', blocked: 'https://rpc.example', source: 'https://terminl.net' }]);
});

test('Reporting API batches accept CSP reports and ignore other report types', () => {
  const logs = [], handler = createCspReportHandler({ log: r => logs.push(r) });
  const payload = [{ type: 'deprecation', body: {} }, { type: 'csp-violation', body: {
    documentURL: 'https://preview.example/os/moon?secret', effectiveDirective: 'script-src-elem',
    blockedURL: 'inline', sourceFile: 'blob:https://preview.example/private', disposition: 'report',
  } }];
  assert.equal(request(handler, JSON.stringify(payload), { 'content-type': 'application/reports+json; charset=utf-8' }).code, 204);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].blocked, 'inline');
  assert.equal(logs[0].source, 'blob:');
  assert.equal(logs[0].document, 'https://preview.example/os/moon');
});

test('sensitive document paths and non-HTTP resource contents are redacted', () => {
  const logs = [], handler = createCspReportHandler({ log: r => logs.push(r) });
  request(handler, { 'csp-report': { ...legacy['csp-report'],
    'document-uri': 'https://user:secret@terminl.net/api/allowlist/0x123?token=private',
    'blocked-uri': 'data:text/javascript,private', 'source-file': 'javascript:private' } });
  assert.equal(logs[0].document, 'https://terminl.net/[redacted]');
  assert.equal(logs[0].blocked, 'data:');
  assert.equal(logs[0].source, null);
  assert.ok(!JSON.stringify(logs).includes('private'));
});

test('malformed reports, unsupported media types and non-POST requests do not log', () => {
  const logs = [], handler = createCspReportHandler({ log: r => logs.push(r) });
  for (const payload of ['{', null, {}, 'null', { 'csp-report': { 'effective-directive': 'forged log text' } }]) {
    assert.equal(request(handler, payload).code, 400);
  }
  assert.equal(request(handler, legacy, { 'content-type': 'text/plain' }).code, 415);
  const res = request(handler, null, {}, 'GET');
  assert.equal(res.code, 405);
  assert.equal(res.headers.Allow, 'POST');
  assert.deepEqual(logs, []);
});

test('oversized strings and report batches are rejected', () => {
  const handler = createCspReportHandler({ log: () => assert.fail('must not log') });
  assert.equal(request(handler, 'x'.repeat(32769)).code, 413);
  assert.equal(request(handler, Array.from({ length: 21 }, () => ({ type: 'csp-violation' }))).code, 413);
});

test('logging has a fixed per-instance budget and resumes next minute', () => {
  let time = 100_000;
  const logs = [], handler = createCspReportHandler({ log: r => logs.push(r), now: () => time });
  for (let i = 0; i < 120; i++) assert.equal(request(handler).code, 204);
  const limited = request(handler);
  assert.equal(limited.code, 429);
  assert.equal(limited.headers['Retry-After'], '60');
  assert.equal(logs.length, 120);
  time += 60_000;
  assert.equal(request(handler).code, 204);
  assert.equal(logs.length, 121);
});
