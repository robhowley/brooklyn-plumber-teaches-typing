import {test,expect} from '@playwright/test';
import {boot,custom,fixture,activate,openMenu} from './helpers.js';

for(const width of [390,1280])for(const mode of ['outdoor','underwater','castle','practice'])test(`${mode} archive scene and DOM controls at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await boot(page);await custom(page,mode);
 await expect(page.locator('.original-glove')).toHaveCount(2);await expect(page.locator('#target')).toBeVisible();await expect(page.locator('#finger')).toBeVisible();
 expect(await page.locator('#scene').evaluate(c=>[c.width,c.height])).toEqual([640,400]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await activate(page,'#keyboard-toggle');await expect(page.locator('#keyboard-guide')).toBeVisible();await expect(page.locator('#keyboard-toggle')).toHaveAttribute('aria-expanded','true');
 await page.screenshot({path:info.outputPath(`${mode}-${width}.png`),fullPage:true});
});

test('native main menu fits narrow view; enlarged student forms remain usable',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await boot(page,{data:fixture()});
 const canvas=page.locator('#screen-art'),box=await canvas.boundingBox();
 await expect(canvas).toHaveAttribute('width','320');await expect(canvas).toHaveAttribute('height','200');
 expect(box.width/box.height).toBeCloseTo(1.6,2);expect(box.width).toBeCloseTo(390,1);
 expect(box.x).toBeCloseTo(0,1);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:info.outputPath('main-menu-narrow.png'),fullPage:true});
 await openMenu(page,'Student');await activate(page,'#new-student');
 await page.locator('body').evaluate(el=>el.style.zoom='1.25');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:info.outputPath('student-form-zoom.png'),fullPage:true});
});
