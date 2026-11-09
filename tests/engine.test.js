import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttempt,typeKey,advanceTime,pause,resume,stats,result,generateText,KEY_GROUPS,fingerHint} from '../src/engine.js';
import {loadProfile,saveProfile,defaults} from '../src/storage.js';
test('exact input, spaces, errors and ignored keyboard events',()=>{
 const s=createAttempt({text:'a A!',reducedMotion:true});
 for(const key of ['Shift','Backspace','Enter','ArrowLeft']) assert.equal(typeKey(s,{key}),'ignored');
 for(const flag of ['repeat','isComposing','ctrlKey','metaKey','altKey']) assert.equal(typeKey(s,{key:'a',[flag]:true}),'ignored');
 assert.equal(typeKey(s,{key:'A'}),'error'); assert.equal(s.correct,0);
 for(const key of 'a A!') assert.equal(typeKey(s,{key}),'correct');
 assert.equal(s.correct,4); assert.equal(s.errors,1); assert.equal(stats(s).accuracy,80);
});
test('scoring includes active time only, pause blocks input and time',()=>{
 const s=createAttempt({text:'a',duration:120,reducedMotion:true}); for(let i=0;i<50;i++)typeKey(s,{key:'a'});
 advanceTime(s,60); pause(s); advanceTime(s,999); typeKey(s,{key:'a'});
 assert.equal(s.elapsed,60); assert.equal(s.correct,50); assert.equal(stats(s).wpm,10); assert.equal(result(s).passed,false);
 resume(s); advanceTime(s,60); assert.equal(result(s).passed,true); assert.equal(stats(s).wpm,5); assert.equal(typeKey(s,{key:'a'}),'ignored');
});
test('timeout caps time and requires attempts, speed, and 90 percent accuracy',()=>{
 for(const [correct,errors,goal,passed] of [[0,0,5,false],[25,0,5,true],[24,0,5,false],[90,10,18,true],[90,11,18,false]]) {
 const s=createAttempt({duration:60,goal,text:'a',reducedMotion:true}); for(let i=0;i<correct;i++)typeKey(s,{key:'a'});for(let i=0;i<errors;i++)typeKey(s,{key:'b'});
 advanceTime(s,999);assert.equal(s.elapsed,60);assert.equal(result(s).passed,passed);
 }
});
test('text is deterministic and constrained for all six selections',()=>{
 KEY_GROUPS.forEach((g,i)=>{const text=generateText(i);assert.equal(text,generateText(i));assert.ok([...text].every(k=>g.keys.includes(k)));});
 assert.match(fingerHint(' '),/thumb/);assert.match(fingerHint('A'),/Shift/);
});
test('quicksand sinks smoothly, recovers on recent keys, and ignores frame partition and pauses',()=>{
 const make=()=>{const s=createAttempt({mode:'castle',goal:30,text:'a'});s.castleStage='quicksand';return s;};
 const a=make(), b=make();
 advanceTime(a,4); for(let i=0;i<40;i++)advanceTime(b,.1);
 assert.ok(Math.abs(a.sandDepth-b.sandDepth)<1e-9);assert.equal(a.sandDepth,12);
 typeKey(a,{key:'a'});typeKey(b,{key:'a'});
 advanceTime(a,.2);for(let i=0;i<10;i++)advanceTime(b,.02);
 assert.ok(Math.abs(a.sandDepth-b.sandDepth)<1e-9);assert.ok(a.sandDepth<12);
 pause(a);const held=structuredClone(a);advanceTime(a,100);assert.deepEqual(a,held);
 resume(a);advanceTime(a,20);assert.equal(a.sandDepth,22);assert.equal(a.status,'running');
 assert.equal(a.correct,1);assert.equal(a.errors,0);
 const weak=make();for(let i=0;i<10;i++){typeKey(weak,{key:'a'});advanceTime(weak,1.2);}assert.ok(weak.sandDepth>10);
 const reduced=createAttempt({mode:'castle',reducedMotion:true,text:'a',goal:30});reduced.castleStage='quicksand';advanceTime(reduced,12);assert.equal(reduced.sandDepth,22);
 for(let i=0;i<30;i++)typeKey(reduced,{key:'a'});assert.equal(reduced.sandDepth,0);advanceTime(reduced,60);assert.equal(reduced.sandDepth,0);
});
test('storage handles reload, corrupt data, invalid settings, and unavailable storage',()=>{
 let raw;const storage={getItem:()=>raw,setItem:(_,v)=>raw=v};const p=defaults();p.name='Ada';p.character='Luigi';p.settings.duration=10;
 assert.equal(saveProfile(p,storage),true);assert.equal(loadProfile(storage).name,'Ada');assert.equal(loadProfile(storage).settings.duration,10);
 raw='{';assert.deepEqual(loadProfile(storage),defaults());raw=JSON.stringify({version:1,settings:{duration:-1,goal:'5',group:99}});assert.deepEqual(loadProfile(storage),defaults());
 assert.deepEqual(loadProfile(undefined),defaults());assert.equal(saveProfile(p,undefined),false);
});
