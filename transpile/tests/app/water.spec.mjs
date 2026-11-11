import {test,expect} from '@playwright/test';
const snap=page=>page.evaluate(()=>translationSnapshot());
async function ready(page,character=1,lesson=1,goal=10) {
 await page.clock.install();await page.goto('/?seed=1');await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
 await page.locator('#game').press('w');await page.locator('[name=name]').fill('Swimmer');
 await page.locator('[name=character]').selectOption(String(character));await page.locator('[name=goal]').fill(String(goal));
 await page.locator('[name=lesson]').selectOption(String(lesson));await page.locator('[name=waterMinutes]').fill('1');
 await page.locator('#setup button[type=submit]').click();await page.locator('#game').press('2');
 await expect(page.locator('#game')).toHaveAttribute('data-screen','water');
}
async function burst(page,codes) {await page.evaluate(codes=>{
 const canvas=document.querySelector('#game');for(const code of codes)canvas.dispatchEvent(new KeyboardEvent('keydown',{key:String.fromCharCode(code),bubbles:true}));
},codes);await page.clock.runFor(60);}
for(const character of [1,2,3]) test(`Water character${character}: real canvas, case, queued burst, bonus, F10, Next and persistence`,async({page})=>{
 const errors=[],bad=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
 await ready(page,character);let s=await snap(page);expect(s.limit).toBe(60);expect(s.profile.durations[1]).toBe(1);
 await burst(page,[s.water.window[10]^32]);s=await snap(page);expect(s.water.stats.errors).toBe(1);
 const codes=s.water.window.slice(10,18);await burst(page,codes);s=await snap(page);expect(s.water.stats.correct).toBe(8);expect(s.water.redrawCount).toBe(0);
 await page.screenshot({path:`transpile/reports/browser/water-${character}.png`});
 // Source player moves toward its WPM peak. Keep it fed until the bonus activates.
 for(let i=0;i<160&&s.water.bonus.mode!==2;i++) {
  await burst(page,s.water.window.slice(10,18));await page.clock.runFor(180);s=await snap(page);
 }
 expect(s.water.bonus.mode).toBe(2);
 await burst(page,[s.water.bonus.code]);s=await snap(page);expect(s.water.phase).toBe('bonus');
 const ticks=s.ticks,attempts=s.water.stats.attempts;
 await burst(page,[65,66,67]);await page.clock.runFor(1500);s=await snap(page);
 expect(s.ticks).toBe(ticks);expect(s.water.stats.attempts).toBe(attempts);
 await page.screenshot({path:`transpile/reports/browser/water-bonus-${character}.png`});
 await page.clock.runFor(5500);s=await snap(page);expect(s.water.movie).toBeNull();expect(s.water.stats.attempts).toBe(attempts);
 await page.locator('#game').press('F10');await page.clock.runFor(120);s=await snap(page);
 expect(s.screen).toBe('results');expect(s.water.aborted).toBe(true);expect(s.profile.lesson).toBe(1);
 const counter=s.water.swimmer.counter;await page.locator('#game').press('n');s=await snap(page);
 expect(s.screen).toBe('water');expect(s.water.swimmer.counter).toBe(counter);expect(s.water.stats.attempts).toBe(0);
 await page.locator('#focus').focus();const before=await snap(page);await page.clock.runFor(1000);expect((await snap(page)).ticks).toBe(before.ticks);
 await page.locator('#focus').click();await page.locator('#game').press('Escape');await page.clock.runFor(120);
 await page.reload();await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
 s=await snap(page);expect(s.profile.character).toBe(character);expect(s.profile.durations[1]).toBe(1);
 expect(errors).toEqual([]);expect(bad).toEqual([]);
});
test('Water inactivity resets on wrong/ignored input, strict >20 chases then sinks and Next reenters',async({page})=>{
 await ready(page);await page.clock.runFor(19000);await page.locator('#game').press('Tab');await page.clock.runFor(60);
 expect((await snap(page)).water.stats.attempts).toBe(0);
 await page.clock.runFor(19000);expect((await snap(page)).water.failed).toBe(false);
 await page.clock.runFor(2100);expect((await snap(page)).water.failed).toBe(true);
 await page.screenshot({path:'transpile/reports/browser/water-failure.png'});
 await page.clock.runFor(15000);let s=await snap(page);expect(s.screen).toBe('results');expect(s.profile.lesson).toBe(1);
 await page.locator('#game').press('n');s=await snap(page);expect(s.screen).toBe('water');expect(s.water.failed).toBe(false);
});
test('Water normal timeout advances once, Next retains group; Castle remains unavailable',async({page})=>{
 await ready(page);let s=await snap(page);
 // At least60 net correct in one minute reaches goal10. Remaining input is
 // ignored but resets inactivity, avoiding failure while the real clock runs.
 for(let i=0;i<8;i++){await burst(page,s.water.window.slice(10,18));s=await snap(page);}
 for(let i=0;i<4;i++){await page.clock.runFor(15000);await page.locator('#game').press('Tab');await page.clock.runFor(60);}
 s=await snap(page);expect(s.screen).toBe('results');expect(s.water.timedOut).toBe(true);expect(s.water.failed).toBe(false);expect(s.profile.lesson).toBe(2);
 await page.locator('#game').press('n');expect((await snap(page)).profile.lesson).toBe(2);expect((await snap(page)).screen).toBe('water');
 await page.locator('#game').press('Escape');await page.clock.runFor(120);await page.locator('#game').press('m');
 await page.locator('#game').press('3');await expect(page.locator('#status')).toContainText('Castle is disabled');
});
