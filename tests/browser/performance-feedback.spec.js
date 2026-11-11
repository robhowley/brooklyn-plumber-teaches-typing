import {test,expect} from '@playwright/test';
import {boot,enterActivity,typeTargets,fixture,activate} from './helpers.js';

for(const character of ['Mario','Luigi','Princess'])test(`${character} practice feedback responds to real performance and remains static while paused`,async({page},info)=>{
 await boot(page,{data:fixture({duration:60,goal:30,character})});await enterActivity(page,'practice');await page.clock.runFor(10000);
 const low=await page.locator('#scene').evaluate(c=>c.toDataURL());await typeTargets(page,40);const high=await page.locator('#scene').evaluate(c=>c.toDataURL());expect(high).not.toBe(low);
 await page.keyboard.press('Escape');await page.clock.runFor(60000);expect(await page.locator('#scene').evaluate(c=>c.toDataURL())).toBe(high);
 await page.screenshot({path:info.outputPath(`${character}-practice.png`),fullPage:true});await activate(page,'#resume');await page.clock.runFor(1000);await expect(page.locator('#correct')).toHaveText('40');
});

test('exact case, ignored keys, repeat and composition retain the target and counts',async({page})=>{
 await boot(page);await enterActivity(page,'practice');await expect(page.locator('#source-caption')).toContainText('Generated practice, not original lesson text');await expect(page.locator('#target')).toHaveText('T');
 await page.keyboard.press('t');await expect(page.locator('#errors')).toHaveText('1');await expect(page.locator('#target')).toHaveText('T');
 for(const key of ['Backspace','Shift','Control+a','Meta+a','Alt+a'])await page.keyboard.press(key);
 await page.locator('#target').dispatchEvent('keydown',{key:'T',isComposing:true,bubbles:true});await page.locator('#target').dispatchEvent('keydown',{key:'é',bubbles:true});
 await expect(page.locator('#errors')).toHaveText('1');await expect(page.locator('#correct')).toHaveText('0');
 await page.keyboard.down('T');await page.keyboard.down('T');await page.keyboard.up('T');await expect(page.locator('#correct')).toHaveText('1');
 await typeTargets(page,2);await expect(page.locator('#target')).toHaveText('␣');await expect(page.locator('#finger')).toContainText('thumb');await page.keyboard.press('Space');await expect(page.locator('#correct')).toHaveText('4');await expect(page.locator('#pause-panel')).toBeHidden();
});
