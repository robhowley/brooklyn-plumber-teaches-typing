// Source: WINMARIO.EXE FILE 0x1e394..0x1e55f (overlays),
// 0x17e58..0x18600 (glyphs), 0x1ada8..0x1ae40 (hands), 0x26c6..0x2b58 (report).
// Student composition: FILE 0x3f5e..0x3f78 and 0x427a..0x46f6,
// bitmap108 FILE 0x1a1400, same WINMARIO member hash as setup.js/pins.json.
// Browser adaptation: deterministic supplied system palette endpoints and nearest-neighbor display.
export function copyIndexed(target, source, x, y, sx=0, sy=0,
  width=source.width, height=source.height, transparent=[]) {
  for (let row=0; row<height; row++) for (let col=0; col<width; col++) {
    const dx=x+col, dy=y+row, px=sx+col, py=sy+row;
    if (dx<0 || dy<0 || dx>=target.width || dy>=target.height ||
        px<0 || py<0 || px>=source.width || py>=source.height) continue;
    const value=source.pixels[py*source.width+px];
    if (!transparent.includes(value)) target.pixels[dy*target.width+dx]=value;
  }
}

export function drawGlyph(surface, font, byte, x, y, foreground, background=null, inverse=false) {
  if (!Number.isInteger(byte) || byte<32 || byte>=128) return;
  const scale=surface.width>320 ? 2 : 1;
  for (let row=0; row<8; row++) for (let col=0; col<8; col++) {
    const set=Boolean(font[byte*8+row] & (128>>col)) !== inverse;
    const value=set ? foreground : background;
    if (value===null) continue;
    for (let ry=0; ry<scale; ry++) for (let rx=0; rx<scale; rx++) {
      const dx=(x+col)*scale+rx, dy=(y+row)*scale+ry;
      if (dx>=0 && dy>=0 && dx<surface.width && dy<surface.height)
        surface.pixels[dy*surface.width+dx]=value;
    }
  }
}

export function createRenderer(canvas, assets, {paletteEndpoints}) {
  if (paletteEndpoints?.low?.length!==30 || paletteEndpoints?.high?.length!==30)
    throw new Error('Supply 10 low and 10 high RGB palette endpoints');
  const context=canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  canvas.width=640; canvas.height=480;
  context.imageSmoothingEnabled=false;
  let owner=null, backdrop, animated, overlay, rows, view, fadeAmount=0;
  const bitmap=id => {
    const value=assets.bitmaps.get(id);
    if (!value) throw new Error(`Missing bitmap ${id}`);
    return value;
  };
  function text(surface, value, x, y, fg, bg=null) {
    let i=0;
    for (const ch of String(value).split('\0')[0]) {
      drawGlyph(surface, assets.font, ch.charCodeAt(0), x+8*i++, y, fg, bg);
    }
  }
  function present(surface, frame=null) {
    const palette=backdrop.palette.slice();
    palette.set(paletteEndpoints.low, 0); palette.set(paletteEndpoints.high, 246*3);
    // FILE 0x18a86..0x18b80: source palette1 is copied first and left
    // unchanged; the loop starts at the second copied entry (source index2).
    for(let i=6;i<246*3;i++) palette[i]=Math.max(0,palette[i]-fadeAmount);
    const image=context.createImageData(640,480);
    const scale=640/surface.width;
    for (let y=0; y<480; y++) for (let x=0; x<640; x++) {
      const index=surface.pixels[Math.floor(y/scale)*surface.width+Math.floor(x/scale)];
      const at=(y*640+x)*4;
      const fx=x/scale-(frame?.x??0), fy=y/scale-(frame?.y??0);
      const movieIndex=frame && fx>=0 && fy>=0 && fx<frame.width && fy<frame.height
        ? frame.pixels[Math.floor(fy)*frame.width+Math.floor(fx)] : frame?.transparentIndex;
      const rgb=frame && movieIndex!==frame.transparentIndex
        ? frame.palette.subarray(movieIndex*3,movieIndex*3+3) : palette.subarray(index*3,index*3+3);
      image.data.set(rgb,at); image.data[at+3]=255;
    }
    context.putImageData(image,0,0);
  }
  function draw(next=view) {
    if (next.state!==owner) throw new Error('Call enter before drawing a new state');
    view=next;
    const surface={...animated,pixels:animated.pixels.slice()};
    if (owner===3) text(surface,view.name,153,133,136,10);
    const displayName=view.displayName??view.name;
    if (owner===1 && displayName) text(surface,displayName,117+4*(8-displayName.length),74,130,67);
    if (owner===6) {
      const data=assets.presentation.students, labels=data.labels;
      (view.students??[]).forEach((name,i)=>text(surface,name,185,40+8*i,138));
      const r=view.preview;
      if(r) {
        const w=p=>r[p]+256*r[p+1], signed=n=>n>32767?n-65536:n;
        const end=r.indexOf(0,274);text(surface,String.fromCharCode(...r.slice(274,end)),10,42,138);
        text(surface,data.characters[w(3)],10,76,138);
        text(surface,labels['0xa9f0']+' '+data.worlds[w(39)||w(41)?2:w(37)?1:0],10,98,138);
        for(const [label,y,value] of [
          ['0xa9fe',109,signed((w(1)+1)&65535)],['0xaa06',120,signed(w(29+2*w(5)))],
          ['0xaa10',131,signed(w(11))],['0xaa16',142,signed(w(9))+'%'],
          ['0xaa26',153,signed(Math.trunc(w(19)/60))+':'+String(w(19)%60).padStart(2,'0')],
          ['0xaa3c',164,r[253]?String.fromCharCode(...r.slice(253,258)).split('\0')[0]:labels['0xaa4a']]]) {
          if(label) text(surface,labels[label],10,y,138);
          text(surface,value,120,y,138);
        }
        text(surface,labels['0xaa50'],10,175,138);
        const certificates=[37,39,41].flatMap((p,i)=>w(p)?[labels[['0xaa64','0xaa6e','0xaa74'][i]]]:[]);
        text(surface,certificates.join(labels['0xaa6a'])||labels['0xaa5e'],34,186,138);
      }
    }
    if (owner===21) {
      // Fixture rows/expectedByte/cursorColumn are supplied, never advanced here.
      for (const [i,row] of (view.rows ?? []).slice(0,7).entries())
        text(surface, Array.isArray(row) ? String.fromCharCode(...row) : row,28,142+12*i,58);
      // FILE 0x35f4..0x3728: correct glyph31, distinct from lesson row58.
      for(const [i,byte] of (view.typedLine??[]).entries()) if(byte!==null)
        drawGlyph(surface,assets.font,byte,28+8*i,120,31);
      drawGlyph(surface,assets.font,32,28+8*(view.cursorColumn ?? view.cursor ?? 0),120,39,null,true);
      const fingers=assets.presentation.fingers;
      copyIndexed(surface,bitmap(fingers.bitmaps[10]),65,53,0,0,undefined,undefined,[0,63]);
      copyIndexed(surface,bitmap(fingers.bitmaps[11]),215,53,0,0,undefined,undefined,[0,63]);
      const expected=view.expectedByte;
      let finger=Number.isInteger(expected) && expected>=32 && expected<127 ? fingers.mapping[expected] : -1;
      if (finger>=40) finger-=40;
      const right=finger>=6;
      if (right) finger--;
      if (finger>=0 && finger<10)
        copyIndexed(surface,bitmap(fingers.bitmaps[finger]),65+(right ? 150:0)+fingers.dx[finger],53+fingers.dy[finger],
          0,0,undefined,undefined,[0,63]);
    }
    if (owner===10 && view.reportStrings) {
      if (view.reportStrings.length!==6) throw new Error('Supply six report strings');
      const report=assets.presentation.report;
      view.reportStrings.forEach((s,i) => text(surface,s,report.x[i],report.y[i],126));
    }
    present(surface);
  }
  function enter(next) {
    const id=next.bitmap ?? ({1:(next.displayName??next.name) ? 619:103,2:104,3:105,4:106,5:107,6:108,14:119,21:123,10:112})[next.state];
    if (!id) throw new Error(`Unsupported render state ${next.state}`);
    owner=next.state; view=next; backdrop=bitmap(id);
    animated={...backdrop,pixels:backdrop.pixels.slice()};
    overlay=assets.presentation.overlays[String(owner)];
    rows=overlay?.rows.map(row => ({...row,current:row.current})) ?? [];
    draw(next);
  }
  function visitOverlay({state,transition,movie,timerDelivered}) {
    if (state!==owner || transition || movie || !timerDelivered || !overlay) return;
    for (const row of rows) {
      row.current=row.current>=row.last ? 0 : row.current+1;
      const [x,y,w,h]=row.destination;
      for (const frame of row.frames) if (frame.tick===row.current)
        copyIndexed(animated,frame.x<0 ? backdrop : bitmap(overlay.bitmap),x,y,
          frame.x<0 ? x:frame.x,frame.x<0 ? y:frame.y,w,h);
    }
    draw();
  }
  function movieFrame(frame) {
    // Restore the saved indexed background before EVERY frame. Index, not RGB, is keyed.
    // Opaque AVI indices use the AVI palette, not the saved DIB palette.
    present(animated,frame);
  }
  return {enter,draw,visitOverlay,movieFrame,
    fade(amount){fadeAmount=amount;draw();},
    restore(){fadeAmount=0;draw();}};
}
