import {test,expect} from '@playwright/test';
import {skipStartupUI} from './source-path.mjs';
import {newStudent,readStudent,studentForSave} from '../../recovered/control/student.mjs';
import {editStudent,SAVE_KEY} from '../../app/session.mjs';

const snap=page=>page.evaluate(()=>translationSnapshot());
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY);
const legacy={'typing-kingdom-v1':'old-v1','typing-kingdom-v2':'old-v2'};
async function ready(page,mode,{ending4=false}={}) {
 const bytes=Array.from(editStudent(newStudent('ADA'),{goal:ending4?30:1,lesson:ending4?6:1,minutes:1,waterMinutes:1,castleMinutes:1}));
 const other=Array.from(newStudent('BOB'));
 await page.clock.install();await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 await page.addInitScript(({key,bytes,other,legacy})=>{
  window.__sourceTestClock=true;
  if(localStorage.getItem(key)===null) {
   localStorage.setItem(key,JSON.stringify({current:'ADA',students:{ADA:bytes,BOB:other}}));
   for(const [key,value] of Object.entries(legacy))localStorage.setItem(key,value);
  }
 },{key:SAVE_KEY,bytes,other,legacy});
 await page.goto('./?seed=1');await skipStartupUI(page);await page.locator('#game').press(String(mode));
 await page.waitForFunction(()=>!translationSnapshot().audioHost.blocking);
 return other;
}
async function typeCodes(page,codes) {
 await page.evaluate(codes=>{
  const game=document.querySelector('#game');
  for(const code of codes)game.dispatchEvent(new KeyboardEvent('keydown',{key:String.fromCharCode(code),bubbles:true}));
 },codes);
}
async function reachCelebration(page,mode,{ending4=false}={}) {
 let s=await snap(page);
 // Real source targets and clock callbacks only, no controller/stat mutations.
 for(let i=0;(mode===1?s.outdoor.correct:mode===2?s.water.stats.correct:s.castle.stats.correct)<(ending4?240:8);i++) {
  expect(i).toBeLessThan(3000);
  if(mode===1&&s.outdoor.targetIndex>=0)await typeCodes(page,[s.outdoor.obstacles[s.outdoor.targetIndex].code]);
  else if(mode===2)await typeCodes(page,s.water.window.slice(10,18));
  else if(mode===3&&!s.castle.locked&&['rockfaces','sand'].includes(s.castle.phase))await typeCodes(page,[s.castle.target]);
  await page.clock.runFor(60);s=await snap(page);
 }
 for(let i=0;s.screen!=='celebration';i++) {
  expect(i).toBeLessThan(12);await page.locator('#game').press('Tab');await page.clock.runFor(10000);s=await snap(page);
 }
 expect(s.screen).toBe('celebration');return s;
}
async function finalWait(page) {
 for(let i=0;i<1200;i++) {
  const s=await snap(page);if(s.celebration.wait==='wait-input')return;
  await page.clock.runFor(60);
 }
 throw new Error('Final source input wait not reached');
}
async function assertSaved(page,other) {
 const s=await snap(page),value=await saved(page);
 expect(s.screen).toBe('results');expect(Object.keys(value).sort()).toEqual(['current','students']);expect(value.current).toBe('ADA');
 expect(value.students.BOB).toEqual(other);expect(Object.keys(value.students).sort()).toEqual(['ADA','BOB']);
 expect(value.students.ADA).toHaveLength(260);
 expect(value.students.ADA.every(n=>Number.isInteger(n)&&n>=0&&n<=255)).toBe(true);
 expect(value.students.ADA.slice(0,4)).toEqual([26,83,84,85]);expect(value.students.ADA[27]).toBe(0);
 expect(readStudent(Uint8Array.from(value.students.ADA))).toEqual(s.profile);
 expect(Array.from(studentForSave(Uint8Array.from(value.students.ADA)))).toEqual(value.students.ADA);
 expect(await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),Object.keys(legacy))).toEqual(legacy);
 return value;
}
async function reloadSaved(page,value) {
 await page.reload();await skipStartupUI(page);
 expect((await snap(page)).profile).toEqual(readStudent(Uint8Array.from(value.students.ADA)));
 expect(await saved(page)).toEqual(value);
}
for(const mode of [1,2,3])for(const input of ['pointerdown','pointerup','keyboard'])test(`world${mode} ${input} saves in completing callback before Menu/reload`,async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const other=await ready(page,mode),before=await saved(page);
 const bounds=await page.locator('#game').boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
 // Hold before the animation: Water may already reach its final wait in the timeout callback batch.
 if(input==='pointerup')await page.mouse.down();
 await reachCelebration(page,mode);await finalWait(page);expect(await saved(page)).toEqual(before);
 if(input==='keyboard') {
  await page.locator('#game').press('Space');
  for(let i=0;(await snap(page)).screen==='celebration';i++) {expect(i).toBeLessThan(3);await page.clock.runFor(55);}
 } else if(input==='pointerup')await page.mouse.up();else await page.mouse.down();
 // Time stays frozen: pointer callbacks must save before any interval can run.
 const value=await assertSaved(page,other);expect((await snap(page)).profile.lesson).toBe(2);
 if(input==='pointerdown') {await page.locator('#game').press('m');expect((await snap(page)).screen).toBe('menu');}
 await reloadSaved(page,value);expect(errors).toEqual([]);
});
test('celebration storage failure keeps Results and the existing in-memory warning',async({page})=>{
 await ready(page,2);const before=await saved(page);await reachCelebration(page,2);await finalWait(page);
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('blocked celebration save');};});
 await page.locator('#game').dispatchEvent('pointerdown',{button:0});
 expect((await snap(page)).screen).toBe('results');expect((await snap(page)).profile.lesson).toBe(2);
 await expect(page.locator('#status')).toContainText('Browser storage unavailable (blocked celebration save). Student changes remain in memory only.');
 expect(await saved(page)).toEqual(before);
});
test('Castle repeating ending ignores pointers and saves completed flag on keyboard return',async({page})=>{
 test.setTimeout(120000);
 const other=await ready(page,3,{ending4:true}),before=await saved(page);
 let s=await reachCelebration(page,3,{ending4:true});expect(s.castle.ending.mode).toBe(4);expect(s.profile.completed[2]).toBe(0);
 await page.clock.runFor(2000);
 await page.locator('#game').dispatchEvent('pointerdown',{button:0});await page.locator('#game').dispatchEvent('pointerup',{button:0});
 expect((await snap(page)).screen).toBe('celebration');expect(await saved(page)).toEqual(before);
 await page.locator('#game').press('Space');
 for(let i=0;(await snap(page)).screen==='celebration';i++) {expect(i).toBeLessThan(5);await page.clock.runFor(55);}
 s=await snap(page);expect(s.profile.completed[2]).toBe(1);expect(s.castle.endingAck).toEqual({type:'ending-acknowledged',omitted:false});
 const value=await assertSaved(page,other);await reloadSaved(page,value);
});
