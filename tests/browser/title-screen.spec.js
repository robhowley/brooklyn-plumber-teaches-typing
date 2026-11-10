import { test, expect } from '@playwright/test';

test('static archive welcome precedes menu, with no fade or screenshot title',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.locator('#screen-art')).toHaveAttribute('width','320');
 await expect(page.locator('#screen-art')).toHaveAttribute('height','200');
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original GREET background');
 const before=await page.locator('#screen-art').evaluate(c=>c.toDataURL());
 await page.waitForTimeout(500);
 expect(await page.locator('#screen-art').evaluate(c=>c.toDataURL())).toBe(before);
 await expect(page.locator('#enter')).toBeFocused();
 await page.screenshot({path:info.outputPath('archive-welcome.png'),fullPage:true});
 await page.keyboard.press('Enter');
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');
 await expect(page.locator('#activity-outdoor')).toBeFocused();
 await expect(page.locator('#activity-underwater')).toBeDisabled();
 await expect(page.locator('#activity-castle')).toBeDisabled();
 await expect(page.locator('#next')).toBeDisabled();
 await page.screenshot({path:info.outputPath('archive-menu.png'),fullPage:true});
 expect(errors).toEqual([]);
});

test('historical notice appears before any original learner text and offers generated alternative',async({page})=>{
 await page.goto('/');await page.keyboard.press('Enter');await page.keyboard.press('1');
 await expect(page.locator('.historical-notice')).toContainText('outdated or inaccurate claims');
 await expect(page.locator('.historical-notice')).toContainText('war, slavery, assassination and disasters');
 await expect(page.locator('#coverage')).toContainText('records use historical text');
 await expect(page.locator('#target')).toHaveCount(0);
 await page.locator('#generated').focus();await page.keyboard.press('Enter');
 await expect(page.locator('#source-caption')).toContainText('Generated practice, not original lesson text');
});
