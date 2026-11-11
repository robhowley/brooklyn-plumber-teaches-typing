// MarioTea/MARIO/MARIO.EXE SHA256
// 6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e.
// FILE offsets below. Host clocks/input/presentation are explicit, no DOS execution.
import { i16, durationSeconds, waterCharacter, waterSwimmer, waterPursuer, waterBubble } from './routines.mjs';
import { waterBubbleSources } from './tables.mjs';
import { boundedRandom, initializeBonus, outdoorBonusDelay, nextWater, matchesBonus } from '../runtime/runtime.mjs';
import { timer, score } from '../control/scoring.mjs';
import { progression } from '../control/flow.mjs';

const signedByte = n => (n << 24) >> 24;
const emit = (s, type, fields = {}) => s.effects.push({ type, ...fields });
const timerOp = (s, operation) => { s.timer = timer(s.timer, operation, s.clock.ticks()); };

// 16e0c..16f4b: only the temporary DISPLAY copy is sanitized. DS:4c9f is
// notably not cleared here. Do not reinterpret it as a conventional dirty flag.
function redraw(s) {
  s.redrawCount = 0;
  s.display = s.window.slice(0, s.width).map(b => b >= 32 && b <= 127 ? b : 32);
  emit(s, 'text', { bytes: s.display.slice(), targetIndex: s.targetIndex });
}

// 174a1..1755f. Pending is sampled here AND again later in the polling loop.
function shift(s, filling = false) {
  s.window.copyWithin(0, 1, s.width);
  s.window[s.width - 1] = nextWater(s.stream) & 255;
  s.textFlag = 1;
  if (s.input.pending()) {
    s.redrawCount = i16(s.redrawCount + 1);
    if (s.redrawCount > 5) redraw(s);
  } else if (!filling) redraw(s);
  if (!filling) {
    const code = signedByte(s.window[s.targetIndex]);
    if (code !== s.lastPrompt) emit(s, 'prompt-stop');
    s.lastPrompt = code;
    emit(s, 'prompt', { code, argument: 5 });
  }
}

// 16f4c..16fd3: no random draw here, including when all ten records are occupied.
function bubble(s, x, y) {
  const index = s.bubbles.findIndex(b => !b.active);
  if (index !== -1) s.bubbles[index] = { active: true, x: i16(x), y: i16(y), dx: 0, dy: 0, large: false };
}

// 17560..17682. Activation falls through to motion in the SAME update.
function bonusUpdate(s) {
  const b = s.bonus;
  if (b.mode === 1 && s.swimmer.x >= 240) {
    b.mode = 2; b.x = i16(20 + s.draw(100)); b.y = 200;
  }
  if (b.mode === 2) {
    if (s.draw(2)) b.x = i16(b.x + (s.draw(2) ? -1 : 1));
    b.x = Math.max(10, Math.min(130, b.x));
    b.y = i16(b.y - 3);
    if (b.y < 80) { b.mode = 0; b.y = 200; }
    emit(s, 'bonus', { ...b, resourceIndex: 33 });
  }
  if (b.mode === 3) { emit(s, 'bonus-erase'); b.mode = 0; }
}

function results(s) {
  // 17e99..17ea2. Presentation and result UI are consumers, not this controller.
  emit(s, 'cleanup'); emit(s, 'audio-reset');
  emit(s, 'results', { suppressed: s.aborted, demo: s.demo, stats: { ...s.stats }, progression: s.progression });
  s.phase = 'ended';
}

function finish(s) {
  // 17a20: failure routine 17eab is empty. In particular it does NOT stop a
  // timer that a bonus during failure resumed. Preserve that unusual path.
  if (!s.failed) {
    s.stats.stoppedAt = s.clock.seconds() | 0; // operation130, 15a8e
    timerOp(s, 310); emit(s, 'normal-exit');
  }
  else emit(s, 'failure-exit');
  s.ended = true;
  s.progression = progression(s.profile, { mode: 2, resultWpm: s.stats.wpm,
    profilePresent: s.profilePresent, failed: s.failed, exitGate: s.exitGate, gateOverride: s.option10 });
  if (s.progression.advanced) {
    s.phase = 'celebration';
    emit(s, 'celebration', { progression: s.progression }); // 17aa3, phase5 presentation
  } else results(s);
}

// Continuation at 17923, also used AFTER bonus returns, not a new loop iteration.
function tail(s) {
  if ((s.stats.elapsedSeconds | 0) >= (s.limitSeconds | 0)) s.timedOut = true;
  if (!s.input.pending()) { // 17943..1794c, even abort/timeout still update once
    if (s.draw(10) === 0) {
      const index = s.draw(10) * 2;
      bubble(s, waterBubbleSources[index], waterBubbleSources[index + 1]);
    }
    s.stats.refreshedAt = s.clock.seconds() | 0; // operation100, 15bac
    timerOp(s, 100); // stats operation200 calls100 unconditionally at15d77
    s.stats = { ...s.stats, ...score({ ...s.stats, ticks: s.timer.ticks,
      limitSeconds: s.limitSeconds, previousAccuracy: s.stats.profileAccuracy }) };
    // 15cd7/15d71 write the shared profile fields even when progression is gated.
    s.profile.accuracy = s.stats.profileAccuracy;
    s.profile.lastWpm = s.stats.wpm;
    emit(s, 'stats', { ...s.stats });
    s.swimmer = waterSwimmer({ ...s.swimmer, failed: s.failed, failurePhase: s.failurePhase }, s.stats.wpm);
    s.swimmer.resourceIndex = s.failed && s.failurePhase === 2
      ? 34 + s.character : s.character * 6 + s.swimmer.frame;
    emit(s, 'swimmer', { ...s.swimmer });
    // 17457..17498: draw and sound happen even in failure / with full pool.
    if (s.draw(15) === 0) { bubble(s, s.swimmer.x + 38, s.swimmer.y + 15); emit(s, 'sound', { id: 5 }); }
    s.pursuer = waterPursuer({ ...s.pursuer, failed: s.failed,
      failurePhase: s.failurePhase, savedY: s.savedY }, s.swimmer);
    s.failurePhase = s.pursuer.failurePhase;
    emit(s, 'pursuer', { ...s.pursuer });
    const previous = s.bubbles.map(b => ({ ...b }));
    s.bubbles = s.bubbles.map(waterBubble);
    emit(s, 'bubbles', { previous, bubbles: s.bubbles.map(b => ({ ...b })) });
    bonusUpdate(s);
    emit(s, 'wait-tick'); // 1470c ->192a2: ONE changed-low-tick wait, no catchup
    s.phase = 'wait';
    return; // Even terminal loops wait BEFORE sampling the final stop time.
  }
  finishIteration(s);
}

function finishIteration(s) {
  s.sunk = Boolean(s.swimmer.ended);
  if (s.aborted || s.timedOut || s.sunk) finish(s);
}

/** Create after lessonPrefix/loadCorpus/selectCorpusSegment, in that order.
 * character is zero-based Mario/Luigi/Peach. stream retains previousWater.
 * clock={ticks:()=>signed32BIOSCount,seconds:()=>signed32WallTime}.
 * input uses createPendingInput's pending/consume/flush contract.
 * previous is the last Water controller, retained even across other worlds.
 * draw(bound) optionally instruments boundedRandom(rng,bound), not modulo RNG.
 * Entry emits effects in .effects; each step replaces that list.
 */
export function createWater({ stream, rng, input, clock, shortWindow = false, character = 0,
  minutes = 0, previousLimitSeconds = 0, previous = null, option10 = false, option20 = false,
  demo = false, profilePresent = false, profile = { goal: 10, lesson: 1, completed: [false, false, false] },
  previousAccuracy = profile.accuracy ?? 0, draw = bound => boundedRandom(rng, bound) }) {
  if (![0, 1, 2].includes(character)) throw new RangeError('Water character must be 0..2');
  // Shared initializer consumes four draws; Water, like Outside, consumes a fifth
  // delay draw even though Water's actor never reads delay (16bf5..16c3c).
  const bonus = initializeBonus(rng);
  bonus.delay = outdoorBonusDelay(rng, previousLimitSeconds, option10);
  const s = { stream, rng, input, clock, draw, option10, option20, demo, profilePresent,
    profile: { ...profile, completed: [...profile.completed], previousGoal: i16(profile.goal) },
    character, phase: 'active', effects: [], window: new Uint8Array(40),
    width: shortWindow ? 20 : 40, targetIndex: shortWindow ? 5 : 10,
    redrawCount: 0, textFlag: 0, lastPrompt: -1, demoDelay: 30,
    failed: false, aborted: false, exitGate: false, timedOut: false, sunk: false, ended: false,
    failurePhase: previous?.failurePhase ?? 0, savedY: 0,
    swimmer: { x: 20, y: 112, frame: 0, peak: 0, delay: 0, counter: previous?.swimmer.counter ?? 0, ended: false },
    pursuer: { mode: 1, frame: previous?.pursuer.frame ?? 0, x: previous?.pursuer.x ?? 0,
      y: previous?.pursuer.y ?? 0, drawnX: previous?.pursuer.drawnX ?? 0 },
    bubbles: Array.from({ length: 10 }, () => ({ active: false })), bonus,
    limitSeconds: durationSeconds(minutes, 300),
    stats: { attempts: 0, correct: 0, errors: 0, elapsedSeconds: 0, accuracy: 0,
      profileAccuracy: i16(previousAccuracy), wpm: 0, startedAt: 0, stoppedAt: 0, refreshedAt: 0 },
    timer: { ticks: 0, elapsedSeconds: 0, running: false, lastTicks: 0 } };
  emit(s, 'audio-reset'); emit(s, 'scene', { character });
  s.stats.startedAt = clock.seconds() | 0; // operation120, 15a58
  timerOp(s, 300); // operation120 before window fill, 16d06
  redraw(s);
  // Original loops indefinitely on an all-NUL corpus. Fail visibly instead.
  let fills = 0;
  do {
    if (++fills > stream.bytes.length + s.width) throw new RangeError('Water prefill cannot reach a nonzero target');
    shift(s, true);
  } while (s.window[s.targetIndex + 1] === 0);
  shift(s);
  emit(s, 'ready'); emit(s, 'music', { operation: 3 });
  s.lastInput = clock.seconds() | 0;
  return s;
}

/** One source loop, not one animation frame. If effects contain wait-tick, host
 * waits for a changed BIOS low tick, then calls with tickReady:true. This resumes
 * after the wait and (unless terminal) begins the next loop. Pending bursts can
 * therefore run several loops before waiting. Bonus/celebration acknowledgments
 * mean presentation COMPLETED; do not invent a duration or skip them silently.
 */
export function stepWater(s, { tickReady = false, bonusComplete = false, celebrationComplete = false } = {}) {
  s.effects = [];
  if (s.phase === 'ended' || s.phase === 'quit') return s.effects;
  if (s.phase === 'wait') {
    if (!tickReady) return s.effects;
    s.phase = 'active';
    finishIteration(s);
    if (s.ended) return s.effects;
  }
  if (s.phase === 'celebration') {
    if (celebrationComplete) { emit(s, 'save-profile'); results(s); }
    return s.effects;
  }
  if (s.phase === 'bonus') {
    if (!bonusComplete) return s.effects;
    emit(s, 'restore-scene'); emit(s, 'prompt-stop'); redraw(s); emit(s, 'restore-palette');
    s.lastInput = s.clock.seconds() | 0;
    timerOp(s, 300); // deliberately unconditional even when already failed
    s.input.flush();
    s.phase = 'active';
    tail(s);
    return s.effects;
  }
  // 176e6..17733: failure BEFORE checking pending, so a late key cannot rescue.
  const now = s.clock.seconds() | 0;
  if (!s.failed && ((now - s.lastInput) | 0) > 20) {
    timerOp(s, 310);
    s.failed = true; s.failurePhase = 1; s.savedY = s.swimmer.y;
    emit(s, 'failure-start');
  }
  emit(s, 'background-update'); // 09cab, presentation owns the raster effect
  const expected = signedByte(s.window[s.targetIndex]);
  let key = 0, handled = false;
  if (s.demo) {
    if (s.demoDelay === 0) { key = expected; s.demoDelay = i16(1 + s.draw(5)); }
    else s.demoDelay = i16(s.demoDelay - 1);
    handled = key !== 0;
  }
  if (!handled && s.input.pending()) {
    key = i16(s.input.consume()); handled = true;
    if (s.option20) emit(s, 'debug-key', { key });
  }
  if (handled) {
    s.lastInput = s.clock.seconds() | 0;
    if (key === 27 || key === 0x144) { s.aborted = true; s.exitGate = true; }
    else if (key === 0x12d) {
      if (s.option10) {
        // 149fc calls exit(0), NOT a pause or an ordinary lesson abort.
        s.phase = 'quit'; emit(s, 'quit'); return s.effects;
      }
    } else if (matchesBonus(s.bonus, key)) {
      timerOp(s, 310); s.bonus.mode = 3; s.phase = 'bonus';
      emit(s, 'play-bonus', { character: s.character }); return s.effects;
    } else {
      const result = waterCharacter(s.stats, key, expected);
      s.stats = result;
      if (result.result === 'advance-one-byte') { emit(s, 'sound', { id: 1 }); shift(s); }
      else if (result.result === 'retain-target') {
        emit(s, 'sound', { id: 11 }); redraw(s); emit(s, 'key-error', { code: expected });
      }
    }
  } else if (!s.textFlag) redraw(s); // 17910, not a guessed deferred flush
  tail(s);
  return s.effects;
}
