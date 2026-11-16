import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Session,editStudent} from '../../app/session.mjs';
import {newStudent} from '../../recovered/control/student.mjs';
import {skipStartup,finishCelebration} from './source-path.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../../app/data.json',import.meta.url)));
const make=(edits={})=>skipStartup(new Session(data,{bytes:editStudent(newStudent('Goal'),{minutes:1,castleMinutes:1,...edits}),seed:1}));
const resultSpeech=s=>s.audioLog.filter(e=>e.request.type==='speech'&&['congrats','toobad'].includes(e.request.name)).map(e=>e.request.name);
function timeout(s,mode,correct=0) {
 if(mode===1) {s.outdoor.correct=correct;s.outdoor.attempts=correct;s.step(0,1092,101);}
 else {s.step(0,1,100);s.castle.stats.correct=correct;s.castle.stats.attempts=correct;s.step(0,1093,101);s.step(0,1094,101);}
 finishCelebration(s);assert.equal(s.screen,'results');
}
for(const mode of [1,3]) {
 test(`world ${mode}: zero-input new student hears failure against the starting goal`,()=>{
  const s=make();assert.equal(s.profile.previousGoal,0);s.start(0,mode,100);timeout(s,mode);
  assert.equal(s.result.wpm,0);assert.deepEqual(resultSpeech(s),['toobad']);
  assert.equal(s.profile.previousGoal,5);assert.equal(s.advance.advanced,false);
 });
 for(const lesson of [1,6]) test(`world ${mode}: stale previous goal cannot reject success in lesson ${lesson}`,()=>{
  const s=make({lesson});new DataView(s.student.buffer).setInt16(21,30,true);
  // Castle stops one tick after qualification: 30*182/1093 truncates to 4.
  // Seed 31 correct answers so the recomputed Results score still meets 5.
  s.start(0,mode,100);timeout(s,mode,mode===3?31:30);
  assert.equal(s.result.wpm,5);assert.deepEqual(resultSpeech(s),['congrats']);
  assert.equal(s.advance.advanced,true);assert.equal(s.profile.previousGoal,5);
  assert.equal(s.profile.lesson,lesson===1?2:6);assert.equal(s.profile.goal,lesson===1?5:mode===1?7:10);
 });
 test(`world ${mode}: snapshot precedes blocking Ready and captures edited goal on reentry`,()=>{
  const s=make();s.audioHandler=request=>request.name==='ready'?{status:'pending'}:{status:'explicit-silent'};
  s.start(0,mode,100);if(mode===3)s.step(0,1,100);
  assert.equal(s.audioPending.entry.request.name,'ready');assert.equal(s.profile.previousGoal,5);
  if(mode===3)assert.equal(s.castle.profile.previousGoal,5);
  const ticks=s.clock.ticks;s.step(27,500,101);assert.equal(s.clock.ticks,ticks);assert.equal(s.screen,mode===1?'outdoor':'castle');
  s.completeAudio([{status:'ended'}],1,100);s.step(27,2,100);if(mode===3)s.step(0,3,100);
  assert.equal(s.screen,'results');assert.deepEqual(resultSpeech(s),[]);assert.equal(s.advance.advanced,false);
  s.student=editStudent(s.student,{goal:300});s.start(4,mode,100);
  assert.equal(s.profile.previousGoal,300);if(mode===3)assert.equal(s.castle.profile.previousGoal,300);
 });
 test(`world ${mode}: guest and Demo results stay suppressed; world speech caps are unchanged`,()=>{
  const guest=make();guest.student[28]=0;guest.start(0,mode,100);timeout(guest,mode);
  assert.deepEqual(resultSpeech(guest),[]);assert.equal(guest.advance.advanced,false);
  const capped=make({goal:mode===1?11:46});capped.start(0,mode,100);timeout(capped,mode);
  assert.deepEqual(resultSpeech(capped),mode===1?[]:['toobad']);
  const demo=make();demo.selectDemo();demo.start(0,mode,100);
  for(let t=1;demo.active&&t<100;t++)demo.step(27,t,100);
  assert.equal(demo.screen,'menu');assert.deepEqual(resultSpeech(demo),[]);assert.equal(demo.profile.lesson,1);
 });
}
test('Water and Practice entry do not acquire the Outside/Castle goal snapshot',()=>{
 for(const mode of [2,4]) {
  const s=make();new DataView(s.student.buffer).setInt16(21,30,true);s.start(0,mode,100);
  assert.equal(s.profile.previousGoal,30);
 }
});
