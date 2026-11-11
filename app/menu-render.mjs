// Indexed widget helpers, not a replacement main screen. Evidence: tools/control/menu-inspect.py.
// glyphs use existing decoded {sprite,pixels} FONT5H/FONT3H records, ASCII32..127.
function raster(front) {if(!(front instanceof Uint8Array)||front.length!==64000) throw new RangeError('320x200 indexed raster');}
function glyph(front,fonts,code,x,y,foreground,background) {
  const g=fonts[(code>=32&&code<=127?code:32)-32];
  if(!g || g.pixels.length!==g.sprite.width*g.sprite.height) throw new RangeError('Missing original font glyph');
  for(let dy=0;dy<g.sprite.height;dy++) for(let dx=0;dx<g.sprite.width;dx++) {
    const px=x+dx,py=y+dy,value=g.pixels[dy*g.sprite.width+dx];
    if(value>2) throw new RangeError('Widget font mapping');
    // FONT3H includes shadow index2; student editor explicitly maps it to0.
    if(px>=0&&px<320&&py>=0&&py<200) front[py*320+px]=[background,foreground,0][value];
  }
  return g.sprite.width;
}
function text(front,fonts,value,x,y,foreground,background) {
  for(const c of value) x+=glyph(front,fonts,c.charCodeAt(0),x,y,foreground,background);
}
function padded(value,width) {return value.padEnd(width,' ');}

// 0x105cc, 0x116e5..0x11870, 0x11be8..0x11d53. Text uses full opaque cells.
// Caller restores the original MAINMENU raster before each call, not a fake fill.
export function drawMenuWidgets(front,font5,messages,state,lesson) {
  raster(front);
  if(font5[0]?.sprite.width!==8||font5[0]?.sprite.height!==8) throw new RangeError('Expected FONT5H 8x8');
  [1100,1110,1120].forEach((id,i)=>{
    if(typeof messages[id]!=='string') throw new RangeError(`Missing MSD ${id}`);
    text(front,font5,messages[id],[16,104,224][i],0,state.column===i+1?14:0,state.column===i+1?1:14);
  });
  if(!state.row) return front;
  const [left,width,count,x,resource,chars]=[[14,108,8,16,2600,13],[102,100,5,104,2700,12],[190,124,6,192,2800,15]][state.column-1];
  const bottom=8+count*8+2;
  // The source writes two side columns and two bottom rows, no top border.
  for(let y=8;y<bottom;y++) for(const px of [left,left+1,left+width-2,left+width-1]) front[y*320+px]=8;
  for(let y=bottom-2;y<bottom;y++) front.fill(8,y*320+left,y*320+left+width);
  for(let i=0;i<count;i++) {
    if(typeof messages[resource+i]!=='string') throw new RangeError(`Missing MSD ${resource+i}`);
    let value=messages[resource+i];
    if(state.column===3) value=value.replace('%c',lesson===i+1?'+':' ');
    text(front,font5,padded(value,chars),x,8+i*8,state.row===i+1?14:0,state.row===i+1?1:14);
  }
  return front;
}

// 0xf5ab..0xf652: FONT5H, selected fg14/bg1, normal fg0/bg15.
export function drawStudentChooserNames(front,font5,state) {
  raster(front);
  state.names.forEach((name,i)=>text(front,font5,` ${name.padEnd(8,' ')} `,40+Math.trunc(i/10)*80,64+i%10*8,i===state.selection?14:0,i===state.selection?1:15));
  return front;
}

// 0x1af30..0x1b0ed, 0x1aced..0x1af2f. Full character-cell inversion,
// NOT a modern one-pixel caret. Caller owns original backing raster restoration.
// inverted is the source cursor pump phase; do not derive it from guessed milliseconds.
export function drawTextField(front,fonts,field,{x,y,foreground=15,background=0,inverted=false}={}) {
  raster(front);
  const w=fonts[0]?.sprite.width,h=fonts[0]?.sprite.height;
  if(!w||!h) throw new RangeError('Original field font required');
  text(front,fonts,field.text.padEnd(field.maxLength+1,' '),x,y,foreground,background);
  const code=field.cursor<field.text.length?field.text.charCodeAt(field.cursor):32;
  glyph(front,fonts,code,x+field.cursor*w,y,inverted?background:foreground,inverted?foreground:background);
  return front;
}
