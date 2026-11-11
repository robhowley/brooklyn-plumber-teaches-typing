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

for(const outcome of ['ended','denied','muted','suspended'])test(`first menu gesture from natural startup waits for delayed unlock: ${outcome}`,async({page})=>{
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
 if(outcome==='muted')await page.evaluate(()=>document.querySelector('#host-mute').click());
 if(outcome==='suspended')await page.evaluate(()=>window.firstContext.suspend());
 if(['muted','suspended'].includes(outcome))await page.waitForFunction(()=>!translationSnapshot().audioHost.blocking);
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

test('native Chrome buffers contain every exact VOC sample and source requests wait for ended',async({page})=>{
 test.setTimeout(45000);await open(page);
 // Independent authored transport test, real trusted gesture and real Chrome nodes.
 await page.locator('#host-mute').click();
 await page.evaluate(async()=>{
   const {BrowserAudio}=await import(new URL('app/audio.mjs',location.href));const {SourceAudio}=await import(new URL('recovered/audio/audio.mjs',location.href));
   const data=await fetch(new URL('app/data.json',location.href)).then(r=>r.json());const player=new BrowserAudio();
   const source=new SourceAudio({...data.audio.config,available:{music:true,effects:true,speech:true}});
   for(const [name,c] of Object.entries(data.audio.clips))player.register(name,Uint8Array.from(atob(c.pcm),x=>x.charCodeAt(0)),c);
   window.audioProof={done:false,checks:[]};
   document.querySelector('#audio-unlock').addEventListener('pointerdown',async e=>{
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
 await page.locator('#audio-unlock').click();await page.waitForFunction(()=>window.audioProof.done,null,{timeout:20000});
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
test('blur and host mute settle speech without deadlock or replay; source options stay separate',async({page})=>{
 await open(page);await page.locator('#game').press('2');await page.waitForFunction(()=>translationSnapshot().audioHost.active);
 const count=await page.evaluate(()=>pcmStarts.length);await page.locator('#host-mute').click();
 await page.waitForFunction(()=>!translationSnapshot().audioHost.blocking);let s=await snap(page);
 expect(s.audioHost.sourceOptions).toBe(7);expect(s.audioHost.outcomes.at(-1).outcomes[0].status).toMatch(/muted|blur/);
 await page.locator('#host-mute').click();await page.locator('#focus').click();await page.waitForTimeout(150);
 expect(await page.evaluate(()=>pcmStarts.length)).toBe(count);expect((await snap(page)).screen).toBe('water');
});
test('denied speech is acknowledged, later unlock never replays historical welcome or Ready',async({page})=>{
 await open(page,{denied:true});await page.locator('#game').press('2');await page.waitForTimeout(200);
 let s=await snap(page);expect(s.water.phase).not.toBe('ready');expect(s.audioHost.blocking).toBe(false);
 expect(s.audioHost.outcomes.some(e=>e.outcomes.some(o=>o.status==='denied'))).toBe(true);
 await page.evaluate(()=>{AudioContext.prototype.resume=window.nativeResume;});await page.locator('#audio-unlock').click();
 await page.waitForTimeout(150);expect(await page.evaluate(()=>pcmStarts.length)).toBe(0);
});
test('disabled Alt-X is consumed in fields, chooser, Help, results and all four worlds including Demo',async({page})=>{
 test.setTimeout(45000);await page.goto('./?seed=1');await skipStartupUI(page);
 await page.locator('#game').press('w');const field=(await snap(page)).studentUI;
 await page.locator('#game').press('Alt+x');expect((await snap(page)).studentUI).toEqual(field);
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
