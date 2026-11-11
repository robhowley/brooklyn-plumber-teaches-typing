import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Celebration } from '../../recovered/control/celebration.mjs';
import { createPendingInput, fireworkVariant } from '../../recovered/runtime/runtime.mjs';
import { progression } from '../../recovered/control/flow.mjs';
import { resultEntryEffects, resultNextState } from '../../recovered/control/results.mjs';
import { CelebrationRenderer, hydrateCelebrationResources, celebrationFade } from '../../app/celebration-render.mjs';

const raw=JSON.parse(readFileSync(new URL('../../assets/render/celebration/bindings.json',import.meta.url)));
const resources=hydrateCelebrationResources(raw);
function setup(world,options={}) {
  const input=createPendingInput(),rng={seed:7};
  const controller=new Celebration({world,character:1,goal:world===1?10:world===2?30:45,
    lesson:6,endMode:4,swimFrame:0,rng,resources,...options});
  return {controller,input,rng};
}
function untilInput(s,max=3000) {
  const trace=[];
  for(let i=0;i<max;i++) {
    trace.push(...s.controller.step({input:s.input,tickReady:true}));
    if(s.controller.wait==='wait-input' || s.controller.complete) return trace;
  }
  throw new Error('presentation did not reach input');
}
function finish(s) {
  s.input.enqueue(0,0x3b,65,66);
  return s.controller.step({input:s.input,pointerChanged:true});
}
const digest=pixels=>createHash('sha256').update(pixels).digest('hex');

test('binder verifies archive bytes, original names, scene hashes and all selected character indices',()=>{
  assert.equal(raw.members['MARIO.EXE'].sha256,'6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e');
  assert.ok(raw.verifiedInstructions>=2748);
  assert.deepEqual(Object.fromEntries(Object.entries(resources.movies).map(([k,v])=>[k,v.frames.length])),{FIR1:26,FIR2:25,WCAS:48,ENDF:40});
  for(const name of ['OCASTLE','WCAS0001','ENDF']) assert.equal(digest(resources.scenes[name].pixels),raw.scenes[name].indicesSha256);
  for(let c=1;c<=3;c++) {
    assert.equal(resources.actors.WALKING[(c-1)*30].sprite.name,`${'mlp'[c-1]}run0001_1`);
    assert.equal(resources.actors.WATER[(c-1)*6].sprite.name,`${'mlp'[c-1]}swm0001_1`);
    // ENDF deliberately does not apply a character palette.
    assert.deepEqual(resources.scenes.ENDF.palettes.m,resources.scenes.ENDF.palettes['mlp'[c-1]]);
  }
});

for(const character of [1,2,3]) test(`Outside full source path, character ${character}, 55 moves and exactly ten low-bit draws`,()=>{
  const s=setup(1,{character}),expected={seed:7};
  const names=Array.from({length:10},()=>`FIR${fireworkVariant(expected)}`);
  const trace=untilInput(s),actors=trace.filter(e=>e.type==='actor');
  assert.equal(actors.length,55);
  assert.deepEqual([actors[0].x,actors[0].y,actors[0].index],[-45,111,(character-1)*30+1]);
  assert.deepEqual([actors.at(-1).x,actors.at(-1).y],[186,113]);
  assert.deepEqual(trace.filter(e=>e.type==='movie-packet' && e.frame===0).map(e=>e.name),names);
  assert.equal(s.rng.seed,expected.seed);
  assert.equal(trace.filter(e=>e.type==='character-resources-free').length,1);
  assert.equal(trace.some(e=>e.type.includes('timer')||e.type.includes('sound')),false);
  const tail=finish(s);
  assert.equal(tail.at(-1).type,'celebration-complete');assert.equal(s.input.pending(),false);
  assert.deepEqual(s.controller.step({input:s.input,tickReady:true}),[]);
});

test('Outside entry flush and movement skip consume queued bytes without any random draw or character free',()=>{
  const s=setup(1);s.input.enqueue(65);
  const first=s.controller.step({input:s.input});
  assert.equal(s.input.pending(),false);assert.equal(first.at(-1).type,'actor');
  s.input.enqueue(0,0x3b,65);
  const trace=s.controller.step({input:s.input,tickReady:true});
  assert.equal(s.rng.seed,7);assert.equal(s.input.pending(),false);
  assert.equal(s.controller.wait,'wait-input');
  assert.equal(trace.some(e=>e.type==='actor-remove'||e.type==='character-resources-free'||e.type==='movie-packet'),false);
  assert.equal(trace.find(e=>e.id===7050).type,'text');
  assert.equal(s.controller.complete,false); // skip is not also final dismissal
  finish(s);assert.equal(s.controller.complete,true);
});

test('a firework cannot be interrupted mid-packet/movie; pending key skips subsequent RNG draws',()=>{
  const s=setup(1);let trace=[];
  while(!trace.some(e=>e.type==='movie-packet')) trace.push(...s.controller.step({input:s.input,tickReady:true}));
  const movie=trace.at(-1).name,count=resources.movies[movie].frames.length,afterFirstDraw=s.rng.seed;
  s.input.enqueue(65,66);
  let packets=1;
  while(s.controller.wait!=='wait-input') {
    const effects=s.controller.step({input:s.input,tickReady:true});
    packets+=effects.filter(e=>e.type==='movie-packet').length;
  }
  assert.equal(packets,count);assert.equal(s.rng.seed,afterFirstDraw);assert.equal(s.input.pending(),false);
});

for(const character of [1,2,3]) test(`Water movement/movie ignore keys and preserve surviving swim frame, character ${character}`,()=>{
  const s=setup(2,{character,swimFrame:5});
  let trace=s.controller.step({input:s.input});s.input.enqueue(65);
  trace.push(...untilInput(s));
  const actors=trace.filter(e=>e.type==='actor');
  assert.equal(actors.length,56);assert.deepEqual([actors.at(-1).x,actors.at(-1).y],[123,140]);
  assert.equal(actors[0].index,(character-1)*6+5);assert.equal(s.controller.swimFrame,3);
  assert.equal(trace.filter(e=>e.type==='movie-packet').length,48);
  assert.equal(trace.filter(e=>e.type==='clip').length,112);
  assert.equal(s.rng.seed,7);assert.equal(s.input.pending(),false);
  assert.equal(s.controller.complete,false);
  const tail=finish(s);
  assert.deepEqual(tail.map(e=>e.type),['flush-input','clear-high-bit','palette-fade','clear-screen','scene-free','text-restore','celebration-complete']);
});

test('Water key during WCAS cannot skip any packet and cannot dismiss the final input wait',()=>{
  const s=setup(2);let trace=[];
  while(!trace.some(e=>e.type==='movie-packet')) trace.push(...s.controller.step({input:s.input,tickReady:true}));
  s.input.enqueue(0,0x3b,65);
  trace.push(...untilInput(s));
  assert.equal(trace.filter(e=>e.type==='movie-packet').length,48);
  assert.equal(s.input.pending(),false);assert.equal(s.controller.complete,false);assert.equal(s.rng.seed,7);
  assert.deepEqual(s.controller.step({input:s.input}),[]);
  finish(s);assert.equal(s.controller.complete,true);
});

for(const endMode of [1,2]) test(`Castle mode ${endMode} waits exactly18 changed ticks then accepts key/pointer, never a happy movie`,()=>{
  const s=setup(3,{endMode,goal:endMode===2?44:45}),start=s.controller.step({input:s.input});
  assert.deepEqual(start.filter(e=>e.type==='text').map(e=>e.id),[7010,6100,6101,50420]);
  s.input.enqueue(65);
  for(let i=1;i<18;i++) {
    assert.deepEqual(s.controller.step({input:s.input,tickReady:true}),[]);
    assert.equal(s.input.pending(),true);
  }
  assert.deepEqual(s.controller.step({input:s.input,tickReady:true}).map(e=>e.type),['flush-input']);
  assert.equal(s.controller.wait,'wait-input');assert.equal(s.input.pending(),false);
  const tail=s.controller.step({input:s.input,pointerChanged:true});
  assert.equal(tail.at(-1).type,'celebration-complete');assert.equal(s.rng.seed,7);
});

test('ENDF repeats until key, two waits per packet, early key discarded, no RNG and completion flag only on return',()=>{
  const s=setup(3);s.controller.step({input:s.input});s.input.enqueue(65);
  let trace=[];
  for(let i=0;i<18;i++) trace.push(...s.controller.step({input:s.input,tickReady:true}));
  assert.equal(s.input.pending(),false);assert.deepEqual(trace.filter(e=>e.type==='movie-packet').map(e=>e.frame),[0]);
  // A pointer is not the ENDF skip callback. At least a full second pass starts.
  for(let i=0;i<80;i++) trace.push(...s.controller.step({input:s.input,tickReady:true,pointerChanged:true}));
  assert.deepEqual(trace.filter(e=>e.type==='movie-packet').map(e=>e.frame),[...Array.from({length:40},(_,i)=>i),0]);
  s.input.enqueue(0,0x3b,65);
  assert.deepEqual(s.controller.step({input:s.input,tickReady:true}),[]);
  const end=s.controller.step({input:s.input,tickReady:true});
  assert.deepEqual(end.map(e=>e.type),['flush-input','flush-input','text-restore','scene-free','set-completed','celebration-complete']);
  assert.equal(s.rng.seed,7);assert.equal(s.input.pending(),false);
  assert.deepEqual(s.controller.step({input:s.input,tickReady:true}),[]);
});

test('same-tick calls cannot run movies ahead or dismiss the final wait with a skipped key',()=>{
  const s=setup(1);s.controller.step({input:s.input});s.input.enqueue(65);
  for(let i=0;i<5;i++) assert.deepEqual(s.controller.step({input:s.input}),[]);
  assert.equal(s.input.pending(),true);
  s.controller.step({input:s.input,tickReady:true});
  assert.equal(s.controller.wait,'wait-input');assert.equal(s.input.pending(),false);
  assert.deepEqual(s.controller.step({input:s.input}),[]);
});

test('progression uses strict completion thresholds, presentation text uses >= and Next never advances lesson again',()=>{
  for(const [world,goal,wpm,complete] of [[1,8,8,false],[1,9,9,true],[2,25,25,false],[2,26,26,true]]) {
    const profile={mode:world,goal,lesson:6,previousGoal:goal,profilePresent:true,
      completed:[false,false,false],printed:[false,false,false],pending:[false,false,false]};
    const advance=progression(profile,{mode:world,resultWpm:wpm,profilePresent:true});
    assert.equal(advance.state.completed[world-1],complete);
    const s=setup(world,{goal:advance.state.goal});
    if(world===1) {s.controller.step({input:s.input});s.input.enqueue(65);}
    const trace=untilInput(s);
    assert.equal(trace.some(e=>e.id===(world===1?7050:6050)),true);
    const next=resultNextState(advance.state),again=resultNextState(next.state);
    assert.equal(next.state.goal,advance.state.goal);assert.equal(next.state.lesson,1);
    assert.deepEqual(next.state.pending,again.state.pending);
    assert.equal(next.state.pending[world-1],complete);
    assert.deepEqual(next.effects.map(e=>e.type),['queue-certificates','save-profile']);
  }
});

test('Castle first completion snapshot must be applied after presentation, before save/results/Next queue',()=>{
  const initial={mode:3,goal:40,lesson:6,completed:[true,true,false],previousGoal:40,
    profilePresent:true,printed:[true,false,false],pending:[false,true,false]};
  const advance=progression(initial,{mode:3,resultWpm:40,profilePresent:true});
  assert.equal(advance.ending,4);assert.equal(advance.state.goal,45);
  // World progression currently exposes a final snapshot. Do not publish the
  // third byte to the original profile before the source ending callback returns.
  const during={...advance.state,completed:[...initial.completed]};
  const s=setup(3);s.controller.step({input:s.input});
  for(let i=0;i<18;i++) s.controller.step({input:s.input,tickReady:true});
  assert.equal(during.completed[2],false);s.input.enqueue(65);
  s.controller.step({input:s.input,tickReady:true});
  for(const e of s.controller.step({input:s.input,tickReady:true})) if(e.type==='set-completed') during.completed[e.index]=true;
  assert.deepEqual(during.completed,[true,true,true]);
  const entry=resultEntryEffects({...during,world:3,mode:3,wpm:40,suppressed:false});
  assert.deepEqual(entry.map(e=>e.type),['result-stats','speech-request','set-result-suppression','flush-input','result-pointer','set-next']);
  assert.equal(entry[1].name,'congrats');
  assert.deepEqual(resultNextState(during).state.pending,[false,true,true]);
  assert.deepEqual(during.printed,[true,false,false]);
});

test('result speech compares previous goal, obeys every gate, and precedes suppression reset/flush',()=>{
  const base={profilePresent:true,world:1,mode:1,goal:10,previousGoal:8,wpm:8};
  for(const [patch,speech] of [[{},'congrats'],[{wpm:7},'toobad'],[{suppressed:true},null],
    [{profilePresent:false},null],[{mode:4},null],[{goal:11},null],
    [{world:2,goal:31},null],[{world:2,goal:30},'congrats']]) {
    const effects=resultEntryEffects({...base,...patch});
    assert.equal(effects.find(e=>e.type==='speech-request')?.name??null,speech);
    assert.equal(effects.findIndex(e=>e.type==='set-result-suppression')<effects.findIndex(e=>e.type==='flush-input'),true);
  }
  assert.deepEqual(resultEntryEffects({...base,demo:true}).map(e=>e.type),['set-next','flush-input','results-bypassed']);
});

test('indexed renderer uses real BAN writes in both buffers, clips actors, and restores text state only',()=>{
  const s=setup(2),oldText={font:'FONT9H',foreground:12};
  const renderer=new CelebrationRenderer(resources,1,{textState:oldText});
  renderer.apply(s.controller.step({input:s.input}));
  const trace=untilInput(s);renderer.apply(trace);
  assert.deepEqual(renderer.clip,{left:0,top:0,right:319,bottom:199});
  const frame=resources.movies.WCAS.frames[0];
  const front=new Uint8Array(64000).fill(77),background=front.slice();
  const r=new CelebrationRenderer(resources,2,{front,background});
  r.apply([{type:'movie-packet',name:'WCAS',frame:0}]);
  for(const write of frame.writes) {
    // Last write wins if original command runs overlap.
    background.set(write.pixels,write.offset);
  }
  assert.deepEqual(front,background);
  renderer.apply(finish(s));
  assert.deepEqual(renderer.textState,oldText);
  assert.equal(renderer.palette.every(v=>v===0),true);
  assert.equal(renderer.front.some(v=>v>=128),false);
  assert.notDeepEqual(renderer.front,resources.scenes.WCAS0001.pixels); // no invented prior-world restoration
});

test('real swim raster clips at x105, restoring old pixels before current pixels independently',()=>{
  const s=setup(2,{character:3,swimFrame:2}),r=new CelebrationRenderer(resources,3);
  r.apply(s.controller.step({input:s.input}));
  while(s.controller.x<99) r.apply(s.controller.step({input:s.input,tickReady:true}));
  const effects=s.controller.step({input:s.input,tickReady:true});
  const actor=effects.find(e=>e.type==='actor'),expected=r.front.slice();
  const old=resources.actors.WATER[actor.previous.index],current=resources.actors.WATER[actor.index];
  const rect=a=>{
    const sp=resources.actors.WATER[a.index].sprite;
    return {x:a.x+sp.headerWords[0],y:a.y+sp.headerWords[1],w:sp.width,h:sp.height};
  };
  const a=rect(actor),b=rect(actor.previous);
  // Overlapping previous/current rectangles restore their bounding union.
  for(let y=Math.max(0,Math.min(a.y,b.y));y<Math.min(200,Math.max(a.y+a.h,b.y+b.h));y++)
    for(let x=Math.max(0,Math.min(a.x,b.x));x<Math.min(106,Math.max(a.x+a.w,b.x+b.w));x++) expected[y*320+x]=r.background[y*320+x];
  for(let y=0;y<current.sprite.height;y++) for(let x=0;x<current.sprite.width;x++) {
    const px=a.x+x,py=a.y+y,v=current.pixels[y*current.sprite.width+x];
    if(v && px>=0 && px<=105 && py>=0 && py<200) expected[py*320+px]=v;
  }
  assert.ok(old.pixels.length);r.apply(effects);assert.deepEqual(r.front,expected);
  assert.deepEqual(r.clip,{left:0,top:0,right:319,bottom:199});
});

test('text uses recovered cell metrics and transparent glyph mapping, pop restores a value snapshot',()=>{
  const original={font:'FONT9H',foreground:12,column:8,row:9},r=new CelebrationRenderer(resources,1,{textState:original});
  r.front.fill(77);r.apply([{type:'text-save',font:'FONT3H'}]);
  original.foreground=4;
  r.apply([{type:'text',id:6010,column:3,row:2}]);
  const glyph=resources.actors.FONT3H['Y'.charCodeAt(0)-32];
  for(let y=0;y<10;y++) for(let x=0;x<8;x++) {
    const v=glyph.pixels[y*8+x];assert.equal(r.front[(10+y)*320+16+x],v?[0,15,0][v]:77);
  }
  r.apply([{type:'text-restore'}]);assert.equal(r.textState.foreground,12);
});

for(const character of [1,2,3]) test(`Castle final renderer and repeated-entry RNG ownership, character ${character}`,()=>{
  const s=setup(3,{character}),r=new CelebrationRenderer(resources,character);
  r.apply(s.controller.step({input:s.input}));
  for(let i=0;i<18;i++) r.apply(s.controller.step({input:s.input,tickReady:true}));
  const expected=resources.scenes.ENDF.palettes['mlp'[character-1]];
  assert.deepEqual(r.palette,expected);
  s.input.enqueue(65);r.apply(s.controller.step({input:s.input,tickReady:true}));
  r.apply(s.controller.step({input:s.input,tickReady:true}));assert.equal(s.controller.complete,true);
  const rng={seed:7},oracle={seed:7};
  for(let entry=0;entry<2;entry++) {
    const outside=setup(1,{character,rng});untilInput(outside);finish(outside);
    for(let i=0;i<10;i++) fireworkVariant(oracle);
    assert.equal(rng.seed,oracle.seed);
  }
});

test('fade has original integer steps without waits or an invented duration',()=>{
  const from=new Uint8Array(768).fill(1),to=new Uint8Array(768).fill(63);
  const up=celebrationFade(from,to),down=celebrationFade(to,from);
  assert.equal(up.length,14);assert.equal(up[2][0],6);assert.equal(down[2][0],58);
  assert.deepEqual(up.at(-1),to);assert.deepEqual(down.at(-1),from);
});

test('missing scenes, movies, actors, font/messages and malformed data fail before random/input mutation',()=>{
  for(const [section,key] of [['scenes','OCASTLE'],['movies','FIR2'],['actors','WALKING'],['actors','FONT3H'],['fonts','FONT3H'],['messages','7050']]) {
    const altered={...resources,[section]:{...resources[section]}};delete altered[section][key];
    const rng={seed:7},input=createPendingInput();input.enqueue(65);
    assert.throws(()=>setup(1,{resources:altered,rng}));assert.equal(rng.seed,7);assert.equal(input.pending(),true);
  }
  const malformed=structuredClone(raw);malformed.movies.FIR1.frames[0].writes[0].offset=64000;
  assert.throws(()=>hydrateCelebrationResources(malformed),/BAN write/);
  assert.throws(()=>setup(2,{swimFrame:undefined}),/surviving Water frame/);
});
