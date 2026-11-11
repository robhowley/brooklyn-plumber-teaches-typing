import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Session,editStudent} from '../../app/session.mjs';
import {newStudent} from '../../recovered/control/student.mjs';
import {skipStartup,finishCelebration} from './source-path.mjs';
import {Renderer} from '../../app/render.mjs';
const data=JSON.parse(readFileSync(new URL('../../app/data.json',import.meta.url)));
const make=(settings={})=>skipStartup(new Session(data,{bytes:editStudent(newStudent('Ada'),settings),seed:1}));
function lcg(seed,count) {let n=BigInt(seed);while(count--)n=(n*22695477n+1n)&0xffffffffn;return Number(n);}
test('process entry includes natural startup13 draws or explicit source skips0, then menu RNG',()=>{
  for(const natural of [false,true]) {
    const s=new Session(data,{seed:1});let waits=0,events=[...s.takePresentationEffects()];
    if(!natural)for(let i=0;i<4;i++)s.enqueue(32);
    while(s.screen==='startup') {s.step(0,++waits,0);events.push(...s.takePresentationEffects());}
    assert.equal(s.seed,lcg(1,natural?13:0));assert.equal(waits,natural?291:1);
    assert.equal(events.filter(e=>e.type==='letter').length,13);
    assert.equal(s.input.pending(),false);
    s.menuStep(waits+1);assert.equal(s.seed,lcg(1,natural?14:1));
    assert.equal(s.audioLog.every(e=>e.status==='unsupported-silent'),true);
    assert.equal(s.audioLog.filter(e=>e.request.type==='effect'&&e.request.id===1).length,natural?13:0);
    assert.deepEqual(s.audioLog.filter(e=>e.request.type==='speech').map(e=>e.request.name),['welcome']);
  }
});
test('source entry audio callback returns before Water last-input sample and Castle next operation',()=>{
  const calls=[];const s=skipStartup(new Session(data,{seed:1,audioBoundary:r=>{calls.push(r);return {status:'explicit-silent'};}}));
  s.start(10,2,123);assert.ok(calls.some(r=>r.name==='ready'));assert.equal(calls.at(-1).id,3);assert.equal(s.water.lastInput,123);
  s.start(20,3,124);const before=calls.length;s.step(0,21,124);assert.equal(calls.length,before+2);assert.equal(calls.at(-2).name,'ready');assert.equal(calls.at(-1).id,4);
  assert.throws(()=>new Session(data,{audioBoundary:()=>Promise.resolve()}),/synchronous/);
});
test('all3 characters use all4 source Demo polling sites and abort without saving or progression',()=>{
  for(const character of [1,2,3])for(const mode of [1,2,3,4]) {
    const s=make({character,goal:30});s.selectDemo();s.start(0,mode,100);
    let t=1;while(s.active&&s.activity.correct<2&&t<300) {s.step(0,t++,100);s.takeEffects();}
    assert.ok(s.activity.correct>=1,`${character}/${mode}`);assert.equal(s.profile.profilePresent,false);
    // Repeated physical Escape handles the source's deferred/overwritten key sites.
    for(let i=0;i<100&&s.active;i++)s.step(27,t++,100);
    assert.equal(s.screen,'menu');assert.equal(s.profile.demo,false);assert.equal(s.profile.lesson,1);
    assert.equal(s.input.pending(),false);assert.equal(s.resultEffects.some(e=>e.type==='result-stats'),false);
    let saved=false;s.save({setItem(){saved=true;}},{students:{}});assert.equal(saved,false);
  }
});
test('all3 characters finish all-world presentations before results, never on abort',()=>{
  for(const character of [1,2,3])for(const mode of [1,2,3]) {
    const s=make({character,goal:mode===1?5:mode===2?25:45,lesson:6,minutes:1,waterMinutes:1,castleMinutes:1});
    s.start(0,mode,100);let t=1;
    if(mode===1) {s.outdoor.correct=180;s.outdoor.attempts=180;s.step(0,1092,160);}
    else if(mode===2) {s.water.stats.correct=180;s.water.stats.attempts=180;s.water.lastInput=160;s.step(0,1092,160);s.step(0,1093,160);}
    else {s.step(0,t++,100);s.castle.stats.correct=5;s.castle.stats.attempts=5;s.castle.stats.limitSeconds=1;s.step(9,20,101);s.step(0,21,101);}
    assert.equal(s.screen,'celebration',`${character}/${mode}`);assert.equal(s.clock.running,false);
    if(mode===3)assert.equal(s.profile.completed[2],0);
    const ticks=s.clock.ticks;finishCelebration(s);assert.equal(s.screen,'results');assert.equal(s.clock.ticks,ticks);
    assert.equal(s.profile.completed[mode-1],1);const lesson=s.profile.lesson,goal=s.profile.goal;
    let saved;s.next(20000,()=>{saved={pending:[...s.profile.pending],printed:[...s.profile.printed]};});
    assert.equal(saved.pending[mode-1],1);assert.equal(saved.printed[mode-1],0);
    assert.equal(s.next(20001),null);assert.equal(s.profile.goal,goal);assert.ok(lesson>=1);
    const abort=make({character,goal:45});abort.start(0,mode,100);
    for(let i=1;abort.active&&i<100;i++)abort.step(27,i,100);
    assert.equal(abort.screen,'results');assert.equal(abort.celebration,undefined);assert.equal(abort.advance.advanced,false);
  }
});
test('real indexed renderer applies59 startup palette writes, presentation texts and full clip restoration',async()=>{
 const r=new Renderer({getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(256000)}),putImageData(){}})},data);
 const oldFetch=globalThis.fetch;globalThis.fetch=async path=>({ok:true,arrayBuffer:async()=>{const b=readFileSync(new URL('../../'+path.slice(2),import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}});
 try {await r.load();}finally{globalThis.fetch=oldFetch;}
 const s=new Session(data,{seed:1});r.presentation(s.takePresentationEffects(),1);
 for(let t=1;s.screen==='startup';t++){s.step(0,t,0);r.presentation(s.takePresentationEffects(),1);}
 assert.equal(r.paletteWrites,59);
 for(const character of [1,2,3]) {
  const w=make({character,goal:25,lesson:6,waterMinutes:1});w.start(0,2,100);w.water.stats.correct=180;w.water.stats.attempts=180;w.water.lastInput=160;
  w.step(0,1092,160);w.step(0,1093,160);r.presentation(w.takePresentationEffects(),character);
  for(let t=2000;w.screen==='celebration';t++) {w.step(w.celebration.wait==='wait-input'?32:0,t,160);r.presentation(w.takePresentationEffects(),character);}
  assert.deepEqual(r.celebrationRenderer.clip,{left:0,top:0,right:319,bottom:199});assert.equal(r.presentationPalette.every(v=>v===0),true);
 }
});
