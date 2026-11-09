import { test, expect } from '@playwright/test';

async function boot(page, reducedMotion = 'reduce') {
  await page.emulateMedia({ reducedMotion });
  await page.clock.install({ time: new Date('2026-11-09T00:00:00Z') });
  await page.goto('/');
  await page.clock.pauseAt(new Date('2026-11-09T00:01:00Z'));
}

async function typeTargets(page, count) {
  for (let i = 0; i < count; i++) {
    const target = await page.locator('#target').textContent();
    await page.keyboard.press(target === '␣' ? 'Space' : target);
  }
}

async function startCustom(page, { goal, duration }) {
  await page.getByLabel('Lesson path').selectOption('custom');
  await page.getByLabel('Activity').selectOption('practice');
  await page.getByLabel('Keyboard lesson').selectOption('5');
  await page.getByLabel('Goal · WPM').fill(String(goal));
  await page.getByLabel('Time · seconds').fill(String(duration));
  await page.getByRole('button', { name: 'Start lesson', exact: true }).click();
}

test('guided pass keeps the blackboard, announces the outcome, and preserves retry/report progression', async ({ page }, testInfo) => {
  await boot(page);
  await page.getByLabel('Time · seconds').fill('1');
  await page.getByRole('button', { name: 'Start lesson', exact: true }).click();
  await typeTargets(page, 10);
  await page.clock.runFor(1100);

  await expect(page.getByRole('main', { name: 'A star performance!' })).toBeVisible();
  await expect(page.locator('.victory-seal')).toHaveText('★ VICTORY! ★');
  await expect(page.locator('.blackboard')).toContainText('GOAL REACHED');
  await expect(page.locator('.blackboard')).toContainText('Correct keys');
  await expect(page.locator('.blackboard')).toContainText('Errors');
  await expect(page.locator('.blackboard')).toContainText('Accuracy');
  await expect(page.locator('.blackboard')).toContainText('Words / minute');
  await expect(page.locator('.blackboard')).toContainText('Active lesson time');
  await expect(page.locator('.blackboard')).toContainText("this recreation's 90% accuracy rule");
  await expect(page.locator('#next')).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('Passed.');
  await expect(page.getByRole('status')).toContainText('Goal reached at timeout.');
  await expect(page.locator('#retry')).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('guided-pass.png'), fullPage: true });

  await page.getByRole('button', { name: 'Try again' }).click();
  await page.clock.runFor(1100);
  await expect(page.getByRole('main', { name: 'Every key is practice.' })).toBeVisible();
  await expect(page.locator('.victory-seal')).toHaveCount(0);
  await expect(page.locator('.blackboard')).toContainText('KEEP GOING');
  await expect(page.locator('.result-feedback')).toContainText('No keys were typed');
  await expect(page.locator('#next')).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('Not passed.');
  await expect(page.locator('#retry')).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('retry-zero-input.png'), fullPage: true });

  await page.getByRole('button', { name: 'Main menu' }).click();
  await expect(page.locator('#course-position')).toContainText('Home row · 5 WPM');
  await expect(page.locator('#next')).toBeEnabled();
  await page.getByRole('button', { name: 'Report card & certificates' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('tbody')).toContainText('Pass');
  await expect(page.locator('tbody')).toContainText('Retry');
  await page.reload();
  await expect(page.locator('#course-position')).toContainText('Home row · 5 WPM');
  await expect(page.locator('#next')).toBeEnabled();
  await page.getByRole('button', { name: 'Report card & certificates' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
});

test('production castle sinks after idle, freezes in pause, and recovers through real input', async ({ page }, testInfo) => {
  await boot(page, 'no-preference');
  await page.getByLabel('Lesson path').selectOption('custom');
  await page.getByLabel('Activity').selectOption('castle');
  await page.getByLabel('Goal · WPM').fill('30');
  await page.getByLabel('Time · seconds').fill('60');
  await page.getByRole('button', { name: 'Start lesson', exact: true }).click();
  await typeTargets(page, 40);
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  await page.clock.runFor(10000);
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.clock.runFor(200);
  const headTop = () => page.locator('#scene').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(215, 85, 55, 65).data;
    for (let i = 0; i < pixels.length; i += 4) {
      const [r, g, b] = pixels.slice(i, i + 3);
      if (r > 130 && r > g * 1.6 && r > b * 1.6) return 85 + Math.floor(i / 4 / 55);
    }
    return 150;
  });
  const high = await headTop();
  await page.clock.runFor(8000);
  const low = await headTop();
  expect(low).toBeGreaterThan(high + 12);
  await page.screenshot({ path: testInfo.outputPath('production-sunken.png') });
  await page.keyboard.press('Escape');
  const paused = await page.locator('#scene').evaluate(c => c.toDataURL());
  await page.clock.runFor(10000);
  expect(await page.locator('#scene').evaluate(c => c.toDataURL())).toBe(paused);
  await page.getByRole('button', { name: 'Resume' }).click();
  for (let i = 0; i < 30; i++) { await typeTargets(page, 1); await page.clock.runFor(100); }
  expect(await headTop()).toBeLessThan(low - 12);
  await page.screenshot({ path: testInfo.outputPath('production-recovered.png') });
  await page.clock.runFor(60000);
  await expect(page.locator('.blackboard')).toContainText('Correct keys');
  await expect(page.locator('.blackboard dd').first()).toHaveText('70');
  await expect(page.locator('#next')).toBeDisabled();
});

test('custom results explain no input, slow speed, and low accuracy without celebration or course progress', async ({ page }, testInfo) => {
  await boot(page);

  await startCustom(page, { goal: 5, duration: 1 });
  await page.clock.runFor(1100);
  await expect(page.locator('.result-feedback')).toContainText('No keys were typed');
  await expect(page.locator('.victory-seal')).toHaveCount(0);
  await expect(page.locator('#next')).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('custom-zero-input.png'), fullPage: true });

  await page.getByRole('button', { name: 'Main menu' }).click();
  await startCustom(page, { goal: 60, duration: 3 });
  await typeTargets(page, 1);
  await page.clock.runFor(3100);
  await expect(page.locator('.result-feedback')).toContainText('Speed was 4.0 WPM, below your selected goal of 60 WPM.');
  await expect(page.locator('.result-feedback')).not.toContainText('Accuracy was');
  await expect(page.locator('.victory-seal')).toHaveCount(0);
  await expect(page.locator('#next')).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('custom-low-speed.png'), fullPage: true });

  await page.getByRole('button', { name: 'Main menu' }).click();
  await startCustom(page, { goal: 1, duration: 3 });
  await typeTargets(page, 9);
  await page.keyboard.press('~');
  await page.keyboard.press('~');
  await page.clock.runFor(3100);
  await expect(page.locator('.blackboard')).toContainText('36.0');
  await expect(page.locator('.blackboard')).toContainText('81.8%');
  await expect(page.locator('.result-feedback')).toContainText("below this recreation's 90% pass rule");
  await expect(page.locator('.result-feedback')).not.toContainText('below your selected goal');
  await expect(page.locator('.victory-seal')).toHaveCount(0);
  await expect(page.locator('#next')).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('Not passed.');
  await expect(page.locator('#retry')).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('custom-low-accuracy.png'), fullPage: true });

  await page.getByRole('button', { name: 'Main menu' }).click();
  await expect(page.locator('#course-position')).toContainText('Home row · 5 WPM');
  await expect(page.locator('#next')).toBeDisabled();
});
