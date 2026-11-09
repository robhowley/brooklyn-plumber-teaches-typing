import test from 'node:test';
import assert from 'node:assert/strict';
import { drawScene } from '../src/scene.js';
import { createAttempt, typeKey, advanceTime, pause, resume, KEY_GROUPS, fingerHint } from '../src/engine.js';
function drawing(state) {
 const calls=[];
 const context=new Proxy({}, {set(o,k,v){o[k]=v;calls.push([k,v]);return true;},get(o,k){return o[k] ?? ((...args)=>{calls.push([k,...args]);if(k==='createLinearGradient')return {addColorStop(){}};});}});
 drawScene({width:960,height:360,getContext:()=>context},state,state.elapsed);
 return JSON.stringify(calls);
}
test('renderer accepts engine states without mutation, progress changes all action scenes',t=>{
 // Cached artwork uses secondary canvases. Their identities must remain observable
 // in drawImage calls so different character poses and portraits are not conflated.
 let imageId=0;
 const previousDocument=globalThis.document;
 globalThis.document={createElement(tag){
  assert.equal(tag,'canvas');
  const context=new Proxy({}, {get:(o,k)=>o[k] ?? (()=>{})});
  return {imageId:++imageId,width:0,height:0,getContext:()=>context};
 }};
 t.after(()=>{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;});
 for(const mode of ['outdoor','underwater','castle','practice']) for(const character of ['Mario','Luigi','Princess']) {
  const s=createAttempt({mode,character});s.reducedMotion=true;advanceTime(s,1);
  const original=JSON.stringify(s),before=drawing(s);assert.equal(JSON.stringify(s),original);
  typeKey(s,{key:s.text[0]});assert.notEqual(drawing(s),before);
  pause(s);const frozen=drawing(s);advanceTime(s,100);assert.equal(drawing(s),frozen);resume(s);
 }
});
test('every printable US key has a physical finger hint and shifted symbols request Shift',()=>{
 for(const group of KEY_GROUPS) for(const key of group.keys) assert.match(fingerHint(key),/finger|thumb/);
 for(const key of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ~!@#$%^&*()_+{}|:"<>?')assert.match(fingerHint(key),/opposite Shift/);
 assert.match(fingerHint('1'),/Left little/);assert.match(fingerHint('6'),/Right index/);assert.match(fingerHint('\\'),/Right little/);
});
test('errors cannot move obstacle index or enter a pipe; timeout cannot be revived',()=>{
 const s=createAttempt({mode:'castle',text:'a',duration:2});
 for(let i=0;i<39;i++)typeKey(s,{key:'a'});
 typeKey(s,{key:'A'});assert.equal(s.correct,39);assert.equal(s.pipe,null);assert.equal(s.castleStage,'thwomps');
 advanceTime(s,2);pause(s);resume(s);assert.equal(s.status,'finished');assert.equal(typeKey(s,{key:'a'}),'ignored');
});
