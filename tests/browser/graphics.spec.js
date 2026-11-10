import {test,expect} from '@playwright/test';
import {boot,custom,fixture,activate} from './helpers.js';

for(const width of [390,1280])for(const mode of ['outdoor','underwater','castle','practice'])test(`${mode} archive scene and DOM controls at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await boot(page);await custom(page,mode);
 await expect(page.locator('.original-glove')).toHaveCount(2);await expect(page.locator('#target')).toBeVisible();await expect(page.locator('#finger')).toBeVisible();
 expect(await page.locator('#scene').evaluate(c=>[c.width,c.height])).toEqual([640,400]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await activate(page,'#keyboard-toggle');await expect(page.locator('#keyboard-guide')).toBeVisible();await expect(page.locator('#keyboard-toggle')).toHaveAttribute('aria-expanded','true');
 await page.screenshot({path:info.outputPath(`${mode}-${width}.png`),fullPage:true});
});

test('narrow and enlarged menu/forms retain readable controls without horizontal overflow',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await boot(page,{data:fixture()});
 await page.locator('body').evaluate(el=>el.style.zoom='1.25');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:info.outputPath('menu-zoom.png'),fullPage:true});
});
