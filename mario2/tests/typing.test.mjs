import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, openSync, readSync, closeSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import {createTyping, normalizeTypingKey, createRandom, seedFromCalendar, createLessonRows, typingSpeed} from '../typing.js';

// Independent static vectors, not observed original execution. All executable
// citations: /MARIO/WINMARIO.EXE;1 SHA256
// 39a4fb53384afbfec13063c2f4c67d51013b1f8ea494788c88f1ac6c12f47f22.
const bytes = text => Array.from(text, c => c.charCodeAt(0));
const lesson = text => ({bytes: bytes(text), startOffset: 0});
const typing = (retained = {}, text = 'ab ', durationSeconds = 120, nowMs = 100000) => createTyping({lesson: lesson(text), durationSeconds, nowMs, retained});
const sample = (engine, ms) => { let out; for (let i = 0; i < 5; i++) out = engine.acceptedUpdate(ms); return out; };

test('R1 FILE 0x1037a..0x103c6 low16 seeds and explicit shared RNG stream', () => {
  for (const [seed, state, draw] of [[0,2531011,38],[1,2745024,41],[65535,1142971078,17440],[65536,2531011,38],[0x12345678,444955483,6789],[-1,1142971078,17440]]) {
    const rng = createRandom(seed); assert.equal(rng.next(), draw); assert.equal(rng.snapshot(), state);
  }
  const rng = createRandom(1);
  assert.deepEqual([rng.next(), rng.next(), rng.next()], [41,18467,6334]);
});

test('independently audited R1 tuples, historical boundaries and TZ, never host Date', () => {
  // /tmp/mtt2-r1-audit.8XTdqA/REPORT.md and vectors.json, FILE
  // 0x12160..0x1225d, 0x12bca..0x12e07. Expected seeds are independent constants.
  for (const [year,month,day,hour,minute,second,want] of [
    [1996,4,7,1,59,59,37407],[1996,4,7,2,0,0,33808],
    [1996,10,27,0,59,59,5759],[1996,10,27,1,0,0,9360],
    [2026,3,15,12,0,0,4032],[2026,11,1,0,0,0,61824],
  ]) assert.equal(seedFromCalendar({year,month,day,hour,minute,second}), want);
  for (const [tz,want] of [[null,10336],['',10336],['PST8',13936],['PST8PDT',10336],['UTC0',50672],['ABC-5:30:45XYZ',27227],['ABC+5:30:45',4981]])
    assert.equal(seedFromCalendar({year:1996,month:7,day:1,hour:12,minute:34,second:56,tz}),want);
  for (const hundredths of [0,1,99]) assert.equal(seedFromCalendar({year:1996,month:12,day:31,hour:23,minute:59,second:59,hundredths}),6527);
  const race = {firstDate:[1996,12,31],secondDate:[1997,1,1],hour:23,minute:59,second:59};
  assert.equal(seedFromCalendar(race),6527);
  assert.equal(seedFromCalendar({...race,hour:0,minute:0,second:0}),6528);
  // Signed16 boundary ordinal307 in October2059 keeps DST on October31.
  const future = {year:2059,month:10,day:31,hour:23};
  assert.equal(seedFromCalendar(future), (seedFromCalendar({...future,tz:'PST8'}) - 3600) & 65535);
  assert.throws(() => seedFromCalendar({...future,tz:'bad'}), /Unsupported/);
});

test('FILE 0x16de6..0x16f8c Caps XOR Shift also affects digits and punctuation', () => {
  for (const [shift,capsLock,letter,digit,punct] of [[false,false,97,49,59],[true,false,65,33,58],[false,true,65,33,58],[true,true,97,49,59]]) {
    for (const [virtualKey,want] of [[65,letter],[49,digit],[186,punct]]) assert.equal(normalizeTypingKey({virtualKey,shift,capsLock}),want);
  }
  for (const virtualKey of [13,16,27]) assert.equal(normalizeTypingKey({virtualKey}),0);
  assert.equal(normalizeTypingKey({virtualKey:220,shift:true}),124);
});

test('FILE 0x32f4..0x3353 masked tilde, whitespace, cyclic EOF and retained previous', () => {
  const source = {bytes:[160,126,225,9,13,10,32,98,126],startOffset:0};
  const rows = createLessonRows(source,{previousNormalized:32}); rows.fill(0);
  assert.equal(String.fromCharCode(...rows.snapshot().rows[0].slice(0,9)), 'a b a b a');
  assert.equal(rows.snapshot().rows[0][34],0);
  const a = createLessonRows(lesson('ab')); a.fill(0);
  assert.equal(String.fromCharCode(...a.snapshot().rows[0].slice(0,34)), 'ab'.repeat(17));
});

test('low-level only: Evaluation moved NUL, dirty terminator, pending34/35 (FILE 0x3728..0x383f)', () => {
  const memory = new Uint8Array(282).fill(88);
  const a = createLessonRows(lesson('x '),{memory,pending:bytes('a'.repeat(34))});
  assert.equal(a.fill(0,true),69);
  assert.equal(a.snapshot().memory[34],88); // NOT repaired
  assert.equal(a.snapshot().memory[69],0);
  assert.deepEqual(a.snapshot().pending,bytes('x')); // scanned even with remaining -1
  const b = createLessonRows(lesson('x '),{memory,pending:bytes('b'.repeat(35))});
  assert.equal(b.fill(0,true),34);
  assert.equal(b.snapshot().offset,0); assert.equal(b.snapshot().pending.length,35);
  assert.equal(b.fill(1,true),69); assert.equal(b.snapshot().pending.length,35);
  // Mr./Mrs. suppress period spacing. Ordinary periods append a space.
  const c = createLessonRows(lesson('Mr. Mrs. done. ')); c.fill(0,true);
  assert.equal(String.fromCharCode(...c.snapshot().rows[0].slice(0,16)), 'Mr. Mrs. done.  ');
});

test('ordinary repeats, wrong expected histogram and ordered callbacks (FILE 0x16b00..0x16b32)', () => {
  const t = typing();
  const wrong = t.keyDown(120);
  assert.deepEqual(wrong.effects.map(e => e.type),['error','stats','inactivity-reset']);
  assert.equal(wrong.view.histogram[97],1); assert.equal(wrong.view.histogram[120],0);
  const right = t.keyDown(97);
  assert.deepEqual(right.effects.map(e => e.type),['success','glyph','stats','inactivity-reset']);
  assert.equal(right.view.cursor,1); assert.equal(right.view.typedLine[0],97);
  t.keyDown(98); t.keyDown(97); // ordinary repeated keydowns are not suppressed
  assert.equal(t.snapshot().counters.total,4);
  const before = t.snapshot(); t.keyDown(normalizeTypingKey({virtualKey:13})); t.keyDown(0);
  assert.deepEqual(t.snapshot(),before); // key-up/char are deliberately absent from this interface
  const detached = t.snapshot(); detached.rows[0][0]=0; detached.histogram[97]=300;
  assert.notDeepEqual(t.snapshot(),detached);
});

test('lookahead discards trailing spaces and shift copies complete 35-byte rows', () => {
  const t = typing({},'a' + ' '.repeat(1));
  // Distinct authored input gives 17 a characters per row; last is column32.
  for (let i=0;i<16;i++) {t.keyDown(97);t.keyDown(32);}
  const before=t.snapshot(); const out=t.keyDown(97);
  assert.equal(before.cursor,32); assert.equal(out.view.cursor,0);
  assert.deepEqual(out.effects.map(e=>e.type),['success','row-shift','stats','inactivity-reset']);
  assert.deepEqual(out.view.rows[0],before.rows[1]);
  assert.ok(out.view.typedLine.every(b=>b===null));
});

test('retained +962=0/1/2/3 and old +93a bypass, repaint and true entry', () => {
  for (const specialState of [0,1,2,3]) {
    const t=typing({specialState,specialByte:33,oldTypedByte:90,specialCountdown:8,samplePhase:3,pendingFinish:false});
    sample(t,102000);
    const before=t.snapshot(); const out=t.keyDown(33);
    if(specialState===2) {
      assert.equal(out.view.retained.specialState,3); assert.equal(out.view.retained.specialCountdown,0);
      assert.equal(out.view.typedLine[0],90); assert.equal(out.view.counters.total,0);
      assert.equal(out.view.inactivity,2); assert.deepEqual(out.effects.map(e=>e.type),['glyph']);
    } else assert.equal(out.view.counters.errors,1);
    const repaint=t.snapshot();assert.deepEqual(t.snapshot(),repaint);
    const entered=t.reenter({lesson:lesson('cd '),durationSeconds:60,nowMs:500000}).view;
    assert.equal(entered.retained.specialState,specialState===2?3:specialState);
    assert.equal(entered.samplePhase,before.samplePhase);
    assert.equal(entered.counters.total,0);assert.equal(entered.elapsed,0);
    assert.ok(entered.histogram.every(n=>n===0));assert.equal(entered.expectedByte,99);
  }
  assert.equal(typing().snapshot().retained.specialState,0);
});

test('fifth delivered visit, capped catch-up stores ACTUAL sample, deferred expiry, no focus rebase', () => {
  const t=typing({samplePhase:4},'ab ',2);
  const out=t.acceptedUpdate(110999); // delivered callback after blur is still accepted
  assert.equal(out.view.elapsed,2);assert.equal(out.view.inactivity,2);
  assert.equal(out.view.retained.specialCountdown,65535); // unconditional source word decrement
  assert.equal(out.view.samplePhase,0);assert.equal(out.view.sampledClock,110);
  assert.equal(out.view.pendingFinish,true);assert.ok(!out.effects.some(e=>e.type==='finish'));
  assert.equal(t.keyDown(97).view.counters.total,1); // input between sample and consumption
  assert.deepEqual(t.acceptedUpdate(111000).effects,[{type:'finish'}]);
  assert.equal(t.snapshot().running,false);
  const u=typing({samplePhase:4});u.acceptedUpdate(110000);
  sample(u,110000);assert.equal(u.snapshot().elapsed,2); // no lingering 8-second debt
  for(let i=0;i<4;i++)u.acceptedUpdate(111999);
  assert.equal(u.snapshot().elapsed,2);u.acceptedUpdate(111999);assert.equal(u.snapshot().elapsed,3);
  // Unsigned difference, not a backwards-clock clamp.
  const v=typing({samplePhase:4});v.acceptedUpdate(99000);assert.equal(v.snapshot().elapsed,2);
});

test('source-width counters/histogram and WIN-0012 speed vectors, not generic WPM', () => {
  const t=typing();for(let i=0;i<65536;i++)t.keyDown(120);
  assert.equal(t.snapshot().counters.total,0);assert.equal(t.snapshot().counters.errors,0);assert.equal(t.snapshot().histogram[97],0);
  for(const [total,errors,elapsed,divisor,want] of [[100,10,60,5,18],[100,10,60,4,22],[10,20,60,5,0],[65535,0,1,5,65524],[50,0,65537,5,600],[50,0,65536,5,null],[50,0,0,5,0]])
    assert.equal(typingSpeed({total,errors,elapsed,divisor}),want);
});

// Disc-only independent reader. Reads inert pinned bytes, never imports the
// build decoder or research model. Runtime tests above require no disc.
const iso=process.env.MARIO2_TEST_ISO || `${homedir()}/Downloads/Mario Teaches Typing 2 (1997)(Interplay)[Mac-PC].iso`;
const sha=data=>createHash('sha256').update(data).digest('hex');
function expandSZDD(raw) {
  const ring=Buffer.alloc(4096,32), out=[];let write=4080,pos=14;
  while(out.length<raw.readUInt32LE(10)) {
    const control=raw[pos++];
    for(let bit=0;bit<8 && out.length<raw.readUInt32LE(10);bit++) {
      if(control & 1<<bit) {const value=raw[pos++];out.push(value);ring[write]=value;write=(write+1)%4096;}
      else {const lo=raw[pos++],hi=raw[pos++],at=lo+((hi&240)<<4),count=(hi&15)+3;
        for(let j=0;j<count;j++){const value=ring[(at+j)%4096];out.push(value);ring[write]=value;write=(write+1)%4096;}}
    }
  }
  return Buffer.from(out);
}
test('all five pinned lessons, every legal delimiter start and cyclic EOF, independent inert disc vectors', {skip:!existsSync(iso)}, () => {
  const pins=JSON.parse(readFileSync(new URL('../pins.json',import.meta.url)));
  const fd=openSync(iso,'r');
  try {
    for(const [index,pin] of pins.lessons.entries()) {
      const raw=Buffer.alloc(pin.source.size);readSync(fd,raw,0,raw.length,pin.source.image_extents[0].image_offset);
      assert.equal(sha(raw),pin.source.sha256,pin.source.path);
      const expanded=pin.compressed?expandSZDD(raw):raw;
      assert.equal(sha(expanded),pin.expanded_sha256,pin.source.path);
      assert.equal(expanded.length,[1059,827,1081,1341,1805][index]);
      const delimiters=Array.from(expanded.keys()).filter(i=>(expanded[i]&127)===126);
      assert.equal(delimiters.length,[27,12,15,17,5][index]);
      for(let draw=0;draw<delimiters.length;draw++) {
        const startOffset=draw?delimiters[draw-1]:0;
        // Independent stream construction by cyclic concatenation and regex,
        // with row-leading space rejection. Enough cycles to cross EOF twice.
        const rotated=Buffer.concat([expanded.subarray(startOffset),expanded.subarray(0,startOffset)]);
        let stream=String.fromCharCode(...Buffer.concat(Array(8).fill(rotated)).map(b=>b&127)).replaceAll('~','').replace(/[\r\n\t]/g,' ').replace(/ +/g,' ');
        const rows=createLessonRows({bytes:expanded,startOffset},{previousNormalized:32});
        for(let row=0;row<Math.ceil(expanded.length*2/34);row++) {
          stream=stream.replace(/^ +/,'');const expected=stream.slice(0,34);stream=stream.slice(34);
          rows.fill(0);assert.equal(String.fromCharCode(...rows.snapshot().rows[0].slice(0,34)),expected,`${pin.source.path} ${pin.source.sha256} start FILE${startOffset} row${row}`);
        }
      }
    }
  } finally {closeSync(fd);}
});
