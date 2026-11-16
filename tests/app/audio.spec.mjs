import {test,expect} from '@playwright/test';
import {skipStartupUI} from './source-path.mjs';
import {newStudent} from '../../recovered/control/student.mjs';
import {editStudent} from '../../app/session.mjs';
const snap=page=>page.evaluate(()=>translationSnapshot());
async function open(page,{denied=false}={}) {
 const bytes=Array.from(editStudent(newStudent('Audio'),{goal:30,waterMinutes:1}));
 await page.addInitScript(({bytes,denied})=>{
   localStorage.setItem('mtt-static-translation.students.v1',JSON.stringify({current:'Audio',students:{Audio:bytes}}));
   window.pcmStarts=[];window.pcmEnds=[];
   const proto=AudioContext.prototype,create=proto.createBufferSource;
   window.nativeResume=proto.resume;
   if(denied)proto.resume=function(){return Promise.reject(new Error('test denied'));};
   proto.createBufferSource=function(){const node=create.call(this),start=node.start;node.start=function(...args){
     const samples=Array.from(this.buffer.getChannelData(0));
     window.pcmStarts.push({length:this.buffer.length,rate:this.buffer.sampleRate,samples});
     this.addEventListener('ended',()=>window.pcmEnds.push(this.buffer.length));return start.apply(this,args);
   };return node;};
 },{bytes,denied});
 await page.goto('./?seed=1');await skipStartupUI(page,{muted:false});
}

for(const outcome of ['ended','denied','blur','suspended'])test(`first menu gesture from natural startup waits for delayed unlock: ${outcome}`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const bytes=Array.from(editStudent(newStudent('First'),{goal:30,waterMinutes:1}));
 await page.clock.install();
 await page.addInitScript(({bytes})=>{
   localStorage.setItem('mtt-static-translation.students.v1',JSON.stringify({current:'First',students:{First:bytes}}));
   window.resumeCalls=0;window.firstStarts=0;
   const proto=AudioContext.prototype,resume=proto.resume,create=proto.createBufferSource;
   proto.resume=function(){
     window.resumeCalls++;window.firstContext=this;
     // Native resume is invoked in the real gesture, only its result is delayed.
     const native=resume.call(this);native.catch(()=>{});
     return new Promise((resolve,reject)=>{window.finishUnlock=async denied=>{
       try{await native;if(denied)reject(new Error('test denial'));else resolve();}catch(e){reject(e);}
     };});
   };
   proto.createBufferSource=function(){window.firstStarts++;return create.call(this);};
 },{bytes});
 await page.goto('./?seed=1');await page.waitForFunction(()=>document.querySelector('#game').dataset.screen==='startup');
 await page.locator('#game').focus(); // Focus is not an unlocking input gesture.
 await page.clock.runFor(16400);
 let s=await snap(page);expect(s.screen).toBe('menu');expect(s.audioHost.state).toBe('locked');
 expect(await page.evaluate(()=>resumeCalls)).toBe(0);
 expect(s.audioHost.outcomes.find(e=>e.name==='welcome').outcomes[0].status).toBe('locked');
 await page.locator('#game').press('2');await page.clock.runFor(120);
 s=await snap(page);expect(s.water.phase).toBe('ready');expect(s.audioHost.blocking).toBe(true);
 const seed=s.seed;await page.locator('#game').press('A');await page.locator('#game').press('Escape');
 await page.clock.runFor(600);s=await snap(page);
 expect(s.water.stats.attempts).toBe(0);expect(s.seed).toBe(seed);expect(s.water.lastInput).toBeUndefined();
 expect(s.audio.some(e=>e.request.type==='music'&&e.request.id===3)).toBe(false);
 expect(await page.evaluate(()=>resumeCalls)).toBe(1);expect(await page.evaluate(()=>firstStarts)).toBe(0);
 if(outcome==='blur')await page.locator('#game').evaluate(c=>c.blur());
 if(outcome==='suspended')await page.evaluate(()=>window.firstContext.suspend());
 if(['blur','suspended'].includes(outcome))await page.waitForFunction(()=>!translationSnapshot().audioHost.blocking);
 await page.evaluate(denied=>{void window.finishUnlock(denied);},outcome==='denied');
 if(outcome==='ended'){
   await page.waitForFunction(()=>translationSnapshot().audioHost.active);
   await page.locator('#game').press('A');await page.locator('#game').press('Escape');
   await page.clock.runFor(2400);s=await snap(page);
   expect(s.water.phase).toBe('ready');expect(s.water.stats.attempts).toBe(0);expect(s.seed).toBe(seed);
 }
 await page.waitForFunction(()=>!translationSnapshot().audioHost.blocking);
 await page.clock.runFor(60);s=await snap(page);
 expect(s.screen).toBe('water');expect(s.water.phase).not.toBe('ready');expect(s.water.stats.attempts).toBe(0);
 expect(s.audioHost.outcomes.at(-1).outcomes[0].status).toBe(outcome);
 expect(s.audio.some(e=>e.request.type==='music'&&e.request.id===3)).toBe(true);
 if(outcome==='ended')expect(s.ticks).toBeGreaterThanOrEqual(54);
 await page.waitForTimeout(100);expect(await page.evaluate(()=>firstStarts)).toBe(outcome==='ended'?1:0);
 expect(errors).toEqual([]);
});

test('audio completion clears queued Practice input at the browser boundary (adapter)',async({page})=>{
 await page.clock.install();await page.addInitScript(()=>{window.__sourceTestClock=true;});
 await open(page,{denied:true});await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 // Practice emits no blocking speech. This browser-owned adapter exercises the
 // defensive completion flush, not an original Practice speech path.
 await page.evaluate(async()=>{
  AudioContext.prototype.resume=function(){
   const native=window.nativeResume.call(this);native.catch(()=>{});
   return new Promise((resolve,reject)=>{window.denyPracticeUnlock=()=>reject(new Error('test denied'));});
  };
  const {Session}=await import(new URL('app/session.mjs',location.href)),step=Session.prototype.step;
  Session.prototype.step=function(...args){
   Session.prototype.step=step;
   window.requestPracticeSpeech=()=>this.audio({type:'speech',name:'ready'});
   return step.apply(this,args);
  };
 });
 const game=page.locator('#game');await game.press('4');await page.clock.runFor(60);
 const before=await snap(page),targets=before.practice.rows.slice(33,36).map(c=>String.fromCharCode(c));
 await game.evaluate((game,keys)=>{
  for(const key of keys)game.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
  window.requestPracticeSpeech();
 },targets);
 let s=await snap(page);expect(s.audioHost.blocking).toBe(true);expect(s.suspended).toBe(false);
 expect(s.practice).toMatchObject({index:0,attempts:0,correct:0});
 await page.clock.runFor(600);s=await snap(page);
 expect(s.ticks).toBe(before.ticks);expect(s.audioHost.blocking).toBe(true);
 await page.evaluate(()=>window.denyPracticeUnlock());
 await page.waitForFunction(()=>!translationSnapshot().audioHost.blocking);
 expect((await snap(page)).audioHost.outcomes.at(-1)).toMatchObject({name:'ready',outcomes:[{status:'denied'}]});
 // No blur, focus, navigation or interval drain can clear the queue before this completion.
 await page.clock.runFor(60);s=await snap(page);
 expect(s.screen).toBe('practice');expect(s.suspended).toBe(false);
 expect(s.practice).toMatchObject({index:0,attempts:0,correct:0});
 await game.press(targets[0]);await page.clock.runFor(60);
 expect((await snap(page)).practice).toMatchObject({index:1,attempts:1,correct:1});
});

test('queued Practice input stays discarded through Ready speech and Demo host-clock reset',async({page})=>{
 await page.clock.install();await page.addInitScript(()=>{window.__sourceTestClock=true;});
 await open(page,{denied:true});await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 const game=page.locator('#game');await game.press('4');
 const targets=(await snap(page)).practice.rows.slice(33,36).map(c=>String.fromCharCode(c));
 await game.evaluate((game,keys)=>{
  for(const key of keys)game.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
  game.blur();
 },targets);
 await game.focus();await page.clock.runFor(60);
 expect((await snap(page)).practice).toMatchObject({index:0,attempts:0,correct:0});
 // Practice emits effects only, and mode 4 suppresses result speech (FILE 0x165a9..0x16603).
 // Blocking speech is reachable only after leaving Practice, here Outside Ready.
 await game.evaluate((game,keys)=>{
  for(const key of ['Escape',...keys])game.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
 },targets);
 await page.clock.runFor(60);expect((await snap(page)).screen).toBe('results');
 await game.press('m');await page.clock.runFor(300);
 await page.evaluate(()=>{
  AudioContext.prototype.resume=function(){
   const native=window.nativeResume.call(this);native.catch(()=>{});
   return new Promise((resolve,reject)=>{window.finishPracticeUnlock=()=>native.then(resolve,reject);});
  };
 });
 await game.press('1');const blocked=await snap(page);
 expect(blocked.screen).toBe('outdoor');expect(blocked.audioHost.blocking).toBe(true);
 expect(blocked.audio.at(-1).request.name).toBe('ready');
 await game.evaluate(game=>{
  for(const key of ['a','Escape','n','m','4'])game.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
 });
 await page.clock.runFor(600);expect((await snap(page)).ticks).toBe(blocked.ticks);
 await game.evaluate(game=>game.blur());await page.waitForFunction(()=>!translationSnapshot().audioHost.blocking);
 expect((await snap(page)).audioHost.outcomes.at(-1).outcomes[0].status).toBe('blur');
 await page.evaluate(()=>window.finishPracticeUnlock());await game.focus();await page.clock.runFor(60);
 expect((await snap(page)).outdoor.attempts).toBe(0);
 expect(await page.evaluate(()=>pcmStarts.length)).toBe(0); // Late unlock never replays Ready.
 await game.press('Escape');await page.clock.runFor(60);await game.press('m');await page.clock.runFor(300);
 // Only Demo exit emits host-clock-reset. Demo Practice uses the shared FIFO,
 // never the ordinary Practice queue. Exercise that reachable return path.
 expect((await snap(page)).screen).toBe('menu');
 await game.press('d');await page.clock.runFor(300);expect((await snap(page)).profile.demo).toBe(true);
 // Selecting Demo itself requests Welcome. Settle that real speech by blur too.
 expect((await snap(page)).audio.at(-1).request.name).toBe('welcome');
 expect((await snap(page)).audioHost.blocking).toBe(true);
 await game.evaluate(game=>game.blur());await page.waitForFunction(()=>!translationSnapshot().audioHost.blocking);
 await game.focus();await game.press('4');await page.clock.runFor(180);
 expect(await snap(page)).toMatchObject({screen:'practice',audioHost:{blocking:false},demo:{mode:4}});
 await game.evaluate((game,keys)=>{
  for(const key of ['Escape',...keys])game.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
 },targets);
 await page.clock.runFor(60);let s=await snap(page);
 expect(s.screen).toBe('menu');expect(s.profile.demo).toBe(false);expect(s.inputPending).toBe(false);
 await page.clock.runFor(300);await game.press('4');await page.clock.runFor(60);s=await snap(page);
 expect(s.screen).toBe('practice');expect(s.practice).toMatchObject({index:0,attempts:0,correct:0});
 await game.press(String.fromCharCode(s.practice.rows[33]));await page.clock.runFor(60);
 expect((await snap(page)).practice).toMatchObject({index:1,attempts:1,correct:1});
});

test('native Chrome buffers contain every exact VOC sample and source requests wait for ended',async({page})=>{
 test.setTimeout(45000);await open(page);
 // Independent authored transport test, real trusted gesture and real Chrome nodes.
 await page.locator('#game').press('Shift');
 await page.evaluate(async()=>{
   const {BrowserAudio}=await import(new URL('app/audio.mjs',location.href));const {SourceAudio}=await import(new URL('recovered/audio/audio.mjs',location.href));
   const data=await fetch(new URL('app/data.json',location.href)).then(r=>r.json());const player=new BrowserAudio();
   const source=new SourceAudio({...data.audio.config,available:{music:true,effects:true,speech:true}});
   for(const [name,c] of Object.entries(data.audio.clips))player.register(name,Uint8Array.from(atob(c.pcm),x=>x.charCodeAt(0)),c);
   window.audioProof={done:false,checks:[]};
   document.querySelector('#game').addEventListener('keydown',async e=>{
     await player.unlock(e);
     for(const name of ['congrats','ready','toobad','welcome']) {
       const d=source.request({type:'speech',name});const p=player.perform(d);
       const node=player.active.node,pcm=atob(data.audio.clips[name].pcm),samples=node.buffer.getChannelData(0);
       const exact=samples.length===pcm.length&&samples.every((v,i)=>v===(pcm.charCodeAt(i)-128)/128);
       const blocked=source.request({type:'music',id:3}).status;
       const outcome=await p;source.complete(d.token);window.audioProof.checks.push({name,exact,blocked,outcome});
     }
     await player.close();window.audioProof.done=true;
   },{once:true});
 });
 await page.locator('#game').press('Shift');await page.waitForFunction(()=>window.audioProof.done,null,{timeout:20000});
 const proof=await page.evaluate(()=>window.audioProof);expect(proof.checks).toHaveLength(4);
 for(const c of proof.checks){expect(c.exact).toBe(true);expect(c.blocked).toBe('blocked');expect(c.outcome[0].status).toBe('ended');}
});
test('Water real Ready drains input, starts music only after completion and includes speech in elapsed ticks',async({page})=>{
 await open(page);await page.locator('#game').press('2');
 await page.waitForFunction(()=>translationSnapshot().audioHost.blocking);
 const before=await snap(page);expect(before.water.phase).toBe('ready');expect(before.water.lastInput).toBeUndefined();
 expect(before.audio.at(-1).request.name).toBe('ready');
 await page.locator('#game').press('A');await page.locator('#game').press('Escape');
 await page.waitForFunction(()=>!translationSnapshot().audioHost.blocking);await page.waitForTimeout(130);
 const after=await snap(page);expect(after.screen).toBe('water');expect(after.water.stats.attempts).toBe(0);
 expect(after.ticks).toBeGreaterThanOrEqual(39);expect(after.audio.some(e=>e.request.type==='music'&&e.request.id===3)).toBe(true);
 const target=after.water.window[after.water.targetIndex];await page.locator('#game').press(String.fromCharCode(target));await page.waitForTimeout(100);
 expect((await snap(page)).water.stats.correct).toBe(1);
});
test('blur settles speech without deadlock or replay; source options stay unchanged',async({page})=>{
 await open(page);await page.locator('#game').press('2');await page.waitForFunction(()=>translationSnapshot().audioHost.active);
 const count=await page.evaluate(()=>pcmStarts.length);await page.locator('#game').evaluate(c=>c.blur());
 await page.waitForFunction(()=>!translationSnapshot().audioHost.blocking);let s=await snap(page);
 expect(s.audioHost.sourceOptions).toBe(7);expect(s.audioHost.outcomes.at(-1).outcomes[0].status).toBe('blur');
 await page.locator('#game').focus();await page.waitForTimeout(150);
 expect(await page.evaluate(()=>pcmStarts.length)).toBe(count);expect((await snap(page)).screen).toBe('water');
});
test('denied speech is acknowledged, later unlock never replays historical welcome or Ready',async({page})=>{
 await open(page,{denied:true});await page.locator('#game').press('2');await page.waitForTimeout(200);
 let s=await snap(page);expect(s.water.phase).not.toBe('ready');expect(s.audioHost.blocking).toBe(false);
 expect(s.audioHost.outcomes.some(e=>e.outcomes.some(o=>o.status==='denied'))).toBe(true);
 await page.evaluate(()=>{AudioContext.prototype.resume=window.nativeResume;});await page.locator('#game').press('Shift');
 await page.waitForTimeout(150);expect(await page.evaluate(()=>pcmStarts.length)).toBe(0);
});
test('disabled Alt-X is consumed in fields, chooser, Help, results and all four worlds including Demo',async({page})=>{
 test.setTimeout(45000);await page.clock.install();await page.goto('./?seed=1');await skipStartupUI(page);
 // Compare input effects without advancing the independently blinking caret.
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 await page.locator('#game').press('w');const field=(await snap(page)).studentUI;
 await page.locator('#game').press('Alt+x');expect((await snap(page)).studentUI).toEqual(field);
 await page.clock.resume();
 await page.locator('#game').press('Escape');await page.locator('#game').press('Escape');
 await page.locator('#game').press('l');await page.locator('#game').press('Alt+x');expect((await snap(page)).screen).toBe('load');
 await page.locator('#game').press('Escape');
 for(const demo of [false,true])for(const mode of [1,2,3,4]) {
   await page.waitForTimeout(300);
   if(demo){await page.locator('#game').press('d');await page.waitForTimeout(300);}
   await page.locator('#game').press(String(mode));await page.waitForTimeout(250);
   await page.waitForFunction(()=>!translationSnapshot().audioHost.blocking);
   await page.locator('#game').press('Alt+x');await page.waitForTimeout(100);
   expect((await snap(page)).screen).toBe(({1:'outdoor',2:'water',3:'castle',4:'practice'})[mode]);
   await page.locator('#game').press('Escape');await page.waitForFunction(demo=>translationSnapshot().screen===(demo?'menu':'results'),demo);
   if(demo)continue;
   await page.locator('#game').press('Alt+x');expect((await snap(page)).screen).toBe('results');
   await page.locator('#game').press('F1');expect((await snap(page)).screen).toBe('help');
   await page.locator('#game').press('Alt+x');expect((await snap(page)).screen).toBe('help');
   await page.locator('#game').press('Escape');await page.locator('#game').press('m');
 }
});
