import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,openSync,readSync,closeSync,readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {createStartup} from '../startup.js';
function fixture(){
 const calls=[],callbacks=[];
 const api=createStartup({backdrop:id=>calls.push(['bitmap',id]),play:(id,end)=>{calls.push(['movie',id]);callbacks.push(end);},
  close:()=>calls.push(['close']),fade:n=>calls.push(['fade',n]),restore:()=>calls.push(['restore']),welcome:()=>calls.push(['welcome'])});
 return {api,calls,callbacks,tick:n=>{while(n--)api.tick();}};
}
test('natural and skip share ordered transitions, consume stale/repeated callbacks and hand off only once',()=>{
 for(const natural of [true,false]){
  const f=fixture();assert.deepEqual(f.calls,[['bitmap',485],['movie',0]]);
  f.tick(20);assert.equal(f.calls.length,2); // repaint/timer during movie is inert
  if(natural)f.callbacks[0]();else assert.equal(f.api.skip(),true);
  f.callbacks[0]();assert.equal(f.api.skip(),false);
  f.tick(1);assert.equal(f.api.snapshot().count,8);
  f.tick(1);assert.equal(f.api.snapshot().count,0);
  f.tick(1);assert.equal(f.api.snapshot().transition,3);
  f.tick(1);assert.equal(f.api.snapshot().stage,1);
  f.callbacks[0]();assert.equal(f.api.snapshot().phase,'intro');
  f.tick(20);assert.equal(f.calls.filter(([k])=>k==='movie').length,2);
  if(natural)f.callbacks[1]();else f.api.skip();
  f.callbacks[1]();f.tick(4);assert.equal(f.api.snapshot().stage,2);
  f.tick(1);assert.equal(f.api.snapshot().stage,3);
  assert.equal(f.calls.some(([k])=>k==='welcome'),false);
  f.tick(1);assert.equal(f.api.active(),false);
  f.tick(100);f.callbacks.forEach(cb=>cb());f.api.skip();
  assert.deepEqual(f.calls,[['bitmap',485],['movie',0],['close'],['bitmap',485],['fade',75],['restore'],
   ['bitmap',613],['movie',1],['close'],['fade',75],['restore'],['welcome']]);
 }
});
test('no terminal callback means failure/blocked hold, not a timed splash',()=>{
 const f=fixture();f.tick(10000);assert.equal(f.api.snapshot().phase,'logo');
 f.api.skip();f.tick(4);f.tick(10000);assert.equal(f.api.snapshot().phase,'intro');
});
const iso=process.env.MARIO2_TEST_ISO??`${homedir()}/Downloads/Mario Teaches Typing 2 (1997)(Interplay)[Mac-PC].iso`;
test('inert source operands establish the palette/counter alias, independently of lifecycle constants',{skip:!existsSync(iso)},()=>{
 const pins=JSON.parse(readFileSync(new URL('../pins.json',import.meta.url)));
 const fd=openSync(iso,'r');const bytes=(offset,n)=>{const b=Buffer.alloc(n);readSync(fd,b,0,n,pins.executable.image_extents[0].image_offset+offset);return b;};
 try{
  // WINMARIO FILE offsets from the independently reviewed startup listings.
  assert.equal(bytes(0x18a86,1)[0],0xbe);const base=bytes(0x18a87,2).readUInt16LE();
  assert.equal(bytes(0x18ad3,4).toString('hex'),'c706523b');
  const counter=bytes(0x18ad5,2).readUInt16LE(),nominal=bytes(0x18ad7,2).readUInt16LE();
  assert.equal(bytes(0x18b21,1)[0],0xbb);const start=bytes(0x18b22,2).readUInt16LE();
  assert.equal(bytes(0x18b64,2).toString('hex'),'83c3');const stride=bytes(0x18b66,1)[0];
  assert.equal(bytes(0x18b67,2).toString('hex'),'81fb');const end=bytes(0x18b69,2).readUInt16LE();
  assert.equal(bytes(0x18b6b,1)[0],0x76); // unsigned inclusive bound
  assert.equal(bytes(0x18b34,2).toString('hex'),'802f');const decrement=bytes(0x18b36,1)[0];
  assert.equal(start-base,stride);assert.equal(end,counter);
  const memory=new Uint8Array(end+3).fill(255);memory[counter]=nominal-1;memory[counter+1]=0;
  for(let address=start;address<=end;address+=stride)for(let c=0;c<3;c++)memory[address+c]=Math.max(0,memory[address+c]-decrement);
  const f=fixture();f.api.skip();f.tick(1);assert.equal(f.api.snapshot().count,nominal);
  f.tick(1);assert.equal(f.api.snapshot().count,memory[counter]);
  assert.deepEqual(f.calls.filter(([k])=>k==='fade'),[['fade',decrement]]);
 }finally{closeSync(fd);}
});
