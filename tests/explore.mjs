// Separate agent-driven exploratory session: normal browser clock, visible UI only.
import { chromium } from '@playwright/test';
import { existsSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined);
const browser=await chromium.launch({executablePath});
const context=await browser.newContext({viewport:{width:1280,height:1000},acceptDownloads:true});
const page=await context.newPage(),errors=[],requests=[],log=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>requests.push(r.url()));
const shot=async name=>page.screenshot({path:`artifacts/final-${name}.png`,fullPage:true});
const button=name=>page.getByRole('button',{name,exact:true});
async function keys(n){for(let i=0;i<n;i++){const key=await page.locator('#target').textContent();await page.keyboard.press(key==='␣'?'Space':key);}}
async function result(passed){await page.getByRole('heading',{name:passed?'A star performance!':'Every key is practice.'}).waitFor({timeout:15000});}
async function setup(mode,duration,character){
 await page.getByLabel('Lesson path').selectOption('custom');await page.getByLabel('Activity').selectOption(mode);
 await page.getByLabel('Keyboard lesson').selectOption('5');await page.getByLabel('Goal · WPM').fill('5');await page.getByLabel('Time · seconds').fill(String(duration));
 await page.getByRole('radio',{name:character}).check();await button('Start lesson').click();
}
try {
 await page.goto('http://127.0.0.1:4174/dist/');await shot('menu');
 for(const [mode,character] of [['outdoor','Mario'],['underwater','Luigi'],['castle','Princess'],['practice','Princess']]){
  await setup(mode,mode==='castle'?6:3,character);await shot(`${mode}-before`);
  const target=await page.locator('#target').textContent();await page.keyboard.press(target==='~'?'x':'~');assert.equal(await page.locator('#correct').textContent(),'0');assert.equal(await page.locator('#target').textContent(),target);
  await keys(12);await shot(`${mode}-after`);
  if(mode==='outdoor'){
   await page.keyboard.press('Escape');const time=await page.locator('#time').textContent();await page.waitForTimeout(1200);await page.keyboard.press('a');assert.equal(await page.locator('#time').textContent(),time);assert.equal(await page.locator('#correct').textContent(),'12');await shot('escape');await page.keyboard.press('Enter');
  }
  if(mode==='castle'){
   await keys(28);assert.match(await page.locator('#pause-reason').textContent(),/pipe/);const time=await page.locator('#time').textContent();await page.waitForTimeout(1200);assert.equal(await page.locator('#time').textContent(),time);await shot('castle-pipe');await button('Resume lesson').click();await keys(3);await shot('castle-quicksand');
  }
  await result(true);await shot(`${mode}-results`);await button('Try again ↻').click();await result(false);await shot(`${mode}-failure`);
  log.push({mode,character,success:true,zeroAttemptRetryFailed:true});await button('Main menu').click();
 }
 // Fresh profile through actual UI starts, not seeded storage or clock manipulation.
 await context.clearCookies();await page.evaluate(()=>localStorage.clear());await page.reload();await page.getByLabel('Your name').fill('Exploratory Player');
 for(let i=0;i<15;i++){
  await page.getByRole('radio',{name:['Mario','Luigi','Princess'][i%3]}).check();await page.getByLabel('Time · seconds').fill('3');
  const position=await page.locator('#course-position').textContent();await button('Start lesson').click();await keys(20);await result(true);
  if(i===0){await page.reload();assert.equal(await page.locator('#next').isEnabled(),true);await shot('pending-next-reload');}
  log.push({guidedPass:i+1,position,activeSeconds:3,correct:20});
  if(i<14){await page.locator('#next').click();assert.equal(await page.locator('#next').isDisabled(),true);}
 }
 await shot('graduation');await page.reload();assert.match(await page.locator('#course-position').textContent(),/Graduate/);await button('Report card & certificates').click();
 assert.equal(await page.locator('.certificate').count(),3);assert.equal(await page.locator('tbody tr').count(),15);await shot('report');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download certificate',exact:true}).last().click();const download=await downloadPromise;await download.saveAs('artifacts/final-graduation-certificate.txt');
 await button('Main menu').click();await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForTimeout(300);await shot('narrow-menu');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await setup('outdoor',3,'Luigi');await keys(12);await shot('narrow-reduced-motion');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await result(true);
 await button('Main menu').click();await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement!==document.body));
 assert.deepEqual(errors,[]);assert.ok(requests.every(url=>url.startsWith('http://127.0.0.1:4174/')||url.startsWith('blob:')));
 writeFileSync('artifacts/final-exploration.json',JSON.stringify({clock:'normal, no Playwright clock installation',url:page.url(),log,errors,requests:[...new Set(requests)],download:download.suggestedFilename(),narrowWidth:390,reducedMotion:true},null,2));
 console.log(JSON.stringify({modes:4,guidedPasses:15,errors,requests:[...new Set(requests)],evidence:'artifacts/final-exploration.json'}));
} finally {await browser.close();}
