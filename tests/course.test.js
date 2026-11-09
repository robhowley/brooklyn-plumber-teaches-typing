import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, loadProfile, saveProfile } from '../src/storage.js';
import { courseMode, advanceCourse, recordResult } from '../src/course.js';
import { createAttempt, typeKey, advanceTime, resume, result, generateText, KEY_GROUPS, MODES } from '../src/engine.js';
const date='2026-11-09T00:00:00.000Z';
function pass(p, guided=true) {
 const s=createAttempt({...p.course,mode:courseMode(p.course),guided,duration:1,text:'a',reducedMotion:true});
 for(let i=0;i<10;i++) typeKey(s,{key:'a'});
 advanceTime(s,1);recordResult(p,result(s),date);
}
test('15 passes graduate, Next is gated/idempotent, three certificates survive reload',()=>{
 let p=defaults(),raw;const store={setItem:(_,v)=>raw=v,getItem:()=>raw};
 assert.equal(advanceCourse(p,date),false);
 for(let i=0;i<15;i++) {
  pass(p);saveProfile(p,store);p=loadProfile(store);
  if(i<14) { assert.equal(advanceCourse(p,date),true);const snapshot=JSON.stringify(p);assert.equal(advanceCourse(p,date),false);assert.equal(JSON.stringify(p),snapshot); }
 }
 assert.equal(p.course.graduated,true);assert.equal(p.course.goal,50);assert.equal(p.results.length,15);
 assert.deepEqual(p.certificates.map(c=>c.kind),['outdoor','underwater','graduation']);
 saveProfile(p,store);assert.deepEqual(loadProfile(store),p);
});
test('custom passes and failed retries cannot move or erase earned course progress',()=>{
 const p=defaults();pass(p,false);assert.equal(p.course.pending,null);pass(p);
 const pending=p.course.pending;recordResult(p,{...p.results.at(-1),passed:false},date);assert.equal(p.course.pending,pending);
 advanceCourse(p,date);recordResult(p,{...p.results[1]},date);assert.equal(p.course.pending,null);
});
test('all modes use defaults; outdoor reaches every key and fixed modes loop constrained passages',()=>{
 const passages=[
  'a lad asks a lass; a lass adds a salad; ',
  'the sailor sails; the quiet lake is still; ',
  'we swim past the reef; brave friends explore the castle; ',
  'we swim 12 laps; collect 34 coins; open gate 56; ',
  'swim past the reef! find 12 coins, then rest. ',
  'The reef has 12 fish. Swim past the gate! "Ready?" Yes, let us go. ',
 ];
 for(const [mode,config] of Object.entries(MODES)) assert.equal(createAttempt({mode}).duration,config.duration);
 KEY_GROUPS.forEach((g,group)=>{
  const outdoor=generateText(group,12000,19,'outdoor');
  assert.deepEqual([...new Set(outdoor)].sort(),[...new Set(g.keys)].sort(),`outdoor/${group}`);
  for(const mode of ['underwater','castle','practice']) {
   const corpus=generateText(group,12000,19,mode);
   assert.equal(corpus,passages[group],`${mode}/${group}`);
   assert.ok([...corpus].every(key=>g.keys.includes(key)),`${mode}/${group} contains only selected keys`);
  }
 });
});
test('castle alternates chambers every 40 correct characters and pauses input/time until resume',()=>{
 const s=createAttempt({mode:'castle',text:'a'});
 for(const stage of ['quicksand','thwomps']) {
  for(let i=0;i<40;i++)typeKey(s,{key:'a'});
  assert.equal(s.castleStage,stage);assert.deepEqual(s.pipe,{stage:'inside',progress:.5});
  const count=s.correct;advanceTime(s,100);assert.equal(s.elapsed,0);assert.equal(typeKey(s,{key:'a'}),'ignored');assert.equal(s.correct,count);
  resume(s);assert.equal(s.pipe,null);
 }
});
test('invalid persisted course and certificate data default safely',()=>{
 const p=defaults();p.course={goal:49,group:5,pending:'5:49',graduated:true};p.certificates=[null,{kind:'fake'}];
 const loaded=loadProfile({getItem:()=>JSON.stringify(p)});assert.deepEqual(loaded.course,defaults().course);assert.deepEqual(loaded.certificates,[]);
});
