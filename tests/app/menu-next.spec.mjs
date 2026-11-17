import {test,expect} from '@playwright/test';
import {newStudent,readStudent,studentForSave} from '../../recovered/control/student.mjs';
import {editStudent,SAVE_KEY} from '../../app/session.mjs';
import {skipStartupUI} from './source-path.mjs';
const snap=page=>page.evaluate(()=>translationSnapshot());
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY);
const legacy={'typing-kingdom-v1':'old-v1','typing-kingdom-v2':'old-v2'};
const other=Array.from(newStudent('BOB'));
async function ready(page,{guest=false}={}) {
 const bytes=editStudent(newStudent('ADA'),{goal:30,lesson:6});
 new DataView(bytes.buffer).setInt16(15,2,true);new DataView(bytes.buffer).setInt16(68,7,true);
 bytes.set([1,1,0,0,1,0,0,0,1],38);
 await page.clock.install();await page.clock.pauseAt(new Date());
 await page.addInitScript(({key,bytes,other,legacy,guest})=>{
  window.__sourceTestClock=true;
  if(!guest&&localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify({current:'ADA',students:{ADA:bytes,BOB:other}}));
  for(const [key,value] of Object.entries(legacy))if(localStorage.getItem(key)===null)localStorage.setItem(key,value);
 },{key:SAVE_KEY,bytes:Array.from(bytes),other,legacy,guest});
 await page.goto('./?seed=1');await skipStartupUI(page);
}
async function observeWrites(page) {
 await page.evaluate(key=>{
  const setItem=Storage.prototype.setItem;window.nextWrites=[];
  Storage.prototype.setItem=function(k,value) {
   if(k===key)window.nextWrites.push({screen:translationSnapshot().screen,profile:translationSnapshot().profile,value:JSON.parse(value)});
   return setItem.call(this,k,value);
  };
 },SAVE_KEY);
}
async function menuNext(page,input) {
 if(input==='key')await page.locator('#game').press('n');
 else {
  const r=await page.locator('#game').boundingBox();
  await page.mouse.click(r.x+267.25*r.width/320,r.y+175.25*r.height/200);
 }
}
async function checkSaved(page,value) {
 expect(Object.keys(value).sort()).toEqual(['current','students']);expect(value.current).toBe('ADA');
 expect(Object.keys(value.students).sort()).toEqual(['ADA','BOB']);expect(value.students.BOB).toEqual(other);
 expect(value.students.ADA).toHaveLength(260);
 expect(value.students.ADA).toEqual(Array.from(studentForSave(Uint8Array.from(value.students.ADA))));
 const p=readStudent(Uint8Array.from(value.students.ADA));
 expect([p.mode,p.lesson]).toEqual([3,1]);expect(p.completed).toEqual([1,1,0]);
 expect(p.printed).toEqual([0,1,0]);expect(p.pending).toEqual([1,0,1]);
 expect(await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(legacy))).toEqual(legacy);
}
for(const input of ['key','pointer'])test(`Main Next ${input} saves queued bytes before entry resets errors, survives reload`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
 const before=await saved(page);await observeWrites(page);await menuNext(page,input);
 const s=await snap(page),value=await saved(page),writes=await page.evaluate(()=>nextWrites);
 expect(s.screen).toBe('castle');expect(s.profile.errorCounts.every(n=>n===0)).toBe(true);
 expect(writes).toHaveLength(1);expect(writes[0].screen).toBe('menu');
 expect([writes[0].profile.mode,writes[0].profile.lesson]).toEqual([3,1]);expect(writes[0].profile.pending).toEqual([1,0,1]);
 expect(writes[0].profile.errorCounts[0]).toBe(7);expect(writes[0].value).toEqual(value);
 const expected=studentForSave(Uint8Array.from(before.students.ADA)),v=new DataView(expected.buffer);
 v.setInt16(15,3,true);v.setInt16(25,1,true);expected.set([1,0,1],44);
 expect(value.students.ADA).toEqual(Array.from(expected));await checkSaved(page,value);
 await page.reload();await skipStartupUI(page);
 expect((await snap(page)).profile).toEqual(readStudent(Uint8Array.from(value.students.ADA)));
 expect(await saved(page)).toEqual(value);expect(errors).toEqual([]);
});

test('Main and real Results Next persist identical student bytes and routes',async({page})=>{
 await ready(page);await page.locator('#game').press('2');
 for(let i=0;(await snap(page)).screen!=='results';i++) {
  expect(i).toBeLessThan(10);await page.locator('#game').press('Escape');await page.clock.runFor(60);
 }
 const before=await saved(page);expect(readStudent(Uint8Array.from(before.students.ADA))).toEqual((await snap(page)).profile);
 await observeWrites(page);await page.locator('#game').press('n');
 const results=await saved(page),resultProfile=(await snap(page)).profile;
 const resultWrites=await page.evaluate(()=>nextWrites);
 expect(resultWrites).toHaveLength(1);expect(resultWrites[0].screen).toBe('results');await checkSaved(page,results);
 // Reload the exact pre-Next record into Main, rather than fabricating Results.
 await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:SAVE_KEY,value:before});
 await page.reload();await skipStartupUI(page);await observeWrites(page);await menuNext(page,'key');
 expect((await snap(page)).screen).toBe('castle');expect((await snap(page)).profile).toEqual(resultProfile);
 expect(await saved(page)).toEqual(results);const menuWrites=await page.evaluate(()=>nextWrites);
 expect(menuWrites).toHaveLength(1);expect(menuWrites[0].screen).toBe('menu');
});

test('guest Next routes without saving, Demo Next does nothing and legacy keys survive',async({page})=>{
 await ready(page,{guest:true});await observeWrites(page);await menuNext(page,'key');
 expect((await snap(page)).screen).toBe('outdoor');expect(await saved(page)).toBeNull();
 await page.locator('#game').press('Escape');await page.clock.runFor(60);await page.locator('#game').press('m');
 await page.locator('#game').press('d');const before=await snap(page);expect(before.profile.demo).toBe(true);
 for(const input of ['key','pointer']) {
  await menuNext(page,input);const s=await snap(page);expect(s.screen).toBe('menu');expect(s.profile).toEqual(before.profile);
 }
 expect(await page.evaluate(()=>nextWrites)).toEqual([]);expect(await saved(page)).toBeNull();
 expect(await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(legacy))).toEqual(legacy);
});
