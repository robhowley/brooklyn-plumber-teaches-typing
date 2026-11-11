/** Recovered arithmetic and ordinary outdoor loop, MARIO.EXE SHA256
 * 6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e.
 * All addresses below are executable FILE offsets. Host drawing/audio, BIOS
 * clock, ready audio, bonus cinematics and statistics dispatcher are NOT emulated.
 */
export const i16 = n => (n << 16) >> 16;
export const u16 = n => n & 65535;
export const JUMP_Y = Object.freeze([0, -19, -26, -28, -28, -25, -20, -2, 0, 0, 0, 0]); // 0x219b4, DS:2744
export const CURSOR_FRAMES = Object.freeze([0, 1, 2, 3, 2, 1]); // 0x219a4, DS:2734
export const BLOCK_HEIGHTS = Object.freeze([57, 50, 42, 33]); // 0x219d6, DS:2766

// 0x03a3c..0x03a67; DS:3903 bit 8 is set ONLY for ASCII a..z.
export function upperCode(code) {
  if (i16(code) === -1) return -1;
  const byte = code & 255;
  return byte >= 97 && byte <= 122 ? byte - 32 : byte;
}

// 0x037be..0x0382c: low 32-bit LCG product; return high word & 0x7fff.
export function random15(state) {
  const seed = (Math.imul(state >>> 0, 0x015a4e35) + 1) >>> 0;
  return { seed, value: (seed >>> 16) & 0x7fff };
}

// 0x093f6..0x0946b. Browser boundary rejects degenerate corpora rather than hanging.
export function lessonBytes(bytes) {
  const result = [126];
  for (const byte of bytes) {
    if (byte === 26) break;
    if (byte !== 13) result.push(byte);
  }
  if (!result.some(b => b > 32 && b < 127 && b !== 126)) throw new RangeError('No outdoor targets');
  return Uint8Array.from(result);
}

// 0x09519..0x09560 then 0x130b6..0x130ce. Skips ~, whitespace, DEL,
// extended bytes. Backtick is NOT excluded. Caller supplies already loaded bytes.
export function nextTarget(stream) {
  for (let n = 0; n < stream.bytes.length; n++) {
    const byte = stream.bytes[stream.index];
    stream.index = (stream.index + 1) % stream.bytes.length;
    if (byte > 32 && byte < 127 && byte !== 126) return upperCode(byte);
  }
  throw new RangeError('No outdoor targets');
}

// 0x0964a: random segment selection advances through tilde delimiters.
export function selectLessonSegment(stream, randomValue) {
  const count = stream.bytes.reduce((n, b) => n + (b === 126), 0);
  let skip = Math.trunc(randomValue * count / 32768);
  while (skip-- > 0) {
    for (let n = 0; n <= stream.bytes.length; n++) {
      const byte = stream.bytes[stream.index];
      stream.index = (stream.index + 1) % stream.bytes.length;
      if (byte === 126) break;
    }
  }
}

// 0x12dbb..0x12ee3. Type draw is floor(2*rand/32768). The SECOND
// block draw is floor(rand/32768), always zero for this RNG. Do not randomize height.
export function makeObstacle(code, typeDraw, heightDraw = 0) {
  const type = 1 + Math.trunc(typeDraw * 2 / 32768);
  if (type !== 1 && type !== 2) throw new RangeError('Expected 15-bit RNG output');
  return { active: true, flag: 0, x: type === 1 ? 293 : 283,
    y: type === 1 ? BLOCK_HEIGHTS[Math.trunc(heightDraw / 32768)] : 123,
    xOffset: type === 1 ? 0 : 30, code, countdown: 0, type, variant: 0 };
}

const emptyObstacle = () => ({ active: false, code: 0 });

// Initialization from 0x12902, 0x12a21..0x12a8c; zero-initialized counters
// represent a fresh process. Reentering an activity may retain original counters.
export function createOutdoor({ bytes, seed, character = 1, lessonIndex = 0 }) {
  if (seed === undefined) throw new TypeError('Supply RNG seed, original startup seed is host-dependent');
  character = character >= 1 && character <= 3 ? character : 1; // 0x1d622
  return { character, seed: seed >>> 0, stream: { bytes: lessonBytes(bytes), index: lessonIndex },
    obstacles: Array.from({ length: 10 }, emptyObstacle), particles: [],
    x: 20, y: 90, mode: 0, jumpIndex: 0, followX: 0,
    cursorX: -1, cursorCounter: 0, cursorFrame: 0, targetIndex: -1,
    speed: 5, scroll: 1, groundPhase: 0, stillTicks: 0, idleTicks: 0,
    distance: 0, frame: { kind: 'idle', index: 0 },
    attempts: 0, correct: 0, errors: 0, aborted: false, ended: false };
}

// 0x135dc..0x136a0. IMUL's HIGH word is discarded by CWD before IDIV.
export function motion({ x, cursorX, mode, followX, scroll, speed }) {
  if (mode === 0) followX = i16(cursorX - 10);
  followX = i16(followX - scroll);
  let dx = 0;
  if (cursorX >= 0) {
    dx = i16(Math.trunc(i16(followX - x) / 8) + (followX > x ? 1 : -2));
    dx = Math.max(-8, Math.min(8, dx));
    if (followX === x) dx = 0;
  }
  return { followX, dx, x: Math.max(0, i16(x + dx)),
    scroll: i16(Math.trunc(i16(speed * (cursorX < 0 ? 319 : cursorX)) / 160)) };
}

// 0x13701..0x13747: signed byte schedule comparisons, previous entry wins.
export function idleFrame(ticks, schedule, period) {
  let next = i16(ticks + 1);
  if (Math.trunc(next / 2) >= period) next = 0;
  let index = 0;
  for (let i = 0; i < schedule.length; i++) {
    const signedByte = (schedule[i] << 24) >> 24;
    if (signedByte > Math.trunc(next / 2)) { index = Math.max(0, i - 1); break; }
  }
  return { ticks: next, index };
}

// 0x135c9..0x13851. Schedule comes from tables.json, not invented timing.
export function updatePlayer(s, idleSchedule, idlePeriod) {
  const previousFrame = s.frame;
  const m = motion(s);
  Object.assign(s, { followX: m.followX, x: m.x, scroll: m.scroll });
  s.y = 90;
  if (s.mode === 0) {
    if (m.dx !== 0) { s.stillTicks = 0; s.idleTicks = 0; }
    else s.stillTicks = i16(s.stillTicks + 1);
    if (s.stillTicks > 4) {
      s.stillTicks = 10;
      if (!idleSchedule) throw new TypeError('Idle schedule required after four stationary updates');
      const idle = idleFrame(s.idleTicks, idleSchedule, idlePeriod);
      s.idleTicks = idle.ticks;
      s.frame = { kind: 'idle', index: idle.index };
    } else s.frame = { kind: 'run', index: Math.trunc(s.distance / 6) % 12 };
    s.distance = i16(s.distance + Math.abs(m.dx));
  } else if (s.mode === 1 || s.mode === 2) {
    s.y = i16(90 + JUMP_Y[s.jumpIndex]);
    s.frame = { kind: 'jump', index: s.jumpIndex };
    s.jumpIndex = i16(s.jumpIndex + 1);
    if (s.jumpIndex >= 12) {
      s.jumpIndex = 0; s.y = 85; s.obstacles[0].flag = 1;
      s.mode = s.mode === 2 ? 3 : 0;
    }
    // Mode 2 holds the previous image while finishing its Y sequence.
    if (s.mode === 2) s.frame = previousFrame;
  }
}

function drawRandom(s) {
  const r = random15(s.seed); s.seed = r.seed; return r.value;
}

// 0x13058..0x133f6. No proximity gate: spawn if all active x <= 220.
export function updateObstacles(s) {
  const events = [];
  if (!s.obstacles.some(o => o.active && o.x > 220)) {
    const code = nextTarget(s.stream); // original consumes even if no free slot
    const free = s.obstacles.findIndex(o => !o.active);
    if (free >= 0) {
      const typeDraw = drawRandom(s);
      s.obstacles[free] = makeObstacle(code, typeDraw, typeDraw < 16384 ? drawRandom(s) : 0);
    }
  }
  for (const o of s.obstacles) {
    if (!o.active) continue;
    let x = i16(o.x - s.scroll);
    if (o.countdown !== 0) {
      o.countdown = i16(o.countdown - 1);
      if (o.countdown <= 0) {
        x = -1;
        events.push({ type: 'sound', id: o.type === 1 ? 4 : 3 });
        if (o.type === 1) {
          const ox = s.character === 3 ? 36 : 0, oy = s.character === 3 ? 30 : 0;
          for (const [dx, dy, vx, vy] of [[0, 0, -2, -6], [0, 8, -2, -3], [10, 0, 2, -6], [10, 8, 2, -3]]) {
            if (s.particles.length < 16) s.particles.push({ x: i16(o.x + ox + dx), y: i16(o.y + oy + dy), vx, vy });
          }
        }
      }
      if (o.type === 2) o.shell = true;
    }
    o.x = x;
    if (x < 0) o.active = false;
  }
  // Exactly ONE shift when first record inactive, not full array filtering.
  if (!s.obstacles[0].active) { s.obstacles.shift(); s.obstacles.push(emptyObstacle()); }
  return events;
}

// 0x12f59..0x13057. New fragments also advance on the tick they were spawned.
export function updateParticles(s) {
  s.particles = s.particles.filter(p => {
    const x = i16(p.x + p.vx - s.scroll), y = i16(p.y + p.vy);
    p.vy = i16(p.vy + 1);
    if (x < 0 || x > 309 || y < 0 || y > 131) return false;
    p.x = x; p.y = y; return true;
  });
}

// 0x133f7..0x134cc. Stops at first inactive record, skips already-cleared codes.
export function selectTarget(s) {
  s.cursorCounter = i16(s.cursorCounter + 1);
  if (s.cursorCounter >= 12) s.cursorCounter = 0;
  s.cursorFrame = CURSOR_FRAMES[Math.trunc(s.cursorCounter / 2)];
  s.targetIndex = -1; s.cursorX = -1;
  for (let i = 0; i < 10; i++) {
    const o = s.obstacles[i];
    if (!o.active) break;
    if (o.code === 0) continue;
    s.targetIndex = i; s.cursorX = o.x; break;
  }
}

// 0x13ba1..0x13d1a, ordinary input path. Call AFTER selectTarget, once per tick.
// Bonus exact-case interception (DS:5012==2) belongs before this function.
export function acceptKey(s, code) {
  if (code < 32 || code >= 128 || s.targetIndex < 0) return 'ignored';
  const o = s.obstacles[s.targetIndex];
  s.attempts = u16(s.attempts + 1);
  if (upperCode(code) !== o.code) { s.errors = u16(s.errors + 1); return 'wrong'; }
  s.correct = u16(s.correct + 1);
  if (s.mode === 0 && o.type === 1) { s.mode = 1; s.jumpIndex = 0; }
  o.countdown = 6; o.code = 0;
  return 'correct';
}

// 0x14e95..0x14f38, then outdoor override 0x12c0c..0x12c4e.
// Draw #3 is consumed even though outdoor immediately replaces that timer.
// priorDuration is statistics +0x1f BEFORE outdoor's duration reset.
export function makeBonus(rngState, priorDuration, fast = false) {
  const draws = [];
  for (let i = 0; i < 5; i++) { const r = random15(rngState); rngState = r.seed; draws.push(r.value); }
  return { seed: rngState, mode: 1, x: 20 + Math.trunc(draws[0] * 250 / 32768),
    y: 5 + Math.trunc(draws[1] * 30 / 32768), code: 33 + Math.trunc(draws[3] * 15 / 32768),
    countdown: fast ? 15 : i16(15 + Math.trunc(Math.imul(draws[4], (priorDuration - 30) | 0) / 32768)),
    lastSecond: 0 };
}

// 0x13852..0x13975. State 1 counts OBSERVED second changes, state 2 counts
// game iterations. Once expired there is no rearm in this routine.
export function updateBonus(bonus, playerX, second) {
  if (bonus.mode === 1 && second !== bonus.lastSecond) {
    bonus.lastSecond = second;
    bonus.countdown = i16(bonus.countdown - 1);
    if (bonus.countdown <= 0) { bonus.mode = 2; bonus.countdown = 45; }
  } else if (bonus.mode === 2) {
    if (bonus.x < playerX) bonus.x = i16(bonus.x + 1);
    if (bonus.x > playerX) bonus.x = i16(bonus.x - 1);
    bonus.countdown = i16(bonus.countdown - 1);
    if (bonus.countdown <= 0) bonus.mode = 0;
  }
}

// 0x13b89..0x13b9e: end request preserves unfinished jump as state 2.
export function requestEnd(s, aborted = false) {
  s.aborted ||= aborted;
  s.mode = s.mode === 1 ? 2 : 3;
}

/** One ordinary-loop iteration, 0x139c7..0x13d35. Host must supply the
 * already-normalized ONE key and elapsed/limit seconds from the control worker.
 * Call only after ready audio. No input queue or browser wallclock is invented.
 * The bonus cinematic path is deliberately returned, never silently simulated.
 */
export function tick(s, { key = 0, elapsed = 0, limit = 120, idleSchedule, idlePeriod,
  bonus = null, second = 0, exitShortcutEnabled = false } = {}) {
  if (s.ended) return [];
  s.groundPhase = i16(s.groundPhase + s.scroll) % 20; // 0x1436c, OLD scroll
  if (bonus) updateBonus(bonus, s.x, second); // before player movement, 0x139cd
  updatePlayer(s, idleSchedule, idlePeriod);
  const events = updateObstacles(s);
  updateParticles(s);
  selectTarget(s);
  if (elapsed >= limit) requestEnd(s);
  else if (key === 27 || key === 0x144) requestEnd(s, true);
  else if (key === 0x12d) {
    if (exitShortcutEnabled) events.push({ type: 'exit-program' });
  } else if (key >= 32 && key < 128 && bonus?.mode === 2 && key === bonus.code) {
    bonus.countdown = 0;
    events.push({ type: 'bonus-cinematic-required', source: '0x13bc5' });
  } else {
    const result = acceptKey(s, key);
    if (result !== 'ignored') events.push({ type: result, sound: result === 'correct' ? 1 : 11 });
  }
  if (s.mode === 3) { s.ended = true; events.push({ type: 'end', aborted: s.aborted }); }
  return events;
}
