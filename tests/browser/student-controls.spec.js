import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {boot,openMenu,fixture,stored,selectedStudent} from './helpers.js';

const evidence=resolve(process.env.FIDELITY_EVIDENCE||'.tmp/student-controls');
async function trackStudentWrites(page){
 await page.addInitScript(()=>{
  const original=Storage.prototype.setItem;
  window.studentWriteCount=0;window.trackStudentWrites=false;
  Storage.prototype.setItem=function(key,value){
   if(window.trackStudentWrites&&key==='typing-kingdom-v2')window.studentWriteCount++;
   return original.call(this,key,value);
  };
 });
}
async function resetStudentWrites(page){await page.evaluate(()=>{window.studentWriteCount=0;window.trackStudentWrites=true;});}
async function studentWrites(page){return page.evaluate(()=>window.studentWriteCount);}
async function openStudentForm(page,action){await openMenu(page,'Student');await page.locator(`#${action}`).click();await expect(page.locator('#student-form')).toBeVisible();}

test('Done creates one student and uses native required validation',async({page})=>{
 await trackStudentWrites(page);await boot(page,{data:null});await openStudentForm(page,'new-student');
 const name=page.getByLabel('Name',{exact:true});
 await expect(page.locator('#student-done')).toHaveAttribute('aria-label','Create student');
 await expect(page.locator('#student-done')).toHaveText('Done');
 await expect(page.locator('#student-form button')).toHaveCount(0);
 await resetStudentWrites(page);await page.locator('#student-done').click();
 await expect(name).toBeFocused();expect(await studentWrites(page)).toBe(0);
 expect(await name.evaluate(input=>input.validity.valueMissing)).toBe(true);
 await name.fill('   ');await page.locator('#student-done').click();
 await expect(name).toBeFocused();expect(await name.evaluate(input=>input.validity.customError)).toBe(true);
 expect(await studentWrites(page)).toBe(0);
 await name.fill('Created once');await page.getByLabel('Character').selectOption('Princess');
 await page.getByLabel('Activity goal').fill('12');await resetStudentWrites(page);
 await page.locator('#student-done').click();
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');
 expect(await selectedStudent(page)).toMatchObject({name:'Created once',character:'Princess',settings:{goal:12}});
 expect((await stored(page)).students).toHaveLength(2);expect(await studentWrites(page)).toBe(1);
 await expect(page.locator('#new-student')).toBeFocused();
});

test('Enter edits and saves the existing student once',async({page})=>{
 await trackStudentWrites(page);await boot(page,{data:fixture()});await openStudentForm(page,'edit-student');
 await expect(page.locator('#student-done')).toHaveAttribute('aria-label','Save student');
 await page.getByLabel('Name',{exact:true}).fill('Edited once');await page.getByLabel('Activity goal').fill('18');
 await resetStudentWrites(page);await page.keyboard.press('Enter');
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');
 expect(await selectedStudent(page)).toMatchObject({name:'Edited once',settings:{goal:18}});
 expect((await stored(page)).students).toHaveLength(1);expect(await studentWrites(page)).toBe(1);
 await expect(page.locator('#edit-student')).toBeFocused();
});

test('Cancel discards create and edit changes and returns menu focus',async({page})=>{
 await trackStudentWrites(page);await boot(page,{data:fixture()});
 const baseline=JSON.stringify(await stored(page));
 await openStudentForm(page,'new-student');await page.getByLabel('Name',{exact:true}).fill('Not saved');
 await resetStudentWrites(page);await page.locator('#back').click();
 expect(JSON.stringify(await stored(page))).toBe(baseline);expect(await studentWrites(page)).toBe(0);
 await expect(page.locator('#new-student')).toBeFocused();
 await openStudentForm(page,'edit-student');await page.getByLabel('Name',{exact:true}).fill('Also not saved');
 await page.getByLabel('Activity goal').fill('31');await resetStudentWrites(page);await page.locator('#back').click();
 expect(JSON.stringify(await stored(page))).toBe(baseline);expect(await studentWrites(page)).toBe(0);
 await expect(page.locator('#edit-student')).toBeFocused();
});

test('native student actions stay keyboard-visible, large and usable at 390/720/1280px',async({page})=>{
 await boot(page,{data:fixture()});await openStudentForm(page,'edit-student');
 await mkdir(resolve(evidence,'screenshots'),{recursive:true});
 for(const [width,height] of [[390,844],[720,450],[1280,800]]){
  await page.setViewportSize({width,height});
  const panel=page.locator('.original-panel--student'),done=page.locator('#student-done'),cancel=page.locator('#back');
  const panelBox=await panel.boundingBox(),doneBox=await done.boundingBox(),cancelBox=await cancel.boundingBox();
  expect(await panel.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
  expect(doneBox.width).toBeGreaterThanOrEqual(44);expect(doneBox.height).toBeGreaterThanOrEqual(44);
  expect(cancelBox.width).toBeGreaterThanOrEqual(44);expect(cancelBox.height).toBeGreaterThanOrEqual(44);
  expect(cancelBox.x+cancelBox.width).toBeLessThan(doneBox.x);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.locator('[name=sound]').scrollIntoViewIfNeeded();
  const soundBox=await page.locator('[name=sound]').boundingBox();
  expect(soundBox.y).toBeGreaterThanOrEqual(panelBox.y-1);
  expect(soundBox.y+soundBox.height).toBeLessThanOrEqual(panelBox.y+panelBox.height+1);
  await panel.evaluate(el=>{el.scrollTop=0;});
  await page.screenshot({path:resolve(evidence,'screenshots',`${width}-student-form.png`),fullPage:true});
  if(width===390){
   for(const selector of ['select[name=character]','input[name=goal]','select[name=group]','input[name=sound]','#student-done','#back']){
    await page.keyboard.press('Tab');await expect(page.locator(selector)).toBeFocused();
   }
   await page.keyboard.press('Shift+Tab');await expect(done).toBeFocused();
   const focus=await done.evaluate(el=>({outline:getComputedStyle(el).outlineStyle,width:getComputedStyle(el).outlineWidth}));
   expect(focus.outline).toBe('solid');expect(Number.parseFloat(focus.width)).toBeGreaterThanOrEqual(2);
   await page.screenshot({path:resolve(evidence,'screenshots','390-student-form-focused.png'),fullPage:true});
  }
 }
});
