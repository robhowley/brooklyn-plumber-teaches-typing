import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Session, editStudent, loadProfiles } from '../../app/session.mjs';
import { newStudent } from '../../recovered/control/student.mjs';
import { lessonPrefix, loadCorpus, selectCorpusSegment, initializeBonus, outdoorBonusDelay, seedFromTime, createPractice } from '../../recovered/runtime/runtime.mjs';
import { tick, createOutdoor, makeObstacle, selectTarget, acceptKey, updateObstacles, updatePlayer } from '../../recovered/outdoor/outdoor.mjs';
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
test('Practice cursor shares the low-word wait sample, exact 4/2 phases, duplicates, gaps and rollover',()=>{
 const s=configured();s.rebaseHostClock(0,65535);s.start(65535,4,100);
 for(const [tick,inverted,left] of [
  [65535,false,0],[65536,true,4],[65536,true,4],
  [65537,true,3],[65600,true,2],[65601,true,1],[65602,false,2],
  [65602,false,2],[65603,false,1],[65604,true,4]
 ]) {
  s.step(0,tick,100);
  assert.deepEqual(s.practice.cursor,{tick:tick&65535,inverted,left});
  assert.equal(s.lastWaitTick,tick&65535);
  assert.equal(s.changedTick(tick),false,'Practice consumed the shared observation');
 }
 // A new activity inherits the shared sample, not its own clock origin.
 s.start(65604,4,100);s.step(0,65604,100);
 assert.deepEqual(s.practice.cursor,{tick:68,inverted:false,left:0});
 s.rebaseHostClock(65604,131140);s.start(131140,4,100);s.step(0,131140,100);
 assert.deepEqual(s.practice.cursor,{tick:68,inverted:false,left:0},'high word alone is not a change');
 s.step(0,131141,100);assert.equal(s.practice.cursor.inverted,true);
});
for(const kind of ['correct','wrong','Tab','Backspace','LF','F10','Alt-X','Escape','timeout']) {
 test(`Practice cursor resets before ${kind} dispatch without sampling another wait`,()=>{
  const s=configured({goal:10,practiceMinutes:1});s.start(0,4,100);s.step(0,1,100);
  assert.equal(s.practice.cursor.inverted,true);
  const target=s.practice.rows[33],tick=kind==='timeout'?1092:2;
  const key={correct:target,wrong:target-32,Tab:9,Backspace:8,LF:10,F10:0x144,'Alt-X':0x12d,Escape:27,timeout:0}[kind];
  s.step(key,tick,101);
  assert.deepEqual(s.practice.cursor,{tick:1,left:0,inverted:false});
  assert.equal(s.lastWaitTick,1,'callback termination must precede the tick wait');
  if(s.active) {
   s.step(0,tick,101);
   assert.deepEqual(s.practice.cursor,{tick,left:4,inverted:true},'next wait sees the outstanding change once');
   s.step(0,tick,101);assert.equal(s.practice.cursor.left,4);
  } else assert.equal(s.changedTick(tick),true);
 });
}
test('Demo Practice cursor waits only when neither synthetic nor physical input is ready',()=>{
 const s=configured({goal:10});s.selectDemo();s.start(0,4,100);
 s.step(0,1,100);assert.deepEqual(s.practice.cursor,{tick:1,left:4,inverted:true});
 assert.equal(s.demo.state.countdown,29);
 s.step(0,1,100);assert.equal(s.practice.cursor.left,4);assert.equal(s.demo.state.countdown,29);
 s.demo.state.countdown=1;s.step(27,2,100); // due synthetic target wins over Escape
 assert.equal(s.practice.correct,1);assert.equal(s.practice.aborted,false);
 assert.deepEqual(s.practice.cursor,{tick:1,left:0,inverted:false});assert.equal(s.lastWaitTick,1);
 s.demo.state.countdown=20;s.step(0x144,2,100); // queued physical Escape, left by synthetic input
 assert.equal(s.screen,'menu');assert.equal(s.practice.aborted,true);
 assert.deepEqual(s.practice.cursor,{tick:1,left:0,inverted:false});assert.equal(s.lastWaitTick,1);
});
test('Practice focus suspension and host rebase freeze cursor countdown without catching up',()=>{
 const s=configured();s.start(0,4,100);s.step(0,1,100);s.step(0,2,100);
 s.suspend(true,3);const cursor=structuredClone(s.practice.cursor);
 s.step(s.practice.rows[33],900,200);assert.deepEqual(s.practice.cursor,cursor);assert.equal(s.practice.attempts,0);
 s.suspend(false,900);s.step(0,900,200);
 assert.deepEqual(s.practice.cursor,{tick:900,left:3,inverted:true});
 s.step(0,901,200);assert.equal(s.practice.cursor.left,2);
 s.rebaseHostClock(901,0);s.step(0,0,200);assert.equal(s.practice.cursor.left,2);
 s.step(0,1,200);assert.equal(s.practice.cursor.left,1);
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
  const cursor=key===0&&!ended?{tick:nowTicks,left:4,inverted:true}:before.cursor;
  assert.deepEqual(s.practice,{...before,aborted:key===27,cursor});
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
  s.outdoor.obstacles[0]={...makeObstacle(65,0),x:200,y:90};
  r.outdoor(s.outdoor,s.stats(),s.bonus);
  const glyph=data.sprites['FONT7H/font7_65'], mask=r.pixels['FONT7H/font7_65'];
  assert.equal(glyph.index,65-32);
  const rect=spriteRect(glyph,206,93);
  mask.forEach((v,i)=>{if(v)assert.equal(r.front[(rect.top+Math.floor(i/glyph.width))*320+rect.left+i%glyph.width],v===1?15:31);});
  for(const char of [1,2,3]){s.student=editStudent(s.student,{character:char});s.start(0);r.outdoor(s.outdoor,s.stats(),s.bonus);r.cinematic(char,0);r.cinematic(char,data.bonusAnimations[['m','l','p'][char-1]].frames.length-1);}
  s.start(0,4);r.practice(s.practice,s.stats(),0,'');
  // Nonzero font-mask pixels must be able to write palette index zero (black).
  assert.ok(r.front.subarray(106*320+30,114*320).some(v=>v===0));
  // Space resource0 is the recovered opaque cursor cell, not a one-row caret.
  const space=data.sprites['FONT5H/font5_32'];
  assert.equal(space.member,'MarioTea/MARIO/FONT5H.GSO');
  assert.equal(space.memberSha256,'aa9b883273bf0997b4e128c4a72eb7028c534656d1c284948cf51cae74968464');
  assert.deepEqual([space.index,space.offset,space.width,space.height],[0,34,8,8]);
  assert.ok(r.pixels['FONT5H/font5_32'].every(v=>v===0));
  const cell=(index,color)=>{
   const x=30+8*index;
   for(let y=96;y<104;y++)for(let dx=0;dx<8;dx++)assert.equal(r.front[y*320+x+dx],color,`cursor ${index}: ${dx},${y}`);
  };
  cell(0,1);s.step(0,1,100);r.practice(s.practice,s.stats(),0,s.typed);cell(0,15);
  const first=s.practice.rows[33];s.step(first,2,100);r.practice(s.practice,s.stats(),0,s.typed);cell(1,1);
  const typedGlyph=data.sprites[`FONT5H/font5_${first}`],mask5=r.pixels[`FONT5H/font5_${first}`];
  // Full redraw removes every old cursor pixel while preserving the existing typed glyph.
  mask5.forEach((v,i)=>assert.equal(r.front[(96+Math.floor(i/typedGlyph.width))*320+30+i%typedGlyph.width],v?1:r.backgrounds.PRACTICE[(96+Math.floor(i/typedGlyph.width))*320+30+i%typedGlyph.width]));
  s.practice.rows.fill(65,33,65);s.practice.rows[65]=0;s.practice.index=0;s.typed='';
  for(let n=0;n<31;n++)s.step(65,2,100);
  r.practice(s.practice,s.stats(),0,s.typed);cell(31,1);
  s.step(0,2,100);r.practice(s.practice,s.stats(),0,s.typed);cell(31,15);
  s.step(65,3,100);assert.equal(s.practice.index,32);r.practice(s.practice,s.stats(),0,s.typed);cell(32,1);
  s.step(0,3,100);r.practice(s.practice,s.stats(),0,s.typed);cell(32,15);
  s.step(13,4,100);assert.equal(s.practice.index,0);r.practice(s.practice,s.stats(),0,s.typed);cell(0,1);
  for(let y=96;y<104;y++)for(let x=278;x<294;x++)assert.equal(r.front[y*320+x],r.backgrounds.PRACTICE[y*320+x],'line transition clears columns31/32');
  assert.throws(()=>r.sprite('missing',0,0),/Missing sprite/);
 } finally {globalThis.fetch=oldFetch;}
});

// Source identities and decoded resource indices are checked in the generated
// assets/render/manifest.json and analysis/outdoor/{evidence,tables}.json.
// These compare translation pixels, not the appearance of original hardware.
test('Outside imagery matches decoded glyphs and actors through their source lifetimes', async t => {
 const canvas={getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(64000*4)}),putImageData(){}})};
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async path=>({ok:true,arrayBuffer:async()=>{
  const file=fs.readFileSync(new URL('../../'+path.slice(2),import.meta.url));return file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
 }});
 try {
  const r=new Renderer(canvas,data);await r.load();
  const glyph=data.sprites['FONT7H/font7_65'];
  assert.equal(glyph.member,'MarioTea/MARIO/FONT7H.GSO');
  assert.equal(glyph.memberSha256,'b2287d630e98c5fa4547eeac92355715be660ab5a06281d343eb0a95ce668918');
  assert.equal(glyph.indexSha256,'d011ba960556d56b29644a4cda97496513f5a4306e1fa105b94e552c5854bd6d');
  assert.equal(glyph.index,33);assert.equal(glyph.offset,0xe50);
  assert.equal(createHash('sha256').update(r.pixels['FONT7H/font7_65']).digest('hex'),'984502ef4a8ab7a561858d430587f1c8af93bac11874300fae31e38776b46454');
  const fresh=character=>createOutdoor({bytes:Buffer.from('AB'),seed:1,character});
  await t.test('stationary prompt uses pre-input code, foreground15/shadow0 and background for zero samples',()=>{
   const s=fresh(1), schedule=data.idleSchedules.m;
   s.obstacles[0]=makeObstacle(65,0);
   const check=code=>{
    r.outdoor(s,{},null);
    const glyph=data.sprites[`FONT7H/font7_${code}`],raw=r.pixels[`FONT7H/font7_${code}`];
    raw.forEach((v,i)=>{
     const p=(155+Math.floor(i/glyph.width))*320+175+i%glyph.width;
     assert.equal(r.front[p],v===1?15:v===2?0:r.backgrounds.OUTSIDE[p],`prompt code${code} sample${i}`);
    });
   };
   tick(s,{key:65,idleSchedule:schedule.thresholds,idlePeriod:schedule.halfTickPeriod});
   assert.equal(s.obstacles[0].code,0);check(65);
   tick(s,{idleSchedule:schedule.thresholds,idlePeriod:schedule.halfTickPeriod});check(32);
   // Change glyph before clearing again; no old samples may survive.
   s.promptCode=66;check(66);s.promptCode=32;check(32);
  });
  await t.test('brick remains stamped through five updates, turtle hit then unlabeled shell',()=>{
   for(const character of [1,2,3])for(const draw of [0,32767]) {
    const s=fresh(character),o={...makeObstacle(65,draw),x:200};s.obstacles[0]=o;s.scroll=0;
    selectTarget(s);acceptKey(s,65);
    for(let n=0;n<=6;n++) {
     r.outdoor(s,{},null);
     assert.equal(o.active,n<6);
     if(n<6) {
      const block=o.type===1,x=o.x+(block?(character===3?36:0):30),y=o.y+(block&&character===3?30:0);
      const name=`OUTSIDE/${block?'brick1_1':n?'turt1_2':'turt1_1'}`;
      const sprite=data.sprites[name],raw=r.pixels[name];
      const expected=Uint8Array.from(raw);
      if(block||n===0) {
       const glyph=data.sprites['FONT7H/font7_65'],mask=r.pixels['FONT7H/font7_65'];
       mask.forEach((v,i)=>{if(v)expected[(3+Math.floor(i/glyph.width))*sprite.width+(block?6:15)+i%glyph.width]=v===1?15:31;});
      }
      expected.forEach((v,i)=>{if(v)assert.equal(r.front[(y+Math.floor(i/sprite.width))*320+x+i%sprite.width],v,`char${character} type${o.type} update${n} sample${i}`);});
     }
     if(n===6) {
      // At destruction only decoded debris (brick) or the background (turtle)
      // remains at the old image. Check zeros too, not just visible samples.
      const expected=r.backgrounds.OUTSIDE.slice();
      for(const p of s.particles) {
       const sprite=data.sprites['OUTSIDE/expls1_1'],raw=r.pixels['OUTSIDE/expls1_1'],rect=spriteRect(sprite,p.x,p.y);
       raw.forEach((v,i)=>{if(v)expected[(rect.top+Math.floor(i/sprite.width))*320+rect.left+i%sprite.width]=v;});
      }
      const block=o.type===1,x=200+(block?(character===3?36:0):30),y=o.y+(block&&character===3?30:0);
      for(let dy=0;dy<(block?16:17);dy++)for(let dx=0;dx<(block?20:30);dx++) {
       const p=(y+dy)*320+x+dx;assert.equal(r.front[p],expected[p],`destroyed char${character} type${o.type} sample${dx},${dy}`);
      }
     } else updateObstacles(s);
    }
   }
  });
  await t.test('all characters restore initial and later idle images and preserve terminal jump',()=>{
   for(const character of [1,2,3]) {
    const prefix=['m','l','p'][character-1],schedule=data.idleSchedules[prefix];let s=fresh(character);
    const check=(kind,index)=>{
     assert.deepEqual(s.frame,{kind,index});r.outdoor(s,{},null);
     const binding=characterFrame(character,kind,index,schedule.thresholds),name=binding.family+'/'+binding.name;
     const sprite=data.sprites[name],raw=r.pixels[name],rect=spriteRect(sprite,s.x,s.y);
     raw.forEach((v,i)=>{if(v)assert.equal(r.front[(rect.top+Math.floor(i/sprite.width))*320+rect.left+i%sprite.width],v);});
    };
    const abort=index=>{
     s.mode=1;s.jumpIndex=0;updatePlayer(s,schedule.thresholds,schedule.halfTickPeriod);s.mode=2;
     for(let n=1;n<12;n++){updatePlayer(s,schedule.thresholds,schedule.halfTickPeriod);check(n===11?'jump':'idle',n===11?11:index);}
    };
    abort(0);
    s.mode=0;s.cursorX=-1;s.stillTicks=10;s.idleTicks=schedule.thresholds[2]*2;
    updatePlayer(s,schedule.thresholds,schedule.halfTickPeriod);const later=s.frame.index;assert.ok(later>0);abort(later);
    s=createOutdoor({bytes:Buffer.from('A'),seed:1,character,previous:s});abort(0);
   }
  });
 } finally {globalThis.fetch=oldFetch;}
});
