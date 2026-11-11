import { reportProfile, sourceFormat } from '../recovered/control/report.mjs';

// Font service FILE 0x1a775..0x1a8eb uses width/height, NOT GSO origins.
// Zero is transparent unless opaque; every nonzero sample maps through slots
// [background, foreground, shadow]. Caller supplies decoded FONT*H records.
export function drawSourceText(front,fonts,operations,background=null) {
  if(front.length!==64000 || (background&&background.length!==64000)) throw new RangeError('320x200 buffers');
  for(const op of operations) {
    const font=fonts[op.font];
    if(!font||font.length!==96) throw new Error(`Missing decoded font ${op.font}`);
    let x=op.x,y=op.y;
    for(const char of op.text) {
      const code=char.charCodeAt(0), glyph=font[code-32];
      if(code<32||code>127) throw new RangeError('untranslated text control');
      const {width,height}=glyph.sprite, pixels=glyph.pixels;
      if(pixels.length!==width*height) throw new RangeError('font pixels');
      for(let row=0;row<height;row++) for(let col=0;col<width;col++) {
        const dx=x+col,dy=y+row;
        if(dx<0||dx>319||dy<0||dy>199) continue; // physical host clipping
        const p=dy*320+dx, value=pixels[row*width+col];
        if(value>2) throw new RangeError('font color slot');
        if(value||op.opaque) front[p]=[op.background,op.color,op.shadow][value];
        else if(background) front[p]=background[p];
      }
      x+=width;
    }
  }
}

// FILE 0xe749..0xe92f. Layout is in physical pixels; labels come from MSD,
// teacher strings from DS:338c's far-pointer table, not browser labels.
export function reportOperations(studentBytes,{messages,teachers}) {
  const p=reportProfile(studentBytes);
  if(!p) return null;
  const ops=[], text=(value,x,y,font='FONT5H',color=0,shadow=0)=>
    ops.push({text:value,x,y,font,color,shadow,background:0,opaque:false});
  text(sourceFormat(messages[2110],p.name),60,66);
  text(sourceFormat(messages[2120],teachers[p.character-1]),60,80);
  text(messages[2130],60,96);
  if(p.mode>=1&&p.mode<=4) text(messages[99+p.mode],178,96);
  text(messages[2240],60,108);text(sourceFormat('%3u',p.goal),178,108);
  if(p.lastWpm!==0) {text(messages[2250],60,120);text(sourceFormat('%3u',p.lastWpm),178,120);}
  if(p.accuracy!==0) {text(messages[2260],60,132);text(sourceFormat('%3u%%',p.accuracy),178,132);}
  text(messages[2270],60,144);
  text(p.problemKeys,178,143,'FONT3H',14,8);
  return ops;
}

// Resources carry their own CRX palette. No fallback palette or invented card.
export function drawReport(front,resources,studentBytes) {
  const operations=reportOperations(studentBytes,resources);
  if(operations===null) return null;
  if(resources.background.length!==64000) throw new RangeError('RCARD background');
  front.set(resources.background);
  drawSourceText(front,resources.fonts,operations,resources.background);
  return {palette:resources.palette,operations};
}
