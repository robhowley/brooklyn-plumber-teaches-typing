import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {newStudent} from '../../recovered/control/student.mjs';
import {skipStartupUI} from './source-path.mjs';
const data=JSON.parse(readFileSync(new URL('../../app/data.json',import.meta.url)));
const snap=page=>page.evaluate(()=>translationSnapshot());
const key=(page,k)=>page.locator('#game').press(k);
async function ready(page,{saved=true}={}) {
 await page.clock.install();await page.clock.pauseAt(new Date());
 await page.addInitScript(({saved,student})=>{
  window.__sourceTestClock=true;
  if(saved)localStorage.setItem('mtt-static-translation.students.v1',JSON.stringify({current:'ADA',students:{ADA:student}}));
 },{saved,student:Array.from(newStudent('ADA'))});
 await page.goto('./?seed=1');await skipStartupUI(page);
 await key(page,'Enter');expect((await snap(page)).menu.row).toBe(1); // suppress random blink waits
}
async function pointer(page,type,buttons=0,x=10,y=100,button=0) {
 const r=await page.locator('#game').boundingBox();
 await page.locator('#game').dispatchEvent(type,{buttons,button,clientX:r.x+(x+.25)*r.width/320,clientY:r.y+(y+.25)*r.height/200});
}
async function click(page,x=10,y=100) {await pointer(page,'pointerdown',1,x,y);await pointer(page,'pointerup',0,x,y);}
async function added(page,action) {
 const before=await snap(page);await action();const after=await snap(page);
 // Snapshot retains only the last40 entries, including during long typing paths.
 let overlap=Math.min(before.audio.length,after.audio.length);
 while(overlap&&JSON.stringify(before.audio.slice(-overlap))!==JSON.stringify(after.audio.slice(0,overlap)))overlap--;
 const entries=after.audio.slice(overlap);
 return {before,after,entries,requests:entries.map(e=>e.request)};
}
const click8={type:'effect',id:8,file:0x149bc};

test('main rejection10 obeys Effects; toggles, navigation and unavailable profile commands stay silent',async({page})=>{
 await ready(page,{saved:false});
 let delta=await added(page,()=>key(page,'z'));
 expect(delta.requests).toEqual([{type:'effect',id:10,file:0x119fd}]);expect(delta.entries[0].status).toBe('requested');
 expect(delta.entries[0].actions.at(-1)).toMatchObject({id:10,resource:'SFX10.ADL',playback:'unsupported-silent'});
 expect(delta.after.menu.row).toBe(1);
 delta=await added(page,()=>key(page,'s'));expect(delta.requests).toEqual([]);
 delta=await added(page,()=>key(page,'z'));expect(delta.requests).toEqual([{type:'effect',id:10,file:0x119fd}]);expect(delta.entries[0].status).toBe('disabled');expect(delta.entries[0].actions).toEqual([]);
 delta=await added(page,()=>key(page,'s'));expect(delta.requests).toEqual([]);
 for(const k of ['5','e','Escape','Enter','ArrowRight','ArrowLeft','Escape'])expect((await added(page,()=>key(page,k))).requests,k).toEqual([]);
 expect((await added(page,()=>key(page,'F3'))).requests).toEqual([{type:'effect',id:10,file:0x119fd}]);
});

test('localized accelerator is recognized before rejection lookup',async({page})=>{
 const altered=structuredClone(data);altered.messages[10008]='Zbout';
 await page.route('**/app/data.json',r=>r.fulfill({json:altered}));await ready(page);
 const delta=await added(page,()=>key(page,'z'));expect(delta.after.screen).toBe('about');expect(delta.requests).toEqual([]);
});

test('shared wait effect8 follows only fresh left-bit rises, including pointermove chords',async({page})=>{
 await ready(page);
 const delta=await added(page,async()=>{
  for(const buttons of [2,3,1,3,2,0,0,1,1,0])await pointer(page,'pointermove',buttons);
 });
 expect(delta.requests).toEqual([click8,click8]);expect(delta.after.screen).toBe('menu');expect(delta.after.menu.row).toBe(1);
 expect(delta.entries.every(e=>e.status==='requested'&&e.actions.at(-1).playback==='unsupported-silent')).toBe(true);
});

test('dropdown activation requests click before its modal wait, without a release duplicate',async({page})=>{
 await ready(page);
 const delta=await added(page,async()=>{await click(page,40,8+7);}); // System row1 About
 expect(delta.requests).toEqual([click8]);expect(delta.after.screen).toBe('about');
 expect((await added(page,()=>pointer(page,'pointerup',0))).requests).toEqual([]);
 expect((await snap(page)).screen).toBe('about'); // prior press-to-open adaptation survives
});

test('Help, Report, About and Keyboard shared waits include click8, while field reads exclude it',async({page})=>{
 await ready(page);
 for(const [opener,screen] of [['F1','help'],['5','report'],['a','about'],['F2','keyboard']]) {
  await key(page,opener);expect((await snap(page)).screen).toBe(screen);
  const delta=await added(page,()=>click(page));expect(delta.requests,screen).toEqual([click8]);
  if(['help','keyboard'].includes(screen)) {expect(delta.after.screen).toBe(screen);await key(page,'Escape');}
  else expect(delta.after.screen).toBe('menu');
 }
 await key(page,'e');expect((await added(page,()=>click(page))).requests).toEqual([click8]);
 await key(page,'Tab');await key(page,'Enter');expect((await snap(page)).studentUI.field.name).toBe('name');
 expect((await added(page,()=>click(page))).requests).toEqual([]);
 await key(page,'Escape');expect((await added(page,()=>click(page))).requests).toEqual([click8]);await key(page,'Escape');
 await key(page,'t');expect((await added(page,()=>click(page))).requests).toEqual([click8]);
 await key(page,'Tab');await key(page,'Enter');expect((await added(page,()=>click(page))).requests).toEqual([]);
 await key(page,'Escape');await key(page,'Escape');
 await key(page,'l');expect((await added(page,()=>pointer(page,'pointermove',1))).requests).toEqual([click8]);await pointer(page,'pointermove',0);await key(page,'Escape');
 await key(page,'w');expect((await added(page,()=>click(page))).requests).toEqual([]); // New name prompt
});

test('empty chooser and Results include click8 without starting or stopping music',async({page})=>{
 await ready(page,{saved:false});await key(page,'l');
 let delta=await added(page,()=>click(page));expect(delta.requests).toEqual([click8]);expect(delta.after.screen).toBe('menu');
 await key(page,'4');await key(page,'Escape');await page.clock.runFor(60);expect((await snap(page)).screen).toBe('results');
 delta=await added(page,()=>click(page));expect(delta.requests).toEqual([click8]);expect(delta.after.screen).toBe('results');
});

for(const mode of [1,2,3])test(`world${mode} bonus movie excludes click8 without changing the packet`,async({page})=>{
 test.setTimeout(120000);await ready(page);await key(page,String(mode));await page.clock.runFor(300);
 let s=await snap(page);
 for(let i=0;!(mode===1?s.cinematic:mode===2?s.water.movie:s.castle.movie);i++) {
  expect(i).toBeLessThan(3000);
  const bonus=mode===1?s.bonus:mode===2?s.water.bonus:s.castle.bonus;
  const canType=mode!==3||!s.castle.locked&&['rockfaces','sand'].includes(s.castle.phase);
  if(bonus.mode===2&&canType)await key(page,String.fromCharCode(bonus.code));
  else if(mode===2)await key(page,String.fromCharCode(s.water.window[s.water.targetIndex]));
  else if(mode===3&&canType)await key(page,String.fromCharCode(s.castle.target));
  await page.clock.runFor(60);s=await snap(page);
 }
 const packet=mode===1?s.cinematic.frame:mode===2?s.water.movie.frame:s.castle.movie.frame;
 const delta=await added(page,()=>click(page));expect(delta.requests).toEqual([]);expect(delta.after.audio).toEqual(delta.before.audio);
 expect(mode===1?delta.after.cinematic.frame:mode===2?delta.after.water.movie.frame:delta.after.castle.movie.frame).toBe(packet);
});

test('startup, gameplay and menu eye/blink waits exclude click8; a queued key never suppresses a shared-wait click',async({page})=>{
 await page.clock.install();await page.clock.pauseAt(new Date());await page.addInitScript(()=>{window.__sourceTestClock=true;});
 await page.goto('./?seed=1');await expect(page.locator('#game')).toHaveAttribute('data-screen','startup');
 expect((await added(page,()=>click(page))).requests).toEqual([]);await skipStartupUI(page);
 // Eye starts in the input pump, so its initiating press requests8.
 expect((await added(page,()=>click(page,75,66))).requests).toEqual([click8]);expect((await snap(page)).menuIdle.waiting).not.toBeNull();
 expect((await added(page,()=>click(page))).requests).toEqual([]);
 await key(page,'ArrowRight');await key(page,'z');await page.clock.runFor(224);
 let s=await snap(page);expect(s.menuIdle.waiting).toBeNull();expect(s.inputPending).toBe(true);
 const delta=await added(page,()=>click(page));
 expect(delta.requests).toEqual([click8,{type:'effect',id:10,file:0x119fd}]);expect(delta.after.inputPending).toBe(false);
 // Dispatching the retained pointer on the next pump does not replay8.
 expect((await added(page,()=>page.clock.runFor(56))).requests).toEqual([]);
 for(const mode of [1,2,3,4]) {
  await key(page,String(mode));await page.clock.runFor(300);
  expect((await snap(page)).screen).toBe(['','outdoor','water','castle','practice'][mode]);
  expect((await added(page,()=>click(page))).requests).toEqual([]);
  await key(page,'Escape');await page.clock.runFor(180);expect((await snap(page)).screen).toBe('results');await key(page,'m');
  await page.clock.runFor(300);
 }
 await expect(page.locator('#status')).toBeHidden();
});
