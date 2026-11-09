import { test, expect } from '@playwright/test';

async function start(page, mode = 'outdoor') {
  await page.clock.install({ time: new Date('2026-11-09T00:00:00Z') });
  await page.goto('/');
  await page.clock.pauseAt(new Date('2026-11-09T00:01:00Z'));
  await page.getByLabel('Lesson path').selectOption('custom');
  await page.getByLabel('Activity').selectOption(mode);
  await page.getByLabel('Keyboard lesson').selectOption('5');
  await page.getByRole('button', { name: 'Start lesson', exact: true }).click();
}

for (const width of [1280, 1440]) {
  for (const mode of ['outdoor', 'underwater', 'castle', 'practice']) {
    test(`${mode} scene, glove HUD and controls fit ${width}×900`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await start(page, mode);
      await expect(page.locator('.glove')).toHaveCount(2);
      await expect(page.locator('#keyboard-guide')).toBeHidden();
      const layout = await page.evaluate(() => {
        const bounds = selector => {
          const { x, y, width, height, bottom } = document.querySelector(selector).getBoundingClientRect();
          return { x, y, width, height, bottom };
        };
        return { scene: bounds('#scene'), hud: bounds('.hud'), strip: bounds('#text-strip'), controls: bounds('.play-controls'), scrollHeight: document.documentElement.scrollHeight };
      });
      expect(layout.scrollHeight).toBeLessThanOrEqual(900);
      expect(layout.controls.bottom).toBeLessThan(900);
      expect(layout.hud.y).toBeGreaterThanOrEqual(layout.scene.bottom);
      if (mode !== 'practice') expect(layout.scene.width / layout.scene.height).toBeCloseTo(640 / 280, 2);
      if (mode === 'outdoor') await expect(page.locator('#text-strip')).toBeHidden();
      else if (mode === 'practice') {
        expect(layout.strip.y).toBeGreaterThanOrEqual(layout.hud.bottom);
        expect(await page.locator('#text-strip').textContent()).toHaveLength(400);
      }
      else expect(layout.strip.bottom).toBeLessThanOrEqual(layout.scene.y);
      await page.screenshot({ path: `.tmp/test-results/graphics/${mode}-${width}x900.png`, fullPage: true });
    });
  }
}

test('gloves follow engine finger hints, including both thumbs and opposite Shift', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await start(page, 'castle');
  await expect(page.locator('#target')).toHaveText('T');
  await expect(page.locator('[data-hand="left"] [data-finger="index"]')).toHaveClass(/active/);
  await expect(page.locator('[data-hand="right"] [data-finger="little"]')).toHaveClass(/shift-finger/);
  await page.keyboard.press('t');
  await expect(page.locator('#errors')).toHaveText('1');
  await expect(page.locator('#correct')).toHaveText('0');
  await expect(page.locator('#text-strip mark')).toHaveText('T');
  await page.keyboard.press('T');
  await expect(page.locator('#correct')).toHaveText('1');
  await expect(page.locator('[data-hand="right"] [data-finger="index"]')).toHaveClass(/active/);
  await expect(page.locator('.shift-finger')).toHaveCount(0);
  await page.keyboard.press('h');
  await page.keyboard.press('e');
  await expect(page.locator('#target')).toHaveText('␣');
  await expect(page.locator('[data-finger="thumb"].active')).toHaveCount(2);
  await page.screenshot({ path: '.tmp/test-results/graphics/space-gloves.png', fullPage: true });
  await page.keyboard.press('Space');
  await expect(page.locator('#correct')).toHaveText('4');
  await page.keyboard.press('Escape');
  await expect(page.locator('#resume')).toBeFocused();
  const time = await page.locator('#time').textContent();
  await page.clock.runFor(60000);
  await expect(page.locator('#time')).toHaveText(time);
  await page.keyboard.press('Enter');
  await expect(page.locator('#pause-panel')).toBeHidden();
  await page.locator('#keyboard-toggle').click();
  await expect(page.locator('#keyboard-guide')).toBeVisible();
  await expect(page.locator('#keyboard-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#keyboard-toggle').click();
  await expect(page.locator('#keyboard-guide')).toBeHidden();
});

test('a shorter desktop keeps the controls in view', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await start(page, 'castle');
  const controls = await page.locator('.play-controls').boundingBox();
  expect(controls.y + controls.height).toBeLessThanOrEqual(768);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(768);
  await page.screenshot({ path: '.tmp/test-results/graphics/castle-1366x768.png', fullPage: true });
});

test('narrow screen and reduced motion keep the target, hands and controls usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page, 'outdoor');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('#target')).toBeVisible();
  await expect(page.locator('#finger')).toBeVisible();
  await page.locator('#keyboard-toggle').click();
  expect((await page.locator('.keyboard .space').boundingBox()).width).toBeGreaterThanOrEqual(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#keyboard-toggle').click();
  await page.screenshot({ path: '.tmp/test-results/graphics/mobile-390x844.png', fullPage: true });
});
