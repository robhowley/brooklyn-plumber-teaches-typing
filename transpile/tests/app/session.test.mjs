import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Session, editStudent, dosKey, SAVE_KEY, loadProfiles } from '../../app/session.mjs';
import { newStudent } from '../../recovered/control/student.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../../app/data.json',import.meta.url)));
const session=()=>new Session(data,{bytes:editStudent(newStudent('Tester'),{minutes:1}),seed:1});
test('outside target accepts immediate distant lowercase, errors record expected key',()=>{
 const s=session();s.start(0);s.step(0,1);
 const target=s.outdoor.obstacles[s.outdoor.targetIndex];assert.ok(target.x>220);
 s.step(target.code===65?66:65,2);assert.equal(s.outdoor.errors,1);
 assert.equal(s.profile.errorCounts[target.code-32],1);
 s.step(String.fromCharCode(target.code).toLowerCase().charCodeAt(0),3);
 assert.equal(s.outdoor.correct,1);assert.equal(target.code,0);assert.equal(s.outdoor.attempts,2);
});
test('suspend freezes active ticks and mechanics; resume excludes wall time',()=>{
 const s=session();s.start(100);s.step(0,110);s.suspend(true,111);
 const before=structuredClone(s.outdoor);s.step(65,500);assert.deepEqual(s.outdoor,before);assert.equal(s.clock.ticks,11);
 s.suspend(false,500);s.step(0,510);assert.equal(s.clock.ticks,21);
});
test('Escape early exit results suppress advancement and Next does not increment group',()=>{
 const s=session();s.start(0);s.step(27,10);assert.equal(s.screen,'results');assert.equal(s.advance.advanced,false);
 assert.equal(s.profile.lesson,1);assert.equal(s.result.elapsedSeconds,0);s.next(20);assert.equal(s.screen,'outdoor');assert.equal(s.profile.lesson,1);
});
test('timeout finalizes score then advances exactly once; Next routes unsupported worlds honestly',()=>{
 const s=session();s.start(0);s.outdoor.attempts=60;s.outdoor.correct=60;s.step(0,1092);
 assert.equal(s.screen,'results');assert.equal(s.result.wpm,10);assert.equal(s.result.elapsedSeconds,60);assert.equal(s.profile.lesson,2);
 s.next(2000);assert.equal(s.profile.lesson,2);
 s.student=editStudent(s.student,{lesson:6,goal:5});s.start(3000);s.outdoor.attempts=60;s.outdoor.correct=60;s.step(0,4092);
 assert.equal(s.profile.goal,10);assert.equal(s.profile.completed[0],1);
 assert.deepEqual(s.next(5000),{mode:2,lesson:1});assert.equal(s.screen,'results');
});
test('student edits clamp durations and groups; save does not touch old app namespace',()=>{
 const s=session();s.student=editStudent(s.student,{lesson:99,minutes:99});assert.equal(s.profile.lesson,6);assert.equal(s.profile.durations[0],60);
 const calls=[];const storage={setItem:(...args)=>calls.push(args),getItem:()=>'{bad'};
 assert.throws(()=>loadProfiles(storage),SyntaxError);s.save(storage,{students:{}});assert.equal(calls[0][0],SAVE_KEY);
 assert.throws(()=>editStudent(s.student,{goal:0}));assert.throws(()=>editStudent(s.student,{name:'TOO-LONG-NAME'}));
});
test('DOS keyboard boundary rejects modified, non-ASCII and composition events',()=>{
 assert.equal(dosKey({key:'F10'}),0x144);assert.equal(dosKey({key:'x',altKey:true}),0x12d);
 assert.equal(dosKey({key:'a',ctrlKey:true}),0);assert.equal(dosKey({key:'é'}),0);assert.equal(dosKey({key:'a',isComposing:true}),0);
 assert.equal(dosKey({key:'Delete'}),127);assert.equal(dosKey({key:'a'}),97);
});
