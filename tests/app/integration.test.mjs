import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Session, editStudent, loadProfiles } from '../../app/session.mjs';
import { newStudent } from '../../recovered/control/student.mjs';
import { lessonPrefix, loadCorpus, selectCorpusSegment, initializeBonus, outdoorBonusDelay, seedFromTime, createPractice } from '../../recovered/runtime/runtime.mjs';
import { tick } from '../../recovered/outdoor/outdoor.mjs';
import { Renderer } from '../../app/render.mjs';
import { spriteRect, characterFrame } from '../../recovered/render/render.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../../app/data.json',import.meta.url)));
import {skipStartup} from './source-path.mjs';
const configured=(settings={})=>skipStartup(new Session(data,{bytes:editStudent(newStudent('Ada'),settings),seed:1}));
test('shared RNG consumes prefix, segment, four bonus draws then pre-reset delay, persists across activities',()=>{
 const s=configured({lesson:6}); const rng={seed:s.seed};
 assert.equal(rng.seed,22695478); // source skipped startup0 draws, first menu callback1 draw
 const prefix=lessonPrefix(6,rng), stream=loadCorpus(data.lessons[prefix.toUpperCase()+'LETTERS']);selectCorpusSegment(stream,rng);
 const bonus=initializeBonus(rng), delay=outdoorBonusDelay(rng,0);
 s.start(0);assert.equal(s.seed,rng.seed);assert.equal(s.outdoor.stream.index,stream.index);
 assert.equal(s.bonus.code,bonus.code);assert.equal(s.bonus.countdown,delay);
 assert.equal(s.initialSeed,seedFromTime(1));
 s.step(0,1,100);s.step(27,2,100);const nextSeed=s.seed;
 s.start(3,4);assert.notEqual(s.seed,1);assert.notEqual(s.seed,nextSeed);
 const practiceSeed=s.seed; s.step(27,4,100);s.start(5);
 const expected={seed:practiceSeed};lessonPrefix(6,expected);
 const c=loadCorpus(data.lessons[s.corpusName]);selectCorpusSegment(c,expected);initializeBonus(expected);
 const afterPractice=outdoorBonusDelay(expected,600);
 assert.equal(s.seed,expected.seed);assert.equal(s.bonus.countdown,afterPractice);
});
test('outdoor integration preserves recovered frame order, old-scroll ground and new-target input',()=>{
 const s=configured();s.start(0); const expected=structuredClone(s.outdoor),bonus=structuredClone(s.bonus);
 const schedule=data.idleSchedules.m;
 const events=tick(expected,{key:65,elapsed:0,limit:120,idleSchedule:schedule.thresholds,idlePeriod:schedule.halfTickPeriod,bonus,second:10});
 assert.deepEqual(s.step(65,1,10),events);assert.deepEqual(s.outdoor,expected);assert.deepEqual(s.bonus,bonus);
 assert.equal(s.outdoor.groundPhase,1);assert.equal(s.outdoor.scroll,9);
});
test('retained Outside movement reaches every negative run index through actual Session entries', {timeout:30000},()=>{
 const s=configured(),seen=new Set();let updates=0,first=null;
 // No injected distance, cursor, limit or movement. Let each default two-minute
 // activity finish without input, then enter Outside again with its retained state.
 for(let entry=1;entry<=140&&seen.size<11;entry++) {
  const retained=s.outdoor?.distance??0;
  s.start(updates,1,100+Math.floor(updates/18.2));
  assert.equal(s.outdoor.distance,retained);assert.equal(s.outdoor.x,20);
  for(let n=1;n<=2185&&s.active;n++) {
   updates++;s.step(0,updates,100+Math.floor(updates/18.2));
   const {kind,index}=s.outdoor.frame;
   if(kind==='run'&&index<0) {
    first??={entry,updates,index};seen.add(index);
    const binding=characterFrame(1,kind,index,data.idleSchedules.m.thresholds);
    assert.equal(binding.name,`mjmp${String(index+21).padStart(4,'0')}_1`);
    assert.ok(data.sprites[`${binding.family}/${binding.name}`]);
   }
  }
  assert.equal(s.screen,'results');
 }
 assert.deepEqual(first,{entry:129,updates:279625,index:-1});
 assert.deepEqual([...seen].sort((a,b)=>a-b),[-11,-10,-9,-8,-7,-6,-5,-4,-3,-2,-1]);
 assert.ok(updates<=140*2185);
});
test('bonus raw punctuation intercept stops timer, ignores keys, uses two ticks per frame and resumes without scoring',()=>{
 const s=configured();s.start(0);
 for(let n=1;n<=20&&s.bonus.mode!==2;n++)s.step(0,n,100+n);
 assert.equal(s.bonus.mode,2);
 const attempts=s.outdoor.attempts; s.step(s.bonus.code,21,120);
 assert.ok(s.cinematic);assert.equal(s.clock.running,false);assert.equal(s.outdoor.attempts,attempts);
 const stopped=s.clock.ticks, before=structuredClone(s.outdoor);
 s.step(65,22,121);assert.equal(s.cinematic.frame,0);assert.deepEqual(s.outdoor,before);
 s.suspend(true,22);s.step(27,200,130);s.suspend(false,200);
 assert.equal(s.cinematic.frame,0);s.step(65,201,131);assert.equal(s.cinematic.frame,1);
 let t=203;while(s.cinematic){s.step(65,t,132);t+=2;}
 assert.equal(s.clock.ticks,stopped);assert.equal(s.clock.running,true);assert.equal(s.outdoor.attempts,attempts);
 s.step(0,t,133);assert.equal(s.clock.ticks,stopped+2);assert.equal(s.bonus.mode,0);
});
test('practice selects original goal corpus and exact nine rows without generic wrapping',()=>{
 for(const [goal,kind] of [[5,'LETTERS'],[10,'WORDS'],[30,'SENTENC']]){
  const s=configured({goal}),rng={seed:s.seed};s.start(0,4);assert.equal(s.corpusName,'H'+kind);assert.equal(s.limit,600);
  const stream=loadCorpus(data.lessons['H'+kind]);selectCorpusSegment(stream,rng);
  const expected=createPractice(stream);assert.deepEqual(s.practice.rows,expected.rows);assert.equal(s.practice.stream.index,expected.stream.index);
 }
});
test('practice preserves case, ignored keys, line-end SPACE/CR, counters and last-correct wall clock',()=>{
 const s=configured({goal:10});s.start(0,4);
 assert.equal(s.expression(100),0);
 const target=s.practice.rows[33]; assert.ok(target>=97&&target<=122);
 s.step(target-32,1,100);assert.equal(s.practice.errors,1);assert.equal(s.practice.index,0);assert.equal(s.practice.lastCorrect,0);assert.equal(s.profile.errorCounts[target-32],1);
 for(const key of [9,8,10,0x144,0x12d])s.step(key,2,100);
 assert.equal(s.practice.attempts,1);
 s.step(target,3,100);assert.equal(s.practice.correct,1);assert.equal(s.practice.index,1);assert.equal(s.practice.lastCorrect,100);
 assert.equal(s.expression(116),0);
 let t=4;
 for(const ending of [32,13]){
  while(s.practice.rows[33+s.practice.index])s.step(s.practice.rows[33+s.practice.index],t++,101);
  const next=Array.from(s.practice.rows.subarray(66,99));
  s.step(ending,t++,101);assert.equal(s.practice.index,0);assert.equal(s.typed,'');assert.deepEqual(Array.from(s.practice.rows.subarray(33,66)),next);
 }
 assert.equal(s.practice.errors,1);assert.equal(s.practice.correct,s.practice.attempts-1);assert.ok(s.practice.rows.subarray(0,33).every(n=>n===0));
 s.step(27,t++,101);s.start(t,4);assert.ok(s.profile.errorCounts.every(n=>n===0));
});
for(const nowTicks of [1091,1092,1200])for(const kind of ['correct','incorrect','SPACE','CR']) {
 test(`practice ${kind} input is consumed once on tick ${nowTicks}, before timeout results`,()=>{
  const s=configured({goal:10,practiceMinutes:1});s.start(0,4,100);
  if(kind==='SPACE'||kind==='CR') {
   while(s.practice.rows[33+s.practice.index])s.step(s.practice.rows[33+s.practice.index],1,101);
  } else s.step(s.practice.rows[33],1,101);
  const before=structuredClone(s.practice),typed=s.typed,profile=s.profile;
  const expected=before.rows[33+before.index],wrong=kind==='incorrect';
  const key=kind==='SPACE'?32:kind==='CR'?13:wrong?expected-32:expected;
  const audioStart=s.audioLog.length;
  const events=s.step(key,nowTicks,200),expired=nowTicks>=1092;
  assert.deepEqual(events,[{type:expired?'end':wrong?'retain-target':kind==='correct'?'advance-one-byte':'next-line'}]);
  assert.equal(s.practice.attempts,before.attempts+1);
  assert.equal(s.practice.correct,before.correct+Number(!wrong));
  assert.equal(s.practice.errors,before.errors+Number(wrong));
  assert.equal(s.practice.lastCorrect,wrong?101:200);assert.equal(s.lastPracticeCorrect,s.practice.lastCorrect);
  assert.equal(s.practice.index,wrong?before.index:kind==='correct'?before.index+1:0);
  assert.equal(s.typed,wrong?typed:kind==='correct'?typed+String.fromCharCode(key):'');
  if(kind==='SPACE'||kind==='CR')assert.deepEqual(s.practice.rows.slice(33,297),before.rows.slice(66,330));
  else assert.deepEqual(s.practice.rows,before.rows);
  assert.equal(s.profile.errorCounts.reduce((sum,n)=>sum+n,0),Number(wrong));
  if(wrong)assert.equal(s.profile.errorCounts[expected-32],1);
  assert.deepEqual(s.audioLog.slice(audioStart).filter(e=>e.request.type==='effect').map(e=>e.request.id),[wrong?11:1]);
  assert.equal(s.screen,expired?'results':'practice');assert.equal(s.clock.running,!expired);assert.equal(s.clock.ticks,nowTicks);
  assert.equal(s.practice.aborted,false);
  if(expired) {
   assert.equal(s.result.elapsedSeconds,60);
   assert.equal(s.result.accuracy,Math.trunc(s.practice.correct*100/s.practice.attempts));
   assert.equal(s.result.wpm,Math.trunc(Math.max(0,s.practice.correct-s.practice.errors)*182/nowTicks));
   assert.equal(s.profile.lastWpm,s.result.wpm);assert.equal(s.profile.accuracy,s.result.accuracy);
   assert.equal(s.advance.advanced,false);
   assert.deepEqual([s.profile.lesson,s.profile.goal,s.profile.completed],[profile.lesson,profile.goal,profile.completed]);
   const finished=structuredClone({practice:s.practice,typed:s.typed,result:s.result,student:s.student,audio:s.audioLog});
   assert.deepEqual(s.step(key,nowTicks+1,201),[]);
   assert.deepEqual({practice:s.practice,typed:s.typed,result:s.result,student:s.student,audio:s.audioLog},finished);
  }
 });
}
for(const nowTicks of [1091,1092])for(const key of [0,10,0x144,0x12d,27]) {
 test(`practice non-scoring key ${key} preserves timeout and Escape priority at tick ${nowTicks}`,()=>{
  const s=configured({practiceMinutes:1});s.start(0,4,100);
  const before=structuredClone(s.practice),audioStart=s.audioLog.length;
  const ended=nowTicks>=1092||key===27;
  assert.deepEqual(s.step(key,nowTicks,200),[{type:ended?'end':'ignored'}]);
  assert.deepEqual(s.practice,{...before,aborted:key===27});
  assert.equal(s.screen,ended?'results':'practice');assert.equal(s.clock.running,!ended);
  assert.equal(s.audioLog.slice(audioStart).filter(e=>e.request.type==='effect').length,0);
 });
}
for(const kind of ['synthetic','physical-correct','physical-incorrect','Escape']) {
 test(`Demo Practice expiry dispatches ${kind} once and restores the selected record/menu`,()=>{
  const s=configured({goal:10,practiceMinutes:1});s.selectDemo();
  const selected=s.student.slice();selected[27]=0;new DataView(selected.buffer).setInt16(15,4,true);
  s.start(0,4,100);
  const demo=s.demo,entries=s.menuEntries,target=s.practice.rows[33];
  const synthetic=kind==='synthetic',escape=kind==='Escape',wrong=kind==='physical-incorrect';
  // FILE 0xb6af..0xb710: a due synthetic key wins even over queued Escape.
  if(synthetic)demo.state.countdown=1;
  const key=synthetic||escape?27:wrong?target-32:target;
  const audioStart=s.audioLog.length;
  assert.deepEqual(s.step(key,1092,200),[{type:'end'}]);
  assert.equal(s.practice.attempts,Number(!escape),'one final Demo dispatch before expiry');
  assert.equal(s.practice.correct,Number(!escape&&!wrong));assert.equal(s.practice.errors,Number(wrong));
  assert.equal(s.practice.index,Number(!escape&&!wrong));
  assert.equal(s.typed,escape||wrong?'':String.fromCharCode(target));
  assert.equal(s.practice.lastCorrect,escape||wrong?0:200);assert.equal(s.lastPracticeCorrect,s.practice.lastCorrect);
  assert.equal(s.practice.aborted,escape);
  assert.equal(demo.state.lastLowTick,1092);assert.equal(demo.state.done,true);
  assert.deepEqual(s.student,selected);assert.equal(s.demo,null);assert.equal(s.input.pending(),false);
  assert.equal(s.screen,'menu');assert.equal(s.menuEntries,entries+1);assert.equal(s.clock.running,false);
  assert.equal(s.practiceDemoTick,1092);assert.deepEqual(s.resultEffects,[{type:'host-clock-reset'}]);
  assert.deepEqual(s.audioLog.slice(audioStart).map(e=>[e.request.type,e.request.id]),[
   ...escape?[]:[['effect',wrong?11:1]],['music-stop',undefined],['music',2]
  ]);
  const finished=structuredClone({practice:s.practice,typed:s.typed,student:s.student,audio:s.audioLog});
  assert.deepEqual(s.step(key,1093,201),[]);
  assert.deepEqual({practice:s.practice,typed:s.typed,student:s.student,audio:s.audioLog},finished);
 });
}
test('practice duration, focus suspension, no failure, early results and Next retain mode/lesson and timestamp',()=>{
 const s=configured({practiceMinutes:1});s.start(100,4);s.step(0,110,100);s.suspend(true,111);
 const rows=s.practice.rows.slice();s.step(65,500,200);assert.deepEqual(s.practice.rows,rows);assert.equal(s.clock.ticks,11);
 s.suspend(false,500);s.step(0,1581,300);assert.equal(s.screen,'results');assert.equal(s.result.elapsedSeconds,60);assert.equal(s.advance.advanced,false);assert.equal(s.practice.aborted,false);
 assert.deepEqual(s.next(1600),{mode:4,lesson:1});assert.equal(s.screen,'practice');
 s.step(s.practice.rows[33],1601,301);s.step(27,1602,301);assert.equal(s.practice.aborted,true);assert.equal(s.advance.advanced,false);
 s.next(1603);assert.equal(s.practice.lastCorrect,301);assert.equal(s.profile.lesson,1);
});
test('guest is never persisted; storage corruption/unavailability is reported, not silently reset',()=>{
 const s=skipStartup(new Session(data,{seed:1}));s.start(0,4);s.step(27,1,100);let saved=false;
 s.save({setItem(){saved=true;}},{students:{}});assert.equal(saved,false);
 assert.throws(()=>loadProfiles({getItem(){throw new Error('blocked');}}),/blocked/);
 assert.throws(()=>loadProfiles({getItem:()=>'{bad'}));
 assert.throws(()=>loadProfiles({getItem:()=>'{"students":[]}'}),/Invalid/);
});
test('renderer uses exact indexed palettes, origin, masks, ground, idle and decoded ANI at the app boundary',async()=>{
 const canvas={getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(64000*4)}),putImageData(){}})};
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async path=>({ok:true,arrayBuffer:async()=>{
  const file=fs.readFileSync(new URL('../../'+path.slice(2),import.meta.url));return file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
 }});
 try {
  const r=new Renderer(canvas,data);await r.load();
  const s=configured();s.start(0);r.outdoor(s.outdoor,s.stats(),s.bonus);
  const manifest=JSON.parse(fs.readFileSync(new URL('../../assets/render/manifest.json',import.meta.url)));
  assert.deepEqual(data.palettes['outdoor-m'],manifest.palettes.m.rgb8.flat());
  const idle=data.sprites['IDLE/mstd0001_1'];assert.deepEqual(spriteRect(idle,20,90),{left:23,top:98,right:47,bottom:139});
  const pixel=r.pixels['IDLE/mstd0001_1'].findIndex(v=>v!==0),x=pixel%idle.width,y=Math.floor(pixel/idle.width);
  assert.equal(r.front[(98+y)*320+23+x],r.pixels['IDLE/mstd0001_1'][pixel]);
  assert.equal(r.front[140*320+21],r.ground[1]);
  // FILE0x1413d..0x14259: brick glyph at +6,+3, FONT7H slot(code-32), map0/15/31.
  s.outdoor.obstacles[0]={active:true,type:1,x:200,y:90,code:65};
  r.outdoor(s.outdoor,s.stats(),s.bonus);
  const glyph=data.sprites['FONT7H/font7_65'], mask=r.pixels['FONT7H/font7_65'];
  assert.equal(glyph.index,65-32);
  const rect=spriteRect(glyph,206,93);
  mask.forEach((v,i)=>{if(v)assert.equal(r.front[(rect.top+Math.floor(i/glyph.width))*320+rect.left+i%glyph.width],v===1?15:31);});
  for(const char of [1,2,3]){s.student=editStudent(s.student,{character:char});s.start(0);r.outdoor(s.outdoor,s.stats(),s.bonus);r.cinematic(char,0);r.cinematic(char,data.bonusAnimations[['m','l','p'][char-1]].frames.length-1);}
  s.start(0,4);r.practice(s.practice,s.stats(),0,'');
  // Nonzero font-mask pixels must be able to write palette index zero (black).
  assert.ok(r.front.subarray(106*320+30,114*320).some(v=>v===0));
  assert.throws(()=>r.sprite('missing',0,0),/Missing sprite/);
 } finally {globalThis.fetch=oldFetch;}
});
