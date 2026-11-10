import { characterImage } from './art.js';
import { drawOriginal, originalImage } from './assets/original/index.js';

// Native 320x200 coordinates for accessible DOM overlays. These are browser layout
// choices, not recovered widget bounds. Controls may flow below the art at narrow widths.
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
export function drawMenuScreen(canvas) { return drawScreen(canvas, 'MAINMENU'); }
export function drawStudentScreen(canvas) { return drawScreen(canvas, 'PREFS'); }
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
