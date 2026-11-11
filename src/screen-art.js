import { characterImage } from './art.js';
import { drawMenuText, drawOriginal, originalImage } from './assets/original/index.js';

// Native 320x200 coordinates for accessible DOM overlays. These are browser layout
// choices, not recovered widget bounds. Controls may flow below the art at narrow widths.
// Source art: PREFS DONE [272,178,314,195); LOAD CANCEL [180,157,236,174).
// Cancel placement and 44px DOM hit areas are browser adaptations, not recovered states.
export const STUDENT_ACTIONS = Object.freeze({
  cancel: { center: [236,186.5], size: [56,17], art: [208,178,264,195] },
  done: { center: [293,186.5], size: [42,17], art: [272,178,314,195] },
});
export const SCREEN_LAYOUTS = Object.freeze({
  LOGO: { panel: [0,0,320,200] },
  GREET: { panel: [120,0,195,60] }, GREETBG: { panel: [16,16,288,168] },
  MAINMENU: { panel: [124,16,92,62], activities: [234,10,69,178] },
  PREFS: { panel: [32,73,256,69], actions: [256,174,56,22] },
  LOAD: { panel: [26,50,264,112], actions: [180,166,108,24] },
  LESSTIME: { panel: [53,61,218,90], actions: [264,175,45,20] },
  HELP: { panel: [15,31,290,140], actions: [12,176,292,18] },
  KEYBOARD: { panel: [8,24,304,100] },
  OUTSIDE: { panel: [8,164,304,30] }, OUTSKY: { panel: [8,164,304,30] },
  WATER: { panel: [8,8,304,28] }, WCAS0001: { panel: [8,8,304,28] },
  CASTLE: { panel: [8,8,304,28] }, OCASTLE: { panel: [8,8,304,28] },
  PRACTICE: { panel: [27,94,266,100] },
  BLACKBRD: { panel: [36,32,130,101], actions: [49,174,135,22] },
  RCARD: { panel: [53,61,218,119] },
  CERTIF: { panel: [35,76,248,94], actions: [252,173,57,20] },
  ENDF: { panel: [16,140,288,48] },
});

// No navigation, eligibility or timing decisions here. OCASTLE/ENDF callers choose
// browser presentation explicitly; filenames do not establish original triggers.
export function drawScreen(canvas, family) {
  if (!Object.hasOwn(SCREEN_LAYOUTS, family)) throw new RangeError(`Unknown screen: ${family}`);
  canvas.width = 320; canvas.height = 200;
  drawOriginal(canvas.getContext('2d'), family);
  return SCREEN_LAYOUTS[family];
}
export const MENU_TRIGGERS = Object.freeze({
  file: { label: 'File', origin: [24,0], bounds: [16,0,64,8] },
  student: { label: 'Student', origin: [112,0], bounds: [104,0,176,8] },
  lessons: { label: 'Lessons', origin: [232,0], bounds: [224,0,296,8] },
});
const menuColors = { yellow: '#FFFF55', blue: '#0000AA', black: '#000000', red: '#FF0000', disabled: '#808080' };
export function menuGeometry(name, entries) {
  const trigger = MENU_TRIGGERS[name];
  if (!trigger) throw new RangeError(`Unknown menu: ${name}`);
  const cells = Math.max(1, ...entries.map(entry => Array.from(entry.text).length));
  const width = cells * 8 + 2, left = Math.max(0, Math.min(320 - width, trigger.bounds[0] - 1));
  const top = 8;
  return {
    trigger: trigger.bounds,
    popup: [left, top, left + width, top + entries.length * 8 + 2],
    rows: entries.map((_, index) => [left + 1, top + 1 + index * 8, left + width - 1, top + 1 + (index + 1) * 8]),
  };
}
function paintRect(context, rect, color) {
  const [left, top, right, bottom] = rect;
  context.fillStyle = color;
  context.fillRect(left, top, right - left, bottom - top);
}
function menuGreeting(name) {
  const clean = String(name ?? '').trim();
  if (!clean || clean === 'Player') return [['Welcome',136,24],['To',152,34],['Mario',144,44],['Teaches',136,54],['Typing!',136,64]];
  let display = `${Array.from(clean.toUpperCase(), char => {
    const code = char.codePointAt(0);
    return code >= 32 && code <= 126 ? char : '?';
  }).join('')}!`;
  if (display.length > 11) display = `${Array.from(display).slice(0,8).join('')}...`;
  return [['Hello',144,34],[display,172 - display.length * 4,49]];
}
export function drawMenuScreen(canvas, view = {}) {
  drawScreen(canvas, 'MAINMENU');
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  paintRect(context, [0,0,320,8], menuColors.yellow);
  const selectedMenu = view.selectedMenu ?? 'file';
  for (const [name, menu] of Object.entries(MENU_TRIGGERS)) {
    if (name === selectedMenu) paintRect(context, menu.bounds, menuColors.blue);
    drawMenuText(context, menu.label, ...menu.origin, name === selectedMenu ? menuColors.yellow : menuColors.black);
  }
  for (const [text, x, y] of menuGreeting(view.studentName)) drawMenuText(context, text, x, y, menuColors.red);
  if (view.openMenu) {
    const entries = view.menus?.[view.openMenu] ?? [];
    if (entries.length) {
      const geometry = menuGeometry(view.openMenu, entries), [left, top, right, bottom] = geometry.popup;
      paintRect(context, geometry.popup, menuColors.black);
      paintRect(context, [left + 1, top + 1, right - 1, bottom - 1], menuColors.yellow);
      entries.forEach((entry, index) => {
        const row = geometry.rows[index];
        const selected = !entry.disabled && (entry.id === view.focusedId || view.hasFocus !== false && entry.id === view.selectedRowId);
        if (selected) paintRect(context, row, menuColors.blue);
        drawMenuText(context, entry.text, row[0], row[1], selected ? menuColors.yellow : entry.disabled ? menuColors.disabled : menuColors.black);
      });
    }
  }
  for (const [id, rect] of Object.entries(view.activityBounds ?? {})) {
    if (id === view.focusedId && view.hasFocus !== false) {
      const [left, top, right, bottom] = rect;
      context.strokeStyle = menuColors.yellow;
      context.lineWidth = 1;
      context.strokeRect(left + 0.5, top + 0.5, right - left - 1, bottom - top - 1);
    }
  }
  return SCREEN_LAYOUTS.MAINMENU;
}
export function drawStudentScreen(canvas) {
  drawScreen(canvas, 'PREFS');
  const context = canvas.getContext('2d');
  const [left, top, right, bottom] = STUDENT_ACTIONS.cancel.art;
  context.imageSmoothingEnabled = false;
  context.drawImage(originalImage('LOAD'), 180,157,56,17, left,top,right-left,bottom-top);
  return SCREEN_LAYOUTS.PREFS;
}
export function drawResultsScreen(canvas) { return drawScreen(canvas, 'BLACKBRD'); }
export function drawReportScreen(canvas) { return drawScreen(canvas, 'RCARD'); }
export function drawPortrait(canvas, character) {
  canvas.width = 64; canvas.height = 76;
  const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
  context.drawImage(characterImage(character, 0, 'happy', true), 0, 0);
}
export function drawTeacher(canvas) {
  // Original teacher is part of BLACKBRD, not a separately recovered sprite.
  canvas.width = 130; canvas.height = 170;
  const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
  context.drawImage(originalImage('BLACKBRD'), 170,30,130,170,0,0,130,170);
}
