import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttempt, typeKey, advanceTime, pause, resume, stats, score, result, KEY_GROUPS, MODES, fingerHint, RULESET } from '../src/engine.js';

test('literal 182/tick vectors use integer net speed and floor accuracy', () => {
  for (const [c,e,t,w,a] of [[0,0,0,0,0],[30,0,1092,5,100],[29,0,1092,4,100],[90,10,1092,13,90],[89,11,1092,13,89],[2,3,182,0,40],[1,0,1,182,100],[30,0,0,0,100],[30,0,-1,0,100]]) {
    assert.deepEqual(score(c,e,t), { attempted: c+e, wpm:w, accuracy:a });
  }
});
test('safe counts avoid intermediate overflow and reject invalid/unsafe state', () => {
  const max = Number.MAX_SAFE_INTEGER;
  assert.deepEqual(score(max,0,182), { attempted:max, wpm:max, accuracy:100 });
  assert.equal(score(max-1,1,182).accuracy,99);
  for (const args of [[max,1,182],[max,0,1],[-1,0,1],[1.1,0,1],[NaN,0,1],[0,Infinity,1],[0,0,1.2]]) assert.throws(() => score(...args), RangeError);
  for (const options of [{goal:1.5},{group:6},{mode:'bad'},{duration:NaN},{duration:0}]) assert.throws(() => createAttempt(options));
  const s=createAttempt({text:'a',reducedMotion:true});
  for (const delta of [-1,NaN,Infinity]) assert.throws(() => advanceTime(s,delta));
  s.correct=max; assert.throws(() => typeKey(s,{key:'a'})); assert.equal(s.correct,max);
  s.elapsed=-1; assert.throws(() => stats(s));
});
test('outdoor accepts ASCII case only; exact other modes, printable input and hints', () => {
  for (const mode of Object.keys(MODES)) {
    const s=createAttempt({mode,text:'a A!',reducedMotion:true});
    for (const key of ['Shift','Backspace','Enter','ArrowLeft','é','ſ','\t']) assert.equal(typeKey(s,{key}),'ignored');
    for (const flag of ['repeat','isComposing','ctrlKey','metaKey','altKey']) assert.equal(typeKey(s,{key:'a',[flag]:true}),'ignored');
    assert.equal(typeKey(s,{key:'A'}),mode==='outdoor'?'correct':'error');
    if(mode!=='outdoor') assert.equal(typeKey(s,{key:'a'}),'correct');
    for(const key of ' A!') assert.equal(typeKey(s,{key}),'correct');
    assert.equal(s.correct,4);
  }
  assert.match(fingerHint('A'),/Shift/); assert.doesNotMatch(fingerHint('A','outdoor'),/Shift/);
  assert.match(fingerHint('!','outdoor'),/Shift/); assert.match(fingerHint(' '),/thumb/);
});
test('lesson metadata and independent record cursor survive wrapping; retry restarts', () => {
  const lesson={text:'a B ',source:'fixture',label:'Test fixture',corpusVersion:'fixture-2',requiredKeys:' Ba',records:[{start:0,end:2,offset:99},{start:2,end:4,offset:400}]};
  const s=createAttempt({mode:'underwater',lesson,reducedMotion:true});
  lesson.records[0].offset=0; assert.equal(s.lesson.records[0].offset,99);
  assert.equal(typeKey(s,{key:'A'}),'error'); assert.deepEqual(s.cursor,{recordIndex:0,characterIndex:0});
  typeKey(s,{key:'a'}); assert.deepEqual(s.cursor,{recordIndex:0,characterIndex:1});
  typeKey(s,{key:' '}); assert.deepEqual(s.cursor,{recordIndex:1,characterIndex:0});
  for(const key of 'B a B ') typeKey(s,{key});
  assert.equal(s.correct,8); assert.deepEqual(s.cursor,{recordIndex:0,characterIndex:0});
  assert.deepEqual(createAttempt({lesson}).cursor,{recordIndex:0,characterIndex:0});
  advanceTime(s,300); assert.equal(result(s).corpusVersion,'fixture-2'); assert.equal(result(s).source,'fixture');
  assert.throws(()=>createAttempt({lesson:{...lesson,text:'wrong'}}));
  for(const text of ['', 'é', 'a\n']) assert.throws(()=>createAttempt({text}));
});
test('active cumulative clock partitions, pauses, and immutable stats/results reads', () => {
  const a=createAttempt({text:'a'}),b=createAttempt({text:'a'});
  advanceTime(a,.06); advanceTime(b,.03);advanceTime(b,.03); assert.equal(stats(a).ticks,1);assert.equal(stats(b).ticks,1);
  const c=createAttempt({text:'a'}),d=createAttempt({text:'a'});
  advanceTime(c,60);for(let i=0;i<600;i++)advanceTime(d,.1);
  assert.equal(stats(c).ticks,1092);assert.equal(stats(d).ticks,1092);assert.equal(c.elapsed,d.elapsed);
  pause(c);const snapshot=structuredClone(c);advanceTime(c,100);typeKey(c,{key:'a'});stats(c);result(c);assert.deepEqual(c,snapshot);
  resume(c);advanceTime(c,1);assert.equal(c.elapsed,61);
  const e=createAttempt();advanceTime(e,1);pause(e);advanceTime(e,100);resume(e);advanceTime(e,1);assert.equal(stats(e).ticks,36);
});
test('timeout only, authoritative elapsed/reason and positive-attempt 90% eligibility', () => {
  for(const [correct,errors,goal,passed] of [[0,0,5,false],[30,0,5,true],[29,0,5,false],[90,10,13,true],[89,11,13,false]]) {
    const s=createAttempt({duration:60,goal,text:'a',reducedMotion:true});
    for(let i=0;i<correct;i++)typeKey(s,{key:'a'});for(let i=0;i<errors;i++)typeKey(s,{key:'b'});
    advanceTime(s,1);assert.equal(result(s).passed,false);assert.equal(s.terminalReason,null);
    advanceTime(s,999);const r=result(s);assert.equal(r.elapsed,60);assert.equal(r.duration,60);assert.equal(r.terminalReason,'timeout');assert.equal(r.ruleset,RULESET);assert.equal(r.passed,passed);
    assert.equal(typeKey(s,{key:'a'}),'ignored');const frozen=structuredClone(s);advanceTime(s,2);assert.deepEqual(s,frozen);
  }
});
test('all early deaths disabled, castle pipe freezes all active clocks', () => {
  for(const mode of ['underwater','castle']) {
    const s=createAttempt({mode,text:'a'});for(let i=0;i<100;i++)typeKey(s,{key:'b'});
    advanceTime(s,21);assert.equal(s.status,'running');assert.equal(s.failure,false);
  }
  const s=createAttempt({mode:'castle',text:'a'});
  for(const stage of ['quicksand','thwomps']) {
    for(let i=0;i<40;i++)typeKey(s,{key:'a'});
    assert.equal(s.castleStage,stage);assert.deepEqual(s.pipe,{stage:'inside',progress:.5});
    const frozen=structuredClone(s);advanceTime(s,100);assert.equal(typeKey(s,{key:'a'}),'ignored');assert.deepEqual(s,frozen);resume(s);
  }
});
test('quicksand feedback respects partitions and reduced motion without terminal failure', () => {
  const make=()=>{const s=createAttempt({mode:'castle',goal:30,text:'a'});s.castleStage='quicksand';return s;};
  const a=make(),b=make();advanceTime(a,4);for(let i=0;i<40;i++)advanceTime(b,.1);
  assert.ok(Math.abs(a.sandDepth-b.sandDepth)<1e-9);assert.equal(a.sandDepth,12);
  typeKey(a,{key:'a'});typeKey(b,{key:'a'});advanceTime(a,.2);for(let i=0;i<10;i++)advanceTime(b,.02);
  assert.ok(Math.abs(a.sandDepth-b.sandDepth)<1e-9);assert.ok(a.sandDepth<12);
  advanceTime(a,21);assert.equal(a.sandDepth,22);assert.equal(a.status,'running');
  const reduced=createAttempt({mode:'castle',reducedMotion:true,text:'a'});advanceTime(reduced,30);assert.equal(reduced.sandDepth,22);
});
test('mode defaults, overrides, original default and explicit generated choice', () => {
  for(const [mode,config] of Object.entries(MODES)) {assert.equal(createAttempt({mode}).duration,config.duration);assert.equal(createAttempt({mode,duration:2}).duration,2);}
  KEY_GROUPS.forEach((g,group)=>{for(const mode of Object.keys(MODES)){
    const s=createAttempt({mode,group,content:'generated'});
    assert.equal(s.text,createAttempt({mode,group,content:'generated'}).text);
    assert.ok([...s.text].every(k=>g.keys.includes(k)));
    assert.equal(s.lesson.source,'generated');
    assert.equal(s.lesson.label,'Generated practice, not original lesson text');
  }});
  for(const key of ',./')assert.ok(KEY_GROUPS[2].keys.includes(key));
  for(const key of '@#$%^&*+<=>[]_{}')assert.ok(KEY_GROUPS[4].keys.includes(key));
  assert.equal(createAttempt().lesson.source,'original');
});
