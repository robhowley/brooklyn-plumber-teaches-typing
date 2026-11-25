// /MARIO/WINMARIO.EXE;1 SHA256
// 39a4fb53384afbfec13063c2f4c67d51013b1f8ea494788c88f1ac6c12f47f22.
// FILE0x1b273..0x1b310 row; 0x18162..0x182c9 glyph; 0x1cc90 special.
export const WATER_PROFILE=Object.freeze({orientation:'positive-height',format:'indexed8',baseLow:0});
function validate(backing,current,profile) {
  if(backing?.length!==76800||current?.length!==76800) throw new Error('Water surface must be 320x240');
  if(profile.orientation!=='positive-height'||profile.format!=='indexed8'||profile.baseLow!==0) throw new Error('Unsupported Water browser profile');
}
function sprite(current,{width,height,pixels},x,y) {
  if(pixels.length!==width*height) throw new Error('Invalid Water sprite');
  for(let row=0;row<height;row++) for(let col=0;col<width;col++) {
    const dx=x+col,dy=y+row,v=pixels[row*width+col];
    if(dx>=0&&dx<320&&dy>=0&&dy<240&&v!==0&&v!==63) current[dy*320+dx]=v;
  }
}
function glyph(backing,current,{font,character,x,y,color=244,invert=false,restore=true}) {
  if(font?.length!==1024||!Number.isInteger(character)||character<0||character>127) throw new Error('Invalid Water glyph');
  for(let row=0;row<8;row++) for(let col=0;col<8;col++) {
    const dx=x+col,dy=y+row,p=dy*320+dx;
    if(dx<0||dx>=320||dy<0||dy>=240) continue;
    if(Boolean(font[character*8+row]&(128>>col))!==invert) current[p]=color;
    else if(restore) current[p]=backing[p];
  }
}
export function renderWater({backing,current,operations,profile=WATER_PROFILE}) {
  validate(backing,current,profile);
  for(const op of operations) {
    // FILE0x1b310 initializer/compositor clip: exactly166 logical rows74..239.
    if(op.kind==='restore') current.set(backing.subarray(74*320),74*320);
    else if(op.kind==='sprite') sprite(current,op.image,op.x,op.y);
    else if(op.kind==='glyph') glyph(backing,current,op);
    else if(op.kind==='text') {
      for(let i=0;i<op.text.length;i++) glyph(backing,current,{...op,character:op.text.charCodeAt(i),x:op.x+8*i});
    } else if(op.kind==='hud') {
      const {elapsed=0,typed=0,wrong=0,wpm=0,font}=op;
      const entries=[[`  0:${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`,0,8,230],
        [`   WPM:${String(wpm).padStart(5)}`,224,8,230],[`Typed:${String(typed).padStart(3)}`,0,24,231],[`Errors:${String(wrong).padStart(5)}`,224,24,231]];
      for(const [text,x,y,color] of entries) for(let i=0;i<text.length;i++) glyph(backing,current,{font,character:text.charCodeAt(i),x:x+8*i,y,color});
    } else throw new Error('Unknown Water draw operation: '+op.kind);
  }
  return current;
}
// Pure transport, no rules callbacks, RNG, DOM or media. Preserve effect order.
export function waterOperations(effects,{font,bitmaps,presentation}) {
  const operations=[];
  for(const effect of effects) {
    if(effect.type!=='draw') continue;
    const op=effect.operation;
    if(op.type==='object') {
      const object=op.object;
      if(!object.sprite) continue;
      const id=object.sprite.bitmap??presentation.waterSprites?.[object.sprite.selector]?.[object.sprite.frame];
      const image=bitmaps.get(id);
      if(!image) throw new Error('Missing Water sprite '+id);
      operations.push({kind:'sprite',image,x:object.x,y:object.anchor==='bottom'?object.y-image.height:object.y});
    } else if(op.type==='row') {
      if(op.bytes.length!==41||op.bytes[40]!==0) throw new Error('Invalid Water row');
      for(let i=0;i<40;i++) operations.push({kind:'glyph',font,character:op.bytes[i]||32,x:8*i,y:48,color:i<10?243:i===10?255:244,invert:i===10});
    } else if(op.type==='glyph') operations.push({...op,kind:'glyph',font,character:op.byte,restore:op.unset==='backing'});
    else if(['restore','hud','text'].includes(op.type)) operations.push({...op,kind:op.type,font});
    else throw new Error('Unknown Water effect operation: '+op.type);
  }
  return operations;
}
// FILE0x2efe..0x2f64 BAN physical199..0 -> logical40..239.
// FILE0x1cc90: bitmap121 before/after, SWM ANI y offset15. Plane retention
// belongs to the inert BAN decoder. Empty iterations neither present nor consume ANI.
export function renderWaterSpecial({backing,current,ban,ani,profile=WATER_PROFILE}) {
  validate(backing,current,profile);
  if(ban.empty) return current;
  if(ban.pixels?.length!==64000) throw new Error('Invalid Water BAN plane');
  if(!ani||ani.pixels?.length!==ani.width*ani.height||ani.x<0||ani.x+ani.width>320||ani.y+15<0||ani.y+15+ani.height>240) throw new Error('Invalid Water ANI frame');
  current.set(backing);
  for(let p=0;p<64000;p++) if(ban.pixels[p]) current[40*320+p]=ban.pixels[p];
  sprite(current,ani,ani.x,ani.y+15);
  return current;
}
