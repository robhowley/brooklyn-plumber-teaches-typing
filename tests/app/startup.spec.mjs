import {test,expect} from '@playwright/test';
import {skipStartupUI,createStudentUI} from './source-path.mjs';
const snap=page=>page.evaluate(()=>translationSnapshot());
async function open(page) {
 await page.clock.install();await page.addInitScript(()=>{window.__sourceTestClock=true;});await page.goto('./?seed=1');
 await expect(page.locator('#game')).toHaveAttribute('data-screen','startup');
}
test('natural startup retains59 palette writes,13 RNG draws, then menu idle text rather than gameplay',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 expect((await snap(page)).seed).toBe(1);
 await page.clock.runFor(16020);let s=await snap(page);
 expect(s.startup.done).toBe(true);expect(s.paletteWrites).toBe(59);expect(s.screen).toBe('menu');expect(s.ticks).toBe(0);
 await page.clock.runFor(10000);s=await snap(page);expect(s.screen).toBe('menu');expect(s.menuIdle).not.toBeNull();
 expect(s.operations.map(o=>o.text)).toHaveLength(6);expect(s.audio.some(e=>e.status==='omitted'&&e.outcomes.some(o=>o.status==='locked'))).toBe(true);expect(errors).toEqual([]);
});
test('separate source skips reach menu without a leaked lesson key and focus does not credit missed waits',async({page})=>{
 await open(page);await page.locator('#game').press('Space');await page.clock.runFor(60);
 await page.locator('#game').evaluate(c=>c.blur());const before=await snap(page);await page.clock.runFor(10000);expect((await snap(page)).startup).toEqual(before.startup);
 await page.locator('#game').focus();await skipStartupUI(page);let s=await snap(page);expect(s.screen).toBe('menu');expect(s.outdoor).toBeNull();expect(s.paletteWrites).toBe(59);
 await page.locator('#game').press('4');await page.clock.runFor(300);s=await snap(page);expect(s.screen).toBe('practice');expect(s.practice.attempts).toBe(0);
});
for(const character of [1,2,3])test(`character${character} explicit Demo uses all4 world pollers and returns unsaved`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await skipStartupUI(page);
 await createStudentUI(page,{name:'DEMOBASE',goal:30,character});
 const saved=await page.evaluate(()=>localStorage.getItem('mtt-static-translation.students.v1'));
 for(const mode of [1,2,3,4]) {
  await page.clock.runFor(300);await page.locator('#game').press('d');await page.clock.runFor(300);expect((await snap(page)).profile.demo).toBe(true);
  await page.locator('#game').press(String(mode));await page.clock.runFor(4000);let s=await snap(page);
  expect(s.demo.mode).toBe(mode);expect(s.profile.profilePresent).toBe(false);
  const activity=mode===1?s.outdoor:mode===2?s.water.stats:mode===3?s.castle.stats:s.practice;expect(activity.correct).toBeGreaterThan(0);
  for(let i=0;i<10&&(await snap(page)).screen!=='menu';i++) {await page.locator('#game').press('Escape');await page.clock.runFor(180);}
  s=await snap(page);expect(s.screen).toBe('menu');expect(s.profile.demo).toBe(false);expect(s.profile.character).toBe(character);
  expect(await page.evaluate(()=>localStorage.getItem('mtt-static-translation.students.v1'))).toBe(saved);
 }
 expect(errors).toEqual([]);
});
