import test from 'node:test';
import assert from 'node:assert/strict';
import { createWater, stepWater } from '../../recovered/worlds/water.mjs';
import { createPendingInput, loadCorpus } from '../../recovered/runtime/runtime.mjs';

function setup(options = {}) {
  let ticks = 0, seconds = 0;
  const input = createPendingInput();
  const rng = { seed: 1 };
  const clock = { ticks: () => ticks, seconds: () => seconds };
  const s = createWater({ stream: loadCorpus(Buffer.from('abcdefghijklmnopqrstuvwxyz ')),
    rng, input, clock, draw: bound => bound - 1, ...options });
  return { s, input, rng, time(t, sec) { ticks = t; seconds = sec; },
    step: args => stepWater(s, { tickReady: true, ...args }) };
}
const types = effects => effects.map(e => e.type);

// Expected window positions follow 174b3 shift and 176b7 prefill predicate.
test('entry selects exact 20/40 windows and advances target to first corpus byte', () => {
  for (const shortWindow of [false, true]) {
    const { s } = setup({ shortWindow });
    assert.equal(s.width, shortWindow ? 20 : 40);
    assert.equal(s.targetIndex, shortWindow ? 5 : 10);
    assert.equal(s.window[s.targetIndex], 97);
    assert.deepEqual([...s.window.slice(0, s.targetIndex)], Array(s.targetIndex).fill(0));
    assert.equal(s.stream.index, shortWindow ? 16 : 4); // 15/30 reads, ~ skipped on wrap
    assert.equal(s.timer.running, true);
    assert.equal(s.lastPrompt, 97);
    assert.equal(s.effects.at(-2).type, 'ready');
    assert.equal(s.effects.at(-1).type, 'music');
  }
});

test('display sanitation does not mutate target bytes; 127 remains visible', () => {
  const { s, input, step } = setup();
  s.window.set([0, 31, 32, 127, 128, 255]);
  input.enqueue(90); // wrong input forces16e0c
  step();
  assert.deepEqual([...s.display.slice(0, 6)], [32, 32, 32, 127, 32, 32]);
  assert.deepEqual([...s.window.slice(0, 6)], [0, 31, 32, 127, 128, 255]);
});

test('ordinary acceptance endpoints and case sensitivity, signed word counters', () => {
  for (const [key, accepted] of [[31, false], [32, true], [127, true], [128, false]]) {
    const { s, input, step } = setup();
    s.window[s.targetIndex] = key;
    s.stats.attempts = 32767;
    input.enqueue(key); step();
    assert.equal(s.stats.attempts, accepted ? -32768 : 32767);
    assert.equal(s.stats.correct, accepted ? 1 : 0);
  }
  const { s, input, step } = setup();
  input.enqueue(65); step();
  assert.equal(s.stats.errors, 1); assert.equal(s.window[s.targetIndex], 97);
  input.enqueue(97); step();
  assert.equal(s.stats.correct, 1); assert.equal(s.window[s.targetIndex], 98);
});

test('pending bursts suppress stats/motion/random draws, sixth pending shift redraws', () => {
  const draws = [];
  const { s, input, step } = setup({ draw: bound => { draws.push(bound); return bound - 1; } });
  input.enqueue(97, 98, 99, 100, 101, 102, 103);
  for (let n = 0; n < 6; n++) {
    const effects = step();
    assert.equal(effects.some(e => e.type === 'text'), n === 5);
    assert.equal(s.swimmer.x, 20);
    assert.equal(s.timer.ticks, 0);
    assert.equal(effects.some(e => e.type === 'wait-tick'), false);
  }
  assert.deepEqual(draws, []);
  assert.equal(s.redrawCount, 0);
  step();
  assert.deepEqual(draws, [10, 15]);
  assert.equal(s.swimmer.x, 21);
  assert.equal(s.stats.correct, 7);
});

test('pending is queried again, not inferred from having consumed a key', () => {
  const { s, input, step } = setup();
  input.enqueue(0, 68, 97); // normalized0x144, remaining byte suppresses movement
  const effects = step();
  assert.equal(s.aborted, true); assert.equal(s.exitGate, true);
  assert.equal(s.swimmer.x, 20);
  assert.equal(effects.some(e => e.type === 'swimmer'), false);
  assert.equal(input.pending(), true);
});

test('wrong AND ignored keys reset inactivity, strict >20 checked before consumption', () => {
  const { s, input, time, step } = setup();
  time(182, 20); input.enqueue(90); step();
  assert.equal(s.failed, false); assert.equal(s.lastInput, 20);
  time(364, 40); input.enqueue(1); step();
  assert.equal(s.failed, false); assert.equal(s.lastInput, 40);
  time(546, 61); input.enqueue(97); step();
  assert.equal(s.failed, true); assert.equal(s.lastInput, 61);
  assert.equal(s.stats.correct, 1); // failure does not lock typing
  assert.equal(s.timer.running, false);
});

test('signed32 inactivity subtraction wraps and does not treat negative time as overdue', () => {
  const { s, time, step } = setup();
  s.lastInput = 0x7ffffff8;
  time(1, -2147483640); step(); // difference16
  assert.equal(s.failed, false);
  time(2, -2147483634); step(); // difference22
  assert.equal(s.failed, true);
});

test('timeout tests previous refreshed elapsed, then still executes final update', () => {
  const { s, time, step } = setup({ minutes: 1 });
  time(1092, 1); step();
  assert.equal(s.stats.elapsedSeconds, 60);
  assert.equal(s.ended, false);
  const counter = s.swimmer.counter;
  time(1093, 2); const effects = step();
  assert.equal(s.timedOut, true); assert.equal(s.ended, false);
  assert.equal(s.swimmer.counter, counter + 1);
  assert.equal(s.timer.running, true);
  assert.equal(types(effects).at(-1), 'wait-tick');
  assert.deepEqual(stepWater(s), []); // cannot finalize before the changed-tick wait
  time(1094, 2); const terminal = step();
  assert.equal(s.ended, true); assert.equal(s.timer.running, false);
  assert.equal(s.timer.ticks, 1094); // includes final wait, not stopped at1093
  assert.ok(types(terminal).includes('results'));
});

test('abort still runs ordinary update when queue empty, then results once', () => {
  const { s, input, step } = setup();
  input.enqueue(27);
  const effects = step();
  assert.equal(s.swimmer.x, 21);
  assert.equal(s.aborted, true); assert.equal(s.timedOut, false);
  assert.equal(types(effects).at(-1), 'wait-tick');
  assert.equal(step().find(e => e.type === 'results').suppressed, true);
  assert.deepEqual(step(), []);
});

test('option10 extended quit exits process path, not pause or lesson results', () => {
  for (const option10 of [false, true]) {
    const { s, input, step } = setup({ option10 });
    input.enqueue(0, 45);
    const effects = step();
    assert.equal(s.phase, option10 ? 'quit' : 'wait');
    assert.equal(effects.some(e => e.type === 'results'), false);
    assert.equal(s.stats.attempts, 0);
  }
});

test('random order: environmental allocation, stats, swimmer allocation, pursuer, bubbles, bonus', () => {
  const draws = [];
  const { s, step } = setup({ draw: bound => { draws.push(bound); return 0; } });
  const effects = step();
  assert.deepEqual(draws, [10, 10, 15]);
  // Source pair0=(44,170), then swimmer=(21,113)+(38,15), both updated immediately.
  assert.deepEqual(s.bubbles.slice(0, 2).map(b => [b.x, b.y, b.dy]), [[44, 169, -1], [59, 127, -1]]);
  assert.deepEqual(types(effects), ['background-update', 'stats', 'swimmer', 'sound', 'pursuer', 'bubbles', 'wait-tick']);
});

test('bubble allocator uses first free; full pool still consumes draws and emits sound5', () => {
  const draws = [];
  const { s, step } = setup({ draw: bound => { draws.push(bound); return 0; } });
  s.bubbles = Array.from({ length: 10 }, (_, i) => ({ active: i !== 3, x: 100 + i, y: 150, dx: 0, dy: 0, large: false }));
  const effects = step();
  assert.equal(s.bubbles[3].x, 44);
  assert.equal(s.bubbles[0].x, 100);
  assert.equal(s.bubbles.filter(b => b.active).length, 10);
  assert.deepEqual(draws, [10, 10, 15]);
  assert.equal(effects.find(e => e.type === 'sound').id, 5);
  s.bubbles[0] = { active: true, x: 317, y: 79, dx: 1, dy: -10, large: false };
  step();
  assert.equal(s.bubbles[0].active, false); assert.equal(s.bubbles[0].large, true);
});

test('wrap changes pursuer mode AFTER selecting current sprite', () => {
  const { s, step } = setup();
  s.swimmer.x = 319; s.swimmer.y = 112; s.swimmer.delay = 0;
  s.pursuer.drawnX = 300;
  step();
  assert.equal(s.swimmer.x, -55);
  assert.equal(s.pursuer.x, 242); // -55-48-trunc((160-113)/2)+368
  assert.equal(s.pursuer.resourceIndex, 18);
  assert.equal(s.pursuer.mode, 2);
  step(); assert.equal(s.pursuer.resourceIndex, 24);
});

test('failure chase reaches threshold without collision gate, sinking ends from OLD y199', () => {
  const { s, time, step } = setup();
  s.pursuer.drawnX = -18;
  time(382, 21); step();
  assert.equal(s.savedY, 112); assert.equal(s.failurePhase, 2);
  assert.equal(s.swimmer.y, 112); // swimmer updated BEFORE pursuer sets phase2
  step(); assert.equal(s.swimmer.y, 113); assert.equal(s.swimmer.resourceIndex, 34);
  s.swimmer.y = 198; step();
  assert.equal(s.swimmer.y, 199); assert.equal(s.ended, false);
  step();
  assert.equal(s.swimmer.y, 200); assert.equal(s.ended, false);
  const effects = step(); // return from final changed-tick wait
  assert.equal(s.sunk, true); assert.equal(s.ended, true);
  assert.equal(s.progression.advanced, false);
  assert.ok(types(effects).includes('failure-exit'));
});

test('bonus activation falls through, conditional drift draws, clamps and expiry', () => {
  const draws = [], values = [9, 14, 99, 1, 0];
  const { s, step } = setup({ draw: bound => { draws.push(bound); return values.shift() ?? 0; } });
  s.swimmer.x = 239;
  step();
  assert.deepEqual(draws, [10, 15, 100, 2, 2]);
  assert.equal(s.bonus.x, 120); assert.equal(s.bonus.y, 197); assert.equal(s.bonus.mode, 2);
  s.draw = bound => bound === 10 || bound === 15 ? 1 : 0;
  s.bonus.x = 131; s.bonus.y = 82;
  step();
  assert.equal(s.bonus.x, 130); assert.equal(s.bonus.y, 200); assert.equal(s.bonus.mode, 0);
});

test('bonus intercept before scoring, excludes playback ticks, flushes, continues same loop', () => {
  const { s, input, time, step } = setup();
  s.bonus.mode = 2; s.bonus.code = 97;
  time(182, 10); input.enqueue(97, 98);
  const before = step();
  assert.equal(s.phase, 'bonus'); assert.equal(s.bonus.mode, 3);
  assert.equal(s.timer.ticks, 182); assert.equal(s.timer.running, false);
  assert.equal(s.stats.attempts, 0); assert.equal(s.window[s.targetIndex], 97);
  assert.deepEqual(types(before), ['background-update', 'play-bonus']);
  time(1820, 100); assert.deepEqual(step(), []);
  const after = step({ bonusComplete: true });
  assert.equal(s.lastInput, 100); assert.equal(s.failed, false); assert.equal(input.pending(), false);
  assert.equal(s.timer.ticks, 182); assert.equal(s.timer.running, true);
  assert.equal(s.bonus.mode, 0);
  assert.deepEqual(types(after), ['restore-scene', 'prompt-stop', 'text', 'restore-palette', 'stats', 'swimmer', 'pursuer', 'bubbles', 'bonus-erase', 'wait-tick']);
  time(2002, 110); step(); assert.equal(s.timer.ticks, 364);
});

test('bonus during failure resumes timer without clearing failure; failure exit does not stop it', () => {
  const { s, input, time, step } = setup();
  s.bonus.mode = 2; s.bonus.code = 97;
  time(400, 21); input.enqueue(97); step();
  assert.equal(s.failed, true); assert.equal(s.phase, 'bonus');
  time(800, 40); step({ bonusComplete: true });
  assert.equal(s.timer.running, true); assert.equal(s.failed, true);
  s.failurePhase = 2; s.swimmer.y = 199;
  time(818, 41); step();
  step();
  assert.equal(s.sunk, true); assert.equal(s.timer.running, true);
});

test('profile result gates and ordered celebration/save/cleanup/results', () => {
  for (const [failed, exitGate, option10, advances] of [[false, false, false, true], [true, false, true, false], [false, true, false, false], [false, true, true, true]]) {
    const { s, input, step } = setup({ profilePresent: true, option10,
      profile: { goal: 10, lesson: 6, completed: [false, false, false] } });
    s.stats.wpm = 26; s.stats.elapsedSeconds = 300;
    s.failed = failed; s.exitGate = exitGate;
    input.enqueue(1, 1); // preserve cached result, pending skips refresh
    step();
    assert.equal(s.progression.advanced, advances);
    if (advances) {
      assert.equal(s.phase, 'celebration'); assert.equal(s.progression.state.goal, 30);
      assert.equal(s.progression.state.completed[1], true);
      assert.deepEqual(step(), []);
      assert.deepEqual(types(step({ celebrationComplete: true })), ['save-profile', 'cleanup', 'audio-reset', 'results']);
    } else assert.equal(s.phase, 'ended');
  }
});

test('reentry resets allocations/player/peak but retains counter/pursuer words and stream whitespace', () => {
  const first = setup();
  first.s.swimmer.counter = 32767; first.s.pursuer.frame = 8;
  first.s.pursuer.x = 123; first.s.pursuer.y = 140; first.s.pursuer.drawnX = 125;
  first.s.failurePhase = 2; first.s.failed = true;
  const stream = loadCorpus(Buffer.from(' \tA B'), 32);
  const second = setup({ previous: first.s, stream });
  const { s } = second;
  assert.equal(s.swimmer.x, 20); assert.equal(s.swimmer.peak, 0); assert.equal(s.failed, false);
  assert.equal(s.swimmer.counter, 32767); assert.equal(s.pursuer.frame, 8);
  assert.equal(s.pursuer.x, 123); assert.equal(s.pursuer.drawnX, 125); assert.equal(s.pursuer.mode, 1);
  assert.equal(s.window[s.targetIndex], 65); // retained previous-space suppresses leading whitespace
  assert.ok(s.bubbles.every(b => !b.active));
  second.step();
  assert.equal(s.swimmer.counter, -32768); assert.equal(s.swimmer.frame, 1);
  assert.equal(s.swimmer.resourceIndex, 1); // retained phase2 alone is NOT sunk art
});

test('shared RNG consumes five entry draws and correct loop stream position', () => {
  const rng = { seed: 123 };
  let reference = 123n;
  const draw = bound => {
    reference = (reference * 0x015a4e35n + 1n) & 0xffffffffn;
    return Number(((reference >> 16n) & 32767n) * BigInt(bound) / 32768n);
  };
  for (const bound of [250, 30, 30, 15, 270]) draw(bound);
  const { s, step } = setup({ rng, previousLimitSeconds: 300, draw: undefined });
  assert.equal(rng.seed, Number(reference));
  if (draw(10) === 0) draw(10);
  draw(15);
  step();
  assert.equal(rng.seed, Number(reference)); assert.equal(s.bonus.mode, 1);
});

test('wall/tick services are sampled in source order and final stop follows wait acknowledgment', () => {
  const calls = [];
  const clock = { seconds: () => { calls.push('seconds'); return 7; },
    ticks: () => { calls.push('ticks'); return 100; } };
  const { s, input, step } = setup({ clock });
  assert.deepEqual(calls, ['seconds', 'ticks', 'seconds']);
  assert.equal(s.stats.startedAt, 7);
  calls.length = 0; input.enqueue(27); step();
  assert.deepEqual(calls, ['seconds', 'seconds', 'seconds', 'ticks']);
  assert.equal(s.stats.refreshedAt, 7); assert.equal(s.stats.stoppedAt, 0);
  calls.length = 0; step();
  assert.deepEqual(calls, ['seconds', 'ticks']); assert.equal(s.stats.stoppedAt, 7);
});

test('idle path does not invent a deferred redraw: source textFlag remains1', () => {
  const { s, input, step } = setup();
  input.enqueue(97, 1);
  assert.equal(step().some(e => e.type === 'text'), false);
  step(); // ignored key drains queue without a text redraw
  assert.equal(s.textFlag, 1);
  assert.equal(step().some(e => e.type === 'text'), false);
});

test('zero bonus drift consumes only one draw and does not rearm after expiry', () => {
  const draws = [];
  const { s, step } = setup({ draw: bound => { draws.push(bound); return bound === 2 ? 0 : 1; } });
  s.bonus.mode = 2; s.bonus.x = 10; s.bonus.y = 80;
  s.swimmer.x = 250;
  step();
  assert.deepEqual(draws, [10, 15, 2]);
  assert.equal(s.bonus.x, 10); assert.equal(s.bonus.mode, 0);
  draws.length = 0; step();
  assert.deepEqual(draws, [10, 15]); assert.equal(s.bonus.mode, 0);
});

test('duration multiplies low signed word; forced bonus delay still consumes entry draw', () => {
  const a = setup({ minutes: 547, option10: false });
  const b = setup({ minutes: 547, option10: true });
  assert.equal(a.s.limitSeconds, -32716);
  assert.equal(a.rng.seed, b.rng.seed); assert.equal(b.s.bonus.delay, 15);
  a.step(); assert.equal(a.s.timedOut, true);
});

test('stats writes profile WPM even during failed play, but no-attempt accuracy survives', () => {
  const profile = { goal: 10, lesson: 2, completed: [false, false, false], accuracy: 83, lastWpm: 17 };
  const { s, time, step } = setup({ profile });
  time(182, 21); step();
  assert.equal(s.failed, true); assert.equal(s.profile.lastWpm, 0); assert.equal(s.profile.accuracy, 83);
  assert.equal(profile.lastWpm, 17); // caller commits explicit controller output
  assert.equal(s.profile.previousGoal, 10);
});

test('demo waits30 loops then synthesizes target and draws new delay before movement', () => {
  const draws = [];
  const { s, step } = setup({ demo: true, draw: bound => { draws.push(bound); return bound - 1; } });
  for (let n = 0; n < 30; n++) step();
  assert.equal(s.stats.attempts, 0); assert.equal(s.demoDelay, 0);
  draws.length = 0; step();
  assert.equal(s.stats.correct, 1); assert.equal(s.demoDelay, 5);
  assert.deepEqual(draws, [5, 10, 15]);
});
