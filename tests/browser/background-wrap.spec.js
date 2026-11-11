import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import { boot, enterActivity, fixture } from './helpers.js';

const screenshotDir = resolve(process.env.FIDELITY_EVIDENCE || '.tmp/background-fix', 'screenshots');
const hash = pixels => createHash('sha256').update(Buffer.from(pixels)).digest('hex');
async function pixels(page, { x, y, width, height }) {
  return page.locator('#scene').evaluate((canvas, region) => {
    return Array.from(canvas.getContext('2d').getImageData(region.x, region.y, region.width, region.height).data);
  }, { x, y, width, height });
}
async function screenshot(page, name) {
  await mkdir(screenshotDir, { recursive: true });
  await page.locator('#scene').screenshot({ path: resolve(screenshotDir, name) });
}
function shiftedByOne(previous, next, width, height) {
  for (let y = 0; y < height; y++) for (let x = 0; x < width - 1; x++) {
    const source = (y * width + x + 1) * 4;
    const target = (y * width + x) * 4;
    for (let channel = 0; channel < 4; channel++) {
      if (previous[source + channel] !== next[target + channel]) return { x, y, channel };
    }
  }
  return null;
}

for (const region of [
  ['sky', { x: 40, y: 50, width: 120, height: 85 }],
  ['soil', { x: 0, y: 320, width: 120, height: 80 }],
]) test(`outdoor ${region[0]} pixels stay fixed across both old background wraps`, async ({ page }) => {
  test.setTimeout(45_000);
  const [, bounds] = region;
  await boot(page, { motion: 'no-preference', data: fixture({ duration: 60 }) });
  await enterActivity(page, 'outdoor');
  const initial = hash(await pixels(page, bounds));
  await screenshot(page, `outdoor-${region[0]}-before-wrap.png`);

  // Goal 5 uses the existing 72 canvas-pixel/s outdoor travel speed. These
  // samples straddle the former 640px full-raster repeat, then its second wrap.
  const samples = [initial];
  await page.clock.runFor(8875);
  samples.push(hash(await pixels(page, bounds)));
  await screenshot(page, `outdoor-${region[0]}-first-wrap-before.png`);
  await page.clock.runFor(50);
  samples.push(hash(await pixels(page, bounds)));
  await screenshot(page, `outdoor-${region[0]}-first-wrap-after.png`);
  await page.clock.runFor(8860);
  samples.push(hash(await pixels(page, bounds)));
  await page.clock.runFor(50);
  samples.push(hash(await pixels(page, bounds)));

  for (const [index, sample] of samples.entries()) {
    expect(sample, `${region[0]} raster pixels changed at sample ${index}`).toBe(initial);
  }
});

test('pavement repeats every 40 canvas pixels and advances continuously through phases 39, 40, 41', async ({ page }) => {
  await boot(page, { motion: 'no-preference', data: fixture({ duration: 60 }) });
  await enterActivity(page, 'outdoor');
  const bounds = { x: 0, y: 280, width: 140, height: 32 };
  const phase0 = await pixels(page, bounds);

  // Footage suggests about 3 native pixels/s. At 2x display scale the
  // conservative estimate is 6 canvas pixels/s, using scene active time.
  await page.clock.runFor(6520);
  const phase39 = await pixels(page, bounds);
  await page.clock.runFor(180);
  const phase40 = await pixels(page, bounds);
  await page.clock.runFor(170);
  const phase41 = await pixels(page, bounds);

  expect(hash(phase40), 'phase 40 must equal the start of the 40px tile').toBe(hash(phase0));
  expect(shiftedByOne(phase39, phase40, bounds.width, bounds.height), '39 to 40 must shift by one canvas pixel').toBeNull();
  expect(shiftedByOne(phase40, phase41, bounds.width, bounds.height), '40 to 41 must shift by one canvas pixel').toBeNull();

  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-panel')).toBeVisible();
  const paused = hash(await pixels(page, { x: 0, y: 0, width: 640, height: 400 }));
  await page.clock.runFor(1000);
  expect(hash(await pixels(page, { x: 0, y: 0, width: 640, height: 400 })), 'pause must freeze the full scene').toBe(paused);
});

test('underwater backdrop stays fixed through its former 640px wrap', async ({ page }) => {
  test.setTimeout(45_000);
  await boot(page, { motion: 'no-preference', data: fixture({ duration: 60, goal: 30 }) });
  await enterActivity(page, 'underwater');
  const bounds = { x: 0, y: 0, width: 80, height: 200 };
  const initial = hash(await pixels(page, bounds));
  await page.clock.runFor(22200);
  const beforeWrap = hash(await pixels(page, bounds));
  await page.clock.runFor(100);
  const afterWrap = hash(await pixels(page, bounds));
  await screenshot(page, 'underwater-fixed-backdrop.png');
  expect([beforeWrap, afterWrap], 'WATER background pixels must not scroll').toEqual([initial, initial]);
});

test('reduced motion keeps the complete outdoor scene pixel-fixed', async ({ page }) => {
  await boot(page, { motion: 'reduce', data: fixture({ duration: 60 }) });
  await enterActivity(page, 'outdoor');
  const bounds = { x: 0, y: 0, width: 640, height: 400 };
  const initial = hash(await pixels(page, bounds));
  await page.clock.runFor(2000);
  expect(hash(await pixels(page, bounds)), 'reduced motion must keep scenery and sprites stationary').toBe(initial);
});
