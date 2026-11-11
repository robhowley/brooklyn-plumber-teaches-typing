import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spriteRect,clipRect,blitSprite,updateSprite,drawGround,outdoorPalette,characterFrame,aniEntry} from '../../recovered/render/render.mjs';
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

test('ANI coordinates signed and zero raster sentinel',()=>{
 const bytes=new Uint8Array(16),view=new DataView(bytes.buffer);
 view.setInt16(0,-35,true);view.setInt16(2,90,true);view.setUint32(4,448,true);
 assert.deepEqual(aniEntry(bytes,0),{x:-35,y:90,rasterOffset:448,terminal:false});
 assert.equal(aniEntry(bytes,1).terminal,true);
 assert.throws(()=>aniEntry(bytes,2),RangeError);
});
