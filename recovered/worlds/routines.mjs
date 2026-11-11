// Static translations of MarioTea/MARIO/MARIO.EXE, SHA256
// 6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e.
// FILE offsets, not segment offsets. No original code is executed.
// Rendering, audio, input polling and scheduling are deliberately not implemented.
import { thwompFrame, thwompY, waterPursuerY } from './tables.mjs';
export const i16 = value => (value << 16) >> 16;
const inc = value => i16(value + 1);
const div = (a, b) => Math.trunc(i16(a) / i16(b));

// 16d0e..16d34; b1e6..b20c; castle d949..d96f. IMUL then CWD discards high product.
export function durationSeconds(minutes, defaultSeconds) {
  return i16(minutes) === 0 ? defaultSeconds : i16(i16(minutes) * 60);
}

// 17892..178e5. Castle differs: 7f is excluded and typing can be locked.
// Only ordinary input branch, NOT bonus-key, escape or special-key dispatch.
export function waterCharacter(stats, key, expected) {
  key = i16(key);
  if (key < 32 || key >= 128) return { ...stats, result: 'ignored' };
  const correct = key === i16(expected);
  return { ...stats, attempts: inc(stats.attempts),
    correct: correct ? inc(stats.correct) : stats.correct,
    errors: correct ? stats.errors : inc(stats.errors),
    result: correct ? 'advance-one-byte' : 'retain-target' };
}

// b10f..b138. Practice temporarily selects a normal-world corpus, then restores mode4.
export function practiceCorpus(goal) {
  return i16(goal) < 10 ? 'letters' : i16(goal) < 30 ? 'words' : 'sentenc';
}

// b73d..b7e0. End-of-line accepts either SPACE or CR. LF cannot reach its later test.
export function practiceCharacter(stats, key, expectedByte) {
  key = i16(key); expectedByte &= 255;
  if (!((key >= 32 && key < 128) || key === 13)) return { ...stats, result: 'ignored' };
  const nextLine = expectedByte === 0 && (key === 32 || key === 13);
  const correct = nextLine || key === ((expectedByte << 24) >> 24);
  return { ...stats, attempts: inc(stats.attempts),
    correct: correct ? inc(stats.correct) : stats.correct,
    errors: correct ? stats.errors : inc(stats.errors),
    result: nextLine ? 'next-line' : correct ? 'advance-one-byte' : 'retain-target',
    resetLastCorrectTime: correct };
}

// b502..b547. Caller uses expression resources 101,102,103 -> GSK indices 0,1,2.
export function practiceExpression(now, lastCorrect, profileEnabled, wpm, goal) {
  if (((now - lastCorrect) | 0) > 15) return 0;
  return profileEnabled && i16(wpm) > i16(goal) ? 2 : 1;
}

// bc7e..bcd0. Only operation 2 sets failure here; elapsed subtraction is signed32.
export function castleFailure({ operation, failed, attempts, accuracy, now, lastInput }) {
  if (operation !== 2) return failed;
  return failed || (i16(attempts) >= 50 && i16(accuracy) < 70) || ((now - lastInput) | 0) > 20;
}

// 17301..17446. One numeric movement update, not one BIOS tick or browser frame.
// WPM*63 is truncated to signed16 BEFORE signed division (1735c..1735f).
export function waterSwimmer(s, wpm) {
  let peak = Math.max(10, i16(s.peak), i16(wpm));
  let target = s.y, ended = s.ended;
  if (!s.failed) target = i16(157 - div(i16(i16(wpm) * 63), peak));
  else if (s.failurePhase === 2) { target = 200; if (i16(s.y) >= 199) ended = true; }
  let y = i16(s.y);
  if (target < y) y = i16(y - 1);
  if (target > y) y = inc(y);
  const counter = inc(s.counter);
  let frame = i16(s.frame + ((counter & 1) === 0 ? 1 : 0));
  let delay = i16(s.delay - 1), x = i16(s.x);
  if (delay < 0) {
    if (!s.failed) x = inc(x);
    delay = inc(div(div(i16(s.y - 79), 16), 5));
  }
  if (x > 319) x = -55;
  if (frame >= 6) frame = 0;
  return { ...s, peak, target, x, y, counter, frame, delay, ended };
}

// 1711d..172cf. s.x=DS:4c37; s.drawnX=4c39; phase=4c1d.
// Actor names follow GSK: mode1 bite (18..22), mode2 octo (23..32).
export function waterPursuer(s, player) {
  let mode = s.mode || 1, frame = inc(s.frame), phase = s.failurePhase;
  if ((mode === 1 && frame >= 10) || (mode === 2 && frame >= 20)) frame = 0;
  const gap = div(i16(160 - player.y), 2);
  let x = s.x, y;
  if (s.failed) {
    if (phase === 1) {
      x = i16(s.drawnX + 3);
      if (i16(player.x - 35) <= x) phase = 2;
    }
    y = i16(s.savedY - 5);
  } else {
    x = i16(player.x - 48 - gap);
    if (x < -55) x = i16(x + 368);
    y = i16(player.y - 5);
  }
  let adjustX = 0, resourceIndex;
  if (mode === 1) {
    if (div(frame, 2) !== 3) adjustX = -2;
    resourceIndex = 18 + div(frame, 2);
  } else if (mode === 2) {
    if (frame < 0 || frame >= 20) throw new RangeError('outside recovered table domain');
    y = i16(y + waterPursuerY[frame]); resourceIndex = 23 + div(frame, 2);
  }
  if (i16(s.drawnX - 40) > x) { if (mode === 1) mode = 2; else if (mode === 2) mode = 1; }
  return { ...s, x, y, drawnX: i16(x + adjustX), mode, frame, failurePhase: phase, gap, resourceIndex };
}

// 17013..170f5. Pool allocation 16f61..16fcc uses first free of ten 14-byte records.
export function waterBubble(s) {
  if (!s.active) return { ...s };
  const x = i16(s.x + s.dx), y = i16(s.y + div(s.dy, 8) - 1);
  const dy = i16(s.dy - 1), large = s.large || dy < -10;
  return { ...s, x, y, dy, large, active: x >= 0 && x <= 317 && y >= 79 && y <= 197 };
}

// c7f3..c845. Asymmetric +1 is intentional; equality explicitly resets velocity.
export function castleApproach(x, velocity, target) {
  x = i16(x); velocity = i16(velocity); target = i16(target);
  let desired = inc(div(i16(target - x), 4));
  if (target === x) { desired = 0; velocity = 0; }
  desired = Math.max(-5, Math.min(5, desired));
  if (velocity < desired) velocity = inc(velocity);
  if (velocity > desired) velocity = i16(velocity - 1);
  return { x: i16(x + velocity), velocity, desired };
}

// c451..c4d9. rockface table values 1..4 correspond to GSK indices 0..3.
// No collision calculation occurs in this routine. State100 stays down.
export function castleRockface(s, playerX) {
  let phase = i16(s.phase), y = i16(s.y), resourceIndex = s.resourceIndex;
  const triggered = phase === 0 && i16(s.x) <= i16(playerX);
  if (triggered) phase = 1;
  if (phase !== 0 && phase < 100) {
    if (phase < 1 || phase > 32) throw new RangeError('outside recovered table domain');
    y = i16(40 + thwompY[phase]); resourceIndex = thwompFrame[phase] - 1;
    phase = inc(phase); if (phase >= 33) phase = 100;
  }
  return { ...s, phase, y, resourceIndex, triggered };
}

// cd7a..cdac, distinct from sinking failure animation c36e.
export function castleSand(x, targetX, wpm) {
  x = i16(x); wpm = i16(wpm);
  const y = wpm >= 40 ? 70 : i16(70 + Math.min(10, div(i16(40 - wpm), 4)));
  return { x: x < i16(targetX) ? inc(x) : x, y };
}

// bf30..bf47. Caller skips computation for zero length; return previous target then.
export function castleTextTarget(correctInSegment, length, previous) {
  if (i16(length) === 0) return previous;
  return i16(div(i16(i16(correctInSegment) * 160), length) + 67);
}
