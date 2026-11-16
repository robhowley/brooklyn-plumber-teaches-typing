import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {skipStartupUI,createStudentUI} from './source-path.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../../assets/original/manifest.json',import.meta.url)));
const sprites=manifest.sprites.filter(s=>s.family==='FINGER').map(s=>({...s,pixels:fs.readFileSync(new URL('../../assets/original/'+s.indicesPath,import.meta.url)).toString('base64')}));
const exe=fs.readFileSync(new URL('../../assets/original/raw/MarioTea/MARIO/MARIO.EXE.data',import.meta.url));
const tables={lookup:Array.from(exe.subarray(0x2258c,0x225eb)),x:Array.from({length:10},(_,i)=>exe.readInt16LE(0x21df6+2*i)),y:Array.from({length:10},(_,i)=>exe.readInt16LE(0x21e0a+2*i))};
const snapshot=page=>page.evaluate(()=>translationSnapshot());
async function pixels(page,mode,code=null) {
 const result=await page.evaluate(async({sprites,tables,mode,code})=>{
  const data=await fetch('./app/data.json').then(r=>r.json()),s=translationSnapshot();
  const bgName=({1:'OUTSIDE',2:'WATER',3:'CASTLE',4:'PRACTICE'})[mode];
  const bg=Uint8Array.from(atob(data.backgrounds[bgName].pixels),c=>c.charCodeAt(0));
  const expected=bg.slice(),[x,y,gap]=[[90,158,90],[100,3,70],[100,158,70],[30,45,230]][mode-1];
  const stamp=(index,dx,dy)=>{
   const sprite=sprites[index],raw=Uint8Array.from(atob(sprite.pixels),c=>c.charCodeAt(0));
   for(let j=0;j<sprite.height;j++)for(let i=0;i<sprite.width;i++)expected[(dy+j)*320+dx+i]=raw[j*sprite.width+i]||bg[(dy+j)*320+dx+i];
  };
  stamp(10,x,y);stamp(11,x+gap,y);
  if(code>=32&&code<127) {
   let index=tables.lookup[code-32];if(index>=40)index-=40;
   const right=index>=6;if(right)index--;
   stamp(index,x+(right?gap:0)+tables.x[index],y+tables.y[index]);
  }
  const actual=document.querySelector('#game').getContext('2d').getImageData(0,0,320,200).data,palette=data.palettes[s.palette];
  let compared=0,nonBackground=0,mismatches=0;
  for(const dx of [x,x+gap])for(let j=0;j<41;j++)for(let i=0;i<39;i++) {
   const pos=(y+j)*320+dx+i,index=expected[pos];
   // Left base is38 wide. Its extra column is outside the service rectangle.
   if(dx===x&&i===38)continue;
   if(index!==bg[pos])nonBackground++;
   if(palette.slice(index*3,index*3+3).some((v,c)=>actual[pos*4+c]!==v)||actual[pos*4+3]!==255)mismatches++;
   compared++;
  }
  return {compared,nonBackground,mismatches};
 },{sprites,tables,mode,code});
 expect(result.compared).toBe(3157);expect(result.nonBackground).toBeGreaterThan(500);expect(result.mismatches,`mode${mode}, code${code}`).toBe(0);
}
async function key(page,code,predicate) {
 await page.evaluate(code=>document.querySelector('#game').dispatchEvent(new KeyboardEvent('keydown',{key:String.fromCharCode(code),bubbles:true})),code);
 for(let i=0;i<150&&!predicate(await snapshot(page));i++)await page.clock.runFor(1);
 expect(predicate(await snapshot(page))).toBe(true);
}
async function exit(page) {
 // Entry's Ready continuation flushes input; an unfinished Outside jump must
 // complete before Results. Observe those source boundaries, not a fixed wait.
 await page.clock.runFor(120);
 await page.locator('#game').press('Escape');
 for(let i=0;i<30&&(await snapshot(page)).screen!=='results';i++)await page.clock.runFor(60);
 await expect(page.locator('#game')).toHaveAttribute('data-screen','results');
}
for(const character of [1,2,3])for(const mode of [1,2,3,4])test(`finger pixels character${character} mode${mode}: target, input, lifecycle and Demo`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 await page.addInitScript(()=>{window.__sourceTestClock=true;});await page.goto('./?seed=1');await skipStartupUI(page);
 await createStudentUI(page,{name:'FINGERS',character,goal:30});
 // Legacy storage is unrelated to this imagery fix.
 await page.evaluate(()=>{localStorage.setItem('typing-kingdom-v1','keep1');localStorage.setItem('typing-kingdom-v2','keep2');});
 await page.locator('#game').press(String(mode));let s=await snapshot(page);
 const target=s=>mode===1?s.outdoor.obstacles[s.outdoor.targetIndex]?.code:mode===2?s.water.window[s.water.targetIndex]:mode===3?s.castle.target:s.practice.rows[33+s.practice.index];
 await pixels(page,mode,mode===1||mode===3?null:target(s));
 await page.clock.runFor(120);s=await snapshot(page);
 let code=target(s);await pixels(page,mode,mode===1?s.outdoor.fingerCode:code);
 const attempts=s=>mode===1?s.outdoor.attempts:mode===2?s.water.stats.attempts:mode===3?s.castle.stats.attempts:s.practice.attempts;
 const before=attempts(s);
 // Wrong printable input retains the displayed target.
 await key(page,code===65?90:65,s=>attempts(s)>before);s=await snapshot(page);await pixels(page,mode,mode===1?s.outdoor.fingerCode:target(s));
 const correctBefore=attempts(s),old=target(s);
 await key(page,old,s=>attempts(s)>correctBefore);s=await snapshot(page);
 await pixels(page,mode,mode===1||mode===3?old:target(s));
 await page.clock.runFor(120);s=await snapshot(page);await pixels(page,mode,mode===1?s.outdoor.fingerCode:target(s));
 await exit(page);
 await page.locator('#game').press('m');await page.locator('#game').press(String(mode));s=await snapshot(page);
 await pixels(page,mode,mode===1||mode===3?null:target(s));
 await exit(page);await page.locator('#game').press('m');
 await page.locator('#game').press('d');await page.locator('#game').press(String(mode));await page.clock.runFor(120);s=await snapshot(page);
 expect(s.profile.demo).toBe(true);await pixels(page,mode,mode===1?s.outdoor.fingerCode:target(s));
 expect(await page.evaluate(()=>[localStorage.getItem('typing-kingdom-v1'),localStorage.getItem('typing-kingdom-v2')])).toEqual(['keep1','keep2']);
 expect(errors).toEqual([]);
});
