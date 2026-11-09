import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttempt, advanceTime, typeKey, pause, resume, stats, result, KEY_GROUPS} from '../src/engine.js';
const target=s=>s.travel.obstacles.find(o=>o.id===s.correct);
const key=s=>({key:s.text[s.correct%s.text.length]});
const contact=s=>advanceTime(s,Math.max(0,(target(s).x-215)/s.travel.speed));
test('no input travels continuously, passes the runner and repeats the SAME target without penalties',()=>{
 const s=createAttempt({text:'abcdef'}), first={...target(s)};
 advanceTime(s,2); assert.equal(target(s).x,first.x-144); assert.equal(s.travel.distance,144);
 advanceTime(s,3); assert.ok(target(s).x<215); assert.equal(target(s).id,first.id);
 advanceTime(s,5); assert.equal(target(s).x,first.x); assert.equal(s.correct,0); assert.equal(s.errors,0);
 assert.equal(stats(s).attempted,0);
});
test('on-time input clears the encountered object without moving or relabeling its neighbors',()=>{
 const s=createAttempt({text:'abcdef'});contact(s);
 const before=s.travel.obstacles.map(o=>({...o})), distance=s.travel.distance;
 assert.equal(typeKey(s,key(s)),'correct');assert.equal(s.correct,1);
 assert.equal(s.travel.action.id,0);assert.equal(s.travel.action.x,215);assert.equal(s.travel.distance,distance);
 assert.deepEqual(s.travel.obstacles.slice(1),before.slice(1));assert.equal(target(s).id,1);assert.equal(target(s).x,335);
 advanceTime(s,4);assert.equal(s.travel.obstacles[0].id,6);assert.ok(s.travel.obstacles[0].x>600);
});
test('one early key is held, retains target, and resolves at contact, independently of frame size',()=>{
 const a=createAttempt({text:'abcdef'}), b=createAttempt({text:'abcdef'});
 for(const s of [a,b]) { assert.equal(typeKey(s,key(s)),'buffered');assert.equal(typeKey(s,key(s)),'ignored');assert.equal(s.correct,0); }
 advanceTime(a,5);for(let i=0;i<500;i++)advanceTime(b,.01);
 assert.equal(a.correct,1);assert.equal(b.correct,1);assert.equal(a.travel.action.id,0);assert.ok(Math.abs(a.travel.action.at-b.travel.action.at)<1e-9);
 assert.ok(Math.abs(a.travel.action.x-241)<1e-9);assert.equal(a.travel.buffered,false);
});
test('late input within reach works; missed input waits for the same returning object',()=>{
 const late=createAttempt({text:'abcdef'});advanceTime(late,(550-195)/72);assert.equal(typeKey(late,key(late)),'correct');assert.equal(late.travel.action.x,195);
 const missed=createAttempt({text:'abcdef'});advanceTime(missed,6);assert.ok(target(missed).x<189);
 assert.equal(typeKey(missed,key(missed)),'buffered');advanceTime(missed,8.3);assert.equal(missed.correct,1);assert.equal(missed.errors,0);
 assert.equal(missed.travel.action.id,0);assert.ok(Math.abs(missed.travel.action.x-241)<1e-8);
});
test('wrong case, punctuation and space retain target and count once, including while a key is held',()=>{
 const s=createAttempt({text:'A !'});assert.equal(typeKey(s,{key:'a'}),'error');assert.equal(s.errors,1);assert.equal(s.correct,0);
 assert.equal(typeKey(s,{key:'A'}),'buffered');assert.equal(typeKey(s,{key:'!'}),'error');advanceTime(s,4.3);assert.equal(s.correct,1);
 assert.equal(typeKey(s,{key:'!'}),'error');assert.equal(typeKey(s,{key:' '}),'buffered');advanceTime(s,2);assert.equal(s.correct,2);
 assert.equal(typeKey(s,{key:'!'}),'buffered');advanceTime(s,2);assert.equal(s.correct,3);assert.equal(stats(s).attempted,6);assert.equal(stats(s).accuracy,50);
});
test('pause, pipe and finished state freeze travel and buffered contact until explicit resume',()=>{
 const s=createAttempt();typeKey(s,key(s));advanceTime(s,1);pause(s);const snapshot=JSON.stringify(s);advanceTime(s,1000);assert.equal(JSON.stringify(s),snapshot);
 resume(s);advanceTime(s,.1);assert.equal(s.elapsed,1.1);assert.ok(s.travel.distance<80);advanceTime(s,4);assert.equal(s.correct,1);
 const castle=createAttempt({mode:'castle',text:'a'});advanceTime(castle,2);for(let i=0;i<40;i++)typeKey(castle,{key:'a'});
 const frozen=JSON.stringify(castle);advanceTime(castle,500);assert.equal(JSON.stringify(castle),frozen);resume(castle);advanceTime(castle,1);assert.equal(castle.travel.distance,144);
 const done=createAttempt({duration:1});typeKey(done,key(done));advanceTime(done,1);assert.equal(done.correct,0);assert.equal(done.travel.buffered,false);assert.equal(result(done).passed,false);
 const finished=JSON.stringify(done);advanceTime(done,200);assert.equal(JSON.stringify(done),finished);
});
test('reduced motion needs no timing window and all keygroups and characters remain usable',()=>{
 for(const character of ['Mario','Luigi','Princess'])for(let group=0;group<6;group++){
 const s=createAttempt({character,group,text:KEY_GROUPS[group].keys,reducedMotion:true});advanceTime(s,10);assert.equal(s.travel.distance,0);
 for(const char of s.text)assert.equal(typeKey(s,{key:char}),'correct');assert.equal(s.correct,s.text.length);assert.equal(target(s).id,s.correct);
 }
});
test('ordinary 5 and 12 WPM goals are achievable with runway and one-key anticipation',()=>{
 for(const goal of [5,12]){
 const s=createAttempt({goal,duration:120});
 while(s.status==='running'){typeKey(s,key(s));advanceTime(s,.05);}
 assert.equal(s.errors,0);assert.ok(stats(s).wpm>=goal);assert.equal(result(s).passed,true);assert.equal(s.travel.obstacles.length,6);
 }
});
test('custom outdoor goals through 150 WPM have enough encounters without changing pass math',()=>{
 for(const goal of [30,75,150]){
  const s=createAttempt({goal,duration:120});
  while(s.status==='running'){
   typeKey(s,key(s));
   advanceTime(s,.01);
  }
  assert.equal(s.reducedMotion,false);assert.equal(s.errors,0);
  assert.ok(s.correct>=goal*10,`${goal} WPM requires ${goal*10} correct, got ${s.correct}`);
  assert.ok(stats(s).wpm>=goal);assert.equal(result(s).passed,true);
  assert.equal(s.travel.obstacles.length,6);
 }
});
test('underwater/castle move without input; practice and reduced motion do not',()=>{
 for(const mode of ['outdoor','underwater','castle','practice'])for(const reducedMotion of [false,true]){
 const s=createAttempt({mode,reducedMotion});advanceTime(s,3);
 assert.equal(s.travel.distance>0,!reducedMotion&&mode!=='practice');assert.equal(s.correct,0);
 }
});
