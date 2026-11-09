import {test,expect} from '@playwright/test';
const storageKey='typing-kingdom-v1';
// Instant typing fixtures use the explicit reduced-motion path; scrolling.spec covers encounters.
async function boot(page) { await page.emulateMedia({reducedMotion:'reduce'}); await page.clock.install({time:new Date('2026-11-09T00:00:00Z')}); await page.goto('/'); await page.clock.pauseAt(new Date('2026-11-09T00:01:00Z')); }
async function typeTargets(page,count) {
 for(let i=0;i<count;i++) {
  const key=await page.locator('#target').textContent();
  await page.keyboard.press(key==='␣'?'Space':key);
  if(await page.locator('#resume').isVisible()) await page.getByRole('button',{name:'Resume lesson'}).click();
 }
}
async function custom(page,mode,duration='1',group='5',goal='5') {
 await page.getByLabel('Lesson path').selectOption('custom');await page.getByLabel('Activity').selectOption(mode);
 await page.getByLabel('Keyboard lesson').selectOption(group);await page.getByLabel('Goal · WPM').fill(goal);await page.getByLabel('Time · seconds').fill(duration);
 await page.getByRole('button',{name:'Start lesson',exact:true}).click();
}
async function pressKey(page,key) {
 await page.keyboard.press(key===' '?'Space':key);
}
test('15-pass guided course via real keyboard, saved Next, graduation, certificates and practice',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await boot(page);
 await page.getByLabel('Your name').fill('Ada');await page.getByRole('radio',{name:'Luigi'}).check();
 await page.screenshot({path:'.tmp/test-results/menu.png',fullPage:true});
 for(let i=0;i<15;i++) {
  await page.getByLabel('Time · seconds').fill('1');await page.getByRole('button',{name:'Start lesson',exact:true}).click();
  await typeTargets(page,10);if(i===0)await page.screenshot({path:'.tmp/test-results/outdoor.png',fullPage:true});await page.clock.runFor(1100);
  await expect(page.getByRole('heading',{name:'A star performance!'})).toBeVisible();
  if(i===0) {
   await page.getByRole('button',{name:'Try again'}).click();await page.clock.runFor(1100);
   await expect(page.getByRole('heading',{name:'Every key is practice.'})).toBeVisible();
   await page.reload();await expect(page.locator('#next')).toBeEnabled();
  }
  if(i<14) {
   await page.locator('#next').click();await expect(page.locator('#next')).toBeDisabled();
   await page.locator('#next').evaluate(el=>el.click());
   await expect(page.getByLabel('Goal · WPM')).toHaveValue(String(i<5?5:(i-3)*5));
  }
 }
 await expect(page.locator('.fine')).toContainText('Mario Graduate');await page.getByRole('button',{name:'Report card',exact:true}).click();
 await expect(page.locator('.certificate')).toHaveCount(3);await expect(page.locator('tbody tr')).toHaveCount(16);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download certificate'}).last().click();expect((await download).suggestedFilename()).toContain('graduation');
 await page.screenshot({path:'.tmp/test-results/graduation-report.png',fullPage:true});await page.reload();
 await expect(page.locator('#course-position')).toContainText('Mario Graduate');
 await custom(page,'practice');await typeTargets(page,10);await page.screenshot({path:'.tmp/test-results/practice.png',fullPage:true});await page.clock.runFor(1100);
 await expect(page.getByRole('heading',{name:'A star performance!'})).toBeVisible();
 expect(errors).toEqual([]);
});
test('exact 90% passes, below 90% fails; custom results never unlock Next',async({page})=>{
 await boot(page);
 for(const errors of [1,2]) {
  await custom(page,'underwater');await typeTargets(page,9);
  for(let i=0;i<errors;i++)await page.keyboard.press('~');
  await page.screenshot({path:`.tmp/test-results/underwater-${errors}.png`,fullPage:true});await page.clock.runFor(1100);
  await expect(page.getByRole('heading',{name:errors===1?'A star performance!':'Every key is practice.'})).toBeVisible();
  await expect(page.locator('#next')).toBeDisabled();await page.getByRole('button',{name:'Main menu'}).click();
 }
 await expect(page.locator('#course-position')).toContainText('Home row · 5 WPM');
});
test('ignored/repeat/modified input, Escape, blur, visibility and pipe freeze active time',async({page})=>{
 await boot(page);await custom(page,'castle','10');
 await page.keyboard.press('t');await expect(page.locator('#errors')).toHaveText('1');await expect(page.locator('#target')).toHaveText('T');
 for(const key of ['Backspace','Shift','Control+a','Meta+a','Alt+a'])await page.keyboard.press(key);
 await page.locator('#target').dispatchEvent('keydown',{key:'T',isComposing:true,bubbles:true});
 await expect(page.locator('#correct')).toHaveText('0');await expect(page.locator('#errors')).toHaveText('1');
 await page.keyboard.down('T');await page.keyboard.down('T');await page.keyboard.up('T');await expect(page.locator('#correct')).toHaveText('1');
 for(const cause of ['escape','blur','hidden']) {
  if(cause==='escape')await page.keyboard.press('Escape');
  else if(cause==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  else await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  const time=await page.locator('#time').textContent();await page.clock.runFor(60000);await page.keyboard.press('h');
  await expect(page.locator('#time')).toHaveText(time);await expect(page.locator('#correct')).toHaveText('1');
  if(cause==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.getByRole('button',{name:'Resume lesson'}).click();
 }
 await typeTargets(page,38);const key=await page.locator('#target').textContent();await page.keyboard.press(key==='␣'?'Space':key);
 await expect(page.locator('#pause-reason')).toContainText('pipe');await expect(page.locator('#correct')).toHaveText('40');
 const time=await page.locator('#time').textContent();await page.clock.runFor(60000);await expect(page.locator('#time')).toHaveText(time);
 await page.screenshot({path:'.tmp/test-results/castle-pipe.png',fullPage:true});await page.getByRole('button',{name:'Resume lesson'}).click();await page.clock.runFor(10100);
 await expect(page.getByRole('heading',{name:'A star performance!'})).toBeVisible();
});
test('mode defaults, exact capitals/punctuation/numbers/spaces, and keyboard hints',async({page})=>{
 await boot(page);await page.getByLabel('Lesson path').selectOption('custom');
 for(const [mode,duration] of [['outdoor','120'],['underwater','300'],['castle','300'],['practice','600']]) {
  await page.getByLabel('Activity').selectOption(mode);await expect(page.getByLabel('Time · seconds')).toHaveValue(duration);
 }
 await custom(page,'practice','2');
 await expect(page.locator('[data-key="t"]')).toHaveClass('active');await expect(page.locator('#shift')).toHaveClass('active');
 await page.keyboard.press('t');await expect(page.locator('#errors')).toHaveText('1');
 for(let i=0;i<24;i++) {
  const key=await page.locator('#target').textContent();
  if(key==='␣') await expect(page.locator('#finger')).toContainText('thumb');
  if(key==='1') await expect(page.locator('[data-key="1"]')).toHaveClass('active');
  if(key==='.') await expect(page.locator('[data-key="."]')).toHaveClass('active');
  await page.keyboard.press(key==='␣'?'Space':key);
 }
 await expect(page.locator('#correct')).toHaveText('24');await page.clock.runFor(2100);
 await expect(page.getByRole('heading',{name:'A star performance!'})).toBeVisible();
 await page.reload();await page.getByLabel('Activity').selectOption('practice');await expect(page.getByLabel('Time · seconds')).toHaveValue('2');
});
test('underwater fixed passage wraps after real keyboard input and keeps its preview and timer aligned',async({page},testInfo)=>{
 const corpus='The reef has 12 fish. Swim past the gate! "Ready?" Yes, let us go. ';
 const preview=(correct)=>Array.from({length:12},(_,i)=>corpus[(correct+i+1)%corpus.length]).map(key=>key===' '?'␣':key).join(' ');
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await custom(page,'underwater','300','5');
 await expect(page.locator('#target')).toHaveText('T');await expect(page.locator('#finger')).toContainText('opposite Shift');
 for(const key of corpus.slice(0,-1)) await pressKey(page,key);
 await expect(page.locator('#correct')).toHaveText(String(corpus.length-1));
 await expect(page.locator('#target')).toHaveText('␣');await expect(page.locator('#finger')).toContainText('thumb');
 await expect(page.locator('#preview')).toHaveText(preview(corpus.length-1));
 await page.screenshot({path:testInfo.outputPath('underwater-fixed-corpus-wrap.png'),fullPage:true});
 await pressKey(page,' ');
 await expect(page.locator('#correct')).toHaveText(String(corpus.length));
 await expect(page.locator('#target')).toHaveText('T');await expect(page.locator('#finger')).toContainText('opposite Shift');
 await expect(page.locator('#preview')).toHaveText(preview(corpus.length));
 await page.keyboard.press('t');
 await expect(page.locator('#errors')).toHaveText('1');await expect(page.locator('#correct')).toHaveText(String(corpus.length));
 await expect(page.locator('#target')).toHaveText('T');await expect(page.locator('#preview')).toHaveText(preview(corpus.length));
 await pressKey(page,'T');
 for(const key of corpus.slice(1)) await pressKey(page,key);
 for(const key of corpus) await pressKey(page,key);
 await expect(page.locator('#correct')).toHaveText(String(corpus.length*3));
 await expect(page.locator('#errors')).toHaveText('1');await expect(page.locator('#target')).toHaveText('T');
 await expect(page.locator('#preview')).toHaveText(preview(corpus.length*3));
 const timeBefore=await page.locator('#time').textContent();await expect(page.locator('#resume')).toBeHidden();
 await page.waitForTimeout(1200);
 await expect(page.locator('#time')).not.toHaveText(timeBefore);await expect(page.locator('#correct')).toHaveText(String(corpus.length*3));
 await expect(page.locator('.blackboard')).toHaveCount(0);
});
test('zero attempts fail; corrupt/unavailable storage and narrow layout stay usable',async({page})=>{
 await boot(page);await page.evaluate(key=>localStorage.setItem(key,'{'),storageKey);await page.reload();await expect(page.getByLabel('Your name')).toHaveValue('Player');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByLabel('Time · seconds').fill('1');await page.getByRole('button',{name:'Start lesson',exact:true}).click();await page.clock.runFor(1100);
 await expect(page.getByRole('heading',{name:'Every key is practice.'})).toBeVisible();await expect(page.locator('#next')).toBeDisabled();
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('denied');}}));await page.reload();
 await expect(page.locator('footer')).toContainText('Storage unavailable');await custom(page,'outdoor');await typeTargets(page,5);await page.clock.runFor(1100);await expect(page.getByRole('heading',{name:'A star performance!'})).toBeVisible();
});
