import { test, expect } from '@playwright/test';
import {skipStartupUI,createStudentUI} from './source-path.mjs';
async function ready(page){await page.addInitScript(()=>{window.__sourceTestClock=true;});await page.goto('./?seed=1');await skipStartupUI(page);await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');}
async function point(page,x,y){const r=await page.locator('#game').boundingBox();await page.mouse.click(r.x+x*r.width/320,r.y+y*r.height/200);}
const snapshot=page=>page.evaluate(()=>translationSnapshot());
async function burst(page,keys) {
 await page.locator('#game').evaluate((game,keys)=>{
  for(const key of keys)game.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
 },keys);
}
test.describe('Practice keyboard bursts',()=>{
 test.beforeEach(async({page})=>{
  await page.clock.install();await ready(page);
  await page.clock.pauseAt(new Date(Math.ceil((await page.evaluate(()=>Date.now())+1000)/1000)*1000));
  await page.locator('#game').press('4');
  await expect(page.locator('#game')).toHaveAttribute('data-screen','practice');
 });
 test('paints the blinking 8x8 Practice cell and freezes its phase on blur',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const data=await page.evaluate(()=>fetch('./app/data.json').then(r=>r.json()));
  const palette=data.palettes['PRACTICE.CRX'];
  const cell=()=>page.evaluate(()=>{
   const s=translationSnapshot(),x=30+8*s.practice.index;
   return Array.from(document.querySelector('#game').getContext('2d').getImageData(x,96,8,8).data);
  });
  const check=async()=>{
   const s=await snapshot(page),index=s.practice.cursor.inverted?15:1;
   expect(await cell()).toEqual(Array.from({length:64},()=>[...palette.slice(index*3,index*3+3),255]).flat());
   return index;
  };
  const colors=new Set([await check()]);
  for(let n=0;n<8;n++) {await page.clock.runFor(60);colors.add(await check());}
  expect([...colors].sort((a,b)=>a-b)).toEqual([1,15]);
  const target=(await snapshot(page)).practice.rows[33];
  await page.locator('#game').press(String.fromCharCode(target));await page.clock.runFor(60);
  expect((await snapshot(page)).practice.index).toBe(1);await check();
  const old=await page.evaluate(()=>Array.from(document.querySelector('#game').getContext('2d').getImageData(30,96,8,8).data));
  const glyph=Array.from(atob(data.sprites[`FONT5H/font5_${target}`].pixels),c=>c.charCodeAt(0));
  expect(old).toEqual(glyph.flatMap(v=>[...palette.slice((v?1:15)*3,(v?1:15)*3+3),255]));
  await page.locator('#game').evaluate(game=>game.blur());
  const paused=await snapshot(page),pixels=await cell();await page.clock.runFor(30000);
  expect((await snapshot(page)).practice.cursor).toEqual(paused.practice.cursor);expect(await cell()).toEqual(pixels);
  await page.locator('#game').focus();
  expect((await snapshot(page)).practice.cursor).toMatchObject({inverted:paused.practice.cursor.inverted,left:paused.practice.cursor.left});
  await check();await page.clock.runFor(60);await check();expect(errors).toEqual([]);
 });
 test('consumes consecutive distinct targets in order at one sampled time',async({page})=>{
  const before=await snapshot(page),targets=before.practice.rows.slice(33,36);
  expect(new Set(targets).size).toBe(3);
  // Observe authored Session calls and browser clocks, not just equal frozen values.
  await page.evaluate(async()=>{
   const {Session}=await import(new URL('app/session.mjs',location.href));
   const step=Session.prototype.step,ticks=performance.now,seconds=Date.now;
   const reads={ticks:0,seconds:0};window.burstSamples=[];
   performance.now=function(){reads.ticks++;return ticks.call(this);};
   Date.now=function(){reads.seconds++;return seconds.call(this);};
   Session.prototype.step=function(key,tick,second){
    window.burstSamples.push({key,tick,second,reads:{...reads}});return step.apply(this,arguments);
   };
   window.restoreBurstClocks=()=>{performance.now=ticks;Date.now=seconds;Session.prototype.step=step;};
  });
  await burst(page,targets.map(c=>String.fromCharCode(c)));
  await page.clock.runFor(60);
  const samples=await page.evaluate(()=>{restoreBurstClocks();return burstSamples.slice(0,3);});
  expect(samples).toEqual(targets.map(key=>({key,tick:samples[0].tick,second:samples[0].second,reads:{ticks:1,seconds:1}})));
  const s=await snapshot(page);
  expect(s.practice).toMatchObject({index:3,attempts:3,correct:3,errors:0,lastCorrect:samples[0].second});
  expect(s.ticks-before.ticks).toBeGreaterThanOrEqual(1);expect(s.ticks-before.ticks).toBeLessThanOrEqual(2);
 });
 test('keeps wrong and ignored keys ordered across an exact line transition',async({page})=>{
  const before=await snapshot(page),line=before.practice.rows.slice(33,66).filter(Boolean),next=before.practice.rows.slice(66,99);
  const keys=line.map(c=>String.fromCharCode(c));
  await burst(page,[keys[0].toUpperCase(),'Backspace',...keys,'F10','Enter',...next.slice(0,3).map(c=>String.fromCharCode(c))]);
  await page.clock.runFor(60);const s=await snapshot(page),correct=line.length+4;
  expect(s.practice).toMatchObject({index:3,attempts:correct+1,correct,errors:1});
  expect(s.practice.rows.slice(33,66)).toEqual(next);
 });
 test('bounds the accepted prefix at 64 normalized events and drops newest overflow',async({page})=>{
  const targets=(await snapshot(page)).practice.rows.slice(33,35).map(c=>String.fromCharCode(c));
  await burst(page,[...Array(63).fill('F10'),...targets]);await page.clock.runFor(60);
  expect((await snapshot(page)).practice).toMatchObject({index:1,attempts:1,correct:1,errors:0});
  await burst(page,[...Array(64).fill('F10'),targets[1]]);await page.clock.runFor(60);
  expect((await snapshot(page)).practice).toMatchObject({index:1,attempts:1,correct:1});
  await burst(page,[targets[1]]);await page.clock.runFor(60);
  expect((await snapshot(page)).practice).toMatchObject({index:2,attempts:2,correct:2});
 });
 test('discards a queued burst on blur and ignores keys while suspended',async({page})=>{
  const targets=(await snapshot(page)).practice.rows.slice(33,36).map(c=>String.fromCharCode(c));
  await burst(page,targets);await page.locator('#game').evaluate(game=>game.blur());
  const paused=await snapshot(page);expect(paused.suspended).toBe(true);
  await burst(page,targets);await page.clock.runFor(600);
  expect((await snapshot(page)).ticks).toBe(paused.ticks);
  await page.locator('#game').focus();await page.clock.runFor(60);
  expect((await snapshot(page)).practice).toMatchObject({index:0,attempts:0,correct:0});
  await burst(page,targets);await page.clock.runFor(60);
  expect((await snapshot(page)).practice).toMatchObject({index:3,attempts:3,correct:3});
 });
 for(const route of ['n','m'])test(`stops at Escape and discards the tail before ${route==='n'?'Next':'Menu'}`,async({page})=>{
  const first=String.fromCharCode((await snapshot(page)).practice.rows[33]);
  await burst(page,[first,'Escape','n','m','4',first]);await page.clock.runFor(60);
  let s=await snapshot(page);expect(s.screen).toBe('results');
  expect(s.practice).toMatchObject({index:1,attempts:1,correct:1,errors:0,aborted:true});
  await page.clock.runFor(120);expect((await snapshot(page)).screen).toBe('results');
  await page.locator('#game').press(route);
  if(route==='m') {
   await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
   await page.clock.runFor(300);await page.locator('#game').press('4');
  }
  await page.clock.runFor(60);s=await snapshot(page);expect(s.screen).toBe('practice');
  expect(s.practice).toMatchObject({index:0,attempts:0,correct:0,aborted:false});
  await burst(page,[String.fromCharCode(s.practice.rows[33])]);await page.clock.runFor(60);
  expect((await snapshot(page)).practice).toMatchObject({index:1,attempts:1,correct:1});
 });
});
test('Practice original menu hit, case, ignored keys, exact line change, face and early Next',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await ready(page);
 await createStudentUI(page,{name:'PRACTICE',goal:10,durations:[undefined,undefined,undefined,1]});
 await point(page,250,116);await expect(page.locator('#game')).toHaveAttribute('data-screen','practice');
 let s=await snapshot(page);expect(s.corpusName).toBe('HWORDS');expect(s.practice.expression).toBe(0);expect(s.limit).toBe(60);
 const first=s.practice.rows[33];expect(first).toBeGreaterThanOrEqual(97);
 await page.locator('#game').press(String.fromCharCode(first).toUpperCase());await page.clock.runFor(60);
 s=await snapshot(page);expect(s.practice.errors).toBe(1);expect(s.practice.index).toBe(0);
 for(const key of ['Backspace','F10']){await page.locator('#game').press(key);await page.clock.runFor(60);}
 expect((await snapshot(page)).practice.attempts).toBe(1);
 await page.locator('#game').press(String.fromCharCode(first));await page.clock.runFor(60);
 expect((await snapshot(page)).practice.correct).toBe(1);expect((await snapshot(page)).practice.expression).not.toBe(0);
 s=await snapshot(page);const next=s.practice.rows.slice(66,99);
 while(s.practice.rows[33+s.practice.index]){
  await page.locator('#game').press(String.fromCharCode(s.practice.rows[33+s.practice.index]));await page.clock.runFor(60);s=await snapshot(page);
 }
 await page.locator('#game').press('Enter');await page.clock.runFor(60);s=await snapshot(page);
 expect(s.practice.index).toBe(0);expect(s.practice.rows.slice(33,66)).toEqual(next);
 await page.screenshot({path:'reports/browser/practice.png'});
 await page.clock.runFor(16000);expect((await snapshot(page)).practice.expression).toBe(0);expect((await snapshot(page)).screen).toBe('practice');
 await page.locator('#game').press('Escape');await page.clock.runFor(60);await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 expect((await snapshot(page)).profile.lesson).toBe(1);
 await point(page,78,184);await expect(page.locator('#game')).toHaveAttribute('data-screen','practice');
 expect((await snapshot(page)).profile.mode).toBe(4);expect(errors).toEqual([]);
});
test('Practice consumes the pending key once on the timeout iteration before saving results',async({page})=>{
 await page.clock.install();await ready(page);
 await createStudentUI(page,{name:'BOUNDARY',durations:[undefined,undefined,undefined,1]});
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 await page.locator('#game').press('4');
 await page.clock.runFor(59900);
 let s=await snapshot(page);
 for(let n=0;n<100&&s.ticks<1091;n++) {await page.clock.runFor(1);s=await snapshot(page);}
 expect(s.ticks).toBe(1091);expect(s.screen).toBe('practice');
 const target=s.practice.rows[33];
 await page.locator('#game').press(String.fromCharCode(target));await page.clock.runFor(60);
 s=await snapshot(page);
 expect(s.screen).toBe('results');expect(s.ticks).toBe(1092);
 expect(s.practice).toMatchObject({attempts:1,correct:1,errors:0,index:1,aborted:false});
 expect(s.result).toMatchObject({accuracy:100,elapsedSeconds:60});expect(s.profile.accuracy).toBe(100);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mtt-static-translation.students.v1')));
 expect(saved.students.BOUNDARY[19]).toBe(100);
 const completed=s.practice;
 await page.clock.runFor(1000);expect((await snapshot(page)).practice).toEqual(completed);
});
test('Practice focus pause excludes time; duration ends with zero accuracy and no invented failure',async({page})=>{
 await page.clock.install();await ready(page);await createStudentUI(page,{name:'TIMER',durations:[undefined,undefined,undefined,1]});await page.locator('#game').press('4');
 await page.clock.runFor(10000);await page.locator('#game').evaluate(c=>c.blur());
 const before=await snapshot(page);await page.clock.runFor(90000);expect((await snapshot(page)).ticks).toBe(before.ticks);
 await page.locator('#game').focus();await page.clock.runFor(51000);
 await expect(page.locator('#game')).toHaveAttribute('data-screen','results');const s=await snapshot(page);
 expect(s.result.elapsedSeconds).toBe(60);expect(s.practice.aborted).toBe(false);expect(s.result.wpm).toBe(0);expect(s.profile.lesson).toBe(1);
});
test('outside naturally activates bonus and BAN/ANI playback freezes mechanics and statistics',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await ready(page);await page.locator('#game').press('1');
 let s=await snapshot(page);
 for(let i=0;i<200&&s.bonus.mode!==2;i++){await page.clock.runFor(60);s=await snapshot(page);}
 expect(s.bonus.mode).toBe(2);await page.locator('#game').press(String.fromCharCode(s.bonus.code));await page.clock.runFor(60);
 s=await snapshot(page);expect(s.cinematic).not.toBeNull();const ticks=s.ticks,x=s.outdoor.x;
 await page.screenshot({path:'reports/browser/bonus.png'});
 await page.locator('#game').press('a');await page.clock.runFor(2000);s=await snapshot(page);
 expect(s.cinematic.frame).toBeGreaterThan(0);expect(s.ticks).toBe(ticks);expect(s.outdoor.x).toBe(x);expect(s.outdoor.attempts).toBe(0);
 await page.clock.runFor(5000);expect((await snapshot(page)).cinematic).toBeNull();expect((await snapshot(page)).ticks).toBeGreaterThan(ticks);
 expect(errors).toEqual([]);
});
test('Outside to Practice to Outside keeps source counters and clock with fresh entry state',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await ready(page);
 // install() keeps time advancing; only runFor() should tick between entry snapshots.
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 await page.locator('#game').press('1');
 await page.clock.runFor(180);await page.locator('#game').press('Escape');await page.clock.runFor(60);
 const old=await snapshot(page);expect(old.screen).toBe('results');
 const fields=['cursorCounter','groundPhase','stillTicks','idleTicks','distance'];
 await page.locator('#game').press('n');let s=await snapshot(page);
 expect(fields.map(k=>s.outdoor[k])).toEqual(fields.map(k=>old.outdoor[k]));
 expect(s.bonus.lastSecond).toBe(old.bonus.lastSecond);expect(s.outdoor.x).toBe(20);
 await page.locator('#game').press('Escape');await page.clock.runFor(60);
 const retained=await snapshot(page);
 await page.locator('#game').press('m');await page.locator('#game').press('4');
 s=await snapshot(page);await page.locator('#game').press(String.fromCharCode(s.practice.rows[33]));await page.clock.runFor(60);
 await page.locator('#game').press('Escape');await page.clock.runFor(60);
 const practice=await snapshot(page);
 await page.locator('#game').press('m');await page.clock.runFor(300);await page.locator('#game').press('1');s=await snapshot(page);
 expect(fields.map(k=>s.outdoor[k])).toEqual(fields.map(k=>retained.outdoor[k]));
 expect(s.bonus.lastSecond).toBe(retained.bonus.lastSecond);
 expect(s.outdoor.attempts).toBe(0);expect(s.outdoor.scroll).toBe(1);
 await page.locator('#game').press('Escape');await page.clock.runFor(60);
 await page.locator('#game').press('m');await page.locator('#game').press('4');
 expect((await snapshot(page)).practice.lastCorrect).toBe(practice.practice.lastCorrect);
 expect(errors).toEqual([]);
});
test('new and reloaded students can select every activity at the default goal',async({page})=>{
 await page.clock.install();await ready(page);await createStudentUI(page,{name:'OPEN'});
 const game=page.locator('#game');
 for(const reloaded of [false,true]) {
  if(reloaded) {await page.reload();await skipStartupUI(page);}
  for(const [index,screen] of ['outdoor','water','castle','practice'].entries()) {
   await page.clock.runFor(300);
   const bounds=await game.boundingBox(),x=bounds.x+250*bounds.width/320,y=bounds.y+(20+index*31)*bounds.height/200;
   await page.mouse.move(x,y);await expect.poll(async()=> (await snapshot(page)).cursor.visible).toBe(true);await expect(game).toHaveCSS('cursor','none');
   if(reloaded)await page.mouse.click(x,y);else await game.press(String(index+1));
   await page.clock.runFor(300);await expect(game).toHaveAttribute('data-screen',screen);
   expect((await snapshot(page)).profile).toMatchObject({name:'OPEN',goal:5,lesson:1,character:1,completed:[0,0,0],durations:[2,5,5,10]});
   await game.press('Escape');await page.clock.runFor(180);await expect(game).toHaveAttribute('data-screen','results');
   await game.press('m');await expect(game).toHaveAttribute('data-screen','menu');
  }
 }
});
test('guest mode and unavailable assets/storage are visible',async({page})=>{
 await page.clock.install();await ready(page);expect((await snapshot(page)).profile.profilePresent).toBe(false);
 await page.locator('#game').press('4');await page.locator('#game').press('Escape');await page.clock.runFor(60);await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
 expect(await page.evaluate(()=>localStorage.getItem('mtt-static-translation.students.v1'))).toBeNull();
 await page.addInitScript(()=>{Storage.prototype.getItem=function(){throw new Error('test storage blocked');};});
 await page.reload();await skipStartupUI(page);await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');await expect(page.locator('#status')).toContainText('Storage unavailable');
 await page.locator('#game').press('4');await expect(page.locator('#status')).toContainText('Storage unavailable');
 await page.route('**/assets/app/MOUT.backgrounds.indices',route=>route.fulfill({status:404,body:'missing'}));
 await page.reload();await expect(page.locator('#status')).toContainText('Missing bonus frames');
});
