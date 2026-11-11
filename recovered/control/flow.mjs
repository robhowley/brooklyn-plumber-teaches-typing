import { s16 } from './scoring.mjs';

// FILE 0x10412..0x10457. Going DOWN to outdoor does not reset lesson.
export function nextRoute({ mode, goal, lesson }) {
  mode = s16(mode); goal = s16(goal); lesson = s16(lesson);
  if (mode === 4) return { mode, lesson };
  if (goal < 10) return { mode: 1, lesson };
  const next = goal < 30 ? 2 : 3;
  return { mode: next, lesson: mode === next ? lesson : 1 };
}

// FILE 0x13d4a..0x13dac, 0x17e24..0x17e93, 0xda44..0xdae0.
// Explicit raw gates avoid assuming what the per-scene exit flag means.
// exitGate is DS:48e4 / DS:4c97 / DS:46e4. gateOverride is helper 0x15034(10).
// failed is DS:4c23 / DS:46e2; outdoor has no equivalent here.
export function progression(state, { mode, resultWpm, profilePresent, failed = false, exitGate = false, gateOverride = false }) {
  const s = { ...state, completed: [...state.completed] };
  s.goal = s16(s.goal); s.lesson = s16(s.lesson); resultWpm = s16(resultWpm);
  if (![1, 2, 3].includes(mode)) return { state: s, advanced: false, ending: null, save: false };
  // 0x17e32..0x17e3c and 0xda5a..0xda64 update profile WPM before exit/goal gates.
  if (profilePresent && mode !== 1 && !failed && resultWpm > 0) s.lastWpm = resultWpm;
  if (!profilePresent || (mode !== 1 && failed) || (exitGate && !gateOverride) || resultWpm < s.goal)
    return { state: s, advanced: false, ending: null, save: false };
  let ending = null;
  if (s.lesson < 6) { s.lesson = s16(s.lesson + 1); if (mode === 3) ending = 1; }
  else {
    s.previousGoal = s.goal;
    s.goal = s16(resultWpm + (mode === 1 ? 2 : 5));
    if (mode < 3) {
      const cap = mode === 1 ? 10 : 30;
      // STRICT >, not >=. A goal exactly equal to the cap does not set completion.
      if (s.goal > cap) { s.goal = cap; s.completed[mode - 1] = true; }
    } else if (s.goal >= 45) { ending = s.completed[2] ? 1 : 4; s.completed[2] = true; }
    else ending = 2;
  }
  return { state: s, advanced: true, ending, save: true };
}

// FILE 0x103d0..0x103f0. Completion, printed, pending arrays at DS:50ce/d1/d4.
export function queueCertificates({ profilePresent, completed, printed, pending }) {
  return pending.map((p, i) => Boolean(p || (profilePresent && completed[i] && !printed[i])));
}

// FILE 0x92af..0x9339; jump table FILE 0x9485, verified in tables.json.
// The caller supplies the original rand() result for group 6. No invented RNG.
export function corpusRoute(mode, lesson, random15) {
  let group = s16(lesson);
  if (group === 6) {
    if (!Number.isInteger(random15) || random15 < 0 || random15 > 32767)
      throw new RangeError('Group 6 requires an explicit 15-bit random value');
    group = Math.trunc(random15 * 5 / 32768) + 1;
  }
  const prefix = ['H', 'T', 'B', 'N', 'S'][group - 1] ?? 'H';
  const suffix = mode === 2 ? 'WORDS' : mode === 3 ? 'SENTENC' : 'LETTERS';
  return { group, member: `MarioTea/MARIO/${prefix}${suffix}.LEE` };
}

// FILE 0x1169e..0x119f5: row 0 means dropdown closed; columns have 8/5/6 items.
export function menuNavigation({ column, row }, command) {
  const count = [0, 8, 5, 6][column];
  if (!count) throw new RangeError('Menu column must be 1..3');
  if (command === 'close-menu') row = 0;
  if (command === 'menu-down' || (command === 'activate-menu' && row === 0)) row = row >= count ? 1 : row + 1;
  if (command === 'menu-up' && row !== 0) row = row <= 1 ? count : row - 1;
  if (command === 'menu-left' || command === 'menu-right') {
    column += command === 'menu-left' ? -1 : 1;
    if (column < 1) column = 3;
    if (column > 3) column = 1;
    if (row !== 0) row = 1; // 0x10f2c, not preserve old row
  }
  return { column, row };
}

// FILE 0x11121..0x11167. Half-open rectangles. x=DS:5277,y=DS:5275.
export const MAIN_MENU_RECTS = Object.freeze([
  [236, 12, 299, 39], [236, 43, 299, 70], [236, 74, 299, 101],
  [236, 105, 299, 132], [236, 136, 299, 163], [236, 167, 299, 183],
]);
export function mainMenuHit(x, y) {
  x = s16(x); y = s16(y);
  return MAIN_MENU_RECTS.findIndex(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);
}

// FILE 0x111d8..0x113b1 first checks localized message initials; 0x11a37 table
// supplies these English fallbacks. Input is decoded DOS key value, not a DOM event.
export function mainMenuCommand(key) {
  if (key >= 97 && key <= 122) key -= 32;
  const commands = { 0: 'none', 13: 'activate-menu', 27: 'close-menu', 32: 'activate-menu',
    49: 'outdoor', 50: 'water', 51: 'castle', 52: 'practice', 53: 'report', 54: 'next',
    65: 'about', 67: 'certificate', 68: 'demo', 69: 'edit-student', 71: 'toggle-speech',
    72: 'help', 75: 'keyboard', 76: 'load-student', 77: 'toggle-music', 78: 'next',
    81: 'quit', 83: 'toggle-sound', 84: 'lesson-times', 87: 'new-student',
    0x12d: 'quit', 0x132: 'debug-memory', 0x13b: 'help', 0x13c: 'keyboard',
    0x148: 'menu-up', 0x14b: 'menu-left', 0x14d: 'menu-right', 0x150: 'menu-down' };
  return commands[key] ?? 'unrecognized';
}
