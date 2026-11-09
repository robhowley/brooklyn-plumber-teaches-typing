import { test, expect } from '@playwright/test';
test('keyboard-only start, pause, resume and menu navigation',async({page})=>{
 await page.goto('/');
 await page.keyboard.press('Tab');await expect(page.locator('#home')).toBeFocused();
 for(let i=0;i<30;i++){
  if(await page.locator('button[type=submit]').evaluate(el=>el===document.activeElement))break;
  await page.keyboard.press('Tab');
 }
 await expect(page.locator('button[type=submit]')).toBeFocused();await page.keyboard.press('Enter');
 await expect(page.locator('#pause')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#resume')).toBeFocused();
 await page.keyboard.press('Enter');await expect(page.locator('#pause-panel')).toBeHidden();
 await page.keyboard.press('Escape');await page.keyboard.press('Tab');await expect(page.locator('#leave')).toBeFocused();await page.keyboard.press('Enter');
 await expect(page.locator('#profile')).toBeVisible();
});
