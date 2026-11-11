import {test,expect} from '@playwright/test';
import {boot,custom,typeTargets,activate,enterActivity,openMenu,fixture,stored} from './helpers.js';
import {defaults,createStore,STORAGE_KEY,LEGACY_STORAGE_KEY} from '../../src/storage.js';

for(const errors of [1,2])test(`integer accuracy with ${errors} errors controls result and matches HUD`,async({page})=>{
 await boot(page);await enterActivity(page,'practice');await typeTargets(page,9);for(let i=0;i<errors;i++)await page.keyboard.press('~');
 await page.clock.runFor(2900);await expect(page.locator('#accuracy')).toHaveText(errors===1?'90%':'81%');await page.clock.runFor(200);
 await expect(page.locator('#outcome')).toContainText(errors===1?'Passed at timeout':'Accuracy is below 90%');await expect(page.locator('#next')).toBeDisabled();
 const r=(await stored(page)).students[0].results[0];expect(r.accuracy).toBe(errors===1?90:81);expect(r.wpm).toBe(Math.floor((9-errors)*182/54));
});

test('migration preserves legacy save and awards, separates reports and downloads provenance',async({page})=>{
 const p=defaults();const old={version:1,name:'Legacy',character:'Luigi',settings:p.settings,course:{group:5,goal:50,graduated:true,pending:null},results:[{mode:'castle',group:5,goal:50,wpm:60.5,accuracy:99.9,correct:200,errors:1,duration:30,passed:true,guided:true,date:'2020-01-01'}],certificates:[{kind:'graduation',name:'Legacy',date:'2020-01-01'}]};
 await page.addInitScript(({key,old})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(old));},{key:LEGACY_STORAGE_KEY,old});
 await boot(page,{data:null});expect((await stored(page)).students[0].course).toMatchObject({group:0,goal:5,pending:null});
 await page.keyboard.press('5');await expect(page.getByRole('heading',{name:'Legacy history (not comparable)',exact:true})).toBeVisible();await expect(page.getByRole('table',{name:'Legacy history (not comparable)',exact:true})).toContainText('60.5');await expect(page.locator('main')).toContainText('old passes and awards were not recomputed');
 await activate(page,'[data-certificate="0"]');await expect(page.locator('.certificate')).toContainText('Historical award preserved');await expect(page.locator('.certificate')).toContainText(LEGACY_STORAGE_KEY);
 const download=page.waitForEvent('download');await activate(page,'#download');const file=await download;const stream=await file.createReadStream();let text='';for await(const chunk of stream)text+=chunk;expect(text).toContain('Legacy');expect(text).toContain('typing-kingdom-v1');expect(text).not.toContain('Achieved undefined');
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),LEGACY_STORAGE_KEY)).toEqual(old);
 const data=await stored(page);expect(data.students[0].legacy.profile).toEqual(old);expect(data.students[0].certificates).toHaveLength(1);
});

for(const raw of ['{',JSON.stringify({version:99})])test(`blocked recovery does not overwrite ${raw}`,async({page})=>{
 await page.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key:STORAGE_KEY,raw});await boot(page,{data:null});
 await custom(page,'practice');await expect(page.locator('#storage-status')).toContainText('Recovery blocked saving');await typeTargets(page,2);await page.keyboard.press('Escape');await activate(page,'#leave');
 expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)).toBe(raw);await openMenu(page,'File');await activate(page,'#help');await expect(page.locator('#storage-status')).toContainText('temporary');
});

test('quota failure is visible while in-memory result and Next remain available',async({page})=>{
 await boot(page,{data:fixture({group:0})});const before=await stored(page);
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Quota exceeded','QuotaExceededError');};});
 await enterActivity(page,'outdoor');await typeTargets(page,12);await page.clock.runFor(3100);
 await expect(page.locator('#storage-status')).toContainText('session only');await expect(page.locator('#next')).toBeEnabled();expect(await stored(page)).toEqual(before);
 await activate(page,'#next');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');expect(await stored(page)).toEqual(before);
 await openMenu(page,'File');await activate(page,'#help');await expect(page.locator('#storage-status')).toContainText('may be lost on reload');
});

test('unavailable storage is usable but clearly temporary',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('denied');}}));await boot(page,{data:null});await openMenu(page,'File');await activate(page,'#help');await expect(page.locator('#storage-status')).toContainText('session only');await activate(page,'#back');await page.keyboard.press('Escape');await enterActivity(page,'practice');await expect(page.locator('#source-caption')).toContainText('Generated practice, not original lesson text');await expect(page.locator('#target')).toBeVisible();
});
