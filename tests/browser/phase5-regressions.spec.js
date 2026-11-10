import {test,expect} from '@playwright/test';
import {boot,activate,openMenu,typeTargets,fixture,stored} from './helpers.js';

test('Space activates focused gameplay controls without typing attempts',async({page})=>{
 await boot(page);await page.keyboard.press('4');await activate(page,'#generated');
 await page.locator('#keyboard-toggle').focus();await page.keyboard.press('Space');
 await expect(page.locator('#keyboard-guide')).toBeVisible();await expect(page.locator('#keyboard-toggle')).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('#correct')).toHaveText('0');await expect(page.locator('#errors')).toHaveText('0');
 await page.locator('#pause').focus();await page.keyboard.press('Space');await expect(page.locator('#resume')).toBeFocused();
 await expect(page.locator('#correct')).toHaveText('0');await expect(page.locator('#errors')).toHaveText('0');
 await page.keyboard.press('Space');await expect(page.locator('#pause-panel')).toBeHidden();await expect(page.getByRole('main')).toBeFocused();
 // A space in the typing surface is still a real attempted key.
 await page.keyboard.press('Space');await expect(page.locator('#errors')).toHaveText('1');
});

test('guided lesson six earns outdoor transition certificate through paced keys and explicit Next',async({page})=>{
 const data=fixture({duration:20,goal:8,group:5});Object.assign(data.students[0].course,{group:5,goal:8});
 await boot(page,{data});await openMenu(page,'File');await activate(page,'#help');await activate(page,'#guided');await activate(page,'#original');
 // Twenty keys over twenty active seconds gives 10 WPM under the browser clock.
 for(let i=0;i<20;i++){await typeTargets(page,1);await page.clock.runFor(900);}
 await expect(page.locator('#correct')).toHaveText('20');await expect(page.locator('#errors')).toHaveText('0');await page.clock.runFor(2100);
 await expect(page.locator('#outcome')).toContainText('Passed at timeout');await expect(page.locator('#next')).toBeEnabled();
 let p=(await stored(page)).students[0];expect(p.results).toHaveLength(1);expect(p.results[0]).toMatchObject({guided:true,mode:'outdoor',group:5,correct:20,elapsed:20,wpm:10,passed:true});expect(p.certificates).toHaveLength(0);
 await activate(page,'#next');expect((await stored(page)).students[0].course).toMatchObject({group:0,goal:10,revision:1,pending:null});
 p=(await stored(page)).students[0];expect(p.certificates).toHaveLength(1);expect(p.certificates[0]).toMatchObject({kind:'outdoor',resultId:p.results[0].id,achieved:10});
 await page.reload();await activate(page,'#skip-title');await page.keyboard.press('5');
 await expect(page.getByRole('table',{name:'Current ruleset',exact:true})).toContainText('Original 1992 lesson text');await expect(page.getByRole('table',{name:'Current ruleset',exact:true})).toContainText('20s / 20s / timeout');
 await page.evaluate(()=>{window.print=()=>{window.printCalls=(window.printCalls||0)+1;};});await activate(page,'#print');expect(await page.evaluate(()=>window.printCalls)).toBe(1);
 await activate(page,'[data-certificate="0"]');await expect(page.locator('.certificate')).toContainText('Outdoor graduate');await expect(page.locator('.certificate')).toContainText('Achieved 10 WPM');
 await activate(page,'#print');expect(await page.evaluate(()=>window.printCalls)).toBe(2);
 const downloading=page.waitForEvent('download');await activate(page,'#download');const download=await downloading;expect(download.suggestedFilename()).toBe('typing-certificate-outdoor.txt');
 let text='';for await(const chunk of await download.createReadStream())text+=chunk;
 expect(text).toContain('Awarded to Ada');expect(text).toContain(p.results[0].id);expect(text).toContain(p.results[0].ruleset);expect(text).toContain('Achieved 10 WPM');
 await activate(page,'#back');await expect(page.getByRole('heading',{name:'Report card',exact:true})).toBeVisible();expect((await stored(page)).students[0].certificates).toHaveLength(1);
});
