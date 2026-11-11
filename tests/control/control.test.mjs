import test from 'node:test';
import assert from 'node:assert/strict';
import { score, timer } from '../../recovered/control/scoring.mjs';
import { nextRoute, progression, canSelectMode, queueCertificates, corpusRoute, mainMenuHit, mainMenuCommand, menuNavigation } from '../../recovered/control/flow.mjs';
import { resultHit, resultCommand, resultSpeech, clampLessonMinutes, lessonLimitSeconds } from '../../recovered/control/results.mjs';
import { newStudent, readStudent, normalizeStudent, studentForSave, recordProblemKey, problemKeys } from '../../recovered/control/student.mjs';

test('score uses net characters * 182 / ticks, not a five-character word',()=>{
 assert.deepEqual(score({attempts:110,correct:100,errors:10,ticks:1092,limitSeconds:120}),
 {elapsedSeconds:60,accuracy:90,profileAccuracy:90,wpm:15});
});
test('elapsed truncation, limit clamp, zero denominator and stale profile accuracy',()=>{
 for(const [ticks,elapsed] of [[18,0],[19,1],[181,9],[182,10],[99999,10]])
  assert.equal(score({attempts:0,correct:0,errors:0,ticks,limitSeconds:10}).elapsedSeconds,elapsed);
 const r=score({attempts:0,correct:10,errors:0,ticks:0,limitSeconds:10,previousAccuracy:77});
 assert.equal(r.wpm,0); assert.equal(r.accuracy,0); assert.equal(r.profileAccuracy,77);
});
test('signed counters and low-word WPM store boundaries',()=>{
 assert.equal(score({attempts:0x8000,correct:1,errors:0,ticks:1,limitSeconds:10}).accuracy,0);
 assert.equal(score({attempts:181,correct:181,errors:0,ticks:1,limitSeconds:10}).wpm,0); // 32942 signed negative
 assert.equal(score({attempts:361,correct:361,errors:0,ticks:1,limitSeconds:10}).wpm,166); // 65702 low word
 assert.equal(score({attempts:10,correct:2,errors:8,ticks:182,limitSeconds:10}).wpm,0);
 assert.equal(score({attempts:1,correct:1,errors:0,ticks:0xffffffff,limitSeconds:10}).wpm,0);
});
test('timer pause/resume excludes paused ticks and does not double-count',()=>{
 let s={ticks:0,lastTicks:0,running:false};
 s=timer(s,300,100); s=timer(s,100,110); assert.equal(s.ticks,10);
 s=timer(s,310,120); assert.equal(s.ticks,20);
 s=timer(s,310,150); s=timer(s,100,200); assert.equal(s.ticks,20);
 s=timer(s,300,300); s=timer(s,300,310); s=timer(s,100,320); assert.equal(s.ticks,40);
 assert.equal(timer(s,320,500).ticks,0);
 assert.equal(timer({ticks:0,lastTicks:0x7fffffff,running:true},100,0x80000001).ticks,2);
});
test('mode thresholds, demo bypass, practice exemption, asymmetrical lesson reset',()=>{
 for(const [goal,mode] of [[9,1],[10,2],[29,2],[30,3]]) assert.equal(nextRoute({mode:1,lesson:6,goal}).mode,mode);
 assert.deepEqual(nextRoute({mode:3,lesson:6,goal:5}),{mode:1,lesson:6});
 assert.deepEqual(nextRoute({mode:4,lesson:6,goal:30}),{mode:4,lesson:6});
 assert.deepEqual(nextRoute({mode:1,lesson:6,goal:10}),{mode:2,lesson:1});
 assert.equal(canSelectMode(2,{profilePresent:true,goal:9}),false);
 assert.equal(canSelectMode(2,{profilePresent:true,goal:10}),true);
 assert.equal(canSelectMode(3,{profilePresent:false,goal:5}),true);
 assert.equal(canSelectMode(3,{profilePresent:true,goal:29}),false);
});
const state=(goal=5,lesson=6)=>({goal,lesson,previousGoal:0,completed:[false,false,false]});
const advance=(s,mode,resultWpm,extra={})=>progression(s,{mode,resultWpm,profilePresent:true,...extra});
test('progression completion uses strict greater-than for outdoor/water',()=>{
 for(const [mode,goal,at,above,cap] of [[1,5,8,9,10],[2,20,25,26,30]]) {
  const a=advance(state(goal),mode,at); assert.equal(a.state.goal,cap); assert.equal(a.state.completed[mode-1],false);
  const b=advance(state(goal),mode,above); assert.equal(b.state.goal,cap); assert.equal(b.state.completed[mode-1],true);
 }
});
test('progression gates and castle ending selection',()=>{
 for(const extra of [{profilePresent:false},{failed:true},{exitGate:true}]) assert.equal(advance(state(30),3,40,extra).advanced,false);
 assert.equal(advance(state(30),3,40,{exitGate:true,gateOverride:true}).ending,4);
 assert.equal(advance({...state(30),lastWpm:9},3,25,{exitGate:true}).state.lastWpm,25);
 assert.equal(advance({...state(30),lastWpm:9},3,0).state.lastWpm,9);
 assert.equal(advance(state(30,5),3,30).ending,1);
 assert.equal(advance(state(30),3,39).ending,2);
 let s=state(30); s.completed[2]=true; assert.equal(advance(s,3,40).ending,1);
 assert.equal(advance(state(5),1,4).advanced,false);
 assert.equal(advance(state(5,5),1,5).state.lesson,6);
 assert.equal(advance(state(5),1,32767).state.goal,-32767); // 16-bit ADD before comparison
});
test('certificate pending flags need profile, completed and not printed',()=>{
 assert.deepEqual(queueCertificates({profilePresent:true,completed:[1,1,0],printed:[0,1,0],pending:[0,0,1]}),[true,false,true]);
});
test('corpus groups and random mix arithmetic use explicit random input',()=>{
 assert.equal(corpusRoute(1,1).member,'MarioTea/MARIO/HLETTERS.LEE');
 assert.equal(corpusRoute(2,3).member,'MarioTea/MARIO/BWORDS.LEE');
 assert.equal(corpusRoute(3,5).member,'MarioTea/MARIO/SSENTENC.LEE');
 assert.equal(corpusRoute(1,6,0).group,1); assert.equal(corpusRoute(1,6,32767).group,5);
 assert.equal(corpusRoute(1,6,6553).group,1); assert.equal(corpusRoute(1,6,6554).group,2);
 assert.throws(()=>corpusRoute(1,6));
});
test('menu hit boxes are half-open, key commands are DOS values',()=>{
 assert.equal(mainMenuHit(236,12),0); assert.equal(mainMenuHit(298,38),0);
 assert.equal(mainMenuHit(299,38),-1); assert.equal(mainMenuHit(236,39),-1);
 assert.equal(mainMenuHit(236,167),5); assert.equal(mainMenuHit(236,183),-1);
 assert.equal(mainMenuCommand(119),'new-student'); assert.equal(mainMenuCommand(0x13b),'help');
 assert.equal(mainMenuCommand(13),'activate-menu'); assert.equal(mainMenuCommand(78),'next');
});
test('menu navigation wraps and lateral movement reopens at first row',()=>{
 assert.deepEqual(menuNavigation({column:1,row:0},'menu-up'),{column:1,row:0});
 assert.deepEqual(menuNavigation({column:1,row:0},'activate-menu'),{column:1,row:1});
 assert.deepEqual(menuNavigation({column:1,row:1},'menu-up'),{column:1,row:8});
 assert.deepEqual(menuNavigation({column:2,row:5},'menu-down'),{column:2,row:1});
 assert.deepEqual(menuNavigation({column:3,row:5},'menu-right'),{column:1,row:1});
});
test('results inclusive hit areas and Enter uses pointer, speech uses previous goal',()=>{
 assert.equal(resultHit(102,191),'next'); assert.equal(resultHit(103,191),null);
 assert.equal(resultCommand(13,135,177),'menu'); assert.equal(resultCommand(110,0,0),'next');
 assert.equal(resultCommand(32,55,180),null);
 assert.equal(resultSpeech({profilePresent:true,world:1,mode:1,goal:10,previousGoal:5,wpm:7}),'congrats');
 assert.equal(resultSpeech({profilePresent:true,world:1,mode:1,goal:11,previousGoal:5,wpm:7}),null);
 assert.equal(clampLessonMinutes(0),1); assert.equal(clampLessonMinutes(61),60);
 assert.equal(lessonLimitSeconds(0,2),120); assert.equal(lessonLimitSeconds(60,2),3600);
});
test('new student binary defaults, signed normalization and save preservation',()=>{
 const bytes=newStudent('MARIO'); const s=readStudent(bytes);
 assert.equal(bytes.length,260); assert.equal(s.goal,5); assert.equal(s.lesson,1); assert.equal(s.character,1);
 assert.deepEqual(s.durations,[2,5,5,10]); assert.equal(s.name,'MARIO');
 bytes[60]=123; bytes[29]=255; new DataView(bytes.buffer).setInt16(25,-1,true);
 const saved=studentForSave(bytes); assert.deepEqual([...saved.slice(0,4)],[26,83,84,85]); assert.equal(saved[60],123);
 assert.equal(readStudent(saved).lesson,1); assert.equal(readStudent(normalizeStudent(bytes)).character,1);
 bytes[28]=0; assert.equal(studentForSave(bytes),null);
 assert.throws(()=>readStudent(new Uint8Array(259)));
});
test('problem keys count printable bytes, exclude space, ties sorted by character',()=>{
 let b=newStudent('A'); for(const c of [32,32,65,65,66,67,127,31,128]) b=recordProblemKey(b,c);
 assert.equal(problemKeys(b),' A B C \x7f');
 new DataView(b.buffer).setInt16(68+(65-32)*2,32767,true);
 b=recordProblemKey(b,65); assert.equal(readStudent(b).errorCounts[33],-32768);
 assert.equal(problemKeys(b),' B C \x7f');
});
