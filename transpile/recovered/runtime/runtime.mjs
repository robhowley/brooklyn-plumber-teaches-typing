/** Static translations, MarioTea/MARIO/MARIO.EXE SHA256
 * 6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e.
 * Citations are FILE offsets. No machine-code execution or host clock hidden here.
 */
export const s16 = n => (n << 16) >> 16;
const s8 = n => (n << 24) >> 24;

// 0x37f6: srand takes ONLY a 16-bit argument, clears the seed high word.
// Startup 0x126a0..0x126b3 passes AX of time(NULL), not BIOS ticks/hundredths.
export const seedFromTime = timeSeconds => timeSeconds & 0xffff;

// 0x37be..0x382c. Mutates the same {seed} field used by recovered/outdoor.
export function random15(state) {
  state.seed = (Math.imul(state.seed, 0x015a4e35) + 1) >>> 0;
  return (state.seed >>> 16) & 0x7fff;
}

// 0x330c low-32 product then 0x339f SIGNED long division; AX retained by callers.
// Nonnegative ordinary bounds give floor(r*n/32768), NOT r % n.
export const scaleRandom = (draw, signedLongBound) =>
  s16(Math.trunc(Math.imul(draw, signedLongBound) / 32768));
export const boundedRandom = (state, bound) => scaleRandom(random15(state), bound);

// 0x7030..0x7159, valid DOS calendar fields. Offset/DST are outputs of 0x735e
// and 0x754c, deliberately caller-supplied, not the browser's timezone rules.
export function dosTimeSeconds({ year, month, day, hour, minute, second,
  timezoneSeconds, daylightActive }) {
  const y = s16(year - 1980);
  let result = (0x12cea600 + (timezoneSeconds | 0)) | 0;
  result = (result + Math.imul(y >> 2, 0x07861f80)) | 0;
  result = (result + Math.imul(y & 3, 0x01e13380)) | 0;
  if (y & 3) result = (result + 86400) | 0;
  const days = [31,28,31,30,31,30,31,31,30,31,30,31];
  let ordinal = day - 1;
  for (let m = 1; m < month; m++) ordinal += days[m - 1];
  if (month > 2 && !(year & 3)) ordinal++;
  const hours = s16(s16(ordinal * 24) + hour - (daylightActive ? 1 : 0));
  return (result + Math.imul(hours, 3600) + minute * 60 + second) | 0;
}

// 0x928b..0x9307. Lesson 6 consumes one draw, all other values none.
export function lessonPrefix(lesson, rng) {
  lesson = s16(lesson);
  if (lesson === 6) lesson = boundedRandom(rng, 5) + 1;
  return ['h','t','b','n','s'][lesson - 1] ?? 'h';
}

// 0x93f6..0x946b; the source-size guard at 0x93a6 allows <=32000.
// Throwing on unusable streams replaces the original infinite scan (host safety).
export function loadCorpus(raw, previousWater = 0) {
  if (raw.length > 32000) throw new RangeError('Original corpus size limit: 32000');
  const bytes = [126];
  let delimiters = 1;
  for (const byte of raw) {
    if (byte === 26) break;
    if (byte === 13) continue;
    bytes.push(byte);
    if (byte === 126) delimiters++;
  }
  if (!bytes.some(b => b !== 126)) throw new RangeError('Corpus would never yield a byte');
  return { bytes: Uint8Array.from(bytes), index: 0, delimiters, previousWater: s16(previousWater) };
}

// Cursor points at the NEXT raw byte. 0x9519 reads BEFORE incrementing.
function rawNext(stream) {
  const code = s8(stream.bytes[stream.index]);
  stream.index = s16(stream.index + 1);
  if (stream.index >= stream.bytes.length) stream.index = 0;
  return code;
}
export function nextCorpus(stream) {
  for (let n = 0; n < stream.bytes.length; n++) {
    const code = rawNext(stream);
    if (code !== 126) return code;
  }
  throw new RangeError('Corpus would never yield a byte');
}

// 0x94ce: counts non-~ AND non-backtick bytes, independently of reader kind.
export function rewindCorpus(stream, count) {
  count &= 0xffff;
  if (count && !stream.bytes.some(b => b !== 126 && b !== 96))
    throw new RangeError('Corpus rewind would never finish');
  while (count) {
    stream.index = s16(stream.index - 1);
    if (stream.index < 0) stream.index = stream.bytes.length - 1;
    const byte = stream.bytes[stream.index];
    if (byte !== 126 && byte !== 96) count--;
  }
}

// 0x95f2: scan INCLUDING the byte at current cursor, stop after consuming ~.
export function nextCorpusSegment(stream) {
  for (let n = 0; n <= stream.bytes.length; n++) if (rawNext(stream) === 126) return;
}
// 0x964a, called by loader at 0x947c. No reset inside this helper.
export function selectCorpusSegment(stream, rng) {
  if (!stream.delimiters) return;
  const skip = boundedRandom(rng, s16(stream.delimiters));
  for (let n = 0; n < (skip & 0xffff); n++) nextCorpusSegment(stream);
}

// 0x95a1 maps three whitespace bytes; backtick remains meaningful for castle.
export function nextCastle(stream) {
  const c = nextCorpus(stream);
  return c === 9 || c === 10 || c === 13 ? 32 : c;
}
// 0x9561: previousWater persists across calls, even corpus reloads in DOS.
export function nextWater(stream) {
  for (let n = 0; n < stream.bytes.length; n++) {
    const c = nextCastle(stream);
    if (stream.previousWater === 32 && c === 32) continue;
    stream.previousWater = c;
    return c;
  }
  throw new RangeError('Water corpus would never yield a nonspace');
}
// 0x95cf: do not collapse whitespace or discard LF/TAB/high-bit bytes.
export function nextPractice(stream) {
  for (let n = 0; n < stream.bytes.length; n++) {
    const c = nextCorpus(stream);
    if (c !== 96) return c;
  }
  throw new RangeError('Practice corpus would never yield a byte');
}

// 0xb3e1..0xb4d3. NOT conventional word wrapping. Returns 33 NUL-padded bytes.
// Early LF bypasses trimming. Full rows consume one peek, possibly rewind it.
export function practiceLine(stream) {
  const line = new Uint8Array(33);
  let tail = 0;
  for (let i = 0; i < 32; i++) {
    const code = nextPractice(stream);
    if (code === 10) {
      line.fill(0, line.indexOf(0)); // strcpy stops at any earlier embedded NUL
      return line;
    }
    tail = code === 32 ? 0 : tail + 1;
    line[i] = code & 255;
  }
  let end = line.indexOf(0) - 1; // strlen(line)-1 at 0xb471, not fixed 31
  const peek = nextPractice(stream);
  tail++;
  if (end === 32 || peek === 32) tail = 0;
  rewindCorpus(stream, tail);
  end -= tail - 1;
  if (end >= 0) line[end] = 0;
  // strcpy(line,line+1), repeated only on full-width path.
  while (line[0] === 32) {
    const length = line.indexOf(0);
    line.copyWithin(0, 1, length + 1);
  }
  // strcpy into a separately cleared bottom row discards bytes after embedded NUL.
  line.fill(0, line.indexOf(0));
  return line;
}

// rows: DS:41c5..430e, row0 input/display, row1 current target, row9 newest.
export function advancePracticeLine(state) {
  state.rows.copyWithin(33, 66, 330); // 0xb3f4, exactly 264 bytes
  state.rows.set(practiceLine(state.stream), 297);
  state.rows.fill(0, 0, 33); // 0xb391, input row is not a typed-text history
  state.index = 0;
}
export function createPractice(stream, lastCorrect = 0) {
  const state = { stream, rows: new Uint8Array(330), index: 0,
    attempts: 0, correct: 0, errors: 0, lastCorrect: lastCorrect | 0 };
  for (let i = 1; i < 10; i++) advancePracticeLine(state); // 0xb3ca
  return state;
}

// Ordinary acceptance only, 0xb73d..0xb7e0. Esc/Alt-X handled by host dispatcher.
export function practiceInput(state, key, nowSeconds) {
  key = s16(key);
  if (!((key >= 32 && key < 128) || key === 13)) return 'ignored';
  const expected = s8(state.rows[33 + state.index]);
  state.attempts = s16(state.attempts + 1);
  let result;
  if (expected === 0 && (key === 32 || key === 13)) {
    advancePracticeLine(state);
    result = 'next-line';
  } else if (key === expected) {
    state.index = s16(state.index + 1);
    result = 'advance-one-byte'; // original draws key directly, does not store row0
  } else {
    state.errors = s16(state.errors + 1);
    return 'retain-target';
  }
  state.correct = s16(state.correct + 1);
  state.lastCorrect = nowSeconds | 0;
  return result;
}

/** Host test transport for the source's separate pending/read/flush operations.
 * Unbounded FIFO capacity is an adaptation, NOT the DOS keyboard buffer size.
 * Supply raw bytes (extended keys as [0,scan] or [0xe0,scan]), not normalized keys.
 * 0x4ddb checks without consuming; 0x19241 normalizes only when another byte
 * is pending; 0x19221 drains raw bytes. Empty consume throws instead of blocking.
 */
export function createPendingInput() {
  const bytes = [];
  return {
    enqueue(...input) {
      if (input.some(b => !Number.isInteger(b) || b < 0 || b > 255))
        throw new RangeError('Expected raw keyboard bytes');
      bytes.push(...input);
    },
    pending() { return bytes.length !== 0; },
    consume() {
      if (!bytes.length) throw new RangeError('Original read would block');
      const first = bytes.shift();
      return (first === 0 || first === 0xe0) && bytes.length
        ? 0x100 + bytes.shift() : first;
    },
    flush() { bytes.length = 0; },
  };
}

// 0xff2a..0xff61: title consumes a delay draw only if no key is pending.
export const titleDelay = (rng, keyPending) => keyPending ? null : 4 + boundedRandom(rng, 4);

// 0x10b31..0x10bad: strict signed32 tick difference > stored delay.
// Other menu flags/animation remain with the menu controller.
export function menuRandomTimer(timer, rng, nowTicks) {
  if (((nowTicks - timer.lastTicks) | 0) <= (timer.delayTicks | 0)) return false;
  timer.lastTicks = nowTicks | 0;
  timer.delayTicks = s16((5 + boundedRandom(rng, 5)) * 19);
  return true; // original additionally sets DS:483c=1
}

// 0x13fec: progression celebration uses random LOW BIT, not scaled random(2).
export const fireworkVariant = rng => (random15(rng) & 1) ? 1 : 2;

// 0x14e54: one shared punctuation key, not a separate key per world.
export function initializeBonus(rng) {
  return { mode: 1, x: s16(20 + boundedRandom(rng, 250)),
    y: s16(5 + boundedRandom(rng, 30)), delay: s16(30 + boundedRandom(rng, 30)),
    code: s16(33 + boundedRandom(rng, 15)) };
}
// 0x12c13..0x12c4e. The draw is consumed EVEN when option10 forces delay15.
export function outdoorBonusDelay(rng, previousLimitSeconds, option10 = false) {
  const value = s16(15 + boundedRandom(rng, (previousLimitSeconds - 30) | 0));
  return option10 ? 15 : value;
}
// 0x13bb2,0xbdba,0x17801. Only an active bonus (mode2) intercepts raw key.
export const matchesBonus = (bonus, rawKey) => bonus.mode === 2 && s16(rawKey) === bonus.code;
