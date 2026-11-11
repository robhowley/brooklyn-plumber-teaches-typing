import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {waterPalette,waterBonusSprite,waterActorOperations,drawWaterOperations,drawWaterText,drawWaterBonusPacket,restoreWaterScene} from '../../app/water-render.mjs';
const root=new URL('../../',import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const json=p=>JSON.parse(read(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
// Fresh ZIP data, never executable loading. Independent of generated pixel files.
const originals=JSON.parse(execFileSync('python3',['-B','-c',`
import zipfile,pathlib,json,base64,hashlib
p=pathlib.Path.home()/'Downloads/Mario_Teaches_Typing_1992.zip'
assert hashlib.sha256(p.read_bytes()).hexdigest()=='b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'
with zipfile.ZipFile(p) as z:
 names=['MARIO.EXE','WATER.GSO','WATER.GSK','FONT9H.GSO','FONT9H.GSK','FONT7H.GSO','FONT7H.GSK','BITER.GPO','MPALLET.GPO','LPALLET.GPO','PPALLET.GPO']+[c+'SWM.'+e for c in 'MLP' for e in ['BAN','ANI']]
 print(json.dumps({n:base64.b64encode(z.read('MarioTea/MARIO/'+n)).decode() for n in names}))
`],{maxBuffer:8*1024*1024}));
const original=n=>Buffer.from(originals[n],'base64');
const manifest=json('assets/render/manifest.json'), source=json('assets/original/manifest.json');
const bindings=json('assets/render/water/bindings.json');
function load(s,prefix='assets/render/') {return {sprite:s,pixels:new Uint8Array(read(prefix+s.indicesPath))};}
const resources={water:manifest.sprites.filter(s=>s.family==='WATER').map(s=>load(s)),bubbles:manifest.sprites.filter(s=>s.family==='WATER_INLINE').map(s=>load(s))};
const font9=source.sprites.filter(s=>s.family==='FONT9H').map(s=>load(s,'assets/original/'));
const font7=source.sprites.filter(s=>s.family==='FONT7H').map(s=>load(s,'assets/original/'));
resources.bonus=waterBonusSprite(resources.water[33],font7[33-32]);
const scene=new Uint8Array(read('assets/render/water/background.indices'));
const at=(record,x,y)=>({...record,x,y});
const blank=()=>new Uint8Array(64000);
const window=()=>new Uint8Array(40).fill(65);

// Independent indexed reference, no production geometry/compositor calls.
function reference(front,bg,current,previous) {
  const rect=r=>r && [r.x+r.sprite.headerWords[0],r.y+r.sprite.headerWords[1],r.sprite.width,r.sprite.height];
  const clip=r=>{if(!r)return null;const [x,y,w,h]=r,l=Math.max(0,x),t=Math.max(0,y),right=Math.min(319,x+w-1),bottom=Math.min(199,y+h-1);return l>right||t>bottom?null:[l,t,right,bottom];};
  const a=clip(rect(current)), b=clip(rect(previous));
  let regions=[a,b].filter(Boolean);
  if(a&&b&&a[0]<=b[2]&&b[0]<=a[2]&&a[1]<=b[3]&&b[1]<=a[3]) regions=[[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])]];
  for(const [l,t,r,bottom] of regions)for(let y=t;y<=bottom;y++)for(let x=l;x<=r;x++)front[y*320+x]=bg[y*320+x];
  if(current) {
    const [left,top,w,h]=rect(current);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x+left>=0&&x+left<320&&y+top>=0&&y+top<200&&current.pixels[y*w+x])front[(y+top)*320+x+left]=current.pixels[y*w+x];
  }
}

test('fresh original identities, compositor call bytes, all Water/font rasters and inline pixels',()=>{
  assert.equal(sha(original('MARIO.EXE')),'6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e');
  assert.equal(sha(original('WATER.GSO')),'1d61258b81c917bfd48a7bd7d22905ae8181e114d1154389853b63bd06836aae');
  const exe=original('MARIO.EXE');
  let count=0;
  for(const line of read('analysis/worlds/water.asm.txt').toString().split('\n')) {
    const m=line.match(/^\s*([a-f\d]+): ((?:[a-f\d]{2} )+)/);
    if(m){const offset=parseInt(m[1],16),bytes=Buffer.from(m[2].trim().replaceAll(' ',''),'hex');assert.deepEqual(exe.subarray(offset,offset+bytes.length),bytes);count++;}
  }
  assert.equal(count,2251);
  for(const line of read('analysis/worlds/disassembly.txt').toString().split('\n')) {
    const m=line.match(/^\s*([a-f\d]+): ((?:[a-f\d]{2} )+)/);if(!m)continue;
    const offset=parseInt(m[1],16);
    if(![[0x9edf,0x9f37],[0x1263d,0x1265f],[0x1a6c6,0x1ac9a],[0x1cbe9,0x1ccde]].some(([start,end])=>offset>=start&&offset<end))continue;
    const bytes=Buffer.from(m[2].trim().replaceAll(' ',''),'hex');assert.deepEqual(exe.subarray(offset,offset+bytes.length),bytes);
  }
  for(const family of ['WATER','FONT9H','FONT7H']) {
    const gso=original(family+'.GSO'),lines=original(family+'.GSK').toString().trim().split(/\r?\n/);
    const records=family==='WATER'?resources.water:family==='FONT9H'?font9:font7;
    assert.equal(records.length,lines.length);
    lines.forEach((line,i)=>{const [name,offsetText]=line.split(':'),offset=Number(offsetText),r=records[i];assert.equal(r.sprite.name,name);assert.deepEqual(r.sprite.headerWords,[gso.readInt16LE(offset),gso.readInt16LE(offset+2),gso.readUInt16LE(offset+4),gso.readUInt16LE(offset+6)]);assert.deepEqual(Buffer.from(r.pixels),gso.subarray(offset+8,offset+8+r.pixels.length));});
  }
  assert.deepEqual([...resources.bubbles[0].pixels],[0,0,0,15]);
  assert.deepEqual([...resources.bubbles[1].pixels],[0,15,0,15,0,15,0,15,0]);
  assert.deepEqual(Buffer.from(resources.bubbles[0].pixels),exe.subarray(0x21d14,0x21d18));
  assert.deepEqual(Buffer.from(resources.bubbles[1].pixels),exe.subarray(0x21d20,0x21d29));
  assert.equal(exe.subarray(0x21976,0x2197d).toString(),'font9h\0');
  assert.equal(exe.subarray(0x21d91,0x21d9b).toString(),'biter.gpo\0');
});

test('all three final palettes splice character32..47 and BITER48..63 only',()=>{
  const base=Uint8Array.from(manifest.worlds.water.palettes.m.rgb6.flat());
  for(const char of 'mlp') {
    const cp=original(char.toUpperCase()+'PALLET.GPO'),bp=original('BITER.GPO');
    const result=waterPalette(base,cp,bp);
    for(let i=0;i<768;i++)assert.equal(result[i],i>=96&&i<144?cp[i]:i>=144&&i<192?bp[i]:base[i]);
    assert.deepEqual([...result],bindings.palettes[char].rgb6.flat());
  }
});

test('all 18 swim and three sunk bindings, dirty erasure and physical clipping use original pixels',()=>{
  for(let character=1;character<=3;character++) for(let index=0;index<7;index++) for(const [x,y] of [[20,112],[-55,94],[319,157],[20,199],[20,200],[20,60]]) {
    const state={character,swimmer:{x,y,frame:index%6,failed:index===6,failurePhase:2},bubbles:[]};
    const op=waterActorOperations(resources,state,null)[0];
    assert.equal(op.current.sprite.index,index===6?33+character:6*(character-1)+index);
    const front=Uint8Array.from(scene),expected=Uint8Array.from(scene),previous=at(resources.water[6*(character-1)],20,112);
    reference(front,scene,previous,null);expected.set(front);
    drawWaterOperations(front,scene,[{...op,previous}]);reference(expected,scene,op.current,previous);
    assert.deepEqual(front,expected);
  }
});

test('source order uses selected pursuer resource even after its mode toggles',()=>{
  const state={character:1,swimmer:{x:90,y:112,frame:0},pursuer:{resourceIndex:18,mode:2,drawnX:90,y:112},bubbles:[]};
  const operations=waterActorOperations(resources,state,null), front=Uint8Array.from(scene), expected=Uint8Array.from(scene);
  assert.deepEqual(operations.map(o=>o.actor),['swimmer','pursuer']);assert.equal(operations[1].current.sprite.index,18);
  for(const op of operations) reference(expected,scene,op.current,op.previous);
  drawWaterOperations(front,scene,operations);assert.deepEqual(front,expected);
  const reverse=Uint8Array.from(scene);drawWaterOperations(reverse,scene,[...operations].reverse());assert.notDeepEqual(front,reverse);
});

test('ten bubble slots preserve index order, expand then erase outside source pool bounds',()=>{
  const before={character:1,bubbles:Array.from({length:10},(_,i)=>({x:i*5,y:80,active:true,large:false}))};
  const after={character:1,bubbles:before.bubbles.map((b,i)=>({...b,y:i===0?78:79,active:i!==0,large:true}))};
  const operations=waterActorOperations(resources,after,before).slice(2);
  assert.equal(operations.length,10);assert.equal(operations[0].current,null);
  const front=Uint8Array.from(scene),expected=Uint8Array.from(scene);
  for(const op of operations){reference(front,scene,op.previous,null);reference(expected,scene,op.previous,null);}
  drawWaterOperations(front,scene,operations);for(const op of operations)reference(expected,scene,op.current,op.previous);
  assert.deepEqual(front,expected);assert.equal(operations[9].actor,'bubble-9');
});

test('bonus FONT7H stamp ignores glyph origins and preserves zero, all glyphs',()=>{
  for(const glyph of font7) {
    const base=resources.water[33],originalPixels=Uint8Array.from(base.pixels),result=waterBonusSprite(base,glyph);
    for(let y=0;y<base.sprite.height;y++)for(let x=0;x<base.sprite.width;x++) {
      const gx=x-8,gy=y-7,v=gx>=0&&gx<glyph.sprite.width&&gy>=0&&gy<glyph.sprite.height?glyph.pixels[gy*glyph.sprite.width+gx]:0;
      assert.equal(result.pixels[y*base.sprite.width+x],v?[0,15,9][v]:originalPixels[y*base.sprite.width+x]);
    }
    assert.deepEqual(base.pixels,originalPixels);
  }
});

test('bonus mode3 erases; rising below80 redraws at y200 rather than retaining old bubble',()=>{
  for(const current of [{mode:3,x:30,y:90},{mode:0,x:30,y:200}]) {
    const before={bonus:{mode:2,x:30,y:90}},after={character:1,bonus:current};
    const op=waterActorOperations(resources,after,before).at(-1),front=Uint8Array.from(scene);
    reference(front,scene,op.previous,null);drawWaterOperations(front,scene,[op]);
    assert.deepEqual(front,scene);
  }
});

test('FONT9H exact prefix/target/suffix mapping, sanitation, 20/40 windows and no fake cursor',()=>{
  for(const length of [20,40]) {
    const target=length/4,win=Uint8Array.from({length},(_,i)=>[0,31,32,65,127,128,255][i%7]),copy=Uint8Array.from(win);
    const front=new Uint8Array(64000).fill(99);drawWaterText(front,scene,font9,win,target);
    for(let y=0;y<200;y++)for(let x=0;x<320;x++) {
      let value=99;
      if(y>=47&&y<60&&x<length*8) {
        const i=Math.floor(x/8),code=win[i]>=32&&win[i]<=127?win[i]:32,v=font9[code-32].pixels[(y-47)*8+x%8];
        value=i===target?[15,1,8][v]:v?[0,i<target?12:10,8][v]:scene[y*320+x];
      }
      assert.equal(front[y*320+x],value);
    }
    assert.deepEqual(win,copy);
  }
});

function independentWrites(bytes) {
  if(bytes.readUInt16LE(0)===0 && bytes.readUInt16LE(2)===0)return [];
  let dest=bytes.readUInt16LE(0),p=12;const out=[];
  for(let n=bytes.readUInt16LE(2);n;n--) {
    const control=bytes[p++];
    if(control===128){dest+=bytes.readUInt16LE(p);p+=2;continue;}
    const length=control<128?control+1:257-control;
    if(control<128){out.push({offset:dest,pixels:new Uint8Array(bytes.subarray(p,p+length))});p+=length;}
    else {const value=bytes[p++];if(value)out.push({offset:dest,pixels:new Uint8Array(length).fill(value)});}
    dest+=length;
  }
  assert.equal(p,bytes.length);return out;
}

test('all three complete bonus sequences match fresh BAN commands and ANI records, including dirty restore',()=>{
  const packets=json('assets/render/ban-packets.json');
  for(const char of 'mlp') {
    const name=char.toUpperCase()+'SWM',ban=original(name+'.BAN'),ani=original(name+'.ANI');
    const bg=Uint8Array.from(scene),front=Uint8Array.from(scene),expectedBg=Uint8Array.from(scene),expected=Uint8Array.from(scene);
    let previous=null;
    bindings.animations[char].frames.forEach((f,i)=>{
      const packet=packets[name+'.BAN'][i],writes=independentWrites(ban.subarray(packet.offset,packet.end));
      assert.deepEqual(f.writes.map(w=>({offset:w.offset,pixels:new Uint8Array(Buffer.from(w.pixels,'base64'))})),writes);
      const entry=f.ani,offset=ani.readUInt32LE(i*8+4);
      assert.equal(entry.x,ani.readInt16LE(i*8));assert.equal(entry.y,ani.readInt16LE(i*8+2));assert.equal(entry.rasterOffset,offset);
      const raster={headerWords:[ani.readInt16LE(offset),ani.readInt16LE(offset+2),ani.readUInt16LE(offset+4),ani.readUInt16LE(offset+6)]};
      raster.width=raster.headerWords[2];raster.height=raster.headerWords[3];
      assert.deepEqual(entry.headerWords,raster.headerWords);assert.equal(entry.width,raster.width);assert.equal(entry.height,raster.height);
      const current={sprite:raster,pixels:new Uint8Array(ani.subarray(offset+8,offset+8+raster.width*raster.height)),x:entry.x,y:entry.y};
      assert.deepEqual(Buffer.from(current.pixels),read('assets/render/'+entry.indicesPath));
      for(const w of writes){expected.set(w.pixels,w.offset);expectedBg.set(w.pixels,w.offset);}
      reference(expected,expectedBg,current,previous);
      const returned=drawWaterBonusPacket(front,bg,writes,current,previous);assert.equal(returned,current);
      assert.deepEqual(front,expected);assert.deepEqual(bg,expectedBg);previous=current;
    });
    // The movie edits the original background in DOS; all 56 packets restore it exactly.
    assert.deepEqual(bg,scene);
    restoreWaterScene(front,scene,font9,window(),10);
    const restored=Uint8Array.from(scene);drawWaterText(restored,scene,font9,window(),10);assert.deepEqual(front,restored);
    assert.equal(bindings.playback.tickWaitsPerPacket,2);
    assert.deepEqual(bindings.playback.sound7OneBasedFrames,[...original('MARIO.EXE').subarray(0x21d29,0x21d34)]);
  }
});

test('failure-sunk state survives bonus return: next dirty call restores art without retaining movie pixels',()=>{
  for(let character=1;character<=3;character++) {
    const state={character,swimmer:{x:100,y:190,frame:3,failed:true,failurePhase:2}};
    const front=new Uint8Array(64000).fill(255);restoreWaterScene(front,scene,font9,window(),10);
    const ops=waterActorOperations(resources,state,null),expected=Uint8Array.from(front);
    for(const op of ops)reference(expected,scene,op.current,op.previous);
    drawWaterOperations(front,scene,ops);assert.deepEqual(front,expected);
    assert.equal(ops[0].current.sprite.index,33+character);
  }
});

test('invalid writes/windows fail without accepting invented sizes',()=>{
  const front=blank(),bg=blank();assert.throws(()=>drawWaterBonusPacket(front,bg,[{offset:63999,pixels:new Uint8Array(2)}],null),RangeError);
  assert.deepEqual(front,blank());assert.deepEqual(bg,blank());
  assert.throws(()=>drawWaterText(front,bg,font9,new Uint8Array(39),10),RangeError);
  for(const frame of [-1,6,1.5]) assert.throws(()=>waterActorOperations(resources,{character:1,swimmer:{frame,x:0,y:0}},null),RangeError);
});
