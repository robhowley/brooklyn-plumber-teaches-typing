import {test,expect} from '@playwright/test';
import {skipStartupUI,finishCelebrationUI} from './source-path.mjs';
const snap=page=>page.evaluate(()=>translationSnapshot());
async function ready(page,char=1,minutes=60,lesson=1) {
 await page.clock.install();await page.addInitScript(()=>{window.__sourceTestClock=true;});await page.goto('./?seed=1');await skipStartupUI(page);await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
 await page.locator('#game').press('w');await page.locator('[name=name]').fill('Climber');
 await page.locator('[name=character]').selectOption(String(char));await page.locator('[name=goal]').fill('30');
 await page.locator('[name=lesson]').selectOption(String(lesson));await page.locator('[name=castleMinutes]').fill(String(minutes));
 await page.locator('#setup button[type=submit]').click();await page.locator('#game').press('3');
 await expect(page.locator('#game')).toHaveAttribute('data-screen','castle');
}
async function key(page,code) {
 if(code)await page.evaluate(code=>document.querySelector('#game').dispatchEvent(new KeyboardEvent('keydown',{key:String.fromCharCode(code),bubbles:true})),code);
 await page.clock.runFor(56);
 // Wait for source dispatch, not a fixed host interval that may resample the same low word.
 for(let i=0;i<4;i++) {const s=await snap(page);if(!s.inputPending||s.castle.movie)break;await page.clock.runFor(56);}
}
async function drive(page,predicate,{bonus=false,limit=12000}={}) {
 let s=await snap(page),seenBonus=false;
 for(let i=0;!predicate(s);i++) {
  expect(i,`${s.castle.phase}:${s.castle.cycle}`).toBeLessThan(limit);
  if(bonus&&!seenBonus&&s.castle.bonus.mode===2&&!s.castle.locked&&['rockfaces','sand'].includes(s.castle.phase)) {
   await key(page,s.castle.bonus.code);s=await snap(page);
   // A sampled operation can still be waiting on the same low tick.
   if(!s.castle.movie) {await page.clock.runFor(60);s=await snap(page);}
   expect(s.castle.movie).not.toBeNull();const ticks=s.ticks,attempts=s.castle.stats.attempts;
   await key(page,65);await page.clock.runFor(1500);s=await snap(page);
   expect(s.ticks).toBe(ticks);expect(s.castle.stats.attempts).toBe(attempts);
   await page.clock.runFor(4700);seenBonus=true;
  } else await key(page,!s.castle.locked&&['rockfaces','sand'].includes(s.castle.phase)?s.castle.target:0);
  s=await snap(page);
 }
 return {s,seenBonus};
}
for(const char of [1,2,3])test(`Castle character${char}: actual source-key two-cycle loop, bonus, abort, Next and reentry`,async({page})=>{
 test.setTimeout(180000);const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/\.(?:exe|com|zip|data)(?:$|\?)/i.test(r.url())||/\/src\/|\/raw\//.test(r.url()))requests.push(r.url());});
 await ready(page,char);let s=await snap(page);expect(s.profile.durations[2]).toBe(60);expect(s.limit).toBe(3600);
 const result=await drive(page,s=>s.castle.cycle===2&&s.castle.phase==='rockfaces',{bonus:true});s=result.s;
 expect(result.seenBonus).toBe(true);expect(s.castle.stats.correct).toBeGreaterThan(100);expect(s.castle.stats.errors).toBe(0);
 expect(s.castle.flags).toEqual({failed:false,timeout:false,exit:false});
 await page.screenshot({path:`reports/browser/castle-repeat-${char}.png`});
 await page.locator('#game').press('Escape');await page.clock.runFor(120);s=await snap(page);
 expect(s.screen).toBe('results');expect(s.castle.flags.exit).toBe(true);expect(s.profile.lesson).toBe(1);
 await page.locator('#game').press('n');s=await snap(page);expect(s.screen).toBe('castle');expect(s.castle.stats.attempts).toBe(0);
 expect(s.profile.character).toBe(char);await page.clock.runFor(120);await page.waitForFunction(()=>!translationSnapshot().audioHost.blocking);await page.locator('#game').press('Escape');await page.clock.runFor(120);
 await page.locator('#game').press('m');
 for(const mode of ['1','2','3','4','3']) {
  await page.clock.runFor(300);await page.locator('#game').press(mode);await page.clock.runFor(300);
  expect((await snap(page)).screen).toBe(({1:'outdoor',2:'water',3:'castle',4:'practice'})[mode]);
  await page.locator('#game').press('Escape');await page.clock.runFor(180);
  expect((await snap(page)).screen).toBe('results');await page.locator('#game').press('m');
 }
 expect(errors).toEqual([]);expect(requests).toEqual([]);
});
test('Castle actual inactivity failure retains separate flags and Next resets scene',async({page})=>{
 await ready(page);await page.clock.runFor(22000);let s=await snap(page);expect(s.castle.flags.failed).toBe(true);
 await page.clock.runFor(18000);s=await snap(page);expect(s.screen).toBe('results');
 expect(s.castle.flags.exit).toBe(false);expect(s.castle.flags.timeout).toBe(false);expect(s.profile.lesson).toBe(1);
 await page.locator('#game').press('n');s=await snap(page);expect(s.screen).toBe('castle');expect(s.castle.flags.failed).toBe(false);
});
test('Castle actual timeout, repeating source ending, progression and results Next',async({page})=>{
 test.setTimeout(120000);await ready(page,1,1,6);let s=await snap(page);
 // Real source-word input, never mutate controller stats/flags or skip scenes.
 ({s}=await drive(page,s=>s.castle.stats.correct>=240));
 for(let i=0;i<5&&s.screen==='castle';i++) {
  await page.locator('#game').press('Tab');await page.clock.runFor(14000);s=await snap(page);
 }
 expect(s.screen).toBe('celebration');expect(s.profile.completed[2]).toBe(0);
 await page.clock.runFor(11000);expect((await snap(page)).screen).toBe('celebration');
 await finishCelebrationUI(page);s=await snap(page);
 expect(s.screen).toBe('results');expect(s.castle.flags.timeout).toBe(true);expect(s.castle.flags.failed).toBe(false);
 expect(s.profile.lesson).toBe(6);expect(s.profile.goal).toBeGreaterThanOrEqual(45);expect(s.profile.completed[2]).toBe(1);expect(s.castle.ending).toBeNull();expect(s.castle.endingAck).toEqual({type:'ending-acknowledged',omitted:false});
 await page.locator('#game').press('n');s=await snap(page);expect(s.screen).toBe('castle');expect(s.profile.lesson).toBe(6);
});
