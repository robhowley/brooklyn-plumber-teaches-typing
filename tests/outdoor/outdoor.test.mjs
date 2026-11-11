import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createPendingInput } from '../../recovered/runtime/runtime.mjs';
import { createDemo, demoStudent } from '../../recovered/control/startup.mjs';
import { newStudent } from '../../recovered/control/student.mjs';
import { i16, upperCode, random15, lessonBytes, nextTarget, selectLessonSegment,
  makeObstacle, motion, idleFrame, createOutdoor, updatePlayer, updateObstacles,
  updateParticles, selectTarget, acceptKey, tick, makeBonus, updateBonus, JUMP_Y, CURSOR_FRAMES, BLOCK_HEIGHTS } from '../../recovered/outdoor/outdoor.mjs';
const root = new URL('../../analysis/outdoor/', import.meta.url);
const tables = JSON.parse(readFileSync(new URL('tables.json', root)));
const evidence = JSON.parse(readFileSync(new URL('evidence.json', root)));
const idleSchedule = tables.tables.marioIdle.values, idlePeriod = 90;
const options = { idleSchedule, idlePeriod };
const state = () => createOutdoor({ bytes: Buffer.from('asdf'), seed: 1 });
const span = (offset, length) => {
  const record = evidence.spans.find(s => parseInt(s.start) <= offset && parseInt(s.endExclusive) >= offset + length);
  assert.ok(record, `covered FILE ${offset.toString(16)}`);
  return Buffer.from(record.hex, 'hex').subarray(offset - parseInt(record.start), offset - parseInt(record.start) + length);
};

test('reentry keeps only surviving counters and uses old scroll before new movement', () => {
  const runtime = JSON.parse(readFileSync(new URL('../../analysis/runtime/evidence.json', import.meta.url)));
  assert.equal(runtime.data['0x487e'].hex, '00'.repeat(14));
  assert.equal(runtime.data['0x51ac'].hex, '0000');
  // Direct stores are INC cursor, ADD distance and ADD ground, not entry resets.
  assert.equal(span(0x1340c, 4).toString('hex'), 'ff067e48');
  assert.equal(span(0x1378a, 4).toString('hex'), '01068448');
  assert.equal(span(0x1437d, 4).toString('hex'), '0106ac51');
  let previous = state();
  Object.assign(previous, { cursorCounter: 11, groundPhase: 19, stillTicks: 10,
    idleTicks: 8, distance: 32767, mode: 3, x: 200, scroll: 9,
    attempts: 44, ended: true });
  for (let entry = 0; entry < 2; entry++) {
    const next = createOutdoor({ bytes: Buffer.from('B'), seed: 5, previous });
    assert.equal(next.cursorCounter, previous.cursorCounter);
    assert.equal(next.distance, previous.distance);
    assert.equal(next.groundPhase, previous.groundPhase);
    assert.equal(next.stillTicks, previous.stillTicks);
    assert.equal(next.idleTicks, previous.idleTicks);
    assert.equal(next.mode, 0);
    assert.equal(next.scroll, 1);
    assert.equal(next.x, 20);
    assert.equal(next.attempts, 0);
    assert.equal(next.ended, false);
    assert.ok(next.obstacles.every(o => !o.active));
    tick(next, options);
    assert.equal(next.groundPhase, (previous.groundPhase + 1) % 20);
    assert.equal(next.scroll, 9); // calculated only after ground used initial scroll 1
    assert.equal(next.cursorCounter, entry === 0 ? 0 : 1);
    assert.equal(next.idleTicks, previous.idleTicks + 1);
    previous = next;
  }
  const moving = state();
  Object.assign(moving, { distance: 32767, cursorX: 100 });
  updatePlayer(moving, idleSchedule, idlePeriod);
  assert.equal(moving.distance, -32761); // 0x1378a wraps ADD word, no renderer repair
});

test('bonus observed-second clock survives entry and compares signed32 time words', () => {
  const old = makeBonus(1, 120);
  old.countdown = 10;
  updateBonus(old, 20, 0xffffffff);
  assert.equal(old.lastSecond, -1);
  assert.equal(old.countdown, 9);
  const again = makeBonus(old.seed, 120, false, old.lastSecond);
  const delay = again.countdown;
  updateBonus(again, 20, 0xffffffff);
  assert.equal(again.countdown, delay);
  updateBonus(again, 20, 0);
  assert.equal(again.countdown, delay - 1);
});

test('timeout compares signed32 values, including the wrap boundary', () => {
  assert.equal(span(0x13aa0, 2).toString('hex'), '7c0b'); // signed high word
  assert.equal(span(0x13aa8, 2).toString('hex'), '7203'); // unsigned low word on equal high
  const s = state();
  tick(s, { ...options, elapsed: 0x80000000, limit: 120 });
  assert.equal(s.ended, false);
  tick(s, { ...options, elapsed: 119, limit: 120 });
  assert.equal(s.ended, false);
  tick(s, { ...options, elapsed: 120, limit: 120 });
  assert.equal(s.ended, true);
});

test('pinned archive timeout branches bypass the input poll and reach original ending states', () => {
  // Read original bytes only, never execute or emulate the archive member.
  const proof = spawnSync('python3', ['-B', '-c', `import zipfile,pathlib,hashlib
p=__import__('tools.source',fromlist=['archive_path']).archive_path()
assert hashlib.sha256(p.read_bytes()).hexdigest()=='b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'
with zipfile.ZipFile(p) as z: b=z.read('MarioTea/MARIO/MARIO.EXE')
assert hashlib.sha256(b).hexdigest()=='6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e'
print(b[0x13a9c:0x13ab4].hex(),b[0x13b89:0x13b9e].hex())`], { encoding: 'utf8' });
  assert.equal(proof.status, 0, proof.stderr);
  const [compare, ending] = proof.stdout.trim().split(' ').map(hex => Buffer.from(hex, 'hex'));
  assert.equal(compare.toString('hex'), '263b47217c0b7506263b571f7203e9dc0033f69adb1f0000');
  assert.equal(ending.toString('hex'), '833ef84f017508c706f84f0200eb06c706f84f0300');
  assert.equal(0x13aa2 + compare.readInt8(5), 0x13aad); // signed high less: poll path
  assert.equal(0x13aa4 + compare.readInt8(7), 0x13aaa); // high greater: end path
  assert.equal(0x13aaa + compare.readInt8(13), 0x13aad); // equal high, low less: poll
  assert.equal(0x13aad + compare.readInt16LE(15), 0x13b89); // equal or greater: bypass
  assert.equal(compare.subarray(19).toString('hex'), '9adb1f0000'); // poll at FILE 0x13aaf
});

for (const elapsed of [119, 120, 121]) test(`elapsed ${elapsed} polls only below limit after updates, preserving Demo RNG and queued keys on bypass`, () => {
  for (const countdown of [0, 2]) {
    const s = state(), input = createPendingInput(), rng = { seed: s.seed };
    s.obstacles[0] = makeObstacle(65, 32767); // no spawn RNG draw during this tick
    Object.assign(s, { attempts: 7, correct: 5, errors: 2 });
    const demo = createDemo({ student: demoStudent(newStudent('A')), rng, input, mode: 1 });
    demo.state.countdown = countdown;
    input.enqueue(27, 66);
    let polls = 0;
    const events = tick(s, { ...options, elapsed, limit: 120, pollInput(args) {
      polls++;
      assert.equal(s.groundPhase, 1);
      assert.equal(s.scroll, 9);
      assert.equal(s.obstacles[0].x, 274);
      assert.deepEqual(args, { target: 65, targetPresent: true });
      rng.seed = s.seed;
      const event = demo.poll(args);
      s.seed = rng.seed;
      return event.key;
    } });
    const below = elapsed < 120, synthetic = below && countdown === 0;
    assert.equal(polls, below ? 1 : 0);
    assert.equal(s.groundPhase, 1); // timeout still follows world updates
    assert.equal(s.obstacles[0].x, 274);
    assert.equal(s.cursorCounter, 1);
    assert.equal(s.seed, synthetic ? random15(1).seed : 1);
    assert.equal(rng.seed, s.seed);
    assert.equal(demo.state.countdown, below ? (synthetic ? 10 + Math.trunc(random15(1).value * 10 / 32768) : 1) : countdown);
    assert.deepEqual([s.attempts, s.correct, s.errors], synthetic ? [8, 6, 2] : [7, 5, 2]);
    assert.equal(s.ended, !synthetic);
    assert.equal(s.aborted, below && !synthetic);
    assert.equal(events.some(e => e.type === 'end'), !synthetic);
    assert.equal(input.consume(), below ? 66 : 27);
    if (!below) assert.equal(input.consume(), 66);
    assert.equal(input.pending(), false);
  }
});

test('tables and lowercase classification match copied executable bytes', () => {
  for (const [name, translated] of [['jumpY', JUMP_Y], ['cursorFrames', CURSOR_FRAMES], ['blockHeights', BLOCK_HEIGHTS]]) {
    const t = tables.tables[name], b = span(parseInt(t.fileOffset), translated.length * 2);
    assert.deepEqual([...translated], t.values);
    assert.deepEqual([...translated], Array.from({ length: translated.length }, (_, i) => b.readInt16LE(i * 2)));
  }
  const flags = span(0x1f270 + 0x3903, 256);
  assert.deepEqual([...flags.keys()].filter(i => flags[i] & 8), Array.from({ length: 26 }, (_, i) => 97 + i));
  for (let c = 0; c < 256; c++) assert.equal(upperCode(c), flags[c] & 8 ? c - 32 : c);
  assert.equal(upperCode(-1), -1);
  assert.equal(upperCode(0x161), 65);
});

test('source opcodes preserve strict spacing, countdown and loop order', () => {
  assert.equal(span(0x13070, 5).toString('hex'), 'c746f8dc00');
  assert.equal(span(0x13cdf, 6).toString('hex'), '26c747180600');
  const calls = evidence.callEdges.filter(c => parseInt(c.from) >= 0x139c7 && parseInt(c.from) <= 0x139dd);
  assert.deepEqual(calls.map(c => parseInt(c.to)), [0x1436c, 0x13852, 0x135c9, 0x13058, 0x12f59, 0x133f7]);
});

test('lesson resources are hash-verified and filtered without random letters', () => {
  for (const item of tables.lessons) {
    const b = readFileSync(new URL(item.localFile, root));
    assert.equal(createHash('sha256').update(b).digest('hex'), item.sha256);
    const s = { bytes: lessonBytes(b), index: 0 };
    for (let i = 0; i < 1000; i++) { const c = nextTarget(s); assert.ok(c > 32 && c < 127 && c !== 126); }
  }
  const s = { bytes: lessonBytes(Uint8Array.from([13, 10, 32, 126, 97, 96, 127, 200, 98, 26, 99])), index: 0 };
  assert.deepEqual([nextTarget(s), nextTarget(s), nextTarget(s), nextTarget(s)], [65, 96, 66, 65]);
  assert.throws(() => lessonBytes(Buffer.from('~ \r\n')), /No outdoor targets/);
  const segmented = { bytes: lessonBytes(Buffer.from('a~b~c')), index: 0 };
  selectLessonSegment(segmented, 32767);
  assert.equal(nextTarget(segmented), 66); // two delimiter scans include prepended sentinel
});

test('LCG agrees with independent BigInt arithmetic including overflow', () => {
  for (const seed of [0, 1, 0x12345678, 0xffffffff, 0x80000000]) {
    const next = Number((BigInt(seed) * 0x015a4e35n + 1n) & 0xffffffffn);
    assert.deepEqual(random15(seed), { seed: next, value: (next >>> 16) & 32767 });
  }
});

test('type boundary and degenerate height selection are exact', () => {
  assert.equal(makeObstacle(65, 16383).type, 1);
  assert.equal(makeObstacle(65, 16384).type, 2);
  for (let r = 0; r < 32768; r++) assert.equal(makeObstacle(65, 0, r).y, 57);
  assert.equal(makeObstacle(65, 32767).x, 283);
  assert.equal(makeObstacle(65, 32767).xOffset, 30);
});

test('pursuit uses truncated signed division, asymmetric bias and old scroll', () => {
  const base = { x: 20, cursorX: 31, mode: 0, followX: 99, scroll: 1, speed: 5 };
  assert.deepEqual(motion(base), { followX: 20, dx: 0, x: 20, scroll: 0 });
  assert.equal(motion({ ...base, cursorX: 32 }).dx, 1);
  assert.equal(motion({ ...base, cursorX: 30 }).dx, -2);
  assert.equal(motion({ ...base, cursorX: 293 }).dx, 8);
  assert.equal(motion({ ...base, cursorX: -1 }).scroll, 9);
  assert.equal(motion({ ...base, x: 1, cursorX: 0 }).x, 0);
  assert.equal(motion({ ...base, speed: 32767, cursorX: 319 }).scroll, Math.trunc(i16(32767 * 319) / 160));
});

test('far-away target accepts lowercase immediately, no collision/input buffer', () => {
  const s = state(); s.obstacles[0] = makeObstacle(65, 0); selectTarget(s);
  assert.equal(s.cursorX, 293);
  assert.equal(acceptKey(s, 97), 'correct');
  assert.equal(s.mode, 1); assert.equal(s.jumpIndex, 0);
  assert.equal(s.obstacles[0].countdown, 6); assert.equal(s.obstacles[0].code, 0);
  selectTarget(s);
  assert.equal(acceptKey(s, 115), 'ignored'); assert.equal(s.attempts, 1);
  assert.equal(s.errors, 0);
});

test('wrong, space, DEL and nonprintable keys have distinct semantics', () => {
  const s = state(); s.obstacles[0] = makeObstacle(65, 32767); selectTarget(s);
  for (const c of [0, 13, 128, 0x13b]) assert.equal(acceptKey(s, c), 'ignored');
  assert.equal(acceptKey(s, 32), 'wrong'); assert.equal(acceptKey(s, 127), 'wrong');
  assert.equal(acceptKey(s, 65), 'correct'); assert.equal(s.mode, 0); // turtle doesn't jump
  assert.deepEqual([s.attempts, s.correct, s.errors], [3, 1, 2]);
});

test('spawn threshold is >220, removal is sixth update, one-slot shift', () => {
  const s = state(); s.scroll = 0; s.obstacles[0] = makeObstacle(65, 0); s.obstacles[0].x = 221;
  updateObstacles(s); assert.equal(s.obstacles.filter(o => o.active).length, 1);
  s.obstacles[0].x = 220; updateObstacles(s); assert.equal(s.obstacles.filter(o => o.active).length, 2);
  selectTarget(s); acceptKey(s, 65);
  for (let n = 0; n < 5; n++) updateObstacles(s);
  assert.equal(s.obstacles[0].countdown, 1);
  const events = updateObstacles(s);
  assert.ok(events.some(e => e.id === 4)); assert.equal(s.particles.length, 4);
  assert.equal(s.obstacles[0].code, 65); // first lesson character was generated for second object
});

test('debris gravity, scroll and inclusive clipping bounds', () => {
  const s = state(); s.scroll = 1;
  s.particles = [{ x: 10, y: 50, vx: -2, vy: -6 }, { x: 310, y: 131, vx: 0, vy: 0 }, { x: 0, y: 0, vx: 0, vy: 0 }];
  updateParticles(s);
  assert.deepEqual(s.particles, [{ x: 7, y: 44, vx: -2, vy: -5 }, { x: 309, y: 131, vx: 0, vy: 1 }]);
  updateParticles(s); assert.equal(s.particles.length, 1);
});

test('jump sequence, landing override, idle threshold and frame wrap', () => {
  const s = state(); s.mode = 1; const ys = [];
  for (let n = 0; n < 12; n++) { updatePlayer(s, idleSchedule, idlePeriod); ys.push(s.y); }
  assert.deepEqual(ys, [90, 71, 64, 62, 62, 65, 70, 88, 90, 90, 90, 85]);
  assert.equal(s.mode, 0); assert.equal(s.jumpIndex, 0);
  assert.equal(idleFrame(179, idleSchedule, idlePeriod).ticks, 0);
  const stationary = state(); stationary.cursorX = -1;
  for (let n = 0; n < 4; n++) updatePlayer(stationary, idleSchedule, idlePeriod);
  assert.equal(stationary.frame.kind, 'run');
  updatePlayer(stationary, idleSchedule, idlePeriod); assert.equal(stationary.frame.kind, 'idle');
});

test('end-to-end loop starts moving before input and keeps old ground scroll', () => {
  const s = state();
  tick(s, { ...options, key: 97 });
  assert.equal(s.groundPhase, 1); assert.equal(s.scroll, 9);
  assert.equal(s.obstacles[0].x, 284); assert.equal(s.correct, 1); assert.equal(s.mode, 1);
  assert.equal(s.y, 90); // jump starts on NEXT iteration
  for (let n = 0; n < 12; n++) tick(s, options);
  assert.equal(s.mode, 0); assert.equal(s.y, 85);
});

test('timeout is checked after updates; pending jump state is overwritten next timeout', () => {
  const s = state(); tick(s, { ...options, key: 97 });
  const input = createPendingInput(), rng = { seed: s.seed };
  const demo = createDemo({ student: demoStudent(newStudent('A')), rng, input, mode: 1 });
  demo.state.countdown = 0; input.enqueue(27, 66);
  const seed = s.seed, expired = { ...options, elapsed: 120, key: 115,
    pollInput: args => { const event = demo.poll(args); s.seed = rng.seed; return event.key; } };
  tick(s, expired);
  assert.equal(s.mode, 2); assert.equal(s.ended, false); assert.equal(s.attempts, 1);
  const jumpIndex = s.jumpIndex;
  assert.ok(tick(s, expired).some(e => e.type === 'end' && !e.aborted));
  assert.equal(s.jumpIndex, jumpIndex + 1); // second timeout still advances the unfinished jump
  assert.equal(s.mode, 3); assert.equal(s.ended, true);
  assert.deepEqual([s.attempts, s.correct, s.errors], [1, 1, 0]);
  assert.equal(s.seed, seed); assert.equal(rng.seed, seed); assert.equal(demo.state.countdown, 0);
  assert.equal(input.consume(), 27); assert.equal(input.consume(), 66);
  assert.deepEqual(tick(s, expired), []); // already ended remains inert
  const aborted = state(); tick(aborted, { ...options, key: 27 });
  assert.equal(aborted.ended, true); assert.equal(aborted.aborted, true);
});

test('bonus uses separate second and iteration clocks, then intercepts punctuation', () => {
  const b = makeBonus(1, 120, true);
  assert.equal(b.countdown, 15); assert.ok(b.code >= 33 && b.code <= 47);
  updateBonus(b, 20, 100); assert.equal(b.countdown, 14); // no 100-second catchup
  updateBonus(b, 20, 100); assert.equal(b.countdown, 14);
  for (let second = 101; second < 115; second++) updateBonus(b, 20, second);
  assert.equal(b.mode, 2); assert.equal(b.countdown, 45);
  const oldX = b.x; updateBonus(b, 300, 114); assert.equal(b.x, oldX + 1);
  const s = state();
  const events = tick(s, { ...options, bonus: b, key: b.code });
  assert.ok(events.some(e => e.type === 'bonus-cinematic-required'));
  assert.equal(s.attempts, 0); assert.equal(b.countdown, 0);
  updateBonus(b, 20, 115); assert.equal(b.mode, 0);
});

test('no-input simulation stops scrolling near earliest unsolved obstacle', () => {
  const s = state();
  for (let n = 0; n < 400; n++) tick(s, options);
  assert.ok(s.cursorX >= 0 && s.cursorX < 32);
  assert.equal(s.scroll, 0); assert.equal(s.attempts, 0); assert.equal(s.ended, false);
});
