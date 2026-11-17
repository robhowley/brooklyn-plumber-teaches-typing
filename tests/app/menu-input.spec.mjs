import {test,expect} from '@playwright/test';
import {newStudent} from '../../recovered/control/student.mjs';
import {SAVE_KEY} from '../../app/session.mjs';
import {skipStartupUI} from './source-path.mjs';
const snap=page=>page.evaluate(()=>translationSnapshot());
const key=(page,k)=>page.locator('#game').press(k);
async function point(page,x,y,click=true) {
 const r=await page.locator('#game').boundingBox(),p=[r.x+(x+.25)*r.width/320,r.y+(y+.25)*r.height/200];
 if(click)await page.mouse.click(...p);else await page.mouse.move(...p);
}
async function ready(page) {
 await page.clock.install();await page.clock.pauseAt(new Date());
 await page.addInitScript(({key,bytes})=>{
  window.__sourceTestClock=true;
  localStorage.setItem(key,JSON.stringify({current:'ADA',students:{ADA:bytes}}));
  localStorage.setItem('typing-kingdom-v1','legacy1');localStorage.setItem('typing-kingdom-v2','legacy2');
 },{key:SAVE_KEY,bytes:Array.from(newStudent('ADA'))});
 await page.goto('./?seed=1');await skipStartupUI(page);
}
async function finishBlink(page) {
 for(let i=0;i<4;i++)await page.clock.runFor(56);
}

for(const field of ['name','goal'])for(const ending of ['Escape','Enter','ArrowUp'])
 test(`Preferences pointer ${field}, ${ending} retains keyboard selection for Enter, Tab and backward navigation`,async({page})=>{
  await ready(page);await key(page,'e');await key(page,'Tab');
  const selection=field==='name'?1:0,selectedField=selection?'goal':'name';
  if(selection)await key(page,'Tab');
  await point(page,field==='name'?180:150,field==='name'?74:94);
  let s=await snap(page);expect(s.studentUI.selection).toBe(selection);expect(s.studentUI.field.name).toBe(field);
  await key(page,field==='name'?'z':'9');await key(page,ending);
  s=await snap(page);expect(s.screen).toBe('student');expect(s.studentUI.field).toBeNull();expect(s.studentUI.selection).toBe(selection);
  expect(s.profile[field]).toBe(ending==='Escape'?(field==='name'?'ADA':5):(field==='name'?'ZADA':9));
  await key(page,'Enter');expect((await snap(page)).studentUI.field.name).toBe(selectedField);
  await key(page,'ArrowDown');expect((await snap(page)).studentUI.selection).toBe(selection);
  await key(page,'Tab');s=await snap(page);expect(s.studentUI.selection).toBe(selection+1);
  expect(s.pointer).toEqual(selection?{x:89,y:157}:{x:154,y:94});
  // The source's backward positioning keys are Left/Up, not Shift+Tab.
  await key(page,'ArrowLeft');expect((await snap(page)).studentUI.selection).toBe(selection);
  await key(page,'Enter');expect((await snap(page)).studentUI.field.name).toBe(selectedField);
  await key(page,'Escape');await key(page,'Escape');expect((await snap(page)).screen).toBe('menu');
 });

for(const ending of ['Escape','Enter','ArrowUp'])
 test(`Times pointer edit, ${ending} retains index, Enter follows pointer and navigation follows index`,async({page})=>{
  await ready(page);await key(page,'t');await key(page,'Tab');await key(page,'Tab');
  await point(page,200,115);let s=await snap(page);
  expect(s.studentUI.selection).toBe(1);expect(s.studentUI.field.name).toBe('2');
  await key(page,'9');await key(page,ending);s=await snap(page);
  expect(s.studentUI.selection).toBe(1);expect(s.studentUI.field).toBeNull();expect(s.screen).toBe('times');
  expect(s.profile.durations[2]).toBe(ending==='Escape'?5:9);
  await key(page,'Enter');s=await snap(page);expect(s.studentUI.field.name).toBe('2');expect(s.studentUI.selection).toBe(1);
  await key(page,'ArrowDown');expect((await snap(page)).studentUI.selection).toBe(1);
  await key(page,'Tab');s=await snap(page);expect(s.studentUI.selection).toBe(2);expect(s.pointer).toEqual({x:202,y:115});
  await key(page,'ArrowLeft');s=await snap(page);expect(s.studentUI.selection).toBe(1);expect(s.pointer).toEqual({x:202,y:95});
  await point(page,285,182,false);await key(page,'Enter');expect((await snap(page)).screen).toBe('menu');
 });

for(const pointerFirst of [false,true]) {
 test(`queued Practice key precedes Water press after blink, pointer queued ${pointerFirst?'first':'last'}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
  await point(page,60,55);expect((await snap(page)).menuIdle.waiting.count).toBe(1);
  if(pointerFirst)await point(page,250,55);
  await key(page,'4');
  if(!pointerFirst)await point(page,250,55);
  let s=await snap(page);expect(s.screen).toBe('menu');expect(s.inputPending).toBe(true);expect(s.cursor.visible).toBe(false);
  for(let i=0;i<3;i++) {await page.clock.runFor(56);expect((await snap(page)).screen).toBe('menu');}
  await page.clock.runFor(56);s=await snap(page);expect(s.screen).toBe('practice');expect(s.inputPending).toBe(false);
  // Activity entry flushes the retained browser press at the existing boundary.
  await key(page,'Escape');await page.clock.runFor(60);await key(page,'m');await page.clock.runFor(56);
  expect((await snap(page)).screen).toBe('menu');expect(errors).toEqual([]);
 });

 test(`menu keys each take one pump before retained File press, pointer queued ${pointerFirst?'first':'last'}`,async({page})=>{
  await ready(page);await point(page,60,55);const before=await snap(page);
  if(pointerFirst)await point(page,40,4);
  await key(page,'Enter');await key(page,'ArrowRight');
  if(!pointerFirst)await point(page,40,4);
  expect((await snap(page)).menu).toMatchObject({column:1,row:0});
  await finishBlink(page);let s=await snap(page);
  expect(s.screen).toBe('menu');expect(s.menu).toMatchObject({column:1,row:1});expect(s.inputPending).toBe(true);
  expect(s.menuIdle.waiting).toBeNull();expect(s.menuTimer).toEqual(before.menuTimer);expect(s.seed).toBe(before.seed);
  await page.clock.runFor(56);s=await snap(page);
  expect(s.menu).toMatchObject({column:2,row:1});expect(s.inputPending).toBe(false);
  // Browser press retention is an adaptation, not a recovered mouse FIFO.
  await page.clock.runFor(56);expect((await snap(page)).menu).toMatchObject({column:1,row:1});
 });
}

test('queued editor key precedes retained Water press and entry flush prevents later replay',async({page})=>{
 await ready(page);await point(page,60,55);await point(page,250,55);await key(page,'t');
 await finishBlink(page);let s=await snap(page);expect(s.screen).toBe('times');expect(s.studentUI.field).toBeNull();
 expect(s.studentUI.selection).toBe(4);await key(page,'Escape');await page.clock.runFor(56);
 s=await snap(page);expect(s.screen).toBe('menu');expect(s.inputPending).toBe(false);
 expect(await page.evaluate(()=>[localStorage.getItem('typing-kingdom-v1'),localStorage.getItem('typing-kingdom-v2')])).toEqual(['legacy1','legacy2']);
});
