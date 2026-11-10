import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, loadStore, saveStore, createStore, currentStudent, validateProfile, STORAGE_KEY } from '../src/storage.js';
import { courseMode, advanceCourse, recordResult, validPending } from '../src/course.js';
import { createAttempt, typeKey, advanceTime, resume, result, RULESET } from '../src/engine.js';
const date='2026-11-09T00:00:00.000Z';
function attempt(p, achieved=p.course.goal, options={}) {
  const s=createAttempt({...p.course,mode:courseMode(p.course),guided:true,studentId:p.id,courseRevision:p.course.revision,duration:60,reducedMotion:true,...options});
  for(let i=0;i<achieved*6;i++){typeKey(s,{key:s.text[s.lesson.records[s.cursor.recordIndex].start+s.cursor.characterIndex]});resume(s);}
  advanceTime(s,60);return result(s);
}
const pass=(p,achieved,options)=>{const r=attempt(p,achieved,options);recordResult(p,r,date);return r;};
const store=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};

test('routing boundaries and six stages, achieved-speed caps and world entry resets',()=>{
 for(const [goal,mode] of [[9,'outdoor'],[10,'underwater'],[29,'underwater'],[30,'castle']]) assert.equal(courseMode({goal}),mode);
 for(const [goal,achieved,nextGoal,nextGroup] of [[5,6,8,5],[5,8,10,0],[5,9,10,0],[10,11,16,5],[25,25,30,0],[25,26,30,0],[30,31,36,5],[39,39,44,5],[40,40,45,5],[45,45,50,5],[45,49,50,5]]) {
   const p=defaults();Object.assign(p.course,{group:5,goal});pass(p,achieved);
   assert.deepEqual([p.course.group,p.course.goal],[5,goal]);
   assert.deepEqual([p.course.pending.destination.group,p.course.pending.destination.goal],[nextGroup,nextGoal]);
   assert.equal(advanceCourse(p,date),true);assert.deepEqual([p.course.group,p.course.goal],[nextGroup,nextGoal]);
   assert.equal(p.certificates.length,nextGroup===0?1:0);
 }
 const p=defaults();for(let group=0;group<5;group++){pass(p,9);advanceCourse(p,date);assert.deepEqual([p.course.group,p.course.goal],[group+1,5]);}
});
test('first successful snapshot survives faster/failed retries, duplicate delivery, reload and Next twice',()=>{
 let p=defaults();p.course.group=5;
 const first=pass(p,6),pending=p.course.pending;
 assert.ok(Object.isFrozen(pending));assert.ok(Object.isFrozen(pending.destination));assert.throws(()=>{pending.achieved=9;});
 const faster=pass(p,9);pass(p,0);assert.equal(p.course.pending,pending);assert.equal(pending.resultId,first.id);
 const replaced=structuredClone(p);Object.assign(replaced.course.pending,{resultId:faster.id,achieved:9,destination:{group:0,goal:10,revision:1}});assert.equal(validPending(replaced),false);
 const reordered=structuredClone(replaced);
 [reordered.results[0],reordered.results[1]]=[reordered.results[1],reordered.results[0]];
 assert.equal(validateProfile(reordered),false);
 assert.equal(validPending(reordered),false);
 const rejected=store();rejected.setItem(STORAGE_KEY,JSON.stringify({version:2,ruleset:RULESET,corpusVersion:p.corpusVersion,currentStudentId:p.id,students:[reordered]}));
 assert.equal(loadStore(rejected).persistence.status,'recovery');
 assert.equal(recordResult(p,first,date),false);assert.equal(p.results.length,3);
 const storage=store(),session={data:createStore(p),persistence:{writable:true}};
 assert.equal(saveStore(session,storage),true);p=currentStudent(loadStore(storage).data);assert.deepEqual(p.course.pending,pending);assert.ok(Object.isFrozen(p.course.pending));
 assert.equal(advanceCourse(p,date),true);assert.deepEqual([p.course.group,p.course.goal],[5,8]);
 const snapshot=structuredClone(p);assert.equal(advanceCourse(p,date),false);assert.deepEqual(p,snapshot);
 assert.equal(recordResult(p,first,date),false);assert.equal(p.course.pending,null);
});
test('practice/custom/off-course and stale revisions cannot grant progress or replace earned progress',()=>{
 const p=defaults();
 for(const options of [{text:'a',guided:true},{guided:false},{mode:'practice'},{group:1},{mode:'underwater'},{courseRevision:1}]) pass(p,10,options);
 assert.equal(p.course.pending,null);pass(p,5);const pending=p.course.pending;
 const custom=pass(p,30,{text:'a',guided:true});
 assert.equal(custom.source,'custom');assert.equal(custom.passed,true);assert.equal(custom.guided,true);
 pass(p,30,{guided:false});pass(p,30,{mode:'practice'});assert.equal(p.course.pending,pending);
 assert.equal(validateProfile(p),true);
 const stale=attempt(p,5);advanceCourse(p,date);recordResult(p,stale,date);assert.equal(p.course.pending,null);
 assert.throws(()=>recordResult(p,{...attempt(p,5),studentId:'other'},date));
});
test('selected original/generated lessons progress; custom results cannot back saved pending or awards',()=>{
 for(const content of ['original','generated']) {
  for(const [group,goal] of [[0,5],[5,5],[5,50]]) {
   const p=defaults();Object.assign(p.course,{group,goal});
   const custom=pass(p,Math.max(goal,8),{text:'a',guided:true});
   assert.equal(custom.source,'custom');assert.equal(custom.passed,true);
   assert.equal(p.course.pending,null);assert.equal(p.course.graduated,false);
   const selected=pass(p,Math.max(goal,8),{content});
   assert.equal(selected.source,content);assert.equal(selected.passed,true);
   assert.equal(validateProfile(p),true);
   if(goal!==50) {
    assert.equal(p.course.pending.resultId,selected.id);
    const forged=structuredClone(p);forged.course.pending.resultId=custom.id;
    assert.equal(validPending(forged),false);assert.equal(validateProfile(forged),false);
    advanceCourse(p,date);
   } else assert.equal(p.course.graduated,true);
   assert.equal(validateProfile(p),true);
   if(p.certificates.length) {
    const forged=structuredClone(p);forged.certificates[0].resultId=custom.id;
    assert.equal(validateProfile(forged),false);
   }
  }
 }
});
test('pending binds source, destination, achieved score, result, student and ruleset',()=>{
 const p=defaults();pass(p,5);
 for(const mutate of [p=>p.course.pending.studentId='other',p=>p.course.pending.ruleset='old',p=>p.course.pending.achieved=9,p=>p.course.pending.resultId='missing',p=>p.course.pending.source.group=1,p=>p.course.pending.destination.goal=99,p=>p.course.pending.source.revision=2,p=>p.course.pending.destination.revision=4,p=>p.course.pending.corpusVersion='other']) {
  const copy=structuredClone(p);mutate(copy);assert.equal(validPending(copy),false);assert.throws(()=>advanceCourse(copy,date));
 }
});
test('dynamic whole course routes through world resets, reloads and graduates exactly once',()=>{
 let p=defaults(),passes=0;const storage=store();
 while(!p.course.graduated) {
   assert.ok(passes++<40);
   pass(p,p.course.goal);const session={data:createStore(p),persistence:{writable:true}};
   assert.equal(saveStore(session,storage),true);p=currentStudent(loadStore(storage).data);
   if(!p.course.graduated)assert.equal(advanceCourse(p,date),true);
 }
 assert.ok(passes>15);assert.equal(p.course.goal,50);assert.equal(p.course.group,5);assert.equal(p.course.pending,null);
 assert.deepEqual(p.certificates.map(c=>c.kind),['outdoor','underwater','graduation']);assert.ok(p.certificates.every(c=>c.ruleset===RULESET));
 const graduation=p.results.at(-1);assert.equal(recordResult(p,graduation,date),false);assert.equal(advanceCourse(p,date),false);
 pass(p,60,{mode:'practice',guided:false});assert.equal(p.certificates.length,3);assert.equal(p.course.pending,null);
});
test('revision exhaustion and invalid Next dates reject before mutation',()=>{
 const p=defaults();p.course.revision=Number.MAX_SAFE_INTEGER;const before=structuredClone(p);
 assert.throws(()=>pass(p,5),RangeError);assert.deepEqual(p,before);
 const q=defaults();pass(q,5);const pending=structuredClone(q);
 assert.throws(()=>advanceCourse(q));assert.deepEqual(q,pending);
});
test('graduation requires eligible guided goal50/group5 assessment, not reaching50 early',()=>{
 const p=defaults();Object.assign(p.course,{goal:45,group:5});pass(p,70);assert.equal(p.course.graduated,false);
 assert.equal(p.course.pending.destination.goal,50);advanceCourse(p,date);pass(p,49);assert.equal(p.course.graduated,false);
 pass(p,50,{guided:false});assert.equal(p.course.graduated,false);
 const custom=pass(p,60,{text:'a',guided:true});assert.equal(custom.source,'custom');assert.equal(custom.passed,true);
 assert.equal(p.course.graduated,false);assert.equal(p.course.pending,null);assert.equal(p.certificates.length,0);
 pass(p,50);assert.equal(p.course.graduated,true);
 assert.equal(p.certificates.filter(c=>c.kind==='graduation').length,1);
 const customAward=structuredClone(p);
 Object.assign(customAward.certificates[0],{resultId:custom.id,achieved:custom.wpm});
 assert.equal(validateProfile(customAward),false);
 const earned=structuredClone(p.certificates[0]);
 const later=pass(p,60);
 assert.deepEqual(p.certificates[0],earned);
 assert.equal(validateProfile(p),true);
 const rebound=structuredClone(p);
 Object.assign(rebound.certificates[0],{resultId:later.id,achieved:later.wpm,corpusVersion:later.corpusVersion});
 assert.equal(validateProfile(rebound),false);
 const future=pass(p,60,{courseRevision:p.course.revision+1});
 const futureRebound=structuredClone(p);
 Object.assign(futureRebound.certificates[0],{resultId:future.id,achieved:future.wpm});
 assert.equal(validateProfile(futureRebound),false);
 const saved=store(),session={data:createStore(p),persistence:{writable:true}};
 assert.equal(saveStore(session,saved),true);
 assert.deepEqual(currentStudent(loadStore(saved).data).certificates[0],earned);
 const reordered=structuredClone(rebound);
 reordered.results.reverse();
 assert.equal(validateProfile(reordered),false);
 const early=defaults(),s=createAttempt({guided:true,studentId:early.id,reducedMotion:true,text:'a'});typeKey(s,{key:'a'});advanceTime(s,1);
 assert.throws(()=>recordResult(early,result(s),date));assert.equal(early.results.length,0);
});
