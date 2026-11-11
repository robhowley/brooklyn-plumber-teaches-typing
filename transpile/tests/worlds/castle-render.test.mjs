import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {CASTLE_CLIPS,castleFrame,drawCastleText,beginCastleTransition,stepCastleTransition,
  finishCastleTransition,drawCastleBonusActor,castleBonusBlock,drawCastleBonusPacket,
  drawCastleActors,beginCastleBonus,finishCastleBonus} from '../../app/castle-render.mjs';
import {drawCastleScene,blitSprite,updateSprite} from '../../recovered/render/render.mjs';
const read=(path)=>new Uint8Array(readFileSync(new URL('../../'+path,import.meta.url)));
const json=path=>JSON.parse(Buffer.from(read(path)).toString());
const manifest=json('assets/render/manifest.json'), original=json('assets/original/manifest.json');
const load=s=>({sprite:s,pixels:read('assets/render/'+s.indicesPath)});
const frame=(c,kind,i,x=0,y=0)=>({...load(castleFrame(manifest,c,kind,i)),x,y});
const scenes=manifest.worlds.castle.scenes.map(s=>read('assets/render/'+s.indicesPath));
const base=read('assets/render/'+manifest.worlds.castle.background.indicesPath);
const font9=original.sprites.filter(s=>s.family==='FONT9H').map(s=>read('assets/original/'+s.indicesPath));
const hash=b=>createHash('sha256').update(b).digest('hex');

// Fresh ZIP bytes only. Python does not import or launch an archive member.
const archive=JSON.parse(execFileSync('python3',['-c',`
import zipfile,base64,json,pathlib
z=zipfile.ZipFile(pathlib.Path.home()/'Downloads/Mario_Teaches_Typing_1992.zip')
names=['MARIO.EXE','CASTLE.BGS','CASTLE.GSO','WALKING.GSO','FONT9H.GSO','FONT7H.GSO',
       'MCAS.BAN','LCAS.BAN','PCAS.BAN','MCAS.ANI','LCAS.ANI','PCAS.ANI']
print(json.dumps({n:base64.b64encode(z.read('MarioTea/MARIO/'+n)).decode() for n in names}))
`],{maxBuffer:8*1024*1024}).toString());
const member=n=>Buffer.from(archive[n],'base64');

// Independent test decoder of the understood BGS LZSS format, not machine code.
function unpack(stream) {
  const ring=new Uint8Array(4096).fill(32), out=[]; let cursor=4078,pos=0;
  const emit=v=>{out.push(v);ring[cursor]=v;cursor=(cursor+1)&4095;};
  while(pos<stream.length) {
    const flags=stream[pos++];
    for(let bit=0;bit<8 && pos<stream.length;bit++) {
      if(flags&(1<<bit)) emit(stream[pos++]);
      else {const a=stream[pos++],b=stream[pos++],start=a|((b&240)<<4);
        for(let j=0;j<(b&15)+3;j++) emit(ring[(start+j)&4095]);}
    }
  }
  return Uint8Array.from(out);
}

// Independent rectangle oracle, does not call production compositor helpers.
function rect(a) {const [ox,oy,w,h]=a.sprite.headerWords;return [a.x+((ox<<16)>>16),a.y+((oy<<16)>>16),w,h];}
function expectedUpdate(front,bg,current,previous,clip=CASTLE_CLIPS.full) {
  const region=a=>{if(!a)return null;const [x,y,w,h]=rect(a);const r=[Math.max(x,clip.left),Math.max(y,clip.top),Math.min(x+w-1,clip.right),Math.min(y+h-1,clip.bottom)];return r[0]<=r[2]&&r[1]<=r[3]?r:null;};
  let areas=[region(current),region(previous)].filter(Boolean);
  if(areas.length===2) {const [a,b]=areas;if(a[0]<=b[2]&&b[0]<=a[2]&&a[1]<=b[3]&&b[1]<=a[3])
    areas=[[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])]];}
  for(const [l,t,r,b] of areas) for(let y=t;y<=b;y++) for(let x=l;x<=r;x++) front[y*320+x]=bg[y*320+x];
  if(current) {const [sx,sy,w,h]=rect(current);for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const dx=sx+x,dy=sy+y,v=current.pixels[y*w+x];
    if(v&&dx>=clip.left&&dx<=clip.right&&dy>=clip.top&&dy<=clip.bottom)front[dy*320+dx]=v;
  }}
}

test('fresh source hashes, FONT9H binding and all four independently unpacked BGS scenes',()=>{
  const exe=member('MARIO.EXE');
  assert.equal(hash(exe),'6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e');
  assert.equal(exe.subarray(0x21976,0x2197c).toString(),'font9h');
  assert.equal(exe.subarray(0x12655,0x12658).toString('hex'),'b8a64f');
  assert.equal(exe.subarray(0x9b89,0x9b91).toString('hex'),'8e06445a268a4504');
  for(const offset of [0x45f5,0x4637,0x46b6])assert.equal(exe.subarray(offset,offset+3).toString('hex'),'b80400');
  assert.equal(exe.subarray(0x12701,0x12707).toString('hex'),'c706fa2d0000');
  assert.equal(hash(member('FONT9H.GSO')),'b2f13b6118d901f364713716b6180246572c5cd27cd8c26a2aebddb873c5ea0f');
  const bgs=member('CASTLE.BGS'); let p=0;
  for(let i=0;i<4;i++){const n=bgs.readUInt32LE(p);p+=4;assert.deepEqual(unpack(bgs.subarray(p,p+n)),scenes[i]);p+=n;}
  assert.equal(p,0xbc70);assert.equal(bgs.readUInt32LE(p),0);
  for(const family of ['FONT9H','FONT7H','CASTLE','WALKING']) {
    for(const s of original.sprites.filter(s=>s.family===family)) {
      // GSO pixels start at +8; the trailing word is the checksum.
      assert.deepEqual(read('assets/original/'+s.indicesPath),new Uint8Array(member(family+'.GSO').subarray(s.offset+8,s.end-2)));
    }
  }
});

test('every character frame resolves original family indices, including jump13 and sink5',()=>{
  for(let c=1;c<=3;c++) for(const [kind,count] of [['run',12],['jump',13],['sink',5],['idle',c===3?51:47],['rockface',4],['pipe1',5],['pipe2',5],['bonus',1]]) {
    for(let i=0;i<count;i++){const a=frame(c,kind,i);assert.equal(a.pixels.length,a.sprite.width*a.sprite.height);
      if(a.sprite.family!=='IDLE') assert.deepEqual(a.pixels,new Uint8Array(member(a.sprite.family+'.GSO').subarray(a.sprite.offset+8,a.sprite.end-2)));}
    assert.throws(()=>castleFrame(manifest,c,kind,count),RangeError);
  }
  assert.throws(()=>castleFrame(manifest,0,'run',0),RangeError);
});

test('all scenes and characters preserve outer background, exact text pixels and target/metadata priority',()=>{
  const words=Uint16Array.from({length:40},(_,i)=>65+(i%26));
  words[0]=0;words[1]=0x80|65;words[2]|=0x100;words[3]|=0x300;words[8]|=0x300;words[39]=127;
  for(let c=1;c<=3;c++) for(let scene=0;scene<4;scene++) {
    const bg=base.slice(), front=base.slice();drawCastleScene(bg,scenes[scene]);front.set(bg);
    const player=frame(c,scene===2?'sink':'run',0,20,scene===2?75:92);
    updateSprite(front,bg,player,null,scene===2?CASTLE_CLIPS.sand:CASTLE_CLIPS.full);
    const before=front.slice();drawCastleText(front,bg,words,font9);
    for(let i=0;i<64000;i++) {
      const y=Math.floor(i/320),x=i%320;
      if(y<7||y>19){assert.equal(front[i],before[i]);continue;}
      const cell=Math.floor(x/8),code=Math.max(32,words[cell]&127);
      const ink=cell===8?1:words[cell]&0x200?15:words[cell]&0x100?14:10;
      assert.equal(front[i],font9[code-32][(y-7)*8+x%8]?ink:bg[i]);
    }
    assert.deepEqual(bg.subarray(0,26*320),base.subarray(0,26*320));
    assert.deepEqual(bg.subarray(155*320),base.subarray(155*320));
    const p=manifest.worlds.castle.palettes[['m','l','p'][c-1]].rgb6;
    assert.equal(p.length,256);
  }
  const bg=Uint8Array.from({length:64000},(_,i)=>i%251),front=bg.slice();
  drawCastleText(front,bg,new Uint16Array(40),font9);
  assert.equal(front[7*320],bg[7*320]);
  const before=front.slice();assert.throws(()=>drawCastleText(front,bg,words,[]));assert.deepEqual(front,before);
});

test('inclusive clip edges, erasure and top-only bonus replacement leave caller clip unchanged',()=>{
  const s={headerWords:[0,0,3,3],width:3,height:3},pixels=new Uint8Array(9).fill(255);
  for(const clip of Object.values(CASTLE_CLIPS)) for(const [x,y] of [[clip.left-1,clip.top-1],[clip.right-1,clip.bottom-1]]) {
    const bg=new Uint8Array(64000).fill(2),front=new Uint8Array(64000).fill(9),expected=front.slice();
    const a={sprite:s,pixels,x,y};expectedUpdate(expected,bg,a,null,clip);updateSprite(front,bg,a,null,clip);
    assert.deepEqual(front,expected);expectedUpdate(expected,bg,null,a,clip);updateSprite(front,bg,null,a,clip);assert.deepEqual(front,expected);
  }
  for(const sceneType of [0,1]) {
    const clip={left:0,top:80,right:319,bottom:91},saved={...clip},top=sceneType?37:69;
    const a={sprite:s,pixels,x:10,y:top-1},bg=new Uint8Array(64000).fill(2),front=bg.slice();
    drawCastleBonusActor(front,bg,a,null,sceneType,clip);
    assert.equal(front[top*320+10],255);assert.equal(front[(top-1)*320+10],2);assert.deepEqual(clip,saved);
    // State3 erasure uses restored caller clip, not the temporary top.
    drawCastleBonusActor(front,bg,null,a,sceneType,clip);assert.equal(front[top*320+10],255);
  }
});

test('source layering changes between active and failure, for all three characters',()=>{
  for(let c=1;c<=3;c++) for(const sceneType of [0,1]) for(const failure of [false,true]) {
    const bg=base.slice();drawCastleScene(bg,scenes[sceneType===0?0:2]);
    const front=bg.slice(),expected=bg.slice(),clip=sceneType===0?CASTLE_CLIPS.full:CASTLE_CLIPS.sand;
    const rockfaces=[{current:frame(c,'rockface',2,60,70),previous:null},null,{current:frame(c,'rockface',3,70,80),previous:null}];
    const player={current:frame(c,sceneType?'sink':'idle',0,65,70),previous:null};
    const bonus={current:frame(c,'bonus',0,70,70),previous:null};
    const drawP=()=>expectedUpdate(expected,bg,player.current,null,clip);
    const drawR=()=>{if(!sceneType)for(const r of rockfaces)if(r)expectedUpdate(expected,bg,r.current,null,clip);};
    if(failure)drawP();else drawR();expectedUpdate(expected,bg,bonus.current,null,{...clip,top:sceneType?37:69});
    if(failure)drawR();else drawP();
    drawCastleActors(front,bg,{sceneType,failure,rockfaces,player,bonus},clip);assert.deepEqual(front,expected);
  }
});

test('all 40 transition strips restore aligned unions from scratch, every scene and character',()=>{
  for(let c=1;c<=3;c++) for(let next=0;next<4;next++) {
    const y=next<2?92:36,bg=base.slice();drawCastleScene(bg,scenes[(next+3)%4]);
    const old=bg.slice(),front=bg.slice(),expected=front.slice();
    let previous=frame(c,'idle',0,279,y);blitSprite(front,previous.sprite,previous.pixels,previous.x,previous.y);
    expectedUpdate(expected,bg,previous,null);
    const t=beginCastleTransition(bg,scenes[next],y);
    for(let row=y;row<y+50;row++) {
      assert.deepEqual(bg.subarray(row*320,row*320+64),old.subarray(row*320+256,row*320+320));
      assert.deepEqual(bg.subarray(row*320+64,row*320+128),scenes[next].subarray((row-26)*320,(row-26)*320+64));
    }
    for(let step=0;step<40;step++) {
      const current={...previous,x:previous.x-7+(step&1)};
      for(let row=26;row<=154;row++) {const prior=expected.slice(row*320,row*320+320);
        for(let x=0;x<320;x++)expected[row*320+x]=x<312?prior[x+8]:scenes[next][(row-26)*320+step*8+x-312];}
      const [ax,ay,aw,ah]=rect(current),[bx,by,bw,bh]=rect({...previous,x:previous.x-8});
      const left=Math.max(0,Math.floor(Math.min(ax,bx)/4)*4),right=Math.min(319,Math.floor(Math.max(ax+aw-1,bx+bw-1)/4)*4+3);
      const top=Math.max(0,Math.min(ay,by)),bottom=Math.min(199,Math.max(ay+ah-1,by+bh-1));
      for(let row=top;row<=bottom;row++)for(let x=left;x<=right;x++)expected[row*320+x]=bg[row*320+x-256+(step+1)*8];
      // overlay only, independent of production helper
      for(let row=0;row<ah;row++)for(let x=0;x<aw;x++){const value=current.pixels[row*aw+x];if(value)expected[(ay+row)*320+ax+x]=value;}
      stepCastleTransition(front,bg,t,current,previous);assert.deepEqual(front,expected,`c${c} scene${next} step${step}`);previous=current;
    }
    assert.equal(previous.x,19);assert.equal(t.backgroundOffset,64);
    front.fill(231,155*320);finishCastleTransition(front,bg,t);
    assert.deepEqual(front.subarray(26*320,155*320),scenes[next]);assert.ok(front.subarray(155*320).every(v=>v===231));
    assert.throws(()=>stepCastleTransition(front,bg,t,previous,previous));
  }
});

test('fast and interrupted transition finalize destination without redrawing player or bottom HUD',()=>{
  for(const count of [0,1,19,39]) {
    const bg=base.slice(),front=bg.slice(),t=beginCastleTransition(bg,scenes[2],36);
    let previous=frame(1,'idle',0,279,36);
    for(let i=0;i<count;i++){const current={...previous,x:previous.x-7+(i&1)};stepCastleTransition(front,bg,t,current,previous);previous=current;}
    front.fill(99,155*320);finishCastleTransition(front,bg,t);
    assert.deepEqual(front.subarray(0,155*320),bg.subarray(0,155*320));assert.equal(front[63999],99);
  }
  const bg=base.slice(),front=bg.slice(),t=beginCastleTransition(bg,scenes[0],92),before=front.slice();
  const a=frame(1,'idle',0,279,92);assert.throws(()=>stepCastleTransition(front,bg,t,{...a,pixels:[]},a));
  assert.deepEqual(front,before);assert.equal(t.step,0);
});

test('bonus glyph callee ignores origins, maps nonzero 1/2 to10/1 and clips to block',()=>{
  const block=frame(1,'bonus',0),g=original.sprites.find(s=>s.family==='FONT7H'&&s.name==='font7_63');
  const glyph={sprite:{...g,headerWords:[100,100,g.width,g.height]},pixels:read('assets/original/'+g.indicesPath)};
  const result=castleBonusBlock(block,glyph),expected=block.pixels.slice();
  for(let y=0;y<g.height;y++)for(let x=0;x<g.width;x++){const v=glyph.pixels[y*g.width+x];if(v)expected[(y+7)*block.sprite.width+x+8]=v===1?10:1;}
  assert.deepEqual(result.pixels,expected);assert.notEqual(result.pixels,block.pixels);
});

// Test-only BAN write extraction. Production reuses existing decoder via the proposed runs schema.
function packets(bytes) {
  let p=0;const out=[];
  while(bytes.readUInt16LE(p)!==65535){let dest=bytes.readUInt16LE(p),count=bytes.readUInt16LE(p+2);const runs=[];
    p+=dest===0&&count===0?4:12;
    for(let j=0;j<count;j++){const code=bytes[p++];if(code===128){dest+=bytes.readUInt16LE(p);p+=2;continue;}
      const length=code<128?code+1:257-code;
      const pixels=code<128?new Uint8Array(bytes.subarray(p,p+length)):new Uint8Array(length).fill(bytes[p]);
      p+=code<128?length:1;if(code<128||pixels[0])runs.push({offset:dest,pixels});dest+=length;
    }out.push(runs);
  }return out;
}
test('all stages, pipes and sink frames use dirty erasure rather than scene redraw',()=>{
  for(let c=1;c<=3;c++) for(const [kind,count,scene,clip] of [
    ['rockface',4,0,CASTLE_CLIPS.full],['pipe1',5,1,CASTLE_CLIPS.full],
    ['sink',5,2,CASTLE_CLIPS.sand],['pipe2',5,3,CASTLE_CLIPS.full]]) {
    const bg=base.slice();drawCastleScene(bg,scenes[scene]);const front=bg.slice(),expected=bg.slice();
    // An unrelated drawing must survive outside dirty rectangles.
    front[199*320]=expected[199*320]=255;let previous=null;
    for(let i=0;i<count;i++) {
      const current=frame(c,kind,i,40,kind==='sink'?90+i:40+i);
      updateSprite(front,bg,current,previous,clip);expectedUpdate(expected,bg,current,previous,clip);
      assert.deepEqual(front,expected);previous=current;
    }
    updateSprite(front,bg,null,previous,clip);expectedUpdate(expected,bg,null,previous,clip);assert.deepEqual(front,expected);
  }
});

test('bonus entry/return restore sand only, preserve postmovie background and remove ANI',()=>{
  for(const type of [0,1]) {
    const bg=base.slice();drawCastleScene(bg,scenes[type?2:0]);const front=bg.slice();
    beginCastleBonus(front,bg,type,scenes[0]);assert.deepEqual(front.subarray(26*320,155*320),scenes[0]);
    bg[0]=191;bg[50*320]=192;front.fill(255);
    finishCastleBonus(front,bg,type,scenes[2]);assert.deepEqual(front,bg);assert.equal(front[0],191);
    assert.equal(front[50*320],type?scenes[2][24*320]:192);
  }
  const bg=new Uint8Array(64000).fill(5),front=new Uint8Array(64000).fill(9);
  drawCastleBonusPacket(front,bg,[{offset:0,pixels:Uint8Array.of(5,0)}],null,null);
  assert.deepEqual([...front.slice(0,3)],[5,0,9]); // Equal-to-background writes still erase foreground.
  const before=front.slice();assert.throws(()=>drawCastleBonusPacket(front,bg,[{offset:0,pixels:Uint8Array.of(7)},{offset:64000,pixels:Uint8Array.of(1)}],null,null));
  assert.deepEqual(front,before);
});

test('all three Castle BAN/ANI movies preserve persistent writes and previous-sprite restoration',()=>{
  const tables=json('assets/render/ani-tables.json');
  for(const prefix of ['M','L','P']) {
    const runs=packets(member(prefix+'CAS.BAN')),entries=tables[prefix+'CAS.ANI'];
    assert.equal(runs.length,entries.length);
    const bg=base.slice(),front=base.slice(),expected=base.slice(),expectedBg=base.slice();
    drawCastleScene(bg,scenes[0]);front.set(bg);expected.set(bg);expectedBg.set(bg);
    let previous=null;
    for(let i=0;i<runs.length;i++) {
      const entry=entries[i],a={...load(entry),x:entry.x,y:entry.y},ani=member(prefix+'CAS.ANI');
      assert.equal(entry.x,ani.readInt16LE(i*8));assert.equal(entry.y,ani.readInt16LE(i*8+2));
      assert.equal(entry.rasterOffset,ani.readUInt32LE(i*8+4));
      assert.deepEqual(entry.headerWords,[ani.readInt16LE(entry.rasterOffset),ani.readInt16LE(entry.rasterOffset+2),
        ani.readUInt16LE(entry.rasterOffset+4),ani.readUInt16LE(entry.rasterOffset+6)]);
      assert.deepEqual(a.pixels,new Uint8Array(ani.subarray(entry.rasterOffset+8,entry.rasterOffset+8+entry.width*entry.height)));
      for(const run of runs[i])for(let j=0;j<run.pixels.length;j++){expected[run.offset+j]=run.pixels[j];expectedBg[run.offset+j]=run.pixels[j];}
      expectedUpdate(expected,expectedBg,a,previous);
      drawCastleBonusPacket(front,bg,runs[i],a,previous);assert.deepEqual(front,expected);assert.deepEqual(bg,expectedBg);previous=a;
    }
  }
});
