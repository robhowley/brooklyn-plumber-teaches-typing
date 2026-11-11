import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAIN_MENU_RECTS, mainMenuCommand } from '../../recovered/control/flow.mjs';
const evidence = name => JSON.parse(readFileSync(new URL(`../../analysis/control/${name}.json`,import.meta.url),'utf8'));

test('translated menu geometry and all English dispatch keys match decoded source tables',()=>{
 const tables=evidence('tables');
 assert.deepEqual(MAIN_MENU_RECTS,tables.mainMenuRects.map(r=>[r.x0,r.y0,r.x1,r.y1]));
 for(const {key} of tables.mainMenuKeyDispatch) assert.notEqual(mainMenuCommand(Number(key)),'unrecognized',key);
 assert.deepEqual(tables.lessonGroupTargets,['0x92c2','0x92c8','0x92ce','0x92d4','0x92da','0x92e0']);
});
test('evidence records archive identity, source member and arithmetic instruction constants',()=>{
 const id=evidence('identity');
 assert.equal(id.archiveSha256,'b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd');
 assert.equal(id.exeSha256,'6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e');
 const slices=evidence('byte-slices'); const bytes=Buffer.from(slices.scoring.hex,'hex');
 const start=Number(slices.scoring.start);
 assert.equal(bytes.subarray(0x15d41-start,0x15d44-start).toString('hex'),'b8b600'); // mov ax,182
 assert.equal(bytes.subarray(0x15c43-start,0x15c46-start).toString('hex'),'b80a00'); // mov ax,10
 const msd=evidence('messages'); assert.equal(msd.resources[10003].text,'Next'); assert.equal(msd.resources[10004].text,'W for neW student');
});
