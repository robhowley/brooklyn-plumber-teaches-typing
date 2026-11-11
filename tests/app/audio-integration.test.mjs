import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Session,editStudent} from '../../app/session.mjs';
import {SourceAudio} from '../../recovered/audio/audio.mjs';
import {newStudent} from '../../recovered/control/student.mjs';
import {skipStartup} from './source-path.mjs';
const data=JSON.parse(readFileSync(new URL('../../app/data.json',import.meta.url)));
function make() {
  const s=skipStartup(new Session(data,{bytes:editStudent(newStudent('Ada'),{goal:30}),seed:1}));
  const requests=[];
  s.audioHandler=r=>{requests.push({...r});return {status:r.type==='speech'?'pending':'unsupported-silent'};};
  return {s,requests};
}
test('supplied CNF reaches source owner, digital VOC not speculative RS default',()=>{
  assert.deepEqual(Object.fromEntries(['musicDevice','effectsDevice','speechDevice','options'].map(k=>[k,data.audio.config[k]])),
    {musicDevice:4,effectsDevice:4,speechDevice:3,options:7});
  const a=new SourceAudio({...data.audio.config,available:{music:true,effects:true,speech:true}});
  assert.equal(a.request({type:'speech',name:'ready'}).actions[0].resource,'READY.VOC');
  assert.equal(data.audio.unsupported.length,58);
  for(const clip of Object.values(data.audio.clips))assert.equal(Buffer.from(clip.pcm,'base64').length,clip.sampleCount);
});
test('Water Ready holds lastInput/music/RNG but not already-started elapsed timer, then resets inactivity at return',()=>{
  const {s,requests}=make();s.start(100,2,1000);
  assert.equal(s.water.phase,'ready');assert.equal(s.water.timer.running,true);assert.equal(s.water.lastInput,undefined);
  assert.equal(requests.at(-1).name,'ready');const seed=s.seed;
  s.enqueue(65);s.step(65,130,1002);assert.equal(s.seed,seed);assert.equal(s.water.stats.attempts,0);assert.equal(s.input.pending(),false);
  s.completeAudio([{status:'ended'}],141,1003);
  assert.equal(s.water.lastInput,1003);assert.equal(requests.at(-1).id,3);
  const target=s.water.window[s.water.targetIndex];s.step(target,142,1003);
  assert.equal(s.water.stats.attempts,1);assert.equal(s.water.stats.correct,1);assert.equal(s.water.timer.ticks,42);
  // Strict >20 since Ready RETURN. Input case is not normalized by audio.
  s.step(0,150,1023);assert.equal(s.water.failed,false);
  s.step(0,151,1024);assert.equal(s.water.failed,true);assert.equal(s.water.timer.running,false);
});
test('every speech omission releases Water immediately with no invented duration or double request',()=>{
  for(const status of ['locked','denied','muted','suspended','missing','failed','blur']) {
    const {s,requests}=make();s.start(10,2,100);s.completeAudio([{status}],10,100);
    assert.equal(s.water.phase,'active');assert.equal(s.water.lastInput,100);assert.equal(s.water.timer.ticks,0);
    assert.equal(requests.filter(r=>r.name==='ready').length,1);assert.equal(s.audioLog.findLast(e=>e.request.name==='ready').status,'omitted');
    s.step(0,11,100);assert.equal(s.water.timer.ticks,1);
  }
});
test('Castle first Ready suspends at operation tail before music/RNG/movement; Outside before ordinary loop',()=>{
  for(const mode of [1,3]) {
    const {s,requests}=make();s.start(10,mode,100);
    if(mode===3)s.step(0,11,100);
    assert.equal(requests.at(-1).name,'ready');const seed=s.seed,x=mode===1?s.outdoor.x:s.castle.x;
    s.step(65,50,103);assert.equal(s.seed,seed);assert.equal(mode===1?s.outdoor.x:s.castle.x,x);
    s.completeAudio([{status:'ended'}],51,103);assert.equal(requests.at(-1).id,mode===1?1:4);
    assert.equal(s.input.pending(),false);s.step(0,52,103);assert.equal(s.audioPending,null);
  }
});
test('welcome and results gate their source pumps and input initialization',()=>{
  const {s,requests}=make();s.menuWelcomed=false;s.enterMenu(20);
  assert.equal(s.menuIdle,null);const seed=s.seed;s.menuStep(100);assert.equal(s.seed,seed);
  s.completeAudio([{status:'locked'}],100,100);assert.ok(s.menuIdle);
  s.start(100,1,100);s.completeAudio([{status:'ended'}],100,100);
  s.result={wpm:0};s.outdoor.aborted=false;s.student[47]=1;
  // Low goal permits the recovered result speech predicate.
  const view=new DataView(s.student.buffer);view.setInt16(23,5,true);view.setInt16(21,5,true);s.enterResults();
  assert.equal(requests.at(-1).name,'toobad');assert.deepEqual(s.resultEffects.map(e=>e.type),['result-stats']);
  assert.equal(s.next(101),null);s.completeAudio([{status:'missing'}],101,100);
  assert.ok(s.resultEffects.some(e=>e.type==='flush-input'));
});
test('all worlds and Demo consume disabled Alt-X without abort or counted attempt',()=>{
  for(const demo of [false,true])for(const mode of [1,2,3,4]) {
    const s=skipStartup(new Session(data,{seed:1}));if(demo)s.selectDemo();s.start(0,mode,100);
    if(mode===3)s.step(0,1,100);
    s.step(0x12d,2,101);assert.equal(s.active,true);assert.equal(!!s.activity.aborted,false);
    assert.equal(s.activity.attempts,0);assert.equal(s.effects.some(e=>e.type.includes('quit')),false);
    if(mode===2)assert.equal(s.water.lastInput,101);
  }
});
test('Practice exact case sends one effect per accepted key and finger hints never request speech',()=>{
  const {s,requests}=make();s.start(0,4,100);requests.length=0;
  const expected=s.practice.rows[33];s.step(expected===65?66:65,1,100);s.step(expected,2,100);
  assert.deepEqual(requests,[{type:'effect',id:11},{type:'effect',id:1}]);
  assert.equal(s.practice.errors,1);assert.equal(s.practice.correct,1);
});
