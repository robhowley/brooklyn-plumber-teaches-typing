import { test, expect } from '@playwright/test';
import {skipStartupUI,createStudentUI,setDurationsUI} from './source-path.mjs';
async function point(page,x,y,click=true) {const r=await page.locator('#game').boundingBox();const p=[r.x+x*r.width/320,r.y+y*r.height/200];if(click)await page.mouse.click(...p);else await page.mouse.move(...p);}
async function ready(page) {await page.goto('./?seed=1');await skipStartupUI(page);await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');}
test('only the original canvas UI is shown and keyboard works on load and focus return',async({page})=>{
 await page.goto('./?seed=1');await expect(page.locator('#game')).toBeFocused();
 await expect(page.locator('main > :visible')).toHaveCount(1);
 await expect(page.locator('button,form,select,input,details,a,section')).toHaveCount(0);
 await skipStartupUI(page);await page.keyboard.press('w');
 await expect(page.locator('#game')).toHaveAttribute('data-screen','student');
 await page.keyboard.type('KEYS');await page.keyboard.press('Enter');await page.keyboard.press('Escape');
 await page.keyboard.press('e');await expect(page.locator('#game')).toHaveAttribute('data-screen','student');await page.keyboard.press('Escape');
 await page.keyboard.press('l');await page.keyboard.press('d');
 expect((await page.evaluate(()=>translationSnapshot())).profile.name).toBe('KEYS');
 await page.keyboard.press('4');await expect(page.locator('#game')).toHaveAttribute('data-screen','practice');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await expect(page.locator('#game')).toHaveAttribute('data-suspended','true');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.locator('#game')).toBeFocused();await expect(page.locator('#game')).toHaveAttribute('data-suspended','false');
 await page.keyboard.press('Escape');await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 await expect(page.locator('#status')).toBeHidden();
});
test('game fills the available viewport without stretching, cropping or scrolling',async({page})=>{
 await page.goto('./?seed=1');await expect(page.locator('#game')).toBeFocused();
 for(const viewport of [{width:1920,height:1080},{width:1440,height:900},{width:390,height:844},{width:844,height:390}]) {
  await page.setViewportSize(viewport);
  const scale=Math.min(viewport.width/320,viewport.height/200);
  const bounds=await page.locator('#game').boundingBox();
  expect(bounds.width).toBeCloseTo(320*scale,1);
  expect(bounds.height).toBeCloseTo(200*scale,1);
  expect(bounds.x).toBeCloseTo((viewport.width-bounds.width)/2,1);
  expect(bounds.y).toBeCloseTo((viewport.height-bounds.height)/2,1);
  expect(await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual(viewport);
 }
 await expect(page.locator('#game')).toHaveAttribute('width','320');
 await expect(page.locator('#game')).toHaveAttribute('height','200');
 await expect(page.locator('#game')).toHaveCSS('image-rendering','pixelated');
 const bounds=await page.locator('#game').boundingBox();
 await page.addInitScript(()=>{Storage.prototype.getItem=function(){throw new Error('test storage blocked');};});
 await page.reload();await expect(page.locator('#status')).toContainText('Storage unavailable');
 await expect(page.locator('#status')).toBeInViewport();
 expect(await page.locator('#game').boundingBox()).toEqual(bounds);
 expect(await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual(page.viewportSize());
});
test('entry/menu uses local decoded assets only; selection and hover survive scale',async({page},testInfo)=>{
 test.skip(testInfo.project.name==='pages-prefix','Welcome speech can drain the queued click.');
 const failures=[],requests=[];page.on('pageerror',e=>failures.push(e.message));page.on('request',r=>requests.push(r.url()));
 await ready(page);expect(await page.locator('canvas').getAttribute('width')).toBe('320');
 await point(page,250,20,false);await expect(page.locator('#game')).toHaveCSS('cursor','pointer');
 await point(page,250,55,false);await expect(page.locator('#game')).toHaveCSS('cursor','pointer');
 await point(page,250,85,false);await expect(page.locator('#game')).toHaveCSS('cursor','pointer');
 await point(page,250,85);await expect(page.locator('#game')).toHaveAttribute('data-screen','castle');
 await page.waitForTimeout(150);await page.waitForFunction(()=>!translationSnapshot().audioHost.blocking);
 await page.locator('#game').press('Escape');await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 await page.locator('#game').press('m');
 await point(page,30,4);expect((await page.evaluate(()=>translationSnapshot())).menu.row).toBe(1);
 const options=(await page.evaluate(()=>translationSnapshot())).audioHost.sourceOptions;await page.locator('#game').press('m');expect((await page.evaluate(()=>translationSnapshot())).audioHost.sourceOptions).toBe(options^1);
 await page.setViewportSize({width:390,height:800});await point(page,250,20);await expect(page.locator('#game')).toHaveAttribute('data-screen','outdoor');
 await expect.poll(async()=>page.evaluate(()=>translationSnapshot().outdoor.targetIndex)).toBeGreaterThanOrEqual(0);
 await page.screenshot({path:'reports/browser/outdoor-mobile.png'});
 expect(requests.some(u=>/\.EXE|raw\/|\/src\/|\.zip/i.test(u))).toBe(false);expect(failures).toEqual([]);
});
test('student setup, group, duration, persistence and ordinary typing through exit/results/Next',async({page})=>{
 await ready(page);await createStudentUI(page,{name:'ADA',lesson:2,goal:7,durations:[1]});await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
 expect((await page.evaluate(()=>translationSnapshot())).profile.name).toBe('ADA');
 await page.reload();await skipStartupUI(page);await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');expect((await page.evaluate(()=>translationSnapshot())).profile.lesson).toBe(2);
 await setDurationsUI(page,[2]);
 expect((await page.evaluate(()=>translationSnapshot())).profile.durations[0]).toBe(2);
 await page.locator('#game').press('1');await expect(page.locator('#game')).toHaveAttribute('data-screen','outdoor');
 await expect.poll(async()=>page.evaluate(()=>translationSnapshot().outdoor.targetIndex)).toBeGreaterThanOrEqual(0);
 let snapshot=await page.evaluate(()=>translationSnapshot());const target=snapshot.outdoor.obstacles[snapshot.outdoor.targetIndex];expect(target.x).toBeGreaterThan(180);
 await page.locator('#game').press(target.code===65?'b':'a');await expect.poll(async()=>page.evaluate(()=>translationSnapshot().outdoor.errors)).toBe(1);
 await page.locator('#game').press(String.fromCharCode(target.code).toLowerCase());await expect.poll(async()=>page.evaluate(()=>translationSnapshot().outdoor.correct)).toBe(1);
 await page.locator('#game').press('Escape');await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 snapshot=await page.evaluate(()=>translationSnapshot());expect(snapshot.profile.lesson).toBe(2);expect(snapshot.result.accuracy).toBe(50);
 await page.screenshot({path:'reports/browser/results.png'});
 await page.locator('#game').press('n');await expect(page.locator('#game')).toHaveAttribute('data-screen','outdoor');
 await page.locator('#game').press('F10');await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 await page.locator('#game').press('m');await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
 await page.screenshot({path:'reports/browser/menu.png'});
});
test('configured duration reaches results without input or an invented failure',async({page})=>{
 await page.clock.install();await page.addInitScript(()=>{window.__sourceTestClock=true;});await ready(page);
 await createStudentUI(page,{name:'CLOCK',durations:[1]});
 await page.locator('#game').press('1');await page.clock.runFor(5000);
 const moving=await page.evaluate(()=>translationSnapshot());expect(moving.outdoor.x).toBeGreaterThan(20);expect(moving.outdoor.attempts).toBe(0);
 await page.clock.runFor(56000);await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 const ended=await page.evaluate(()=>translationSnapshot());expect(ended.result.elapsedSeconds).toBe(60);expect(ended.result.wpm).toBe(0);expect(ended.outdoor.aborted).toBe(false);expect(ended.profile.lesson).toBe(1);
});
test('host focus loss suspends motion/time, refocus resumes; result pointer activation',async({page})=>{
 await ready(page);await page.locator('#game').press('1');await page.waitForTimeout(200);
 await page.locator('#game').evaluate(c=>c.blur());await expect(page.locator('#game')).toHaveAttribute('data-suspended','true');
 const a=await page.evaluate(()=>translationSnapshot());await page.waitForTimeout(250);const b=await page.evaluate(()=>translationSnapshot());expect(b.ticks).toBe(a.ticks);expect(b.outdoor.x).toBe(a.outdoor.x);
 await page.locator('#game').focus();await expect(page.locator('#game')).toHaveAttribute('data-suspended','false');
 await page.locator('#game').press('Escape');await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 await point(page,157,184,false);await page.locator('#game').press('Enter');await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
});
