import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {renderWater,renderWaterSpecial,waterOperations,WATER_PROFILE} from '../water-render.js';
const plane=v=>new Uint8Array(76800).fill(v);
test('166-row restore, inverted glyph unset backing, caller order and bottom anchor',()=>{
  const backing=plane(11),current=plane(7),font=new Uint8Array(1024);font[65*8]=128;
  renderWater({backing,current,operations:[{kind:'restore'}]});
  for(let y=0;y<240;y++) assert.equal(current[y*320],y>=74?11:7);
  renderWater({backing,current,operations:[{kind:'glyph',font,character:65,x:0,y:48,color:255,invert:true}]});
  assert.equal(current[48*320],11);assert.equal(current[48*320+1],255);
  const image={width:1,height:2,pixels:Uint8Array.of(5,6)};
  const effects=[{type:'draw',operation:{type:'object',object:{sprite:{selector:25,frame:0},x:2,y:80,anchor:'bottom'}}}];
  renderWater({backing,current,operations:waterOperations(effects,{font,bitmaps:new Map([[387,image]]),presentation:{waterSprites:{25:[387]}}})});
  assert.equal(current[78*320+2],5);assert.equal(current[79*320+2],6);
  assert.equal(current[80*320+2],11);
  assert.throws(()=>renderWater({backing,current,operations:[],profile:{...WATER_PROFILE,baseLow:1}}));
});
test('row exactly40 cells, zero to space, sole expected inversion, restore never erases row/HUD',()=>{
  const font=new Uint8Array(1024),backing=plane(9),current=plane(3),row=Array(41).fill(0);
  const operations=waterOperations([{type:'draw',operation:{type:'row',bytes:row}},{type:'draw',operation:{type:'hud',elapsed:65,typed:12,wrong:2,wpm:2}},{type:'draw',operation:{type:'restore'}}],{font});
  assert.equal(operations.filter(op=>op.invert).length,1);assert.equal(operations[10].character,32);
  renderWater({backing,current,operations});
  assert.equal(current[48*320+80],255);assert.equal(current[48*320+79],9);
  assert.equal(current[8*320],9);assert.equal(current[24*320],9);
});
test('special independently uses physical address walk, ANI transparency and empty no-op',()=>{
  const backing=plane(250),current=plane(7),pixels=Uint8Array.from({length:64000},(_,p)=>p%251);
  const ban={pixels},ani={x:31,y:42,width:3,height:2,pixels:Uint8Array.of(0,63,21,22,23,24)};
  renderWaterSpecial({backing,current,ban:{empty:true}});assert.equal(current[0],7);
  renderWaterSpecial({backing,current,ban,ani});
  const physical=plane(250);let address=63680;
  for(let row=0;row<200;row++) {for(let x=0;x<320;x++,address++)if(pixels[row*320+x])physical[address]=pixels[row*320+x];address-=640;}
  // FILE0x2ac0 operand and low16 pointer, independent of logical sprite placement.
  const dest=(ani.x-320*(ani.y+15)+10944)&65535;
  for(let y=0;y<2;y++)for(let x=0;x<3;x++){const v=ani.pixels[y*3+x];if(v!==0&&v!==63)physical[dest-y*320+x]=v;}
  for(let y=0;y<240;y++)assert.deepEqual(current.subarray(y*320,(y+1)*320),physical.subarray((239-y)*320,(240-y)*320));
});
test('pinned first/correct/failure/retirement raster boundaries, independent per-pixel ownership',()=>{
  const dist=new URL('../dist/',import.meta.url),catalog=JSON.parse(readFileSync(new URL('assets.json',dist))),font=new Uint8Array(readFileSync(new URL('font.bin',dist)));
  const image=id=>{const a=catalog.assets['ne-2-'+id];return {...a.data.image,pixels:new Uint8Array(inflateSync(readFileSync(new URL(a.files['pixels.zlib'],dist))))};};
  const backing=image(121).pixels;
  for(const stage of ['first','correct','failure','retirement-draw','retired']) {
    const current=plane(7),layers=[{kind:'restore'}];
    const row=[...Array(10).fill(0),...Buffer.from('abcdefghijklmnopqrstuvwxyzabcd'),0];
    if(stage==='correct') {row.copyWithin(0,1,40);row[39]=101;}
    layers.push(...waterOperations([{type:'draw',operation:{type:'row',bytes:row}}],{font}));
    // Declared raster boundaries only, not a fabricated rules trajectory.
    layers.push({kind:'sprite',image:image(424),x:0,y:80});
    if(stage!=='retired') layers.push({kind:'sprite',image:image(stage==='failure'?399:388),x:21,y:113});
    renderWater({backing,current,operations:layers});
    for(let y=0;y<240;y++)for(let x=0;x<320;x++) {
      const p=y*320+x;let expected=y>=74?backing[p]:7;
      for(const op of layers.slice(1)) {
        const dx=x-op.x,dy=y-op.y;
        if(op.kind==='glyph'&&dx>=0&&dx<8&&dy>=0&&dy<8) expected=(Boolean(font[op.character*8+dy]&(1<<(7-dx)))!==op.invert)?op.color:backing[p];
        if(op.kind==='sprite'&&dx>=0&&dx<op.image.width&&dy>=0&&dy<op.image.height) {const value=op.image.pixels[dy*op.image.width+dx];if(value!==0&&value!==63)expected=value;}
      }
      assert.equal(current[p],expected,stage+' '+p);
    }
  }
});
const oraclePath=process.env.MARIO2_WATER_ORACLE;
test('all157 pinned special presentations, independent conditional-pixel/address expectations',{skip:!oraclePath},()=>{
  const oracle=JSON.parse(readFileSync(oraclePath)),dist=new URL('../dist/',import.meta.url),catalog=JSON.parse(readFileSync(new URL('assets.json',dist)));
  const image=id=>{const a=catalog.assets['ne-2-'+id];return {...a.data.image,pixels:new Uint8Array(inflateSync(readFileSync(new URL(a.files['pixels.zlib'],dist))))};};
  const backing=image(121).pixels;let count=0;
  for(const c of 'MPL') {
    const load=ext=>{const a=catalog.assets[`ne-FULLSCREENANIM-${c}SWM.${ext}`];return {frames:a.data.frames,pixels:inflateSync(readFileSync(new URL(a.files['planes.zlib'],dist)))};};
    const bans=load('BAN'),anis=load('ANI');let ai=0;
    for(let iteration=0;iteration<bans.frames.length;iteration++) {
      const b=bans.frames[iteration];if(b.empty)continue;
      const a=anis.frames[ai++],ban={...b,pixels:bans.pixels.subarray(b.offset,b.offset+b.size)},ani={...a,pixels:anis.pixels.subarray(a.offset,a.offset+a.size)},current=plane(0);
      renderWaterSpecial({backing,current,ban,ani});
      const start=(a.x-320*(a.y+15)+10944)&65535;
      for(let physical=0;physical<76800;physical++) {
        const column=physical%320,row=Math.floor(physical/320),logical=(239-row)*320+column;
        const bp=(199-row)*320+column;let value=bp>=0&&bp<64000&&ban.pixels[bp]?ban.pixels[bp]:backing[logical];
        const dy=Math.floor((start+a.width-1-physical)/320),dx=physical-(start-dy*320);
        if(dy>=0&&dy<a.height&&dx>=0&&dx<a.width) {const v=ani.pixels[dy*a.width+dx];if(v!==0&&v!==63)value=v;}
        assert.equal(current[logical],value,`${c}/${iteration} pixel${logical}`);
      }
      const expected=oracle.special.find(f=>f.prefix===c&&f.iteration===iteration);
      assert.equal(createHash('sha256').update(current).digest('hex'),expected.sha256);count++;
    }
  }
  assert.equal(count,157);
});
