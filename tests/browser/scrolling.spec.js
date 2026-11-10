import {test,expect} from '@playwright/test';
import {boot,custom,typeTargets,activate,fixture} from './helpers.js';
const pixels=page=>page.locator('#scene').evaluate(c=>c.toDataURL());

test('normal motion buffers real outdoor input once, wrong target stays, and no early result',async({page})=>{
 await boot(page,{motion:'no-preference',data:fixture({duration:20,group:0})});await page.keyboard.press('1');await activate(page,'#original');
 const key=await page.locator('#target').textContent(),before=await pixels(page);
 await page.keyboard.press('z');await expect(page.locator('#errors')).toHaveText('1');await expect(page.locator('#target')).toHaveText(key);
 await typeTargets(page,1);await expect(page.locator('#correct')).toHaveText('0');await expect(page.locator('#encounter-status')).toContainText('held');
 await typeTargets(page,1);await page.clock.runFor(4400);await expect(page.locator('#correct')).toHaveText('1');expect(await pixels(page)).not.toBe(before);
 await expect(page.locator('#target')).toBeVisible();await expect(page.locator('#outcome')).toHaveCount(0);
});

for(const mode of ['outdoor','underwater','castle'])test(`${mode} Escape, blur and hidden freeze pixels, input and clocks`,async({page})=>{
 await boot(page,{motion:'no-preference',data:fixture({duration:60})});await custom(page,mode);
 const before=await pixels(page);await page.clock.runFor(1000);expect(await pixels(page)).not.toBe(before);
 for(const cause of ['escape','blur','hidden']){
  if(cause==='escape')await page.keyboard.press('Escape');
  else await page.evaluate(cause=>{if(cause==='blur')window.dispatchEvent(new Event('blur'));else{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}},cause);
  const frozen=await pixels(page),time=await page.locator('#time').textContent();await page.clock.runFor(60000);await page.keyboard.press('a');expect(await pixels(page)).toBe(frozen);await expect(page.locator('#time')).toHaveText(time);await expect(page.locator('#correct')).toHaveText('0');
  if(cause==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
  await activate(page,'#resume');await page.clock.runFor(50);await expect(page.locator('#time')).toHaveText(time);
 }
});

test('normal wall clock outdoor contact accepts a real key without fake-clock advancement',async({page})=>{
 await boot(page,{motion:'no-preference',clock:false,data:fixture({duration:20,group:0})});await page.keyboard.press('1');await activate(page,'#original');await typeTargets(page,1);
 await expect(page.locator('#correct')).toHaveText('1',{timeout:7000});await expect(page.locator('#errors')).toHaveText('0');
});
