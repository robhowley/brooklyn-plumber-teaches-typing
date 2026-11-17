import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Session,editStudent} from '../../app/session.mjs';
import {newStudent} from '../../recovered/control/student.mjs';
import {createMenu,menuInput} from '../../recovered/control/menu.mjs';
import {SourceAudio} from '../../recovered/audio/audio.mjs';
import {skipStartup,finishCelebration} from './source-path.mjs';
const data=JSON.parse(readFileSync(new URL('../../app/data.json',import.meta.url)));
const tables=[null,[7,12,15,22,24,30,33,36,38,46,51],[3,8,13,20,21,25,28,32,35,41,46],[4,9,12,19,21,27,30,33,35,43,48]];
const callbacks=[null,'0x1425a','0x17ebb','0xde2e'];
const make=(options={})=>skipStartup(new Session(data,{seed:1,bytes:editStudent(newStudent('Ada'),{goal:30,...options})}));
const requests=s=>s.audioLog.map(e=>e.request);
const stop=file=>({type:'music-stop',file});

// All FILE offsets below: MarioTea/MARIO/MARIO.EXE, pinned hash asserted here.
test('bonus callback entries, one-based tables and silent resource identities match pinned inert bytes',()=>{
 const exe=readFileSync(new URL('../../assets/original/raw/MarioTea/MARIO/MARIO.EXE.data',import.meta.url));
 assert.equal(createHash('sha256').update(exe).digest('hex'),'6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e');
 assert.equal(exe[0x14259],0xcb); // preceding retf, not the Outside callback
 assert.equal(exe.subarray(0x81df,0x81e1).toString('hex'),'33ff'); // zero-based counter
 assert.equal(exe.subarray(0x8356,0x835a).toString('hex'),'57ff5e0e');assert.equal(exe[0x837a],0x47); // callback, then increment
 assert.equal(exe.subarray(0x119f9,0x11a02).toString('hex'),'b80a00509a8d0c3415'); // invalid10
 assert.equal(exe.subarray(0x149a8,0x149c1).toString('hex'),'f7066d5201007512f70673520100740ab80800509a8d0c3415'); // left-bit rise, then8
 for(const offset of [0x13e1b,0xde0f,0xde20])assert.equal(exe.subarray(offset,offset+5).toString('hex'),'9a09093415'); // music-only stop
 for(const [mode,table,increment] of [[1,0x219e7,0x1426d],[2,0x21d29,0x17ece],[3,0x21430,0xde41]]) {
  assert.deepEqual([...exe.subarray(table,table+11)],tables[mode]);
  assert.equal(exe[Number(callbacks[mode])],0x55);
  assert.deepEqual([...exe.subarray(increment,increment+6)],[0x47,0x9a,0x65,0x03,0x5c,0x11]); // inc di; wait twice
 }
 for(const [name,sha256] of Object.entries({
  'SFX07.ADL':'ca0d223917fcb71807f8fcdddcb29a292e64c27b5f96696cf946c2ed4ca66d70',
  'SFX08.ADL':'b335993e9bd8c3bce8b2993c72032ee70ba18d8b65f70d313c6f61d6f6a87542',
  'SFX10.ADL':'0784a758b20baec8f7080f323f998cec4015372b0a3802be2bdfd4e0070fc4e9',
 })) {
  const bytes=readFileSync(new URL(`../../assets/original/raw/MarioTea/MARIO/${name}.data`,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),sha256);
  assert.deepEqual(data.audio.unsupported.find(r=>r.member===`MarioTea/MARIO/${name}`),{
   member:`MarioTea/MARIO/${name}`,size:bytes.length,sha256,status:'unsupported-silent',
  });
 }
});

for(const mode of [1,2,3])for(const character of [1,2,3])test(`world${mode} character${character}: effect7 follows completion, never a neighboring packet or first wait`,()=>{
 const s=make({character});s.start(0,mode,100);
 let tick;
 if(mode===1) {
  s.bonus.mode=2;s.bonus.code=33;s.bonus.countdown=30;s.step(33,1,100);tick=1;
 } else if(mode===2) {
  s.water.bonus.mode=2;s.water.bonus.x=50;s.water.bonus.y=120;s.step(s.water.bonus.code,0,100);tick=0;
 } else {
  s.castle.bonus.mode=2;s.castle.bonus.y=90;s.step(s.castle.bonus.code,1,100);tick=1;
 }
 const movie=()=>mode===1?s.cinematic:mode===2?s.waterMovie:s.castleMovie;
 const playback=mode===1?data.bonusAnimations['mlp'[character-1]]:mode===2?data.water.animations['mlp'[character-1]]:data.castle.animations['mlp'[character-1]];
 const metadata=mode===1?playback.playback:mode===2?data.water.playback:data.castle.playback;
 assert.equal(metadata.callbackFileOffset,callbacks[mode]);assert.deepEqual(metadata.sound7OneBasedFrames,tables[mode]);
 assert.equal(movie().frame,0);
 const trace=[];
 s.audioHandler=request=>{trace.push({request,completedPacket:movie()?.frame});return {status:'unsupported-silent'};};
 for(let frame=0;frame<playback.frames.length;frame++) {
  assert.equal(movie().frame,frame);
  trace.length=0;
  s.step(0,tick,100);assert.deepEqual(trace,[]); // same sample as preceding completion
  s.step(0,++tick,100);assert.equal(movie().frame,frame);assert.deepEqual(trace,[]);
  s.step(0,tick,100);assert.equal(movie().frame,frame);assert.deepEqual(trace,[]); // first wait cannot count twice
  const events=s.step(0,++tick,100);
  assert.deepEqual(trace,tables[mode].includes(frame+1)?[{
   request:{type:'effect',id:7,file:callbacks[mode]},completedPacket:frame,
  }]:[],`completed packet ${frame}, including early/late neighbors`);
  if(frame+1<playback.frames.length) {
   assert.equal(movie().frame,frame+1);
   if(mode!==1)assert.deepEqual(events.filter(e=>e.type===`${mode===2?'water':'castle'}-packet`),[{type:`${mode===2?'water':'castle'}-packet`,frame:frame+1}]);
  } else assert.equal(movie(),null); // final packet waits and callback run before returning
 }
 assert.equal(s.active,true);assert.equal(s.audioLog.every(e=>e.status==='unsupported-silent'),true);
});

test('invalid main keys request ordinary10 once; localized, recognized no-op and pointer misses do not',()=>{
 const s=make();
 for(const options of [0,1,2,3,4,5,6,7]) {
  const audio=new SourceAudio({...data.audio.config,options,available:{music:true,effects:true,speech:true}});
  for(const key of [90,122,0x13d,8]) {
   const effects=menuInput(createMenu({options}),{key},s.profile).effects;
   assert.deepEqual(effects,[{type:'sound',id:10,file:0x119fd}]);
   const result=audio.request({type:'effect',id:effects[0].id});
   assert.equal(result.status,options&2?'requested':'disabled');
   assert.equal(result.actions.at(-1)?.id,options&2?10:undefined);
  }
  assert.equal(audio.request({type:'effect',id:11}).status,'requested'); // wrong-key bypass is not rejection10
 }
 for(const event of [{key:0},{key:27},{key:13},{key:53},{key:69},{key:54},{key:0x132},{key:90,messages:{10008:'Zbout'}},{pointer:{x:1,y:100},front:new Uint8Array(64000)}]) {
  const effects=menuInput(createMenu(),event,{...s.profile,profilePresent:false,demo:true}).effects;
  assert.equal(effects.some(e=>e.type==='sound'),false,JSON.stringify(event));
 }
});

for(const mode of [1,2,3,4])test(`world${mode}: Main and Results entry/abort request sequences retain separate wrapper stops`,()=>{
 const s=make();s.audioLog=[];s.start(0,mode,100);
 if(mode===3)s.step(0,1,100);
 const own=mode===1?[stop(0x13dd7),{type:'speech',name:'ready',file:0x13e04},{type:'music',id:1,file:0x13e0d}]:
  mode===2?[stop(0x17e17),{type:'speech',name:'ready',file:0x176c7},{type:'music',id:3,file:0x176d0}]:
  mode===3?[stop(0xde0f),{type:'speech',name:'ready',file:0xc060},{type:'music',id:4}]:[];
 assert.deepEqual(requests(s),[stop(0x11bb1),...own]);s.audioLog=[];
 for(let t=2;s.active&&t<20;t++)s.step(27,t,100);
 assert.equal(s.screen,'results');assert.deepEqual(requests(s),mode===1?[stop(0x13e1b)]:mode===2?[stop(0x17e9d)]:mode===3?[{type:'music-stop'}]:[]);
 s.audioLog=[];s.start(20,mode,100);if(mode===3)s.step(0,21,100);
 assert.deepEqual(requests(s),own); // Results does not borrow Main's stop
});

for(const from of ['menu','results'])test(`Castle Next from ${from} stops at its own entry before initialization/Ready`,()=>{
 const s=make();
 if(from==='results') {s.start(0,1,100);s.step(27,1,100);assert.equal(s.screen,'results');}
 const before=s.castle;const trace=[];
 s.audioHandler=request=>{trace.push(request);if(request.file===0xde0f)assert.equal(s.castle,before);return {status:'unsupported-silent'};};
 assert.equal(s.next(10).mode,3);s.step(0,11,100);
 assert.deepEqual(trace,[...(from==='menu'?[stop(0x11bb1)]:[]),stop(0xde0f),{type:'speech',name:'ready',file:0xc060},{type:'music',id:4}]);
});

for(const reason of ['abort','failed-timeout','jump-timeout','celebration','demo'])test(`Outside ${reason}: exit stop follows presentation and precedes Results or Demo menu audio`,()=>{
 const s=make({goal:5,minutes:1});if(reason==='demo')s.selectDemo();s.start(0,1,100);s.audioLog=[];
 if(reason==='abort'||reason==='demo')s.step(27,1,100);
 else {
  if(reason==='celebration') {s.outdoor.correct=100;s.outdoor.attempts=100;}
  if(reason==='jump-timeout') {s.outdoor.mode=1;s.outdoor.jumpIndex=0;}
  s.step(0,1092,160); // real timeout, not an abort flag or direct Results call
  if(reason==='jump-timeout') {
   assert.equal(s.active,true);assert.equal(s.outdoor.mode,2);
   assert.deepEqual(requests(s),[{type:'effect',id:2,file:0x13802}]); // no early stop
   for(let t=1093;s.active&&t<1110;t++)s.step(0,t,160);
  }
  if(reason==='celebration') {
   assert.equal(s.screen,'celebration');assert.deepEqual(requests(s),[]);
   finishCelebration(s);assert.equal(s.screen,'results');
  }
 }
 if(reason==='demo') {
  assert.equal(s.screen,'menu');assert.deepEqual(requests(s),[stop(0x13e1b),stop(0x10d7d),{type:'music',id:2,file:0x10d99}]);
 } else {
  assert.equal(s.screen,'results');
  assert.deepEqual(requests(s),[...(reason==='jump-timeout'?Array.from({length:2},()=>({type:'effect',id:2,file:0x13802})):[]),stop(0x13e1b),...(reason==='abort'?[]:[{type:'speech',name:reason==='celebration'?'congrats':'toobad',file:reason==='celebration'?0x165fc:0x16603}])]);
 }
});
