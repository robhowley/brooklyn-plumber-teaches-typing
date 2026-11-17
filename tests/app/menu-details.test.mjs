import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Renderer} from '../../app/render.mjs';
import {Session} from '../../app/session.mjs';
import {newStudent} from '../../recovered/control/student.mjs';
import {createMenu,createStudentChooser} from '../../recovered/control/menu.mjs';
import {skipStartup} from './source-path.mjs';
const json=path=>JSON.parse(readFileSync(new URL('../../'+path,import.meta.url)));
const data=json('app/data.json');
const evidence=json('.tmp/menu/evidence.json');
const slice=(name,offset,length)=>{
 const s=evidence.slices[name];return Buffer.from(s.hex,'hex').subarray(offset-s.start,offset-s.start+length).toString('hex');
};

test('menu details pin source bytes, font mappings and GREET2 resource indices',()=>{
 assert.equal(evidence.exeSha256,'6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e');
 assert.deepEqual(Object.fromEntries(['ENGLISH.MSD','FONT5H.GSO','FONT5H.GSK','GREET2.GSO','GREET2.GSK'].map(n=>[n,evidence.members[n]])),{
  'ENGLISH.MSD':'fd2168878e19b1b85ae0c6ce8e14ad4386a801e7c460ed134bde5f181cb29e15',
  'FONT5H.GSO':'aa9b883273bf0997b4e128c4a72eb7028c534656d1c284948cf51cae74968464',
  'FONT5H.GSK':'583e44cc746eea226175ae3810d69f185c951236d206cb91d824558672837598',
  'GREET2.GSO':'2cae0e3a843eb1efad570ec51f9e8ce64d5b174b3c9ce2b7f746419df9784e21',
  'GREET2.GSK':'57aff92c9e1d58b6a626bb68f5dce90df49f84a05aca2fc5ab1e63a54368ebc7',
 });
 assert.equal(slice('student',0xf7b5,5),'c6060d2e04'); // foreground 4
 assert.equal(slice('student',0xf7bf,15),'c706ab587000c706a9586000b8c409'); // x112 y96 MSD2500
 assert.deepEqual(json('analysis/control/messages.json').resources[2500],{fileOffset:'0x6c2',text:'No Students!'});
 assert.equal(data.messages[2500],'No Students!');
 assert.equal(slice('greeting',0x10a04,10),'c6060c2e58c6060d2e37'); // slot0=88, slot1=55
 assert.equal(slice('font-init',0x1ac80,5),'c6060e2e08'); // slot2=8
 assert.equal(slice('menu',0x11169,28),'833e7752327c23833e77524b7f1c833e75522f7c15833e7552427f0e');
 assert.equal(slice('menu',0x11185,14),'c6063c4801c6063b48010ee894fa');
 const sprites=json('assets/startup/manifest.json').sprites.GREET2;
 for(const [index,name,offset,end] of [[4,'eyes0044_halfway',0x2598,0x27aa],[3,'eyes0043_closed',0x2386,0x2598],[2,'eyes0042_open',0x2174,0x2386]]) {
  assert.equal(sprites[index].name,name);assert.equal(sprites[index].width,26);assert.equal(sprites[index].height,20);
  assert.equal(sprites[index].offset,offset);assert.equal(sprites[index].end,end);
 }
});

test('indexed menu text uses foreground55 for guest/profile and transparent No Students foreground4',async()=>{
 const r=new Renderer({getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(256000)}),putImageData(){}})},data);
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async path=>({ok:true,arrayBuffer:async()=>{
  const b=readFileSync(new URL('../../'+path.slice(2),import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
 }});
 try {await r.load();}finally{globalThis.fetch=oldFetch;}
 function check(value,x,y,color,background) {
  for(const [i,ch] of [...value].entries()) {
   const g=data.sprites[`FONT5H/font5_${ch.charCodeAt(0)}`],raw=Buffer.from(g.pixels,'base64');
   for(let dy=0;dy<g.height;dy++)for(let dx=0;dx<g.width;dx++) {
    const v=raw[dy*g.width+dx],p=(y+dy)*320+x+i*8+dx;
    assert.ok(v===0||v===1);assert.equal(r.front[p],v?color:background[p],`${value}:${i}/${dx}/${dy}`);
   }
  }
 }
 for(const bytes of [null,newStudent('ADA')]) {
  const s=skipStartup(new Session(data,{bytes,seed:1}));r.menu(s.profile,createMenu());
  if(bytes) {check(data.messages[1150],144,34,55,r.backgrounds.MAINMENU);check('ADA!',152,49,55,r.backgrounds.MAINMENU);}
  else for(let i=0;i<5;i++)check(data.messages[1250+i],136,24+i*10,55,r.backgrounds.MAINMENU);
 }
 r.chooser(createStudentChooser([],0));check(data.messages[2500],112,96,4,r.backgrounds.LOAD);
});

test('explicit blink reuses changed-tick waits, retains queued keys and leaves random timer/audio untouched',()=>{
 const s=skipStartup(new Session(data,{seed:1}));
 const timer={...s.menuTimer},seed=s.seed,audio=s.audioLog.length;
 s.enqueue(52);s.presentationEffects.push(...s.menuIdle.blink());
 assert.equal(s.menuIdle.state.waiting.count,1);assert.equal(s.input.pending(),true);
 assert.deepEqual(s.menuStep(s.lastWaitTick),[]);
 for(const [tick,name] of [[1,'eyes0044_halfway'],[2,'eyes0043_closed'],[3,null],[4,'eyes0042_open']]) {
  const events=s.menuStep(tick);
  assert.deepEqual(events.filter(e=>e.type==='sprite').map(e=>e.name),name?[name]:[]);
  assert.deepEqual(s.menuStep(tick),[]);assert.equal(s.input.pending(),true);
 }
 assert.equal(s.menuIdle.state.waiting,null);assert.equal(s.menuIdle.state.idleSince,4);
 assert.deepEqual(s.menuTimer,timer);assert.equal(s.seed,seed);assert.equal(s.audioLog.length,audio);
 assert.equal(s.input.consume(),52);
});
