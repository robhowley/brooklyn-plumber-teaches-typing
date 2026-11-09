import { test, expect } from '@playwright/test';

test('dedicated title keeps desktop controls visible and all widths free of overflow', async ({page}) => {
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:')) external.push(request.url());
  });
  for (const width of [1440,1280,390]) {
    await page.setViewportSize({width,height:1000});
    await page.goto('/');
    await expect(page.getByRole('heading',{name:'Mario Teaches Typing',exact:true})).toHaveCount(1);
    const art = page.getByRole('img',{name:/Mario sits at a computer/});
    await expect(art).toBeVisible();
    expect(await art.evaluate(c => [c.width,c.height])).toEqual([1540,968]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if(width > 800) {
      const start = await page.getByRole('button',{name:'Start lesson',exact:true}).boundingBox();
      const report = await page.locator('#report').boundingBox();
      expect(start.y + start.height).toBeLessThan(1000);
      expect(report.y + report.height).toBeLessThan(1000);
    }
    await page.locator('.title-skip').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Your name')).toBeFocused();
    expect(await page.getByLabel('Your name').evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('student and character remain usable by keyboard and persist through a lesson', async ({page}) => {
  await page.goto('/');
  await page.locator('.title-skip').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Title Student');
  await page.getByLabel('Your name').fill('Title Student');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio',{name:'Mario',exact:true})).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio',{name:'Luigi',exact:true})).toBeChecked();
  await page.getByLabel('Lesson path').selectOption('custom');
  await page.getByLabel('Activity').selectOption('practice');
  await page.getByLabel('Keyboard lesson').selectOption('5');
  await page.getByLabel('Goal · WPM').fill('15');
  await page.getByLabel('Time · seconds').fill('10');
  await page.getByRole('button',{name:'Start lesson',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Return to menu'}).click();
  await page.reload();
  await expect(page.getByLabel('Your name')).toHaveValue('Title Student');
  await expect(page.getByRole('radio',{name:'Luigi',exact:true})).toBeChecked();
  await expect(page.getByLabel('Activity')).toHaveValue('practice');
  await expect(page.getByLabel('Goal · WPM')).toHaveValue('15');
  await expect(page.locator('#next')).toBeDisabled();
});

test('reduced-motion guided pass still enables saved Next beside the form and report navigation works', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.clock.install({time:new Date('2026-11-09T00:00:00Z')});
  await page.goto('/');
  await page.clock.pauseAt(new Date('2026-11-09T00:01:00Z'));
  const art = await page.locator('#title-art').evaluate(c => c.toDataURL());
  await page.getByLabel('Time · seconds').fill('1');
  await page.getByRole('button',{name:'Start lesson',exact:true}).click();
  for(let i=0;i<10;i++) {
    const key=await page.locator('#target').textContent();
    await page.keyboard.press(key==='␣'?'Space':key);
  }
  await page.clock.runFor(1100);
  await expect(page.getByRole('heading',{name:'A star performance!'})).toBeVisible();
  await page.getByRole('button',{name:'Main menu',exact:true}).click();
  await expect(page.locator('.student #next')).toBeEnabled();
  await page.reload();
  await expect(page.locator('.student #next')).toBeEnabled();
  await page.locator('#next').click();
  await expect(page.locator('#course-position')).toContainText('Add top row');
  await expect(page.locator('#next')).toBeDisabled();
  await page.locator('#report').click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button',{name:'Main menu',exact:true}).click();
  expect(await page.locator('#title-art').evaluate(c => c.toDataURL())).toBe(art);
});
