import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {finishStartup} from './startup-entry.mjs';
const own='mtt2-static-translation.students.v1';
const source=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
test.beforeEach(async({page})=>{
 await page.clock.install({time:new Date(2026,0,1)});await page.clock.pauseAt(new Date(2026,0,1,0,0,1));
});
async function enter(page,{origin='loaded',character=0,keyset=1,completion=false,beforeSpeech=async()=>{}}={}) {
 const record=Array(292).fill(0);record[1]=keyset;record[3]=character;record[17]=99;record[21]=2;record[29]=completion?0:10;record[21]=completion?1:2;record[274]=65;
 await page.addInitScript(({own,record})=>{if(localStorage.getItem(own)===null)localStorage.setItem(own,JSON.stringify({schema:'mario2-students.v1',currentName:'A',students:[{name:'A',record}]}));},{own,record});
 await page.goto('./');await finishStartup(page);await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 if(origin==='loaded') {
  await page.getByRole('button',{name:'Load student',exact:true}).click();await page.getByRole('button',{name:'Preview A',exact:true}).click();await page.getByRole('button',{name:'Load selected student',exact:true}).click();
 }else await page.getByRole('button',{name:'Continue',exact:true}).click();
 if(keyset===0||keyset===3)await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await expect(page.locator('#media-status')).toContainText('Movie 47');
 await beforeSpeech();
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
}
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),own);
// Test-only observers preserve production calls and arguments. No runtime debug API.
async function observe(page,{fail=false}={}) {
 await page.route('**/outside.js',async route=>route.fulfill({contentType:'text/javascript',body:(await source('outside.js')).replace('export function createOutside(', 'function createOutsideInternal(')+`
 export function createOutside(args){const api=createOutsideInternal(args);window.scene=api;window.deliveries=[];return {...api,...Object.fromEntries(['keyDown','acceptedUpdate','finishSpecial'].map(key=>[key,(...args)=>{const r=api[key](...args);window.deliveries.push({key,args,view:r.view,effects:r.effects});return r;}]))};}` }));
 await page.route('**/media.js',async route=>route.fulfill({contentType:'text/javascript',body:(await source('media.js')).replace('async audio(selector, flags = 3) {','async audio(selector, flags = 3) { (window.audioCalls??=[]).push([selector,flags]);(window.audioFrames??=[]).push([selector,flags,window.specialFrames?.length??0]);').replace('dispose() { if (!disposed)', 'dispose() { window.mediaDisposals=(window.mediaDisposals??0)+1; if (!disposed)')}));
 await page.route('**/render.js',async route=>route.fulfill({contentType:'text/javascript',body:(await source('render.js')).replace('outsideSpecial(ban,ani){','outsideSpecial(ban,ani){ (window.specialFrames??=[]).push([ban.index,ani?.index]);'+(fail?'throw Error("injected bad special plane");':''))}));
}
for(const dismiss of ['Escape','Enter','OK'])test('Beginning completion modal '+dismiss+' returns once',async({page})=>{
 await observe(page);await enter(page,{keyset:4,completion:true});
 await page.evaluate(own=>{window.writes=[];const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===own)window.writes.push(JSON.parse(v));return write.call(this,k,v);};},own);
 // Real keyboard/timer completion, no scene or report replacement.
 for(let i=0;i<6;i++){await page.keyboard.press('A');await page.clock.runFor(10000);}
 await page.clock.runFor(100);expect(await page.evaluate(()=>writes.length)).toBe(1);
 const teardown=await saved(page);expect(teardown.students[0].record[5]).toBe(0);
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 const modal=page.getByRole('dialog',{name:'Mario Teaches Typing 2',exact:true});await expect(modal).toBeVisible();
 expect(await page.evaluate(()=>writes.length)).toBe(1);
 const audio=await page.evaluate(()=>audioCalls.length);
 if(dismiss==='OK')await modal.getByRole('button',{name:'OK',exact:true}).click();else await page.keyboard.press(dismiss);
 await expect(modal).not.toBeVisible();
 const result=await saved(page);expect(result.students[0].record[5]).toBe(1);expect(result.students[0].record[1]).toBe(0);expect(result.students[0].record[37]).toBe(1);
 await page.clock.runFor(2000);
 expect(await page.evaluate(()=>writes.length)).toBe(2);expect(await saved(page)).toEqual(result);expect(await page.evaluate(()=>audioCalls.length)).toBe(audio);
 await page.getByRole('button',{name:'Repeat',exact:true}).click();await expect(page.getByRole('status')).toContainText('Water entry pending');
 expect(await saved(page)).toEqual(result);expect(await page.evaluate(()=>writes.length)).toBe(2);
});
for(const gate of [1,2]) test('mode0 writer refusal gate '+gate,async({page})=>{
 await enter(page);const initial=await saved(page);
 await page.evaluate(({own,gate})=>{window.attempts=[];const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===own){window.attempts.push(JSON.parse(v));if(window.attempts.length===gate)throw Error('refused');}return write.call(this,k,v);};},{own,gate});
 await page.clock.runFor(21100);await expect(page.getByRole('status')).toContainText('Report');
 expect((await page.evaluate(()=>window.attempts)).length).toBe(1);
 expect(await saved(page)).toEqual(gate===1?initial:(await page.evaluate(()=>window.attempts))[0]);
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 const attempts=await page.evaluate(()=>window.attempts);expect(attempts).toHaveLength(2);expect(attempts[0].students[0].record[17]).toBe(0);expect(attempts[1].students[0].record[19]).toBe(20);
 expect(await saved(page)).toEqual(attempts[gate===1?1:0]);
 if(gate===2)await expect(page.locator('#error')).toContainText('Persistence refused');
 await page.clock.runFor(1000);expect(await page.evaluate(()=>window.attempts.length)).toBe(2);
});
for(const origin of ['manual','loaded'])test('mode0 '+origin+' abandon writer without history',async({page})=>{
 await enter(page,{origin});const initial=await saved(page);await page.keyboard.press('A');await page.clock.runFor(1000);
 await page.getByRole('button',{name:'Quit to Welcome',exact:true}).click();await page.keyboard.press('Enter');
 const expected=structuredClone(initial);if(origin==='loaded')expected.students[0].record[17]=0;
 expect(await saved(page)).toEqual(expected);await expect(page.getByRole('status')).toContainText('Setup state 1');
});
for(let character=0;character<3;character++)for(const [fail,hidden] of [[false,false],[false,true],[true,true]])test('held special character='+character+' '+(fail?'refusal releases audio without completion':'keys CapsLock focus coalesced timer and cue order hidden='+hidden),async({page},info)=>{
 await observe(page,{fail});await enter(page,{character});const initial=await saved(page);
 // Drive the real scene to its visible special using authored deliveries, with
 // time fixed. This is a labeled transport vector, not natural game cadence.
 const before=await page.evaluate(()=>{for(let i=0;i<1000&&scene.snapshot().specialState!==2;i++)scene.acceptedUpdate(performance.now());window.frames=[];window.requestAnimationFrame=fn=>(frames.push(fn),frames.length);window.audioCalls=[];return scene.snapshot();});
 await page.evaluate(byte=>window.dispatchEvent(new KeyboardEvent('keydown',{keyCode:byte,key:String.fromCharCode(byte)})),before.specialByte);
 expect(await page.evaluate(()=>scene.snapshot().held)).toBe(true);
 await page.evaluate(hidden=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'a',keyCode:65,modifierCapsLock:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'b',keyCode:66}));window.dispatchEvent(new Event('blur'));Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});window.dispatchEvent(new Event('focus'));},hidden);
 await page.clock.runFor(700);
 expect(await page.evaluate(()=>scene.snapshot().counters)).toEqual(before.counters);
 expect(await page.evaluate(()=>scene.snapshot().samplePhase)).toBe(before.samplePhase);
 await page.evaluate(async()=>{while(frames.length){frames.shift()(performance.now());await Promise.resolve();await Promise.resolve();}});
 if(fail){
  await expect(page.locator('#error')).toContainText('Outside special refused');expect(await page.evaluate(()=>scene.snapshot().held)).toBe(true);
  expect((await page.evaluate(()=>audioCalls)).at(-1)).toEqual([0,192]);
  await page.clock.runFor(30000);expect(await saved(page)).toEqual(initial);await expect(page.getByRole('status')).toContainText('State 18');
 }else{
  expect(await page.evaluate(()=>scene.snapshot().held)).toBe(false);
  const deliveries=await page.evaluate(()=>deliveries);
  expect(deliveries.filter(d=>d.key==='keyDown').map(d=>d.args[0])).toEqual([before.specialByte,65,98]);
  expect(deliveries.filter(d=>d.key==='acceptedUpdate')).toHaveLength(hidden?0:1); // pending notifications coalesce, hidden suppresses
  expect((await page.evaluate(()=>audioCalls)).filter(c=>c[0]===17)).toEqual([[17,1],[17,2],[17,2],[17,2],[17,2],[17,4],[17,8]]);
  expect((await page.evaluate(()=>audioFrames)).filter(c=>c[0]===17&&c[1]===2).map(c=>c[2])).toEqual([9,28,41,49]);
  expect(await page.evaluate(()=>specialFrames.length)).toBe(55);
  expect(deliveries.find(d=>d.key==='finishSpecial').view.objects.filter(o=>o.status===4)).toHaveLength(0);
  expect((await page.evaluate(()=>deliveries.find(d=>d.key==='finishSpecial').view)).sampledClock).toBe(before.sampledClock);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});});await page.clock.runFor(250);
  expect((await page.evaluate(()=>scene.snapshot())).elapsed-before.elapsed).toBeLessThanOrEqual(2);
  await page.screenshot({path:info.outputPath('special-resumed.png')});
 }
});
test('missing special asset and malformed special plane refuse startup',async({page})=>{
 for(const malformed of [false,true]){
  await page.route('**/assets.json',async route=>{const response=await route.fetch(),data=await response.json();const key='ne-FULLSCREENANIM-MOUT.BAN';if(malformed)data.assets[key].data.frames[0].size=1e9;else delete data.assets[key];await route.fulfill({json:data});});
  await page.goto('./');await expect(page.getByRole('status')).toHaveText('Unable to start.');await expect(page.locator('#error')).toContainText(malformed?'Invalid Outside animation plane':'Missing Outside animation');await page.unroute('**/assets.json');
 }
});
for(let character=0;character<3;character++)test('original lesson content and repeat speech character '+character,async({page})=>{
 test.setTimeout(120000);
 await page.route('**/main.js',async route=>route.fulfill({contentType:'text/javascript',body:(await source('main.js')).replace('const index=random.next()%(view.character===0?7:8);','const index=(window.repeatChoice??0)%(view.character===0?7:8);')}));
 await observe(page);await enter(page,{character});
 const result=await page.evaluate(async()=>{
  const {selectLesson}=await import('./selection.js'),{createOutsideReader}=await import('./outside.js');const manifest=await(await fetch('./assets.json')).json();const results=[];
  for(const key of 'htbns') {const lesson=manifest.lessons['lesson-'+key];for(let start=0;start<lesson.delimiter_count;start++){
   const selected=selectLesson(lesson,{next:()=>start}),reader=createOutsideReader(selected),expected=[];let offset=selected.startOffset;
   for(let i=0;i<lesson.bytes.length;i++){const b=lesson.bytes[offset]&127;offset=(offset+1)%lesson.bytes.length;if(b!==96&&b!==126)expected.push(b);}
   const actual=expected.map(()=>reader.next());if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('content '+key+'/'+start);
  }results.push(key);}return results;
 });expect(result).toEqual([... 'htbns']);
 for(let choice=0;choice<8;choice++) {
  await page.clock.runFor(21100);await page.getByRole('button',{name:'Skip movie',exact:true}).click();
  // Labeled branch vector, fixed RNG output, not native RNG cadence.
  await page.evaluate(choice=>window.repeatChoice=choice,choice);
  await page.getByRole('button',{name:'Repeat',exact:true}).click();
  const index=choice%(character===0?7:8);
  const selector=index===7?(character===2?69:70):await page.evaluate(async index=>{const p=await(await fetch('./presentation.json')).json();return p.outsideRepeatSpeech[index];},index);
  await expect(page.locator('#media-status')).toContainText('Movie '+selector);await page.getByRole('button',{name:'Skip movie',exact:true}).click();await expect(page.getByRole('status')).toContainText('State 18');
 }
});
for(let character=0;character<3;character++)for(let keyset=0;keyset<5;keyset++)test('loaded original keyset entry '+character+'/'+keyset,async({page})=>{
 await observe(page);await enter(page,{character,keyset});await page.clock.runFor(100);
 const v=await page.evaluate(()=>scene.snapshot());expect(v.character).toBe(character);expect(v.keyset).toBe(keyset);expect(v.expectedByte).toBeGreaterThan(0);
 const bytes=await page.evaluate(async keyset=>(await(await fetch('./assets.json')).json()).lessons['lesson-'+'htbns'[keyset]].bytes,keyset);
 expect(bytes.map(b=>b&127)).toContain(v.expectedByte);
});
test('Beginning speech malformed media holds until explicit skip',async({page})=>{
 await observe(page);
 await page.route('**/assets.json',async route=>{const response=await route.fetch(),data=await response.json();data.assets['movies-47'].data.decoded_frames[0].decoded_bytes=1;await route.fulfill({json:data});});
 const record=Array(292).fill(0);record[1]=1;record[21]=2;record[274]=65;
 await page.addInitScript(({own,record})=>localStorage.setItem(own,JSON.stringify({schema:'mario2-students.v1',currentName:'A',students:[{name:'A',record}]})),{own,record});
 await page.goto('./');await finishStartup(page);await page.getByRole('button',{name:'Skip movie',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.locator('#media-status')).toContainText('failed');await page.clock.runFor(1000);expect(await page.evaluate(()=>typeof window.scene)).toBe('undefined');
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();await page.clock.runFor(100);await expect(page.getByRole('status')).toContainText('State 18 | Typed: 0');
});

for(const origin of ['manual','loaded'])for(const failure of ['missing','malformed','no-target','construction','reentry'])test('Outside entry content refusal '+origin+'/'+failure,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const diagnostics=[];page.on('console',m=>{if(m.type()==='error')diagnostics.push(m.text());});
 await observe(page);
 await page.route('**/setup.js',async route=>route.fulfill({contentType:'text/javascript',body:(await source('setup.js')).replace('beginTyping() {','beginTyping() { window.typingEntries=(window.typingEntries??0)+1;')}));
 if(['missing','malformed','no-target'].includes(failure))await page.route('**/assets.json',async route=>{
  const response=await route.fetch(),data=await response.json();
  if(failure==='missing')delete data.lessons['lesson-t'];
  else if(failure==='malformed')data.lessons['lesson-t'].starts=[];
  else data.lessons['lesson-t'].bytes=[32,96,126];
  await route.fulfill({json:data});
 });
 if(failure==='construction'||failure==='reentry') {
  await page.unroute('**/outside.js');
  await page.route('**/outside.js',async route=>route.fulfill({contentType:'text/javascript',body:(await source('outside.js'))
   .replace("if (!random?.next)",(failure==='construction'?'throw Error("injected scene construction failure"); ':'')+"if (!random?.next)")
   .replace('reenter(args) {','reenter(args) { throw Error("injected scene reentry failure");')}));
 }
 let initial;
 await enter(page,{origin,beforeSpeech:async()=>{initial=await saved(page);}});
 if(failure==='reentry'){
  await page.clock.runFor(21100);await page.getByRole('button',{name:'Skip movie',exact:true}).click();
  await page.getByRole('button',{name:'Repeat',exact:true}).click();
  initial=await saved(page);
  await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 }
 await expect(page.getByRole('status')).toHaveText('Outside entry refused. Reload to retry.');
 await expect(page.locator('#error')).toContainText('Outside entry refused:');
 expect(await page.evaluate(()=>window.typingEntries??0)).toBe(failure==='reentry'?1:0);
 expect(await saved(page)).toEqual(initial);
 const audioCount=await page.evaluate(()=>audioCalls.length);
 await page.keyboard.press('A');await page.keyboard.press('Escape');
 await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));});
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await page.clock.runFor(30000);
 await expect(page.getByRole('status')).toHaveText('Outside entry refused. Reload to retry.');
 expect(await saved(page)).toEqual(initial);
 expect((await page.evaluate(()=>audioCalls)).slice(audioCount).every(([selector])=>selector===0)).toBe(true);
 expect(await page.evaluate(()=>window.mediaDisposals)).toBe(1);
 await expect(page.locator('details button:enabled')).toHaveCount(0);
 expect(errors).toEqual([]);expect(diagnostics.some(m=>m.includes('Outside entry refused'))).toBe(true);
 await page.screenshot({path:info.outputPath('entry-refused.png')});
 // Explicit reload is the only recovery action, not a synthetic scene retry.
 await page.unroute('**/assets.json');await page.unroute('**/outside.js');
 await page.getByRole('button',{name:'Reload to retry',exact:true}).click();
 await finishStartup(page);
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('State 18 | Typed: 0');
 expect(await saved(page)).toEqual(initial);
});
