// Static browser raster data, not a DOS resource reader. Rasterize once, draw many times.
import rasters from './rasters.json' with { type: 'json' };
const cache = new Map();
const menuGlyphCache = new Map();
export function originalImage(name) {
  if (!rasters[name]) throw new RangeError(`Unknown original artwork: ${name}`);
  if (!cache.has(name)) {
    const { width, height, palette, pixels, transparent } = rasters[name];
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'), indices = atob(pixels);
    for (let y = 0; y < height; y++) for (let x = 0; x < width;) {
      const index = indices.charCodeAt(y*width+x); let end = x+1;
      while (end < width && indices.charCodeAt(y*width+end) === index) end++;
      if (index !== transparent) {
        context.fillStyle = `rgb(${palette[index*3]},${palette[index*3+1]},${palette[index*3+2]})`;
        context.fillRect(x,y,end-x,1);
      }
      x = end;
    }
    cache.set(name, canvas);
  }
  return cache.get(name);
}
export function drawOriginal(context, name, x = 0, y = 0, scale = 1) {
  const image = originalImage(name); context.imageSmoothingEnabled = false;
  context.drawImage(image, Math.round(x), Math.round(y), image.width*scale, image.height*scale);
}
export function actionImage(character, action = 'run', frame = 0) {
  const prefix = { Mario: 'm', Luigi: 'l', Princess: 'p' }[character] || 'm';
  const frames = { run: [1,4,6], jmp: [8,12,16], sin: [1,3], swm: [1,3,5] };
  const sequence = frames[action];
  const index = sequence[Math.abs(Math.floor(frame)) % sequence.length];
  return originalImage(`${action === 'swm' ? 'WATER' : 'WALKING'}-${prefix}${action}${String(index).padStart(4,'0')}_1`);
}
export function practiceFace(mood) {
  return originalImage(`PRACTICE-prac000${{sad:1,neutral:2,happy:3}[mood] || 2}_1`);
}
// Menu labels use the adopted glyph core in 8x8 cells. The DOM remains the accessible text owner.
function menuGlyph(code) {
  if (menuGlyphCache.has(code)) return menuGlyphCache.get(code);
  const raster = rasters[`FONT7H-font7_${code}`];
  if (!raster) return menuGlyph(63);
  const indices = atob(raster.pixels), runs = [];
  for (let y = 0; y < 8; y++) {
    let start = -1;
    for (let x = 0; x <= 8; x++) {
      const ink = x < 8 && indices.charCodeAt((y + 1) * raster.width + x + 1) === 1;
      if (ink && start < 0) start = x;
      if (!ink && start >= 0) { runs.push([y, start, x - start]); start = -1; }
    }
  }
  menuGlyphCache.set(code, runs);
  return runs;
}
export function drawMenuText(context, text, x, y, color = '#000000') {
  context.imageSmoothingEnabled = false;
  context.fillStyle = color;
  let cell = 0;
  for (const char of String(text)) {
    const code = char.codePointAt(0);
    if (code !== 32) {
      for (const [row, left, width] of menuGlyph(code >= 33 && code <= 126 ? code : 63)) {
        context.fillRect(Math.round(x + cell * 8 + left), Math.round(y + row), width, 1);
      }
    }
    cell++;
  }
  return cell * 8;
}

// Decorative target glyph only. The DOM remains the accessible text owner.
export function drawOriginalGlyph(context, char, x, y, scale = 2) {
  const code = char.charCodeAt(0);
  if (code < 33 || code > 126) return false;
  const image = originalImage(`FONT7H-font7_${code}`);
  context.imageSmoothingEnabled = false;
  context.drawImage(image, Math.round(x-image.width*scale/2), Math.round(y-image.height*scale/2), image.width*scale, image.height*scale);
  return true;
}
