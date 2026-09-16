/** Run against `npm run build && npm run start`, without ARCADE_LABS. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base=process.env.ARCADE_TEST_URL||'http://localhost:4000';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  assert.equal((await page.goto(`${base}/os`)).status(),200);
  await page.getByRole('link',{name:'START YOUR ENGINE ↗',exact:true}).waitFor();
  await page.getByRole('link',{name:'GO TO THE MOON ↗',exact:true}).waitFor();
  assert.doesNotMatch(await page.locator('body').innerText(),/pixel shop|receipt|rug runner/i);
  await page.getByRole('link',{name:'STEP INTO THE RING ↗',exact:true}).click();
  await page.waitForURL('**/os/rumble');
  await page.getByRole('button',{name:'PRACTICE VS. BOT →',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:/OPEN ASSET/}).count(),0);
  await page.getByRole('button',{name:'PRACTICE VS. BOT →',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.phase==='fight');
  const tick=Number(await page.locator('canvas').getAttribute('data-tick'));
  await page.waitForFunction(t=>Number(document.querySelector('canvas')?.dataset.tick)>t+30,tick);
  await page.getByRole('button',{name:'← LEAVE',exact:true}).click();
  await page.getByRole('link',{name:'BACK TO THE ARCADE ↗',exact:true}).click();
  await page.getByRole('link',{name:'STEP INTO THE RING ↗',exact:true}).waitFor();
  assert.equal((await page.request.get(`${base}/os/asset-lab`)).status(),404);
  assert.deepEqual(errors,[]);
  console.log('PASS: default build → arcade launcher → REKT RUMBLE → running practice → arcade. Flagships lead; retired features absent; review tools gated; no page errors.');
} finally {await browser.close();}
