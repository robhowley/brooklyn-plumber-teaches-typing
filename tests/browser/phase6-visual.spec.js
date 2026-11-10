import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {boot,custom,activate,openMenu,fixture} from './helpers.js';
import {SCREEN_LAYOUTS} from '../../src/screen-art.js';

const evidence=process.env.FIDELITY_EVIDENCE||'.tmp/fidelity-validation/phase6-final';
async function capture(page,name){await mkdir(`${evidence}/screenshots`,{recursive:true});await page.screenshot({path:`${evidence}/screenshots/${name}.png`,fullPage:true});}
async function panelGeometry(page,family){
 const composition=page.locator(`.original-screen[data-family="${family}"]`);
 const bounds=await composition.boundingBox(),panel=composition.locator('.original-panel'),box=await panel.boundingBox();
 const [x,y,w,h]=SCREEN_LAYOUTS[family].panel;
 for(const [actual,expected] of [[box.x,bounds.x+bounds.width*x/320],[box.y,bounds.y+bounds.height*y/200],[box.width,bounds.width*w/320],[box.height,bounds.height*h/200]])expect(Math.abs(actual-expected)).toBeLessThan(2);
 expect((await panel.innerText()).trim().length).toBeGreaterThan(20);
 await expect(panel).toBeVisible();
}
for(const mode of ['outdoor','underwater','castle','practice'])test(`${mode}: focused controls never type; native activation restores typing focus`,async({page})=>{
 await boot(page,{data:fixture({duration:60,goal:30})});await custom(page,mode);await expect(page.locator('main.play')).toBeFocused();
 for(const selector of ['#pause','#keyboard-toggle','#home']){
  await page.locator(selector).focus();await page.keyboard.press('a');await page.keyboard.press('Shift+A');
  await expect(page.locator('#correct')).toHaveText('0');await expect(page.locator('#errors')).toHaveText('0');
 }
 for(const key of ['Space','Enter']){
  await page.locator('#pause').focus();await page.keyboard.press(key);await expect(page.locator('#pause-panel')).toBeVisible();await expect(page.locator('#correct')).toHaveText('0');await expect(page.locator('#errors')).toHaveText('0');
  await activate(page,'#resume');await expect(page.locator('main.play')).toBeFocused();
  await page.locator('#keyboard-toggle').focus();await page.keyboard.press(key);await expect(page.locator('#keyboard-guide')).toBeVisible();await page.keyboard.press('a');await expect(page.locator('#errors')).toHaveText('0');await page.keyboard.press(key);await expect(page.locator('#keyboard-guide')).toBeHidden();await expect(page.locator('main.play')).toBeFocused();await expect(page.locator('#correct')).toHaveText('0');
 }
 await page.keyboard.press('Control+a');await expect(page.locator('#errors')).toHaveText('0');
 const key=await page.locator('#target').textContent();await page.keyboard.press(key==='␣'?'Space':key);await expect(page.locator('#correct')).toHaveText('1');
});
for(const width of [390,720,1280])test(`${width}px original panels contain readable DOM and HUD stays within cabinet`,async({page})=>{
 await page.setViewportSize({width,height:width===720?450:900});await boot(page,{data:fixture({duration:3})});
 await openMenu(page,'Student');await activate(page,'#times');await panelGeometry(page,'LESSTIME');await expect(page.locator('.original-panel #times-form')).toBeVisible();await capture(page,`${width}-times`);await page.locator('[name="practice-seconds"]').focus();await capture(page,`${width}-times-scrolled`);await activate(page,'#back');
 for(const [menu,id,family] of [['Student','edit-student','PREFS'],['Student','load-student','LOAD'],['File','help','HELP']]){await openMenu(page,menu);await activate(page,`#${id}`);await panelGeometry(page,family);await capture(page,`${width}-${family}`);await activate(page,'#back');}
 await custom(page,'practice');await panelGeometry(page,'PRACTICE');await expect(page.locator('.practice-screen #text-strip mark')).not.toHaveText('');await capture(page,`${width}-practice`);
 await page.clock.fastForward(3032);await panelGeometry(page,'BLACKBRD');await expect(page.locator('.original-panel #outcome')).toContainText('Not passed');await expect(page.locator('.original-panel .result-metrics')).toContainText('WPM');await capture(page,`${width}-result`);await page.locator('#outcome').scrollIntoViewIfNeeded();await capture(page,`${width}-result-status`);await activate(page,'#report');await panelGeometry(page,'RCARD');await capture(page,`${width}-report`);await activate(page,'#back');
 await custom(page,'outdoor');
 const cabinet=await page.locator('.game-cabinet').boundingBox();
 for(const selector of ['.hud','.hud-right','.hud-stats','.hand-guide','#wpm','#errors'])for(const node of await page.locator(selector).all()){
  const box=await node.boundingBox();expect(box.x).toBeGreaterThanOrEqual(cabinet.x);expect(box.x+box.width).toBeLessThanOrEqual(cabinet.x+cabinet.width);
  expect(await node.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();
 }
 await capture(page,`${width}-outdoor`);
});
