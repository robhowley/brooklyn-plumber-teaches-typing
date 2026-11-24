// WINMARIO.EXE SHA256 39a4fb53384afbfec13063c2f4c67d51013b1f8ea494788c88f1ac6c12f47f22.
// Logical top-down indexed8 surfaces. Positive height/baseLow0 is a browser
// memory profile, not a universal claim about native WinG allocations.
export const OUTSIDE_PROFILE = Object.freeze({orientation:'positive-height', format:'indexed8', baseLow:0});
function positive(profile) {
  if (profile.format !== 'indexed8' || !['positive-height','nonpositive-height'].includes(profile.orientation) ||
      !Number.isInteger(profile.baseLow) || profile.baseLow < 0 || profile.baseLow > 65535) throw new Error('Invalid Outside profile');
  return profile.orientation === 'positive-height';
}
function surface(p) { if (p?.length !== 76800) throw new Error('Outside surface must be 320x240'); }
function sprite(current, image, x, y) {
  const {width,height,pixels} = image;
  if (pixels.length !== width*height) throw new Error('Invalid Outside sprite');
  for (let sy=0;sy<height;sy++) for (let sx=0;sx<width;sx++) {
    const dx=x+sx, dy=y+sy, v=pixels[sy*width+sx];
    if (dx>=0 && dx<320 && dy>=0 && dy<240 && v!==0 && v!==63) current[dy*320+dx]=v;
  }
}
// FILE0x18162..0x182c9: controls are valid font indices, unset bits restore
// backing, not current. Caller supplies source-ordered hint/HUD operations.
function glyph(backing,current,{font,character,x,y,color=15,restore=true}) {
  if (font.length!==1024 || character<0 || character>127) throw new Error('Invalid Outside glyph');
  for(let row=0;row<8;row++) for(let col=0;col<8;col++) {
    const dx=x+col,dy=y+row,p=dy*320+dx;
    if(dx<0||dx>=320||dy<0||dy>=240) continue;
    if(font[character*8+row] & (128>>col)) current[p]=color;
    else if(restore) current[p]=backing[p];
  }
}
// FILE0x196f9..0x19707 / 0x1a448..0x1a4ce: exactly188 rows.
// Operations are never sorted into layers. Scene callback order belongs to Outside.
export function renderOutside({backing,current,operations,profile=OUTSIDE_PROFILE}) {
  surface(backing);surface(current);const pos=positive(profile);
  for(const op of operations) {
    if(op.kind==='restore') {
      const start=pos?2:0;current.set(backing.subarray(start*320,(start+188)*320),start*320);
    } else if(op.kind==='sprite') sprite(current,op.image,op.x,op.y);
    else if(op.kind==='glyph') glyph(backing,current,op);
    else if(op.kind==='text') {
      for(let i=0;i<op.text.length;i++) glyph(backing,current,{...op,character:op.text.charCodeAt(i),x:op.x+i*8});
    } else if(op.kind==='hud') {
      const {elapsed=0,typed=0,wrong=0,wpm=0,font}=op;
      const time=`  0:${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;
      const entries=[[time,0,200,104],[`   WPM:${String(wpm).padStart(5)}`,224,200,104],[`Typed:${String(typed).padStart(3)}`,0,216,15],[`Errors:${String(wrong).padStart(5)}`,224,216,15]];
      for(const [text,x,y,color] of entries) for(let i=0;i<text.length;i++) glyph(backing,current,{font,character:text.charCodeAt(i),x:x+i*8,y,color});
    } else throw new Error(`Unknown Outside draw operation: ${op.kind}`);
  }
  return current;
}
// FILE0x2d92..0x2da6, 0x1a970..0x1a997: BAN nonzero transfer and
// ANI ordinary 0/63 keys are different. Empty BAN records do not present.
// Initial pointer arithmetic uses only lowword, then rows use linear offsets.
export function renderOutsideSpecial({backing,current,ban,ani,profile=OUTSIDE_PROFILE}) {
  surface(backing);surface(current);const pos=positive(profile);
  if(ban.empty) return current;
  if(ban.pixels.length!==64000) throw new Error('Invalid Outside BAN plane');
  if(!ani || ani.pixels.length!==ani.width*ani.height) throw new Error('Missing Outside ANI record');
  const objectY=pos?ani.y+35:239-(ani.y+35);
  const dest=((profile.baseLow+ani.x-320*objectY+0x2ac0)&65535)-profile.baseLow;
  // Validate all writes before mutating, including allocator wrap edge profiles.
  const last=dest-(ani.height-1)*320;
  if(last<0 || dest+ani.width>76800) throw new RangeError('Outside ANI pointer outside browser surface');
  current.set(backing);
  // FILE0x2efe..0x2f64: +0xf8c0 starts at physical row199;
  // each forward 320-byte row is followed by a 640-byte retreat.
  // Surface base: FILE0x168d9..0x168f0. ANI placement below is separate.
  for(let p=0;p<64000;p++) if(ban.pixels[p]) current[(pos?40+Math.floor(p/320):199-Math.floor(p/320))*320+p%320]=ban.pixels[p];
  for(let y=0;y<ani.height;y++) for(let x=0;x<ani.width;x++) {
    const v=ani.pixels[(pos?y:ani.height-1-y)*ani.width+x],p=dest-y*320+x;
    if(v!==0&&v!==63) current[(pos?239-Math.floor(p/320):Math.floor(p/320))*320+p%320]=v;
  }
  return current;
}
