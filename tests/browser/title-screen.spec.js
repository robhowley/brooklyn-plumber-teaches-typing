import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import layout from '../../src/assets/title/title-layout.json' with { type: 'json' };

const sources = Object.fromEntries(['title-base', 'title'].map(name => [name,
  `data:image/png;base64,${readFileSync(new URL(`../../src/assets/title/${name}.png`, import.meta.url)).toString('base64')}`]));

async function bootTitle(page, motion = 'no-preference') {
  await page.emulateMedia({ reducedMotion: motion });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
    window.pendingFrames = new Set();
    window.requestAnimationFrame = callback => {
      const id = request(time => { window.pendingFrames.delete(id); callback(time); });
      window.pendingFrames.add(id); return id;
    };
    window.cancelAnimationFrame = id => { window.pendingFrames.delete(id); cancel(id); };
  });
  await page.goto('/');
  await expect(page.locator('#title-art')).toHaveAttribute('data-phase', motion === 'reduce' ? 'complete' : 'base');
}
// Compare every pixel, including the untouched word gap and background.
async function matchesArtwork(page, glyphCount) {
  return page.locator('#title-art').evaluate(async (canvas, { sources, glyphs, glyphCount }) => {
    const [base, title] = await Promise.all(Object.values(sources).map(async src => {
      const image = new Image(); image.src = src; await image.decode(); return image;
    }));
    const expected = document.createElement('canvas'); expected.width = 720; expected.height = 450;
    const ctx = expected.getContext('2d');
    ctx.drawImage(glyphCount === 13 ? title : base, 0, 0);
    if (glyphCount !== 13) for (const { rect: { x, y, width, height } } of glyphs.slice(0, glyphCount)) {
      ctx.drawImage(title, x, y, width, height, x, y, width, height);
    }
    const actual = canvas.getContext('2d').getImageData(0, 0, 720, 450).data;
    return ctx.getImageData(0, 0, 720, 450).data.every((byte, i) => byte === actual[i]);
  }, { sources, glyphs: layout.glyphs, glyphCount });
}

test('base, left-to-right reveal, exact final title, then distinct accessible welcome/menu', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await bootTitle(page);
  await expect(page.locator('.cabinet')).toHaveCount(0);
  expect(await matchesArtwork(page, 0)).toBe(true);
  await page.screenshot({ path: info.outputPath('title-base.png') });
  await page.clock.runFor(1800);
  expect(await matchesArtwork(page, 7)).toBe(true);
  await page.screenshot({ path: info.outputPath('title-partial.png') });
  await page.clock.runFor(2600);
  await expect(page.locator('#title-art')).toHaveAttribute('data-phase', 'complete');
  expect(await matchesArtwork(page, 13)).toBe(true);
  expect(await page.evaluate(() => window.pendingFrames.size)).toBe(1); // Only the existing game loop remains.
  await page.screenshot({ path: info.outputPath('title-final.png') });
  await page.clock.runFor(1000);
  await expect(page.locator('#title-art')).toHaveCount(0);
  await expect(page.locator('#screen-art')).toHaveAttribute('aria-label', 'Original GREET background');
  await expect(page.locator('#enter')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#screen-art')).toHaveAttribute('aria-label', 'Original MAINMENU background');
  await expect(page.locator('#activity-outdoor')).toBeFocused();
  for (const id of ['activity-underwater', 'activity-castle', 'next']) await expect(page.locator(`#${id}`)).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const action of ['Enter', 'Space', 'click']) test(`${action} skips immediately and cancels later handoff`, async ({ page }) => {
  await bootTitle(page);
  if (action === 'click') await page.locator('#skip-title').click();
  else await page.keyboard.press(action);
  await expect(page.locator('#enter')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.clock.runFor(6000);
  await expect(page.locator('#activity-outdoor')).toBeFocused();
});

for (const initial of [true, false]) test(`reduced motion ${initial ? 'at startup' : 'during reveal'} completes without animation`, async ({ page }) => {
  await bootTitle(page, initial ? 'reduce' : 'no-preference');
  if (!initial) {
    await page.clock.runFor(500);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('#title-art')).toHaveAttribute('data-phase', 'complete');
  }
  expect(await matchesArtwork(page, 13)).toBe(true);
  await page.clock.runFor(900);
  await expect(page.locator('#enter')).toBeFocused();
});

for (const elapsed of [500, 4400]) test(`detachment at ${elapsed}ms cancels painting and handoff`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await bootTitle(page);
  await page.clock.runFor(elapsed);
  await page.evaluate(() => {
    window.detachedTitle = document.querySelector('#title-art');
    window.detachedPixels = window.detachedTitle.toDataURL();
    window.detachedTitle.remove();
  });
  expect(await page.evaluate(() => window.pendingFrames.size)).toBe(1);
  await page.clock.runFor(6000);
  expect(await page.evaluate(() => window.detachedTitle.toDataURL() === window.detachedPixels)).toBe(true);
  await expect(page.locator('#enter')).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`title fits ${viewport.width}x${viewport.height} without stretching or overflow`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await bootTitle(page);
    const canvas = page.locator('#title-art');
    await expect(canvas).toHaveAttribute('width', '720');
    await expect(canvas).toHaveAttribute('height', '450');
    const box = await canvas.boundingBox();
    expect(box.width / box.height).toBeCloseTo(1.6, 2);
    expect(box.width).toBeCloseTo(Math.min(viewport.width, viewport.height * 1.6), 1);
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
    expect(await canvas.evaluate(c => getComputedStyle(c).imageRendering)).toBe('pixelated');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.screenshot({ path: info.outputPath('title-fit.png') });
  });
}

test('historical notice appears before any original learner text and offers generated alternative', async ({ page }) => {
  await page.goto('/'); await page.locator('#skip-title').click(); await page.keyboard.press('Enter'); await page.keyboard.press('1');
  await expect(page.locator('.historical-notice')).toContainText('outdated or inaccurate claims');
  await expect(page.locator('.historical-notice')).toContainText('war, slavery, assassination and disasters');
  await expect(page.locator('#coverage')).toContainText('records use historical text');
  await expect(page.locator('#target')).toHaveCount(0);
  await page.locator('#generated').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#source-caption')).toContainText('Generated practice, not original lesson text');
});
