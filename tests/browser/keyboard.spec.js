import {test,expect} from '@playwright/test';
import {boot,activate,openMenu,enterActivity,stored,selectedStudent} from './helpers.js';

test('keyboard navigation, student slots, settings and selected student survive reload',async({page})=>{
 await boot(page);await openMenu(page,'Student');await page.locator('#new-student').click();
 await expect(page.getByLabel('Name',{exact:true})).toBeFocused();await page.keyboard.type('Student 123456');
 await expect(page.getByRole('heading',{name:'New student',exact:true})).toBeVisible();
 await page.getByLabel('Character').selectOption('Princess');await page.getByLabel('Activity goal').fill('12');await page.getByLabel('Synthetic sound').check();
 await activate(page,'#student-done');expect(await selectedStudent(page)).toMatchObject({name:'Student 123456',character:'Princess'});
 await openMenu(page,'Student');await page.locator('#times').click();
 for(const [mode,minutes] of [['outdoor','2'],['underwater','5'],['castle','5'],['practice','10']])await expect(page.locator(`[name="${mode}-minutes"]`)).toHaveValue(minutes);
 await page.locator('[name=outdoor-seconds]').fill('7');await page.locator('[name=underwater-minutes]').fill('2');await expect(page.locator('[name=underwater-seconds]')).toHaveValue('');
 await activate(page,'#times-form button.primary');await page.reload();await activate(page,'#skip-title');
 expect((await selectedStudent(page)).name).toBe('Student 123456');
 let data=await stored(page),p=data.students.find(p=>p.id===data.currentStudentId);expect(p.settings.durations.outdoor).toBe(7);expect(p.settings.durations.underwater).toBe(120);expect(p.settings.sound).toBe(true);
 await openMenu(page,'Student');await page.locator('#times').click();
 await expect(page.locator('[name=underwater-minutes]')).toHaveValue('2');await expect(page.locator('[name=underwater-seconds]')).toHaveValue('120');await expect(page.locator('[name=outdoor-seconds]')).toHaveValue('7');
 await activate(page,'#times-form button.primary');await openMenu(page,'Student');await page.locator('#times').click();await expect(page.locator('[name=outdoor-seconds]')).toHaveValue('7');await expect(page.locator('[name=underwater-minutes]')).toHaveValue('2');await activate(page,'#back');
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');await expect(page.locator('#times')).toBeFocused();await expect(page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Student$/})})).toHaveAttribute('open','');
 await openMenu(page,'Student');await page.locator('#edit-student').click();await page.getByLabel('Name',{exact:true}).fill('Renamed');await activate(page,'#student-done');
 await openMenu(page,'Student');await page.locator('#load-student').click();await page.getByLabel('Saved local students').selectOption(data.students[0].id);await activate(page,'#load-form button.primary');
 expect((await selectedStudent(page)).name).toBe('Ada');await page.reload();await activate(page,'#skip-title');expect((await selectedStudent(page)).name).toBe('Ada');
 data=await stored(page);expect(data.students).toHaveLength(2);expect(data.students[1].name).toBe('Renamed');expect(data.students[1].settings.goal).toBe(12);
});

test('help returns focus and gameplay pause traps keyboard without changing clocks',async({page})=>{
 await boot(page);await openMenu(page,'File');await activate(page,'#keyboard');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original KEYBOARD background');await activate(page,'#back');await expect(page.locator('#keyboard')).toBeFocused();
 await page.keyboard.press('Escape');await enterActivity(page,'outdoor');await page.keyboard.press('Escape');await expect(page.locator('#resume')).toBeFocused();
 const time=await page.locator('#time').textContent();await page.clock.runFor(60000);await page.keyboard.press('a');await expect(page.locator('#time')).toHaveText(time);await expect(page.locator('#correct')).toHaveText('0');
 await page.keyboard.press('Shift+Tab');await expect(page.locator('#leave')).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator('#resume')).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#pause-panel')).toBeHidden();
 await page.keyboard.press('Escape');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');await expect(page.locator('#activity-outdoor')).toBeFocused();expect(await page.evaluate(()=>document.body.classList.contains('playing'))).toBe(false);
});
