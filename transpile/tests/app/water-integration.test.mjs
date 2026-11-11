import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Session,editStudent} from '../../app/session.mjs';
import {Renderer} from '../../app/render.mjs';
import {newStudent} from '../../recovered/control/student.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../../app/data.json',import.meta.url)));
function make(character=1,goal=10,lesson=1) {
 const s=new Session(data,{bytes:editStudent(newStudent('Water'),{character,goal,lesson,waterMinutes:1}),seed:1});
 s.start(0,2,100);return s;
}
function end(s,t=10,key=27) {s.step(key,t,100);s.step(0,t+1,100);assert.equal(s.screen,'results');}

test('host drains pending input before movement, preserves six-key redraw and low-word waits',()=>{
 const s=make();s.takeEffects();
 const keys=Array.from(s.water.window.slice(10,18));keys.forEach(k=>s.enqueue(k));
 const effects=s.step(0,0,100);
 assert.equal(s.water.stats.correct,8);assert.equal(effects.filter(e=>e.type==='swimmer').length,1);
 assert.equal(effects.filter(e=>e.type==='text').length,2); // sixth deferred and last nonpending
 assert.equal(s.water.redrawCount,0);assert.equal(s.water.phase,'wait');
 const seed=s.seed,counter=s.water.swimmer.counter;
 s.step(0,65536,100);assert.equal(s.seed,seed);assert.equal(s.water.swimmer.counter,counter);
 s.step(0,65537,100);assert.equal(s.water.swimmer.counter,counter+1);
 s.step(0,70000,100);assert.equal(s.water.swimmer.counter,counter+2); // no catchup
});
test('host accepts exact case, counts wrong expected key, resets inactivity for ignored input',()=>{
 const s=make();const code=s.water.window[10];
 s.step(code^32,0,100);assert.equal(s.water.stats.errors,1);assert.equal(s.profile.errorCounts[code-32],1);
 s.step(code,1,119);assert.equal(s.water.stats.correct,1);
 s.step(9,2,139);assert.equal(s.water.failed,false);assert.equal(s.water.lastInput,139);
 s.step(0,3,159);assert.equal(s.water.failed,false);
 s.step(0,4,160);assert.equal(s.water.failed,true); // >20, before a late key
 for(let t=5;t<400&&s.active;t++)s.step(0,t,160);
 assert.equal(s.screen,'results');assert.equal(s.water.sunk,true);assert.equal(s.advance.advanced,false);
 assert.equal(s.profile.lesson,1);s.next(500);assert.equal(s.screen,'water');
});
test('all characters reenter with retained Water words across Practice, shared RNG and duration field2',()=>{
 for(const char of [1,2,3]) {
  const s=make(char);assert.equal(s.limit,60);assert.equal(s.water.character,char-1);
  s.step(s.water.window[10],1,100);end(s);
  const old=s.water, seed=s.seed;s.start(20,4,100);s.step(27,21,100);s.start(30,2,100);
  assert.notEqual(s.water,old);assert.notEqual(s.seed,seed);assert.equal(s.water.swimmer.counter,old.swimmer.counter);
  assert.equal(s.water.pursuer.frame,old.pursuer.frame);assert.equal(s.water.failurePhase,old.failurePhase);
  assert.equal(s.water.swimmer.x,20);assert.equal(s.water.stats.attempts,0);
  end(s,31,0x144);assert.equal(s.water.aborted,true);
 }
});
test('bonus uses two distinct changed ticks per packet, flushes input and excludes stopped time',()=>{
 const s=make();s.water.bonus.mode=2;s.water.bonus.x=50;s.water.bonus.y=120;
 s.step(s.water.bonus.code,10,100);assert.equal(s.water.phase,'bonus');assert.equal(s.waterMovie.frame,0);
 const ticks=s.clock.ticks, attempts=s.water.stats.attempts;
 s.enqueue(65);s.step(0,10,101);assert.equal(s.waterMovie.frame,0);
 s.step(0,11,101);assert.equal(s.waterMovie.frame,1);assert.equal(s.clock.ticks,ticks);
 for(let t=12;t<=121;t++)s.step(0,t,106);
 assert.equal(s.waterMovie,null);assert.equal(s.water.phase,'wait');assert.equal(s.water.stats.attempts,attempts);
 assert.equal(s.input.pending(),false);assert.equal(s.clock.ticks,ticks);
 s.step(0,122,106);assert.equal(s.clock.ticks,ticks+1);
});
test('host preserves pending abort tail and bonus-during-failure timer semantics',()=>{
 const aborted=make();aborted.enqueue(27);aborted.enqueue(aborted.water.window[10]);
 const events=aborted.step(0,0,100);
 assert.equal(aborted.screen,'results');assert.equal(aborted.water.stats.attempts,0);
 assert.equal(events.some(e=>e.type==='swimmer'),false);assert.equal(aborted.input.pending(),true);
 aborted.next(1);assert.equal(aborted.input.pending(),false);
 const s=make();s.water.bonus.mode=2;s.water.bonus.code=33;
 s.step(33,1,121);assert.equal(s.water.failed,true);assert.equal(s.water.phase,'bonus');
 for(let t=2;t<=113;t++)s.step(0,t,127);
 assert.equal(s.waterMovie,null);assert.equal(s.clock.running,true);
 for(let t=114;t<400&&s.active;t++)s.step(0,t,127);
 assert.equal(s.screen,'results');assert.equal(s.water.sunk,true);
 assert.equal(s.clock.running,true); // source failure-exit is empty, not normal stop
 assert.equal(s.advance.advanced,false);
});
test('cached timeout and final wait precede results; celebration omission does not suppress strict >30 progression',()=>{
 for(const [correct,completed] of [[150,0],[156,1]]) {
  const s=make(1,25,6);s.water.stats.correct=correct;s.water.stats.attempts=correct;
  s.water.lastInput=160;s.step(0,1092,160); // refresh crosses limit, next loop observes it
  assert.equal(s.water.timedOut,true);assert.equal(s.screen,'water');
  s.step(0,1093,160);assert.equal(s.screen,'results');assert.equal(s.advance.advanced,true);
  assert.equal(s.profile.goal,30);assert.equal(s.profile.completed[1],completed);
  assert.equal(s.result.elapsedSeconds,60);assert.equal(s.clock.ticks,1093);
  assert.equal(s.next(1200).mode,3);assert.equal(s.screen,'castle'); // Water progression now routes into Castle
 }
});
test('real Renderer consumes draw-time snapshots, source waves, prompt, bonus pixels and restoration',async()=>{
 const context={createImageData:()=>({data:new Uint8ClampedArray(256000)}),putImageData(){}};
 const renderer=new Renderer({getContext:()=>context},data);
 assert.equal(renderer.waveCounter,-1);
 const fetchBefore=globalThis.fetch;
 globalThis.fetch=async path=>({ok:true,arrayBuffer:async()=>{
  const b=fs.readFileSync(new URL('../../'+path.replace(/^\.\//,''),import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
 }});
 try {await renderer.load();} finally {globalThis.fetch=fetchBefore;}
 const exe=fs.readFileSync(new URL('../../assets/original/raw/MarioTea/MARIO/MARIO.EXE.data',import.meta.url));
 for(const char of [1,2,3]) {
  const retainedWave=renderer.waveCounter;
  const s=make(char);renderer.water(s.takeEffects(),s.water);
  assert.equal(renderer.waveCounter,retainedWave);
  const scene=renderer.backgrounds.WATER;assert.notDeepEqual(renderer.front.slice(47*320,60*320),scene.slice(47*320,60*320));
  s.step(0,0,100);renderer.water(s.takeEffects(),s.water);
  for(let y=0;y<14;y++)for(let x=0;x<320;x++) {
   const tile=(Math.floor(renderer.waveCounter/2)+Math.floor(x/16))%25;
   const value=exe[0x1f6c6+tile*228+y*16+x%16];
   assert.equal(renderer.front[(65+y)*320+x],value||scene[(65+y)*320+x]);
  }
  // Deliberately drive phase1 -> phase2 in one loop: swimmer must use swim art
  // even though final controller phase is2; next loop uses sunk art.
  s.water.failed=true;s.water.failurePhase=1;s.water.savedY=112;s.water.pursuer.drawnX=s.water.swimmer.x;
  s.step(0,1,100);const effects=s.takeEffects();renderer.water(effects,s.water);
  assert.equal(renderer.waterDraw.swimmer.failurePhase,1);assert.equal(s.water.failurePhase,2);
  s.step(0,2,100);renderer.water(s.takeEffects(),s.water);assert.equal(renderer.waterDraw.swimmer.failurePhase,2);
  s.water.bonus.mode=2;s.water.bonus.x=50;s.water.bonus.y=120;
  s.step(s.water.bonus.code,3,100);renderer.water(s.takeEffects(),s.water);
  assert.equal(s.water.phase,'bonus');
  for(let t=4;t<116;t++){s.step(0,t,106);renderer.water(s.takeEffects(),s.water);}
  assert.equal(s.waterMovie,null);assert.deepEqual(renderer.movieBackground,scene);
  assert.equal(renderer.palette,'water-'+['m','l','p'][char-1]);
 }
});
