import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as r from '../../recovered/runtime/runtime.mjs';
import { timer } from '../../recovered/control/scoring.mjs';
import { createOutdoor, makeBonus } from '../../recovered/outdoor/outdoor.mjs';
const bytes = s => Uint8Array.from(Buffer.from(s, 'latin1'));
const stream = s => r.loadCorpus(bytes(s));
const text = b => Buffer.from(b.subarray(0, b.indexOf(0))).toString('latin1');
const evidence = JSON.parse(readFileSync(new URL('../../analysis/runtime/evidence.json', import.meta.url)));
const corpora = JSON.parse(readFileSync(new URL('../../analysis/runtime/corpora.json', import.meta.url)));

test('evidence spans retain hashes and decisive instruction constants', () => {
  for (const span of Object.values(evidence.spans))
    assert.equal(createHash('sha256').update(Buffer.from(span.hex,'hex')).digest('hex'), span.sha256);
  const at = (name, offset, count) => {
    const span = evidence.spans[name];
    return Buffer.from(span.hex,'hex').subarray(offset - Number(span.start), offset - Number(span.start) + count).toString('hex');
  };
  assert.equal(at('random',0x380f,6), 'ba5a01b8354e');
  assert.equal(at('random',0x37fc,6), 'c706363c0000');
  assert.equal(at('seed-startup',0x126ae,5), '9af6090000');
  assert.equal(at('practice-lines',0xb47d,3), '83fe20');
  assert.equal(at('bonus-init',0x14f38,3), 'a31450');
  assert.equal(at('timer', 0x15b03, 2), '7518'); // duplicate resume skips baseline replacement
  assert.equal(at('timer', 0x15b28, 2), '7439'); // duplicate stop skips accumulation
  assert.equal(at('timer', 0x15b48, 8), '262b5723261b4725'); // 32-bit subtract with borrow
  assert.equal(at('option-query', 0x15084, 2), '7c07'); // signed level < threshold
  assert.equal(evidence.data['0x2892'].hex, 'ffff');
  assert.equal(evidence.data['0x295f'].hex, '4b574400'); // KWD, not sound-option bits
  assert.equal(at('font-startup', 0x12643, 3), 'b8b54f');
  assert.equal(at('font-loader', 0x1b7fc, 4), '2689470b'); // descriptor+11 = DS:4fc0
  assert.equal(at('font-loader', 0x1b93a, 4), '262b4707'); // suffix minus first code
  assert.equal(at('outdoor-free', 0x12d2c, 3), 'b81e00'); // RIX op30 frees scene
  assert.equal(at('rix-services', 0x1c623, 3), 'b80a00'); // then op10 clears descriptor
  assert.equal(at('rix-services', 0x1ca26, 2), '1e00');
  assert.equal(at('rix-services', 0x1ca32, 2), '2735'); // op30 -> 0x19090+0x3527
  const fnt = evidence.fonts['MarioTea/MARIO/FONT7H.FNT'];
  const gsk = evidence.fonts['MarioTea/MARIO/FONT7H.GSK'];
  for (const entry of [fnt, gsk]) assert.equal(createHash('sha256').update(Buffer.from(entry.hex, 'hex')).digest('hex'), entry.sha256);
  assert.equal(Buffer.from(fnt.hex, 'hex').toString('ascii'), 'F32\r\nN96\r\nW10\r\nH10\r\n');
  const names = Buffer.from(gsk.hex, 'hex').toString('ascii').trim().split(/\r?\n/).map(line => line.split(':')[0]);
  assert.deepEqual(names, Array.from({ length: 96 }, (_, i) => `font7_${i + 32}`));
  const table = Buffer.from(evidence.spans['stats-dispatch-table'].hex,'hex');
  assert.equal(table.readUInt16LE(0), 10);
  assert.equal(table.readUInt16LE(24) + 0x15960, 0x159c0);
  assert.equal(evidence.data['0x3c34'].hex,'01000000');
  assert.equal(evidence.data['0x41b3'].hex,'00000000');
  assert.ok(Buffer.from(evidence.data['0x41c3'].hex,'hex').every(b=>b===0));
});

test('pending/read are distinct source operations, including incomplete extended prefixes', () => {
  const at = (name, offset, count) => {
    const span = evidence.spans[name];
    return Buffer.from(span.hex, 'hex').subarray(offset - Number(span.start), offset - Number(span.start) + count).toString('hex');
  };
  assert.equal(at('keyboard-pending', 0x4de7, 4), 'b40bcd21');
  assert.equal(at('keyboard-read', 0x4a52, 5), 'b80007cd21');
  assert.equal(at('keyboard-services', 0x1926c, 2), '740a');
  assert.equal(at('keyboard-services', 0x19273, 3), '050001');
  assert.equal(at('water-loop', 0x17943, 12), '9adb1f00000bc07403e9ba00');
  assert.equal(at('castle-input', 0xbd15, 5), '9adb1f0000');
  const input = r.createPendingInput();
  assert.equal(input.pending(), false);
  assert.throws(() => input.consume(), /would block/);
  input.enqueue(0, 0x44, 65, 0xe0, 0x2d, 10);
  assert.equal(input.pending(), true);
  assert.equal(input.pending(), true); // checks never eat the F10 prefix
  assert.equal(input.consume(), 0x144);
  assert.equal(input.pending(), true); // Water must skip movement with remaining input
  assert.equal(input.consume(), 65);
  assert.equal(input.consume(), 0x12d);
  assert.equal(input.consume(), 10); // ignored by the world, still consumed
  assert.equal(input.pending(), false);
  for (const prefix of [0, 0xe0]) {
    input.enqueue(prefix);
    assert.equal(input.consume(), prefix); // no waiting for a second byte
    input.enqueue(0x44);
    assert.equal(input.consume(), 0x44);
  }
  input.enqueue(65, 66, 0, 0x44);
  input.flush();
  assert.equal(input.pending(), false);
  assert.throws(() => input.enqueue(65, 256), /raw keyboard bytes/);
  assert.equal(input.pending(), false);
});

test('same/cross-world entry retains reader and Practice clocks without retaining buffers', () => {
  assert.equal(evidence.data['0x40aa'].hex.slice(0, 4), '0000');
  assert.equal(evidence.data['0x41b3'].hex, '00000000');
  const water = stream(' A');
  assert.equal(r.nextWater(water), 32);
  const practice = r.createPractice(stream('a\\n'), 0);
  assert.equal(r.practiceInput(practice, 97, 0x7fffffff), 'advance-one-byte');
  assert.equal(r.practiceInput(practice, 98, 1), 'retain-target');
  assert.equal(r.practiceInput(practice, 10, 2), 'ignored');
  const outside = createOutdoor({ bytes: bytes('A'), seed: 1 });
  assert.equal(outside.attempts, 0);
  const waterAgain = r.loadCorpus(bytes('  B'), water.previousWater);
  assert.equal(r.nextWater(waterAgain), 66); // source DS:40aa was never reset by other readers
  const again = r.createPractice(stream('b\\n'), practice.lastCorrect);
  assert.equal(again.lastCorrect, 0x7fffffff);
  assert.equal(again.index, 0);
  assert.equal(again.attempts, 0);
  assert.equal(again.rows[33], 98);
  r.practiceInput(again, 98, 0x80000000);
  assert.equal(again.lastCorrect, -2147483648);
});

test('title pending polls preserve shared RNG and Outdoor uses previous duration before reset', () => {
  const input = r.createPendingInput(), rng = { seed: 1 };
  input.enqueue(65);
  for (let i = 0; i < 13; i++) assert.equal(r.titleDelay(rng, input.pending()), null);
  assert.equal(rng.seed, 1);
  input.flush();
  // Independent source recurrence, not values recorded from JS under test.
  let expected = 1n;
  for (let i = 0; i < 13; i++) {
    expected = (expected * 0x015a4e35n + 1n) & 0xffffffffn;
    assert.equal(r.titleDelay(rng, input.pending()), 4 + Number(((expected >> 16n) & 32767n) * 4n / 32768n));
  }
  for (const duration of [0, 120, -2147483648]) {
    const bonus = makeBonus(rng.seed, duration, false, 7);
    let seed = BigInt(rng.seed), draw;
    for (let i = 0; i < 5; i++) { seed = (seed * 0x015a4e35n + 1n) & 0xffffffffn; draw = (seed >> 16n) & 32767n; }
    const product = BigInt.asIntN(32, draw * BigInt.asIntN(32, BigInt(duration) - 30n));
    assert.equal(bonus.countdown, Number(BigInt.asIntN(16, 15n + product / 32768n)));
    assert.equal(bonus.seed, Number(seed));
    assert.equal(makeBonus(rng.seed, duration, true).seed, Number(seed));
  }
});

test('bonus and host pause reuse source timer stop/resume across signed tick wrap', () => {
  let clock = { ticks: 0, running: false };
  clock = timer(clock, 300, 0x7ffffffe);
  clock = timer(clock, 310, 0x80000001);
  assert.equal(clock.ticks, 3);
  clock = timer(clock, 310, 500); // repeated stop cannot count cinematic time
  clock = timer(clock, 100, 600);
  assert.equal(clock.ticks, 3);
  clock = timer(clock, 300, 700);
  clock = timer(clock, 300, 800); // repeated resume must not replace baseline
  clock = timer(clock, 100, 718);
  assert.equal(clock.ticks, 21);
  clock = timer(clock, 320, 900);
  assert.equal(clock.ticks, 0);
  assert.equal(clock.running, false);
});

test('srand uses low16 time, and recurrence agrees with exact integer product', () => {
  assert.equal(r.seedFromTime(0x1234abcd), 0xabcd);
  assert.equal(r.seedFromTime(-1), 65535);
  for (const seed of [0,1,65535,0x80000000,0xffffffff]) {
    const state = {seed};
    let reference = BigInt(seed);
    for (let i=0;i<100;i++) {
      reference = (reference * 0x015a4e35n + 1n) & 0xffffffffn;
      const value = r.random15(state);
      assert.equal(state.seed, Number(reference));
      assert.equal(value, Number((reference >> 16n) & 32767n));
    }
  }
});

test('bounded random is signed low32 multiply /32768, low16 return', () => {
  for (let draw=0;draw<32768;draw++) {
    assert.equal(r.scaleRandom(draw,1),0);
    assert.equal(r.scaleRandom(draw,2), draw < 16384 ? 0 : 1);
    assert.equal(r.scaleRandom(draw,250),Math.floor(draw*250/32768));
  }
  assert.equal(r.scaleRandom(32767,-30),-29);
  const product = BigInt.asIntN(32,32767n*0x7fffffffn);
  assert.equal(r.scaleRandom(32767,0x7fffffff),Number(BigInt.asIntN(16,product/32768n)));
});

test('DOS calendar conversion does not use hundredths, browser TZ, or BIOS ticks', () => {
  const t={year:1980,month:1,day:1,hour:0,minute:0,second:0,timezoneSeconds:0,daylightActive:false};
  assert.equal(r.dosTimeSeconds(t),315532800);
  assert.equal(r.dosTimeSeconds({...t,month:3}),320716800);
  assert.equal(r.dosTimeSeconds({...t,timezoneSeconds:18000,daylightActive:true}),315547200);
  assert.equal(r.dosTimeSeconds({...t,year:1981})-r.dosTimeSeconds(t),366*86400);
});

test('normalization retains LF, TAB, NUL, backtick and signed bytes', () => {
  const s=stream('A\r\n\t`\x00\x80~B\x1aZ');
  assert.deepEqual([...s.bytes],[126,65,10,9,96,0,128,126,66]);
  assert.equal(s.delimiters,2);
  assert.deepEqual(Array.from({length:8},()=>r.nextCorpus(s)),[65,10,9,96,0,-128,66,65]);
});

test('rewind skips both delimiter kinds and counts LF/SPACE; zero does nothing', () => {
  const s=stream('A~`B\n C');
  assert.equal(r.nextPractice(s),65);
  assert.equal(r.nextPractice(s),66);
  r.rewindCorpus(s,1);
  assert.equal(r.nextPractice(s),66);
  r.rewindCorpus(s,2);
  assert.equal(r.nextPractice(s),65);
  const index=s.index; r.rewindCorpus(s,0); assert.equal(s.index,index);
  s.index=0; r.rewindCorpus(s,1); assert.equal(r.nextPractice(s),67);
});

test('random start scans from existing cursor; initial delimiter causes duplicate first-block weighting', () => {
  const s=stream('A~B~C');
  // Force bounded result 1 through independently known rand value from seed.
  let seed=0; while (true) { const probe={seed}; if(r.boundedRandom(probe,3)===1) break; seed++; }
  r.selectCorpusSegment(s,{seed});
  assert.equal(s.index,1); assert.equal(r.nextCorpus(s),65);
  r.nextCorpusSegment(s); assert.equal(r.nextCorpus(s),66);
  r.nextCorpusSegment(s); assert.equal(r.nextCorpus(s),67);
});

test('water collapses whitespace, castle preserves repeats, practice retains LF and skips backtick', () => {
  const water=stream('A\n \t`B'), castle=stream('A\n \t`B'), practice=stream('A\n \t`B');
  assert.deepEqual(Array.from({length:4},()=>r.nextWater(water)),[65,32,96,66]);
  assert.deepEqual(Array.from({length:6},()=>r.nextCastle(castle)),[65,32,32,32,96,66]);
  assert.deepEqual(Array.from({length:5},()=>r.nextPractice(practice)),[65,10,32,9,66]);
});

test('practice LF path preserves leading spaces; full row path trims them', () => {
  assert.equal(text(r.practiceLine(stream('  hello\n'))),'  hello');
  const s=stream('  '+ 'a '.repeat(20));
  assert.equal(text(r.practiceLine(s)), 'a '.repeat(14)+'a');
});

test('32 characters followed by space consume peek; following LF is NOT a space', () => {
  const s=stream('A'.repeat(32)+' B\n');
  assert.equal(text(r.practiceLine(s)),'A'.repeat(32));
  assert.equal(text(r.practiceLine(s)),'B');
  const stuck=stream('A'.repeat(32)+'\nB');
  assert.equal(text(r.practiceLine(stuck)),'A'.repeat(32));
  assert.equal(stuck.index,1);
  assert.equal(text(r.practiceLine(stuck)),'A'.repeat(32));
});

test('long word repeats rather than conventional hard wrapping; trailing fragment rewinds', () => {
  const s=stream('A'.repeat(40)+' ');
  assert.equal(text(r.practiceLine(s)),'A'.repeat(32));
  assert.equal(s.index,1);
  const wrapped=stream('A'.repeat(28)+' xyz-more\n');
  assert.equal(text(r.practiceLine(wrapped)),'A'.repeat(28));
  assert.equal(text(r.practiceLine(wrapped)),'xyz-more');
});

test('strcpy semantics stop at embedded NUL even though source cursor consumes later bytes', () => {
  const s=stream('A\x00BC\nD\n');
  assert.equal(text(r.practiceLine(s)),'A');
  assert.equal(text(r.practiceLine(s)),'D');
});

test('nine fills populate rows1..9 and never row0; line advance shifts exactly eight rows', () => {
  const s=r.createPractice(stream('1\n2\n3\n4\n5\n6\n7\n8\n9\nX\n'));
  assert.equal(s.rows.length,330);
  assert.equal(text(s.rows.subarray(0,33)),'');
  for(let i=1;i<10;i++) assert.equal(text(s.rows.subarray(i*33,(i+1)*33)),String(i));
  r.advancePracticeLine(s);
  assert.equal(text(s.rows.subarray(33,66)),'2');
  assert.equal(text(s.rows.subarray(297)),'X');
});

test('practice input has no wrong-key progress or inactivity failure; SPACE/CR closes NUL target', () => {
  const s=r.createPractice(stream('a\nb\n'),7);
  assert.equal(r.practiceInput(s,65,100),'retain-target');
  assert.equal(s.lastCorrect,7); assert.equal(s.index,0);
  assert.equal(r.practiceInput(s,10,101),'ignored');
  assert.equal(r.practiceInput(s,97,102),'advance-one-byte');
  assert.equal(s.lastCorrect,102); assert.equal(s.index,1);
  assert.equal(s.rows[0],0);
  assert.equal(r.practiceInput(s,32,103),'next-line');
  assert.equal(s.index,0); assert.equal(s.attempts,3); assert.equal(s.correct,2);
  s.attempts=32767; r.practiceInput(s,127,104); assert.equal(s.attempts,-32768);
});

test('lesson6 draw then segment draw then five bonus draws share one stream', () => {
  const rng={seed:123}; const reference={seed:123};
  const prefix=r.lessonPrefix(6,rng);
  assert.equal(prefix,'htbns'[r.boundedRandom(reference,5)]);
  const s=stream('A~B~C'); r.selectCorpusSegment(s,rng); r.random15(reference);
  const bonus=r.initializeBonus(rng);
  const draws=Array.from({length:4},()=>r.random15(reference));
  assert.equal(bonus.x,20+r.scaleRandom(draws[0],250));
  assert.equal(bonus.y,5+r.scaleRandom(draws[1],30));
  assert.equal(bonus.delay,30+r.scaleRandom(draws[2],30));
  assert.equal(bonus.code,33+r.scaleRandom(draws[3],15));
  const fifth=r.random15(reference);
  assert.equal(r.outdoorBonusDelay(rng,0),15+r.scaleRandom(fifth,-30));
  assert.equal(rng.seed,reference.seed);
  const before=rng.seed; assert.equal(r.outdoorBonusDelay(rng,120,true),15); assert.notEqual(rng.seed,before);
  assert.equal(r.matchesBonus(bonus,bonus.code),false);
  bonus.mode=2; assert.equal(r.matchesBonus(bonus,bonus.code),true);
});

test('title/menu timing consumes draws conditionally; fireworks use output bit0', () => {
  const rng={seed:41}, reference={seed:41};
  assert.equal(r.titleDelay(rng,true),null); assert.equal(rng.seed,41);
  assert.equal(r.titleDelay(rng,false),4+r.boundedRandom(reference,4));
  const timer={lastTicks:100,delayTicks:95};
  assert.equal(r.menuRandomTimer(timer,rng,195),false);
  assert.equal(rng.seed,reference.seed);
  assert.equal(r.menuRandomTimer(timer,rng,196),true);
  assert.equal(timer.delayTicks,(5+r.boundedRandom(reference,5))*19);
  assert.equal(timer.lastTicks,196);
  assert.equal(r.fireworkVariant(rng),(r.random15(reference)&1)?1:2);
  assert.equal(rng.seed,reference.seed);
});

test('all 15 archive corpora hash-verify, normalize and produce nine bounded display rows', () => {
  assert.equal(Object.keys(corpora).length,15);
  for(const [name,c] of Object.entries(corpora)) {
    const data=Buffer.from(c.hex,'hex');
    assert.equal(createHash('sha256').update(data).digest('hex'),c.sha256,name);
    const s=r.loadCorpus(data); r.selectCorpusSegment(s,{seed:12345});
    const practice=r.createPractice(s);
    for(let i=0;i<10;i++) assert.equal(practice.rows[i*33+32],0,name);
    assert.ok(s.index>=0 && s.index<s.bytes.length,name);
  }
});
