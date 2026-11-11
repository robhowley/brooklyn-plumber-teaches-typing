import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Session,editStudent} from '../../app/session.mjs';
import {Renderer} from '../../app/render.mjs';
import {newStudent} from '../../recovered/control/student.mjs';
import {skipStartup,finishCelebration} from './source-path.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../../app/data.json',import.meta.url)));
function make(character=1,goal=30,lesson=1) {
 const s=skipStartup(new Session(data,{bytes:editStudent(newStudent('Castle'),{character,goal,lesson,castleMinutes:60}),seed:1}));
 s.start(0,3,100);return s;
}
function auto(s,t) {
 const c=s.castle;
 return s.step(!c.locked&&['rockfaces','sand'].includes(c.phase)?c.queue.target:0,t,100);
}
function acknowledge(s) {if(s.castleEnding)finishCelebration(s);}
async function renderer() {
 const r=new Renderer({getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(256000)}),putImageData(){}})},data);
 const before=globalThis.fetch;
 globalThis.fetch=async path=>({ok:true,arrayBuffer:async()=>{const b=fs.readFileSync(new URL('../../'+path.replace(/^\.\//,''),import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}});
 try {await r.load();} finally {globalThis.fetch=before;}return r;
}
test('Castle host waits on changed LOW ticks, keeps FIFO one key per operation, no catchup',()=>{
 const s=make();const first=s.takeEffects();
 assert.ok(first.some(e=>e.type==='text'));assert.ok(!first.some(e=>e.type==='ready'));
 const x=s.castle.x,key=s.castle.queue.target;s.enqueue(key);s.enqueue(9);
 assert.deepEqual(s.step(0,65536,100),[]);assert.equal(s.castle.x,x);
 const events=s.step(0,65537,100);assert.equal(s.castle.stats.correct,1);
 assert.equal(s.input.pending(),true);assert.ok(events.some(e=>e.type==='ready'));
 s.step(0,70000,100);assert.equal(s.castle.stats.attempts,1);assert.equal(s.input.pending(),false);
 const errors=s.castle.stats.errors;s.step(s.castle.queue.target^32,70001,100);
 assert.equal(s.castle.stats.errors,errors+1);
 assert.equal(s.profile.errorCounts[s.castle.queue.target-32],1);
});
test('real source sentences and indexed renderer run two full normal cycles for all characters',async()=>{
 const r=await renderer();
 for(const char of [1,2,3]) {
  const s=make(char);r.castle(s.takeEffects(),s.castle);let strips=0;const scenes=[];
  for(let t=1;s.castle.cycle<2||s.castle.phase!=='rockfaces';t++) {
   assert.ok(t<15000,`${char}:${s.castle.phase}`);
   const events=auto(s,t);strips+=events.filter(e=>e.type==='scroll-strip').length;
   scenes.push(...events.filter(e=>e.type==='scroll-end').map(e=>e.scene));
   r.castle(s.takeEffects(),s.castle);
  }
  assert.equal(strips,320);assert.deepEqual(scenes,[1,2,3,0,1,2,3,0]);
  assert.ok(s.castle.stats.correct>100);assert.equal(s.castle.stats.errors,0);
  assert.equal(s.castle.flags.failed,false);assert.equal(r.palette,'castle-'+['m','l','p'][char-1]);
 }
});
test('clean stationary rockface does not erase overlapping foreground pixels, dirty record does',async()=>{
 const r=await renderer(),s=make();r.castle(s.takeEffects(),s.castle);
 s.castle.rockfaces=[{x:100,y:40,phase:0,resourceIndex:0,dirty:false}];
 // Synthetic foreground occupies the actual rock rectangle. Repainting a clean
 // rockface would restore its background and destroy these foreground pixels.
 r.front.fill(253,40*320+100,40*320+110);const before=r.front.slice();
 s.castle.effects=[];s.castle.updateRocks(0);r.castle(s.castle.effects,s.castle);
 assert.deepEqual(r.front,before);
 s.castle.rockfaces[0].dirty=true;s.castle.updateRocks(0);r.castle(s.castle.effects,s.castle);
 assert.notDeepEqual(r.front,before);
});
test('draw snapshots retain queue metadata despite later typing; op3 ignores attempts/failure/refresh',async()=>{
 const s=make(),r=await renderer();const initial=s.takeEffects();
 const text=initial.find(e=>e.type==='text'),before=Array.from(text.words);
 const statistics=initial.find(e=>e.type==='statistics'&&e.operation===200),statsBefore={...statistics.stats};
 s.step(s.castle.queue.target,1,100);assert.deepEqual(Array.from(text.words),before);
 assert.deepEqual(statistics.stats,statsBefore);assert.notEqual(s.castle.stats.attempts,statistics.stats.attempts);
 r.castle(initial,s.castle);assert.ok(r.front.some(v=>v));
 let t=2;for(;s.castle.phase!=='scroll';t++){assert.ok(t<6000);auto(s,t);s.takeEffects();}
 const attempts=s.castle.stats.attempts,ticks=s.castle.stats.ticks;
 s.enqueue(65);s.enqueue(66);s.step(0,t,999);
 assert.equal(s.castle.stats.attempts,attempts);assert.equal(s.castle.stats.ticks,ticks);
 assert.equal(s.castle.flags.failed,false);assert.equal(s.input.pending(),true);
});
test('Castle bonus exact packets, two changed ticks, stop/restore/flush and retained clocks',async()=>{
 const s=make(),r=await renderer();r.castle(s.takeEffects(),s.castle);
 s.castle.bonus.mode=2;s.castle.bonus.y=90;
 s.step(s.castle.bonus.code,1,100);r.castle(s.takeEffects(),s.castle);
 assert.equal(s.castleMovie.frame,0);const ticks=s.clock.ticks,attempts=s.castle.stats.attempts;
 s.enqueue(65);s.step(0,65537,101);assert.equal(s.castleMovie.frame,0);
 s.step(0,2,101);assert.equal(s.castleMovie.frame,0);
 s.step(0,3,101);assert.equal(s.castleMovie.frame,1);
 r.castle(s.takeEffects(),s.castle);
 for(let t=4;t<=105;t++){s.step(0,t,107);r.castle(s.takeEffects(),s.castle);}
 assert.equal(s.castleMovie,null);assert.equal(s.clock.ticks,ticks);
 assert.equal(s.castle.stats.attempts,attempts);assert.equal(s.input.pending(),false);
 assert.ok(s.castle.rockfaces.every(r=>r.dirty));assert.equal(s.castle.lastInput,107);
 s.step(0,106,107);assert.equal(s.clock.ticks,ticks+1);
 const retained=s.castlePersistent;s.step(27,107,107);s.step(0,108,107);
 s.start(200,4,107);s.step(27,201,107);s.start(202,3,107);
 assert.equal(s.castle.persistent,retained);assert.equal(s.castle.stats.attempts,0);
});
test('failure, timeout, explicit exit stay distinct and ending requires explicit acknowledgement',()=>{
 const failure=make();failure.step(0,1,100);failure.step(0,2,121);
 for(let t=3;failure.active&&t<1000;t++)failure.step(0,t,121);
 assert.equal(failure.screen,'results');assert.equal(failure.castle.flags.failed,true);assert.equal(failure.advance.advanced,false);
 const abort=make();abort.step(27,1,100);abort.step(0,2,100);
 assert.equal(abort.screen,'results');assert.equal(abort.castle.flags.exit,true);assert.equal(abort.advance.advanced,false);
 const s=make(1,45,6);s.step(0,1,100);s.castle.stats.correct=5;s.castle.stats.attempts=5;
 // Source timeout is checked from refreshed score, never set flags directly.
 s.castle.stats.limitSeconds=1;s.step(9,20,101);s.step(0,21,101);
 assert.equal(s.castle.flags.timeout,true);assert.equal(s.castle.flags.failed,false);
 assert.equal(s.castleEnding.event.mode,4);assert.equal(s.screen,'celebration');assert.equal(s.profile.completed[2],0);
 assert.throws(()=>s.acknowledgeCastleEnding(),/Complete/);
 acknowledge(s);assert.equal(s.screen,'results');assert.equal(s.profile.completed[2],1);
 assert.ok(s.profile.goal>=45);assert.equal(s.next(22).mode,3);assert.equal(s.screen,'castle');
});
test('Next and reentry span1/2/3/4 for all characters, source Castle duration field3',()=>{
 for(const char of [1,2,3]) {
  const s=make(char);assert.equal(s.limit,3600);assert.equal(s.profile.durations[2],60);
  s.step(27,1,100);s.step(0,2,100);
  for(const [goal,mode] of [[5,1],[10,2],[30,3],[50,4],[30,3]]) {
   s.student=editStudent(s.student,{goal,character:char});
   if(mode===4)s.start(0,4,100);else {new DataView(s.student.buffer).setInt16(15,1,true);s.next(0);}
   assert.equal(s.mode,mode);assert.equal(s.profile.character,char);assert.equal(s.active,true);
   if(mode===3){s.step(27,1,100);s.step(0,2,100);}else {s.step(27,1,100);s.step(0,2,100);}
   assert.equal(s.screen,'results');
  }
 }
});
