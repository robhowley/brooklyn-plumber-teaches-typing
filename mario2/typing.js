// Static translation of /MARIO/WINMARIO.EXE;1, SHA256
// 39a4fb53384afbfec13063c2f4c67d51013b1f8ea494788c88f1ac6c12f47f22.
// FILE offsets below refer to that member, not ISO offsets. No resources used.
const u16 = n => n & 0xffff;
const s16 = n => (n << 16) >> 16;
const seconds = nowMs => Math.floor((nowMs >>> 0) / 1000);

// FILE 0x1037a..0x103c6. The coordinator owns ONE stream for all consumers.
export function createRandom(seed16) {
  let state = u16(seed16);
  return Object.freeze({
    next() { state = (Math.imul(state, 0x343fd) + 0x269ec3) >>> 0; return (state >>> 16) & 0x7fff; },
    snapshot() { return state; },
  });
}

// FILE 0x10034..0x100c7, 0x12160..0x1225d, 0x12bca..0x12e07.
// Explicit input tuples, NOT elapsed lesson time. Read TZ once at startup and
// reuse that value. Only the independently audited bounded TZ grammar is mapped.
// firstDate/secondDate are optional [year,month,day] DOS sampling-race inputs.
export function seedFromCalendar({year, month, day, hour = 0, minute = 0, second = 0,
  tz = null, firstDate, secondDate}) {
  if (firstDate && secondDate) {
    [year, month, day] = (hour === 23 && (firstDate[1] !== secondDate[1] || firstDate[2] !== secondDate[2]))
      ? firstDate : secondDate;
  }
  const table = [0, -1, 30, 58, 89, 119, 150, 180, 211, 242, 272, 303, 333, 364];
  let offset = 28800, enabled = true;
  if (tz) {
    const match = /^.{3}(-?)(\+?\d+)(?::(\d+)(?::(\d+))?)?(.*)$/.exec(tz);
    if (!match) throw new RangeError('Unsupported historical TZ input');
    offset = (Number(match[2]) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0)) * (match[1] ? -1 : 1);
    enabled = !!match[5];
  }
  const ty = year - 1900, y = year - 1980;
  const leap = year % 4 === 0;
  const ordinal = table[month] + day + (leap && month > 2 ? 1 : 0);
  let dst = false;
  if (enabled && ty >= 67 && month >= 4 && month <= 10) {
    dst = month > 4 && month < 10;
    if (month === 4 || month === 10) {
      const base = (month === 4 && ty > 86 ? table[month] + 7 : table[month + 1]) + (leap ? 1 : 0);
      // FILE 0x12dae..0x12dc5 discards the product high word. JS % has
      // the required signed remainder. Do not replace with a weekday library.
      const wrapped = s16(s16(365 * (ty - 70)) + ((ty - 1) >> 2) + base);
      const boundary = base - ((wrapped - 13) % 7);
      dst = month === 4 ? ordinal > boundary || (ordinal === boundary && hour >= 2)
        : ordinal < boundary || (ordinal === boundary && hour < 1);
    }
  }
  const days = 365 * y + ((y + 3) >> 2) + day + table[month] + 3652 + (leap && month > 2 ? 1 : 0);
  return u16(((((days * 24 + hour) * 60 + minute) * 60 + second) + offset - (dst ? 3600 : 0)) | 0);
}

// FILE 0x16de6..0x16f8c. Caps XOR Shift controls punctuation too.
// Enter/Escape are dialog commands, never typing input. key-up/char events
// belong to the coordinator and must never call keyDown.
export function normalizeTypingKey({virtualKey, shift = false, capsLock = false}) {
  if ([13, 16, 27].includes(virtualKey)) return 0;
  const upper = !!shift !== !!capsLock;
  if (virtualKey >= 65 && virtualKey <= 90) return virtualKey + (upper ? 0 : 32);
  if (virtualKey >= 48 && virtualKey <= 57) return upper ? ')!@#$%^&*('.charCodeAt(virtualKey - 48) : virtualKey;
  const pairs = {186: ';:', 187: '=+', 188: ',<', 189: '-_', 190: '.>', 191: '/?', 192: '`~', 219: '[{', 220: '\\|', 221: ']}', 222: '\'"'};
  return pairs[virtualKey]?.charCodeAt(upper ? 1 : 0) ?? virtualKey;
}

// FILE 0x32f4..0x3353: cyclic, masked, retained previous-normalized byte.
// startOffset is selected by the coordinator: draw0 -> byte0, draw r>0 ->
// rth masked tilde, one-based. The last delimiter is unreachable directly.
function reader(lesson, previous) {
  const bytes = Uint8Array.from(lesson.bytes);
  if (!bytes.length || !bytes.some(b => (b & 127) > 32 && (b & 127) !== 126)) throw new RangeError('Empty lesson');
  let offset = lesson.startOffset ?? 0;
  if (!Number.isInteger(offset) || offset < 0 || offset >= bytes.length) throw new RangeError('Lesson start offset');
  return {
    next() {
      for (let visits = 0; visits <= bytes.length * 2; visits++) {
        let byte = bytes[offset] & 127;
        offset = (offset + 1) % bytes.length;
        if (byte === 126) continue;
        if ([9, 10, 13].includes(byte)) byte = 32;
        if (byte === 32 && previous === 32) continue;
        previous = byte;
        return byte;
      }
      throw new RangeError('Lesson cannot produce a character');
    },
    snapshot: () => ({offset, previousNormalized: previous}),
  };
}

// Low-level row probe, NOT an Evaluation gameplay route. FILE 0x3728..0x383f.
// memory includes seven 35-byte rows, a gap and the typed-line scratch area.
export function createLessonRows(lesson, {previousNormalized = 0, memory = new Uint8Array(282), pending = []} = {}) {
  const read = reader(lesson, previousNormalized);
  const data = Uint8Array.from(memory);
  let token = Array.from(pending);
  function fill(index, tokenPacking = false) {
    const start = index * 35;
    data.fill(32, start, start + 34);
    if (!tokenPacking) {
      for (let col = 0; col < 34;) {
        const byte = read.next();
        if (!col && byte === 32) continue;
        data[start + col++] = byte;
      }
      data[start + 34] = 0;
      return start + 34;
    }
    let dest = start, remaining = 34;
    while (token.length <= remaining) {
      if (token.length) {
        data.set(token, dest);
        dest += token.length + 1;
        remaining -= token.length + 1;
      }
      token = [];
      let byte;
      do { byte = read.next(); } while (byte === 32);
      do {
        token.push(byte);
        if (token.length > 255) throw new RangeError('Unbounded token outside supported source footprint');
        byte = read.next();
      } while (byte > 32);
      const text = String.fromCharCode(...token);
      if ((text.endsWith('.') && !/(?:Mr\.|Mrs\.)$/i.test(text) || text.endsWith('.)')) && remaining - token.length !== 2) token.push(32);
    }
    data[dest + 34] = 0; // moved destination, deliberately NOT start+34
    return dest + 34;
  }
  return {
    fill,
    shift() { data.copyWithin(0, 35, 245); fill(6); data.fill(32, 246, 280); },
    byte: (row, col) => data[row * 35 + col],
    snapshot: () => ({memory: Array.from(data), rows: Array.from({length: 7}, (_, i) => Array.from(data.slice(i * 35, i * 35 + 35))), pending: token.slice(), ...read.snapshot()}),
  };
}

// FILE 0x19b42..0x19bcb. Null denotes the original divide-by-zero fault,
// not a repaired speed, when full elapsed !=0 but low16 elapsed ==0.
export function typingSpeed({total, errors, elapsed, divisor = 5}) {
  if (!(elapsed >>> 0)) return 0;
  const denominator = u16(elapsed) * divisor;
  return denominator ? u16(Math.floor(Math.max(u16(total) - u16(errors), 0) * 60 / denominator)) : null;
}

// Pure state21 operations. No DOM, timer generation, storage, media, focus latch
// or hidden clock. Effects describe source callback order for the coordinator.
export function createTyping({lesson, durationSeconds, nowMs, retained = {}}) {
  let specialState = retained.specialState ?? 0, specialByte = retained.specialByte ?? 0;
  let specialCountdown = retained.specialCountdown ?? 0, oldTypedByte = retained.oldTypedByte ?? 0;
  let samplePhase = retained.samplePhase ?? 0, pendingFinish = retained.pendingFinish ?? false;
  let rows, cursor, typedLine, total, errors, elapsed, inactivity, sampledClock, running, duration;
  const histogram = Array(128).fill(0);
  let previousNormalized = retained.previousNormalized ?? 0;
  function enter(args) {
    if (rows) previousNormalized = rows.snapshot().previousNormalized;
    rows = createLessonRows(args.lesson, {previousNormalized});
    for (let i = 0; i < 7; i++) rows.fill(i);
    cursor = total = errors = elapsed = inactivity = 0;
    histogram.fill(0); // FILE 0x19e77..0x19e85 clears 96 words, ASCII32..127.
    typedLine = Array(34).fill(null);
    duration = u16(args.durationSeconds);
    sampledClock = seconds(args.nowMs);
    running = true;
  }
  function snapshot() {
    const source = rows.snapshot();
    return {...source, cursor, expectedByte: rows.byte(0, cursor), typedLine: typedLine.slice(),
      counters: {total, errors, speed: typingSpeed({total, errors, elapsed})}, histogram: histogram.slice(),
      elapsed, inactivity, sampledClock, samplePhase, pendingFinish: !!pendingFinish, running, durationSeconds: duration,
      retained: {specialState, specialByte, specialCountdown, oldTypedByte, previousNormalized: source.previousNormalized,
        samplePhase, pendingFinish: !!pendingFinish} };
  }
  const result = effects => ({view: snapshot(), effects});
  function advance(effects) {
    if (cursor >= 33 || !Array.from({length: 33 - cursor}, (_, i) => rows.byte(0, cursor + i + 1)).some(b => b > 32)) {
      rows.shift(); cursor = 0; typedLine.fill(null); effects.push({type: 'row-shift'});
    } else {
      typedLine[cursor] = oldTypedByte & 255;
      effects.push({type: 'glyph', column: cursor, byte: oldTypedByte & 255}); cursor++;
    }
  }
  enter({lesson, durationSeconds, nowMs});
  return Object.freeze({
    snapshot,
    keyDown(byte) {
      const effects = [];
      if (!running || !byte) return result(effects);
      if (specialState === 2 && byte === specialByte) {
        specialCountdown = 0; specialState = 3; advance(effects); return result(effects);
      }
      const expected = rows.byte(0, cursor);
      if (byte === expected) {
        oldTypedByte = byte; effects.push({type: 'success'}); advance(effects);
      } else {
        errors = u16(errors + 1);
        const masked = expected & 127;
        if (masked >= 32) histogram[masked] = u16(histogram[masked] + 1);
        effects.push({type: 'error', expectedByte: masked, typedByte: byte});
      }
      total = u16(total + 1); effects.push({type: 'stats'});
      inactivity = 0; effects.push({type: 'inactivity-reset'});
      return result(effects);
    },
    acceptedUpdate(nowMs) {
      const effects = [];
      specialCountdown = u16(specialCountdown - 1); // FILE 0x14e54, before scene/sample work
      // FILE 0x14fa1..0x15041: pending checked BEFORE fifth sample.
      if (pendingFinish) {
        pendingFinish = false; running = false; effects.push({type: 'finish'});
      } else if (running && ++samplePhase >= 5) {
        samplePhase = 0;
        const sample = seconds(nowMs), delta = Math.min((sample - sampledClock) >>> 0, 2);
        for (let i = 0; i < delta; i++) {
          elapsed = (elapsed + 1) >>> 0; inactivity = (inactivity + 1) >>> 0;
          if (elapsed >= duration) pendingFinish = true;
        }
        effects.push({type: 'stats'}); sampledClock = sample;
      }
      return result(effects);
    },
    reenter(args) { enter(args); return result([]); },
  });
}
