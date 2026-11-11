// Source FILE evidence: tools/render/inspect.py; resource decoding: tools/render/decode.py.
const s16 = n => (n << 16) >> 16;

// FILE 0x7a69..0x7a93: header origins ADD to logical coordinates.
export function spriteRect(sprite, x, y) {
  const [ox, oy, width, height] = sprite.headerWords;
  const left = s16(x + s16(ox)), top = s16(y + s16(oy));
  return {left, top, right: s16(left + width - 1), bottom: s16(top + height - 1)};
}

// FILE 0x7878..0x7942: inclusive signed rectangle intersection.
export function clipRect(rect, clip = {left: 0, top: 0, right: 319, bottom: 199}) {
  if (rect.left > rect.right || rect.top > rect.bottom || clip.left > clip.right || clip.top > clip.bottom) return null;
  if (rect.left > clip.right || rect.right < clip.left || rect.top > clip.bottom || rect.bottom < clip.top) return null;
  return {left: Math.max(rect.left, clip.left), top: Math.max(rect.top, clip.top), right: Math.min(rect.right, clip.right), bottom: Math.min(rect.bottom, clip.bottom)};
}

// FILE 0x9e5f..0x9e91: source index zero is transparent, NOT 255.
// This primitive writes to an already-prepared destination, not DOS dirty rectangles.
export function blitSprite(destination, sprite, pixels, x, y, clip) {
  validateSprite(sprite, pixels);
  if (destination.length !== 64000) throw new RangeError('indexed raster size');
  const rect = spriteRect(sprite, x, y), visible = clipRect(rect, screenClip(clip));
  if (!visible) return;
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
  clip = screenClip(clip);
  if (current) validateSprite(current.sprite,current.pixels);
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

function validateSprite(sprite, pixels) {
  const [, , width, height] = sprite.headerWords;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 ||
      width > 320 || height > 200 || width !== sprite.width || height !== sprite.height ||
      pixels.length !== width*height) throw new RangeError('indexed raster size');
}

function screenClip(clip = {left:0,top:0,right:319,bottom:199}) {
  if (![clip.left,clip.top,clip.right,clip.bottom].every(Number.isInteger) || clip.left < 0 || clip.top < 0 ||
      clip.right > 319 || clip.bottom > 199 || clip.left > clip.right || clip.top > clip.bottom)
    throw new RangeError('physical clip bounds');
  return clip;
}

// FILE 0xd68f, 0xc202..0xc21e: opaque BGS rows, not transparent sprites.
export function drawCastleScene(destination, pixels) {
  if (destination.length !== 64000 || pixels.length !== 41280) throw new RangeError('castle scene size');
  destination.set(pixels,26*320);
}

// FILE 0x9a25..0x9a57 then 0xb959..0xb9bf, called by 0xc17b..0xc182.
// This modifies the visible buffer only. Background/sprite transition handling
// at 0xc0bf..0xc160 and 0x7f1f remains the controller/presentation caller's job.
export function scrollCastleStrip(front, nextScene, step) {
  if (front.length !== 64000 || nextScene.length !== 41280 ||
      !Number.isInteger(step) || step < 0 || step >= 40 || front.buffer === nextScene.buffer)
    throw new RangeError('castle strip bounds');
  for (let y=0;y<129;y++) {
    const start=(y+26)*320;
    front.copyWithin(start,start+8,start+320);
    front.set(nextScene.subarray(y*320+step*8,y*320+step*8+8),start+312);
  }
}

// FILE 0x14a8c..0x14b65, Water 0x16ac7, Castle 0xd808.
export function worldPalette(background, character) {
  if (background.length !== 768 || character.length !== 768) throw new RangeError('palette length');
  const result=Uint8Array.from(background);
  result.set(character.subarray(96,144),96);
  return result;
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
