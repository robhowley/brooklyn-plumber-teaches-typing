import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const titleLayout = JSON.parse(readFileSync(new URL('../../src/assets/title/title-layout.json', import.meta.url), 'utf8'));
const titleTiming = JSON.parse(readFileSync(new URL('../../src/assets/title/timing.json', import.meta.url), 'utf8'));
const titleBasePng = readFileSync(new URL('../../src/assets/title/title-base.png', import.meta.url)).toString('base64');
const titlePng = readFileSync(new URL('../../src/assets/title/title.png', import.meta.url)).toString('base64');
const integrationDir = resolve('artifacts/title-still/integration');

async function prepareTitleReferences(page) {
  await page.evaluate(async ({basePng,titlePng}) => {
    const pixels = async encoded => {
      const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
      const image = await createImageBitmap(new Blob([bytes], {type:'image/png'}));
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      image.close();
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    window.__titleTestReference = {base:await pixels(basePng),title:await pixels(titlePng)};
  },{basePng:titleBasePng,titlePng});
}

async function titleState(page, rects = []) {
  return page.evaluate(rects => {
    const canvas = document.querySelector('#title-art');
    const current = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
    const { base, title } = window.__titleTestReference;
    const exact = expected => {
      for (let i = 0; i < current.length; i++) {
        if (current[i] !== expected[i]) return false;
      }
      return true;
    };
    const glyphState = ({ x, y, width, height }) => {
      let changed = 0, partial = 0;
      for (let row = y; row < y + height; row++) {
        for (let column = x; column < x + width; column++) {
          const offset = (row * canvas.width + column) * 4;
          const sameBase = current[offset] === base[offset] && current[offset + 1] === base[offset + 1] && current[offset + 2] === base[offset + 2];
          const sameTitle = current[offset] === title[offset] && current[offset + 1] === title[offset + 1] && current[offset + 2] === title[offset + 2];
          if (!sameBase) changed++;
          if (!sameBase && !sameTitle) partial++;
        }
      }
      return { changed, partial };
    };
    return { baseExact: exact(base), titleExact: exact(title), glyphs: rects.map(glyphState) };
  }, rects);
}

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
    const art = page.getByRole('img',{name:/title artwork cropped from a video screenshot/});
    await expect(art).toBeVisible();
    expect(await art.evaluate(c => [c.width,c.height])).toEqual([720,450]);
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

test('paused clock reveals 13 image glyphs at measured starts and ends on the exact source crop', async ({page}) => {
  mkdirSync(integrationDir, { recursive:true });
  await page.clock.install({time:new Date('2026-11-09T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-11-09T00:00:00Z'));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await prepareTitleReferences(page);
  await expect.poll(async () => (await titleState(page)).baseExact).toBe(true);
  await page.clock.runFor(20);
  const initial = await titleState(page);
  expect(initial.baseExact).toBe(true);
  await page.screenshot({path:resolve(integrationDir,'menu-start.png'),fullPage:true});

  const delayMs = titleTiming.implementation.recommendedInitialDelayMs;
  const fadeMs = 120;
  await page.clock.runFor(delayMs - 20);
  expect((await titleState(page)).baseExact).toBe(true);
  await page.clock.runFor(60);
  let elapsed = delayMs + 60;
  for (let i=0;i<titleLayout.glyphs.length;i++) {
    const target = delayMs + titleTiming.letters[i].startMs + 60;
    if (target > elapsed) await page.clock.runFor(target - elapsed);
    elapsed = target;
    const glyphs = titleLayout.glyphs.map(glyph => glyph.rect);
    const state = await titleState(page,glyphs);
    expect(state.glyphs[i].changed,`glyph ${i+1} should have begun fading`).toBeGreaterThan(0);
    expect(state.glyphs[i].partial,`glyph ${i+1} should be between base and full opacity`).toBeGreaterThan(0);
    expect(state.glyphs.slice(i+1).every(glyph => glyph.changed === 0),`glyphs after ${i+1} should remain hidden`).toBe(true);
    if (i > 0) expect(state.glyphs[i-1].partial,`glyph ${i} should already be complete`).toBe(0);
    if ([0,6,11].includes(i)) {
      await page.locator('#title-art').screenshot({path:resolve(integrationDir,`midfade-${String(i+1).padStart(2,'0')}.png`)});
    }
  }
  await page.clock.runFor(fadeMs + 40);
  await expect.poll(async () => (await titleState(page)).titleExact).toBe(true);
  await page.locator('#title-art').screenshot({path:resolve(integrationDir,'title-canvas-final.png')});
});

test('reduced motion draws the complete static title without waiting for fades', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.clock.install({time:new Date('2026-11-09T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-11-09T00:00:00Z'));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await prepareTitleReferences(page);
  await expect.poll(async () => (await titleState(page)).titleExact).toBe(true);
  await page.clock.runFor(5000);
  expect((await titleState(page)).titleExact).toBe(true);
});

test('keyboard skip remains available during the subtitle fade', async ({page}) => {
  await page.clock.install({time:new Date('2026-11-09T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-11-09T00:00:00Z'));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await prepareTitleReferences(page);
  await expect.poll(async () => (await titleState(page)).baseExact).toBe(true);
  await page.clock.runFor(20);
  await page.clock.runFor(160);
  expect((await titleState(page,[titleLayout.glyphs[0].rect])).glyphs[0].partial).toBeGreaterThan(0);
  await page.locator('.title-skip').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Your name')).toBeFocused();
});

test('navigating away during the fade stops drawing on the detached title canvas', async ({page}) => {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date('2026-11-09T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-11-09T00:00:00Z'));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await prepareTitleReferences(page);
  await expect.poll(async () => (await titleState(page)).baseExact).toBe(true);
  await page.clock.runFor(20);
  await page.clock.runFor(160);
  const canvas=await page.locator('#title-art').elementHandle();
  const before=await canvas.evaluate(element=>element.toDataURL());
  await page.locator('#report').click();
  await expect(page.getByRole('heading',{name:'Report card'})).toBeVisible();
  await page.clock.runFor(1000);
  expect(await canvas.evaluate(element=>element.isConnected)).toBe(false);
  expect(await canvas.evaluate(element=>element.toDataURL())).toBe(before);
  expect(errors).toEqual([]);
});

test('normal clock completes the reveal and preserves production screenshots at desktop and mobile widths', async ({page}) => {
  mkdirSync(integrationDir, { recursive:true });
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await prepareTitleReferences(page);
  const startedAt=Date.now();
  const glyphRects=titleLayout.glyphs.map(glyph=>glyph.rect);
  await expect.poll(async () => (await titleState(page,glyphRects)).glyphs.some(glyph=>glyph.partial>0), {intervals:[16,24,32,48,64,80],timeout:2500}).toBe(true);
  await page.locator('#title-art').screenshot({path:resolve(integrationDir,'midfade-normal-clock.png')});
  const firstPartialFrame=await page.locator('#title-art').evaluate(canvas=>canvas.toDataURL());
  await expect.poll(async () => (await page.locator('#title-art').evaluate(canvas=>canvas.toDataURL())) !== firstPartialFrame,
    {intervals:[16,24,32,48,64,80],timeout:1000}).toBe(true);
  await page.waitForTimeout(4400);
  await expect.poll(async () => (await titleState(page)).titleExact).toBe(true);
  expect(Date.now()-startedAt).toBeGreaterThanOrEqual(4300);
  expect(errors).toEqual([]);
  await page.locator('#title-art').screenshot({path:resolve(integrationDir,'title-canvas-normal-clock.png')});
  await page.screenshot({path:resolve(integrationDir,'desktop-1440.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:1000});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:resolve(integrationDir,'desktop-1280.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:resolve(integrationDir,'mobile-390.png'),fullPage:true});
});
