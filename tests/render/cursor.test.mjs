import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../../app/render.mjs';

// Synthetic raster, not original artwork. Pixels use the recovered arrow's slots.
const raster=Uint8Array.of(15,0,29,29,15,0);
function fixture() {
  const palette=new Uint8Array(768);
  palette.set([12,34,56],7*3);
  palette.set([255,255,255],15*3);
  palette.set([57,57,57],29*3);
  let presentations=0;
  const r=new Renderer({getContext:()=>({
    createImageData:()=>({data:new Uint8ClampedArray(256000)}),
    putImageData(){presentations++;}
  })},{sprites:{'CURSOR/arrow':{width:3,height:2,originX:0,originY:0}},palettes:{scene:palette}});
  // Same hydrated slot populated by Renderer.load(), without unrelated resources.
  r.pixels['CURSOR/arrow']=raster;
  r.palette='scene';r.front.fill(7);
  return {r,palette,presentations:()=>presentations};
}
const pixel=(r,x,y)=>Array.from(r.image.data.subarray((y*320+x)*4,(y*320+x+1)*4));
const background=[12,34,56,255];

test('cursor copies state without painting or normalizing coordinates',()=>{
  const {r,presentations}=fixture(), position={x:-1,y:198};
  r.setCursor(position);
  position.x=100;position.y=10;
  assert.deepEqual(r.cursor,{x:-1,y:198});
  assert.equal(presentations(),0);
  r.present();
  assert.deepEqual(pixel(r,1,198),[57,57,57,255]);
  r.setCursor(null);
  assert.equal(presentations(),1);
  assert.equal(r.cursor,null);
  for(const x of [0.5,NaN,Infinity,-Infinity,Number.MAX_VALUE]) {
    r.setCursor({x,y:1});
    assert.equal(Object.is(r.cursor.x,x),true);
  }
});

test('cursor uses active palette slots, keeps zero transparent, including LOGO black',()=>{
  const {r,palette}=fixture();
  r.setCursor({x:4,y:5});r.present();
  assert.deepEqual(pixel(r,4,5),[255,255,255,255]);
  assert.deepEqual(pixel(r,5,5),background);
  assert.deepEqual(pixel(r,6,5),[57,57,57,255]);
  palette.set([1,2,3],15*3);palette.set([4,5,6],29*3);
  r.present();
  assert.deepEqual(pixel(r,4,5),[1,2,3,255]);
  assert.deepEqual(pixel(r,6,5),[4,5,6,255]);
  r.presentationPalette=new Uint8Array(768);
  r.presentationPalette.set([3,8,14],7*3);
  r.presentationPalette.set([63,32,0],15*3);
  r.presentationPalette.set([14,14,14],29*3);
  r.palette='presentation';r.present();
  assert.deepEqual(pixel(r,4,5),[255,130,0,255]);
  assert.deepEqual(pixel(r,6,5),[57,57,57,255]);
  // LOGO's arrow slots are black, but nonzero pixels must still be drawn.
  r.presentationPalette.fill(0,15*3,15*3+3);
  r.presentationPalette.fill(0,29*3,29*3+3);
  r.present();
  assert.deepEqual(pixel(r,4,5),[0,0,0,255]);
  assert.deepEqual(pixel(r,6,5),[0,0,0,255]);
  assert.deepEqual(pixel(r,5,5),[12,32,57,255]);
});

test('move and hide reconstruct the scene without trails or indexed writes',()=>{
  const {r}=fixture(), snapshot=r.front.slice();
  r.front[10*320+10]=88;
  const probe=r.front.slice();
  r.setCursor({x:10,y:10});r.present();
  assert.deepEqual(r.front,probe); // The palette-88 probe is not overwritten.
  r.setCursor({x:20,y:20});r.present();
  assert.deepEqual(pixel(r,10,10),[0,0,0,255]);
  assert.deepEqual(pixel(r,11,10),background);
  assert.deepEqual(r.front,probe);
  // Snapshot restoration and incremental erasure stay independent of the arrow.
  r.front.set(snapshot);r.front[20*320+20]=0;
  r.present();
  assert.equal(r.front[20*320+20],0);
  r.setCursor(null);r.present();
  assert.deepEqual(pixel(r,20,20),[0,0,0,255]);
  assert.deepEqual(pixel(r,21,20),background);
  r.front.set(snapshot);r.present();
  assert.deepEqual(pixel(r,20,20),background);
  assert.deepEqual(r.front,snapshot);
});

test('cursor clips every edge without wrapping rows',()=>{
  for(const [x,y,visible] of [
    [-1,0,[[1,0,29],[0,1,15]]],
    [0,-1,[[0,0,29],[1,0,15]]],
    [319,199,[[319,199,15]]],
    [318,198,[[318,198,15],[318,199,29],[319,199,15]]]
  ]) {
    const {r,palette}=fixture(), expected=new Uint8ClampedArray(256000);
    for(let i=0;i<64000;i++)expected.set(background,i*4);
    for(const [px,py,index] of visible)expected.set([...palette.subarray(index*3,index*3+3),255],(py*320+px)*4);
    r.setCursor({x,y});r.present();
    assert.deepEqual(r.image.data,expected,`position ${x},${y}`);
    assert.ok(r.front.every(index=>index===7));
  }
});

test('offscreen and non-raster coordinates are safely invisible, not clamped',()=>{
  const {r}=fixture();r.present();const clean=r.image.data.slice();
  for(const [x,y] of [[-3,0],[0,-2],[320,0],[0,200],[1e100,0],[-1e100,0],
    [NaN,0],[0,NaN],[Infinity,0],[0,-Infinity],[0.5,0],[0,0.5]]) {
    r.setCursor({x,y});r.present();
    assert.deepEqual(r.image.data,clean,`position ${x},${y}`);
  }
});

test('visible cursor requires the bundled and hydrated sprite',()=>{
  for(const slot of ['record','pixels']) {
    const {r}=fixture();
    if(slot==='record')delete r.data.sprites['CURSOR/arrow'];
    else delete r.pixels['CURSOR/arrow'];
    r.present(); // Hidden cursors do not require an overlay.
    r.setCursor({x:0,y:0});
    assert.throws(()=>r.present(),/Missing sprite: CURSOR\/arrow/);
  }
});
