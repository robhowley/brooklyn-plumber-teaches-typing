import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Session, editStudent, dosKey, SAVE_KEY, loadProfiles } from '../../app/session.mjs';
import { newStudent } from '../../recovered/control/student.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../../app/data.json',import.meta.url)));
import {skipStartup,finishCelebration} from './source-path.mjs';
const session=()=>skipStartup(new Session(data,{bytes:editStudent(newStudent('Tester'),{minutes:1}),seed:1}));
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
test('timeout finalizes score then advances exactly once; Next enters Water without a second advancement',()=>{
 const s=session();s.start(0);s.outdoor.attempts=60;s.outdoor.correct=60;s.step(0,1092);assert.equal(s.screen,'celebration');finishCelebration(s);
 assert.equal(s.screen,'results');assert.equal(s.result.wpm,10);assert.equal(s.result.elapsedSeconds,60);assert.equal(s.profile.lesson,2);
 s.next(2000);assert.equal(s.profile.lesson,2);
 s.student=editStudent(s.student,{lesson:6,goal:5});s.start(3000);s.outdoor.attempts=60;s.outdoor.correct=60;s.step(0,4092);finishCelebration(s);
 assert.equal(s.profile.goal,10);assert.equal(s.profile.completed[0],1);
 assert.deepEqual(s.next(5000),{mode:2,lesson:1});assert.equal(s.screen,'water');
});
test('student edits clamp durations and groups; save does not touch old app namespace',()=>{
 const s=session();s.student=editStudent(s.student,{lesson:99,minutes:99});assert.equal(s.profile.lesson,6);assert.equal(s.profile.durations[0],60);
 const calls=[];const storage={setItem:(...args)=>calls.push(args),getItem:()=>'{bad'};
 assert.throws(()=>loadProfiles(storage),SyntaxError);s.save(storage,{students:{}});assert.equal(calls[0][0],SAVE_KEY);
 assert.throws(()=>editStudent(s.student,{goal:0}));assert.throws(()=>editStudent(s.student,{name:'TOO-LONG-NAME'}));
});
test('save overwrites a case-insensitive filename without migrating or changing unrelated records',()=>{
 const s=session(),other=Array.from(newStudent('Other')),existing=Array.from(newStudent('tester'));
 const profiles={current:'tester',students:{tester:existing,Other:other}};let saved;
 s.save({setItem:(key,value)=>{assert.equal(key,SAVE_KEY);saved=JSON.parse(value);}},profiles);
 assert.equal(saved.current,'tester');assert.deepEqual(Object.keys(saved.students),['tester','Other']);
 assert.equal(saved.students.tester[4],'T'.charCodeAt(0));assert.deepEqual(saved.students.Other,other);
 assert.equal(profiles.students.Other,other);
});
test('cancelled New leaves zero bytes, the next source service normalizes only its owned fields',()=>{
 const s=session();s.student=new Uint8Array(260);s.start(1,1,100);
 assert.equal(s.profile.profilePresent,false);assert.equal(s.profile.character,1);assert.equal(s.profile.lesson,1);
 assert.equal(s.profile.goal,0);assert.equal(s.limit,120);
});
test('Outside reentry retains counters and observed seconds across Practice, not entry objects',()=>{
 const s=session();s.start(0);
 s.step(0,1,100);s.step(27,2,100);
 const old=s.outdoor, fields=['cursorCounter','groundPhase','stillTicks','idleTicks','distance'];
 const retained=fields.map(k=>old[k]), second=s.bonus.lastSecond;
 assert.equal(second,100);
 s.next(3);
 assert.deepEqual(fields.map(k=>s.outdoor[k]),retained);
 assert.notEqual(s.outdoor,old);assert.equal(s.outdoor.attempts,0);
 assert.equal(s.outdoor.x,20);assert.equal(s.outdoor.scroll,1);
 assert.equal(s.bonus.lastSecond,second);
 const countdown=s.bonus.countdown;s.step(0,4,100);
 assert.equal(s.bonus.countdown,countdown); // same observed second, no decrement
 s.step(27,5,100);const outside=s.outdoor;
 s.start(6,4);s.step(s.practice.rows[33],7,101);s.step(27,8,101);
 const practiceTime=s.practice.lastCorrect;
 s.start(9);
 assert.deepEqual(fields.map(k=>s.outdoor[k]),fields.map(k=>outside[k]));
 assert.equal(s.bonus.lastSecond,second);
 s.step(27,10,102);s.start(11,4);
 assert.equal(s.practice.lastCorrect,practiceTime);
 s.start(12,3);assert.equal(s.screen,'castle');
 assert.throws(()=>s.start(13,5),/Unsupported/);
});
test('DOS keyboard boundary rejects modified, non-ASCII and composition events',()=>{
 assert.equal(dosKey({key:'F10'}),0x144);assert.equal(dosKey({key:'x',altKey:true}),0x12d);
 assert.equal(dosKey({key:'a',ctrlKey:true}),0);assert.equal(dosKey({key:'é'}),0);assert.equal(dosKey({key:'a',isComposing:true}),0);
 assert.equal(dosKey({key:'Delete'}),0x153);assert.equal(dosKey({key:'a'}),97);
 for(const [key,code] of Object.entries({Home:0x147,End:0x14f,PageUp:0x149,PageDown:0x151,Insert:0x152,F9:0x143})) assert.equal(dosKey({key}),code);
});
