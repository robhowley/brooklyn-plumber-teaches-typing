import {test,expect} from '@playwright/test';
async function start(page,mode='outdoor',duration='60'){
 await page.goto('/');await page.getByLabel('Lesson path').selectOption('custom');await page.getByLabel('Activity').selectOption(mode);
 await page.getByLabel('Keyboard lesson').selectOption('0');await page.getByLabel('Time · seconds').fill(duration);
 await page.getByRole('button',{name:'Start lesson',exact:true}).click();
}
test('normal clock: guided outdoor pass at 20 seconds unlocks Next and survives reload',async({page})=>{
 test.setTimeout(35000);
 await page.goto('/');await page.getByLabel('Time · seconds').fill('20');
 await page.getByRole('button',{name:'Start lesson',exact:true}).click();
 for(let i=0;i<10;i++){
  await pressTarget(page);
  await expect(page.locator('#correct')).toHaveText(String(i+1),{timeout:6000});
 }
 await expect(page.getByRole('heading',{name:'A star performance!'})).toBeVisible({timeout:7000});
 await expect(page.locator('.blackboard')).toContainText('6.0');
 await expect(page.locator('#next')).toBeEnabled();
 await page.reload();await expect(page.locator('#next')).toBeEnabled();
 await page.locator('#next').click();await expect(page.locator('#course-position')).toContainText('Add top row');
 await page.reload();await expect(page.locator('#course-position')).toContainText('Add top row');
 await expect(page.locator('#next')).toBeDisabled();
});
const picture=page=>page.locator('#scene').evaluate(c=>c.toDataURL());
async function pressTarget(page){const key=await page.locator('#target').textContent();await page.keyboard.press(key==='␣'?'Space':key);}
test('normal clock: running approach without input, on-time action, early buffer and wrong retention',async({page})=>{
 await start(page);const first=await page.locator('#target').textContent(),before=await picture(page);
 await page.waitForTimeout(1100);expect(await picture(page)).not.toBe(before);await expect(page.locator('#correct')).toHaveText('0');await expect(page.locator('#target')).toHaveText(first);
 await page.keyboard.press('z');await expect(page.locator('#errors')).toHaveText('1');await expect(page.locator('#target')).toHaveText(first);
 await page.waitForTimeout(3350);await pressTarget(page);await expect(page.locator('#correct')).toHaveText('1');
 const next=await page.locator('#target').textContent();await pressTarget(page);await expect(page.locator('#encounter-status')).toContainText('Key held');await expect(page.locator('#target')).toHaveText(next);
 await expect(page.locator('#correct')).toHaveText('2',{timeout:2500});await expect(page.locator('#errors')).toHaveText('1');
});
test('normal clock: no-input passage and late key recover on repeated encounter, without a penalty',async({page})=>{
 await start(page);const first=await page.locator('#target').textContent();await page.waitForTimeout(6000);
 await expect(page.locator('#encounter-status')).toContainText('Missed');await expect(page.locator('#target')).toHaveText(first);await expect(page.locator('#errors')).toHaveText('0');
 await pressTarget(page);await expect(page.locator('#correct')).toHaveText('0');await expect(page.locator('#encounter-status')).toContainText('Key held');
 await expect(page.locator('#correct')).toHaveText('1',{timeout:10000});await expect(page.locator('#errors')).toHaveText('0');
});
test('normal clock: all action worlds travel, Escape/hidden/blur freeze pixels and time, resume has no wall-time jump',async({page})=>{
 for(const mode of ['outdoor','underwater','castle']){
 await start(page,mode);const before=await picture(page);await page.waitForTimeout(600);expect(await picture(page)).not.toBe(before);
 await page.keyboard.press('Escape');const frozen=await picture(page),time=await page.locator('#time').textContent();await page.waitForTimeout(1100);
 expect(await picture(page)).toBe(frozen);await expect(page.locator('#time')).toHaveText(time);await page.getByRole('button',{name:'Resume lesson'}).click();await page.waitForTimeout(100);
 await expect(page.locator('#time')).toHaveText(time);expect(await picture(page)).not.toBe(frozen);
 for(const cause of ['blur','hidden']){
 await page.evaluate(c=>{if(c==='blur')window.dispatchEvent(new Event('blur'));else{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}},cause);
 const still=await picture(page);await page.waitForTimeout(350);expect(await picture(page)).toBe(still);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});});await page.getByRole('button',{name:'Resume lesson'}).click();
 }
 }
});
test('normal clock: 40-correct pipe freezes travel until resume; reduced motion has no automatic travel',async({page})=>{
 await start(page,'castle');for(let i=0;i<40;i++)await pressTarget(page);
 await expect(page.locator('#pause-reason')).toContainText('pipe');const frozen=await picture(page),time=await page.locator('#time').textContent();await page.waitForTimeout(1100);
 expect(await picture(page)).toBe(frozen);await expect(page.locator('#time')).toHaveText(time);await page.getByRole('button',{name:'Resume lesson'}).click();await page.waitForTimeout(100);expect((await picture(page))!==frozen).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});await start(page);const still=await picture(page);await page.waitForTimeout(1200);expect(await picture(page)).toBe(still);
 await pressTarget(page);await expect(page.locator('#correct')).toHaveText('1');await expect(page.locator('#encounter-status')).toContainText('motion reduced');
});
