import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWater,createWaterReader} from '../water.js';

// Optional inert extraction fixture, generated outside Git from pinned member
// 39a4fb53384afbfec13063c2f4c67d51013b1f8ea494788c88f1ac6c12f47f22.
// Ordinary tests use synthetic tables, not copied game numerical arrays.
const source = process.env.MARIO2_WATER_INPUTS ? JSON.parse(readFileSync(process.env.MARIO2_WATER_INPUTS)) : null;
const animation = source?.animation ?? {
  swimSelectors:Array.from({length:3},(_,i)=>25+i),bubblePositions:Array.from({length:10},(_,i)=>[50+i,150+i]),
  pursuerY:Array(10).fill(0),fingerMap:Array(128).fill(0),fingerX:Array(10).fill(0),fingerY:Array(10).fill(0),
  frameLengths:{14:10,15:12,25:6,26:6,27:6,28:3,29:5,30:10,31:25,32:2,33:1},
};
const lesson = {bytes:[97,98,99]};
function rng(values=[]) { let calls=0; return {next:()=>values[calls++]??1,get calls(){return calls;}}; }
const scene = (args={}) => createWater({lesson,animation,random:rng(),nowMs:0,durationSeconds:600,...args});
const object = (v,kind) => v.objects.find(o=>o.kind===kind);
const draws = r => r.effects.filter(e=>e.type==='draw').map(e=>e.operation);

test('distinct normalized reader, dirty latch, wrap, backtick and NUL',()=>{
  const r=createWaterReader({bytes:[254,0xe1,13,10,9,32,96,0]});
  assert.deepEqual(Array.from({length:6},()=>r.next()),[97,32,96,0,97,32]);
  assert.deepEqual(r.snapshot(),{offset:3,lastByte:32});
  assert.equal(createWaterReader({bytes:[32,97]},32).next(),97);
  assert.equal(createWaterReader({bytes:[32,97]},0).next(),32);
  assert.throws(()=>createWaterReader({bytes:[126]}).next(),/cannot produce/);
  assert.throws(()=>createWaterReader({bytes:[32,9]},32).next(),/cannot produce/);
});

test('constructor requires full generated inventory, clones tables and rejects bad selection',()=>{
  assert.throws(()=>scene({animation:null}),/waterAnimation/);
  for(const key of Object.keys(animation)) {const a=structuredClone(animation);delete a[key];assert.throws(()=>scene({animation:a}));}
  const a=structuredClone(animation),s=scene({animation:a});a.swimSelectors[0]=0;
  assert.equal(object(s.acceptedUpdate(0).view,'actor').sprite.selector,25);
  assert.throws(()=>scene({character:3}));assert.throws(()=>scene({lesson:{bytes:[126]}}));
});

test('initializer consumes thirty, correct shifts forty and appends once; immediate input HUD',()=>{
  const s=scene();const before=s.snapshot();assert.equal(before.row.length,41);
  assert.deepEqual(before.row.slice(0,10),Array(10).fill(0));assert.equal(before.expectedByte,97);
  assert.deepEqual(s.entryEffects.filter(e=>e.type==='audio').map(e=>[e.selector,e.operation]),[[0,12],[3,3],[12,1]]);
  const r=s.keyDown(97);assert.deepEqual(r.view.row.slice(0,39),before.row.slice(1,40));assert.equal(r.view.row[39],97);assert.equal(r.view.row[40],0);
  assert.equal(r.view.total,1);assert.equal(r.view.errors,0);assert.equal(draws(r).at(-1).type,'hud');
  const w=s.keyDown(1);assert.equal(w.view.total,2);assert.equal(w.view.errors,1);assert.equal(w.view.histogram[98],1);
  assert.ok(w.effects.some(e=>e.type==='inactivity-reset'));assert.equal(draws(w).at(-1).wrong,1);
});

test('registration, first increment, prior actor reads, old-x switch after selected sprite',()=>{
  for(const parity of [0,1])for(const old of [0,-12,-30,186]){
    const random=rng([parity]);const s=scene({random,retained:{pursuerX:old}});assert.equal(random.calls,6);
    const r=s.acceptedUpdate(0),v=r.view,p=object(v,'pursuer');
    assert.deepEqual(v.objects.slice(0,20).map(o=>o.kind),Array(20).fill('seabed'));
    assert.deepEqual(v.objects.slice(20).map(o=>o.kind),['pursuer','hand','hand','finger','actor','special','label']);
    assert.equal(object(v,'seabed').sprite.frame,1);assert.deepEqual([object(v,'actor').x,object(v,'actor').y],[21,113]);
    assert.equal(p.x,-52);assert.equal(p.sprite.selector,parity?30:29);assert.equal(p.sprite.frame,1);
    assert.equal(p.type,old-40 > -52 ? 1-parity : parity);assert.equal(v.retained.pursuerX,-52);
    assert.deepEqual(draws(r)[0],{type:'restore',top:74,bottom:240});
    if(source)assert.equal(p.y,107+(parity?source.animation.pursuerY[1]:0));
  }
});

for(let character=0;character<3;character++)for(let keyset=0;keyset<5;keyset++)test(`Water character${character}/keyset${keyset} first draw`,()=>{
  const r=scene({character,keyset}).acceptedUpdate(0);
  assert.deepEqual(object(r.view,'actor').sprite,{selector:25+character,frame:1});
  assert.equal(r.view.keyset,keyset);assert.equal(r.view.character,character);
});

test('appended bubbles update in same traversal, RNG test then position, max seven',()=>{
  const random=rng([0,1,1,1,1,1,...Array(40).fill(0)]),s=scene({random});
  const r=s.acceptedUpdate(0),b=object(r.view,'bubble');
  assert.equal(random.calls,8);assert.deepEqual([b.x,b.y],animation.bubblePositions[0].map((n,i)=>n-(i===1?1:0)));
  for(let i=0;i<10;i++)s.acceptedUpdate(0);
  assert.equal(s.snapshot().objects.filter(o=>o.kind==='bubble'&&o.status!==0).length,7);
});

test('bubble age11 switches frame, y78 retires with one final drawing',()=>{
  const random=rng([0,1,1,1,1,1,0,0]),s=scene({random});
  let r=s.acceptedUpdate(0),b=object(r.view,'bubble');assert.equal(b.age,1);assert.equal(b.sprite.frame,0);
  for(let t=2;t<=11;t++)r=s.acceptedUpdate(0);
  b=object(r.view,'bubble');assert.equal(b.age,11);assert.equal(b.sprite.frame,1);
  const retirement=animation.bubblePositions[0][1]-78;
  for(let t=12;t<=retirement;t++)r=s.acceptedUpdate(0);
  b=object(r.view,'bubble');assert.equal(b.y,78);assert.equal(b.status,3);
  assert.ok(draws(r).some(o=>o.object?.id===b.id));
  r=s.acceptedUpdate(0);assert.equal(object(r.view,'bubble').status,0);
  assert.ok(!draws(r).some(o=>o.object?.id===b.id));
});

test('full inactivity trajectory, prior sample ordering, stage2 repeated audio and pending end draw',()=>{
  const s=scene();s.keyDown(1);let sink=0,r;
  const boundaries={1:[21,113,-52],200:[220,157,170],201:[221,157,171],205:[221,157,183],206:[221,158,186],247:[221,199,186],248:[221,200,186]};
  for(let t=1;t<=248;t++){
    r=s.acceptedUpdate(t*100);const a=object(r.view,'actor'),p=object(r.view,'pursuer');
    if(boundaries[t])assert.deepEqual([a.x,a.y,p.x],boundaries[t],`delivery ${t}`);
    sink+=r.effects.filter(e=>e.type==='audio'&&e.selector===12&&e.operation===2).length;
    if(t===200)assert.equal(r.view.inactivitySeconds,20);
    if(t===201)assert.equal(r.view.expectedByte,0);
  }
  assert.equal(sink,43);assert.equal(r.view.elapsedSeconds,24);assert.equal(r.view.running,false);
  assert.ok(r.effects.findIndex(e=>e.type==='present')<r.effects.findIndex(e=>e.type==='finish'));
  assert.equal(s.acceptedUpdate(25000).effects.length,0);
});

test('100ms outer deliveries: fifth sample, cap two, pause clocks, transition skips phase',()=>{
  const s=scene();for(let i=0;i<4;i++)assert.equal(s.acceptedUpdate(10000,{pause:true}).view.elapsedSeconds,0);
  let r=s.acceptedUpdate(10000,{pause:true});assert.equal(r.view.elapsedSeconds,2);assert.equal(object(r.view,'actor').x,20);
  const phase=r.view.retained.samplePhase;r=s.acceptedUpdate(20000,{transition:true});assert.equal(r.view.retained.samplePhase,phase);
  assert.deepEqual(r.effects.map(e=>e.type),['special-countdown','transition']);
  const tiny=scene({durationSeconds:1});for(let i=0;i<5;i++)r=tiny.acceptedUpdate(1000,{pause:true});assert.equal(r.view.pendingFinish,true);
  r=tiny.acceptedUpdate(1000);assert.ok(r.effects.some(e=>e.type==='present'));assert.ok(r.effects.some(e=>e.type==='finish'));
});

test('cache/previous18 both choose divisor4 across callbacks, signed-height multiply wraps',()=>{
  for(const states of [{current:19,previous:18,cache:0},{current:19,previous:0,cache:18},{current:19,previous:0,cache:0}]){
    const s=scene({states});for(let i=0;i<5;i++)s.acceptedUpdate(1000,{pause:true});
    for(let i=0;i<55;i++)s.keyDown(s.snapshot().expectedByte);
    const r=s.acceptedUpdate(1000),a=object(r.view,'actor');
    assert.equal(r.view.wpm,states.previous===18||states.cache===18?825:660);
    // -63*825 wraps from -51975 to +13561: target above157, so y113.
    // -63*660 wraps from -41580 to +23956, same downward pixel.
    assert.equal(a.y,113);assert.equal(object(s.acceptedUpdate(1000).view,'actor').y,114);
  }
});

test('special bypass holds keys/timers, ordered audio return, row without HUD, retirement221/222',()=>{
  const s=scene();let r;for(let t=1;t<=220;t++){
    if(t===100||t===200)s.keyDown(1);
    r=s.acceptedUpdate(t*100);
  }
  assert.equal(r.view.specialState,2);const before=s.snapshot();r=s.keyDown(before.specialByte);
  assert.equal(r.view.held,true);assert.deepEqual(r.effects.map(e=>e.type),['background','special-playback']);
  assert.equal(s.keyDown(97).effects.length,0);assert.equal(s.acceptedUpdate(99999).effects.length,0);
  r=s.finishSpecial();assert.equal(r.view.total,before.total);assert.deepEqual(r.view.row,before.row);
  assert.deepEqual(r.effects.slice(0,3),[{type:'audio',selector:3,operation:12},{type:'background',bitmap:121},{type:'audio',selector:3,operation:3}]);
  assert.deepEqual(draws(r).map(o=>o.type),['row']);assert.equal(s.finishSpecial().effects.length,0);
  r=s.acceptedUpdate(22100);assert.ok(draws(r).some(o=>o.object?.kind==='special'));assert.equal(object(r.view,'special').status,3);
  r=s.acceptedUpdate(22200);assert.ok(!draws(r).some(o=>o.object?.kind==='special'));
  assert.equal(draws(s.keyDown(1)).at(-1).type,'hud');
});

test('process retention and reload cold defaults; snapshots and effects detached',()=>{
  const l={bytes:[32,97]},s=scene({lesson:l});let v=s.snapshot();v.row[10]=0;v.objects[0].x=100;
  assert.equal(s.snapshot().row[10],32);s.acceptedUpdate(0);
  const retained=s.snapshot().retained;
  const dirty=s.reenter({lesson:l,durationSeconds:600,nowMs:0}).view;
  assert.equal(dirty.row[10],32);assert.equal(dirty.retained.pursuerX,retained.pursuerX);
  const cold=scene({lesson:l});assert.equal(cold.snapshot().retained.pursuerX,0);
  const entry=s.entryEffects;entry[0].selector=999;assert.equal(s.entryEffects[0].selector,0);
});

test('horizontal wrap is not throttled; dirty latch survives reentry but not reload',()=>{
  const s=scene();let r;
  for(let i=1;i<=300;i++){s.keyDown(1);r=s.acceptedUpdate(0);}
  assert.equal(object(r.view,'actor').x,-55);
  const l={bytes:[32,...Array(28).fill(97)]},dirty=scene({lesson:l});
  assert.equal(dirty.snapshot().retained.lastByte,32);
  assert.equal(dirty.reenter({lesson:l,durationSeconds:600,nowMs:0}).view.row[10],97);
  assert.equal(scene({lesson:l}).snapshot().row[10],32);
});

test('source lesson delimiter starts, whitespace and retained-latch branches', {skip:!source},()=>{
  for(const l of source.lessons){
    const starts=[0,...l.bytes.flatMap((b,i)=>(b&127)===126?[i]:[])];
    for(const startOffset of starts)for(const lastByte of [0,32]){
      // Independent whole-stream projection: strip delimiters, map controls,
      // concatenate cycles, then collapse runs, rather than invoking next().
      const cycle=[...l.bytes.slice(startOffset),...l.bytes.slice(0,startOffset)]
        .map(b=>b&127).filter(b=>b!==126).map(b=>[9,10,13].includes(b)?32:b);
      const projected=[...cycle,...cycle,...cycle];
      const expected=projected.filter((b,i)=>b!==32||(i?projected[i-1]:lastByte)!==32).slice(0,100);
      const reader=createWaterReader({bytes:l.bytes,startOffset},lastByte);
      assert.deepEqual(Array.from({length:100},()=>reader.next()),expected,`${l.name}:${startOffset}/${lastByte}`);
    }
  }
});

test('five actual shipped lessons: first delimiter duplicate and 31st append, no production expectations', {skip:!source},()=>{
  // FILE 0x31b0..0x31de remainder0/1 both select0. HLETTERS expanded
  // FILE21 and NLETTERS FILE31 are delimiters, not displayed cells.
  // Independently project the inert source stream, not the production reader.
  source.lessons.forEach((l,keyset)=>{
    assert.equal(l.bytes[0],126);
    const normalized=l.bytes.map(b=>b&127).filter(b=>b!==126)
      .map(b=>[9,10,13].includes(b)?32:b);
    const raw=normalized.filter((b,i)=>b!==32||normalized[i-1]!==32).slice(0,31);
    assert.equal(raw.length,31);assert.ok(raw.every(b=>b>=32&&b<127&&b!==126));
    const s=scene({lesson:{bytes:l.bytes,startOffset:0},keyset});
    assert.deepEqual(s.snapshot().row.slice(10,40),raw.slice(0,30));
    const r=s.keyDown(raw[0]);assert.equal(r.view.row[39],raw[30]);
    const tilde=createWaterReader({bytes:l.bytes,startOffset:l.bytes.indexOf(126)});
    assert.deepEqual(Array.from({length:31},()=>tilde.next()),raw);
  });
});
