import { drawOriginal } from './assets/original/index.js';

// Archive welcome composition. No screenshot crops, invented reveal clock, or audio dependency.
export function drawTitleIllustration(canvas) {
  canvas.width = 320; canvas.height = 200;
  const context = canvas.getContext('2d');
  drawOriginal(context, 'GREET');
  // GREET already includes the small Mario logo. Original letter sprites fill its open subtitle area.
  // Placement is a browser composition choice, not recovered animation timing.
  let x = 126;
  for (const letter of 'TEACHES') {
    drawOriginal(context, `GREET-greettxt_${letter}`, x, 4);
    x += letter === 'A' ? 24 : 18;
  }
  x = 166;
  for (const letter of 'TYPING') {
    drawOriginal(context, `GREET-greettxt_${letter}`, x, 33);
    x += letter === 'I' ? 10 : 20;
  }
  canvas.setAttribute?.('aria-label', 'Mario Teaches Typing, original archive welcome artwork.');
}
