import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateReport,qualifies} from '../report.js';
import {createSetup} from '../setup.js';
import {readFileSync,openSync,readSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
// Independent vectors from WINMARIO.EXE;1 SHA256
// 39a4fb53384afbfec13063c2f4c67d51013b1f8ea494788c88f1ac6c12f47f22:
// FILE 0x270a unsigned strict ranking, 0x2917 sign-extended subtraction,
// 0x2924 low32 MUL, 0x292c unsigned DIV; 0x1ddbb JG, 0x1dde1 JA.
test('six formatted fields, ASCII tie order, fallback, signed words and wrapping accuracy',()=>{
 const histogram=Array(128).fill(0);histogram[90]=3;histogram[65]=3;histogram[66]=1;
 const report=calculateReport({counters:{total:125,errors:5,speed:24},elapsed:61,histogram});
 assert.deepEqual(report.reportStrings,['Keys Typed:  125','Errors:        5','Word/Min:     24','Accuracy:    96%','Lesson Time: 1:01','Problem Keys: A,Z,B']);
 const zero=calculateReport({counters:{total:0,errors:0,speed:0},elapsed:0,histogram:Array(128).fill(0)});
 assert.equal(zero.accuracy,0);assert.equal(zero.problem,'None!');
 const wrapped=calculateReport({counters:{total:1,errors:2,speed:65535},elapsed:3932160,histogram});
 assert.equal(wrapped.accuracy,65436);assert.equal(wrapped.reportStrings[2],'Word/Min:     -1');
 assert.equal(wrapped.reportStrings[4],'Lesson Time: 0:00');
 // pad() already sign-extends the low word for every %d, including minutes.
 for(const [minutes,text] of [[32767,'32767'],[32768,'-32768'],[65535,'-1'],[65536,' 0'],[65537,' 1']])
  assert.equal(calculateReport({counters:{total:0,errors:0,speed:0},elapsed:minutes*60+59,histogram:[]}).reportStrings[4],
   'Lesson Time:'+text+':59');
});
test('inert source opcodes independently pin signed speed, low-word minutes and malformed certificate call',
 {skip:!process.env.MARIO2_TEST_ISO},()=>{
 const pins=JSON.parse(readFileSync(new URL('../pins.json',import.meta.url)));
 const fd=openSync(process.env.MARIO2_TEST_ISO,'r'),b=Buffer.alloc(pins.executable.size);
 try {assert.equal(readSync(fd,b,0,b.length,pins.executable.image_extents[0].image_offset),b.length);} finally {closeSync(fd);}
 assert.equal(createHash('sha256').update(b).digest('hex'),pins.executable.sha256);
 const hash=(start,end)=>createHash('sha256').update(b.subarray(start,end)).digest('hex');
 // Selector28 with zero students jumps to no-hit FILE0x176b6, before audio10.
 assert.equal(hash(0x17684,0x17697),'bb64fa99811cbe1d63be9d1926cc95fdd5d4fb4427b804688d39c9fb4dbda639');
 assert.equal(b.subarray(0x17684,0x17697).toString('hex'),'26837c0a1c750cc41e1e262683bfca0000741f');
 // Accepted menu hit plays selector10/flags2 before loading selector/argument.
 // XPRESS-0008, embedded WAVEFILE resource499, not a typing cue.
 assert.equal(hash(0x17697,0x176b6),'3d9d2ab8df3b8146e139e3c785603525322e08f367bf7043eafcf10081989c9e');
 assert.equal(b.subarray(0x17697,0x176a2).toString('hex'),'66680a0002009a722aea42');
 // FILE 0x27ce stores AX only after unsigned elapsed/60; no high-word minutes reach %d.
 assert.equal(b.subarray(0x27ce,0x27d1).toString('hex'),'8946f6');
 assert.equal(hash(0x1ddbb,0x1ddc4),'9c0eb0daeeeeef76fa63b09c14286b7abde0a95058c6f6fd961bca51e132617c');
 assert.equal(hash(0x1dde1,0x1ddea),'bb793f04b9a08f17df0dc9e3f9bb77e250777e0e66730ae0eab0fef815ebec61');
 assert.equal(hash(0x20ee0,0x20ee4),'ba1724b3e60259b446ded3751daa83b89e22b008dd2ba5dc0b0c3fe4cba5f9cb');
});
test('progression boundaries are signed speed and unsigned low-word whole minutes, not movie success',()=>{
 for(const [speed,elapsed,threshold,minutes,expected] of [[10,299,10,5,false],[10,300,10,5,true],[9,300,10,5,false],[65535,300,10,5,false],[0,300,65535,5,true],[10,3932160,10,5,false]])
  assert.equal(qualifies({speed,elapsed},threshold,minutes),expected);
});
function harness(keyset) {
 const record=Array(292).fill(0);record[1]=keyset;record[5]=3;record[27]=5;record[35]=10;record[274]=65;record[100]=211;
 let writes=0;
 const setup=createSetup({nameKeyFlags:Array(256).fill(0),store:{load:()=>({ok:true,value:{currentName:'A',students:[{name:'A',record}]}}),save:()=>{writes++;throw Error('Manual report must not write');}}});
 setup.dispatch({type:'select',selector:39});return {setup,writes:()=>writes};
}
test('manual report one-shot progression and Repeat/Continue use actual record without source autosave',()=>{
 for(let keyset=0;keyset<4;keyset++) {
  const {setup,writes}=harness(keyset);
  assert.equal(setup.reportContext().previous,0);
  setup.beginReport({speed:10,elapsed:300});
  assert.equal(setup.finishReport().keyset,keyset+1);
  assert.equal(setup.reportContext().previous,10);
  setup.beginReport({speed:100,elapsed:300});setup.finishReport();
  assert.equal(setup.snapshot().keyset,keyset+1);assert.equal(writes(),0);
  setup.welcome();assert.equal(setup.dispatch({type:'select',selector:39}).keyset,keyset+1);
 }
});
test('terminal keeps pre-call speed but cannot increment certificate counter or reenter',()=>{
 const {setup}=harness(4);setup.beginReport({speed:10,elapsed:300});
 assert.equal(setup.finishReport().terminal,true);assert.equal(setup.reportContext().previous,10);
 assert.equal(setup.finishReport().keyset,4);setup.welcome();
 assert.equal(setup.dispatch({type:'select',selector:39}).state,10);
 const failed=harness(4).setup;failed.beginReport({speed:9,elapsed:300});failed.finishReport();
 assert.equal(failed.dispatch({type:'select',selector:39}).state,21);
});
