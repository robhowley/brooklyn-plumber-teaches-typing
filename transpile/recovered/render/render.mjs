// Source mapping and limits: analysis/render/RENDERING.md.
const s16 = n => (n << 16) >> 16;

// FILE 0x7a69..0x7a93: header origins ADD to logical coordinates.
export function spriteRect(sprite, x, y) {
  const [ox, oy, width, height] = sprite.headerWords;
  const left = s16(x + s16(ox)), top = s16(y + s16(oy));
  return {left, top, right: s16(left + width - 1), bottom: s16(top + height - 1)};
}

// FILE 0x7878..0x7942: inclusive signed rectangle intersection.
export function clipRect(rect, clip = {left: 0, top: 0, right: 319, bottom: 199}) {
  if (rect.left > clip.right || rect.right < clip.left || rect.top > clip.bottom || rect.bottom < clip.top) return null;
  return {left: Math.max(rect.left, clip.left), top: Math.max(rect.top, clip.top), right: Math.min(rect.right, clip.right), bottom: Math.min(rect.bottom, clip.bottom)};
}

// FILE 0x9e5f..0x9e91: source index zero is transparent, NOT 255.
// This primitive writes to an already-prepared destination, not DOS dirty rectangles.
export function blitSprite(destination, sprite, pixels, x, y, clip) {
  const rect = spriteRect(sprite, x, y), visible = clipRect(rect, clip);
  if (!visible) return;
  if (destination.length !== 64000 || pixels.length !== sprite.width * sprite.height) throw new RangeError('indexed raster size');
  for (let dy = visible.top; dy <= visible.bottom; dy++) {
    for (let dx = visible.left; dx <= visible.right; dx++) {
      const value = pixels[(dy - rect.top) * sprite.width + dx - rect.left];
      if (value !== 0) destination[dy * 320 + dx] = value;
    }
  }
}

// FILE 0x7a47..0x7f11: restore previous/current areas from the background.
// Overlapping clipped rectangles use their bounding union (0x7c95..0x7da8).
// current/previous are null or {sprite,pixels,x,y}; previous does not need pixels.
export function updateSprite(front, background, current, previous, clip) {
  if (front.length !== 64000 || background.length !== 64000 || front === background) throw new RangeError('distinct 320x200 buffers required');
  const a = current && clipRect(spriteRect(current.sprite,current.x,current.y),clip);
  const b = previous && clipRect(spriteRect(previous.sprite,previous.x,previous.y),clip);
  const regions = a && b && clipRect(a,b)
    ? [{left:Math.min(a.left,b.left),top:Math.min(a.top,b.top),right:Math.max(a.right,b.right),bottom:Math.max(a.bottom,b.bottom)}]
    : [a,b].filter(Boolean);
  for (const r of regions) for (let y=r.top;y<=r.bottom;y++) {
    const start=y*320+r.left;
    front.set(background.subarray(start,y*320+r.right+1),start);
  }
  if (a) blitSprite(front,current.sprite,current.pixels,current.x,current.y,clip);
}

// FILE 0x994d..0x99f9, tile FILE 0x1f582, phase from 0x1436c.
export function drawGround(destination, tile, phase) {
  if (destination.length !== 64000 || tile.length !== 320 || !Number.isInteger(phase) || phase < 0 || phase >= 20) throw new RangeError('ground dimensions/phase');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 320; x++) destination[(140+y)*320+x] = tile[y*20+(x+phase)%20];
}

// FILE 0x14b34..0x14b65 and 0x12b49..0x12b85. Flat RGB6 bytes.
export function outdoorPalette(background, character, turtle) {
  for (const bytes of [background, character, turtle]) if (bytes.length !== 768) throw new RangeError('palette length');
  const result = Uint8Array.from(background);
  result.set(character.subarray(96,144),96);
  result.set(turtle.subarray(144,192),144);
  return result;
}

// Caller passes the recovered outdoor animation kind/index, not a guessed time.
// FILE 0x1d610..0x1d814 loads these names; idle thresholds identify resource names.
export function characterFrame(character, kind, index, idleThresholds) {
  const prefix = character === 2 ? 'l' : character === 3 ? 'p' : 'm';
  let value, family, action;
  if (kind === 'run' && index >= 0 && index < 12) { value=index+1; family='WALKING'; action='run'; }
  else if (kind === 'jump' && index >= 0 && index < 12) { value=index+8; family='WALKING'; action='jmp'; }
  else if (kind === 'idle' && idleThresholds && index >= 0 && index < idleThresholds.length) { value=idleThresholds[index]; family='IDLE'; action='std'; }
  else throw new RangeError('unsupported frame, including signed-distance overflow');
  if (!Number.isInteger(index) || !Number.isInteger(value)) throw new RangeError('frame index');
  return {family, name:`${prefix}${action}${String(value).padStart(4,'0')}_1`};
}

// FILE 0x82e9..0x834a: ANI words are X/Y, third field is member-relative raster.
export function aniEntry(bytes, index) {
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), offset=index*8;
  if (!Number.isInteger(index) || index < 0 || offset+8>bytes.length) throw new RangeError('ANI entry');
  const rasterOffset=view.getUint32(offset+4,true);
  return {x:view.getInt16(offset,true),y:view.getInt16(offset+2,true),rasterOffset,terminal:rasterOffset===0};
}
