import {test,expect} from '@playwright/test';
import {finishStartup} from './startup-entry.mjs';
const own='mtt2-static-translation.students.v1';
function file(count=22) {
 const students=Array.from({length:count},(_,i)=>{
  const name='S'+String(i).padStart(2,'0'),record=Array(292).fill(0);
  record[1]=i%5;record[3]=i%3;record[5]=3;record[11]=i;record[27]=5;record[35]=10;record[100]=200+i;
  [...name].forEach((c,j)=>record[274+j]=c.charCodeAt(0));return {name,record};
 });return {schema:'mario2-students.v1',currentName:students[0]?.name??null,students};
}
test.beforeEach(async({page})=>{
 await page.clock.install({time:new Date(2026,0,1)});await page.clock.pauseAt(new Date(2026,0,1,0,0,1));
 await page.addInitScript(()=>{
  window.protectedAccesses=[];
  for(const method of ['getItem','setItem','removeItem']) {
   const original=Storage.prototype[method];Storage.prototype[method]=function(key,...args){
    if(['mtt-static-translation.students.v1','typing-kingdom-v1','typing-kingdom-v2'].includes(key)){window.protectedAccesses.push(key);throw Error('protected');}
    return original.call(this,key,...args);
   };
  }
 });
});
async function open(page,data=file()) {
 await page.addInitScript(({own,data})=>{if(!sessionStorage.seeded){localStorage.setItem(own,JSON.stringify(data));sessionStorage.seeded='1';}},{own,data});
 await page.goto('./');await finishStartup(page);await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await page.getByRole('button',{name:'Load student',exact:true}).click();
}
// Real timed Express entered through the same loaded/manual UI controls.
for(const [origin,count,speed,next] of [['loaded',49,9,0],['loaded',50,10,1],['loaded',55,11,1],['manual',50,10,1]])
test('one-minute '+origin+' Express writer boundary '+count,async({page},info)=>{
 const data=file(2);data.students[0].record[1]=0;data.students[0].record[27]=1;
 await open(page,data);const original=await saved(page);
 if(origin==='loaded') {
  await page.getByRole('button',{name:'Preview S00',exact:true}).click();
  await page.getByRole('button',{name:'Load selected student',exact:true}).click();
 } else {
  await page.getByRole('button',{name:'Back to Welcome screen',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
 }
 for(let i=0;i<count;i++) {
  const key=(await page.locator('canvas').getAttribute('aria-label')).slice('Next key: '.length);
  await page.keyboard.press(key===' '?'Space':key);
 }
 await page.clock.runFor(59000);
 await expect(page.getByRole('status')).toContainText('Elapsed: 59');expect(await saved(page)).toEqual(original);
 await page.clock.runFor(1000);await expect(page.getByRole('status')).toContainText('Elapsed: 60');
 expect(await saved(page)).toEqual(original);
 await page.clock.runFor(100);await expect(page.getByRole('status')).toContainText('Report');
 // Teardown serialized ticking0, but not report history yet.
 const teardown=structuredClone(original);teardown.students[0].record[17]=0;teardown.students[0].record[18]=0;
 expect(await saved(page)).toEqual(origin==='loaded'?teardown:original);
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Word/Min:   '+String(speed).padStart(4));
 const expected=structuredClone(teardown),r=expected.students[0].record;
 r[1]=next;r[9]=100;r[11]=speed;r[19]=60;r.splice(253,5,111,110,101,33,0);
 expect(await saved(page)).toEqual(origin==='loaded'?expected:original);
 await screenshot(page,info,'minute-'+origin+'-'+count+'-report');
 await page.getByRole('button',{name:'Repeat',exact:true}).click();
 await page.getByRole('button',{name:'Quit to Welcome',exact:true}).click();await page.keyboard.press('Enter');
 await expect(page.getByRole('status')).toContainText('Keyset: '+next);
 await page.getByRole('button',{name:'Load student',exact:true}).click();
 await page.getByRole('button',{name:'Preview S00',exact:true}).click();await screenshot(page,info,'minute-'+origin+'-'+count+'-list');
 expect(await page.evaluate(()=>window.protectedAccesses)).toEqual([]);
 await page.reload();await finishStartup(page);await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Keyset: '+(origin==='loaded'?next:0));
});
for(const scenario of ['first-refusal','second-refusal','terminal-stop'])
test('loaded minute '+scenario+' preserves accepted envelope',async({page},info)=>{
 const data=file(2),r=data.students[0].record;r[27]=1;r[35]=0;r[17]=99;r[1]=scenario==='terminal-stop'?4:0;
 await open(page,data);
 await page.getByRole('button',{name:'Preview S00',exact:true}).click();
 await page.getByRole('button',{name:'Load selected student',exact:true}).click();
 const original=await saved(page);
 await page.evaluate(({own,scenario})=>{
  window.writerAttempts=[];const write=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
   if(key===own){window.writerAttempts.push(JSON.parse(value));
    if(window.writerAttempts.length===(scenario==='first-refusal'?1:scenario==='second-refusal'?2:-1)) throw Error('writer refused');}
   return write.call(this,key,value);
  };
 },{own,scenario});
 await page.clock.runFor(60100);await expect(page.getByRole('status')).toContainText('Report');
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 const attempts=await page.evaluate(()=>window.writerAttempts);
 expect(attempts).toHaveLength(scenario==='terminal-stop'?1:2);
 const teardown=structuredClone(original);teardown.students[0].record[17]=0;
 expect(attempts[0]).toEqual(teardown);
 expect(await saved(page)).toEqual(scenario==='first-refusal'?attempts[1]:teardown);
 expect((await saved(page)).students[1]).toEqual(original.students[1]);
 if(scenario==='terminal-stop') {
  await expect(page.getByRole('status')).toContainText('certificate unavailable; progression stopped');
  await expect(page.getByRole('button',{name:'Repeat',exact:true})).toHaveCount(0);
 } else if(scenario==='second-refusal') await expect(page.locator('#error')).toContainText('Persistence refused');
 await page.clock.runFor(1000);expect(await page.evaluate(()=>window.writerAttempts.length)).toBe(attempts.length);
 await screenshot(page,info,scenario);
});
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),own);
async function hit(page,x,y){const c=page.locator('canvas'),b=await c.boundingBox();await c.dispatchEvent('click',{clientX:b.x+x*b.width/640,clientY:b.y+y*b.height/480});}
async function screenshot(page,info,name){await page.screenshot({path:info.outputPath(name+'.png')});}
test('bitmap108 list, source preview native pixels, odd row19 and bounded scroll',async({page},info)=>{
 await open(page);const original=await saved(page);
 await expect(page.getByRole('button',{name:/^Preview /})).toHaveCount(19);
 await hit(page,588,385);await expect(page.getByRole('status')).toContainText('Name: S00');
 expect(await saved(page)).toEqual(original);
 // Independent DIB/font bytes are obtained through their pinned build artifacts.
 const expected=await page.evaluate(async()=>{
  const assets=await (await fetch('./assets.json')).json(),asset=assets.assets['ne-2-108'];
  const compressed=new Uint8Array(await (await fetch('./'+asset.files['pixels.zlib'])).arrayBuffer());
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate'));
  const pixels=new Uint8Array(await new Response(stream).arrayBuffer());
  const font=new Uint8Array(await (await fetch('./font.bin')).arrayBuffer());
  const text=(s,x,y)=>{for(let i=0;i<s.length;i++)for(let row=0;row<8;row++)for(let col=0;col<8;col++)
   if(font[s.charCodeAt(i)*8+row]&(128>>col))for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)pixels[(2*(y+row)+dy)*640+2*(x+8*i+col)+dx]=138;};
  for(let i=0;i<19;i++)text('S'+String(i).padStart(2,'0'),185,40+8*i);
  for(const [s,x,y] of [['S19',10,42],['Princess',10,76],['World: Beginning',10,98],['Level:',10,109],['5',120,109],['Goal WPM:',10,120],['10',120,120],['WPM:',10,131],['19',120,131],['Accuracy:',10,142],['0%',120,142],['Lesson Time:',10,153],['0:00',120,153],['Problem Keys:',10,164],['NONE!',120,164],['Certificates:',10,175],['none',34,186]])text(s,x,y);
  // Palette supplied by the decoded DIB, endpoints remain the approved adaptation.
  return {pixels:Array.from(pixels),data:asset.data};
 });
 // Compare indexed colors via actual DIB palette, ignoring only approved endpoint replacements.
 const palette=expected.data.image.palette.flat();
 expect(palette).toBeDefined();
 const actual=await page.locator('canvas').evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,640,480).data));
 let mismatches=0, first=[];
 for(let i=0;i<expected.pixels.length;i++) {
  const index=expected.pixels[i];if(index<10||index>245)continue;
  for(let k=0;k<3;k++)if(actual[i*4+k]!==palette[index*3+k]){mismatches++;if(first.length<8)first.push([i%640,Math.floor(i/640),index,actual.slice(i*4,i*4+3),palette.slice(index*3,index*3+3)]);break;}
 }
 expect({mismatches,first}).toEqual({mismatches:0,first:[]});await screenshot(page,info,'students-preview-native');
 for(let i=0;i<5;i++)await page.getByRole('button',{name:'Scroll down',exact:true}).click();
 await expect(page.getByRole('button',{name:'Preview S03',exact:true})).toBeVisible();
 await hit(page,588,385);await expect(page.getByRole('alert')).toContainText('safety');
 await screenshot(page,info,'students-scrolled-refusal');
 expect(await page.evaluate(()=>window.protectedAccesses)).toEqual([]);
});
test('load metadata transaction, correct runnable Express profile and reload adaptation',async({page},info)=>{
 await open(page);const original=await saved(page);
 await page.getByRole('button',{name:'Preview S02',exact:true}).click();
 await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('denied');};});
 await page.getByRole('button',{name:'Load selected student',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Persistence refused');expect(await saved(page)).toEqual(original);
 await screenshot(page,info,'load-refused');await page.evaluate(()=>Storage.prototype.setItem=window.originalSet);
 await page.getByRole('button',{name:'Load selected student',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('State 21 | Typed: 0');
 expect((await saved(page)).currentName).toBe('S02');expect((await saved(page)).students).toEqual(original.students);
 await page.keyboard.press('A');await expect(page.getByRole('status')).toContainText('Typed: 1');
 await screenshot(page,info,'loaded-express');await page.reload();await finishStartup(page);
 await expect(page.getByRole('status')).toContainText('Name: S02 | Character: 2 | Keyset: 2');
 expect(await page.evaluate(()=>window.protectedAccesses)).toEqual([]);
});
test('delete626 Cancel, persistence refusal, live retention and empty-display Continue gate',async({page},info)=>{
 await open(page,file(2));const before=await saved(page);
 await page.getByRole('button',{name:'Preview S00',exact:true}).click();await page.getByRole('button',{name:'Delete selected student',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Delete student (resource626)'});
 await expect(dialog).toContainText('OK to delete file S00.STU?');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();expect(await saved(page)).toEqual(before);
 await page.getByRole('button',{name:'Delete selected student',exact:true}).click();
 await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error();};});
 await dialog.getByRole('button',{name:'OK',exact:true}).click();expect(await saved(page)).toEqual(before);await expect(dialog).toBeVisible();
 await page.evaluate(()=>Storage.prototype.setItem=window.originalSet);await dialog.getByRole('button',{name:'OK',exact:true}).click();
 expect((await saved(page)).currentName).toBeNull();expect((await saved(page)).students).toEqual([before.students[1]]);
 await page.getByRole('button',{name:'Back to Welcome screen',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Name: S00'); // retained live292 bytes
 await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('status')).toContainText('Setup state 1');
 await hit(page,216,115);await expect(page.getByRole('status')).toContainText('Setup state 1');await screenshot(page,info,'deleted-live-retained');
 expect(await page.evaluate(()=>window.protectedAccesses)).toEqual([]);
});
test('empty list leaves source list and stored envelope unchanged',async({page},info)=>{
 await open(page,file(0));const before=await saved(page);
 await expect(page.getByRole('button',{name:/^Preview /})).toHaveCount(0);
 await page.getByRole('button',{name:'Load selected student',exact:true}).click();
 await page.getByRole('button',{name:'Delete selected student',exact:true}).click();
 await page.getByRole('button',{name:'Scroll down',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Setup state 6');expect(await saved(page)).toEqual(before);
 await screenshot(page,info,'empty-student-list');
 await hit(page,140,440);await expect(page.getByRole('status')).toContainText('Setup state 1');
 expect(await page.evaluate(()=>window.protectedAccesses)).toEqual([]);
});
test('non-Express modes refuse without fabricated gameplay',async({page})=>{
 const data=file(1);data.students[0].record[5]=1;await open(page,data);
 await page.getByRole('button',{name:'Preview S00',exact:true}).click();await page.getByRole('button',{name:'Load selected student',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('scene state 19');await expect(page.getByRole('status')).toContainText('Setup state 6');
});
