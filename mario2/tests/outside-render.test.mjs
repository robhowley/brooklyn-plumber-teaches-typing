import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {renderOutside,renderOutsideSpecial,OUTSIDE_PROFILE} from '../outside-render.js';
const plane=v=>new Uint8Array(76800).fill(v);
const hash=p=>createHash('sha256').update(p).digest('hex');
test('188-row restore preserves exact edges in both orientations, drawing not clipped to restore',()=>{
  for(const orientation of ['positive-height','nonpositive-height']) {
    const backing=plane(11),current=plane(7),profile={...OUTSIDE_PROFILE,orientation};
    assert.equal(renderOutside({backing,current,profile,operations:[{kind:'restore'}]}),current);
    for(let y=0;y<240;y++) assert.equal(current[y*320],(orientation==='positive-height'?y>=2&&y<=189:y<188)?11:7);
    renderOutside({backing,current,profile,operations:[{kind:'sprite',image:{width:3,height:1,pixels:Uint8Array.of(0,63,5)},x:-1,y:239}]});
    assert.equal(current[239*320+1],5);
    assert.equal(backing[239*320+1],11);
  }
});
test('control glyphs restore backing, transparent labels retain current, caller order wins',()=>{
  const backing=plane(9),current=plane(3),font=new Uint8Array(1024);font[9*8]=128;
  renderOutside({backing,current,operations:[{kind:'glyph',character:9,font,x:0,y:0}]});
  assert.equal(current[0],15);assert.equal(current[1],9);
  renderOutside({backing,current,operations:[{kind:'glyph',character:9,font,x:0,y:0,restore:false}]});
  assert.equal(current[1],9);
});
test('special empty record does nothing; BAN transfers63, ANI does not; pointer refusal transactional',()=>{
  const backing=plane(5),current=plane(7),ban={empty:false,pixels:new Uint8Array(64000)};
  ban.pixels[0]=63;
  const ani={x:0,y:0,width:1,height:1,pixels:Uint8Array.of(63)};
  renderOutsideSpecial({backing,current,ban:{empty:true}});assert.equal(current[0],7);
  renderOutsideSpecial({backing,current,ban,ani});assert.equal(current[40*320],63);
  assert.equal(current[35*320],5);
  const saved=current.slice();
  assert.throws(()=>renderOutsideSpecial({backing,current,ban,ani,profile:{...OUTSIDE_PROFILE,baseLow:50000}}),RangeError);
  assert.deepEqual(current,saved);
});
test('BAN standalone physical rows199 down to0, every byte and both orientations, strict64k plane',()=>{
  // WINMARIO FILE0x2efe..0x2f64: physical address f8c0+column-320*row.
  // Use physical memory below, independent of renderer logical coordinate math.
  const bytes=Uint8Array.from({length:64000},(_,i)=>i%251);
  const ani={x:0,y:0,width:1,height:1,pixels:Uint8Array.of(63)};
  for(const orientation of ['positive-height','nonpositive-height']) {
    const backing=plane(254),current=plane(7);
    renderOutsideSpecial({backing,current,ban:{pixels:bytes},ani,profile:{...OUTSIDE_PROFILE,orientation}});
    const physical=plane(254);
    let address=63680;
    for(let row=0;row<200;row++) {
      for(let x=0;x<320;x++,address++) if(bytes[row*320+x])physical[address]=bytes[row*320+x];
      address-=640;
    }
    for(let y=0;y<240;y++) {
      const physicalY=orientation==='positive-height'?239-y:y;
      assert.deepEqual(current.subarray(y*320,(y+1)*320),physical.subarray(physicalY*320,(physicalY+1)*320));
    }
    const saved=current.slice();
    for(const length of [63999,64001]) {
      assert.throws(()=>renderOutsideSpecial({backing,current,ban:{pixels:new Uint8Array(length)},ani,profile:{...OUTSIDE_PROFILE,orientation}}),/BAN plane/);
      assert.deepEqual(current,saved);
    }
  }
});
// Optional externally retained source oracle. No research path is a runtime input.
// phase3-ab-fixes/oracle.json supersedes the historical composition-final
// BAN placement only (59 surfaces,5 masks,330 compositions).
const oraclePath=process.env.MARIO2_OUTSIDE_ORACLE;
test('complete independently retained source oracle surfaces and special compositions',{skip:!oraclePath},()=>{
  const oracle=JSON.parse(readFileSync(oraclePath)),dist=new URL('../dist/',import.meta.url);
  const catalog=JSON.parse(readFileSync(new URL('assets.json',dist))),font=new Uint8Array(readFileSync(new URL('font.bin',dist)));
  const image=id=>{const a=catalog.assets[`ne-2-${id}`];return {...a.data.image,pixels:new Uint8Array(inflateSync(readFileSync(new URL(a.files['pixels.zlib'],dist))))};};
  const bg=image(120).pixels,init=bg.slice();renderOutside({backing:bg,current:init,operations:[{kind:'hud',font}]});
  for(const f of oracle.frames.filter(f=>!f.prefix)) {
    let current=init.slice();
    if(f.name!=='initial-after-initializer') {
      if(f.name.startsWith('live')||f.name.startsWith('edge')) {
        current=bg.slice();renderOutside({backing:bg,current,operations:[{kind:'hud',font,elapsed:65,typed:12,wrong:2,wpm:2}]});
        if(f.name.startsWith('edge')) for(const y of [0,1,188,189,239]) current.fill(17+y%20,y*320,(y+1)*320);
      }
      const orientation=f.inputs?.orientation??f.orientation;
      const ops=[{kind:'restore'},...f.layers.map(z=>z.resource?{kind:'sprite',image:image(z.resource),x:z.x,y:z.y}:{kind:'glyph',font,character:z.character,x:z.x,y:z.y,restore:z.role!=='mutable-label',color:15})];
      renderOutside({backing:bg,current,operations:ops,profile:{...OUTSIDE_PROFILE,orientation:orientation==='bottom-up'?'positive-height':'nonpositive-height'}});
    }
    assert.equal(hash(current),f.sha256,f.name);
  }
  let count=0;
  for(const prefix of 'MPL') {
    const load=ext=>{const a=catalog.assets[`ne-FULLSCREENANIM-${prefix}OUT.${ext}`];return {frames:a.data.frames,pixels:new Uint8Array(inflateSync(readFileSync(new URL(a.files['planes.zlib'],dist))))};};
    const bs=load('BAN'),as=load('ANI');
    for(const positive_height of [true,false]) {
      let ai=0;
      for(let iteration=0;iteration<bs.frames.length;iteration++) {
        const b=bs.frames[iteration];if(b.empty)continue;
        const a=as.frames[ai++],current=plane(0),backing=image(620).pixels;
        renderOutsideSpecial({backing,current,ban:{empty:false,pixels:bs.pixels.subarray(b.offset,b.offset+b.size)},ani:{...a,pixels:as.pixels.subarray(a.offset,a.offset+a.size)},profile:{...OUTSIDE_PROFILE,orientation:positive_height?'positive-height':'nonpositive-height'}});
        const expected=oracle.special.find(z=>z.prefix===prefix&&z.iteration===iteration&&z.positive_height===positive_height);
        assert.equal(hash(current),expected.sha256,`${prefix}/${iteration}/${positive_height}`);count++;
        const renderAt=baseLow=>renderOutsideSpecial({backing,current,ban:{empty:false,pixels:bs.pixels.subarray(b.offset,b.offset+b.size)},ani:{...a,pixels:as.pixels.subarray(a.offset,a.offset+a.size)},profile:{...OUTSIDE_PROFILE,baseLow,orientation:positive_height?'positive-height':'nonpositive-height'}});
        // Inclusive no-wrap edge, then one lowword step across it. Refuse
        // outside browser memory instead of inventing a selector carry.
        renderAt(expected.max_base_low_for_initial_no_wrap);
        assert.equal(hash(current),expected.sha256);
        assert.throws(()=>renderAt(expected.max_base_low_for_initial_no_wrap+1),RangeError);
        const frame=oracle.frames.find(z=>z.prefix===prefix&&z.iteration===iteration&&z.positive_height===positive_height);
        if(frame)assert.equal(hash(current),frame.sha256,frame.name);
      }
    }
  }
  assert.equal(oracle.frames.length,59);assert.equal(count,330);
  const oracleDir=new URL('.',new URL(`file://${oraclePath}`));
  for(const orientation of ['bottom-up','top-down']) {
    const current=plane(0);renderOutside({backing:plane(1),current,operations:[{kind:'restore'}],profile:{...OUTSIDE_PROFILE,orientation:orientation==='bottom-up'?'positive-height':'nonpositive-height'}});
    assert.deepEqual(Buffer.from(current),readFileSync(new URL(`oracles/restore-${orientation}.mask`,oracleDir)));
  }
  for(const c of [33,65,70]) {
    const current=plane(0);renderOutside({backing:plane(0),current,operations:[{kind:'glyph',font,character:c,x:0,y:0,color:1}]});
    const mask=Buffer.concat(Array.from({length:8},(_,y)=>Buffer.from(current.subarray(y*320,y*320+8))));
    assert.deepEqual(mask,readFileSync(new URL(`oracles/glyph-${c}.mask`,oracleDir)));
  }
});
