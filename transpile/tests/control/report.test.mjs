import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { newStudent, recordProblemKey } from '../../recovered/control/student.mjs';
import { sourceFormat, reportProblemKeys, reportProfile, helpLines, openHelp, helpInput, modalReturn, keyboardInput, helpPointer } from '../../recovered/control/report.mjs';
import { reportOperations, drawReport, drawSourceText } from '../../app/report-render.mjs';
import { helpOperations, drawHelp, drawKeyboard, aboutOperations, drawAbout } from '../../app/help-render.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const json=path=>JSON.parse(readFileSync(root+path,'utf8'));
const evidence=json('.tmp/report-evidence.json');
const manifest=json('assets/original/manifest.json');
const messages=Object.fromEntries(Object.entries(json('analysis/control/messages.json').resources).map(([k,v])=>[k,v.text]));
const raw=name=>readFileSync(root+'assets/original/raw/MarioTea/MARIO/'+name+'.data');
const exe=raw('MARIO.EXE');
const sha=b=>createHash('sha256').update(b).digest('hex');
const fonts=Object.fromEntries(['FONT3H','FONT5H'].map(f=>[f,manifest.sprites.filter(s=>s.family===f).map(sprite=>
  ({sprite,pixels:new Uint8Array(readFileSync(root+'assets/original/'+sprite.indicesPath))}))]));
function resources(name) {
  const bg=manifest.backgrounds.find(b=>b.name===name);
  return {...evidence,messages,fonts,background:new Uint8Array(readFileSync(root+'assets/original/'+bg.indicesPath)),
    palette:json('assets/original/palettes/'+name+'.CRX.json').rgb8};
}
function profile() {
  const bytes=newStudent('Ada');const v=new DataView(bytes.buffer);
  v.setInt16(17,12,true);v.setInt16(19,97,true);v.setInt16(23,15,true);return bytes;
}
function counts(entries) {
  const bytes=profile(),v=new DataView(bytes.buffer);
  for(const [code,count] of entries) v.setInt16(68+(code-32)*2,count,true);
  return bytes;
}

test('archive-pinned source identity, font bindings and real independently read glyph pixels',()=>{
  assert.equal(sha(exe),'6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e');
  assert.ok(evidence.verifiedInstructionLines>2800);
  const msd=raw('ENGLISH.MSD'),records=json('analysis/control/messages.json').resources;
  for(const id of [10,11,12,13,20,21,22,23,30,31,32,33,40,41,42,43,
    100,101,102,103,2110,2120,2130,2240,2250,2260,2270,5500,5501,5502,5503,5504,5505,
    50400,50401,50402,50403,50404,50405,50406,50407,50420]) {
    const p=Number(records[id].fileOffset);
    assert.equal(messages[id],msd.subarray(p,msd.indexOf(0,p)).toString('ascii'));
  }
  for(const section of [1,2]) assert.equal(evidence.help[section],raw(`MARIO${section}.HLP`).toString('ascii'));
  for(const [member,v] of Object.entries(evidence.members)) assert.equal(sha(raw(member.split('/').at(-1))),v.sha256);
  assert.equal(exe.subarray(0x1261a,0x12622).toString('hex'),'b8f126501eb8d34f');
  assert.equal(exe.subarray(0x1262c,0x12634).toString('hex'),'b8f826501eb8c44f');
  for(const [family,records] of Object.entries(fonts)) for(const {sprite,pixels} of records) {
    const original=raw(family+'.GSO');
    assert.deepEqual([...pixels],[...original.subarray(sprite.offset+8,sprite.offset+8+sprite.width*sprite.height)]);
    assert.equal(sprite.index,Number(sprite.name.split('_')[1])-32);
  }
});

test('signed per-key ranking, ASCII ties, space exclusion, DEL inclusion and 16-bit wrap',()=>{
  assert.equal(reportProblemKeys(counts([[32,32767],[127,8],[65,8],[66,8],[67,8],[68,8],[69,8]])),' A B C D E');
  assert.equal(reportProblemKeys(counts([[65,-1],[66,-32768],[127,1]])),' \x7f');
  let bytes=counts([[65,32767]]);bytes=recordProblemKey(bytes,65);
  assert.equal(reportProblemKeys(bytes),'');
  bytes=recordProblemKey(counts([[65,-1]]),65);assert.equal(reportProblemKeys(bytes),'');
  assert.equal(reportProblemKeys(counts([[32,3]])),'');
  assert.equal(reportProblemKeys(profile()),'');
  // Source copies None!, then final pointer still points to its first byte.
  assert.equal(exe.subarray(0xe524,0xe52b).toString('hex'),'c45eea26c60700');
});

test('source formatting uses unsigned words, minimum widths and string precision',()=>{
  assert.equal(sourceFormat('%3u%%',-1),'65535%');
  assert.equal(sourceFormat('%3u:%02u',2,3),'  2:03');
  assert.equal(sourceFormat('%-5.3s','abcdef'),'abc  ');
});

test('RCARD source coordinates, conditional rows, normalization and palette',()=>{
  const bytes=profile(),r=resources('RCARD'),ops=reportOperations(bytes,r);
  assert.deepEqual(ops.map(o=>[o.x,o.y]),[[60,66],[60,80],[60,96],[178,96],[60,108],[178,108],
    [60,120],[178,120],[60,132],[178,132],[60,144],[178,143]]);
  for(const [offset,x,y] of [[0xe758,60,66],[0xe77d,60,80],[0xe7c0,60,96],[0xe81a,60,108],
    [0xe857,60,120],[0xe894,60,132],[0xe8ca,60,144],[0xe8fc,178,143]]) {
    assert.equal(exe.readUInt16LE(offset+4),x);assert.equal(exe.readUInt16LE(offset+10),y);
  }
  assert.equal(ops[1].text,'Teacher: Mario');assert.equal(ops[3].text,messages[100]);
  const v=new DataView(bytes.buffer);v.setInt16(17,0,true);v.setInt16(19,-1,true);
  assert.equal(reportOperations(bytes,r).length,8);
  bytes[28]=0;assert.equal(reportProfile(bytes),null);assert.equal(drawReport(new Uint8Array(64000),r,bytes),null);
  const front=new Uint8Array(64000);const output=drawReport(front,r,profile());
  assert.equal(output.palette.length,768);assert.deepEqual(front.subarray(0,320),r.background.subarray(0,320));
  const glyph=fonts.FONT5H['N'.charCodeAt(0)-32];
  for(let i=0;i<glyph.pixels.length;i++) if(glyph.pixels[i]===1) assert.equal(front[(66+Math.floor(i/8))*320+60+i%8],0);
});

test('font service ignores GSO origins, preserves/restores zero pixels and maps shadow',()=>{
  const front=new Uint8Array(64000).fill(99),font=fonts.FONT5H[33];
  const op={font:'FONT5H',text:'A',x:11,y:23,color:14,background:15,shadow:8,opaque:true};
  const shifted={...fonts,FONT5H:fonts.FONT5H.map((g,i)=>i===33?
    {...g,sprite:{...g.sprite,headerWords:[17,-9,8,8]}}:g)};
  drawSourceText(front,shifted,[op]);
  for(let i=0;i<font.pixels.length;i++) assert.equal(front[(23+Math.floor(i/8))*320+11+i%8],[15,14,8][font.pixels[i]]);
  op.opaque=false;const bg=new Uint8Array(64000).fill(7);drawSourceText(front,fonts,[op],bg);
  for(let i=0;i<font.pixels.length;i++) if(!font.pixels[i]) assert.equal(front[(23+Math.floor(i/8))*320+11+i%8],7);
});

test('HLP CR-only line table, color control, next-four-column tabs, 35-column clipping',()=>{
  assert.equal(helpLines('one\r\ntwo\r\n\x1a').length,2);
  const state=openHelp(1,'menu','<12>Title\r\n<1>\r\na\tb\r\n');
  const ops=helpOperations(state);
  assert.deepEqual(ops.slice(0,3).map(o=>[o.x,o.y,o.color]),[[16,30,12],[16,38,1],[16,46,1]]);
  assert.equal(ops[2].text.slice(0,5),'a   b');assert.equal(ops[2].text.length,35);
  assert.equal(helpOperations({...state,top:2})[0].color,1); // not inherited from offscreen lines
  assert.equal(helpOperations(openHelp(1,'menu','x'.repeat(41)+'\r\n')).length,0);
  assert.equal(helpOperations(openHelp(1,'menu','x'.repeat(40)+'\r\n'))[0].text.length,35);
  assert.equal(helpOperations(openHelp(3,'menu'))[0].hostNotice,true);
  const r=resources('HELP'),front=new Uint8Array(64000);
  assert.equal(drawHelp(front,r,openHelp(1,'menu',evidence.help[1])).available,true);
  assert.equal(drawHelp(front,r,openHelp(3,'menu')).available,false);
});

test('all recovered help key targets, page overlap, button cycle and exact caller return',()=>{
  assert.deepEqual(evidence.helpKeys,[9,13,27,68,100,301,327,328,329,331,333,335,336,337]);
  let state=openHelp(1,'results',evidence.help[1]);
  assert.equal(helpInput(state,{key:13}).route,'results');
  state=helpInput(state,{key:337});assert.equal(state.top,17);
  state=helpInput(state,{key:336});assert.equal(state.top,18);
  state=helpInput(state,{key:329});assert.equal(state.top,1);
  state=helpInput(state,{key:328});assert.equal(state.top,0);
  state=helpInput(state,{key:335});assert.equal(state.top,state.lines.length-18);
  state=helpInput(state,{key:327});assert.equal(state.top,0);
  state=helpInput(state,{key:9});assert.equal(state.button,0);
  assert.deepEqual(helpPointer(state),{x:36,y:182});
  assert.deepEqual(Array.from({length:3},(_,i)=>exe.readInt16LE(0x21bdc+4*i)),[36,91,280]);
  state=helpInput(state,{key:331});assert.equal(state.button,2);
  state=helpInput(state,{key:333});assert.equal(state.button,0);
  for(const key of [27,68,100]) assert.equal(helpInput(state,{key}).route,'results');
  assert.equal(helpInput(state,{key:301}).request,undefined);
  assert.equal(helpInput(state,{key:301,quitAllowed:true}).request,'quit');
  assert.equal(helpInput(state,{leftButton:true,x:261,y:178}).route,'results');
  assert.equal(helpInput(state,{leftButton:true,x:300,y:188}).route,'results');
  assert.equal(helpInput(state,{leftButton:true,x:301,y:188}).closed,false);
  assert.equal(helpInput(openHelp(2,'results',evidence.help[2]),{key:337}).top,0);
});

test('keyboard/about retain original pixels/text and modal returns to caller, without links',()=>{
  const front=new Uint8Array(64000),keyboard=resources('KEYBOARD');
  drawKeyboard(front,keyboard);assert.deepEqual(front,keyboard.background);
  const r=resources('GREETBG'),ops=aboutOperations(r);
  assert.equal(ops[0].text,r.strings[0x25c7]);assert.deepEqual([ops[0].x,ops[0].y],[56,5]);
  assert.equal(exe.subarray(0x11e2b,0x11e33).toString('hex'),'b8010050b8080050');
  assert.equal(exe.subarray(0x12158,0x12160).toString('hex'),'b8140050b80d0050');
  assert.ok(ops.some(o=>o.text===messages[50403]&&o.y===150));
  assert.deepEqual([ops.at(-1).x,ops.at(-1).y],[96,185]);
  drawAbout(front,r);assert.deepEqual(front.subarray(320*199),r.background.subarray(320*199));
  const state={kind:'keyboard',returnTo:'results',closed:false};
  assert.equal(keyboardInput(state,{key:0x13b}),state);
  assert.equal(keyboardInput(state,{pointerChanged:true,pointerEnabled:true}),state);
  assert.equal(keyboardInput(state,{key:0x13c}).route,'results');
  assert.equal(modalReturn(state,{key:0x13c}).route,'results');
  assert.equal(modalReturn(state,{pointerChanged:true}),state);
  assert.equal(modalReturn(state,{pointerChanged:true,pointerEnabled:true}).route,'results');
  assert.equal(modalReturn({...state,kind:'about'},{key:27}).flushInput,true);
  assert.equal(keyboardInput(state,{key:27}).flushInput,false);
});
