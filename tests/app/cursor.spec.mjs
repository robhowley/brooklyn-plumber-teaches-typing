import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {newStudent} from '../../recovered/control/student.mjs';
import {skipStartupUI} from './source-path.mjs';
const KEY='mtt-static-translation.students.v1';
const data=JSON.parse(readFileSync(new URL('../../app/data.json',import.meta.url)));
const snap=page=>page.evaluate(()=>translationSnapshot());
const key=(page,k)=>page.locator('#game').press(k);
const pixels=page=>page.evaluate(()=>Array.from(document.querySelector('#game').getContext('2d').getImageData(0,0,320,200).data));
async function move(page,x,y,click=false) {
 const r=await page.locator('#game').boundingBox(),p=[r.x+(x+.25)*r.width/320,r.y+(y+.25)*r.height/200];
 if(click)await page.mouse.click(...p);else await page.mouse.move(...p);
}
async function ready(page,names=[]) {
 await page.clock.install();await page.addInitScript(()=>{window.__sourceTestClock=true;});
 if(names.length) {
  const students=Object.fromEntries(names.map(n=>[n,Array.from(newStudent(n))]));
  await page.addInitScript(({KEY,students})=>localStorage.setItem(KEY,JSON.stringify({current:Object.keys(students)[0],students})),{KEY,students});
 }
 await page.goto('./?seed=1');await skipStartupUI(page);
 await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 // An open File dropdown suppresses random blinking, without moving the arrow.
 await key(page,'Enter');await page.clock.runFor(300);
 expect((await snap(page)).menu.row).toBe(1);
}
async function visible(page,value=true) {expect((await snap(page)).cursor.visible).toBe(value);await expect(page.locator('#game')).toHaveCSS('cursor',value?'none':'auto');}
function withoutArrows(image,...positions) {
 const out=image.slice();
 for(const {x,y} of positions)for(let dy=0;dy<12;dy++)for(let dx=0;dx<14;dx++) {
  if(x+dx<0||y+dy<0||x+dx>=320||y+dy>=200)continue;
  const p=((y+dy)*320+x+dx)*4;out.fill(0,p,p+4);
 }
 return out;
}
test('guest/profile main entry and keyboard highlights keep independent pointer coordinates',async({page})=>{
 await ready(page);expect((await snap(page)).pointer).toEqual({x:160,y:100});await visible(page);
 await move(page,44,85);const point=(await snap(page)).pointer;
 for(const k of ['ArrowDown','ArrowRight','ArrowLeft','ArrowUp','Escape']) {
  await key(page,k);expect((await snap(page)).pointer).toEqual(point);expect((await snap(page)).menu.pointer).toEqual(point);
 }
 await key(page,'w');await visible(page,false);await page.keyboard.type('ADA');await key(page,'Enter');
 expect((await snap(page)).pointer).toEqual({x:292,y:186});await visible(page);
 await key(page,'Escape');expect((await snap(page)).pointer).toEqual({x:267,y:175});
 await key(page,'4');await visible(page,false);await key(page,'Escape');await page.clock.runFor(120);
 expect((await snap(page)).pointer).toEqual({x:78,y:184});await visible(page);
 await key(page,'m');expect((await snap(page)).pointer).toEqual({x:267,y:175});
});
test('physical motion immediately overlays exact palette pixels, without trails or scene redraw',async({page})=>{
 await ready(page,['ADA']);const before=await snap(page),image=await pixels(page);
 await move(page,110,95);const state=await snap(page),moved=await pixels(page);
 expect(state.pointer).toEqual({x:110,y:95});expect(state.menu).toMatchObject({column:before.menu.column,row:before.menu.row});
 expect(state.operations).toEqual(before.operations);expect(state.seed).toBe(before.seed);
 expect(withoutArrows(moved,before.pointer,state.pointer)).toEqual(withoutArrows(image,before.pointer,state.pointer));
 const arrow=data.sprites['CURSOR/arrow'],raw=Buffer.from(arrow.pixels,'base64'),pal=data.palettes[state.palette];
 for(let y=0;y<arrow.height;y++)for(let x=0;x<arrow.width;x++) {
  const index=raw[y*arrow.width+x];if(!index)continue;
  const p=((95+y)*320+110+x)*4;expect(moved.slice(p,p+3)).toEqual(pal.slice(index*3,index*3+3));
 }
 await move(page,before.pointer.x,before.pointer.y);expect(await pixels(page)).toEqual(image);
});
test('scaled physical mapping caps at305/187; leave/blur hide and focus/re-entry restore without OS warping',async({page})=>{
 await ready(page,['ADA']);await page.setViewportSize({width:390,height:844});await move(page,319,199);
 expect((await snap(page)).pointer).toEqual({x:305,y:187});await visible(page);
 const r=await page.locator('#game').boundingBox();await page.mouse.move(0,0);await visible(page,false);
 expect((await snap(page)).pointer).toEqual({x:305,y:187});
 await move(page,120,90);await visible(page);await page.locator('#game').evaluate(c=>c.blur());await visible(page,false);
 const position=(await snap(page)).pointer;await page.locator('#game').focus();await visible(page);expect((await snap(page)).pointer).toEqual(position);
 // Synthetic exceptional coordinates exercise safe renderer clipping, not an OS warp.
 await page.locator('#game').dispatchEvent('pointermove',{clientX:r.x-8,clientY:r.y-8});
 expect((await snap(page)).pointer.x).toBeLessThan(0);await expect(page.locator('#status')).toBeHidden();
 await move(page,100,90);await page.locator('#game').dispatchEvent('pointercancel');await visible(page);
});
test('Preferences targets wrap and fields hide the arrow, while Enter remains index-based',async({page})=>{
 await ready(page,['ADA']);await key(page,'e');expect((await snap(page)).pointer).toEqual({x:292,y:186});
 const targets=[[207,74],[154,94],[89,157],[154,157],[225,157],[292,186]];
 for(const [x,y] of targets) {await key(page,'Tab');expect((await snap(page)).pointer).toEqual({x,y});expect((await snap(page)).studentUI.pointer).toEqual({x,y});}
 await key(page,'Tab');await key(page,'Tab');await move(page,10,10);await key(page,'Enter');
 expect((await snap(page)).studentUI.field.name).toBe('goal');await visible(page,false);
 await move(page,140,90);await key(page,'Escape');expect((await snap(page)).pointer).toEqual({x:140,y:90});await visible(page);
 await key(page,'Escape');expect((await snap(page)).pointer).toEqual({x:267,y:175});
});
test('duration Enter uses latest physical motion, fields hide, and return retains its final coordinates',async({page})=>{
 await ready(page,['ADA']);await key(page,'t');expect((await snap(page)).pointer).toEqual({x:285,y:182});
 await move(page,202,115);expect((await snap(page)).studentUI.pointer).toEqual({x:202,y:115});
 await key(page,'Enter');expect((await snap(page)).studentUI.field.name).toBe('2');await visible(page,false);
 await key(page,'Escape');await visible(page);await move(page,8,70);await key(page,'Enter');expect((await snap(page)).studentUI.field).toBeNull();
 await key(page,'Escape');expect((await snap(page)).pointer).toEqual({x:8,y:70});
});
test('empty Load inherits, populated Load navigates names without warping and Enter tests x only',async({page})=>{
 await ready(page);await move(page,130,100);await key(page,'l');expect((await snap(page)).pointer).toEqual({x:130,y:100});await visible(page);
 await key(page,'Escape');expect((await snap(page)).pointer).toEqual({x:130,y:100});
 await key(page,'w');await page.keyboard.type('ADA');await key(page,'Enter');await key(page,'Escape');
 await key(page,'l');expect((await snap(page)).pointer).toEqual({x:265,y:165});await move(page,207,40);await key(page,'ArrowDown');
 expect((await snap(page)).chooser.pointer).toEqual({x:207,y:40});await key(page,'Enter');expect((await snap(page)).screen).toBe('menu');expect((await snap(page)).pointer).toEqual({x:207,y:40});
 await key(page,'l');await move(page,265,40);await key(page,'Enter');expect((await snap(page)).profile.name).toBe('ADA');expect((await snap(page)).pointer).toEqual({x:265,y:40});
});
test('Help scrolling/motion never snap; Enter hit-tests physical buttons and only navigation positions',async({page})=>{
 await ready(page,['ADA']);await key(page,'F1');expect((await snap(page)).pointer).toEqual({x:280,y:182});
 await move(page,36,182);await key(page,'Enter');expect((await snap(page)).modal.top).toBe(1);expect((await snap(page)).modal.button).toBe(2);
 for(const k of ['PageDown','PageUp','Home','End','ArrowUp','ArrowDown']) {await key(page,k);expect((await snap(page)).pointer).toEqual({x:36,y:182});}
 await move(page,5,50);await key(page,'Enter');expect((await snap(page)).screen).toBe('help');
 for(const [k,x] of [['Tab',36],['ArrowRight',91],['ArrowLeft',36],['ArrowLeft',280]]) {await key(page,k);expect((await snap(page)).pointer).toEqual({x,y:182});}
 await key(page,'Enter');expect((await snap(page)).screen).toBe('menu');expect((await snap(page)).pointer).toEqual({x:280,y:182});
});
test('Report alone restores main coordinates; About/Keyboard retain returns and Keyboard ignores pointer-only input',async({page})=>{
 await ready(page,['ADA']);await move(page,90,90);await key(page,'5');expect((await snap(page)).pointer).toEqual({x:300,y:100});
 await move(page,20,90);await key(page,'Escape');expect((await snap(page)).pointer).toEqual({x:90,y:90});
 await key(page,'a');expect((await snap(page)).pointer).toEqual({x:300,y:180});await key(page,'Escape');expect((await snap(page)).pointer).toEqual({x:300,y:180});
 await key(page,'F2');expect((await snap(page)).pointer).toEqual({x:160,y:100});await move(page,100,80,true);expect((await snap(page)).screen).toBe('keyboard');
 await key(page,'F1');expect((await snap(page)).screen).toBe('keyboard');await key(page,'Escape');expect((await snap(page)).pointer).toEqual({x:100,y:80});
});
test('New/Edit keyboard dropdown callers retain callee coordinates, direct/pointer callers reset to Next',async({page})=>{
 await ready(page,['ADA']);await key(page,'Escape');await key(page,'Enter');await key(page,'ArrowRight');await key(page,'ArrowDown');await key(page,'ArrowDown');await key(page,'Enter');
 expect((await snap(page)).screen).toBe('student');await key(page,'Tab');await key(page,'Escape');expect((await snap(page)).pointer).toEqual({x:207,y:74});
 // Close the retained Edit dropdown, then use the direct New shortcut.
 await key(page,'Escape');await key(page,'w');await page.keyboard.type('BOB');await key(page,'Enter');await key(page,'Escape');expect((await snap(page)).pointer).toEqual({x:267,y:175});
 await move(page,90,90);await key(page,'Enter');await key(page,'Enter');expect((await snap(page)).studentUI.kind).toBe('new');
 await page.keyboard.type('C');await key(page,'Enter');await key(page,'Escape');expect((await snap(page)).pointer).toEqual({x:292,y:186});
 // Pointer-selected dropdown Edit follows main's direct/pointer caller.
 await move(page,120,4,true);await move(page,120,27,true);await key(page,'Escape');expect((await snap(page)).pointer).toEqual({x:267,y:175});
});
test('Results retain selection index across overlays but not their pointer coordinates',async({page})=>{
 await ready(page,['ADA']);await key(page,'4');await key(page,'Escape');await page.clock.runFor(120);await key(page,'Tab');expect((await snap(page)).pointer).toEqual({x:157,y:184});
 const result=(await snap(page)).result;await key(page,'F1');await key(page,'Escape');expect((await snap(page)).pointer).toEqual({x:280,y:182});expect((await snap(page)).result).toEqual(result);
 await key(page,'Tab');expect((await snap(page)).pointer).toEqual({x:78,y:184});await key(page,'F2');await key(page,'Escape');expect((await snap(page)).pointer).toEqual({x:160,y:100});
 await key(page,'Tab');expect((await snap(page)).pointer).toEqual({x:157,y:184});await key(page,'Enter');expect((await snap(page)).screen).toBe('menu');
});
test('startup, menu blink waits, every active world and demo typing retain the native cursor',async({page})=>{
 const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
 await page.clock.install();await page.addInitScript(()=>{window.__sourceTestClock=true;});await page.goto('./?seed=1');await expect(page.locator('#game')).toHaveAttribute('data-screen','startup');await visible(page,false);
 await skipStartupUI(page);
 for(const mode of [1,2,3,4]) {
  await page.clock.runFor(300);await key(page,String(mode));await page.clock.runFor(300);await visible(page,false);
  await key(page,'Escape');await page.clock.runFor(180);expect((await snap(page)).screen).toBe('results');await visible(page);await key(page,'m');
 }
 // Let the menu's sampled blink/input pump consume Demo before queuing 4.
 await key(page,'d');await page.clock.runFor(300);expect((await snap(page)).profile.demo).toBe(true);
 await key(page,'4');await page.clock.runFor(300);expect((await snap(page)).screen).toBe('practice');await visible(page,false);expect((await snap(page)).demo).not.toBeNull();
 await key(page,'Escape');await page.clock.runFor(180);expect((await snap(page)).screen).toBe('menu');expect((await snap(page)).pointer).toEqual({x:160,y:100});
 // Observe the recovered blink rather than treating all menu frames as waits.
 let observed=false;
 for(let i=0;i<200&&!observed;i++) {await page.clock.runFor(56);const s=await snap(page);if(s.menuIdle.waiting) {observed=true;await visible(page,false);}}
 expect(observed).toBe(true);expect(errors).toEqual([]);expect(failed).toEqual([]);
});
test('blocking menu speech hides both the software arrow and native override until the wait resumes',async({page})=>{
 await page.clock.install();
 await page.addInitScript(()=>{
  const resume=AudioContext.prototype.resume;
  AudioContext.prototype.resume=function(){
   const native=resume.call(this);native.catch(()=>{});
   // Delay only the browser transport acknowledgement, never a source controller.
   return new Promise((resolve,reject)=>{window.finishCursorUnlock=()=>native.then(resolve,reject);});
  };
 });
 await page.goto('./?seed=1');await expect(page.locator('#game')).toHaveAttribute('data-screen','startup');
 await page.clock.runFor(16400);expect((await snap(page)).screen).toBe('menu');
 await key(page,'Shift');await page.clock.runFor(6000);
 await page.waitForFunction(()=>translationSnapshot().audioHost.blocking);
 expect((await snap(page)).screen).toBe('menu');await visible(page,false);
 await move(page,100,90);await visible(page,false);
 await page.locator('#game').evaluate(c=>c.blur());await page.waitForFunction(()=>!translationSnapshot().audioHost.blocking);
 await page.evaluate(()=>{void window.finishCursorUnlock();});
 await page.locator('#game').focus();await page.clock.runFor(300);await key(page,'Enter');await page.clock.runFor(300);await visible(page);
});
test('water celebration shows the arrow only at its final input pump, not movie/swim waits',async({page})=>{
 test.setTimeout(120000);await ready(page,['ADA']);await key(page,'Escape');await key(page,'t');await key(page,'Tab');await key(page,'Tab');await key(page,'Enter');await key(page,'1');await key(page,'Enter');await key(page,'Escape');await key(page,'2');
 let s=await snap(page);
 for(let i=0;i<8;i++) {
  const codes=s.water.window.slice(10,18);await page.evaluate(codes=>{for(const code of codes)document.querySelector('#game').dispatchEvent(new KeyboardEvent('keydown',{key:String.fromCharCode(code),bubbles:true}));},codes);
  await page.clock.runFor(120);s=await snap(page);
 }
 for(let i=0;i<4;i++) {await page.clock.runFor(15000);await key(page,'Tab');await page.clock.runFor(60);}
 s=await snap(page);expect(s.screen).toBe('celebration');await visible(page,false);
 for(let i=0;i<1000&&s.celebration.wait!=='wait-input';i++) {await page.clock.runFor(120);s=await snap(page);if(s.celebration.wait!=='wait-input')await visible(page,false);}
 expect(s.celebration.wait).toBe('wait-input');await visible(page);await key(page,'Space');await page.clock.runFor(120);expect((await snap(page)).screen).toBe('results');await visible(page);
});
