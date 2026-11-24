import {test,expect} from '@playwright/test';
// Independent pixel/word oracles from WINMARIO.EXE;1 (hash in pins.json),
// font FILE 0x1fa00..0x1fe00, hand consumer 0x1ab5e..0x1ac62,
// report selection 0x19ef0..0x19ff5, progression 0x1dd96..0x1de88.
test('all glyphs, printable hand cues and report selector branches in built browser modules',async({page})=>{
 await page.goto('./');
 const proof=await page.evaluate(async()=>{
  const {loadAssets}=await import('./assets.js'),{drawGlyph,createRenderer}=await import('./render.js');
  const {reportMovie}=await import('./selection.js');
  const a=await loadAssets(new URL('./assets.json',location.href));let glyphErrors=0,handErrors=0;
  for(const width of [320,640]) for(let byte=0;byte<256;byte++) for(const inverse of [false,true]) {
   const scale=width/320,out={width,height:32,pixels:new Uint8Array(width*32).fill(9)};
   drawGlyph(out,a.font,byte,0,0,31,10,inverse);
   for(let y=0;y<8*scale;y++) for(let x=0;x<8*scale;x++) {
    const bit=Boolean(a.font[byte*8+Math.floor(y/scale)]&(128>>Math.floor(x/scale)));
    if(out.pixels[y*width+x]!== (byte<32||byte>=128?9:bit!==inverse?31:10))glyphErrors++;
   }
  }
  const bg=a.bitmaps.get(123),f=a.presentation.fingers;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const renderer=createRenderer(canvas,a,{paletteEndpoints:{low:bg.palette.slice(0,30),high:bg.palette.slice(738)}});
  for(let byte=32;byte<127;byte++) {
   const indices=bg.pixels.slice();let finger=f.mapping[byte];if(finger>=40)finger-=40;
   // Source draws hands first, cue last, skipping index0 and63.
   const right=finger>=6;if(right)finger--;
   const layers=[[f.bitmaps[10],65,53],[f.bitmaps[11],215,53]];
   if(finger>=0 && finger<10)layers.push([f.bitmaps[finger],65+(right?150:0)+f.dx[finger],53+f.dy[finger]]);
   for(const [id,x,y] of layers){const b=a.bitmaps.get(id);b.pixels.forEach((index,i)=>{
    if(index!==0&&index!==63)indices[(y+Math.floor(i/b.width))*320+x+i%b.width]=index;
   });}
   renderer.enter({state:21,rows:[],expectedByte:byte,cursorColumn:0});
   const actual=ctx.getImageData(0,0,640,480).data;
   // Hand region excludes the cursor and text, checking final layer order.
   for(let y=40;y<115;y++)for(let x=45;x<310;x++)for(let c=0;c<3;c++){
    if(actual[(y*2*640+x*2)*4+c]!==bg.palette[indices[y*320+x]*3+c])handErrors++;
   }
  }
  const branches=[];
  for(const [speed,previous,expected] of [[10,0,[52,51]],[9,10,[61,60]],[9,8,[54,53]],[9,9,[56,57,58,59]]])
   branches.push({actual:expected.map((_,i)=>reportMovie({speed,threshold:10,previous},{next:()=>i})),expected});
  return {glyphErrors,handErrors,branches};
 });
 expect(proof.glyphErrors).toBe(0);expect(proof.handErrors).toBe(0);
 for(const branch of proof.branches)expect(branch.actual).toEqual(branch.expected);
});
