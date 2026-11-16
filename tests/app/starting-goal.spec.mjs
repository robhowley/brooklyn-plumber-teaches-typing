import {test,expect} from '@playwright/test';
import {skipStartupUI,createStudentUI} from './source-path.mjs';

for(const mode of [1,3]) test(`world ${mode}: new student with no typing hears failure, not congratulations`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await page.addInitScript(()=>{window.__sourceTestClock=true;});
 await page.goto('./?seed=1');await skipStartupUI(page);
 await createStudentUI(page,{name:'GOAL',durations:[1,undefined,1]});
 expect(await page.evaluate(()=>translationSnapshot().profile)).toMatchObject({goal:5,previousGoal:0});
 await page.locator('#game').press(String(mode));
 expect(await page.evaluate(()=>translationSnapshot().profile.previousGoal)).toBe(5);
 await page.clock.runFor(65000);
 await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 const s=await page.evaluate(()=>translationSnapshot());
 expect(s.result.wpm).toBe(0);expect(s.profile).toMatchObject({goal:5,previousGoal:5,lesson:1});
 expect(s.audio.filter(e=>['congrats','toobad'].includes(e.request.name)).map(e=>e.request.name)).toEqual(['toobad']);
 expect(errors).toEqual([]);
});
