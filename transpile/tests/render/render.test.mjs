import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spriteRect,clipRect,blitSprite,updateSprite,drawGround,outdoorPalette,characterFrame,aniEntry,drawCastleScene,scrollCastleStrip,worldPalette} from '../../recovered/render/render.mjs';
const manifest=JSON.parse(readFileSync(new URL('../../assets/render/manifest.json',import.meta.url)));

test('origins add, signed words, inclusive clipping and transparent zero',()=>{
 const sprite={headerWords:[3,8,2,2],width:2,height:2};
 assert.deepEqual(spriteRect(sprite,-4,-9),{left:-1,top:-1,right:0,bottom:0});
 assert.deepEqual(clipRect(spriteRect(sprite,-4,-9)),{left:0,top:0,right:0,bottom:0});
 assert.equal(clipRect({left:320,right:321,top:0,bottom:1}),null);
 assert.equal(spriteRect({...sprite,headerWords:[65535,0,2,2]},0,0).left,-1);
 const screen=new Uint8Array(64000).fill(17);
 blitSprite(screen,sprite,Uint8Array.of(1,2,3,255),-4,-9);
 assert.equal(screen[0],255);assert.equal(screen[1],17);
 blitSprite(screen,sprite,Uint8Array.of(1,2,3,0),-4,-9);
 assert.equal(screen[0],255);
});

test('dirty updates restore background, overlapping bounding union and removals',()=>{
 const sprite={headerWords:[0,0,2,2],width:2,height:2};
 const bg=new Uint8Array(64000).fill(5),front=new Uint8Array(64000).fill(77);
 const current={sprite,pixels:Uint8Array.of(0,8,9,10),x:1,y:1};
 updateSprite(front,bg,current,{sprite,x:0,y:0});
 assert.equal(front[2],5); // bounding union corner outside both sprite rectangles
 assert.equal(front[321],5); // current transparent pixel uses background, not old sprite
 assert.equal(front[322],8);assert.equal(front[3],77);
 updateSprite(front,bg,null,current);
 assert.equal(front[322],5);
});

test('all 20 ground phases preserve rows outside 140..155',()=>{
 const tile=Uint8Array.from({length:320},(_,i)=>i%251);
 for(let phase=0;phase<20;phase++) {
  const screen=new Uint8Array(64000).fill(255);drawGround(screen,tile,phase);
  for(let y=0;y<16;y++) for(let x=0;x<320;x++) assert.equal(screen[(140+y)*320+x],tile[y*20+(x+phase)%20]);
  assert.equal(screen[139*320+319],255);assert.equal(screen[156*320],255);
 }
 assert.throws(()=>drawGround(new Uint8Array(64000),tile,-1),RangeError);
});

test('palette changes exactly character 32..47 and turtle 48..63',()=>{
 const a=new Uint8Array(768).fill(1),b=new Uint8Array(768).fill(2),c=new Uint8Array(768).fill(3);
 const p=outdoorPalette(a,b,c);
 for(let i=0;i<768;i++) assert.equal(p[i],i>=96&&i<144?2:i>=144&&i<192?3:1);
 assert.equal(a[96],1);
});

test('all selected run/jump/idle names resolve to actual GSK/GCK indices',()=>{
 for(const [character,prefix] of [[1,'m'],[2,'l'],[3,'p']]) {
  for(const kind of ['run','jump']) for(let i=0;i<12;i++) {
   const binding=characterFrame(character,kind,i);
   assert.ok(manifest.spriteBindings.some(s=>s.family===binding.family&&s.name===binding.name));
  }
  const thresholds=manifest.idleSchedules[prefix].thresholds;
  for(let i=0;i<thresholds.length;i++) {
   const binding=characterFrame(character,'idle',i,thresholds);
   assert.ok(manifest.sprites.some(s=>s.name===binding.name));
  }
 }
 assert.throws(()=>characterFrame(1,'run',-1),RangeError);
 assert.throws(()=>characterFrame(1,'jump',12),RangeError);
});

test('all recovered Castle clips include their last pixel and exclude adjacent pixels',()=>{
 const sprite={headerWords:[0,0,3,3],width:3,height:3},pixels=new Uint8Array(9).fill(9);
 const clips=manifest.worlds.castle.clipChanges.map(e=>e.clip);
 clips.push({left:0,top:69,right:319,bottom:199},{left:0,top:37,right:319,bottom:199});
 for(const clip of clips) for(const [x,y] of [[clip.left-1,clip.top-1],[clip.right-1,clip.bottom-1]]) {
  const front=new Uint8Array(64000).fill(7),bg=new Uint8Array(64000).fill(3);
  blitSprite(front,sprite,pixels,x,y,clip);
  for(let dy=0;dy<200;dy++) for(let dx=0;dx<320;dx++) {
   const inside=dx>=x&&dx<=x+2&&dy>=y&&dy<=y+2&&dx>=clip.left&&dx<=clip.right&&dy>=clip.top&&dy<=clip.bottom;
   assert.equal(front[dy*320+dx],inside?9:7);
  }
  updateSprite(front,bg,null,{sprite,x,y},clip);
  assert.equal(front[Math.max(y,clip.top)*320+Math.max(x,clip.left)],3);
 }
 const front=new Uint8Array(64000).fill(7);
 for(const clip of [{left:-1,top:0,right:319,bottom:199},{left:0,top:0,right:320,bottom:199},
                   {left:0,top:-1,right:319,bottom:199},{left:0,top:0,right:319,bottom:200}])
  assert.throws(()=>blitSprite(front,sprite,pixels,0,0,clip),RangeError);
 assert.throws(()=>blitSprite(front,sprite,pixels.subarray(1),500,500),RangeError);
 assert.throws(()=>updateSprite(front,new Uint8Array(64000),{sprite,pixels:pixels.subarray(1),x:0,y:0},null),RangeError);
 assert.ok(front.every(v=>v===7)); // invalid current raster must not erase first
});

test('BGS opaque row placement and forty exact eight-pixel visible strips',()=>{
 const scenes=manifest.worlds.castle.scenes.map(s=>new Uint8Array(readFileSync(new URL('../../assets/render/'+s.indicesPath,import.meta.url))));
 for(const pixels of scenes) {
  const front=new Uint8Array(64000).fill(255);
  drawCastleScene(front,pixels);
  assert.deepEqual(front.subarray(26*320,155*320),pixels);
  assert.ok(front.subarray(0,26*320).every(v=>v===255));
  assert.ok(front.subarray(155*320).every(v=>v===255));
 }
 const front=new Uint8Array(64000).fill(255);drawCastleScene(front,scenes[0]);
 for(let step=0;step<40;step++) {
  scrollCastleStrip(front,scenes[1],step);
  const n=(step+1)*8;
  for(let y=0;y<129;y++) {
   assert.deepEqual(front.subarray((y+26)*320,(y+26)*320+320-n),scenes[0].subarray(y*320+n,(y+1)*320));
   assert.deepEqual(front.subarray((y+26)*320+320-n,(y+27)*320),scenes[1].subarray(y*320,y*320+n));
  }
 }
 assert.ok(front.subarray(0,26*320).every(v=>v===255));
 assert.ok(front.subarray(155*320).every(v=>v===255));
 const zero=new Uint8Array(41280);drawCastleScene(front,zero);assert.equal(front[26*320],0);
 for(const n of [-1,40,0.5]) assert.throws(()=>scrollCastleStrip(front,scenes[0],n),RangeError);
 assert.throws(()=>drawCastleScene(front,zero.subarray(1)),RangeError);
});

test('Water/Castle palettes replace only character slots, without outdoor turtle splice',()=>{
 const base=new Uint8Array(768).fill(7),character=new Uint8Array(768).fill(9);
 const result=worldPalette(base,character);
 for(let i=0;i<768;i++) assert.equal(result[i],i>=96&&i<144?9:7);
 assert.equal(base[96],7);
 assert.throws(()=>worldPalette(base.subarray(1),character),RangeError);
 for(const world of ['water','castle']) for(const char of 'mlp') {
  const p=manifest.worlds[world].palettes[char];assert.deepEqual(p.replacedSlots,[32,47]);
 }
});

test('world frame maps resolve original indices and per-character names',()=>{
 const find=(family,index)=>manifest.sprites.find(s=>s.family===family&&s.index===index);
 for(const char of 'mlp') {
  const water=manifest.worlds.water.frames,castle=manifest.worlds.castle.frames;
  water.swim[char].forEach((index,i)=>assert.equal(find('WATER',index).name,`${char}swm000${i+1}_1`));
  assert.equal(find('WATER',water.sunk[char]).name,`sunk_${char}swm`);
  castle.sink[char].forEach((index,i)=>assert.equal(find('WALKING',index).name,`${char}sin000${i+1}_1`));
  castle.failureIdle[char].forEach(index=>assert.ok(find('IDLE',index).name.startsWith(char+'std')));
  assert.equal(castle.jump[char].length,13); // includes 0020, unlike Outside's twelve selected jumps
 }
 assert.equal(find('WATER',manifest.worlds.water.frames.bonus).name,'bonbub_1');
 assert.equal(find('CASTLE',manifest.worlds.castle.frames.bonus).name,'brick1_cblock');
});

test('dirty compositing is call-ordered, not retained alpha layering',()=>{
 const sprite={headerWords:[0,0,2,2],width:2,height:2},bg=new Uint8Array(64000).fill(5),front=bg.slice();
 const a={sprite,pixels:new Uint8Array(4).fill(8),x:0,y:0};
 const b={sprite,pixels:new Uint8Array(4).fill(9),x:1,y:0};
 updateSprite(front,bg,a,null);updateSprite(front,bg,b,null);
 assert.equal(front[1],9);
 updateSprite(front,bg,null,a);assert.equal(front[1],5);assert.equal(front[2],9);
});

test('ANI coordinates signed and zero raster sentinel',()=>{
 const bytes=new Uint8Array(16),view=new DataView(bytes.buffer);
 view.setInt16(0,-35,true);view.setInt16(2,90,true);view.setUint32(4,448,true);
 assert.deepEqual(aniEntry(bytes,0),{x:-35,y:90,rasterOffset:448,terminal:false});
 assert.equal(aniEntry(bytes,1).terminal,true);
 assert.throws(()=>aniEntry(bytes,2),RangeError);
});
