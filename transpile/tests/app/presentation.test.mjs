import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Renderer } from '../../app/render.mjs';
import { createStudentUI } from '../../recovered/control/menu.mjs';
import { newStudent } from '../../recovered/control/student.mjs';
const root=new URL('../../',import.meta.url), json=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const data=json('app/data.json'), evidence=json('.tmp/menu/evidence.json');
async function renderer() {
 const r=new Renderer({getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(256000)}),putImageData(){}})},data);
 const before=globalThis.fetch;
 globalThis.fetch=async path=>({ok:true,arrayBuffer:async()=>{const b=fs.readFileSync(new URL(path.replace(/^\.\//,''),root));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}});
 try {await r.load();} finally {globalThis.fetch=before;}return r;
}
test('student composition binds source text-grid origins, PREFS palette and actual selection raster',async()=>{
 const r=await renderer(),s=createStudentUI(newStudent('ADA'));
 assert.deepEqual(evidence.tables.prefBoxXs,[66,132,208]);
 const code=evidence.slices.student,bytes=Buffer.from(code.hex,'hex');
 assert.equal(bytes.subarray(0xef34-code.start,0xef3c-code.start).toString('hex'),'b8080050b8090050');
 assert.equal(bytes.subarray(0xf09f-code.start,0xf0a5-code.start).toString('hex'),'c70687478200');
 r.studentUI(s);assert.equal(r.palette,'PREFS.CRX');
 assert.deepEqual(r.operations.map(o=>[o.x,o.y,o.font]),[[64,70,'FONT3H'],[64,90,'FONT3H'],[64,100,'FONT3H'],[64,110,'FONT3H']]);
 const sprite=data.sprites['GREET2/prefbox_1'],raw=Buffer.from(sprite.pixels,'base64');
 assert.equal(sprite.memberSha256,evidence.members['GREET2.GSO']);
 let count=0;for(let y=0;y<sprite.height;y++)for(let x=0;x<sprite.width;x++)if(raw[y*sprite.width+x]){assert.equal(r.front[(130+y)*320+66+x],raw[y*sprite.width+x]);count++;}
 assert.ok(count>0);
 r.studentUI(createStudentUI(s.bytes,'new'));assert.deepEqual(r.operations.map(o=>[o.x,o.y]),[[56,110]]);
 r.studentUI(createStudentUI(s.bytes,'times'));assert.deepEqual(r.operations.filter(o=>o.x===190).map(o=>o.y),[70,90,110,130]);
});
test('missing required control font or background fails visibly instead of substituting art',async()=>{
 const r=await renderer();delete r.backgrounds.HELP;
 assert.throws(()=>r.modal({kind:'help'},newStudent('ADA')),/Missing control screen HELP/);
 delete r.fonts.FONT3H;assert.throws(()=>r.studentUI(createStudentUI(newStudent('ADA'))),/Missing decoded font FONT3H/);
});
