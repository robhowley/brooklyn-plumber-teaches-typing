import {test,expect} from '@playwright/test';
import {boot,custom,typeTargets,activate,enterActivity,fixture,stored} from './helpers.js';

for(const mode of ['outdoor','underwater','castle','practice'])test(`${mode}: keyboard pass, fail, retry and menu without custom advancement`,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await boot(page);
 await custom(page,mode);await typeTargets(page,12,{lowercase:mode==='outdoor'});
 await expect(page.locator('#correct')).toHaveText('12');
 await expect(page.locator('#finger')).toBeVisible();
 if(mode==='outdoor')await expect(page.locator('#finger')).not.toContainText('Shift');
 await page.screenshot({path:info.outputPath(`${mode}.png`),fullPage:true});
 await page.clock.runFor(3100);await expect(page.getByRole('heading',{name:'Goal reached',exact:true})).toBeVisible();
 await expect(page.locator('.result-metrics')).toContainText('3.00 seconds');
 await expect(page.locator('.result-metrics')).toContainText('timeout');
 await expect(page.locator('#next')).toBeDisabled();
 await expect(page.locator('#retry')).toBeFocused();await page.keyboard.press('Enter');
 await page.clock.runFor(3100);await expect(page.locator('#outcome')).toContainText('No keys were typed');
 await expect(page.locator('#next')).toBeDisabled();await activate(page,'#menu');
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');expect(await page.evaluate(()=>document.body.classList.contains('playing'))).toBe(false);
 const p=(await stored(page)).students[0];expect(p.course).toMatchObject({group:0,goal:5,pending:null});expect(p.results.map(r=>r.passed)).toEqual([true,false]);
 expect(errors).toEqual([]);
});

test('direct activity entry does not guide a mismatched student setting',async({page})=>{
 await boot(page,{data:fixture({duration:3,goal:5,group:1})});await enterActivity(page,'outdoor');await typeTargets(page,12);await page.clock.runFor(3100);
 const p=(await stored(page)).students[0];expect(p.results[0]).toMatchObject({guided:false,mode:'outdoor',group:1});
 expect(p.course).toMatchObject({group:0,goal:5,pending:null});await expect(page.locator('#next')).toBeDisabled();
});

test('guided first success survives failed retry and reload; explicit Next commits once and returns menu',async({page})=>{
 await boot(page,{data:fixture({group:0})});await enterActivity(page,'outdoor');
 await typeTargets(page,12);await page.clock.runFor(3100);await expect(page.locator('#next')).toBeEnabled();
 const firstResult=(await stored(page)).students[0].results[0];expect(firstResult.guided).toBe(true);
 const first=(await stored(page)).students[0].course.pending;
 expect(first.destination.group).toBe(1);await activate(page,'#retry');await page.clock.runFor(3100);
 await expect(page.locator('#outcome')).toContainText('Not passed');await expect(page.locator('#next')).toBeEnabled();
 expect((await stored(page)).students[0].course.pending).toEqual(first);
 await page.reload();await activate(page,'#skip-title');
 let course=(await stored(page)).students[0].course;expect(course.pending.destination).toMatchObject({group:1,goal:5});
 await page.keyboard.press('6');course=(await stored(page)).students[0].course;expect(course).toMatchObject({group:1,goal:5,revision:1,pending:null});
 await expect(page.locator('#next')).toBeDisabled();await expect(page.locator('#target')).toHaveCount(0);
 await page.keyboard.press('6');expect((await stored(page)).students[0].course).toEqual(course);await page.reload();await activate(page,'#skip-title');
 const p=(await stored(page)).students[0];expect(p.course.revision).toBe(1);expect(p.results).toHaveLength(2);expect(p.results[0].studentId).toBe(p.id);expect(p.results[0].courseRevision).toBe(0);
});

test('default-goal modes remain available while custom Castle stays off-course',async({page})=>{
 await boot(page,{data:fixture({goal:5})});
 await expect(page.locator('#activity-underwater')).toBeEnabled();await expect(page.locator('#activity-castle')).toBeEnabled();
 await custom(page,'castle');await expect(page.locator('#encounter-status')).toContainText('Browser practice');
 const p=(await stored(page)).students[0];expect(p.settings.goal).toBe(5);
 expect(p.course).toMatchObject({group:0,goal:5,pending:null});expect(p.results).toHaveLength(0);expect(p.certificates).toHaveLength(0);
});
