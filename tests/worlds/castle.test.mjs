import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CastleController, CastleQueue, castleSentence } from '../../recovered/worlds/castle.mjs';
import { loadCorpus, createPendingInput } from '../../recovered/runtime/runtime.mjs';

// The only subprocess is our read-only ZIP/byte verifier, never an archive member.
const evidence = JSON.parse(execFileSync('python3', ['-B', new URL('../../tools/worlds/castle-inspect.py', import.meta.url).pathname]));
const schedules = JSON.parse(readFileSync(new URL('../../app/data.json', import.meta.url))).idleSchedules;
const bytes = text => Uint8Array.from(Buffer.from(text, 'latin1'));
function game(options = {}) {
  const character = options.character ?? 1;
  const schedule = schedules[['m', 'l', 'p'][character - 1]];
  const c = new CastleController({ stream: loadCorpus(bytes('Ab`Cd`Ef`')), rng: { seed: 1 },
    resources: { bonusXs: evidence.bonusXs, idleSchedule: schedule.thresholds, idlePeriod: schedule.halfTickPeriod },
    priorDuration: 300, ...options });
  const input = createPendingInput();
  let ticks = 0;
  const step = (key, seconds = 0, increment = 1) => {
    if (key !== undefined) input.enqueue(...(key > 255 ? [0, key - 256] : [key]));
    return c.step({ nowTicks: ticks += increment, nowSeconds: seconds, input });
  };
  return { c, input, step };
}
function until(h, predicate, limit = 5000, auto = false) {
  const trace = [];
  for (let n = 0; !predicate(h.c); n++) {
    assert.ok(n < limit, `did not reach predicate: ${h.c.phase}, x=${h.c.x}, stage=${h.c.stage}`);
    trace.push(...h.step(auto && !h.c.locked && ['rockfaces', 'sand'].includes(h.c.phase) ? h.c.queue.target : undefined));
  }
  return trace;
}
// Independent RNG calculation, not a call back into the translated RNG.
function draw(seed, bound) {
  seed = Number((BigInt(seed) * 0x15a4e35n + 1n) & 0xffffffffn);
  return { seed, value: Math.floor(((seed >>> 16) & 32767) * bound / 32768) };
}

test('byte provenance and static retained clocks', () => {
  assert.equal(evidence.verifiedInstructions, 3803);
  assert.equal(evidence.sha256, '6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e');
  assert.deepEqual(evidence.padding, [...Array(8).fill(32), 0]);
  assert.equal(evidence.rockSecond, 0); assert.equal(evidence.sandSecond, 0);
});

test('dd93 reader normalizes whitespace, retains duplicates, counts backtick in500 bound', () => {
  assert.deepEqual([...castleSentence(loadCorpus(bytes('a\t\n b`')))], [...bytes('a   b')]);
  assert.equal(castleSentence(loadCorpus(bytes('x'.repeat(499) + '`'))).length, 499);
  assert.throws(() => castleSentence(loadCorpus(bytes('x'.repeat(500) + '`'))), /500/);
  assert.throws(() => castleSentence(loadCorpus(bytes('no delimiter'))), /500/);
});

test('queue endpoint metadata, overwritten start bits, signed text and exact3998-byte shift', () => {
  const q = new CastleQueue(loadCorpus(bytes('a`bc`d`')));
  q.initialize(0);
  assert.equal(q.length, 12); assert.equal(q.target, 97);
  assert.equal(q.words[8], 0x461); assert.equal(q.words[10], 0x463); assert.equal(q.words[11], 0x464);
  assert.equal(q.accept(), true); assert.equal(q.words[7], 0x561); assert.equal(q.target, 98);
  assert.equal(q.length, 12); assert.equal(q.correct, 1);
  q.words[1999] = 0x1234; q.shift();
  assert.equal(q.words[1998], 0x1234); assert.equal(q.words[1999], 0x1234);
  q.words.fill(0); q.append(bytes('x'), 2, 4); assert.equal(q.words[0], 0x478);
  q.words.fill(0); q.append(Uint8Array.of(0x80)); assert.equal(q.words[0], 0xff80);
  q.words.fill(0); q.append(new Uint8Array(1999).fill(97));
  assert.throws(() => q.append(bytes('b')), /exhausted/);
});

test('sand marks only third sentence and initial whitespace trimming is bounded to five', () => {
  const q = new CastleQueue(loadCorpus(bytes('      a`b`c`')));
  q.initialize(1);
  assert.equal(q.target, 32); assert.equal(q.words[9], 97);
  assert.equal(q.words[10], 98); assert.equal(q.words[11], 0x463);
  assert.equal(q.length, 17); // pre-trim append endpoint survives all shifts
});

test('operation2 accepts32..126, case-sensitive, counts wrong and retains target;127 ignored', () => {
  const h = game(); h.step();
  h.step(127); assert.equal(h.c.stats.attempts, 0);
  h.step(97); assert.equal(h.c.stats.errors, 1); assert.equal(h.c.queue.target, 65);
  h.step(65); assert.equal(h.c.stats.correct, 1); assert.equal(h.c.queue.target, 98);
  h.c.queue.words[8] = 126; h.step(126); assert.equal(h.c.stats.correct, 2);
  h.c.queue.words[8] = 32; h.step(32); assert.equal(h.c.stats.correct, 3);
  h.c.locked = true; h.step(33); assert.equal(h.c.stats.attempts, 4);
});

test('shared profile accuracy survives zero-attempt entry, then follows signed counter updates', () => {
  const h = game({ previousAccuracy: 83 }); h.step();
  assert.equal(h.c.stats.accuracy, 0); assert.equal(h.c.stats.profileAccuracy, 83);
  h.step(65); assert.equal(h.c.stats.profileAccuracy, 100);
  Object.assign(h.c.stats, { attempts: 32767, correct: 32767, accuracy: 100 });
  h.step(98);
  assert.equal(h.c.stats.attempts, -32768); assert.equal(h.c.stats.correct, -32768);
  assert.equal(h.c.stats.accuracy, 0); assert.equal(h.c.stats.profileAccuracy, 100);
});

test('failure is checked before consuming input:49/50,69/70 and strict20s boundaries', () => {
  for (const [attempts, accuracy, failed] of [[49, 69, false], [50, 69, true], [50, 70, false]]) {
    const h = game(); h.step(); Object.assign(h.c.stats, { attempts, accuracy });
    h.step(127); assert.equal(h.c.flags.failed, failed);
  }
  const h = game(); h.step(); h.step(127, 20); assert.equal(h.c.flags.failed, false);
  assert.equal(h.c.lastInput, 20);
  h.step(1, 40); assert.equal(h.c.flags.failed, false);
  h.step(65, 61); assert.equal(h.c.flags.failed, true); assert.equal(h.c.lastInput, 61);
  assert.equal(h.c.stats.correct, 1); // failure does not itself lock typing
});

test('two complete cycles, every stage,40 strips, pipe coordinates and exact repeated RNG tests', () => {
  const h = game(); h.step();
  let seed = h.c.rng.seed;
  const phases = new Set(), stages = new Set(), traces = [];
  for (let n = 0; h.c.cycle < 2 || h.c.phase !== 'rockfaces'; n++) {
    assert.ok(n < 5000, `${h.c.phase}:${h.c.x}`);
    phases.add(h.c.phase); if (h.c.phase === 'rockfaces') stages.add(`${h.c.cycle}:${h.c.stage}`);
    const key = !h.c.locked && ['rockfaces', 'sand'].includes(h.c.phase) ? h.c.queue.target : undefined;
    const effects = h.step(key); traces.push(...effects);
    for (const e of effects.filter(e => e.type === 'pipe-delay-test')) {
      const d = draw(seed, 6); seed = d.seed;
      assert.equal(e.threshold, 4 + d.value);
    }
  }
  assert.deepEqual([...stages].sort(), ['0:0','0:1','0:2','0:3','1:0','1:1','1:2','1:3']);
  for (const phase of ['pipe1-enter','pipe1-bumps','pipe1-exit','sand-enter-walk','sand-enter-fall',
    'sand','sand-exit-wade','sand-exit-jump','sand-exit-walk','pipe2-enter','pipe2-bumps','pipe2-exit']) assert.ok(phases.has(phase), phase);
  const strips = traces.filter(e => e.type === 'scroll-strip');
  assert.equal(strips.length, 8 * 40);
  for (let i = 0; i < strips.length; i++) assert.equal(strips[i].step, i % 40);
  assert.deepEqual(traces.filter(e => e.type === 'scroll-end').map(e => e.scene), [1,2,3,0,1,2,3,0]);
  const firstScrollPlayer = traces.findIndex(e => e.type === 'player' && e.special);
  const priorPlayer = traces.slice(0, firstScrollPlayer).findLast(e => e.type === 'player');
  assert.deepEqual(traces[firstScrollPlayer].oldFrame, priorPlayer.frame);
  // FILE c186..c1bb: renderer subtracts8 itself from this pre-scroll position.
  assert.equal(traces[firstScrollPlayer].oldX, priorPlayer.x);
  assert.equal(traces[firstScrollPlayer].oldX, 279);
  assert.equal(traces[firstScrollPlayer].x, 272);
  assert.equal(traces[firstScrollPlayer].frame.family, 'IDLE');
  assert.equal(traces.filter(e => e.type === 'pipe-draw').length, 20);
  assert.equal(traces.filter(e => e.type === 'pipe-erase').length, 20);
  assert.equal(h.c.rng.seed, seed); assert.equal(h.c.stats.correct, 24);
  assert.equal(h.c.flags.failed, false); assert.equal(h.c.flags.timeout, false);
});

test('rockfaces trigger on old player X, before commit; stage3 stops timer and locks input', () => {
  const h = game(); h.step(); h.c.x = 52; h.c.completion = true;
  let effects = h.step();
  assert.equal(h.c.rockfaces[0].phase, 0); assert.ok(h.c.x > 52);
  effects = h.step(); assert.ok(h.c.rockfaces[0].phase > 0);
  const rock = effects.findIndex(e => e.type === 'rockface');
  const player = effects.findIndex(e => e.type === 'player');
  const operation = effects.findIndex(e => e.type === 'operation');
  assert.ok(rock < player && player < operation);
  until(h, c => c.stage === 3, 500, true);
  assert.equal(h.c.locked, true); assert.equal(h.c.stats.running, false);
  const attempts = h.c.stats.attempts; h.step(65); assert.equal(h.c.stats.attempts, attempts);
});

test('c4e2..c540 clean stationary rockface emits no draw, dirty and raster changes do', () => {
  const h = game(); h.step();
  h.c.rockfaces = [{x:100,y:40,phase:0,resourceIndex:0,dirty:false}];
  h.c.effects = []; h.c.updateRocks(0);
  assert.deepEqual(h.c.effects, []);
  h.c.rockfaces[0].dirty = true; h.c.updateRocks(0);
  assert.equal(h.c.effects.filter(e=>e.type==='rockface').length,1);
  h.c.effects=[]; h.c.updateRocks(0); assert.deepEqual(h.c.effects,[]);
  h.c.updateRocks(100);
  assert.ok(h.c.effects.some(e=>e.type==='rockface'));
});

test('fast branch consumes one operation3, no strips, net-260 and no stats refresh', () => {
  const h = game({ fastScroll: true }); h.step();
  until(h, c => c.stage === 3, 500, true);
  const before = until(h, c => c.phase === 'scroll', 500);
  assert.equal(before.filter(e => e.type === 'scroll-strip').length, 0);
  assert.equal(h.c.x, 19); // 279-260
  assert.equal(before.at(-1).type, 'clip-restore');
  const stats = { ...h.c.stats };
  h.step(65, 200, 10000);
  assert.equal(h.c.stats.attempts, stats.attempts);
  assert.equal(h.c.flags.failed, false); // operation3 excludes inactivity gate
  assert.equal(h.c.stats.elapsedSeconds, stats.elapsedSeconds);
});

test('transition consumes one pending key, ignores ordinary typing, does not drain burst', () => {
  const h = game(); h.step(); until(h, c => c.phase === 'pipe1-bumps', 700, true);
  const attempts = h.c.stats.attempts;
  h.input.enqueue(65, 66); const effects = h.step(undefined, 100);
  assert.equal(h.c.stats.attempts, attempts); assert.equal(h.c.flags.failed, false);
  assert.equal(h.input.pending(), true); assert.equal(h.input.consume(), 66);
  assert.equal(h.c.lastInput, 100); assert.ok(effects.some(e => e.type === 'operation' && e.operation === 3));
});

test('pipe hold is exactly four op3 waits and delay has a fresh draw including failed comparison', () => {
  const h = game(); h.step(); const trace = until(h, c => c.phase === 'pipe1-exit', 1000, true);
  const first = trace.findIndex(e => e.type === 'pipe-draw');
  const erase = trace.findIndex(e => e.type === 'pipe-erase');
  assert.equal(trace.slice(first, erase).filter(e => e.type === 'operation').length, 4);
  const delay = trace.filter(e => e.type === 'pipe-delay-test');
  assert.equal(delay.filter(e => e.threshold <= e.delay).length, 5);
  assert.ok(delay.length >= 25 && delay.length <= 50);
});

test('sand entrance8 acceleration steps, fixed clip, wade and landing trace', () => {
  const h = game(); h.step(); const trace = until(h, c => c.phase === 'pipe2-enter', 2000, true);
  const fall = trace.filter(e => e.type === 'player' && e.file === 0xcce7);
  assert.equal(fall.length, 8);
  assert.deepEqual(fall.map(e => e.y - e.oldY), [1,2,3,4,5,6,7,8]);
  assert.ok(fall.every(e => e.x - e.oldX === 3 && e.clip[3] === 91));
  const jump = trace.filter(e => e.type === 'player' && e.file === 0xcf5a);
  assert.equal(jump[0].y - jump[0].oldY, -8);
  assert.equal(jump.at(-1).y, 36); assert.ok(jump.every(e => e.x - e.oldX === 4));
  assert.ok(trace.some(e => e.type === 'clip' && e.file === 0xcfac && e.rect[3] === 199));
});

test('rock failure finishes one idle schedule, triggers rock at player+60, ignores early abort', () => {
  for (const character of [1,2,3]) {
    const h = game({ character }); h.step(); h.step(); h.c.x = 20;
    h.step(undefined, 21); h.step(undefined, 21);
    assert.equal(h.c.phase, 'rock-failure', `phase=${h.c.phase}, x=${h.c.x}, failed=${h.c.flags.failed}`);
    const trace = h.step(27, 21);
    assert.equal(h.c.ended, false); assert.equal(h.c.flags.exit, true);
    trace.push(...until(h, c => c.ended, 1000));
    assert.equal(trace.filter(e => e.type === 'player' && e.file === 0xc319).length,
      h.c.resources.idlePeriod * 2 - 2); // first frame already emitted by previous step
    assert.equal(h.c.flags.failed, true); assert.equal(h.c.result, null);
    assert.equal(trace.filter(e => e.type === 'results').length, 1);
    assert.deepEqual(h.step(), []);
  }
});

test('sand failure sinks only on odd counter, terminates95, keeps distinct abort flag', () => {
  const h = game(); h.step(); until(h, c => c.phase === 'sand', 1500, true);
  h.step(); // source resets last-input after operation1, before first active movement
  h.step(undefined, 21); // operation2 marks failure
  const startY = h.c.y;
  const trace = h.step(27, 21);
  assert.equal(h.c.phase, 'sand-failure', `phase=${h.c.phase}, failed=${h.c.flags.failed}, last=${h.c.lastInput}`); assert.equal(h.c.flags.exit, true);
  trace.push(...until(h, c => c.ended, 1000));
  const moves = trace.filter(e => e.type === 'player' && e.file === 0xc3d4);
  assert.equal(moves.length, (95 - startY) * 2 - 1);
  assert.equal(h.c.y, 95); assert.equal(h.c.flags.failed, true); assert.equal(h.c.flags.timeout, false);
});

test('abort in scroll makes one further movement then final copy; pipe abort exits immediately', () => {
  const h = game(); h.step(); until(h, c => c.phase === 'scroll', 1000, true);
  const a = h.step(27); assert.equal(h.c.flags.exit, true);
  const b = h.step();
  assert.equal(b.filter(e => e.type === 'scroll-strip').length, 1);
  assert.equal(b.find(e => e.type === 'scroll-end').interrupted, true);
  assert.equal(h.c.ended, true); assert.equal(h.c.flags.failed, false);
  assert.ok(a.some(e => e.type === 'global-abort'));
  const p = game(); p.step(); until(p, c => c.phase === 'pipe1-bumps', 1000, true);
  p.step(27); const effects = p.step(); assert.equal(p.c.ended, true);
  assert.equal(effects.some(e => e.type === 'pipe-erase'), false);
});

test('timeout stays separate, stops on following scene check; op3 uses cached elapsed', () => {
  const h = game({ minutes: -1 }); h.step(); assert.equal(h.c.flags.timeout, true);
  h.step(); assert.equal(h.c.ended, true); assert.equal(h.c.flags.failed, false); assert.equal(h.c.flags.exit, false);
  const p = game(); p.step(); until(p, c => c.phase === 'pipe1-bumps', 1000, true);
  p.c.stats.elapsedSeconds = p.c.stats.limitSeconds;
  p.step(); assert.equal(p.c.flags.timeout, true); p.step(); assert.equal(p.c.ended, true);
});

test('bonus before scoring, stop/resume excludes movie ticks, restore scene and flush', () => {
  const h = game(); h.step(); h.c.bonus.mode = 2; h.c.bonus.code = 65; h.c.bonus.y = 90;
  const effects = h.step(65, 1, 10);
  assert.equal(h.c.awaitingBonus, true); assert.equal(h.c.stats.attempts, 0);
  assert.equal(h.c.stats.running, false); assert.ok(effects.some(e => e.type === 'bonus-playback'));
  assert.throws(() => h.step(), /Complete Castle bonus/);
  const ticks = h.c.stats.ticks;
  h.input.enqueue(65, 66);
  const restore = h.c.resumeBonus({ nowTicks: 10000, nowSeconds: 500, input: h.input });
  assert.equal(h.c.stats.ticks, ticks); assert.equal(h.c.lastInput, 500);
  assert.equal(h.input.pending(), false); assert.equal(h.c.stats.running, true);
  assert.ok(h.c.rockfaces.every(r => r.dirty));
  assert.equal(restore[0].type, 'bonus-restore');
});

test('bonus clocks survive reentry and scene-specific activation consumes exactly one rock draw', () => {
  const persistent = { rockSecond: 9, sandSecond: 8 }, rng = { seed: 71 };
  const h = game({ persistent, rng }); let seed = 71;
  for (let i = 0; i < 5; i++) seed = draw(seed, 1).seed;
  assert.equal(rng.seed, seed); h.step(undefined, 9);
  h.c.bonus.countdown = 1; h.step(undefined, 9); assert.equal(h.c.bonus.mode, 1);
  h.step(undefined, 10); const d = draw(seed, 3);
  assert.equal(rng.seed, d.seed); assert.equal(h.c.bonus.x, evidence.bonusXs[d.value]); assert.equal(h.c.bonus.y, 89);
  const again = game({ persistent, rng }); again.step(undefined, 10); again.c.bonus.countdown = 1;
  again.step(undefined, 10); assert.equal(again.c.bonus.countdown, 1);
  again.c.bonus.mode = 1; again.c.bonus.countdown = 0; again.c.nowSeconds = 10;
  const before = rng.seed; again.c.updateBonus(true); assert.equal(rng.seed, before);
  assert.deepEqual([again.c.bonus.x, again.c.bonus.y, again.c.bonus.countdown], [63,17,1]);
});

test('all characters complete two fast cycles without carrying counters across entry', () => {
  for (const character of [1,2,3]) {
    const h = game({ character, fastScroll: true });
    const initial = h.step();
    assert.equal(initial.filter(e => e.type === 'ready').length, 1);
    assert.equal(initial.filter(e => e.type === 'rockface-init').length, 3);
    const trace = until(h, c => c.cycle === 2 && c.phase === 'rockfaces', 5000, true);
    assert.equal(trace.filter(e => e.type === 'scroll-strip').length, 0);
    assert.equal(trace.filter(e => e.type === 'scroll-end').length, 8);
    assert.equal(trace.filter(e => e.type === 'ready').length, 0);
    assert.ok(trace.filter(e => e.type === 'player' && e.frame.family === 'WALKING')
      .every(e => e.frame.index >= (character - 1) * 30 && e.frame.index < character * 30));
    h.step(27); until(h, c => c.ended);
    const next = game({ character, rng: h.c.rng, persistent: h.c.persistent });
    assert.deepEqual(next.c.flags, { failed: false, timeout: false, exit: false });
    assert.equal(next.c.stats.attempts, 0); assert.equal(next.c.cycle, 0);
    assert.equal(next.c.persistent, h.c.persistent);
  }
});

test('bonus in sand restores scene2 and clock; lock does not override bonus interception', () => {
  const h = game(); h.step(); until(h, c => c.phase === 'sand', 1500, true);
  h.step(); h.c.bonus.mode = 2; h.c.bonus.code = 65; h.c.bonus.countdown = 20;
  h.c.locked = true;
  const attempts = h.c.stats.attempts, effects = h.step(65);
  assert.equal(h.c.stats.attempts, attempts);
  assert.equal(effects.find(e => e.type === 'bonus-playback').sceneBefore, 0);
  const restored = h.c.resumeBonus({ nowTicks: 10000, nowSeconds: 100, input: h.input });
  assert.equal(restored.find(e => e.type === 'bonus-restore').scene, 2);
});

test('progression routes once and failure/exit gates block; end modes1/2/4 and completed repeat', () => {
  for (const [lesson, wpm, completed, ending] of [[1,30,false,1],[6,39,false,2],[6,40,false,4],[6,40,true,1]]) {
    const h = game({ profilePresent: true, profile: { lesson, goal: 30, completed: [false,false,completed] } });
    h.c.stats.wpm = wpm; h.c.flags.timeout = true;
    h.step(); h.c.stats.wpm = wpm; h.step();
    assert.equal(h.c.result.ending, ending); assert.equal(h.c.result.save, true);
    assert.deepEqual(h.step(), []);
  }
  for (const flag of ['failed','exit']) {
    const h = game({ profilePresent: true, profile: { lesson: 6, goal: 30, completed: [false,false,false] } });
    h.step(); h.c.stats.wpm = 40; h.c.flags[flag] = true; h.c.flags.timeout = true;
    h.step(); assert.equal(h.c.result.advanced, false);
  }
});
