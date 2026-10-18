import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// Run against a local Next server. The campaign API is a browser-only fixture;
// this check never starts a run, signs in, or submits a score.
const base = process.env.CAMPAIGN_INVITE_TEST_URL || 'http://localhost:4000';
const screenshots = process.env.CAMPAIGN_INVITE_SCREENSHOTS;
const widths = [320, 375, 390, 430, 700, 701, 768, 1280];
const heading = 'Win one race or fight. Save your score.';
const links = [
  ['PLAY BARRY CUP →', '/os/lambo#official'],
  ['FIGHT THE CIRCUIT →', '/os/rumble#official'],
];
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
});
const context = await browser.newContext({ hasTouch: true, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await context.route('**/api/campaign/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = path.endsWith('/config') ? { open: true, routes: { cup: true, rumble: true } }
    : path.endsWith('/leaderboard') ? { entries: [] }
      : path.endsWith('/session') ? { pass: null } : {};
  return route.fulfill({ json });
});
await context.route('**/api/drop', route => route.fulfill({ status: 503, json: { error: 'Layout test fixture' } }));

try {
  if (screenshots) await mkdir(screenshots, { recursive: true });
  for (const path of ['/', '/os']) {
    await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    const card = page.locator('aside').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
    await card.waitFor();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await card.scrollIntoViewIfNeeded();
      const layout = await card.evaluate(element => {
        const [copy, choices] = element.children;
        const rect = node => {
          const { x, y, width, height, right, bottom } = node.getBoundingClientRect();
          return { x, y, width, height, right, bottom };
        };
        const style = getComputedStyle(element);
        return {
          card: rect(element), copy: rect(copy), choices: rect(choices),
          innerWidth: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
          overflowing: [...element.querySelectorAll('*')].some(node => node.scrollWidth > node.clientWidth + 1),
          pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          buttons: [...choices.children].map(rect),
        };
      });
      const label = `${path} at ${width}px`;
      assert.equal(layout.overflowing, false, `${label}: no clipped card content`);
      assert.equal(layout.pageOverflow, false, `${label}: no horizontal page overflow`);
      assert.ok(layout.card.x >= 0 && layout.card.right <= width + 1, `${label}: card fits viewport`);
      if (width <= 700) {
        assert.ok(layout.choices.y >= layout.copy.bottom + 11, `${label}: actions sit below the copy`);
        for (const name of ['copy', 'choices']) {
          assert.ok(Math.abs(layout[name].width - layout.innerWidth) <= 1, `${label}: ${name} uses full card width`);
        }
      } else {
        assert.ok(layout.choices.x >= layout.copy.right + 21, `${label}: desktop remains side by side`);
      }
      assert.ok(layout.buttons[1].y >= layout.buttons[0].bottom + 7, `${label}: actions have separate tap areas`);
      for (const [index, [name, href]] of links.entries()) {
        const link = card.getByRole('link', { name, exact: true });
        assert.equal(await link.getAttribute('href'), href, `${label}: destination preserved`);
        assert.ok(layout.buttons[index].height >= 48, `${label}: touch target is at least 48px high`);
        await link.tap({ trial: true });
      }
      if (screenshots && [390, 1280].includes(width)) {
        await card.screenshot({ path: `${screenshots}/${path === '/' ? 'home' : 'arcade'}-${width}.png` });
      }
      console.log(`PASS ${label}: readable copy, separated actions, no overflow, both links tappable`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, href] of links) {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const card = page.locator('aside').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
    await card.getByRole('link', { name, exact: true }).tap();
    await page.waitForURL(base + href);
    await page.getByRole('region', { name: 'Official WL challenge', exact: true }).waitFor();
    console.log(`PASS mobile tap navigates to ${href} and renders the official challenge`);
  }
  assert.deepEqual(errors, [], 'no uncaught browser errors');
} finally {
  await browser.close();
}
