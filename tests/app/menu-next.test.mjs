import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Session,editStudent,SAVE_KEY} from '../../app/session.mjs';
import {newStudent,studentForSave} from '../../recovered/control/student.mjs';
import {createMenu,menuInput} from '../../recovered/control/menu.mjs';
import {skipStartup} from './source-path.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../../app/data.json',import.meta.url)));
const session=bytes=>skipStartup(new Session(data,{bytes,seed:1}));

test('Main Next dispatches the shared command by localized key, fallback and pointer, except Demo',()=>{
 const profile=session(newStudent('ADA')).profile;
 for(const event of [{key:110},{key:54},{key:90,messages:{10003:'Z'}},{pointer:{x:267,y:175},front:new Uint8Array(64000)}]) {
  assert.deepEqual(menuInput(createMenu(),event,profile).effects,[{type:'next'}]);
  assert.deepEqual(menuInput(createMenu(),event,{...profile,profilePresent:false}).effects,[{type:'next'}]);
  assert.deepEqual(menuInput(createMenu(),event,{...profile,demo:true}).effects,[]);
 }
});

// MARIO.EXE FILE 0x10412..0x10475: route, queue all three slots, save, then dispatch.
for(const mode of [1,2,3,4])for(const goal of [9,10,29,30])test(`Menu and Results Next share bytes and save-before-entry, mode${mode} goal${goal}`,()=>{
 const bytes=editStudent(newStudent('ADA'),{goal,lesson:6});
 const results=session(bytes);results.start(0,mode,100);
 for(let t=10;results.active&&t<30;t++)results.step(27,t,100);
 assert.equal(results.screen,'results');
 // Seed outstanding certificate state and old error counters at the Next boundary.
 results.student.set([1,1,0,0,1,0,0,0,1],38);
 new DataView(results.student.buffer).setInt16(68,7,true);
 const menu=session(results.student),before=results.student.slice();
 const nextMode=mode===4?4:goal<10?1:goal<30?2:3;
 const route={mode:nextMode,lesson:nextMode===4||nextMode===1||mode===nextMode?6:1};
 const expected=studentForSave(before),v=new DataView(expected.buffer);
 v.setInt16(15,route.mode,true);v.setInt16(25,route.lesson,true);expected.set([1,0,1],44);
 const saved=[];
 for(const s of [menu,results]) {
  const screen=s.screen,writes=[],other=Array.from(newStudent('BOB'));
  const profiles={current:'ADA',students:{ADA:Array.from(before),BOB:other}};
  const storage={setItem:(key,value)=>{assert.equal(key,SAVE_KEY);writes.push(JSON.parse(value));}};
  let calls=0;
  assert.deepEqual(s.next(20,()=>{
   calls++;assert.equal(s.screen,screen);assert.equal(s.profile.errorCounts[0],7);
   assert.deepEqual([s.profile.mode,s.profile.lesson],[route.mode,route.lesson]);
   assert.deepEqual(s.profile.pending,[1,0,1]);s.save(storage,profiles);
  }),route);
  assert.equal(calls,1);assert.equal(writes.length,1);
  assert.deepEqual(writes[0],{current:'ADA',students:{ADA:Array.from(expected),BOB:other}});
  assert.equal(s.active,true);assert.equal(s.profile.errorCounts.every(n=>n===0),true);
  assert.deepEqual(s.profile.completed,[1,1,0]);assert.deepEqual(s.profile.printed,[0,1,0]);
  saved.push(writes[0]);
 }
 assert.deepEqual(saved[0],saved[1]);assert.deepEqual(menu.profile,results.profile);
});

test('Next queues slot2, keeps printed/completed/pending distinct and never prints',()=>{
 const s=session(newStudent('ADA'));
 s.student.set([1,1,1,1,0,0,0,1,0],38);
 s.next(20);
 assert.deepEqual(s.profile.completed,[1,1,1]);assert.deepEqual(s.profile.printed,[1,0,0]);
 assert.deepEqual(s.profile.pending,[0,1,1]);
});

test('Demo, blocking audio and active screens reject Next; guest routes without creating a save',()=>{
 const s=session(newStudent('ADA'));s.selectDemo();const before=s.student.slice();
 assert.equal(s.next(20,()=>assert.fail('Demo save')),null);assert.deepEqual(s.student,before);assert.equal(s.screen,'menu');
 const guest=session(null);guest.student.set([1,1,1,0,0,0,0,0,1],38);
 const profiles={current:null,students:{}},storage={setItem:()=>assert.fail('Guest save')};
 assert.deepEqual(guest.next(20,()=>guest.save(storage,profiles)),{mode:1,lesson:1});
 assert.deepEqual(guest.profile.pending,[0,0,1]);assert.deepEqual(profiles,{current:null,students:{}});
 assert.equal(guest.next(21,()=>assert.fail('Active save')),null);
 const blocked=session(newStudent('ADA'));blocked.audioPending={};
 assert.equal(blocked.next(20,()=>assert.fail('Blocked save')),null);assert.equal(blocked.screen,'menu');
});
