import { s16 } from './scoring.mjs';

// FILE 0x16648..0x16680. Unlike main-menu boxes, these bounds are INCLUSIVE.
export function resultHit(x,y) {
  x=s16(x); y=s16(y);
  if (y<177||y>191) return null;
  if (x>=55&&x<=102) return 'next';
  if (x>=135&&x<=180) return 'menu';
  return null;
}
// FILE 0x1669c..0x16760; table 0x167bb. Enter dispatches the CURRENT mouse position,
// not the selection index. Cursor navigation moves the pointer to the selected button.
export function resultCommand(key,x,y) {
  if (key===13) return resultHit(x,y);
  if ([78,110].includes(key)) return 'next';
  if ([27,77,109].includes(key)) return 'menu';
  if ([9,0x14d,0x150].includes(key)) return 'select-next';
  if ([0x148,0x14b].includes(key)) return 'select-previous';
  if (key===0x13b) return 'help-results';
  if (key===0x13c) return 'keyboard';
  if (key===0x12d) return 'conditional-quit';
  return null;
}
// FILE 0x165a9..0x16603. previousGoal is profile +0x15, not newly raised goal.
export function resultSpeech({ suppressed, profilePresent, world, mode, goal, previousGoal, wpm }) {
  if (suppressed||!profilePresent||mode===4||(world===1&&s16(goal)>10)||(world===2&&s16(goal)>30)) return null;
  return s16(wpm)>=s16(previousGoal) ? 'congrats' : 'toobad';
}
// FILE 0x90e1..0x90f5: edit values clamp 1..60 after atoi and signed-word assignment.
export const clampLessonMinutes = value => Math.max(1,Math.min(60,s16(value)));
// FILE 0x12c90..0x12cb3 (outdoor; analogous water/castle/practice sites documented).
// A zero duration uses default minutes, then signed 16-bit IMUL by 60.
export const lessonLimitSeconds = (minutes, defaultMinutes) => s16(s16(minutes===0?defaultMinutes:minutes)*60);
