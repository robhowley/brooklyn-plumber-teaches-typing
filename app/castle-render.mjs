// Indexed Castle presentation only. FILE evidence: tools/worlds/castle-inspect.py.
import {blitSprite, clipRect, spriteRect, updateSprite, drawCastleScene,
  scrollCastleStrip} from '../recovered/render/render.mjs';

export const CASTLE_CLIPS = Object.freeze({
  full: Object.freeze({left:0, top:0, right:319, bottom:199}),
  pipe1Entrance: Object.freeze({left:0, top:0, right:46, bottom:199}),
  pipe1Exit: Object.freeze({left:272, top:0, right:319, bottom:199}),
  sand: Object.freeze({left:0, top:0, right:319, bottom:91}),
  pipe2Entrance: Object.freeze({left:0, top:0, right:44, bottom:199}),
  pipe2Exit: Object.freeze({left:269, top:0, right:319, bottom:199}),
});

function buffers(front, background) {
  if (front.length !== 64000 || background.length !== 64000 || front.buffer === background.buffer)
    throw new RangeError('distinct 320x200 buffers required');
}
function validClip(clip) {
  if (![clip.left,clip.top,clip.right,clip.bottom].every(Number.isInteger) ||
      clip.left < 0 || clip.top < 0 || clip.right > 319 || clip.bottom > 199 ||
      clip.left > clip.right || clip.top > clip.bottom) throw new RangeError('physical clip bounds');
}
function actor(record) {
  if (!record || !Number.isInteger(record.x) || !Number.isInteger(record.y)) throw new RangeError('actor coordinates');
  const {sprite, pixels} = record;
  if (!sprite || !sprite.headerWords || sprite.width !== sprite.headerWords[2] ||
      sprite.height !== sprite.headerWords[3] || sprite.width <= 0 || sprite.height <= 0 ||
      sprite.width > 320 || sprite.height > 200 || pixels.length !== sprite.width*sprite.height)
    throw new RangeError('actor raster');
}

// Indices are local to the selected family, never the flattened manifest array.
// FILE 0xd6a4..0xd74a, 0x1d610..0x1d813. Controller supplies the selected frame.
export function castleFrame(manifest, character, kind, index) {
  if (![1,2,3].includes(character) || !Number.isInteger(index) || index < 0) throw new RangeError('Castle frame');
  const prefix = ['m','l','p'][character-1], frames = manifest.worlds.castle.frames;
  const family = ['run','jump','sink'].includes(kind) ? 'WALKING' : kind === 'idle' ? 'IDLE' : 'CASTLE';
  const indices = kind === 'idle' ? frames.failureIdle[prefix] :
    family === 'WALKING' ? frames[kind][prefix] : kind === 'bonus' ? [frames.bonus] : frames[kind];
  if (!Array.isArray(indices) || index >= indices.length) throw new RangeError('Castle frame');
  const sprite = manifest.sprites.find(s => s.family === family && s.index === indices[index]);
  if (!sprite) throw new Error(`Missing ${family} resource ${indices[index]}`);
  return sprite;
}

// FILE 0x9ac3..0x9bb8. 40 words, FONT9H 8x13, target cell8 (not a cursor sprite).
// Zero pixels read ES:[DI+4]. The allocator returns offset4 (0x45f5,0x4637,
// 0x46b6), so this means the SAME normalized background pixel, not x+4.
// Unlike sprites, text ignores the shifted background pointer's low word.
export function drawCastleText(front, background, words, glyphs) {
  buffers(front, background);
  if (words.length < 40) throw new RangeError('Castle text bounds');
  const selected = Array.from(words).slice(0,40).map(word => {
    const code = Math.max(32, word & 127), pixels = glyphs[code-32];
    if (!pixels || pixels.length !== 104) throw new RangeError('FONT9H needs 96 decoded 8x13 glyphs');
    return pixels;
  });
  for (let cell=0; cell<40; cell++) {
    const color = cell === 8 ? 1 : words[cell] & 0x200 ? 15 : words[cell] & 0x100 ? 14 : 10;
    for (let y=0;y<13;y++) for (let x=0;x<8;x++) {
      const dest=(7+y)*320+cell*8+x;
      front[dest] = selected[cell][y*8+x] ? color : background[dest];
    }
  }
}

// FILE 0xc0bf..0xc160. Mutates the same persistent background as DOS.
// transitionY is the next player's logical y (92 or36 at the recovered callers).
export function beginCastleTransition(background, nextScene, transitionY) {
  if (background.length !== 64000 || nextScene.length !== 41280 ||
      background.buffer === nextScene.buffer || !Number.isInteger(transitionY) ||
      transitionY < 26 || transitionY+49 > 154) throw new RangeError('Castle scratch bounds');
  for (let y=transitionY;y<transitionY+50;y++) {
    const row=y*320;
    background.copyWithin(row,row+256,row+320);
    background.set(nextScene.subarray((y-26)*320,(y-26)*320+64),row+64);
  }
  return {nextScene, step:0, backgroundOffset:-256, finished:false};
}

// FILE 0xc17b..0xc1d7 and special compositor 0x7f1f..0x7ff4.
// previous is the actor BEFORE the eight-pixel visible scroll; current is the
// controller's new x/y/frame AFTER its -8,+1+(step&1) position update.
export function stepCastleTransition(front, background, transition, current, previous, clip = CASTLE_CLIPS.full) {
  buffers(front,background); validClip(clip); actor(current); actor(previous);
  if (transition.finished || !Number.isInteger(transition.step) || transition.step < 0 || transition.step >= 40 ||
      transition.nextScene.length !== 41280 || transition.nextScene.buffer === front.buffer ||
      transition.backgroundOffset !== -256+transition.step*8) throw new RangeError('Castle transition state');
  const a=spriteRect(current.sprite,current.x,current.y);
  const b=spriteRect(previous.sprite,previous.x-8,previous.y);
  const union=clipRect({left:Math.min(a.left,b.left)&~3, top:Math.min(a.top,b.top),
    right:Math.max(a.right,b.right)|3, bottom:Math.max(a.bottom,b.bottom)},clip);
  const offset=transition.backgroundOffset+8;
  if (union && (union.top*320+union.left+offset < 0 || union.bottom*320+union.right+offset >= 64000))
    throw new RangeError('Castle shifted background read');
  scrollCastleStrip(front,transition.nextScene,transition.step);
  if (union) for (let y=union.top;y<=union.bottom;y++) {
    const start=y*320+union.left, end=y*320+union.right+1;
    front.set(background.subarray(start+offset,end+offset),start);
  }
  blitSprite(front,current.sprite,current.pixels,current.x,current.y,clip);
  transition.backgroundOffset=offset;
  transition.step++;
}

// FILE 0xc202..0xc248, also used after early exit/timeout and the fast branch.
// The copy ends at row154, NOT row199. The player is not redrawn here.
export function finishCastleTransition(front, background, transition) {
  buffers(front,background);
  if (transition.finished) throw new Error('Castle transition already finished');
  drawCastleScene(background,transition.nextScene);
  front.set(background.subarray(0,155*320));
  transition.backgroundOffset=0;
  transition.finished=true;
}

// FILE 0xdb87..0xdbee / 0xdcab..0xdd54: replace top, do NOT intersect it.
// Explicit clips avoid global state and leave the caller's clip untouched.
export function drawCastleBonusActor(front, background, current, previous, sceneType, clip) {
  if (sceneType !== 0 && sceneType !== 1) throw new RangeError('Castle scene type');
  validClip(clip);
  updateSprite(front,background,current,previous,current ? {...clip,top:sceneType === 0 ? 69 : 37} : clip);
}

// Changed rockfaces only, in record order. null means no draw, not erase.
// Active: rockfaces, bonus, player (0xc886..0xc8a9; sand 0xcdd7..0xcdf6).
// Failure: player, bonus, rockfaces (0xc319..0xc34d; sand 0xc3d4..0xc3f6).
export function drawCastleActors(front, background, {sceneType, failure, rockfaces = [], bonus, player}, clip) {
  if (sceneType !== 0 && sceneType !== 1) throw new RangeError('Castle scene type');
  const drawPlayer = () => { if (player) updateSprite(front,background,player.current,player.previous,clip); };
  const drawRocks = () => {
    if (sceneType === 0) for (const update of rockfaces)
      if (update) updateSprite(front,background,update.current,update.previous,clip);
  };
  if (failure) drawPlayer(); else drawRocks();
  if (bonus) drawCastleBonusActor(front,background,bonus.current,bonus.previous,sceneType,clip);
  if (failure) drawRocks(); else drawPlayer();
}

// FILE 0xd8a4..0xd91f and callee 0x1cbe9. This callee IGNORES raster origins.
// Return a private copy of CASTLE index14; never overwrite cached original art.
export function castleBonusBlock(block, glyph) {
  actor({...block,x:0,y:0}); actor({...glyph,x:0,y:0});
  const pixels=Uint8Array.from(block.pixels);
  for (let y=0;y<glyph.sprite.height;y++) for (let x=0;x<glyph.sprite.width;x++) {
    const value=glyph.pixels[y*glyph.sprite.width+x];
    if (value > 2) throw new RangeError('FONT7H remap index');
    if (value && y+7 < block.sprite.height && x+8 < block.sprite.width)
      pixels[(y+7)*block.sprite.width+x+8]=value === 1 ? 10 : 1;
  }
  return {sprite:block.sprite,pixels};
}

// FILE 0xde7d..0xdebb: sand borrows scene0 for the movie. The black/final
// palette uploads surround this copy, supplied separately by the host.
export function beginCastleBonus(front, background, sceneType, rockfaceScene) {
  buffers(front,background);
  if (sceneType !== 0 && sceneType !== 1) throw new RangeError('Castle scene type');
  if (sceneType === 1) drawCastleScene(background,rockfaceScene);
  front.set(background);
}

// FILE 0xbdea..0xbe56: keep the post-BAN background, restore scene2 only for
// sand, then copy all64000 pixels. Controller marks all three rockfaces dirty.
export function finishCastleBonus(front, background, sceneType, sandScene) {
  buffers(front,background);
  if (sceneType !== 0 && sceneType !== 1) throw new RangeError('Castle scene type');
  if (sceneType === 1) drawCastleScene(background,sandScene);
  front.set(background);
}

// FILE 0x82af..0x834a. Runs are decoded BAN WRITES only, including literal zero.
// A skipped/repeated-zero pixel must not appear in runs. ANI uses old-frame erasure.
export function drawCastleBonusPacket(front, background, runs, current, previous) {
  buffers(front,background);
  if (current) actor(current);
  for (const {offset,pixels} of runs) if (!Number.isInteger(offset) || offset < 0 || !pixels || offset+pixels.length > 64000)
    throw new RangeError('BAN write bounds');
  for (const {offset,pixels} of runs) { background.set(pixels,offset); front.set(pixels,offset); }
  updateSprite(front,background,current,previous,CASTLE_CLIPS.full);
}
