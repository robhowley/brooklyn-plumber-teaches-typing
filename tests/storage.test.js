import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, loadStore, saveStore, createStore, currentStudent, createStudent, selectStudent, editStudent, validateV1, validateProfile, validateStore, LEGACY_STORAGE_KEY, STORAGE_KEY, LEGACY_RULESET, loadProfile, saveProfile, storageState } from '../src/storage.js';
import { recordResult, advanceCourse } from '../src/course.js';
import { createAttempt, typeKey, advanceTime, result, RULESET } from '../src/engine.js';
const date='2026-11-09';
const storage=(entries=[])=>{const map=new Map(entries),writes=[];return {map,writes,getItem:k=>map.get(k)??null,setItem:(k,v)=>{writes.push(k);map.set(k,v);}};};
function legacy() {
 return {version:1,name:'Ada',character:'Luigi',settings:{duration:17,goal:25,group:3,sound:true,guided:false,mode:'practice',durations:{outdoor:17,underwater:18,castle:19,practice:20}},course:{goal:25,group:5,pending:'5:25',graduated:false},results:[{mode:'outdoor',group:0,goal:5,date,passed:true,correct:25,errors:0,wpm:5,accuracy:100,duration:60,extra:'retained'}],certificates:[{kind:'outdoor',name:'Old name',date,provenance:'original award'}]};
}
function pending(p) {
 const s=createAttempt({studentId:p.id,courseRevision:p.course.revision,guided:true,duration:60,reducedMotion:true,group:p.course.group,goal:p.course.goal});
 for(let i=0;i<36;i++)typeKey(s,{key:s.text[s.lesson.records[s.cursor.recordIndex].start+s.cursor.characterIndex]});advanceTime(s,60);recordResult(p,result(s),date);
}
test('v1 conversion preserves original key, archives course, names/settings/history/awards without rescoring',()=>{
 const old=legacy(),raw=JSON.stringify(old),store=storage([[LEGACY_STORAGE_KEY,raw]]);
 assert.equal(validateV1(old),true);const session=loadStore(store),p=currentStudent(session.data);
 assert.equal(session.persistence.status,'migration-pending');assert.equal(store.writes.length,0);
 assert.deepEqual(p.course,{goal:5,group:0,revision:0,graduated:false,pending:null});
 assert.equal(p.name,'Ada');assert.equal(p.character,'Luigi');assert.deepEqual(p.settings,old.settings);assert.deepEqual(p.legacy.profile,old);
 assert.equal(p.results[0].passed,true);assert.equal(p.results[0].wpm,5);assert.equal(p.results[0].extra,'retained');assert.equal(p.results[0].ruleset,LEGACY_RULESET);
 assert.equal(p.certificates[0].name,'Old name');assert.equal(p.certificates[0].ruleset,LEGACY_RULESET);assert.equal(p.legacy.profile.certificates[0].provenance,'original award');
 for(const mutate of [p=>p.results[0].passed=false,p=>p.results.splice(0,1),p=>p.certificates[0].name='Changed']) {const copy=structuredClone(p);mutate(copy);assert.equal(validateProfile(copy),false);}
 assert.equal(saveStore(session,store),true);assert.deepEqual(store.writes,[STORAGE_KEY]);assert.equal(store.map.get(LEGACY_STORAGE_KEY),raw);
 const reload=loadStore(store);assert.equal(reload.persistence.status,'saved');assert.deepEqual(reload.data,session.data);
});
test('legacy graduation remains an archived award, never a new-course completion',()=>{
 const old=legacy();old.course={goal:50,group:5,graduated:true,pending:null};old.certificates.push({kind:'graduation',name:'Ada',date});
 const session=loadStore(storage([[LEGACY_STORAGE_KEY,JSON.stringify(old)]])),p=currentStudent(session.data);
 assert.equal(p.course.graduated,false);assert.equal(p.course.goal,5);assert.equal(p.legacy.profile.course.graduated,true);
 assert.equal(p.certificates.at(-1).kind,'graduation');assert.equal(p.certificates.at(-1).ruleset,LEGACY_RULESET);
});
test('v1 validator stays strict, v2 accepts odd goals and reset groups',()=>{
 for(const course of [{goal:7,group:5},{goal:10,group:0},{goal:50,group:4}]) {
  const old=legacy();old.course={...old.course,...course,pending:null};assert.equal(validateV1(old),false);
  const p=defaults();p.course={...p.course,...course};assert.equal(validateProfile(p),true);
 }
 for(const mutate of [p=>p.course.goal=NaN,p=>p.settings.duration=-1,p=>p.results[0].accuracy=101,p=>p.course.pending='0:5',p=>p.course.graduated=true]) {const old=legacy();mutate(old);assert.equal(validateV1(old),false);}
});
test('malformed, unknown-version and unavailable storage expose recovery/session-only and never overwrite',()=>{
 for(const [key,raw] of [[STORAGE_KEY,'{'],[STORAGE_KEY,JSON.stringify({version:99})],[LEGACY_STORAGE_KEY,'{'],[LEGACY_STORAGE_KEY,JSON.stringify({version:3})],[LEGACY_STORAGE_KEY,JSON.stringify({...legacy(),course:{goal:7,group:5}})]]) {
  const store=storage([[key,raw]]),session=loadStore(store);assert.equal(session.persistence.status,'recovery');assert.equal(session.persistence.raw,raw);
  assert.equal(saveStore(session,store),false);assert.equal(store.map.get(key),raw);assert.equal(store.writes.length,0);
 }
 const unavailable=loadStore(undefined);assert.equal(unavailable.persistence.status,'session-only');assert.equal(saveStore(unavailable,undefined),false);
 const blocked={getItem(){throw new Error('denied');}};assert.equal(loadStore(blocked).persistence.reason,'denied');
});
test('quota/interrupted conversion keeps legacy recoverable and reports session-only, then can retry',()=>{
 const raw=JSON.stringify(legacy()),store=storage([[LEGACY_STORAGE_KEY,raw]]),session=loadStore(store);
 const quota={getItem:store.getItem,setItem(){throw new Error('QuotaExceededError');}};
 assert.equal(saveStore(session,quota),false);assert.equal(session.persistence.status,'session-only');assert.equal(session.persistence.reason,'QuotaExceededError');
 assert.equal(store.map.get(LEGACY_STORAGE_KEY),raw);assert.equal(loadStore(store).persistence.status,'migration-pending');
 assert.equal(saveStore(session,store),true);assert.equal(session.persistence.status,'saved');assert.equal(store.map.get(LEGACY_STORAGE_KEY),raw);
});
test('non-destructive local create/select/edit and current selection survive reload',()=>{
 const store=storage(),session=loadStore(store),ada=currentStudent(session.data);ada.name='Ada';pending(ada);
 const snapshot=structuredClone(ada),bob=createStudent(session.data,{name:'Bob',character:'Princess'});
 assert.equal(currentStudent(session.data),bob);assert.equal(editStudent(session.data,bob.id,{name:'Bobby',settings:{sound:true,durations:{castle:12}}}),true);
 assert.equal(editStudent(session.data,bob.id,{settings:null}),false);
 assert.equal(editStudent(session.data,bob.id,{id:'hijack'}),false);assert.equal(editStudent(session.data,bob.id,{name:''}),false);
 assert.equal(selectStudent(session.data,'missing'),false);assert.deepEqual(ada,snapshot);
 assert.equal(saveStore(session,store),true);let reload=loadStore(store);assert.equal(currentStudent(reload.data).name,'Bobby');assert.equal(currentStudent(reload.data).settings.durations.castle,12);
 selectStudent(reload.data,ada.id);saveStore(reload,store);reload=loadStore(store);assert.deepEqual(currentStudent(reload.data),snapshot);
 assert.equal(advanceCourse(currentStudent(reload.data),date),true);assert.equal(reload.data.students.find(p=>p.id===bob.id).course.group,0);
});
test('pending and saved students reject cross-student IDs, corrupt results, unknown rulesets and bad selection',()=>{
 const p=defaults();pending(p);const data=createStore(p);
 for(const mutate of [d=>d.currentStudentId='missing',d=>d.students.push(structuredClone(d.students[0])),d=>d.students[0].course.pending.studentId='wrong',d=>d.students[0].results[0].studentId='wrong',d=>d.students[0].results[0].wpm=99,d=>d.students[0].course.pending.destination.group=5,d=>d.students[0].course.pending.resultId='wrong',d=>d.students[0].ruleset='old',d=>d.students[0].course.goal=7.5,d=>d.students[0].results.push(structuredClone(d.students[0].results[0]))]) {
  const copy=structuredClone(data);mutate(copy);assert.equal(validateStore(copy),false);
  const store=storage([[STORAGE_KEY,JSON.stringify(copy)]]);assert.equal(loadStore(store).persistence.status,'recovery');
 }
 assert.equal(validateStore(data),true);assert.equal(data.ruleset,RULESET);
});
test('legacy awards do not suppress new-ruleset transition awards',()=>{
 const store=storage([[LEGACY_STORAGE_KEY,JSON.stringify(legacy())]]),session=loadStore(store),p=currentStudent(session.data);
 p.course.group=5;pending(p);advanceCourse(p,date);assert.equal(p.course.goal,8);
 const s=createAttempt({studentId:p.id,courseRevision:p.course.revision,guided:true,group:5,goal:8,duration:60,reducedMotion:true});
 for(let i=0;i<48;i++)typeKey(s,{key:s.text[s.lesson.records[s.cursor.recordIndex].start+s.cursor.characterIndex]});advanceTime(s,60);recordResult(p,result(s),date);advanceCourse(p,date);
 assert.equal(p.course.goal,10);assert.deepEqual(p.certificates.map(c=>c.ruleset),[LEGACY_RULESET,RULESET]);assert.equal(saveStore(session,store),true);
});
test('single-profile wrappers preserve other slots and expose storage state',()=>{
 const store=storage(),p=loadProfile(store);p.name='Ada';assert.equal(saveProfile(p,store),true);assert.equal(storageState(p).status,'saved');assert.equal(loadProfile(store).name,'Ada');
 const other=defaults({name:'Bob'});assert.equal(saveProfile(other,store),true);const data=loadStore(store).data;assert.ok(data.students.some(s=>s.name==='Ada'));assert.equal(currentStudent(data).name,'Bob');
 const corrupt=storage([[STORAGE_KEY,'{']]),recovery=loadProfile(corrupt);assert.equal(storageState(recovery).status,'recovery');assert.equal(saveProfile(recovery,corrupt),false);
});
