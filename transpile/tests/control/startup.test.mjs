import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createPendingInput} from '../../recovered/runtime/runtime.mjs';
import {newStudent,readStudent,studentForSave} from '../../recovered/control/student.mjs';
import {createStartup,createSourceWaitClock,createMenuIdleState,createMenuIdle,demoStudent,createDemo} from '../../recovered/control/startup.mjs';
import {startupZoomFrames,startupFade,createStartupRenderer} from '../../app/startup-render.mjs';
import {updateSprite} from '../../recovered/render/render.mjs';
const root=new URL('../../assets/startup/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const file=p=>new Uint8Array(readFileSync(new URL(p,root)));
function draws(seed,count,bound=4,add=4) {
  let value=BigInt(seed);const result=[];
  for(let i=0;i<count;i++) {
    value=(value*22695477n+1n)&0xffffffffn;
    result.push(add+Number(((value>>16n)&32767n)*BigInt(bound)/32768n));
  }
  return {seed:Number(value),values:result};
}
function playback({seed=1,inject=()=>{},option10=false}={}) {
  const input=createPendingInput(),rng={seed},controller=createStartup({rng,input,option10});
  const events=controller.start();
  let guard=0;
  while(!controller.state.done) {
    if(++guard>1000) throw new Error('Playback did not finish');
    inject(controller.state,events,input);
    events.push(...controller.step({completedWaits:1}));
  }
  return {events,input,rng,controller};
}
const count=(events,type)=>events.filter(e=>e.type===type).length;

// Fresh ZIP reads, not cached disassembly as an oracle. Python only reads data.
test('archive members and every evidence span match original bytes',()=>{
  const python=`import zipfile,hashlib,json,pathlib
p=pathlib.Path.home()/'Downloads/Mario_Teaches_Typing_1992.zip'
m=json.loads(${JSON.stringify(JSON.stringify(manifest))})
assert hashlib.sha256(p.read_bytes()).hexdigest()==m['archiveSha256']
with zipfile.ZipFile(p) as z:
 for record in m['members'].values():
  data=z.read(record['member']); assert len(data)==record['size']; assert hashlib.sha256(data).hexdigest()==record['sha256']
 message=m['demoProfile']; data=z.read('MarioTea/MARIO/ENGLISH.MSD')
 assert data[message['memberOffset']:message['memberOffset']+5]==b'Demo'+bytes([0])
 b=z.read('MarioTea/MARIO/MARIO.EXE')
 for r in m['spans'].values(): assert hashlib.sha256(b[r['start']:r['endExclusive']]).hexdigest()==r['sha256']
 for r in m['initialState'].values(): assert int.from_bytes(b[r['fileOffset']:r['fileOffset']+r['size']],'little')==r['value']==0
print('verified')`;
  const result=spawnSync('python3',['-B','-c',python],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.equal(manifest.members['MARIO.EXE'].sha256,'6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e');
  assert.deepEqual([manifest.spans.presentation.start,manifest.spans.presentation.endExclusive,manifest.spans.presentation.sha256],
    [0xfb90,0x103be,'af3b0333be65a9c9d9b027baa9477154ca2328d306a6c15a4ffedd71866f2c74']);
  assert.equal(manifest.spans['menu-idle'].sha256,'ac081971f06dc54e6792c22557544034eacfb3e12e93550bde4498977f722c1e');
  assert.equal(manifest.spans.fade.sha256,'fb0067b7c4eac183347ef400d598cc48e5851445d7a33fef55cb7ce557d6b35d');
});

test('natural startup has 27 Mario draws, 13 letters, 13 random delays and exact waits',()=>{
  for(const seed of [0,1,65535]) {
    const {events,rng,input}=playback({seed}),expected=draws(seed,13);
    assert.equal(rng.seed,expected.seed);
    assert.equal(count(events,'sprite'),27);assert.equal(count(events,'letter'),13);
    assert.equal(count(events,'scene'),3);assert.equal(count(events,'fade'),4);
    assert.equal(count(events,'palette'),3);assert.equal(count(events,'sound-request'),13);
    const waits=events.filter(e=>e.type==='wait');assert.equal(waits.length,212);
    assert.equal(waits.reduce((a,e)=>a+e.count,0),228+expected.values.reduce((a,b)=>a+b,0));
    assert.deepEqual(waits.filter(e=>e.file===0xff5c).map(e=>e.count),expected.values);
    assert.equal(waits.filter(e=>e.file===0xff6b).length,1);
    assert.equal(input.pending(),false);
  }
});

test('logo skip consumes only its key after one mandatory wait, later presentations still play',()=>{
  let injected=false;
  const {events,rng}=playback({inject(state,events,input){if(!injected&&state.phase==='logo'){input.enqueue(32);injected=true;}}});
  assert.equal(events.filter(e=>e.file===0xfc3b).length,1);
  assert.equal(count(events,'sprite'),27);assert.equal(count(events,'letter'),13);
  assert.equal(rng.seed,draws(1,13).seed);assert.equal(count(events,'consume'),1);
});

test('zoom skip draws first miniature then consumes key, skips fixed19 and all zoom-out draws',()=>{
  let injected=false;
  const {events}=playback({inject(state,events,input){if(!injected&&state.phase==='zoom'){input.enqueue(27);injected=true;}}});
  // First zoom frame's pending test occurs BEFORE its wait. Key delivered during
  // that wait is observed after drawing frame18, matching 0x10219 ordering.
  assert.equal(count(events,'sprite'),2);
  assert.equal(events.some(e=>e.file===0x10258),false);
  assert.equal(count(events,'letter'),13);
});

test('zoom-out skip waits the full fixed19, draws one outgoing frame then consumes its key',()=>{
  let injected=false;
  const {events,rng}=playback({inject(state,events,input){
    if(!injected&&events.some(e=>e.file===0x10258)) {input.enqueue(32);injected=true;}
  }});
  assert.equal(count(events,'sprite'),21);
  assert.equal(events.find(e=>e.file===0x10258).count,19);
  assert.equal(events.some(e=>e.file===0x10350||e.file===0x10388),false);
  assert.equal(rng.seed,draws(1,13).seed);
});

test('pending key before letters suppresses all thirteen RNG calls, not the letter draws',()=>{
  let injected=false;
  const {events,rng,input}=playback({inject(state,events,input){
    if(!injected&&events.some(e=>e.type==='sprite'&&e.name==='lmario_1')) {input.enqueue(32);injected=true;}
  }});
  assert.equal(count(events,'letter'),13);assert.equal(rng.seed,1);
  assert.equal(events.some(e=>e.file===0xff5c||e.file===0xff6b),false);
  assert.equal(count(events,'consume'),1);assert.equal(input.pending(),false);
});

test('key during letter delay skips remaining random delays, but cannot interrupt current source wait',()=>{
  let injected=false;
  const {events,rng}=playback({inject(state,events,input){if(!injected&&state.phase==='letters'){input.enqueue(32);injected=true;}}});
  assert.equal(count(events,'letter'),13);assert.equal(rng.seed,draws(1,1).seed);
  assert.equal(events.filter(e=>e.file===0xff5c).length,1);
});

test('key during seventh letter delay cannot cancel its following fixed12 wait',()=>{
  let injected=false;
  const {events,rng}=playback({inject(state,events,input){
    if(!injected&&events.filter(e=>e.type==='letter').length===7) {input.enqueue(27);injected=true;}
  }});
  assert.equal(count(events,'letter'),13);assert.equal(rng.seed,draws(1,7).seed);
  assert.equal(events.find(e=>e.file===0xff6b).count,12);
});

test('greeting hold skips after delivered key, Alt-X without option10 continues',()=>{
  for(const [key,waits] of [[27,1],[0x12d,114]]) {
    let injected=false;
    const {events}=playback({inject(state,events,input){if(!injected&&state.phase==='hold'){
      input.enqueue(...(key===0x12d?[0,45]:[key]));injected=true;
    }}});
    assert.equal(events.filter(e=>e.file===0xfe1d).length,waits);
    assert.equal(count(events,'fade'),4);
  }
});

test('option10 bypasses entire startup, repeated entries never reseed shared state',()=>{
  const skipped=playback({option10:true});assert.deepEqual(skipped.events,[]);assert.equal(skipped.rng.seed,1);
  const first=playback(),second=playback({seed:first.rng.seed});assert.equal(second.rng.seed,draws(1,26).seed);
  const controller=createStartup({rng:{seed:1},input:createPendingInput()});
  assert.throws(()=>controller.step(),/start first/);controller.start();assert.throws(()=>controller.start(),/already/);
  assert.throws(()=>controller.step({completedWaits:-1}),/source waits/);
});

test('menu callback RNG precedes bubble, then paced blink, persistent timer survives reentry',()=>{
  const rng={seed:1},input=createPendingInput(),timer=createMenuIdleState();input.enqueue(65);
  const menu=createMenuIdle({rng,input,timer,nowTicks:0});assert.equal(input.pending(),false);
  assert.deepEqual(menu.step({nowTicks:0}),[]);assert.equal(rng.seed,1);
  input.enqueue(49); // callback flags and RNG precede delivery of even an already-pending menu key
  const first=menu.step({nowTicks:1});assert.equal(input.pending(),true);assert.equal(first[0].type,'wait');assert.equal(rng.seed,draws(1,1,5,5).seed);
  assert.deepEqual(menu.step({nowTicks:2}),[]); // source blink is blocked on its first wait
  const middle=menu.step({nowTicks:3,completedWaits:2});
  assert.deepEqual(middle.filter(e=>e.type==='sprite').map(e=>e.name),['eyes0044_halfway','eyes0043_closed']);
  assert.equal(menu.state.waiting.count,2);
  assert.equal(menu.step({nowTicks:5,completedWaits:2})[0].name,'eyes0042_open');
  const seed=rng.seed;
  assert.deepEqual(menu.step({nowTicks:95}),[]); // exactly90 since blink return does not trigger
  assert.equal(menu.step({nowTicks:96})[0].type,'menu-bubble-request');assert.equal(rng.seed,seed);
  const repeated=createMenuIdle({rng,input,timer,nowTicks:96});
  assert.deepEqual(repeated.step({nowTicks:timer.lastTicks+timer.delayTicks}),[]);assert.equal(rng.seed,seed);
  repeated.step({nowTicks:timer.lastTicks+timer.delayTicks+1});assert.notEqual(rng.seed,seed);
});

test('demo menu bubble is immediate, no automatic gameplay request; clock reset preserves elapsed time',()=>{
  const rng={seed:1},input=createPendingInput(),timer=createMenuIdleState();
  const menu=createMenuIdle({rng,input,timer,nowTicks:100,demo:true});
  assert.equal(menu.step({nowTicks:100})[0].type,'menu-bubble-request');
  const seed=rng.seed,delay=timer.delayTicks;
  menu.rebaseClock(100,0);assert.equal(timer.lastTicks,0);assert.equal(menu.state.idleSince,0);
  const events=menu.step({nowTicks:0,fileDropdownOpen:true});assert.deepEqual(events,[]);assert.equal(rng.seed,seed);
  assert.equal(timer.delayTicks,delay);
});

test('Guest remains unsaved and is rejected by demo; explicit Demo preserves original other profile fields',()=>{
  const guest=newStudent('Guest');guest[28]=0;
  const view=new DataView(guest.buffer);view.setInt16(23,37,true);view.setInt16(25,5,true);view.setInt16(30,9,true);
  assert.equal(studentForSave(guest),null);assert.equal(readStudent(guest).demo,false);
  assert.throws(()=>createDemo({student:guest,rng:{seed:1},input:createPendingInput(),mode:1}),/Explicit Demo/);
  const student=demoStudent(guest),profile=readStudent(student);
  assert.equal(profile.name,manifest.demoProfile.name);assert.equal(profile.demo,true);assert.equal(profile.profilePresent,false);
  assert.equal(studentForSave(student),null);assert.equal(profile.goal,37);assert.equal(profile.lesson,5);
  assert.equal(profile.durations[0],9);
  const invalid=student.slice();invalid[28]=1;
  assert.throws(()=>createDemo({student:invalid,rng:{seed:1},input:createPendingInput(),mode:1}),/unsaved/);
});

test('each demo world emits exact target and RNG delay, source-specific input precedence',()=>{
  for(const [mode,bound,add] of [[1,10,10],[2,5,1],[3,3,1],[4,3,1]]) {
    const input=createPendingInput(),rng={seed:1};
    const demo=createDemo({student:demoStudent(newStudent('A')),rng,input,mode});
    let last;
    for(let i=0;i<30;i++) {
      const event=last=demo.poll({target:65,lowTick:mode===4?i+1:0});
      // Practice decrements in the waiting callback, so its 30th changed tick wakes.
      if(mode===4&&i===29) assert.equal(event.synthetic,true);else assert.equal(event.key,0);
    }
    const event=mode===4?last:demo.poll({target:65});
    assert.equal(event.synthetic,true);assert.equal(event.key,65);
    assert.equal(demo.state.countdown,draws(1,1,bound,add).values[0]);assert.equal(rng.seed,draws(1,1).seed);
    demo.state.countdown=0;input.enqueue(27);
    const precedence=demo.poll({target:66});assert.equal(precedence.key,66);
    assert.equal(input.pending(),mode!==1); // Outside reads and overwrites Esc. Others defer it.
    assert.equal(precedence.physicalKeyRead,mode===1);
    assert.equal(precedence.resetInactivity,mode!==4);
  }
});

test('shared stream orders title, menu callback, explicit Demo and synthetic key without reseeding',()=>{
  const {rng}=playback(),input=createPendingInput(),timer=createMenuIdleState();
  const menu=createMenuIdle({rng,input,timer,nowTicks:0});
  menu.step({nowTicks:1});menu.step({nowTicks:5,completedWaits:4});
  assert.equal(rng.seed,draws(1,14).seed);
  assert.equal(menu.step({nowTicks:6,demo:true})[0].type,'menu-bubble-request');
  assert.equal(rng.seed,draws(1,14).seed);
  const demo=createDemo({student:demoStudent(newStudent('A')),rng,input,mode:2});
  let event;for(let i=0;i<31;i++) event=demo.poll({target:70});
  assert.equal(event.key,70);assert.equal(rng.seed,draws(1,15).seed);
  const returned=demo.finish();assert.equal(readStudent(returned.student).mode,2);
  createMenuIdle({rng,input,timer,nowTicks:9}).step({nowTicks:9});
  assert.equal(rng.seed,draws(1,15).seed);
});

test('source abort keys in each Demo world and zero physical keys retain inactivity semantics',()=>{
  for(const mode of [1,2,3,4]) {
    const input=createPendingInput(),demo=createDemo({student:demoStudent(newStudent('A')),rng:{seed:1},input,mode});
    assert.throws(()=>demo.poll(),/Actual source target/);
    input.enqueue(0);assert.equal(demo.poll({target:65}).resetInactivity,mode!==4);
    input.enqueue(0,68);assert.equal(demo.poll({target:65}).abort,mode===1||mode===2);
    input.enqueue(27,66);assert.equal(demo.poll({target:65}).abort,true);
    assert.equal(input.pending(),true);demo.finish();assert.equal(input.pending(),false);
  }
});

test('Demo Alt-X requests quit only with option10, in every world',()=>{
  for(const mode of [1,2,3,4]) for(const option10 of [false,true]) {
    const input=createPendingInput();
    const demo=createDemo({student:demoStudent(newStudent('A')),rng:{seed:1},input,mode,option10});
    input.enqueue(0,45);
    const event=demo.poll({target:65});
    assert.equal(event.key,0x12d);assert.equal(event.quitRequest,option10);assert.equal(event.abort,false);
  }
  const proof=spawnSync('python3',['-B','-c',`import zipfile,pathlib
with zipfile.ZipFile(pathlib.Path.home()/'Downloads/Mario_Teaches_Typing_1992.zip') as z:
 b=z.read('MarioTea/MARIO/MARIO.EXE')
 print(b[0xbd71:0xbd8b].hex(),b[0x13b64:0x13b77].hex())`],{encoding:'utf8'});
  assert.equal(proof.status,0,proof.stderr);
  assert.equal(proof.stdout.trim(), '3d2d017402eb39b80a00509a740c5c11590bc074059a3c065c11 b80a00509a740c5c11590bc074059a3c065c11');
});

test('demo absent target consumes no RNG; abort and return flush queued keys, no double return',()=>{
  const input=createPendingInput(),rng={seed:1};
  const demo=createDemo({student:demoStudent(newStudent('A')),rng,input,mode:1});
  demo.state.countdown=0;assert.equal(demo.poll({targetPresent:false}).key,0);assert.equal(rng.seed,1);
  demo.state.countdown=2;input.enqueue(27,65,66);
  assert.equal(demo.poll({target:65}).abort,true);
  const result=demo.finish();assert.equal(result.resetHostClock,true);assert.equal(result.suppressResults,true);
  assert.equal(input.pending(),false);assert.equal(readStudent(result.student).demo,false);
  assert.throws(()=>demo.poll(),/returned/);assert.throws(()=>demo.finish(),/already/);
});

test('wait adapter samples actual low ticks, never invents catch-up waits, resets without input leakage',()=>{
  const input=createPendingInput(),controller=createStartup({rng:{seed:1},input});
  const clock=createSourceWaitClock();controller.start();
  assert.deepEqual(clock.sample(controller,0),[]);
  assert.equal(clock.sample(controller,100).filter(e=>e.type==='wait').length,1);
  assert.deepEqual(clock.sample(controller,100),[]);
  clock.reset(65535);assert.deepEqual(clock.sample(controller,65535),[]);
  assert.equal(clock.sample(controller,0).filter(e=>e.type==='wait').length,1);
  input.enqueue(65,66);clock.reset(0);clock.sample(controller,1);
  assert.equal(controller.state.phase,'letters'); // one key skipped logo, second skips the first zoom draw
  while(!controller.state.done) controller.step({completedWaits:1});
  input.enqueue(67);createMenuIdle({rng:{seed:1},input,timer:createMenuIdleState(),nowTicks:0});
  assert.equal(input.pending(),false);
  assert.throws(()=>clock.sample(controller,-1),/low tick/);
});

test('menu key/pointer pump return resets idle stopwatch but not random timer',()=>{
  const input=createPendingInput(),rng={seed:1},timer=createMenuIdleState();
  timer.delayTicks=1000;
  const menu=createMenuIdle({rng,input,timer,nowTicks:10});
  menu.restartPump(90);assert.deepEqual(menu.step({nowTicks:180}),[]);
  assert.equal(menu.step({nowTicks:181})[0].type,'menu-bubble-request');
  assert.equal(timer.lastTicks,0);assert.equal(timer.delayTicks,1000);assert.equal(rng.seed,1);
});

test('Practice synthetic NUL becomes CR and identical low ticks do not decrement countdown',()=>{
  const demo=createDemo({student:demoStudent(newStudent('A')),rng:{seed:1},input:createPendingInput(),mode:4,lowTick:65535});
  for(let i=0;i<100;i++) demo.poll({lowTick:65535,target:65});assert.equal(demo.state.countdown,30);
  demo.state.countdown=1;const key=demo.poll({lowTick:0,target:0});assert.equal(key.key,13);assert.equal(key.synthetic,true);
});

function resources() {
  const scenes=Object.fromEntries(Object.entries(manifest.scenes).map(([name,r])=>[name,{pixels:file(r.indicesPath),palette:file(r.palettePath)}]));
  const sprites=Object.fromEntries(Object.entries(manifest.sprites).map(([family,rows])=>[family,Object.fromEntries(rows.map(r=>[r.name,{sprite:r,pixels:file(r.indicesPath)}]))]));
  return {scenes,sprites,letters:manifest.letters,letterX:manifest.letterX};
}

test('decoded resource identities, indices and source zoom sampling, no screenshot reconstruction',()=>{
  assert.equal(manifest.letters,'TEACHESTYPING');assert.deepEqual(manifest.letterX,[124,138,152,169,183,198,213,233,247,262,276,282,298]);
  for(const rows of Object.values(manifest.sprites)) for(const r of rows) assert.equal(sha(file(r.indicesPath)),r.indicesSha256);
  for(const r of Object.values(manifest.scenes)) assert.equal(sha(file(r.indicesPath)),r.indicesSha256);
  const frames=startupZoomFrames(resources().sprites.GREET.smario_1);assert.equal(frames.length,20);
  for(let i=1;i<20;i++) {
    const a=frames[i-1],b=frames[i];let sy=0;
    for(let y=0;y<b.sprite.height;y++) {
      let sx=0;
      for(let x=0;x<b.sprite.width;x++) {
        assert.equal(b.pixels[y*b.sprite.width+x],a.pixels[sy*a.sprite.width+sx]);
        sx++;if(x%7===0)sx++;
      }
      sy++;if(y%7===0)sy++;
    }
  }
});

test('fade uses signed truncation, source duplicate initial write and exact final palette',()=>{
  const a=new Uint8Array(768).fill(45),b=new Uint8Array(768).fill(2),frames=startupFade(a,b);
  assert.equal(frames.length,14);assert.equal(frames[0][0],45);assert.equal(frames[1][0],45);
  assert.equal(frames[2][0],42);assert.deepEqual(frames.at(-1),b);assert.equal(a[0],45);
  assert.throws(()=>startupFade(a,b,0),/fade/);
});

test('last zoom draw remembers the source scaled6 rectangle, not the large image actually drawn',()=>{
  const front=new Uint8Array(64000),background=new Uint8Array(64000),data=resources();
  const renderer=createStartupRenderer({front,background,...data}),zoom=startupZoomFrames(data.sprites.GREET.smario_1);
  for(const event of playback().events) {
    if(event.type==='sprite'&&event.family==='zoom'&&event.name===7&&event.x===7) {
      const expected=front.slice();
      updateSprite(expected,background,{...zoom[7],x:7,y:3},{...zoom[6],x:50,y:24});
      renderer.apply(event);assert.deepEqual(front,expected);return;
    }
    if(['scene','sprite','letter','fade','palette'].includes(event.type)) renderer.apply(event);
  }
  assert.fail('Missing final zoom draw');
});

test('functional indexed renderer accepts full playback, exposes palette writes and fails missing resources',()=>{
  const front=new Uint8Array(64000),background=new Uint8Array(64000),data=resources();
  const renderer=createStartupRenderer({front,background,...data});let paletteWrites=0;
  for(const event of playback().events) if(['scene','sprite','letter','fade','palette'].includes(event.type)) paletteWrites+=renderer.apply(event).length;
  assert.equal(paletteWrites,59);assert.ok(front.some(v=>v!==0));
  assert.throws(()=>renderer.apply({type:'scene',name:'MISSING'}),/Missing/);
  assert.throws(()=>renderer.apply({type:'sound-request'}),/route/);
  assert.throws(()=>createStartupRenderer({front,background:front,...data}),/Distinct/);
});
