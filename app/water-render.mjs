// Indexed Water presentation, no controller, timer or DOM. FILE evidence: tools/worlds/water-inspect.py.
import { updateSprite, worldPalette } from '../recovered/render/render.mjs';

// 0x16ac7 then 0x16b38..0x16b74. BITER, not TURTLE, supplies slots 48..63.
export function waterPalette(base, character, biter) {
  if (biter.length !== 768) throw new RangeError('biter palette length');
  const palette = worldPalette(base, character);
  palette.set(biter.subarray(144,192),144);
  return palette;
}

function frame(records, index, x, y) {
  if (!Number.isInteger(index) || !records[index]) throw new RangeError('Water resource index');
  return {...records[index], x, y};
}

// 0x16c60..0x16cdb, 0x1cbe9: stamp FONT7H into a COPY of bonbub_1.
// Glyph origins are ignored by this raster-to-raster callee; zeros preserve bubble pixels.
export function waterBonusSprite(bubble, glyph) {
  const {sprite} = bubble, pixels = Uint8Array.from(bubble.pixels);
  if (pixels.length !== sprite.width*sprite.height || glyph.pixels.length !== glyph.sprite.width*glyph.sprite.height)
    throw new RangeError('Water bonus raster size');
  for (let y=0;y<glyph.sprite.height;y++) for (let x=0;x<glyph.sprite.width;x++) {
    const value=glyph.pixels[y*glyph.sprite.width+x];
    if (value && x+8<sprite.width && y+7<sprite.height) {
      if (value>2) throw new RangeError('Water glyph mapping');
      pixels[(y+7)*sprite.width+x+8]=[0,15,9][value];
    }
  }
  return {sprite,pixels};
}

// Snapshots bracket ONE source update, not a browser frame. The controller must
// preserve resourceIndex (selected before pursuer mode toggles) and drawnX.
// Freshly allocated bubbles must already be present in `before`: their first
// update supplies the small raster as previous even though it wasn't drawn.
export function waterActorOperations(resources, after, before) {
  const character=after.character===2?1:after.character===3?2:0;
  const swimmer = s => {
    if(!s) return null;
    const sunk=s.failed && s.failurePhase===2;
    if(!sunk && (!Number.isInteger(s.frame) || s.frame<0 || s.frame>=6)) throw new RangeError('Water swim frame');
    return frame(resources.water,sunk?34+character:character*6+s.frame,s.x,s.y);
  };
  const pursuer = s => {
    if(!s || s.resourceIndex==null) return null;
    if(s.resourceIndex<18 || s.resourceIndex>32) throw new RangeError('Water pursuer frame');
    return frame(resources.water,s.resourceIndex,s.drawnX,s.y);
  };
  const bubble = s => s && frame(resources.bubbles,s.large?1:0,s.x,s.y);
  const bonus = s => s && ({...resources.bonus,x:s.x,y:s.y});
  const operations=[
    {actor:'swimmer',current:swimmer(after.swimmer),previous:swimmer(before?.swimmer)},
    {actor:'pursuer',current:pursuer(after.pursuer),previous:pursuer(before?.pursuer)},
  ];
  for(let i=0;i<10;i++) {
    const old=before?.bubbles?.[i], current=after.bubbles?.[i];
    if(old?.active) operations.push({actor:`bubble-${i}`,current:current?.active?bubble(current):null,previous:bubble(old)});
  }
  const old=before?.bonus, current=after.bonus;
  // state2 can reset to0 at y200, still calls compositor with current image.
  if(current?.mode===2 || old?.mode===2 || current?.mode===3)
    operations.push({actor:'bonus',current:current?.mode===3?null:bonus(current),previous:bonus(old)});
  return operations;
}

// 0x179eb..0x17a04: each dirty update can erase an earlier actor. Do not
// replace these calls with alpha layering or a full-scene sprite redraw.
export function drawWaterOperations(front, background, operations, clip) {
  for (const {current,previous} of operations) updateSprite(front,background,current,previous,clip);
  return front;
}

// 0x16e0c..0x16f40: FONT9H, column1/row5 then y-=5 => (0,47).
// Prefix/suffix restore zero glyph pixels from scene; target zeros become15.
// Font service advances raster width, ignores sprite origins. No animated cursor.
export function drawWaterText(front, background, glyphs, window, targetIndex) {
  if(front.length!==64000 || background.length!==64000 || front===background ||
      !((window.length===40 && targetIndex===10)||(window.length===20 && targetIndex===5)))
    throw new RangeError('Water text window');
  let x=0;
  for(let i=0;i<window.length;i++) {
    const code=window[i]>=32 && window[i]<=127?window[i]:32;
    const glyph=glyphs[code-32];
    if(!glyph || glyph.sprite.width!==8 || glyph.sprite.height!==13 || glyph.pixels.length!==104)
      throw new RangeError('FONT9H raster');
    for(let y=0;y<13;y++) for(let gx=0;gx<8;gx++) {
      const value=glyph.pixels[y*8+gx], dest=(47+y)*320+x+gx;
      if(value>2) throw new RangeError('FONT9H mapping');
      front[dest]=i===targetIndex?[15,1,8][value]:value?[0,i<targetIndex?12:10,8][value]:background[dest];
    }
    x+=8;
  }
  return front;
}

// 0x82af..0x834a: exact BAN writes affect BOTH buffers before ANI erasure.
// `writes` are decoded commands, not image differences (literal zero writes).
// Each entry is {offset,pixels:Uint8Array}; frame is {sprite,pixels,x,y}.
// Return current ANI record for the caller's next packet. No timing is advanced.
export function drawWaterBonusPacket(front, background, writes, current, previous=null, clip) {
  if(front.length!==64000 || background.length!==64000 || front===background)
    throw new RangeError('distinct Water bonus buffers');
  for(const {offset,pixels} of writes) if(!Number.isInteger(offset) || offset<0 || offset+pixels.length>64000)
    throw new RangeError('Water BAN write bounds');
  for(const {offset,pixels} of writes) {background.set(pixels,offset);front.set(pixels,offset);}
  updateSprite(front,background,current,previous,clip);
  return current;
}

// 0x17831..0x1786b: restore unchanged WATER scene, redraw text, restore final
// palette externally. Actors are not immediately redrawn here. Keep their old
// compositor records until the next ordinary source update.
export function restoreWaterScene(front, scene, glyphs, window, targetIndex) {
  if(front.length!==64000 || scene.length!==64000 || front===scene)
    throw new RangeError('distinct Water scene buffers');
  front.set(scene);
  return drawWaterText(front,scene,glyphs,window,targetIndex);
}
