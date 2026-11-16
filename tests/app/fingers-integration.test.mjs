import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Renderer} from '../../app/render.mjs';
import {Session,editStudent} from '../../app/session.mjs';
import {newStudent} from '../../recovered/control/student.mjs';
import {makeObstacle,selectTarget} from '../../recovered/outdoor/outdoor.mjs';
import {skipStartup} from './source-path.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../../app/data.json',import.meta.url)));
const originals=JSON.parse(fs.readFileSync(new URL('../../assets/original/manifest.json',import.meta.url))).sprites.filter(s=>s.family==='FINGER');
const exe=fs.readFileSync(new URL('../../assets/original/raw/MarioTea/MARIO/MARIO.EXE.data',import.meta.url));
async function renderer() {
 const r=new Renderer({getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(256000)}),putImageData(){}})},data);
 const before=globalThis.fetch;
 globalThis.fetch=async path=>({ok:true,arrayBuffer:async()=>{const b=fs.readFileSync(new URL('../../'+path.replace(/^\.\//,''),import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}});
 try {await r.load();}finally{globalThis.fetch=before;}return r;
}
function session(mode,character=1,demo=false) {
 const s=skipStartup(new Session(data,{bytes:editStudent(newStudent('Hands'),{character,goal:10}),seed:1}));
 if(demo)s.selectDemo();s.start(0,mode,100);return s;
}
function paint(r,s) {
 if(s.mode===1)r.outdoor(s.outdoor,s.stats(),s.bonus);
 else if(s.mode===4)r.practice(s.practice,s.stats(),0,s.typed);
 else if(s.mode===2)r.water(s.takeEffects(),s.water);
 else r.castle(s.takeEffects(),s.castle);
}
function pixels(r,mode,code=null) {
 const [x,y,gap]=[[90,158,90],[100,3,70],[100,158,70],[30,45,230]][mode-1];
 const bg=mode===1?r.backgrounds.OUTSIDE:mode===2?r.backgrounds.WATER:mode===3?r.castleBackground:r.backgrounds.PRACTICE;
 const expected=bg.slice();
 const stamp=(index,dx,dy)=>{
  const sprite=originals.find(s=>s.index===index);
  const raw=fs.readFileSync(new URL('../../assets/original/'+sprite.indicesPath,import.meta.url));
  for(let j=0;j<sprite.height;j++)for(let i=0;i<sprite.width;i++)expected[(dy+j)*320+dx+i]=raw[j*sprite.width+i]||bg[(dy+j)*320+dx+i];
 };
 stamp(10,x,y);stamp(11,x+gap,y);
 if(code>=32&&code<127) {
  let index=exe[0x2258c+code-32];if(index>=40)index-=40;
  const right=index>=6;if(right)index--;
  stamp(index,x+(right?gap:0)+exe.readInt16LE(0x21df6+index*2),y+exe.readInt16LE(0x21e0a+index*2));
 }
 const palette=data.palettes[r.palette];let compared=0;
 for(const dx of [x,x+gap])for(let j=0;j<41;j++)for(let i=0;i<38;i++) {
  const pos=(y+j)*320+dx+i;
  assert.equal(r.front[pos],expected[pos],`mode ${mode} code ${code} pixel ${pos}`);
  assert.deepEqual(Array.from(r.image.data.subarray(pos*4,pos*4+4)),[...palette.slice(expected[pos]*3,expected[pos]*3+3),255]);compared++;
 }
 assert.equal(compared,3116);
}

test('Practice base, exact target, wrong/repeated/ignored keys, controls and reentry render real palette pixels',async()=>{
 const r=await renderer();
 for(const character of [1,2,3]) {
  const s=session(4,character);paint(r,s);pixels(r,4,s.practice.rows[33+s.practice.index]);
  for(const key of [9,127,s.practice.rows[33+s.practice.index]^32]) {s.step(key,1,100);paint(r,s);pixels(r,4,s.practice.rows[33+s.practice.index]);}
  const repeated=s.practice.rows[33+s.practice.index];s.practice.rows[34+s.practice.index]=repeated;
  s.step(repeated,2,100);assert.equal(s.practice.rows[33+s.practice.index],repeated);paint(r,s);pixels(r,4,repeated);
  s.practice.rows[33+s.practice.index]=13;paint(r,s);pixels(r,4,13);
  s.start(3,4,100);paint(r,s);pixels(r,4,s.practice.rows[33+s.practice.index]);
 }
});

test('Outside snapshots guidance before correct input, retains wrong/repeated targets, clears and resets on bonus/reentry',async()=>{
 const r=await renderer(),s=session(1);paint(r,s);pixels(r,1);
 s.outdoor.obstacles[0]={...makeObstacle(65,0),x:210};
 s.outdoor.obstacles[1]={...makeObstacle(65,0),x:293};
 s.step(65,1,100);assert.equal(s.outdoor.obstacles[0].code,0);paint(r,s);pixels(r,1,65);
 s.step(0,2,100);assert.equal(s.outdoor.fingerCode,65);paint(r,s);pixels(r,1,65);
 s.outdoor.obstacles[1].code=66;selectTarget(s.outdoor);paint(r,s);pixels(r,1,66);
 for(const key of [9,90,0]) {s.step(key,++s.sampleTicks,100);paint(r,s);pixels(r,1,s.outdoor.fingerCode);}
 // Direct selection owns the pre-input snapshot even when no target exists.
 s.outdoor.obstacles.forEach(o=>o.active=false);selectTarget(s.outdoor);paint(r,s);pixels(r,1);
 s.outdoor.obstacles[0]={...makeObstacle(65,0),x:260};
 s.bonus.mode=2;s.bonus.code=33;s.bonus.countdown=30;s.step(33,10,100);
 for(let t=12;s.cinematic&&t<500;t+=2)s.step(0,t,101);
 assert.equal(s.cinematic,null);paint(r,s);pixels(r,1);
 s.step(0,501,101);paint(r,s);pixels(r,1,s.outdoor.fingerCode);
 s.start(502,1,101);paint(r,s);pixels(r,1);
});

test('Water consumes source prompt order, wrong/ignored keys retain pixels, bonus returns neutral until next shift',async()=>{
 const r=await renderer(),s=session(2);paint(r,s);pixels(r,2,s.water.window[s.water.targetIndex]);
 for(const key of [9,s.water.window[10]^32,0]) {s.step(key,++s.sampleTicks,100);paint(r,s);pixels(r,2,s.water.window[10]);}
 const repeated=s.water.window[10];s.water.window[11]=repeated;
 s.step(repeated,++s.sampleTicks,100);assert.equal(s.water.window[10],repeated);paint(r,s);pixels(r,2,repeated);
 for(let i=0;i<3;i++){s.step(s.water.window[10],++s.sampleTicks,100);paint(r,s);pixels(r,2,s.water.window[10]);}
 s.water.bonus.mode=2;s.water.bonus.x=50;s.water.bonus.y=120;s.step(s.water.bonus.code,10,100);paint(r,s);
 for(let t=11;s.waterMovie&&t<500;t++){s.step(0,t,101);paint(r,s);}
 assert.equal(s.waterMovie,null);pixels(r,2);
 s.step(0,501,101);paint(r,s);pixels(r,2);
 s.step(s.water.window[10],502,101);paint(r,s);pixels(r,2,s.water.window[10]);
 s.start(503,2,101);paint(r,s);pixels(r,2,s.water.window[10]);
});

test('Castle compares pre-input target on operations2/3, does not rehighlight unchanged target after bonus, resets scene target comparison',async()=>{
 const r=await renderer(),s=session(3);paint(r,s);pixels(r,3);
 const c=s.castle;c.readyPending=false;c.nowTicks=1;c.nowSeconds=100;c.effects=[];
 const op=(n,key=0)=>{s.input.flush();s.enqueue(key);c.effects=[];c.operation(n,s.input);r.castle(c.effects,c);};
 const first=c.queue.target;op(2,first);pixels(r,3,first);
 assert.notEqual(c.queue.target,first);op(3);pixels(r,3,c.queue.target);
 op(2,9);pixels(r,3,c.queue.target);op(2,c.queue.target^32);pixels(r,3,c.queue.target);
 c.bonus.mode=2;c.bonus.code=33;op(2,33);assert.equal(c.awaitingBonus,true);
 r.castle(c.resumeBonus({nowTicks:2,nowSeconds:101,input:s.input}),c);pixels(r,3);
 op(3);pixels(r,3);op(2,c.queue.target);pixels(r,3);op(3);pixels(r,3,c.queue.target);
 const beforeInit=c.queue.target;op(1);pixels(r,3,beforeInit);op(3);pixels(r,3,c.queue.target);
 s.start(4,3,101);paint(r,s);pixels(r,3);
});

test('Demo renders source-selected guidance in all four activities',async()=>{
 const r=await renderer();
 for(const mode of [1,2,3,4]) {
  const s=session(mode,1,true);paint(r,s);
  for(let t=1;t<20;t++){s.step(0,t,100);paint(r,s);}
  const code=mode===1?s.outdoor.fingerCode:mode===2?s.water.lastPrompt:mode===3?s.castle.lastFinger:s.practice.rows[33+s.practice.index];
  pixels(r,mode,code);
 }
});
