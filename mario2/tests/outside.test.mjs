import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createOutside, createOutsideReader, outsideCanSpawn, outsideTarget, outsideMovement} from '../outside.js';
import {typingSpeed} from '../typing.js';

// Hand-derived vectors from WINMARIO.EXE SHA256
// 39a4fb53384afbfec13063c2f4c67d51013b1f8ea494788c88f1ac6c12f47f22,
// FILE 0x33a4, 0x190ee..0x195e3, 0x14e02..0x150aa. Expected values
// are not computed by a second invocation of the implementation.
const animation = JSON.parse(readFileSync(new URL('../dist/presentation.json', import.meta.url))).outsideAnimation;
// Independent commitments to the complete original signed-word ranges, not
// copied game arrays or expectations generated from the production pins.
test('all extracted animation words match independent source hashes', () => {
  const vectors = [
    [animation.jumpY, 12, 'cad78266f3bbae6788970e5bc870e06b71f545fa8c53fc0b985bac7816671857'], // FILE0x2069c
    [animation.idleLength, 3, 'fa9748ee69faffc31fc09f7fe60a411e0afaff560a75faadd2b28d0b8c858b71'], // FILE0x207da
    [animation.idleThresholds[0], 47, '6111a836bcc18305ba78b96f9b2a76a8993bedb824116c4f522ade2c017c5f85'], // FILE0x206b8
    [animation.idleThresholds[1], 51, 'a227c64fc66b4b8dac179f82bab3f2b5319bb4d66c6fbb41559f797d173c4597'], // FILE0x20774
    [animation.idleThresholds[2], 47, '20524acf41c279b48c6e6b9c49d91f0ce66c49be9a41b61398df342dc4830dc5'], // FILE0x20716
  ];
  for (const [values, count, hash] of vectors) {
    assert.equal(values.length, count);
    const raw = Buffer.alloc(count * 2);
    values.forEach((n, i) => raw.writeInt16LE(n, i * 2));
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash);
  }
});
const lesson = {bytes: [97, 98, 99]};
function rng(values = []) {
  let calls = 0;
  return {next() { return values[calls++] ?? 1; }, get calls() { return calls; }};
}
function scene(overrides = {}) {
  return createOutside({lesson, animation, character: 0, keyset: 0, durationSeconds: 600, random: rng(), nowMs: 0, ...overrides});
}
const draws = result => result.effects.filter(e => e.type === 'draw').map(e => e.operation);

test('entry effects preserve interval, HUD, audio preparation/resume, ticking order',()=>{
  const s=scene();
  assert.deepEqual(s.entryEffects,[{type:'interval',milliseconds:50},{type:'draw',operation:{type:'hud'}},
    {type:'audio',selector:11,operation:1},{type:'audio',selector:16,operation:1},
    {type:'audio',selector:2,operation:3},{type:'ticking',value:true}]);
  assert.deepEqual(s.reenter({lesson,durationSeconds:600,nowMs:1}).effects,s.entryEffects);
});

test('Outside reader masks, skips only delimiters, wraps and preserves controls', () => {
  const r = createOutsideReader({bytes: [0xe1,9,13,10,32,126,96,254,98]});
  assert.deepEqual(Array.from({length: 7}, () => r.next()), [97,9,13,10,32,98,97]);
  assert.throws(() => createOutsideReader({bytes: [126,96]}), /lesson/);
  assert.throws(() => scene({lesson: {bytes: [32,96,126]}}), /no target/);
});

test('spawn distance unsigned boundary and signed minimum, ties remain stable', () => {
  assert.equal(outsideCanSpawn([{x: 250, offsetX: 30}]), true);
  assert.equal(outsideCanSpawn([{x: 251, offsetX: 30}]), false);
  assert.equal(outsideCanSpawn([{x: -1, offsetX: 0}]), false);
  assert.equal(outsideTarget([{x: 320,countdown: 0}]), null);
  assert.equal(outsideTarget([{x: 20,countdown: 1}, {x: 20,countdown: 0}, {x: 20,countdown: 0}]), 1);
  assert.equal(outsideTarget([{x: 0x8000,countdown: 0}, {x: -1,countdown: 0}]), 0);
});

test('actor arithmetic preserves cold first pass, equality, clamping and signed overflow', () => {
  assert.deepEqual(outsideMovement(20,0,0,1,0,999), {target: -11, movement: -5, x: 15, scrollSpeed: 0});
  assert.deepEqual(outsideMovement(10,20,0,0,0,0), {target: 10, movement: 0, x: 10, scrollSpeed: 0});
  assert.deepEqual(outsideMovement(0,-1,0,1,0,0), {target: -12, movement: 0, x: 0, scrollSpeed: 9});
  assert.equal(outsideMovement(0,320,0,0,0,0).movement, 8);
  assert.equal(outsideMovement(32767,0,0,0,1,-32768).movement, -2);
});

for (let character = 0; character < 3; character++) for (let keyset = 0; keyset < 5; keyset++) {
  test(`cold first delivery character${character}/keyset${keyset}, source same-pass append vector`, () => {
    const random = rng(); const s = scene({character,keyset,random});
    assert.equal(random.calls, 5);
    const initial = s.snapshot(); assert.equal(initial.objects.length, 10);
    assert.equal(initial.specialCountdown, 240);
    const r = s.acceptedUpdate(0);
    assert.equal(random.calls, 6);
    assert.equal(r.view.specialCountdown, 238);
    assert.equal(r.view.actor.x, 15); assert.equal(r.view.scrollSpeed, 0);
    assert.deepEqual(r.view.actor.sprite, {selector: 16 + character, frame: 0});
    assert.equal(r.view.cursor.x,299); assert.equal(r.view.cursor.y,72);
    assert.equal(r.view.slots[0].x,299); assert.equal(r.view.slots[0].type,201);
    assert.equal(r.view.expectedByte,97); assert.equal(r.view.samplePhase,1);
    const calls = r.effects.filter(e => e.type === 'callback').map(e => e.kind);
    assert.deepEqual(calls, ['spawner','ground','ground','actor','cursor','special','label','finger','target','label']);
    const operations = draws(r);
    assert.deepEqual(operations[0], {type:'restore',top:0,bottom:189});
    const hint = operations.findIndex(e => e.type === 'glyph');
    assert.equal(operations[hint-1].object.kind,'hand');
    assert.equal(operations[hint+1].object.kind,'finger');
    assert.equal(operations.some(e => e.object?.kind === 'special'),false);
    assert.equal(operations.at(-1).object.kind,'label');
    assert.equal(s.acceptedUpdate(0).view.slots.filter(Boolean).length,1);
  });
}

test('RNG consumes x/y/unused countdown, rejected keys, override, spawn parity in order', () => {
  const random = rng([249,29,29,6,9,11,14,89,0]);
  const s = scene({random});
  assert.equal(random.calls,8);
  assert.deepEqual([s.snapshot().specialByte,s.snapshot().specialCountdown], [47,1560]);
  const r = s.acceptedUpdate(0);
  assert.equal(random.calls,9);
  assert.deepEqual([r.view.slots[0].type,r.view.slots[0].x,r.view.slots[0].offsetX], [200,320,30]);
});

test('literal spaces skipped, tab/CR/LF remain targets and control errors do not enter histogram', () => {
  const s = scene({lesson:{bytes:[32,96,126,9,13,10]}});
  s.acceptedUpdate(0);
  assert.equal(s.snapshot().expectedByte,9);
  const r = s.keyDown(120);
  assert.deepEqual(r.view.counters,{total:1,errors:1,speed:0});
  assert.equal(r.view.histogram.reduce((a,b) => a+b),0);
  assert.equal(draws(r).some(o=>o.type==='glyph'),false);
});

test('expected hint gate suppresses controls only, labels survive and wrong/correct input still counts',()=>{
  for(let byte=0;byte<32;byte++) {
    const s=scene({lesson:{bytes:[byte]}});
    const r=s.acceptedUpdate(0);
    assert.equal(draws(r).some(o=>o.type==='glyph'),false, String(byte));
    assert.ok(draws(r).some(o=>o.object?.kind==='label' && o.object.byte===byte));
    assert.equal(draws(s.keyDown(120)).some(o=>o.type==='glyph'),false);
    if(byte) assert.equal(draws(s.keyDown(byte)).some(o=>o.type==='glyph'),false);
  }
  for(const byte of [33,97,127]) {
    const s=scene({lesson:{bytes:[byte]}});s.acceptedUpdate(0);
    assert.equal(draws(s.keyDown(120)).filter(o=>o.type==='glyph').length,2);
  }
});

test('control expected hint does not clear the retained printable finger',()=>{
  const s=scene({lesson:{bytes:[97,9]}});
  s.acceptedUpdate(0);s.keyDown(97);
  let r;
  for(let i=0;i<300;i++) {
    r=s.acceptedUpdate(0);
    if(r.view.expectedByte===9)break;
  }
  assert.equal(r.view.expectedByte,9);
  assert.equal(r.view.objects.find(o=>o.kind==='finger').expectedByte,97);
  assert.equal(draws(r).some(o=>o.type==='glyph'),false);
  assert.equal(draws(s.keyDown(120)).some(o=>o.type==='glyph'),false);
});

test('correct hit starts jump, does not rescan target, retirement draws and appends four debris callbacks', () => {
  const s = scene(); s.acceptedUpdate(0);
  const hit = s.keyDown(97);
  assert.equal(hit.view.slots[0].countdown,6); assert.equal(hit.view.jumpPhase,1);
  assert.equal(hit.view.expectedIndex,0); assert.equal(hit.view.cursor.target,10);
  assert.equal(s.acceptedUpdate(0).view.slots[0].countdown,5);
  let r; for (let i=0;i<5;i++) r=s.acceptedUpdate(0);
  const retired = draws(r).find(e => e.object?.kind === 'target' && e.object.status === 3);
  assert.ok(retired); assert.equal(retired.object.countdown,0);
  assert.equal(r.effects.filter(e => e.type === 'callback' && e.kind === 'debris').length,4);
  assert.ok(r.effects.some(e => e.type === 'audio' && e.selector === 11 && e.operation === 2));
  const frames = [r.view.actor.y];
  for(let i=0;i<6;i++) frames.push(s.acceptedUpdate(0).view.actor.y);
  assert.equal(s.snapshot().jumpPhase,0);
});

test('type200 alternate sprite, one sound gate and hidden label, retirement frame', () => {
  const s=scene({random:rng([0,0,0,0,0,0])});
  for(let i=0;i<3;i++)s.acceptedUpdate(0); // x320 is initially ineligible
  s.keyDown(97);
  let r=s.acceptedUpdate(0);
  assert.equal(r.view.slots[0].countdown,5);
  assert.deepEqual(r.view.slots[0].sprite,{selector:11,frame:1});
  assert.equal(r.effects.filter(e=>e.type==='audio' && e.selector===16).length,1);
  r=s.acceptedUpdate(0);
  assert.equal(r.effects.filter(e=>e.type==='audio' && e.selector===16).length,0);
  for(let i=0;i<4;i++)r=s.acceptedUpdate(0);
  assert.ok(draws(r).some(e=>e.object?.type===200 && e.object.status===3));
});

test('timer phase4 samples after scene, caps2 and rebases actual sample, expiry deferred', () => {
  const s=scene({nowMs:100000,durationSeconds:1,retained:{samplePhase:4}});
  const r=s.acceptedUpdate(107000);
  assert.deepEqual([r.view.elapsed,r.view.inactivity,r.view.samplePhase,r.view.sampledClock],[2,2,0,107]);
  assert.equal(r.view.pendingFinish,true); assert.equal(r.view.running,true);
  assert.equal(r.effects.at(-1).operation.type,'hud');
  const next=s.acceptedUpdate(108000);
  assert.ok(next.effects.findIndex(e=>e.type==='callback') < next.effects.findIndex(e=>e.type==='finish'));
  assert.equal(next.view.elapsed,2); assert.equal(next.view.running,false);
  assert.equal(next.view.samplePhase,0);
});

test('transition decrement precedes gate, pause suppresses callback but not fifth sample', () => {
  const s=scene({retained:{samplePhase:4}});
  let r=s.acceptedUpdate(9000,{transition:true,sharedCallback:true});
  assert.deepEqual(r.effects.map(e=>e.type),['special-countdown','transition']);
  assert.equal(r.view.specialCountdown,239); assert.equal(r.view.samplePhase,4);
  r=s.acceptedUpdate(9000,{pause:true,sharedCallback:true});
  assert.equal(r.view.specialCountdown,238); assert.equal(r.view.elapsed,2);
  assert.equal(r.effects.some(e=>e.type==='callback'),false);
  assert.equal(r.effects[1].type,'shared-callback');
});

test('already pending end gets callbacks, then cleanup, never clock sample', () => {
  const s=scene({retained:{samplePhase:4,pendingFinish:true}});
  const r=s.acceptedUpdate(9000);
  assert.equal(r.view.elapsed,0); assert.equal(r.view.samplePhase,4);
  assert.deepEqual(r.effects.slice(-4).map(e=>e.type),['ticking','teardown','interval','finish']);
  assert.ok(r.effects.some(e=>e.type==='callback'));
});

test('full inactivity20 ends only after actor finishes the next delivered callback', () => {
  const s=scene(); let r;
  for(let i=1;i<=50;i++)r=s.acceptedUpdate(i*400);
  assert.equal(r.view.inactivity,20); assert.equal(r.view.running,true);
  r=s.acceptedUpdate(20400);
  assert.equal(r.view.running,false); assert.equal(r.view.elapsed,20);
  assert.ok(r.effects.some(e=>e.type==='draw' && e.operation.object?.kind==='actor'));
});

test('retained words and fifth phase survive Repeat, Welcome/manual/load reentry', () => {
  const s=scene({retained:{idleTicks:19,idlePhase:23,walkDistance:65535,targetX:-312,jumpFrame:11,samplePhase:4}});
  for(const label of ['Repeat','Welcome','manual','load']) {
    const v=s.reenter({lesson,durationSeconds:600,nowMs:1000}).view;
    assert.deepEqual(v.retained,{idleTicks:19,idlePhase:23,walkDistance:65535,targetX:-312,jumpFrame:11,samplePhase:4,pendingFinish:false,pursuitPause:false},label);
    assert.equal(v.jumpPhase,0); assert.equal(v.scrollSpeed,1); assert.equal(v.elapsed,0);
  }
  const r=s.acceptedUpdate(1000);
  assert.equal(r.view.retained.idleTicks,0); assert.equal(r.view.retained.walkDistance,4);
  assert.equal(r.view.retained.targetX,-11); assert.equal(r.view.samplePhase,0);
  s.keyDown(97); assert.equal(s.snapshot().retained.jumpFrame,0);
});

test('special hold blocks input/timer, preserves baseline/phase, restores all status4 to1, bypasses counters', () => {
  const s=scene(); let r;
  for(let i=0;i<120;i++) { r=s.acceptedUpdate(0); if(r.view.specialState===2) break; }
  assert.equal(r.view.specialState,2);
  const before=s.snapshot(); const held=s.keyDown(before.specialByte);
  assert.equal(held.view.held,true); assert.equal(held.view.specialState,2);
  assert.equal(held.effects[0].milliseconds,100);
  assert.equal(held.effects.at(-1).type,'special-playback');
  assert.deepEqual(s.acceptedUpdate(100000).effects,[]); assert.deepEqual(s.keyDown(97).effects,[]);
  assert.throws(()=>s.reenter({lesson,durationSeconds:60,nowMs:1}),/transaction/);
  const end=s.finishSpecial();
  assert.equal(end.view.held,false); assert.equal(end.view.specialState,3); assert.equal(end.view.specialCountdown,0);
  assert.deepEqual(end.view.counters,before.counters); assert.equal(end.view.inactivity,before.inactivity);
  assert.equal(end.view.expectedIndex,before.expectedIndex);
  assert.equal(end.view.sampledClock,before.sampledClock); assert.equal(end.view.samplePhase,before.samplePhase);
  assert.equal(end.view.objects.some(o=>o.status===4),false);
  assert.equal(end.effects.at(-1).milliseconds,50);
  assert.deepEqual(s.finishSpecial().effects,[]);
});

test('counter/histogram low16 wrap, divisor4 and low16 elapsed fault policy', () => {
  const s=scene();s.acceptedUpdate(0);
  for(let i=0;i<65536;i++)s.keyDown(120);
  assert.deepEqual(s.snapshot().counters,{total:0,errors:0,speed:0});
  assert.equal(s.snapshot().histogram[97],0);
  assert.equal(typingSpeed({total:40,errors:4,elapsed:60,divisor:4}),9);
  assert.equal(typingSpeed({total:40,errors:4,elapsed:65536,divisor:4}),null);
});

for (let character=0;character<3;character++) test(`idle threshold selection character${character}, source phase8 vector`,()=>{
  const s=scene({character});let r;
  for(let i=0;i<1000;i++) {
    r=s.acceptedUpdate(0);
    if(r.view.retained.idleTicks===10 && r.view.retained.idlePhase===8)break;
  }
  assert.equal(r.view.retained.idlePhase,8);
  assert.deepEqual(r.view.actor.sprite,{selector:19+character,frame:character===2?0:1});
  assert.equal(r.view.actor.y,168);assert.equal(r.view.actor.anchor,'bottom');
});

for (let character=0;character<3;character++) for(let keyset=0;keyset<5;keyset++) test(`complete jump character${character}/keyset${keyset}, twelve source entries`,()=>{
  const s=scene({character,keyset});s.acceptedUpdate(0);s.keyDown(97);
  const expectedY=animation.jumpY.map(y=>118+y);
  for(let frame=0;frame<12;frame++) {
    const r=s.acceptedUpdate(0);
    assert.deepEqual(r.view.actor.sprite,{selector:22+character,frame});
    assert.equal(r.view.actor.y,expectedY[frame]);
  }
  assert.equal(s.snapshot().jumpPhase,0);assert.equal(s.snapshot().retained.jumpFrame,0);
});

for(let character=0;character<3;character++) test(`idle phase wraps at source count character${character}`,()=>{
  const s=scene({character});let r;
  const length=animation.idleLength[character];
  for(let i=0;i<1500;i++) {
    r=s.acceptedUpdate(0);
    if(r.view.retained.idleTicks===10 && r.view.retained.idlePhase===2*length-1)break;
  }
  assert.equal(r.view.retained.idlePhase,2*length-1);
  const next=s.acceptedUpdate(0);
  assert.equal(next.view.retained.idlePhase,0);
  assert.deepEqual(next.view.actor.sprite,{selector:19+character,frame:0});
});

for(let character=0;character<3;character++) test(`all idle phases character${character}`,()=>{
  const s=scene({character});
  const seen=new Set();
  for(let i=0;i<3000 && seen.size<2*animation.idleLength[character];i++) {
    const {view}=s.acceptedUpdate(0);
    if(view.retained.idleTicks!==10)continue;
    const phase=view.retained.idlePhase;
    const time=Math.trunc(phase/2), thresholds=animation.idleThresholds[character];
    // Count elapsed boundaries rather than repeat the implementation's search.
    const count=thresholds.filter(n=>n<=time).length;
    const frame=count===thresholds.length?0:Math.max(0,count-1);
    assert.deepEqual(view.actor.sprite,{selector:19+character,frame});
    seen.add(phase);
  }
  assert.equal(seen.size,2*animation.idleLength[character]);
});

test('animation is explicit and caller mutation cannot change scene tables',()=>{
  assert.throws(()=>scene({animation:undefined}),/presentation.outsideAnimation/);
  const supplied=structuredClone(animation);
  const s=scene({animation:supplied});s.acceptedUpdate(0);s.keyDown(97);
  supplied.jumpY.fill(1000);
  assert.equal(s.acceptedUpdate(0).view.actor.y,118+animation.jumpY[0]);
});

test('ground callbacks wrap unsigned sum modulo20, not tile width180',()=>{
  const s=scene();let r;
  for(let i=0;i<100;i++)r=s.acceptedUpdate(0);
  const grounds=r.view.objects.filter(o=>o.kind==='ground');
  assert.equal(grounds[1].x-grounds[0].x,180);
  assert.ok(grounds[0].x>=-19 && grounds[0].x<=0);
});

test('returned state/effects cannot mutate retained live state',()=>{
  const s=scene();const r=s.acceptedUpdate(0);
  r.view.slots[0].x=10000;draws(r).find(e=>e.object?.kind==='actor').object.x=10000;
  assert.equal(s.snapshot().slots[0].x,299);assert.equal(s.snapshot().actor.x,15);
});
