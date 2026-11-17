import {test,expect} from '@playwright/test';
import {newStudent} from '../../recovered/control/student.mjs';
import {SAVE_KEY} from '../../app/session.mjs';
import {skipStartupUI} from './source-path.mjs';
const snap=page=>page.evaluate(()=>translationSnapshot());
const key=(page,k)=>page.locator('#game').press(k);
async function move(page,x,y) {
 const r=await page.locator('#game').boundingBox();
 await page.mouse.move(r.x+(x+.25)*r.width/320,r.y+(y+.25)*r.height/200);
}
async function ready(page,origin='menu') {
 await page.clock.install();await page.clock.pauseAt(new Date());
 await page.addInitScript(({key,bytes})=>{
  window.__sourceTestClock=true;
  localStorage.setItem(key,JSON.stringify({current:'ADA',students:{ADA:bytes}}));
  localStorage.setItem('typing-kingdom-v1','legacy1');localStorage.setItem('typing-kingdom-v2','legacy2');
 },{key:SAVE_KEY,bytes:Array.from(newStudent('ADA'))});
 await page.goto('./?seed=1');await skipStartupUI(page);
 if(origin==='results') {
  await key(page,'4');await key(page,'Escape');await page.clock.runFor(120);
 } else await key(page,'Enter'); // Open File suppresses random menu blinking.
 expect((await snap(page)).screen).toBe(origin);
}
async function pointerEvent(page,type,buttons,{x=111,y=92}={}) {
 await page.evaluate(({type,buttons,x,y})=>{
  const canvas=document.querySelector('#game'),r=canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,buttons,
   clientX:r.left+(x+.25)*r.width/320,clientY:r.top+(y+.25)*r.height/200}));
 },{type,buttons,x,y});
}

// Source FILE offsets and pinned member bytes are asserted in report.test.mjs:
// Report/About 0xe953/0x12195 -> 0x147f2, Keyboard 0x14669..0x1467f.
for(const [kind,origin,shortcut] of [['report','menu','5'],['about','menu','a'],['keyboard','menu','F2'],['keyboard','results','F2']])
 test(`${kind} Alt-X dismisses to ${origin}, never Quit, preserving caller pointer rules`,async({page})=>{
  await ready(page,origin);await move(page,91,82);await key(page,shortcut);
  expect((await snap(page)).screen).toBe(kind);await move(page,100,80);
  if(kind==='keyboard') {
   for(let i=0;i<3;i++)await key(page,'F1');
   await page.mouse.down();await page.mouse.up();
   expect((await snap(page)).screen).toBe('keyboard');
  }
  await key(page,'Alt+x');const s=await snap(page);
  expect(s.screen).toBe(origin);expect(s.modal).toBeNull();expect(s.inputPending).toBe(false);
  expect(s.pointer).toEqual(kind==='report'?{x:91,y:82}:{x:100,y:80});
  expect(s.cursor.visible).toBe(true);await expect(page.locator('#status')).toBeHidden();
  expect(await page.evaluate(()=>[localStorage.getItem('typing-kingdom-v1'),localStorage.getItem('typing-kingdom-v2')])).toEqual(['legacy1','legacy2']);
  await key(page,'F2');expect((await snap(page)).screen).toBe('keyboard');
 });

// Browser click-lifetime policy, not an EXE release-drain claim. The source
// repolls after drawing at modal entry; a held-at-entry release still qualifies.
for(const kind of ['report','about'])for(const button of ['left','right'])
 test(`${kind} mouse opener survives its release outside, then accepts a fresh ${button} press`,async({page})=>{
  await ready(page);
  if(kind==='report')await key(page,'Escape'); // Close File to expose Report.
  await move(page,...(kind==='report'?[250,145]:[30,12]));
  const opener=(await snap(page)).pointer;
  await page.mouse.down();expect((await snap(page)).screen).toBe(kind);
  await page.mouse.move(0,0);await page.mouse.up();
  expect((await snap(page)).screen).toBe(kind);
  await page.mouse.move(1,1);expect((await snap(page)).screen).toBe(kind);
  await page.mouse.down({button});const s=await snap(page);
  expect(s.screen).toBe('menu');expect(s.modal).toBeNull();expect(s.inputPending).toBe(false);
  if(kind==='report')expect(s.pointer).toEqual(opener);
  await page.mouse.up({button});await expect(page.locator('#status')).toBeHidden();
 });

for(const kind of ['report','about'])
 test(`${kind} mouse entry consumes only its left release, not a held right release or chord change`,async({page})=>{
  await ready(page);
  for(const after of [0,3]) {
   if(kind==='report')await key(page,'Escape');
   const position=kind==='report'?{x:250,y:145}:{x:30,y:12};
   await pointerEvent(page,'pointermove',2,position);
   await pointerEvent(page,'pointerdown',3,position);expect((await snap(page)).screen).toBe(kind);
   await pointerEvent(page,'pointerup',2);expect((await snap(page)).screen).toBe(kind);
   // A right release (2->0) or fresh left press (2->3) must still dismiss.
   await pointerEvent(page,after?'pointerdown':'pointerup',after);
   expect((await snap(page)).screen).toBe('menu');
   await pointerEvent(page,'pointerup',0);
   if(kind==='about')await key(page,'Enter');
  }
 });

for(const kind of ['report','about'])
 test(`${kind} dismissal before opener release cannot suppress a later keyboard entry release`,async({page})=>{
  await ready(page);
  if(kind==='report')await key(page,'Escape');
  await move(page,...(kind==='report'?[250,145]:[30,12]));await page.mouse.down();
  expect((await snap(page)).screen).toBe(kind);await key(page,'Alt+x');
  expect((await snap(page)).screen).toBe('menu');
  await key(page,kind==='report'?'5':'a');expect((await snap(page)).screen).toBe(kind);
  await page.mouse.up();expect((await snap(page)).screen).toBe('menu');
 });

for(const kind of ['report','about'])for(const held of ['left','right','both'])
 test(`${kind} snapshots held ${held} and dismisses on release outside canvas`,async({page})=>{
  await ready(page);await move(page,10,100);
  if(held!=='right')await page.mouse.down({button:'left'});
  if(held!=='left')await page.mouse.down({button:'right'});
  await key(page,kind==='report'?'5':'a');expect((await snap(page)).screen).toBe(kind);
  await move(page,100,90);expect((await snap(page)).screen).toBe(kind);
  await page.mouse.move(0,0);expect((await snap(page)).screen).toBe(kind);
  await page.mouse.up({button:held==='left'?'left':'right'});
  const s=await snap(page);expect(s.screen).toBe('menu');expect(s.modal).toBeNull();
  expect(s.pointer).toEqual(kind==='report'?{x:10,y:100}:{x:100,y:90});
  expect(s.cursor.inside).toBe(false);await expect(page.locator('#status')).toBeHidden();
  if(held==='both')await page.mouse.up({button:'left'});
 });

for(const kind of ['report','about'])
 test(`${kind} compares whole masks, ignoring unchanged down/up and movement`,async({page})=>{
  await ready(page);
  // 1->3 leaves the left bit set, 3->2 clears it while right remains held.
  // A browser mouse chord can produce pointermove instead of down/up.
  for(const [before,after,type] of [[0,1,'pointerdown'],[0,2,'pointerdown'],[1,3,'pointermove'],[3,1,'pointermove'],[3,2,'pointermove'],[2,0,'pointerup'],[3,0,'pointerup']]) {
   await pointerEvent(page,'pointermove',before,{x:91,y:82});
   await key(page,kind==='report'?'5':'a');expect((await snap(page)).screen).toBe(kind);
   for(const unchanged of ['pointermove','pointerdown','pointerup']) {
    await pointerEvent(page,unchanged,before);expect((await snap(page)).screen).toBe(kind);
   }
   await pointerEvent(page,type,after);const s=await snap(page);
   expect(s.screen).toBe('menu');expect(s.inputPending).toBe(false);
   expect(s.pointer).toEqual(kind==='report'?{x:91,y:82}:{x:111,y:92});
   await pointerEvent(page,'pointerup',0);
  }
 });

for(const origin of ['menu','results'])
 test(`Help Alt-X retains existing browser Quit policy from ${origin}`,async({page})=>{
  await ready(page,origin);await key(page,'F1');const before=await snap(page);
  await key(page,'Alt+x');const after=await snap(page);
  expect(after.screen).toBe('help');expect(after.modal).toEqual(before.modal);expect(after.pointer).toEqual(before.pointer);
  await key(page,'Escape');expect((await snap(page)).screen).toBe(origin);
  if(origin==='menu') {
   await key(page,'Alt+x');expect((await snap(page)).screen).toBe('menu');
   await key(page,'F2');expect((await snap(page)).screen).toBe('keyboard');
  }
  await expect(page.locator('#status')).toBeHidden();
 });
