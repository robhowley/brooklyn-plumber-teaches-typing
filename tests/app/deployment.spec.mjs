import {test} from '@playwright/test';
import assert from 'node:assert/strict';
import {skipStartupUI} from './source-path.mjs';

test('built runtime: four activities, clean fetches and unchanged storage keys', async({page,baseURL})=>{
 test.setTimeout(90000);
 const base=baseURL;
 await page.addInitScript(()=>{
   for(const key of ['typing-kingdom-v1','typing-kingdom-v2'])if(localStorage.getItem(key)===null)localStorage.setItem(key,'legacy-'+key);
 });
 const evidence={url:base,started:new Date().toISOString(),responses:[],console:[],pageerrors:[],requestfailed:[],steps:[]};
 try {
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  cdp.on('Network.responseReceived',({response:r,type})=>evidence.responses.push({url:r.url,status:r.status,type}));
  page.on('console',m=>evidence.console.push({type:m.type(),text:m.text(),location:m.location()}));
  page.on('pageerror',e=>evidence.pageerrors.push(e.message));
  page.on('requestfailed',r=>evidence.requestfailed.push({url:r.url(),failure:r.failure()}));
  const snap=()=>page.evaluate(()=>window.translationSnapshot());
  async function until(predicate,label,timeout=12000) {
   const end=Date.now()+timeout;
   do {const s=await snap();if(predicate(s))return s;await page.waitForTimeout(60);}while(Date.now()<end);
   throw new Error(`Timed out: ${label}; ${JSON.stringify(await snap())}`);
  }
  async function screen(value){return until(s=>s.screen===value,`screen ${value}`);}
  const key=k=>page.locator('#game').press(k);
  const response=await page.goto(new URL('?seed=1',base).href,{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>!!window.translationSnapshot);
  assert.equal((await snap()).screen,'startup');
  assert.equal(await page.evaluate(()=>localStorage.getItem('mtt-static-translation.students.v1')),null);
  evidence.steps.push({screen:'startup',url:page.url()});
  await skipStartupUI(page);await screen('menu');evidence.steps.push({screen:'menu',via:'source startup skip keys'});
  // Only native UI controls and real key events, never controller/storage writes.
  await key('w');await page.locator('[name=name]').fill('Live');
  await page.locator('[name=goal]').fill('30');
  await page.locator('#setup button[type=submit]').click();await screen('menu');
  for(const [mode,name] of [[1,'outdoor'],[2,'water'],[3,'castle'],[4,'practice']]) {
   await page.waitForTimeout(350);await key(String(mode));let s=await screen(name);
   s=await until(s=>name==='outdoor'?s.outdoor.targetIndex>=0:name==='castle'?s.castle.stats.running&&!s.audioHost.blocking&&!s.castle.locked&&['rockfaces','sand'].includes(s.castle.phase):name==='water'?s.water.phase!=='ready'&&!s.audioHost.blocking&&!s.audio.some(e=>e.request.name==='ready'&&e.status==='pending'):!s.audioHost.blocking,`${name} target`);
   const stats=s=>name==='outdoor'?s.outdoor:name==='water'?s.water.stats:name==='castle'?s.castle.stats:s.practice;
   const code=name==='outdoor'?s.outdoor.obstacles[s.outdoor.targetIndex].code:name==='water'?s.water.window[10]:name==='castle'?s.castle.target:s.practice.rows[33+s.practice.index];
   assert.ok(code>0,`${name} has source key`);const before=stats(s).correct;
   const char=String.fromCharCode(code),pressed=name==='outdoor'?char.toLowerCase():char;
   await key(pressed===' '?'Space':pressed);s=await until(s=>stats(s).correct===before+1,`${name} correct increment`);
   assert.equal(stats(s).errors,0);
   evidence.steps.push({activity:name,sourceCode:code,pressed,before,after:stats(s).correct,screen:s.screen});
   await key('Escape');s=await screen('results');evidence.steps.push({activity:name,screen:'results',result:s.result});
   await key('m');await screen('menu');evidence.steps.push({activity:name,screen:'menu'});
  }
  await page.waitForTimeout(500);
  assert.deepEqual(evidence.pageerrors,[]);assert.deepEqual(evidence.requestfailed,[]);
  const bad=evidence.responses.filter(r=>r.status>=400);
  const consoleErrors=evidence.console.filter(m=>m.type==='error');
  if(process.env.LIVE_DIAGNOSE!=='1') {
   assert.deepEqual(bad,[]);assert.deepEqual(consoleErrors,[]);
   assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'),'data:,');
   assert.equal(evidence.responses.some(r=>new URL(r.url).pathname==='/favicon.ico'),false);
  }
  const saved=await page.evaluate(()=>localStorage.getItem('mtt-static-translation.students.v1'));
  const parsed=JSON.parse(saved);assert.deepEqual(Object.keys(parsed).sort(),['current','students']);
  assert.equal(parsed.students.Live.length,260);
  for(const key of ['typing-kingdom-v1','typing-kingdom-v2'])assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'legacy-'+key);
  await page.reload();await page.waitForFunction(()=>!!window.translationSnapshot);
  assert.equal(await page.evaluate(()=>localStorage.getItem('mtt-static-translation.students.v1')),saved);
  evidence.badResponses=bad;evidence.passed=true;
 } catch(error) {evidence.error=error.stack;throw error;}
 finally {evidence.finished=new Date().toISOString();}
});
