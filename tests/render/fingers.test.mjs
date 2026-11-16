import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as render from '../../recovered/render/render.mjs';
const data=JSON.parse(readFileSync(new URL('../../app/data.json',import.meta.url)));
const exe=readFileSync(new URL('../../assets/original/raw/MarioTea/MARIO/MARIO.EXE.data',import.meta.url));
const manifest=JSON.parse(readFileSync(new URL('../../assets/original/manifest.json',import.meta.url)));
const resources=manifest.sprites.filter(s=>s.family==='FINGER').map(sprite=>({sprite,
 pixels:readFileSync(new URL('../../assets/original/'+sprite.indicesPath,import.meta.url))}));

// Independent raster oracle: source compositor restores ALL current rectangle
// samples, including zeros. Do not use the implementation's sprite helpers.
function stamp(front,background,resource,x,y) {
 const {sprite,pixels}=resource;
 for(let j=0;j<sprite.height;j++)for(let i=0;i<sprite.width;i++) {
  const dest=(y+j)*320+x+i;
  front[dest]=pixels[j*sprite.width+i]||background[dest];
 }
}

test('bundle extracts every ASCII lookup, coordinate and pinned FINGER resource',()=>{
 assert.equal(createHash('sha256').update(exe).digest('hex'),'6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e');
 assert.deepEqual(data.fingers.lookup,Array.from(exe.subarray(0x2258c,0x225eb)));
 assert.equal(data.fingers.lookup.length,95);
 assert.equal(createHash('sha256').update(Uint8Array.from(data.fingers.lookup)).digest('hex'),'f43d6e8ba56e0838705766550f3bdaaf1b0e2f260510ab329078f5db851f067f');
 for(let i=0;i<10;i++) {
  assert.equal(data.fingers.x[i],exe.readInt16LE(0x21df6+2*i));
  assert.equal(data.fingers.y[i],exe.readInt16LE(0x21e0a+2*i));
 }
 assert.deepEqual(data.fingers.origins,[[90,158,90],[100,3,70],[100,158,70],[30,45,230]]);
 for(const {sprite,pixels} of resources) {
  const bundled=data.sprites['FINGER/'+sprite.name];
  assert.equal(bundled.index,sprite.index);assert.deepEqual(bundled.headerWords,sprite.headerWords);
  assert.deepEqual(Buffer.from(bundled.pixels,'base64'),pixels);
  assert.equal(bundled.memberSha256,'2ff6f12ad9491f3e8f12060451ba2aec9de8b6cdf9695b4f07ea0a04ca0a1688');
  assert.equal(bundled.indexSha256,'5959d392c045be861a95e28efb440d3945afb181588e6135e91e223db1f6bf7a');
 }
});

test('all 95 source lookups render exact base/highlight indexed pixels in all four positions',()=>{
 for(let mode=1;mode<=4;mode++)for(let code=32;code<127;code++) {
  const [x,y,gap]=[[90,158,90],[100,3,70],[100,158,70],[30,45,230]][mode-1];
  const background=Uint8Array.from({length:64000},(_,i)=>i%251),front=new Uint8Array(64000).fill(254),expected=front.slice();
  stamp(expected,background,resources[10],x,y);stamp(expected,background,resources[11],x+gap,y);
  let index=exe[0x2258c+code-32];if(index>=40)index-=40;
  const right=index>=6;if(right)index--;
  stamp(expected,background,resources[index],x+(right?gap:0)+exe.readInt16LE(0x21df6+2*index),y+exe.readInt16LE(0x21e0a+2*index));
  render.drawFingers(front,background,resources,data.fingers,mode);
  render.drawFingers(front,background,resources,data.fingers,mode,code);
  assert.deepEqual(front,expected,`mode ${mode}, ASCII ${code}`);
 }
});

test('control bytes, DEL and extended codes leave neutral hands without guessed Shift imagery',()=>{
 const bg=new Uint8Array(64000).fill(17),front=bg.slice();
 render.drawFingers(front,bg,resources,data.fingers,4);const neutral=front.slice();
 for(const code of [-1,0,9,13,27,31,127,128,255]) {
  render.drawFingers(front,bg,resources,data.fingers,4,code);assert.deepEqual(front,neutral);
 }
});
