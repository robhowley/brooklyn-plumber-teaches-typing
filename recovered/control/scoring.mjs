// Direct arithmetic translation of MarioTea/MARIO/MARIO.EXE FILE 0x15bac..0x15d74.
// Hash and instruction bytes: ../../analysis/control/{identity.json,score.asm.txt}.
export const s16 = n => (n << 16) >> 16;
export const s32 = n => n | 0;

export function score({ attempts, correct, errors, ticks, limitSeconds, previousAccuracy = 0 }) {
  attempts = s16(attempts); correct = s16(correct); errors = s16(errors); ticks = s32(ticks);
  // 0x15c36: low 32 bits of multiply; signed quotient truncates toward zero.
  const elapsedSeconds = Math.min(s32(Math.trunc(Math.imul(ticks, 10) / 182)), s32(limitSeconds));
  // 0x15c8f: structure accuracy zeroed, but DS:50bb is NOT written if attempts <= 0.
  const accuracy = attempts > 0 ? s16(Math.trunc(correct * 100 / attempts)) : 0;
  const profileAccuracy = attempts > 0 ? accuracy : s16(previousAccuracy);
  // 0x15cf8: individually sign-extend counters before subtracting, not 16-bit subtraction.
  // 0x15d53: truncate quotient to signed 16 bits BEFORE clamping negative result.
  const wpm = ticks > 0 ? Math.max(0, s16(Math.trunc(Math.max(0, correct - errors) * 182 / ticks))) : 0;
  return { elapsedSeconds, accuracy, profileAccuracy, wpm };
}

// Operation 300 resume (0x15afb), 310 pause (0x15b20), 320 reset (0x15b66),
// 100 refresh (0x15bee). Caller supplies a BIOS tick count, not milliseconds.
// This pure state API is a host adaptation; arithmetic and transition predicates are recovered.
export function timer(state, operation, nowTicks) {
  const s = { ...state }; nowTicks = s32(nowTicks);
  if (operation === 320) return { ...s, ticks: 0, elapsedSeconds: 0, running: false };
  if (operation === 300) {
    if (!s.running) { s.lastTicks = nowTicks; s.running = true; }
  } else if (operation === 310) {
    if (s.running) { s.ticks = s32(s.ticks + s32(nowTicks - s.lastTicks)); s.running = false; }
  } else if (operation === 100) {
    if (s.running) s.ticks = s32(s.ticks + s32(nowTicks - s.lastTicks));
    s.lastTicks = nowTicks; // also updated while paused
  } else throw new RangeError('Supported timer operations: 100, 300, 310, 320');
  return s;
}
