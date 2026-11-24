import test from 'node:test';
import assert from 'node:assert/strict';
import {createSetup} from '../setup.js';
import {calculateReport} from '../report.js';
const put=(r,p,n)=>{r[p]=n&255;r[p+1]=(n>>>8)&255;};
function fixture(keyset=0) {
 return {schema:'mario2-students.v1',currentName:'B',students:['A','B'].map((name,i)=>{
  const record=Array.from({length:292},(_,j)=>(j*7+i)%256);
  put(record,1,keyset);put(record,3,i);put(record,5,3);put(record,9,43);put(record,11,17);
  [2,5,5,1,10,30,50,10].forEach((n,j)=>put(record,21+j*2,n));
  put(record,17,97);record[274]=name.charCodeAt(0);record[275]=0;
  return {name,record};
 })};
}
function harness({keyset=0,fail=0}={}) {
 let durable=fixture(keyset),writes=[],attempt=0,armed=false;
 const original=structuredClone(durable);
 const store={load:()=>({ok:true,value:structuredClone(durable)}),save:value=>{
  writes.push(structuredClone(value));attempt++;
  if(armed && attempt===fail) return {ok:false,error:{message:'injected refusal'}};
  durable=structuredClone(value);return {ok:true};
 }};
 const setup=createSetup({store,nameKeyFlags:Array(256).fill(0)});
 setup.dispatch({type:'select',selector:6});setup.dispatch({type:'list-click',x:370,y:80});
 setup.dispatch({type:'list-click',x:300,y:440});writes=[];attempt=0;armed=true;
 return {setup,store,original,writes,durable:()=>structuredClone(durable)};
}
const result=(histogram=[])=>calculateReport({counters:{total:50,errors:0,speed:10},elapsed:60,histogram});
test('loaded teardown then one-shot report writer preserve both full records and opaque tails',()=>{
 const h=harness(),s=h.setup;
 s.beginTyping();assert.equal(s.studentContext().record[17],1);
 const expected=h.original.students[0].record.slice();put(expected,17,0);
 s.beginReport(result());assert.equal(h.writes.length,1);
 assert.deepEqual(h.writes[0].students[0].record,expected);
 s.finishReport();put(expected,11,10);put(expected,9,100);put(expected,19,60);put(expected,1,1);
 // Independent FILE 0x2b19..0x2b3e strcpy from buffer+1, including NUL.
 expected.splice(253,5,111,110,101,33,0);
 assert.equal(h.writes.length,2);assert.deepEqual(h.durable().students[0].record,expected);
 assert.deepEqual(h.durable().students[1],h.original.students[1]);
 s.finishReport();assert.equal(h.writes.length,2);
 s.dispatch({type:'select',selector:39});assert.equal(s.studentContext().loadedOrigin,true);
 s.beginTyping();s.beginReport(result());s.finishReport();assert.equal(h.writes.length,4);
 const restored=createSetup({store:h.store,nameKeyFlags:Array(256).fill(0)});
 assert.equal(restored.studentContext().loadedOrigin,false);
 assert.deepEqual(restored.studentContext().record,h.durable().students[0].record);
 restored.dispatch({type:'select',selector:39});restored.beginTyping();restored.beginReport(result());restored.finishReport();
 assert.equal(h.writes.length,4); // reload does not serialize origin
});
for(const fail of [1,2]) test('loaded writer refusal '+fail+' retains last accepted envelope, live history and one-shot behavior',()=>{
 const h=harness({fail}),s=h.setup;s.beginTyping();s.beginReport(result());s.finishReport();
 assert.equal(h.writes.length,2);
 assert.deepEqual(h.durable(),h.writes[fail===1?1:0]);
 assert.equal(s.studentContext().record[1],1);
 if(fail===2) assert.equal(s.snapshot().storageError.message,'injected refusal');
 s.finishReport();assert.equal(h.writes.length,2);
});
test('loaded elapsed low16 and ASCII problem ties serialize without clearing opaque suffix',()=>{
 const h=harness(),s=h.setup,histogram=Array(128).fill(0);histogram[90]=2;histogram[65]=2;histogram[66]=1;
 const r=result(histogram);r.elapsed=65597;s.beginTyping();s.beginReport(r);s.finishReport();
 const bytes=h.durable().students[0].record;
 assert.deepEqual(bytes.slice(253,259),[65,44,90,44,66,0]);assert.deepEqual(bytes.slice(19,21),[61,0]);
 assert.deepEqual(bytes.slice(259,274),h.original.students[0].record.slice(259,274));
});
test('loaded terminal STOP retains only earlier durable teardown, with pre-call history in memory',()=>{
 const h=harness({keyset:4}),s=h.setup;s.beginTyping();s.beginReport(result());s.finishReport();
 assert.equal(s.snapshot().terminal,true);assert.equal(h.writes.length,1);
 assert.equal(h.durable().students[0].record[11],17);
 assert.equal(s.studentContext().record[11],10);assert.equal(s.studentContext().record[9],100);
 assert.deepEqual(s.studentContext().record.slice(37,43),h.original.students[0].record.slice(37,43));
 s.finishReport();s.dispatch({type:'select',selector:39});assert.equal(h.writes.length,1);assert.equal(s.snapshot().state,10);
});
