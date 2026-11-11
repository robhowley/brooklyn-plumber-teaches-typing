import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { numericHUDOperations, statsOperations, drawNumericHUD, drawStats } from '../../app/stats-render.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const json=path=>JSON.parse(readFileSync(root+path,'utf8'));
const messages=Object.fromEntries(Object.entries(json('analysis/control/messages.json').resources).map(([k,v])=>[k,v.text]));
const manifest=json('assets/original/manifest.json');
const fonts=Object.fromEntries(['FONT3H','FONT5H'].map(f=>[f,manifest.sprites.filter(s=>s.family===f).map(sprite=>({sprite,
  pixels:new Uint8Array(readFileSync(root+'assets/original/'+sprite.indicesPath))}))]));
const stats={attempts:1234,errors:2,wpm:47,accuracy:99,elapsedSeconds:125};
const exe=readFileSync(root+'assets/original/raw/MarioTea/MARIO/MARIO.EXE.data');

test('all four mode branches from FILE0x164a4 have distinct exact HUD coordinates/colors',()=>{
  const targets=Array.from({length:4},(_,i)=>0x15960+exe.readUInt16LE(0x164a4+2*i));
  assert.deepEqual(targets,[0x15d9c,0x15ea1,0x15fad,0x160a1]);
  for(const [mode,coords,bg,font] of [
    [1,[[256,168],[0,168],[0,184],[240,184]],13,'FONT5H'],
    [2,[[232,8],[0,8],[0,24],[232,24]],86,'FONT3H'],
    [3,[[256,168],[0,168],[0,184],[240,184]],0,'FONT5H'],
    [4,[[256,8],[0,8],[0,24],[240,24]],1,'FONT5H']]) {
    const ops=numericHUDOperations(mode,stats,messages);
    assert.deepEqual(ops.map(o=>[o.x,o.y]),coords);
    assert.ok(ops.every(o=>o.font===font&&o.opaque&&o.background===bg));
    assert.equal(ops[0].color,mode===2?11:10);assert.equal(ops[2].color,mode===1?15:14);
    assert.equal(ops[0].text.trim(),mode===2?'WPM:  47':'WPM:  47');
  }
  assert.equal(exe.subarray(0x15ed2,0x15ed8).toString('hex'),'c706a9580800');
  assert.equal(exe.subarray(0x15f6a,0x15f70).toString('hex'),'c706a9581800');
});

test('HUD preserves MSD spaces, unsigned counter words and low-word clock behavior',()=>{
  const water=numericHUDOperations(2,stats,messages);
  assert.equal(water[0].text,'   WPM:  47');assert.equal(water[1].text,'  0:02:05 ');
  assert.equal(water[2].text,'Typed:1234 ');assert.equal(water[3].text,' Errors:  2');
  assert.equal(numericHUDOperations(4,{...stats,attempts:-32768},messages)[2].text,'Typed:32768');
  const long=numericHUDOperations(1,{...stats,elapsedSeconds:40000},messages);
  assert.equal(long[1].text,'65529:06:65500'); // signed LOW word /3600 and %60, full dword /60 %60
});

test('BLACKBRD operation210 source value positions, labels and guest goal omission',()=>{
  const ops=statsOperations(stats,{profilePresent:true,goal:50},messages);
  assert.deepEqual(ops.filter(o=>o.color===10).map(o=>[o.x,o.y,o.text]),
    [[136,32,'1234'],[136,48,'   2'],[144,64,' 47'],[144,80,' 50'],[136,96,' 99%'],[136,120,'  2:05']]);
  assert.ok(ops.every(o=>o.font==='FONT5H'&&!o.opaque&&o.shadow===8));
  assert.equal(exe.subarray(0x16349,0x16351).toString('hex'),'b8050050b8120050');
  assert.equal(exe.subarray(0x1638f,0x16397).toString('hex'),'b8090050b8130050');
  const guest=statsOperations(stats,{profilePresent:false},messages);
  assert.equal(guest.length,10);assert.ok(!guest.some(o=>o.y===80));
  assert.equal(statsOperations({...stats,elapsedSeconds:3600},{profilePresent:false},messages).at(-1).text,' 60:00');
});

test('Water and Practice opaque HUD pixels erase full cells with world palette indices',()=>{
  for(const mode of [1,2,3,4]) {
    const front=new Uint8Array(64000).fill(200),ops=drawNumericHUD(front,fonts,mode,stats,messages);
    const op=ops[0],glyph=fonts[op.font][op.text.charCodeAt(0)-32];
    for(let i=0;i<glyph.pixels.length;i++) {
      const x=op.x+i%glyph.sprite.width,y=op.y+Math.floor(i/glyph.sprite.width);
      assert.equal(front[y*320+x],[op.background,op.color,8][glyph.pixels[i]]);
    }
    assert.equal(front[199*320],200);
  }
});

test('results use BLACKBRD original background and its own palette, not a world palette',()=>{
  const bg=manifest.backgrounds.find(b=>b.name==='BLACKBRD');
  const resources={messages,fonts,background:new Uint8Array(readFileSync(root+'assets/original/'+bg.indicesPath)),
    palette:json('assets/original/palettes/BLACKBRD.CRX.json').rgb8};
  const front=new Uint8Array(64000),out=drawStats(front,resources,stats,{profilePresent:true,goal:50});
  assert.equal(out.palette.length,768);assert.deepEqual(front.subarray(0,320),resources.background.subarray(0,320));
  const glyph=fonts.FONT5H['K'.charCodeAt(0)-32];
  for(let i=0;i<glyph.pixels.length;i++) if(glyph.pixels[i]===1) assert.equal(front[(32+Math.floor(i/8))*320+40+i%8],11);
});
