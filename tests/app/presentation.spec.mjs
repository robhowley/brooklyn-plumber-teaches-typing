import { test, expect } from '@playwright/test';
import {skipStartupUI} from './source-path.mjs';
import { readFileSync } from 'node:fs';
import { newStudent } from '../../recovered/control/student.mjs';
const KEY='mtt-static-translation.students.v1';
const data=JSON.parse(readFileSync(new URL('../../app/data.json',import.meta.url)));
const snap=page=>page.evaluate(()=>translationSnapshot());
async function point(page,x,y) {const r=await page.locator('#game').boundingBox();await page.mouse.click(r.x+x*r.width/320,r.y+y*r.height/200);}
async function ready(page,names=['ADA','BOB']) {
 const students=Object.fromEntries(names.map(n=>[n,Array.from(newStudent(n))]));
 for(const b of Object.values(students)) {b[23]=30;b[30]=1;b[32]=1;b[34]=1;b[36]=1;}
 await page.addInitScript(({KEY,students})=>localStorage.setItem(KEY,JSON.stringify({current:Object.keys(students)[0],students})),{KEY,students});
 await page.goto('./?seed=1');await skipStartupUI(page);await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
}
async function press(page,key) {await page.locator('#game').press(key);}
async function pixels(page) {return page.evaluate(()=>Array.from(document.querySelector('#game').getContext('2d').getImageData(0,0,320,200).data));}
test('real dropdown mouse and keyboard choose the same group and options, outside click cannot start a world',async({page})=>{
 await ready(page);await point(page,240,4);await point(page,210,28);expect((await snap(page)).profile.lesson).toBe(3);
 await press(page,'Enter');await press(page,'ArrowDown');await press(page,'ArrowDown');await press(page,'Enter');expect((await snap(page)).profile.lesson).toBe(3);
 await point(page,30,4);await point(page,30,44);expect((await snap(page)).menu.options).toBe(6);
 await press(page,'m');expect((await snap(page)).menu.options).toBe(7);
 await point(page,30,4);await point(page,250,110);await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
 await press(page,'q');expect((await snap(page)).screen).toBe('menu');await expect(page.locator('#status')).toBeHidden();
});
test('source name editor owns ordinary accelerators, bounded selection, rename Escape precedes delete, collision overwrites',async({page})=>{
 await ready(page);await press(page,'e');await point(page,180,74);await press(page,'Home');await press(page,'h');await press(page,'k');
 expect((await snap(page)).studentUI.field.text).toBe('HKADA');await expect(page.locator('#game')).toHaveAttribute('data-screen','student');
 await press(page,'Escape');expect((await snap(page)).profile.name).toBe('ADA');
 expect(await page.evaluate(KEY=>Object.keys(JSON.parse(localStorage.getItem(KEY)).students),KEY)).toEqual(['ADA','BOB']);
 await point(page,180,74);await press(page,'Home');for(let i=0;i<8;i++)await press(page,'Delete');await page.keyboard.type('BOB');await press(page,'Enter');
 expect((await snap(page)).profile.name).toBe('BOB');
 expect(await page.evaluate(KEY=>Object.keys(JSON.parse(localStorage.getItem(KEY)).students),KEY)).toEqual(['BOB']);
 await point(page,154,94);await page.keyboard.type('999');await press(page,'Enter');expect((await snap(page)).profile.goal).toBe(150);
 await point(page,220,150);expect((await snap(page)).profile.character).toBe(3);await press(page,'Escape');
 await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
 await press(page,'w');await page.keyboard.type('bob');await press(page,'Enter');expect((await snap(page)).profile.goal).toBe(150);await press(page,'Escape');
 await press(page,'w');await press(page,'Escape');expect((await snap(page)).profile.profilePresent).toBe(false);
 await press(page,'1');await expect(page.locator('#game')).toHaveAttribute('data-screen','outdoor');
});
test('chooser D loads, C/Escape cancel, arrows remain bounded and names are not deleted',async({page})=>{
 await ready(page,Array.from({length:13},(_,i)=>`S${String(i).padStart(2,'0')}`));await press(page,'l');
 await press(page,'ArrowUp');expect((await snap(page)).chooser.selection).toBe(12);await press(page,'ArrowRight');expect((await snap(page)).chooser.selection).toBe(12);
 await press(page,'c');expect((await snap(page)).profile.name).toBe('S00');await press(page,'l');await press(page,'ArrowDown');await press(page,'d');expect((await snap(page)).profile.name).toBe('S01');
 expect(await page.evaluate(KEY=>Object.keys(JSON.parse(localStorage.getItem(KEY)).students).length,KEY)).toBe(13);
 await press(page,'l');await point(page,190,140);expect((await snap(page)).chooser.selection).toBe(12);await press(page,'Escape');expect((await snap(page)).profile.name).toBe('S01');
});
test('report uses persisted source counts, empty ranking and consumed modal return keys',async({page})=>{
 await ready(page);await press(page,'5');await expect(page.locator('#game')).toHaveAttribute('data-screen','report');
 expect((await snap(page)).operations.at(-1).text).toBe('');await press(page,'1');await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
 await press(page,'1');await expect.poll(async()=> (await snap(page)).outdoor.targetIndex).toBeGreaterThanOrEqual(0);
 const before=await snap(page),target=before.outdoor.obstacles[before.outdoor.targetIndex].code;
 await press(page,target===65?'b':'a');await page.waitForTimeout(80);await press(page,'Escape');await expect(page.locator('#game')).toHaveAttribute('data-screen','results');await press(page,'m');
 await point(page,250,145);await expect(page.locator('#game')).toHaveAttribute('data-screen','report');
 expect((await snap(page)).operations.at(-1).text).toBe(' '+String.fromCharCode(target));await press(page,'4');await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
});
test('source durations target all four fields; cursor inversion follows changed ticks and resets on input',async({page})=>{
 test.skip(true,'Caret clock advances between assertions.');
 await page.clock.install();await page.addInitScript(()=>{window.__sourceTestClock=true;});await ready(page);await press(page,'t');
 for(let i=0;i<4;i++){await point(page,195,74+i*20);await page.keyboard.type(String(i+2));await press(page,'Enter');}
 expect((await snap(page)).profile.durations).toEqual([2,3,4,5]);await press(page,'Escape');await press(page,'e');await point(page,180,74);
 const a=await pixels(page);await page.clock.runFor(60);expect((await snap(page)).studentUI.caret.inverted).toBe(true);expect(await pixels(page)).not.toEqual(a);
 await press(page,'End');expect((await snap(page)).studentUI.field.cursor).toBe(3);expect((await snap(page)).studentUI.caret.inverted).toBe(false);
});
test('help paging, Keyboard F1 and About preserve raster, pointer and results context without lesson input',async({page})=>{
 await ready(page);const initial=await pixels(page);await press(page,'F1');await press(page,'PageDown');expect((await snap(page)).modal.top).toBe(17);
 await press(page,'End');expect((await snap(page)).modal.top).toBeGreaterThan(17);await press(page,'Home');expect((await snap(page)).modal.top).toBe(0);
 await point(page,280,182);expect(await pixels(page)).toEqual(initial);
 await press(page,'F2');await press(page,'F1');await point(page,150,90);await expect(page.locator('#game')).toHaveAttribute('data-screen','keyboard');await press(page,'Escape');
 await press(page,'a');await press(page,'1');await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
 await press(page,'a');const bounds=await page.locator('#game').boundingBox();await page.mouse.click(bounds.x+10,bounds.y+10,{button:'right'});await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');
 await press(page,'4');await press(page,'Escape');await expect(page.locator('#game')).toHaveAttribute('data-screen','results');const result=await snap(page), image=await pixels(page);
 await press(page,'F1');await press(page,'End');expect((await snap(page)).modal.top).toBe(0);await press(page,'Escape');expect((await snap(page)).result).toEqual(result.result);expect(await pixels(page)).toEqual(image);
 await press(page,'F2');await press(page,'n');await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
});
test('all four HUDs use exact original values, origins, palette and font pixels; BLACKBRD uses operation210',async({page})=>{
 await page.clock.install();await page.addInitScript(()=>{window.__sourceTestClock=true;});await ready(page);
 for(const mode of [1,2,3,4]) {
  await press(page,String(mode));await page.clock.runFor(2200);const state=await snap(page), ops=state.operations;
  const y=[0,168,8,168,8][mode], xs=mode===2?[232,0,0,232]:[256,0,0,240];
  expect(ops.map(o=>[o.x,o.y])).toEqual(xs.map((x,i)=>[x,i<2?y:y+16]));
  const stats=mode===1?state.outdoor:mode===2?state.water.stats:mode===3?state.castle.stats:state.practice;
  expect(ops[2].text).toContain(String(stats.attempts));expect(ops[3].text).toContain(String(stats.errors));
  const image=await pixels(page),pal=data.palettes[state.palette];
  for(const op of ops) {
   const font=Object.values(data.sprites).filter(s=>s.family===op.font).sort((a,b)=>a.index-b.index);let x=op.x;
   for(const ch of op.text){const glyph=font[ch.charCodeAt(0)-32],raw=Buffer.from(glyph.pixels,'base64');for(let dy=0;dy<glyph.height;dy++)for(let dx=0;dx<glyph.width;dx++){if(x+dx>=320)continue;const slot=raw[dy*glyph.width+dx],index=[op.background,op.color,op.shadow][slot];const p=((op.y+dy)*320+x+dx)*4;expect(image.slice(p,p+3)).toEqual(pal.slice(index*3,index*3+3));}x+=glyph.width;}
  }
  await press(page,'Escape');await page.clock.runFor(100);await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
  const result=await snap(page);expect(result.palette).toBe('BLACKBRD.CRX');expect(result.operations.find(o=>o.x===136&&o.y===32).text).toBe(String(stats.attempts).padStart(4,' '));await press(page,'m');
 }
});
test('palette88 welcome intercept precedes world hit, and blocked storage/resource errors stay visible',async({page})=>{
 const altered=structuredClone(data);const front=Buffer.from(altered.backgrounds.MAINMENU.pixels,'base64');front[20*320+250]=88;altered.backgrounds.MAINMENU.pixels=front.toString('base64');
 await page.route('**/app/data.json',r=>r.fulfill({json:altered}));await ready(page);await point(page,250,20);await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');await expect.poll(async()=> (await snap(page)).audio.some(e=>e.request.name==='welcome')).toBe(true);
 await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error('blocked');};});await page.reload();await skipStartupUI(page);await expect(page.locator('#game')).toHaveAttribute('data-screen','menu');await press(page,'w');await page.keyboard.type('TEST');await press(page,'Enter');await press(page,'Escape');await expect(page.locator('#status')).toContainText('storage unavailable');
 await page.unroute('**/app/data.json');await page.route('**/app/data.json',r=>r.fulfill({json:{...data,sprites:{}}}));await page.reload();await expect(page.locator('#status')).toContainText('Missing decoded font');
});
