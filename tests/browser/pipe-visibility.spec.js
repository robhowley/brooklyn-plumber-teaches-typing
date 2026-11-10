import {test,expect} from '@playwright/test';
import {boot,custom,typeTargets,activate,fixture} from './helpers.js';

test('real castle typing enters a pipe, freezes time and pixels, and resumes the next chamber',async({page},info)=>{
 await boot(page,{motion:'no-preference',data:fixture({duration:60})});await custom(page,'castle');await typeTargets(page,40,{resumePipe:false});
 await expect(page.locator('#pause-reason')).toContainText('pipe');await expect(page.locator('#correct')).toHaveText('40');await expect(page.locator('#resume')).toBeFocused();
 const frozen=await page.locator('#scene').evaluate(c=>c.toDataURL()),time=await page.locator('#time').textContent();await page.clock.runFor(60000);await page.keyboard.press('a');
 expect(await page.locator('#scene').evaluate(c=>c.toDataURL())).toBe(frozen);await expect(page.locator('#time')).toHaveText(time);await expect(page.locator('#correct')).toHaveText('40');
 await page.screenshot({path:info.outputPath('pipe-pause.png'),fullPage:true});await activate(page,'#resume');await page.clock.runFor(100);
 expect(await page.locator('#scene').evaluate(c=>c.toDataURL())).not.toBe(frozen);await expect(page.locator('#pause-panel')).toBeHidden();
});
