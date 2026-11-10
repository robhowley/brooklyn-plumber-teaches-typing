import {test,expect} from '@playwright/test';
import {boot,custom,typeTargets,activate,fixture,stored,openMenu} from './helpers.js';

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
 await expect(page.locator('#course-position')).toContainText('Home row · 5 WPM');
 const p=(await stored(page)).students[0];expect(p.results.map(r=>r.passed)).toEqual([true,false]);expect(p.course.pending).toBeNull();
 expect(errors).toEqual([]);
});

test('guided first success survives failed retry and reload; explicit Next commits once and returns menu',async({page})=>{
 await boot(page,{data:fixture({group:0})});await page.keyboard.press('1');await activate(page,'#original');
 await typeTargets(page,12);await page.clock.runFor(3100);await expect(page.locator('#next')).toBeEnabled();
 const first=(await stored(page)).students[0].course.pending;
 expect(first.destination.group).toBe(1);await activate(page,'#retry');await page.clock.runFor(3100);
 await expect(page.locator('#outcome')).toContainText('Not passed');await expect(page.locator('#next')).toBeEnabled();
 expect((await stored(page)).students[0].course.pending).toEqual(first);
 await page.reload();await page.keyboard.press('Enter');await expect(page.locator('#pending')).toContainText('Add top row');
 await page.keyboard.press('6');await expect(page.locator('#course-position')).toContainText('Add top row');
 await expect(page.locator('#next')).toBeDisabled();await expect(page.locator('#target')).toHaveCount(0);
 await page.keyboard.press('6');await page.reload();await page.keyboard.press('Enter');
 const p=(await stored(page)).students[0];expect(p.course.revision).toBe(1);expect(p.results).toHaveLength(2);expect(p.results[0].studentId).toBe(p.id);expect(p.results[0].courseRevision).toBe(0);
});

test('normal activity gates use editable student goal; custom bypass is explicit',async({page})=>{
 await boot(page,{data:fixture({goal:5})});await expect(page.locator('#activity-underwater')).toBeDisabled();await expect(page.locator('#activity-castle')).toBeDisabled();
 await openMenu(page,'Student');await activate(page,'#edit-student');await page.getByLabel('Activity goal').fill('10');await activate(page,'#student-form button.primary');
 await expect(page.locator('#activity-underwater')).toBeEnabled();await expect(page.locator('#activity-castle')).toBeDisabled();
 await openMenu(page,'Student');await activate(page,'#edit-student');await page.getByLabel('Activity goal').fill('30');await activate(page,'#student-form button.primary');
 await expect(page.locator('#activity-castle')).toBeEnabled();await custom(page,'castle');await expect(page.locator('#encounter-status')).toContainText('Browser practice');
});
