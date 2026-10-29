// Closed enrollment stays closed even when optional services return stale data.
// Run only against the isolated rehearsal app, with no real accounts or RPC.
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { localTestUrl } from './mint-rehearsal-safety.mjs';

const base = localTestUrl(process.env.MINT_TEST_URL || 'http://127.0.0.1:4007');
const wallet = '0x1111111111111111111111111111111111111111';
const stale = { active: true, gtdSlots: 137, gtdEndsAt: Date.now() + 86400000,
  cupEnabled: true, rumbleEnabled: true, addressEndsAt: Date.now() - 10000 };
const pass = { display: 'FIXTURE PLAYER', provider: 'discord', status: 'active',
  points: 73, rank: 12, shareXp: 0, runs: [], spots: [], wallet: { address: wallet },
  fcfs: { status: 'qualified', route: 'cup', at: Date.now() },
  gtd: { held: true, slots: 137, rank: 12, submitOpen: false } };
const forbidden = /APPLY FOR WL|PLAY FOR WL|EARN WL|WL APPLY|PLAY OR APPLY|top\s+137|137\s+(?:GTD|spots)|up to \d+ minted/i;

for (const [name, engine, viewport] of [
  ['desktop Chromium', chromium, { width: 1440, height: 1000 }],
  ['mobile WebKit', webkit, { width: 390, height: 844 }],
]) {
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base
    ? route.continue() : route.abort('blockedbyclient'));
  let signedIn = true;
  const mutations = [];
  await context.route('**/api/campaign/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/campaign', '');
    if (request.method() !== 'GET') mutations.push(path);
    const json = path === '/config' ? { config: stale, providers: {}, serverTime: Date.now() }
      : path === '/session' ? { pass: signedIn ? pass : null }
      : path === '/leaderboard' ? { entries: [{ rank: 1, player: 'FIXTURE', points: 73 }], gtd: { slots: 137, open: true } }
      : { ok: true };
    return route.fulfill({ json });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    for (const path of ['/wl', '/beat-the-bots']) {
      await page.goto(base + path);
      await page.getByRole('heading', { name: 'The entry window has closed.' }).waitFor();
      assert.equal(await page.locator('form').count(), 0, 'Expired entry pages contain no application form');
      assert.ok(await page.locator('a[href="/#allowlist-checker"]').count());
      assert.ok(await page.locator('a[href="/os"]').count(), 'Free arcade remains reachable');
      assert.doesNotMatch(await page.locator('body').innerText(), forbidden);
    }
    await page.goto(base + '/leaderboard');
    await page.getByText('FIXTURE', { exact: true }).waitFor();
    assert.doesNotMatch(await page.locator('body').innerText(), forbidden);
    assert.ok((await page.locator('body').innerText()).includes('qualification has closed'));
    await page.goto(base + '/arcade-pass?run=obsolete-entry');
    await page.getByRole('heading', { name: 'FIXTURE PLAYER' }).waitFor();
    assert.doesNotMatch(await page.locator('body').innerText(), forbidden);
    assert.equal(await page.getByText('137', { exact: true }).count(), 0);
    assert.ok((await page.locator('body').innerText()).includes(wallet));
    assert.ok(!mutations.some(path => /claim|wl\/apply|runs\/start/.test(path)), 'Old entry links cannot claim new qualification');
    signedIn = false;
    await page.goto(base + '/arcade-pass');
    await page.getByRole('heading', { name: 'Sign in to view your Arcade Pass.' }).waitFor();
    assert.doesNotMatch(await page.locator('body').innerText(), forbidden);
    await page.goto(base + '/arcade-privacy');
    assert.doesNotMatch(await page.locator('body').innerText(), /top\s*100|earns?\s+(?:a\s+)?GTD/i);
    // APIRequestContext bypasses browser routes: exercise the actual local handler.
    const response = await context.request.post(base + '/api/campaign/wl/apply', { data: {} });
    assert.equal(response.status(), 410);
    assert.equal((await response.json()).error, 'Allowlist applications are closed.');
    assert.deepEqual(errors, []);
    console.log(`PASS ${name}: expired routes, stale slot counts, saved eligibility, closed application API`);
  } finally { await context.close(); await browser.close(); }
}
