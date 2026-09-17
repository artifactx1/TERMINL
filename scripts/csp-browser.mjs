import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.CSP_TEST_URL || 'http://localhost:4000';
const endpoint = `${base}/api/csp-report`;
const browser = await chromium.launch({ headless: true, args: ['--short-reporting-delay'] });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const legacy = { 'csp-report': { 'document-uri': `${base}/?token=must-not-log`,
  'effective-directive': 'connect-src', 'blocked-uri': 'https://csp-probe.invalid/private-key?token=must-not-log',
  disposition: 'report' } };

async function probe(target) {
  await target.route('https://csp-probe.invalid/probe.js', route => route.fulfill({
    contentType: 'application/javascript', body: 'window.cspProbeExecuted = true;',
  }));
  await target.evaluate(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', e => window.cspViolations.push({
      disposition: e.disposition, blockedURI: e.blockedURI, directive: e.effectiveDirective,
    }));
    const script = document.createElement('script');
    script.src = 'https://csp-probe.invalid/probe.js';
    document.head.append(script);
  });
  await target.waitForFunction(() => window.cspProbeExecuted && window.cspViolations.some(v =>
    v.disposition === 'report' && v.blockedURI.startsWith('https://csp-probe.invalid')));
}

try {
  const response = await page.goto(base, { waitUntil: 'domcontentloaded' });
  const headers = response.headers();
  assert.equal(headers['content-security-policy'], undefined);
  assert.match(headers['content-security-policy-report-only'], /report-uri \/api\/csp-report/);
  assert.match(headers['content-security-policy-report-only'], /report-to csp/);
  assert.equal(headers['reporting-endpoints'], 'csp="/api/csp-report"');
  assert.equal(headers['x-content-type-options'], 'nosniff');
  await probe(page);
  console.log('PASS report-only headers: a violating external script still executes');

  for (const [type, payload] of [
    ['application/csp-report', legacy],
    ['application/reports+json', [{ type: 'csp-violation', body: {
      documentURL: `${base}/os/rumble#token=must-not-log`, effectiveDirective: 'connect-src',
      blockedURL: 'wss://csp-probe.invalid/private-key', disposition: 'report',
    } }]],
  ]) {
    const result = await context.request.post(endpoint, { headers: { 'Content-Type': type }, data: JSON.stringify(payload) });
    assert.equal(result.status(), 204);
    assert.equal(result.headers()['cache-control'], 'no-store');
  }
  assert.equal((await context.request.get(endpoint)).status(), 405);
  assert.equal((await context.request.post(endpoint, { headers: { 'Content-Type': 'application/csp-report' }, data: '{' })).status(), 400);
  assert.equal((await context.request.post(endpoint, { headers: { 'Content-Type': 'text/plain' }, data: '{}' })).status(), 415);
  assert.equal((await context.request.post(endpoint, { headers: { 'Content-Type': 'application/csp-report' }, data: 'x'.repeat(32769) })).status(), 413);
  console.log('PASS live collector: both report formats, invalid requests and body size limit');

  // Force only the legacy transport for a deterministic immediate delivery test.
  // Modern Reporting API delivery is browser-scheduled and may be delayed/dropped.
  const fallback = await context.newPage();
  await fallback.route(`${base}/os/rumble`, async route => {
    const upstream = await route.fetch();
    const h = upstream.headers();
    h['content-security-policy-report-only'] = h['content-security-policy-report-only'].replace(/; report-to csp/, '');
    delete h['reporting-endpoints'];
    await route.fulfill({ response: upstream, headers: h });
  });
  await fallback.goto(`${base}/os/rumble`, { waitUntil: 'domcontentloaded' });
  const delivered = fallback.waitForResponse(r => r.url() === endpoint && r.request().method() === 'POST', { timeout: 15_000 });
  await probe(fallback);
  assert.equal((await delivered).status(), 204);
  await fallback.getByRole('button', { name: 'SETTINGS', exact: true }).waitFor();
  console.log('PASS browser-generated report reaches collector; Rumble renders with CSP enabled');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
