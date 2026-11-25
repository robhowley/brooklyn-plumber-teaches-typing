import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, openSync, readSync, closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createSetup} from '../setup.js';
import {createStudentStore, STORAGE_KEY} from '../storage.js';

// Authored flag probes for unit tests, NOT a replacement generated name table.
const flags = Array(256).fill(0);
for (const key of [32, 46, 48, 65, 66, 67, 68, 69, 70, 71, 72, 73, 97]) flags[key] = 1;
function harness(nameKeyFlags = flags, backing) {
  let raw = null;
  let writes = 0;
  const storage = backing ?? {
    getItem(key) { assert.equal(key, STORAGE_KEY); return raw; },
    setItem(key, value) { assert.equal(key, STORAGE_KEY); raw = value; writes++; },
  };
  const store = createStudentStore(() => storage);
  const setup = createSetup({store, nameKeyFlags});
  return {setup, store, storage, writes: () => writes};
}
const select = (setup, selector, argument) => setup.dispatch({type: 'select', selector, argument});
const key = (setup, key, byte = key) => setup.dispatch({type: 'name-key', key, byte});
function enterName(setup, name = '', character = 0) {
  select(setup, 2); select(setup, 3, character);
  for (const c of name) key(setup, c.charCodeAt(0));
}
function express(setup, keyset) {
  setup.dispatch({type: 'confirm-name'});
  select(setup, 5); select(setup, 14, 3);
  return select(setup, 17, keyset);
}

test('saved student count is independent of the source display-string hit gate', () => {
  const h = harness();
  assert.equal(h.setup.studentCount(), 0);
  enterName(h.setup, 'A');
  assert.equal(h.setup.studentCount(), 0);
  h.setup.dispatch({type:'confirm-name'});
  assert.equal(h.setup.studentCount(), 1);
  const reloaded = createSetup({store:h.store,nameKeyFlags:flags});
  assert.equal(reloaded.studentCount(), 1);
  enterName(reloaded, 'B');
  assert.equal(reloaded.studentCount(), 1);
  reloaded.dispatch({type:'confirm-name'});
  assert.equal(reloaded.studentCount(), 2);
  const failed = harness(flags,{getItem:()=>null,setItem(){throw new Error('refused');}});
  enterName(failed.setup, 'A');
  failed.setup.dispatch({type:'confirm-name'});
  assert.equal(failed.setup.studentCount(), 0);
});

test('all 15 character/keyset routes, exact source defaults, independent reload', () => {
  for (let character = 0; character < 3; character++) for (let keyset = 0; keyset < 5; keyset++) {
    const h = harness();
    enterName(h.setup, '', character);
    assert.equal(h.setup.snapshot().state, 3);
    const view = express(h.setup, keyset);
    assert.deepEqual(view, {state: 21, name: 'NONAME', character, mode: 3, keyset, durationSeconds: 300, duplicate: null, storageError: null});
    const record = h.store.load().value.students[0].record;
    const expected = Array(292).fill(0);
    expected[1] = keyset; expected[3] = character; expected[5] = 3;
    [2, 5, 5, 5, 10, 30, 50, 10].forEach((n, i) => { expected[21 + i * 2] = n; });
    [...'NONAME'].forEach((c, i) => { expected[274 + i] = c.charCodeAt(0); });
    assert.deepEqual(record, expected);
    const reloaded = createSetup({store: h.store, nameKeyFlags: flags});
    assert.equal(reloaded.snapshot().name, 'NONAME');
    assert.equal(select(reloaded, 39).state, 21);
    assert.equal(reloaded.snapshot().keyset, keyset);
    assert.equal(reloaded.snapshot().character, character);
  }
});

test('byte names, flag mask, eight-byte bound, backspace, Enter delivered only once', () => {
  const h = harness(); enterName(h.setup);
  key(h.setup, 8); assert.equal(h.setup.snapshot().name, '');
  for (const c of 'ABCDEFGHI') key(h.setup, c.charCodeAt(0));
  assert.equal(h.setup.snapshot().name, 'ABCDEFGH');
  key(h.setup, 8); key(h.setup, 97);
  assert.equal(h.setup.snapshot().name, 'ABCDEFGa');
  key(h.setup, 8);
  for (const [k, b] of [[0, 65], [255, 65], [-1, 65], [256, 65], [65, 0], [65, 256], [65, 0.5], [13, 13]]) key(h.setup, k, b);
  assert.equal(h.setup.snapshot().name, 'ABCDEFG');
  h.setup.dispatch({type: 'confirm-name'});
  assert.equal(h.setup.snapshot().state, 4);
  const writes = h.writes();
  h.setup.dispatch({type: 'confirm-name'}); key(h.setup, 13);
  assert.equal(h.writes(), writes);
  assert.equal(h.setup.snapshot().name, 'ABCDEFG');
});

test('duplicate dialog626 Cancel edits without writing; OK overwrites fresh bytes, not load existing', () => {
  const h = harness(); enterName(h.setup, 'A', 2); express(h.setup, 4);
  const file = h.store.load().value;
  file.students[0].record[100] = 199;
  h.store.save(file);
  const setup = createSetup({store: h.store, nameKeyFlags: flags});
  enterName(setup, 'a', 1);
  setup.dispatch({type: 'confirm-name'});
  assert.deepEqual(setup.snapshot().duplicate, {resource: 626});
  const writes = h.writes();
  key(setup, 66); select(setup, 5); setup.dispatch({type: 'confirm-name'});
  assert.equal(h.writes(), writes);
  assert.equal(setup.snapshot().name, 'a');
  setup.dispatch({type: 'duplicate-result', result: 2});
  assert.equal(setup.snapshot().state, 3);
  assert.equal(h.store.load().value.students[0].record[100], 199);
  setup.dispatch({type: 'confirm-name'});
  setup.dispatch({type: 'duplicate-result', result: 1});
  assert.equal(setup.snapshot().state, 4);
  const saved = h.store.load().value;
  assert.equal(saved.students.length, 1);
  assert.equal(saved.currentName, 'a');
  assert.equal(saved.students[0].record[3], 1);
  assert.equal(saved.students[0].record[100], 0);
});

test('load denial/invalid data is visible and cannot become an empty overwrite', () => {
  for (const storage of [
    {getItem() { throw Error(); }, setItem() { assert.fail('overwrite'); }},
    {getItem() { return '{'; }, setItem() { assert.fail('overwrite'); }},
  ]) {
    const {setup} = harness(flags, storage);
    assert.ok(setup.snapshot().storageError);
    enterName(setup, 'A');
    assert.equal(express(setup, 0).state, 3);
    assert.ok(setup.snapshot().storageError);
  }
  const setup = createSetup({store: createStudentStore(() => { throw Error(); }), nameKeyFlags: flags});
  assert.equal(setup.snapshot().storageError.code, 'unavailable');
});

test('failed writes block each persistent transition, leave saved bytes intact, retry is explicit', () => {
  const h = harness(); enterName(h.setup, 'A');
  const original = h.storage.setItem;
  h.storage.setItem = () => { throw Error(); };
  assert.equal(h.setup.dispatch({type: 'confirm-name'}).state, 3);
  assert.equal(h.setup.snapshot().storageError.code, 'write-failed');
  h.storage.setItem = original;
  h.setup.dispatch({type: 'confirm-name'}); select(h.setup, 5);
  const before = h.store.load().value;
  h.storage.setItem = () => { throw Error(); };
  assert.equal(select(h.setup, 14, 3).state, 5);
  assert.equal(h.setup.snapshot().mode, 0);
  assert.deepEqual(h.store.load().value, before);
  h.storage.setItem = original; select(h.setup, 14, 3);
  h.storage.setItem = () => { throw Error(); };
  assert.equal(select(h.setup, 17, 4).state, 14);
  assert.equal(h.setup.snapshot().keyset, 0);
  h.storage.setItem = original;
  assert.equal(select(h.setup, 17, 4).state, 21);
  assert.equal(h.setup.snapshot().storageError, null);
});

test('record preservation across reload and new-student save keeps other full records', () => {
  const h = harness(); enterName(h.setup, 'A'); express(h.setup, 1);
  const file = h.store.load().value;
  for (const p of [0, 7, 13, 100, 253, 290]) file.students[0].record[p] = 211;
  h.store.save(file);
  const setup = createSetup({store: h.store, nameKeyFlags: flags});
  const copy = setup.snapshot(); copy.name = 'CHANGED';
  assert.equal(select(setup, 39).name, 'A');
  assert.deepEqual(h.store.load().value, file);
  const other = createSetup({store: h.store, nameKeyFlags: flags});
  enterName(other, 'B'); express(other, 2);
  assert.deepEqual(h.store.load().value.students[0], file.students[0]);
});

test('unsupported modes, out-of-range selectors, invalid name table refuse without transitions', () => {
  assert.throws(() => harness([]), TypeError);
  const h = harness();
  select(h.setup, 17, 4); assert.equal(h.setup.snapshot().state, 1);
  select(h.setup, 2);
  for (const n of [-1, 3, 0.5, NaN]) assert.equal(select(h.setup, 3, n).state, 2);
  select(h.setup, 3, 0); h.setup.dispatch({type: 'confirm-name'}); select(h.setup, 5);
  for (const n of [1, 2, 4]) assert.equal(select(h.setup, 14, n).state, 5);
  select(h.setup, 14, 3);
  for (const n of [-1, 5, 0.5]) assert.equal(select(h.setup, 17, n).state, 14);
});

function studentHarness(count=22) {
  const students=Array.from({length:count},(_,i)=>{
    const name='S'+String(i).padStart(2,'0'),record=Array(292).fill(0);
    record[1]=i%5;record[3]=i%3;record[5]=3;record[11]=i;
    for(let j=0;j<8;j++)record[21+2*j]=j+1;
    record[100]=200+i;
    [...name].forEach((c,j)=>record[274+j]=c.charCodeAt(0));
    return {name,record};
  });
  let raw=JSON.stringify({schema:'mario2-students.v1',currentName:students[0]?.name??null,students});
  let denied=false;
  const h=harness(flags,{getItem:()=>raw,setItem(k,v){if(denied)throw Error();raw=v;}});
  return {...h,deny:v=>denied=v};
}
const click=(s,x,y)=>s.dispatch({type:'list-click',x,y});
test('preview scratch/display separate from live bytes, odd row19, scrolling and safety refusal',()=>{
  const h=studentHarness(),s=h.setup,before=h.store.load().value,live=s.studentContext().record;
  select(s,6);assert.equal(s.snapshot().students.length,19);
  click(s,589,230); // odd right edge, between the source scroll rectangles
  assert.equal(s.studentContext().displayName,'S09');
  click(s,588,385);
  assert.equal(s.studentContext().displayName,'S19');assert.equal(s.studentContext().scratchWpm,19);
  assert.deepEqual(s.studentContext().record,live);assert.deepEqual(h.store.load().value,before);
  for(let i=0;i<8;i++)click(s,610,300);
  assert.equal(s.snapshot().scroll,3);click(s,588,385);
  assert.match(s.snapshot().listError,/safety/);assert.equal(s.studentContext().displayName,'S19');
  click(s,610,100);assert.equal(s.snapshot().scroll,2);
  click(s,370,80);assert.equal(s.studentContext().displayName,'S02');
  const small=studentHarness(1).setup;select(small,6);click(small,354,80);
  assert.equal(small.studentContext().displayName,'S00');click(small,590,385);
  assert.equal(small.snapshot().scroll,0);
});
test('explicit Express load preserves292 bytes/settings and changes only selection metadata; denied writes do not apply',()=>{
  const h=studentHarness(),s=h.setup,before=h.store.load().value;
  select(s,6);click(s,370,112);h.deny(true);click(s,300,440);
  assert.equal(s.snapshot().state,6);assert.equal(s.studentContext().loadedOrigin,false);
  assert.deepEqual(h.store.load().value,before);assert.equal(s.snapshot().storageError.code,'write-failed');
  h.deny(false);click(s,300,440);
  assert.equal(s.snapshot().state,21);assert.equal(s.studentContext().loadedOrigin,true);
  assert.deepEqual(s.studentContext().record,before.students[2].record);
  assert.deepEqual(s.studentContext().durations,[1,2,3,4]);assert.deepEqual(s.studentContext().thresholds,[5,6,7,8]);
  assert.deepEqual(h.store.load().value.students,before.students);assert.equal(h.store.load().value.currentName,'S02');
  s.welcome();select(s,39,28);assert.equal(s.studentContext().loadedOrigin,true);
  s.welcome();select(s,6);click(s,1,1);assert.equal(s.studentContext().loadedOrigin,false);
  const reloaded=createSetup({store:h.store,nameKeyFlags:flags});assert.equal(reloaded.snapshot().name,'S02');assert.equal(reloaded.studentContext().loadedOrigin,false);
});
test('delete626 cancellation, refused persistence, selected-pointer clearing and retained live bytes',()=>{
  const h=studentHarness(2),s=h.setup,before=h.store.load().value,live=s.studentContext().record;
  select(s,6);click(s,370,80);click(s,450,440);
  assert.deepEqual(s.snapshot().deletePrompt,{resource:626,message:'OK to delete file S00.STU?'});
  s.dispatch({type:'delete-result',result:2});assert.deepEqual(h.store.load().value,before);
  click(s,450,440);h.deny(true);s.dispatch({type:'delete-result',result:1});
  assert.deepEqual(h.store.load().value,before);assert.ok(s.snapshot().deletePrompt);
  h.deny(false);s.dispatch({type:'delete-result',result:1});
  assert.equal(h.store.load().value.currentName,null);assert.deepEqual(h.store.load().value.students,[before.students[1]]);
  assert.deepEqual(s.studentContext().record,live);assert.equal(s.snapshot().preview,null);
  assert.equal(s.accepts({type:'select',selector:39,argument:28}),false); // saved count1, empty display
  click(s,370,80);assert.equal(s.accepts({type:'select',selector:39,argument:28}),true);
  click(s,450,440);s.dispatch({type:'delete-result',result:1});
  assert.equal(s.studentCount(),0);assert.deepEqual(s.studentContext().record,live);
});
test('argument28 gate is independent of selector; unsupported scene load is explicitly refused',()=>{
  const s=studentHarness(0).setup;
  assert.equal(s.accepts({type:'select',selector:39,argument:28}),false);
  assert.equal(s.accepts({type:'select',selector:28,argument:0}),true);
  for(let mode=1;mode<3;mode++) {
    const h=studentHarness(1),file=h.store.load().value;file.students[0].record[5]=mode;h.store.save(file);
    const setup=createSetup({store:h.store,nameKeyFlags:flags});select(setup,6);click(setup,370,80);click(setup,300,440);
    assert.equal(setup.snapshot().state,6);assert.match(setup.snapshot().listError,new RegExp('state '+(18+mode)));
    assert.equal(setup.studentContext().loadedOrigin,false);
  }
});

for(const character of [0,1,2]) for(const keyset of [0,1,2,3,4])
test(`Beginning manual/load writers and modal ${character}/${keyset}`,()=>{
  const h=harness();enterName(h.setup,'A',character);h.setup.dispatch({type:'confirm-name'});
  select(h.setup,5);select(h.setup,14,0);const entry=select(h.setup,17,keyset);
  assert.equal(entry.state,18);assert.equal(entry.durationSeconds,120);
  const manual=h.store.load().value;
  h.setup.beginTyping();h.setup.beginReport({speed:20,accuracy:100,elapsed:120,problem:'None!'});
  h.setup.finishReport();
  assert.deepEqual(h.store.load().value,manual);
  if(keyset===4){assert.equal(h.setup.snapshot().certificatePending,true);h.setup.certificateReturn();h.setup.certificateReturn();assert.equal(h.setup.studentContext().record[37],1);assert.equal(select(h.setup,39).state,19);}
  else assert.equal(select(h.setup,39).keyset,keyset+1);
  const s=createSetup({store:h.store,nameKeyFlags:flags});select(s,6);click(s,370,80);click(s,300,440);
  assert.equal(s.snapshot().state,18);assert.equal(s.studentContext().loadedOrigin,true);
  s.beginTyping();s.beginReport({speed:20,accuracy:100,elapsed:120,problem:'None!'});
  const teardown=h.store.load().value;assert.equal(teardown.students[0].record[17],0);assert.equal(teardown.students[0].record[11],0);
  s.finishReport();
  if(keyset===4){assert.deepEqual(h.store.load().value,teardown);s.finishReport();assert.equal(s.studentContext().record[37],0);s.certificateReturn();}
  const done=h.store.load().value.students[0].record;
  assert.equal(done[11],20);assert.equal(done[9],100);assert.equal(done[19],120);assert.equal(done[1],keyset===4?0:keyset+1);
  assert.equal(done[5],keyset===4?1:0);assert.equal(done[37],keyset===4?1:0);
});

// Optional source test reads the original executable ONLY as inert bytes, using
// the source-owner extent/hash pins. No extracted member or generated table is committed.
test('pinned source: actual name flags, reset/default and editing FILE slice hashes',
  {skip: !process.env.MARIO2_TEST_ISO}, () => {
    const pins = JSON.parse(readFileSync(new URL('../pins.json', import.meta.url)));
    const fd = openSync(process.env.MARIO2_TEST_ISO, 'r');
    const executable = Buffer.alloc(pins.executable.size);
    try {
      assert.equal(readSync(fd, executable, 0, executable.length, pins.executable.image_extents[0].image_offset), executable.length);
    } finally { closeSync(fd); }
    const hash = b => createHash('sha256').update(b).digest('hex');
    assert.equal(hash(executable), pins.executable.sha256);
    for (const [a, b, sha] of [
      [0x2273f, 0x2283f, 'ef03ba64464890ccee91900315ab3f38d0340a429bcc542521379e08977d0012'],
      [0x1d700, 0x1d750, 'b4e584bf3724c032a2a4b6a60f6eb92b2f9a2e6c234607e2a6b2d64e18e33e21'],
      [0x132d4, 0x13312, '100fa7008290227b2341402fb338eed427d40e37373962a15b4f63baf0f7a2b2'],
      [0x17d16, 0x17e58, '590121481b4afd9955316b099d1142ded54af8488c20d82f92070a1578c6fc15'],
      [0x14032, 0x140ec, 'f9d18c21c8522f6292b3e7b40ca1dd2523aca8716b4f0175489b620e08bcde85'],
      [0x14132, 0x14182, 'da5657445ed5d51320b4f2d596f55eb61f7ec74347cca46fe7565d5ef5292345'],
      [0x14220, 0x1426c, 'b229a99e9e1c25390ba50ef4d88046345a462dd9aba70b33142be000599f369a'],
      // RT_DIALOG626, source OK/Cancel template (not quit dialog624).
      [0x15f8000, 0x15f8200, '147f289d7b40c58e3d6bae25f6ba3321dc7936f34e5eb41ad2705074dbb09a8f'],
    ]) assert.equal(hash(executable.subarray(a, b)), sha, `FILE ${a.toString(16)}..${b.toString(16)}`);
    const sourceFlags = executable.subarray(0x2273f, 0x2283f);
    for (let n = 0; n < 256; n++) {
      const {setup} = harness(sourceFlags); enterName(setup);
      key(setup, n);
      assert.equal(setup.snapshot().name, n >= 32 && n <= 126 ? String.fromCharCode(n) : '', `source key ${n}`);
    }
  });
