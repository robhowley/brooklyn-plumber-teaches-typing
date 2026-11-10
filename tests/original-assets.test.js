import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import rasters from '../src/assets/original/rasters.json' with {type:'json'};
import provenance from '../src/assets/original/provenance.json' with {type:'json'};
import { originalImage, actionImage, practiceFace } from '../src/assets/original/index.js';
import { drawScreen, SCREEN_LAYOUTS } from '../src/screen-art.js';
import { drawScene } from '../src/scene.js';
import { createAttempt } from '../src/engine.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
const families='LOGO GREET GREETBG MAINMENU PREFS LOAD LESSTIME HELP KEYBOARD OUTSIDE OUTSKY WATER WCAS0001 CASTLE OCASTLE PRACTICE BLACKBRD RCARD CERTIF ENDF'.split(' ');
let id=0;
const calls=[];
const context=new Proxy({}, {get:(o,k)=>o[k]??((...args)=>calls.push([k,...args])),set:(o,k,v)=>{o[k]=v;return true;}});
globalThis.document={createElement:()=>({id:++id,width:0,height:0,getContext:()=>context,toDataURL:()=> 'data:image/png;base64,'})};
const canvas=()=>({width:0,height:0,getContext:()=>context,setAttribute(){}});
function freeze(value) { if(value&&typeof value==='object') {Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value; }
test('all 20 native backgrounds have explicit overlay placements and draw through the screen entrypoint',()=>{
 assert.deepEqual(Object.keys(SCREEN_LAYOUTS).sort(),families.toSorted());
 for(const family of families) {
  assert.equal(rasters[family].width,320);assert.equal(rasters[family].height,200);
  const c=canvas();const layout=drawScreen(c,family);
  assert.equal(c.width,320);assert.equal(c.height,200);assert.equal(layout,SCREEN_LAYOUTS[family]);
  const [x,y,w,h]=layout.panel;assert.ok(x>=0&&y>=0&&x+w<=320&&y+h<=200);
  assert.equal(calls.at(-1)[0],'drawImage');assert.equal(calls.at(-1)[1],originalImage(family));
 }
 assert.throws(()=>drawScreen(canvas(),'LOADING'),RangeError);
});
test('every selected raster has intact hashes, bounded pixels and static-only provenance',()=>{
 assert.equal(provenance.records.length,Object.keys(rasters).length);
 assert.equal(provenance.records.length,186);
 for(const prefix of ['m','l','p'])assert.equal(rasters[`WALKING-${prefix}run0009_1`],undefined);
 assert.equal(rasters['FONT7H-font7_32'],undefined);
 assert.match(provenance.rights,/unverified/);
 for(const r of provenance.records) {
  const data=rasters[r.id],pixels=Buffer.from(data.pixels,'base64');
  assert.match(r.member,/^MarioTea\/MARIO\/[A-Z0-9]+\.(CRX|GSO)$/);
  assert.match(r.paletteMember,/\.(CRX|GPO)$/);assert.match(r.memberSha256,/^[a-f0-9]{64}$/);
  assert.equal(hash(pixels),r.pixelSha256);assert.equal(hash(JSON.stringify(data)),r.rasterSha256);
  assert.equal(pixels.length,data.width*data.height);assert.equal(data.palette.length,768);
  assert.ok(data.palette.every(n=>Number.isInteger(n)&&n>=0&&n<=255));
 }
 assert.deepEqual(readdirSync(new URL('../src/assets/original/',import.meta.url)).sort(),['index.js','provenance.json','rasters.json']);
});
test('selected originals match retained raw members, palette hashes and reviewed decoded references', {skip:!process.env.ORIGINAL_FIDELITY_SOURCE},()=>{
 const root=process.env.ORIGINAL_FIDELITY_SOURCE;
 const raw=resolve(root,'research/gameplay-mechanics-2026-11-09/dos-resources/extracted');
 for(const r of provenance.records) {
  const bytes=readFileSync(resolve(raw,r.member));assert.equal(hash(bytes),r.memberSha256);
  assert.equal(hash(readFileSync(resolve(raw,r.paletteMember)).subarray(0,768)),r.paletteSha256);
  assert.equal(hash(readFileSync(resolve(root,'research/executable-1992/screens',r.decodedReference))),r.decodedReferenceSha256);
  if(r.record) {
   assert.equal(hash(bytes.subarray(r.span[0]+8,r.span[1]-2)),r.pixelSha256);
   assert.equal(hash(readFileSync(resolve(raw,r.indexMember))),r.indexSha256);
  }
 }
});
test('all three characters use recovered action geometry and Mario has three distinct original expressions',()=>{
 for(const character of ['Mario','Luigi','Princess'])for(const action of ['run','jmp','sin','swm']) {
  const image=actionImage(character,action,0);assert.ok(image.width===40||image.width===55);
  assert.notEqual(image,actionImage(character,action,1));assert.equal(image,actionImage(character,action,0));
  if(action==='run')assert.equal(actionImage(character,action,3),image);
 }
 assert.equal(practiceFace('happy').width,53);assert.equal(practiceFace('happy').height,60);
 assert.notEqual(practiceFace('happy'),practiceFace('sad'));assert.notEqual(practiceFace('neutral'),practiceFace('sad'));
});
test('Mario happy expression aligns exactly with the original practice face inset',()=>{
 const background=rasters.PRACTICE,face=rasters['PRACTICE-prac0003_1'];
 const bg=Buffer.from(background.pixels,'base64'),pixels=Buffer.from(face.pixels,'base64');
 for(let y=0;y<60;y++)for(let x=0;x<53;x++) {
  const a=bg[(y+21)*320+x+142],b=pixels[y*53+x];
  assert.deepEqual(background.palette.slice(a*3,a*3+3),face.palette.slice(b*3,b*3+3));
 }
});
test('browser welcome still draws the static archive GREET, separate from the title intro',()=>{
 const c=canvas();
 calls.length=0;drawScreen(c,'GREET');
 assert.equal(c.width,320);assert.equal(c.height,200);
 assert.equal(calls.find(c=>c[0]==='drawImage')[1],originalImage('GREET'));
 assert.equal(calls.filter(c=>c[0]==='drawImage').length,1);
});
test('sound settings do not change scene motion or artwork',()=>{
 for(const mode of ['outdoor','underwater','castle','practice']) {
  const state=createAttempt({mode});state.elapsed=5;
  drawScene(canvas(),state); // Warm the static raster cache before comparing calls.
  calls.length=0;drawScene(canvas(),{...state,sound:false});const quiet=calls.slice();
  calls.length=0;drawScene(canvas(),{...state,sound:true});assert.deepEqual(calls,quiet);
 }
});
test('scene is read-only for all characters/modes, paused and reduced motion states',()=>{
 for(const mode of ['outdoor','underwater','castle','practice'])for(const character of ['Mario','Luigi','Princess'])for(const reducedMotion of [false,true]) {
  const state=createAttempt({mode,character,reducedMotion});
  state.elapsed=4;state.status='paused';const before=JSON.stringify(state);freeze(state);
  const c=canvas();drawScene(c,state,100);assert.equal(JSON.stringify(state),before);
  calls.length=0;drawScene(c,state,100);const first=calls.slice();calls.length=0;drawScene(c,state,99999);
  assert.deepEqual(calls,first);assert.equal(c.width,640);assert.equal(c.height,400);
 }
});
