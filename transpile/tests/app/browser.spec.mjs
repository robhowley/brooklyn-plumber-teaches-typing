import { test, expect } from '@playwright/test';
async function point(page,x,y,click=true) {const r=await page.locator('#game').boundingBox();const p=[r.x+x*r.width/320,r.y+y*r.height/200];if(click)await page.mouse.click(...p);else await page.mouse.move(...p);}
async function ready(page) {await page.goto('/?seed=1');await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');}
test('entry/menu uses local decoded assets only; disabled controls and hover survive scale',async({page})=>{
 const failures=[],requests=[];page.on('pageerror',e=>failures.push(e.message));page.on('request',r=>requests.push(r.url()));
 await ready(page);expect(await page.locator('canvas').getAttribute('width')).toBe('320');
 await point(page,250,20,false);await expect(page.locator('#game')).toHaveCSS('cursor','pointer');
 await point(page,250,55,false);await expect(page.locator('#game')).toHaveCSS('cursor','pointer');
 await point(page,250,85,false);await expect(page.locator('#game')).toHaveCSS('cursor','pointer');
 await point(page,250,85);await expect(page.locator('#game')).toHaveAttribute('data-screen','castle');
 await page.locator('#game').press('Escape');await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 await page.locator('#game').press('m');
 await point(page,30,4);expect((await page.evaluate(()=>translationSnapshot())).menu.row).toBe(1);
 await page.locator('#game').press('m');await expect(page.locator('#status')).toContainText('Audio playback is not translated');
 await page.setViewportSize({width:390,height:800});await point(page,250,20);await expect(page.locator('#game')).toHaveAttribute('data-screen','outdoor');
 await expect.poll(async()=>page.evaluate(()=>translationSnapshot().outdoor.targetIndex)).toBeGreaterThanOrEqual(0);
 await page.screenshot({path:'transpile/reports/browser/outdoor-mobile.png'});
 expect(requests.some(u=>/\.EXE|raw\/|\/src\/|\.zip/i.test(u))).toBe(false);expect(failures).toEqual([]);
});
test('student setup, group, duration, persistence and ordinary typing through exit/results/Next',async({page})=>{
 await ready(page);await page.locator('#game').press('w');await expect(page.locator('#setup')).toBeVisible();
 await page.locator('[name=name]').fill('Ada');await page.locator('[name=lesson]').selectOption('2');await page.locator('[name=goal]').fill('7');await page.locator('[name=minutes]').fill('1');
 await page.locator('#setup button[type=submit]').click();await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
 expect((await page.evaluate(()=>translationSnapshot())).profile.name).toBe('Ada');
 await page.reload();await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');expect((await page.evaluate(()=>translationSnapshot())).profile.lesson).toBe(2);
 await page.locator('#game').press('t');await expect(page.locator('#game')).toHaveAttribute('data-screen','times');
 await page.locator('[name=minutes]').fill('2');await page.locator('#setup button[type=submit]').click();
 expect((await page.evaluate(()=>translationSnapshot())).profile.durations[0]).toBe(2);
 await page.locator('#game').press('1');await expect(page.locator('#game')).toHaveAttribute('data-screen','outdoor');
 await expect.poll(async()=>page.evaluate(()=>translationSnapshot().outdoor.targetIndex)).toBeGreaterThanOrEqual(0);
 let snapshot=await page.evaluate(()=>translationSnapshot());const target=snapshot.outdoor.obstacles[snapshot.outdoor.targetIndex];expect(target.x).toBeGreaterThan(180);
 await page.locator('#game').press(target.code===65?'b':'a');await expect.poll(async()=>page.evaluate(()=>translationSnapshot().outdoor.errors)).toBe(1);
 await page.locator('#game').press(String.fromCharCode(target.code).toLowerCase());await expect.poll(async()=>page.evaluate(()=>translationSnapshot().outdoor.correct)).toBe(1);
 await page.locator('#game').press('Escape');await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 snapshot=await page.evaluate(()=>translationSnapshot());expect(snapshot.profile.lesson).toBe(2);expect(snapshot.result.accuracy).toBe(50);
 await page.screenshot({path:'transpile/reports/browser/results.png'});
 await page.locator('#game').press('n');await expect(page.locator('#game')).toHaveAttribute('data-screen','outdoor');
 await page.locator('#game').press('F10');await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 await page.locator('#game').press('m');await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
 await page.screenshot({path:'transpile/reports/browser/menu.png'});
});
test('configured duration reaches results without input or an invented failure',async({page})=>{
 await page.clock.install();await ready(page);
 await page.locator('#game').press('w');await page.locator('[name=name]').fill('Clock');await page.locator('[name=minutes]').fill('1');await page.locator('#setup button[type=submit]').click();
 await page.locator('#game').press('1');await page.clock.runFor(5000);
 const moving=await page.evaluate(()=>translationSnapshot());expect(moving.outdoor.x).toBeGreaterThan(20);expect(moving.outdoor.attempts).toBe(0);
 await page.clock.runFor(56000);await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 const ended=await page.evaluate(()=>translationSnapshot());expect(ended.result.elapsedSeconds).toBe(60);expect(ended.result.wpm).toBe(0);expect(ended.outdoor.aborted).toBe(false);expect(ended.profile.lesson).toBe(1);
});
test('host focus loss suspends motion/time, refocus resumes; result pointer activation',async({page})=>{
 await ready(page);await page.locator('#game').press('1');await page.waitForTimeout(200);
 await page.locator('#focus').focus();await expect(page.locator('#game')).toHaveAttribute('data-suspended','true');
 const a=await page.evaluate(()=>translationSnapshot());await page.waitForTimeout(250);const b=await page.evaluate(()=>translationSnapshot());expect(b.ticks).toBe(a.ticks);expect(b.outdoor.x).toBe(a.outdoor.x);
 await page.locator('#focus').click();await expect(page.locator('#game')).toHaveAttribute('data-suspended','false');
 await page.locator('#game').press('Escape');await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 await point(page,157,184,false);await page.locator('#game').press('Enter');await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
});
