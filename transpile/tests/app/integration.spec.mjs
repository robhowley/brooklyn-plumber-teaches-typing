import { test, expect } from '@playwright/test';
import {skipStartupUI} from './source-path.mjs';
async function ready(page){await page.addInitScript(()=>{window.__sourceTestClock=true;});await page.goto('/?seed=1');await skipStartupUI(page);await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');}
async function point(page,x,y){const r=await page.locator('#game').boundingBox();await page.mouse.click(r.x+x*r.width/320,r.y+y*r.height/200);}
const snapshot=page=>page.evaluate(()=>translationSnapshot());
test('Practice original menu hit, case, ignored keys, exact line change, face and early Next',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await ready(page);
 await page.locator('#game').press('w');await page.locator('[name=name]').fill('Practice');await page.locator('[name=goal]').fill('10');
 await page.locator('[name=practiceMinutes]').fill('1');await page.locator('#setup button[type=submit]').click();
 await point(page,250,116);await expect(page.locator('#game')).toHaveAttribute('data-screen','practice');
 let s=await snapshot(page);expect(s.corpusName).toBe('HWORDS');expect(s.practice.expression).toBe(0);expect(s.limit).toBe(60);
 const first=s.practice.rows[33];expect(first).toBeGreaterThanOrEqual(97);
 await page.locator('#game').press(String.fromCharCode(first).toUpperCase());await page.clock.runFor(60);
 s=await snapshot(page);expect(s.practice.errors).toBe(1);expect(s.practice.index).toBe(0);
 for(const key of ['Backspace','F10']){await page.locator('#game').press(key);await page.clock.runFor(60);}
 expect((await snapshot(page)).practice.attempts).toBe(1);
 await page.locator('#game').press(String.fromCharCode(first));await page.clock.runFor(60);
 expect((await snapshot(page)).practice.correct).toBe(1);expect((await snapshot(page)).practice.expression).not.toBe(0);
 s=await snapshot(page);const next=s.practice.rows.slice(66,99);
 while(s.practice.rows[33+s.practice.index]){
  await page.locator('#game').press(String.fromCharCode(s.practice.rows[33+s.practice.index]));await page.clock.runFor(60);s=await snapshot(page);
 }
 await page.locator('#game').press('Enter');await page.clock.runFor(60);s=await snapshot(page);
 expect(s.practice.index).toBe(0);expect(s.practice.rows.slice(33,66)).toEqual(next);
 await page.screenshot({path:'transpile/reports/browser/practice.png'});
 await page.clock.runFor(16000);expect((await snapshot(page)).practice.expression).toBe(0);expect((await snapshot(page)).screen).toBe('practice');
 await page.locator('#game').press('Escape');await page.clock.runFor(60);await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 expect((await snapshot(page)).profile.lesson).toBe(1);
 await point(page,78,184);await expect(page.locator('#game')).toHaveAttribute('data-screen','practice');
 expect((await snapshot(page)).profile.mode).toBe(4);expect(errors).toEqual([]);
});
test('Practice focus pause excludes time; duration ends with zero accuracy and no invented failure',async({page})=>{
 await page.clock.install();await ready(page);await page.locator('#game').press('w');await page.locator('[name=name]').fill('Timer');
 await page.locator('[name=practiceMinutes]').fill('1');await page.locator('#setup button[type=submit]').click();await page.locator('#game').press('4');
 await page.clock.runFor(10000);await page.locator('#focus').focus();
 const before=await snapshot(page);await page.clock.runFor(90000);expect((await snapshot(page)).ticks).toBe(before.ticks);
 await page.locator('#focus').click();await page.clock.runFor(51000);
 await expect(page.locator('#game')).toHaveAttribute('data-screen','results');const s=await snapshot(page);
 expect(s.result.elapsedSeconds).toBe(60);expect(s.practice.aborted).toBe(false);expect(s.result.wpm).toBe(0);expect(s.profile.lesson).toBe(1);
});
test('outside naturally activates bonus and BAN/ANI playback freezes mechanics and statistics',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await ready(page);await page.locator('#game').press('1');
 let s=await snapshot(page);
 for(let i=0;i<200&&s.bonus.mode!==2;i++){await page.clock.runFor(60);s=await snapshot(page);}
 expect(s.bonus.mode).toBe(2);await page.locator('#game').press(String.fromCharCode(s.bonus.code));await page.clock.runFor(60);
 s=await snapshot(page);expect(s.cinematic).not.toBeNull();const ticks=s.ticks,x=s.outdoor.x;
 await page.screenshot({path:'transpile/reports/browser/bonus.png'});
 await page.locator('#game').press('a');await page.clock.runFor(2000);s=await snapshot(page);
 expect(s.cinematic.frame).toBeGreaterThan(0);expect(s.ticks).toBe(ticks);expect(s.outdoor.x).toBe(x);expect(s.outdoor.attempts).toBe(0);
 await page.clock.runFor(5000);expect((await snapshot(page)).cinematic).toBeNull();expect((await snapshot(page)).ticks).toBeGreaterThan(ticks);
 expect(errors).toEqual([]);
});
test('Outside to Practice to Outside keeps source counters and clock with fresh entry state',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await ready(page);await page.locator('#game').press('1');
 await page.clock.runFor(180);await page.locator('#game').press('Escape');await page.clock.runFor(60);
 const old=await snapshot(page);expect(old.screen).toBe('results');
 const fields=['cursorCounter','groundPhase','stillTicks','idleTicks','distance'];
 await page.locator('#game').press('n');let s=await snapshot(page);
 expect(fields.map(k=>s.outdoor[k])).toEqual(fields.map(k=>old.outdoor[k]));
 expect(s.bonus.lastSecond).toBe(old.bonus.lastSecond);expect(s.outdoor.x).toBe(20);
 await page.locator('#game').press('Escape');await page.clock.runFor(60);
 const retained=await snapshot(page);
 await page.locator('#game').press('m');await page.locator('#game').press('4');
 s=await snapshot(page);await page.locator('#game').press(String.fromCharCode(s.practice.rows[33]));await page.clock.runFor(60);
 await page.locator('#game').press('Escape');await page.clock.runFor(60);
 const practice=await snapshot(page);
 await page.locator('#game').press('m');await page.clock.runFor(300);await page.locator('#game').press('1');s=await snapshot(page);
 expect(fields.map(k=>s.outdoor[k])).toEqual(fields.map(k=>retained.outdoor[k]));
 expect(s.bonus.lastSecond).toBe(retained.bonus.lastSecond);
 expect(s.outdoor.attempts).toBe(0);expect(s.outdoor.scroll).toBe(1);
 await page.locator('#game').press('Escape');await page.clock.runFor(60);
 await page.locator('#game').press('m');await page.locator('#game').press('4');
 expect((await snapshot(page)).practice.lastCorrect).toBe(practice.practice.lastCorrect);
 expect(errors).toEqual([]);
});
test('guest mode, profile gating and unavailable assets/storage are visible',async({page})=>{
 await page.clock.install();await ready(page);expect((await snapshot(page)).profile.profilePresent).toBe(false);
 await page.locator('#game').press('4');await page.locator('#game').press('Escape');await page.clock.runFor(60);await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 expect(await page.evaluate(()=>localStorage.getItem('mtt-static-translation.students.v1'))).toBeNull();
 await page.locator('#game').press('m');await page.locator('#game').press('w');await page.locator('[name=name]').fill('Gate');
 await page.locator('#setup button[type=submit]').click();await page.locator('#game').press('2');await expect(page.locator('#status')).toContainText('requires goal 10');
 await page.addInitScript(()=>{Storage.prototype.getItem=function(){throw new Error('test storage blocked');};});
 await page.reload();await skipStartupUI(page);await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');await expect(page.locator('#status')).toContainText('Storage unavailable');
 await page.locator('#game').press('4');await expect(page.locator('#status')).toContainText('Storage unavailable');
 await page.route('**/assets/app/MOUT.backgrounds.indices',route=>route.fulfill({status:404,body:'missing'}));
 await page.reload();await expect(page.locator('#status')).toContainText('Missing bonus frames');
});
