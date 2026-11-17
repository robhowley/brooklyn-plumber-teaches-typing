import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {newStudent} from '../../recovered/control/student.mjs';
import {skipStartupUI} from './source-path.mjs';
const data=JSON.parse(readFileSync(new URL('../../app/data.json',import.meta.url)));
const KEY='mtt-static-translation.students.v1';
const snap=page=>page.evaluate(()=>translationSnapshot());
const key=(page,k)=>page.locator('#game').press(k);
async function point(page,x,y,button='left',click=true) {
 const r=await page.locator('#game').boundingBox(),p=[r.x+(x+.25)*r.width/320,r.y+(y+.25)*r.height/200];
 if(click)await page.mouse.click(...p,{button});else await page.mouse.move(...p);
}
async function ready(page,saved=false) {
 await page.clock.install();await page.clock.pauseAt(new Date());
 await page.addInitScript(({KEY,saved,student})=>{
  window.__sourceTestClock=true;
  localStorage.setItem('typing-kingdom-v1','legacy1');localStorage.setItem('typing-kingdom-v2','legacy2');
  if(saved)localStorage.setItem(KEY,JSON.stringify({current:'ADA',students:{ADA:student}}));
 },{KEY,saved,student:Array.from(newStudent('ADA'))});
 await page.goto('./?seed=1');await skipStartupUI(page);
 expect((await snap(page)).screen).toBe('menu');
}
async function textPixels(page,lines,color,background) {
 return page.evaluate(({lines,color,background,data})=>{
  const actual=document.querySelector('#game').getContext('2d').getImageData(0,0,320,200).data;
  const pal=data.palettes[background+'.CRX'],back=Uint8Array.from(atob(data.backgrounds[background].pixels),c=>c.charCodeAt(0));
  let mismatches=0,ink=0,clear=0;
  for(const [value,x,y] of lines)for(const [i,ch] of [...value].entries()) {
   const g=data.sprites[`FONT5H/font5_${ch.charCodeAt(0)}`],raw=Uint8Array.from(atob(g.pixels),c=>c.charCodeAt(0));
   raw.forEach((v,j)=>{
    const p=(y+Math.floor(j/g.width))*320+x+i*8+j%g.width,index=v?color:back[p];
    if(v)ink++;else clear++;
    if(!pal.slice(index*3,index*3+3).every((v,c)=>actual[p*4+c]===v))mismatches++;
   });
  }
  return {mismatches,ink,clear};
 },{lines,color,background,data});
}
async function eyePixels(page,name) {
 return page.evaluate(({data,name})=>{
  const g=data.startup.sprites.GREET2[name],raw=Uint8Array.from(atob(g.pixels),c=>c.charCodeAt(0));
  const image=document.querySelector('#game').getContext('2d').getImageData(0,0,320,200).data,pal=data.palettes['MAINMENU.CRX'];
  let mismatches=0;
  raw.forEach((v,i)=>{
   if(!v)return;const p=((47+Math.floor(i/g.width))*320+50+i%g.width)*4;
   if(!pal.slice(v*3,v*3+3).every((v,c)=>image[p+c]===v))mismatches++;
  });
  return mismatches;
 },{data,name});
}
for(const saved of [false,true])test(`welcome foreground55 and transparent backing, ${saved?'saved':'guest'}`,async({page})=>{
 await ready(page,saved);
 const lines=saved?[[data.messages[1150],144,34],['ADA!',152,49]]:Array.from({length:5},(_,i)=>[data.messages[1250+i],136,24+i*10]);
 const result=await textPixels(page,lines,55,'MAINMENU');
 expect(result.mismatches).toBe(0);expect(result.ink).toBeGreaterThan(0);expect(result.clear).toBeGreaterThan(0);
});

test('empty Load shows MSD2500 in color4, retains pointer and dismisses without loading or storage changes',async({page})=>{
 await ready(page);await point(page,110,80,'left',false);const profile=(await snap(page)).profile;
 for(const dismissal of ['key','pointer']) {
  await key(page,'l');let s=await snap(page);expect(s.screen).toBe('load');expect(s.pointer).toEqual({x:110,y:80});
  const result=await textPixels(page,[[data.messages[2500],112,96]],4,'LOAD');expect(result.mismatches).toBe(0);expect(result.ink).toBeGreaterThan(0);
  if(dismissal==='key')await key(page,'4');else await point(page,110,80);
  s=await snap(page);expect(s.screen).toBe('menu');expect(s.pointer).toEqual({x:110,y:80});expect(s.profile).toEqual(profile);expect(s.inputPending).toBe(false);
 }
 expect(await page.evaluate(KEY=>[localStorage.getItem(KEY),localStorage.getItem('typing-kingdom-v1'),localStorage.getItem('typing-kingdom-v2')],KEY)).toEqual([null,'legacy1','legacy2']);
});

test('eye left press hides arrow, paces 4/3/2 at changed ticks1/2/4 and retains queued keys',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
 const before=await snap(page);
 await point(page,50,47,'right');expect((await snap(page)).menuIdle.waiting).toBeNull();
 await point(page,49,55);expect((await snap(page)).menuIdle.waiting).toBeNull();
 await point(page,75,66);
 let s=await snap(page);expect(s.menuIdle.waiting.count).toBe(1);expect(s.cursor.visible).toBe(false);await expect(page.locator('#game')).toHaveCSS('cursor','auto');
 await key(page,'ArrowRight');await key(page,'4');s=await snap(page);
 expect(s.screen).toBe('menu');expect(s.inputPending).toBe(true);expect(s.menu.column).toBe(1);expect(s.menuIdle.waiting.count).toBe(1);
 // Unchanged samples (input pumps and physical motion) cannot finish a wait.
 await point(page,110,95,'left',false);expect((await snap(page)).menuIdle.waiting.count).toBe(1);
 for(const [tick,name] of [[1,'eyes0044_halfway'],[2,'eyes0043_closed'],[3,'eyes0043_closed']]) {
  await page.clock.runFor(56);s=await snap(page);
  expect(s.screen).toBe('menu');expect(s.inputPending).toBe(true);expect(s.menu.column).toBe(1);expect(s.cursor.visible).toBe(false);
  expect(await eyePixels(page,name),`tick ${tick}`).toBe(0);
 }
 await page.clock.runFor(56);s=await snap(page);expect(s.menuIdle.waiting).toBeNull();expect(s.menu.column).toBe(2);expect(s.inputPending).toBe(true);expect(s.cursor.visible).toBe(true);
 expect(await eyePixels(page,'eyes0042_open')).toBe(0);expect(s.menuTimer).toEqual(before.menuTimer);expect(s.seed).toBe(before.seed);
 expect(s.audio.filter(e=>e.request.name==='welcome')).toEqual(before.audio.filter(e=>e.request.name==='welcome'));
 await page.clock.runFor(56);expect((await snap(page)).screen).toBe('practice');expect(errors).toEqual([]);
});

test('open dropdown and palette88 intercept eye presses before animation',async({page})=>{
 await ready(page);await key(page,'Enter');await point(page,50,47);
 let s=await snap(page);expect(s.menu.row).toBe(0);expect(s.menuIdle.waiting).toBeNull();
 // Pin a palette88 sample in the displayed eye hitbox via decoded test data.
 const altered=structuredClone(data),eye=altered.startup.sprites.GREET2.eyes0042_open,raw=Buffer.from(eye.pixels,'base64');
 raw[8*eye.width+10]=88;eye.pixels=raw.toString('base64');
 await page.route('**/app/data.json',r=>r.fulfill({json:altered}));await page.reload();await skipStartupUI(page);
 const before=await snap(page);await point(page,60,55);s=await snap(page);
 expect(s.screen).toBe('menu');expect(s.menuIdle.waiting).toBeNull();
 expect(s.audio.filter(e=>e.request.name==='welcome').length).toBe(before.audio.filter(e=>e.request.name==='welcome').length+1);
});
