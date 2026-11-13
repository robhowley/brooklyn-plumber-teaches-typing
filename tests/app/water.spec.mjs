import {test,expect} from '@playwright/test';
import {skipStartupUI,finishCelebrationUI,createStudentUI} from './source-path.mjs';
const snap=page=>page.evaluate(()=>translationSnapshot());
async function ready(page,character=1,lesson=1,goal=10,{paused=false}={}) {
 await page.clock.install();
 if(paused)await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 await page.addInitScript(()=>{window.__sourceTestClock=true;});await page.goto('./?seed=1');await skipStartupUI(page);await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
 await createStudentUI(page,{name:'SWIMMER',character,goal,lesson,durations:[undefined,1]});await page.locator('#game').press('2');
 await expect(page.locator('#game')).toHaveAttribute('data-screen','water');
}
async function burst(page,codes) {await page.evaluate(codes=>{
 const canvas=document.querySelector('#game');for(const code of codes)canvas.dispatchEvent(new KeyboardEvent('keydown',{key:String.fromCharCode(code),bubbles:true}));
},codes);await page.clock.runFor(60);
 // A host callback can resample the same BIOS tick. Wait for source dispatch
 // before the caller reads stats or targets; bonus movies retain input until exit.
 const s=await snap(page);
 if(s.inputPending&&!s.water.movie) {
  await page.clock.runFor(60);expect((await snap(page)).inputPending).toBe(false);
 }
}
test('Water burst drains input after a callback samples the same BIOS tick',async({page})=>{
 await ready(page,1,1,10,{paused:true});
 // Rephase the host interval at 5000 ms. Its next two callbacks both sample
 // BIOS tick 92 (5054.945... and 5109.890... ms, floored after conversion).
 await page.clock.fastForward(5000-await page.evaluate(()=>performance.now()));
 await page.clock.runFor(80);
 const s=await snap(page);expect(s.water.phase).toBe('wait');expect(s.inputPending).toBe(false);
 await burst(page,[s.water.window[10]^32]);
 const after=await snap(page);expect(after.inputPending).toBe(false);expect(after.water.stats.errors).toBe(1);
});
for(const character of [1,2,3]) test(`Water character${character}: real canvas, case, queued burst, bonus, F10, Next and persistence`,async({page})=>{
 const errors=[],bad=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
 await ready(page,character);let s=await snap(page);expect(s.limit).toBe(60);expect(s.profile.durations[1]).toBe(1);
 await burst(page,[s.water.window[10]^32]);s=await snap(page);expect(s.water.stats.errors).toBe(1);
 const codes=s.water.window.slice(10,18);await burst(page,codes);s=await snap(page);expect(s.water.stats.correct).toBe(8);expect(s.water.redrawCount).toBe(0);
 await page.screenshot({path:`reports/browser/water-${character}.png`});
 // Source player moves toward its WPM peak. Keep it fed until the bonus activates.
 for(let i=0;i<160&&s.water.bonus.mode!==2;i++) {
  await burst(page,s.water.window.slice(10,18));await page.clock.runFor(180);s=await snap(page);
 }
 expect(s.water.bonus.mode).toBe(2);
 await burst(page,[s.water.bonus.code]);s=await snap(page);expect(s.water.phase).toBe('bonus');
 const ticks=s.ticks,attempts=s.water.stats.attempts;
 await burst(page,[65,66,67]);await page.clock.runFor(1500);s=await snap(page);
 expect(s.ticks).toBe(ticks);expect(s.water.stats.attempts).toBe(attempts);
 await page.screenshot({path:`reports/browser/water-bonus-${character}.png`});
 await page.clock.runFor(5500);s=await snap(page);expect(s.water.movie).toBeNull();expect(s.water.stats.attempts).toBe(attempts);
 await page.locator('#game').press('F10');await page.clock.runFor(120);s=await snap(page);
 expect(s.screen).toBe('results');expect(s.water.aborted).toBe(true);expect(s.profile.lesson).toBe(1);
 // Freeze host time before comparing retained state across the synchronous Next input.
 // Otherwise real wall time can run swimmer callbacks between these two snapshots.
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 s=await snap(page);const counter=s.water.swimmer.counter;await page.locator('#game').press('n');s=await snap(page);
 expect(s.screen).toBe('water');expect(s.water.swimmer.counter).toBe(counter);expect(s.water.stats.attempts).toBe(0);
 await page.locator('#game').evaluate(c=>c.blur());const before=await snap(page);await page.clock.runFor(1000);expect((await snap(page)).ticks).toBe(before.ticks);
 await page.locator('#game').focus();await page.locator('#game').press('Escape');await page.clock.runFor(120);
 await page.reload();await skipStartupUI(page);await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
 s=await snap(page);expect(s.profile.character).toBe(character);expect(s.profile.durations[1]).toBe(1);
 expect(errors).toEqual([]);expect(bad).toEqual([]);
});
test('Water inactivity resets on wrong/ignored input, strict >20 chases then sinks and Next reenters',async({page})=>{
 await ready(page);await page.clock.runFor(19000);await page.locator('#game').press('Tab');await page.clock.runFor(60);
 expect((await snap(page)).water.stats.attempts).toBe(0);
 await page.clock.runFor(19000);expect((await snap(page)).water.failed).toBe(false);
 await page.clock.runFor(2100);expect((await snap(page)).water.failed).toBe(true);
 await page.screenshot({path:'reports/browser/water-failure.png'});
 await page.clock.runFor(15000);let s=await snap(page);expect(s.screen).toBe('results');expect(s.profile.lesson).toBe(1);
 await page.locator('#game').press('n');s=await snap(page);expect(s.screen).toBe('water');expect(s.water.failed).toBe(false);
});
test('Water normal timeout advances once, Next retains group; Castle is selectable below goal 30',async({page})=>{
 await ready(page);let s=await snap(page);
 // At least60 net correct in one minute reaches goal10. Remaining input is
 // ignored but resets inactivity, avoiding failure while the real clock runs.
 for(let i=0;i<8;i++) {
  await burst(page,s.water.window.slice(10,18));s=await snap(page);
  expect(s.inputPending).toBe(false);expect(s.water.stats.correct).toBe((i+1)*8);expect(s.water.stats.errors).toBe(0);
 }
 for(let i=0;i<4;i++){await page.clock.runFor(15000);await page.locator('#game').press('Tab');await page.clock.runFor(60);}
 s=await snap(page);expect(s.water.stats.wpm).toBeGreaterThanOrEqual(s.profile.goal);expect(s.screen).toBe('celebration');
 await page.locator('#game').press('Escape');await page.clock.runFor(120);expect((await snap(page)).screen).toBe('celebration');
 await finishCelebrationUI(page);s=await snap(page);
 expect(s.screen).toBe('results');expect(s.water.timedOut).toBe(true);expect(s.water.failed).toBe(false);expect(s.profile.lesson).toBe(2);
 await page.locator('#game').press('n');expect((await snap(page)).profile.lesson).toBe(2);expect((await snap(page)).screen).toBe('water');
 await page.locator('#game').press('Escape');await page.clock.runFor(120);await page.locator('#game').press('m');
 await page.clock.runFor(300);await page.locator('#game').press('3');await page.clock.runFor(300);expect((await snap(page)).screen).toBe('castle');expect((await snap(page)).profile.goal).toBeLessThan(30);
});
