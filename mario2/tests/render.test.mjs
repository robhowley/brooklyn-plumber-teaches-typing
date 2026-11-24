import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {copyIndexed,drawGlyph,createRenderer} from '../render.js';

const surface=(w,h,value=0)=>({width:w,height:h,pixels:new Uint8Array(w*h).fill(value),palette:new Uint8Array(768)});
function fixture() {
  let image;
  const context={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:value=>{image=value;}};
  const canvas={getContext:()=>context};
  const background=surface(640,480,10),atlas=surface(4,4,77);
  // Deliberately different atlas palette, copies must retain backdrop palette.
  background.palette.set([3,4,5],30); background.palette.set([11,12,13],231);
  atlas.palette.fill(255);
  const presentation={overlays:{'1':{bitmap:599,rows:[{destination:[0,0,2,2],current:0,last:2,
    frames:[{x:0,y:0,tick:1},{x:-1,y:0,tick:2}]}]}}};
  const assets={font:new Uint8Array(1024),presentation,bitmaps:new Map([[103,background],[599,atlas]])};
  const renderer=createRenderer(canvas,assets,{paletteEndpoints:{low:new Uint8Array(30),high:new Uint8Array(30)}});
  return {renderer,pixel:()=>[...image.data.slice(0,4)]};
}

test('signed clipping and index-key transparency, not RGB equality',()=>{
  const target=surface(3,2,99),source={width:3,height:2,pixels:Uint8Array.of(0,63,5,6,7,8)};
  copyIndexed(target,source,-1,0,0,0,3,2,[0,63]);
  assert.deepEqual([...target.pixels],[99,5,99,7,8,99]);
});

test('overlay visits obey all gates, restore backdrop, wrap, and draw never advances',()=>{
  const {renderer,pixel}=fixture(), view={state:1,name:''};
  renderer.enter(view); assert.deepEqual(pixel(),[3,4,5,255]);
  const visit={state:1,transition:0,movie:0,timerDelivered:true};
  for (const gate of [{state:2},{transition:1},{movie:1},{timerDelivered:false}]) {
    renderer.visitOverlay({...visit,...gate});assert.deepEqual(pixel(),[3,4,5,255]);
  }
  renderer.visitOverlay(visit); assert.deepEqual(pixel(),[11,12,13,255]);
  renderer.draw(view); assert.deepEqual(pixel(),[11,12,13,255]);
  renderer.visitOverlay(visit); assert.deepEqual(pixel(),[3,4,5,255]);
  renderer.visitOverlay(visit); assert.deepEqual(pixel(),[3,4,5,255]);
  renderer.visitOverlay(visit); assert.deepEqual(pixel(),[11,12,13,255]);
  renderer.enter(view); assert.deepEqual(pixel(),[3,4,5,255]);
});

test('startup repaint and single fade preserve source palette1, saturate 2..245 and restore',()=>{
  let displayed;
  const bg=surface(640,480);bg.pixels.forEach((_,i)=>bg.pixels[i]=i%256);
  for(let i=0;i<256;i++)bg.palette.set([i,255-i,100],i*3);
  const context={createImageData:()=>({data:new Uint8ClampedArray(640*480*4)}),putImageData:image=>{displayed=image.data;}};
  const renderer=createRenderer({getContext:()=>context},{bitmaps:new Map([[485,bg]]),presentation:{overlays:{}}},
    {paletteEndpoints:{low:bg.palette.slice(0,30),high:bg.palette.slice(738)}});
  const check=amount=>{
    for(let i=0;i<640*480;i++)for(let c=0;c<3;c++){
      const index=i%256,original=bg.palette[index*3+c];
      assert.equal(displayed[i*4+c],index>=2&&index<=245?Math.max(0,original-amount):original);
    }
  };
  renderer.enter({state:0,bitmap:485});check(0);renderer.draw();check(0);
  renderer.fade(75);check(75);renderer.draw();check(75);
  renderer.restore();check(0);
});

test('all embedded glyph row bits independently match the original font plane',
  {skip:!existsSync(new URL('../dist/font.bin',import.meta.url))},()=>{
  const font=new Uint8Array(readFileSync(new URL('../dist/font.bin',import.meta.url)));
  assert.equal(font.length,1024);
  for (const width of [320,640]) for (let byte=0;byte<128;byte++) for (const inverse of [false,true]) {
    const output=surface(width,32,9),scale=width/320;
    drawGlyph(output,font,byte,0,0,31,10,inverse);
    for (let y=0;y<8*scale;y++) for (let x=0;x<8*scale;x++) {
      const bit=(font[byte*8+Math.floor(y/scale)] >> (7-Math.floor(x/scale)))&1;
      const expected=byte<32 ? 9 : Boolean(bit)!==inverse ? 31:10;
      assert.equal(output.pixels[y*width+x],expected,`${byte}/${x}/${y}`);
    }
  }
});


test('source typing and report fixtures match independent index composition at every display pixel',
  {skip:!existsSync(new URL('../dist/presentation.json',import.meta.url))},()=>{
  const base=new URL('../dist/',import.meta.url);
  const manifest=JSON.parse(readFileSync(new URL('assets.json',base)));
  const presentation=JSON.parse(readFileSync(new URL('presentation.json',base)));
  const font=new Uint8Array(readFileSync(new URL('font.bin',base)));
  const bitmaps=new Map(Object.entries(manifest.assets).filter(([key])=>key.startsWith('ne-2-')).map(([key,a])=>{
    const image=a.data.image;
    return [Number(key.slice(5)),{width:image.width,height:image.height,
      palette:Uint8Array.from(image.palette.flat()),pixels:new Uint8Array(inflateSync(readFileSync(new URL(a.files['pixels.zlib'],base))))}];
  }));
  for (const state of [21,10]) {
    let displayed;
    const bg=bitmaps.get(state===21 ? 123:112),expected=bg.pixels.slice();
    const scale=bg.width/320;
    const glyph=(byte,x,y,color,inverse=false)=>{
      for (let py=0;py<8*scale;py++) for (let px=0;px<8*scale;px++) {
        const bit=Boolean(font[byte*8+Math.floor(py/scale)] & (128>>Math.floor(px/scale)));
        if (bit!==inverse) expected[(y*scale+py)*bg.width+x*scale+px]=color;
      }
    };
    const view=state===21 ? {state,rows:['A'],expectedByte:74,cursorColumn:1} :
      {state,reportStrings:['A','A','A','A','A','A']};
    if (state===10) for (let i=0;i<6;i++) glyph(65,presentation.report.x[i],presentation.report.y[i],126);
    else {
      glyph(65,28,142,58);glyph(32,36,120,39,true);
      const f=presentation.fingers;
      let finger=f.mapping[74];if (finger>=40) finger-=40;
      const right=finger>=6;if (right) finger--;
      for (const [id,x,y] of [[f.bitmaps[10],65,53],[f.bitmaps[11],215,53],
        [f.bitmaps[finger],65+(right ? 150:0)+f.dx[finger],53+f.dy[finger]]]) {
        const b=bitmaps.get(id);
        b.pixels.forEach((index,i)=>{if(index!==0 && index!==63)
          expected[(y+Math.floor(i/b.width))*bg.width+x+i%b.width]=index;});
      }
    }
    const context={createImageData:()=>({data:new Uint8ClampedArray(640*480*4)}),putImageData:image=>{displayed=image.data;}};
    const renderer=createRenderer({getContext:()=>context},{font,bitmaps,presentation},
      {paletteEndpoints:{low:bg.palette.slice(0,30),high:bg.palette.slice(246*3)}});
    renderer.enter(view);renderer.draw(view);
    for (let y=0;y<480;y++) for(let x=0;x<640;x++) {
      const index=expected[Math.floor(y/(640/bg.width))*bg.width+Math.floor(x/(640/bg.width))];
      const at=(y*640+x)*4;
      for(let c=0;c<3;c++) assert.equal(displayed[at+c],bg.palette[index*3+c],`${state}/${x}/${y}/${c}`);
      assert.equal(displayed[at+3],255);
    }
  }
});
