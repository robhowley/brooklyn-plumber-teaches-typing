import {test,expect} from '@playwright/test';
import {finishStartup} from './startup-entry.mjs';
const own='mtt2-static-translation.students.v1';
test('indexed source first-pass oracles through browser renderer, all characters/keysets',async({page})=>{
 await page.goto('./');await finishStartup(page);
 const hashes=await page.evaluate(async()=>{
  const {loadAssets}=await import('./assets.js'),{createOutside}=await import('./outside.js'),{createRenderer}=await import('./render.js');
  const a=await loadAssets(new URL('./assets.json',location.href)),bg=a.bitmaps.get(120),canvas=document.createElement('canvas');
  const r=createRenderer(canvas,a,{paletteEndpoints:{low:bg.palette.slice(0,30),high:bg.palette.slice(738)}});
  const result=[];
  // Reverse only unique RGB entries. Compare each displayed pixel to the set
  // allowed by the independently pinned indexed surface, not a guessed RGB key.
  const {renderOutside}=await import('./outside-render.js');
  for(let character=0;character<3;character++) for(let keyset=0;keyset<5;keyset++) {
   const scene=createOutside({animation:a.presentation.outsideAnimation,lesson:{bytes:[97]},character,keyset,durationSeconds:600,nowMs:0,random:{next:()=>1}});
   const v=scene.snapshot();r.enter({state:18,...v,outsideOperations:scene.entryEffects});
   const pass=scene.acceptedUpdate(0);r.draw({state:18,...pass.view,outsideOperations:pass.effects});
   const backing=bg.pixels,current=backing.slice(),ops=[];
   for(const e of [...scene.entryEffects,...pass.effects]) {
    if(e.type!=='draw')continue;const op=e.operation;
    if(op.type==='restore'){ops.push({kind:'restore'});continue;}
    if(op.type==='hud'){ops.push({kind:'hud',font:a.font,elapsed:0,typed:0,wrong:0,wpm:0});continue;}
    if(op.type==='glyph'){ops.push({kind:'glyph',font:a.font,character:op.byte,x:op.x,y:op.y,color:op.color});continue;}
    const o=op.object;let x=o.x,y=o.y,image;
    if(o.kind==='label'){ops.push({kind:'glyph',font:a.font,character:o.byte,x,y,restore:false});continue;}
    if(o.kind==='finger') {
     if(o.expectedByte===undefined)continue;const f=a.presentation.fingers;let i=f.mapping[o.expectedByte];if(i>=40)i-=40;const right=i>=6;if(right)i--;
     image=a.bitmaps.get(f.bitmaps[i]);x=90+(right?90:0)+f.dx[i];y=190+f.dy[i];
    }else{image=a.bitmaps.get(o.sprite.bitmap??a.presentation.outsideSprites[o.sprite.selector][o.sprite.frame]);if(o.anchor==='bottom')y-=image.height;}
    if(y>=0&&y<240&&x<320)ops.push({kind:'sprite',image,x,y});
   }
   renderOutside({backing,current,operations:ops});
   const actual=canvas.getContext('2d').getImageData(0,0,640,480).data;
   for(let y=0;y<480;y++)for(let x=0;x<640;x++)for(let k=0;k<3;k++)if(actual[(y*640+x)*4+k]!==bg.palette[current[(y>>1)*320+(x>>1)]*3+k])throw Error('Browser Outside pixel mismatch '+character+'/'+keyset+'/'+x+'/'+y);
   result.push([...new Uint8Array(await crypto.subtle.digest('SHA-256',current))].map(n=>n.toString(16).padStart(2,'0')).join(''));
  }
  return result;
 });
 // Corrected composition oracles, source FILE0x196f9 /0x1a438 and
 // bitmap/sprite resource hashes in pins.json. Not the superseded BAN hashes.
 const expected=['70a6791e106dc273980451599c852fa0a74e6fe3c926580fa15ad5e9481b7042','2443bd6c7563f6d193abd29be1b87de403235aa035e79dac67166bb60d855b56','930024c5c25585105cfb6933199bfc4789ec43f10769300b419ca49e5b0d4d37'];
 expect(hashes).toEqual(expected.flatMap(h=>Array(5).fill(h)));
});

test.beforeEach(async({page})=>{
 await page.clock.install({time:new Date(2026,0,1)});await page.clock.pauseAt(new Date(2026,0,1,0,0,1));
});
for(const origin of ['manual','loaded']) test('Beginning '+origin+' elapsed, inactivity, report, Repeat and quit',async({page},info)=>{
 const record=Array(292).fill(0);record[21]=2;record[29]=10;record[274]=65;
 await page.addInitScript(({own,record})=>localStorage.setItem(own,JSON.stringify({schema:'mario2-students.v1',currentName:'A',students:[{name:'A',record}]})),{own,record});
 await page.goto('./');await finishStartup(page);await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 if(origin==='loaded') {
  await page.getByRole('button',{name:'Load student',exact:true}).click();await page.getByRole('button',{name:'Preview A',exact:true}).click();
  await page.getByRole('button',{name:'Load selected student',exact:true}).click();
 } else await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await page.clock.runFor(1000);await expect(page.getByRole('status')).toContainText('State 18 | Typed: 0');
 await page.keyboard.press('A');await expect(page.getByRole('status')).toContainText('Typed: 1');
 await page.screenshot({path:info.outputPath(origin+'-outside.png')});
 await page.clock.runFor(21000);await expect(page.getByRole('status')).toContainText('Report');
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),own);
 expect(saved.students[0].record[11]).toBe(0);
 expect(saved.students[0].record[19]).toBe(origin==='loaded'?21:0);
 await page.getByRole('button',{name:'Repeat',exact:true}).click();await page.getByRole('button',{name:'Skip movie',exact:true}).click();await expect(page.getByRole('status')).toContainText('State 18 | Typed: 0');
 await page.getByRole('button',{name:'Quit to Welcome',exact:true}).click();await page.keyboard.press('Enter');
 await expect(page.getByRole('status')).toContainText('Setup state 1');
});
test('loaded Beginning modal defers second writer and returns once to pending Water',async({page})=>{
 const record=Array(292).fill(0);record[1]=4;record[21]=1;record[274]=65;
 await page.addInitScript(({own,record})=>localStorage.setItem(own,JSON.stringify({schema:'mario2-students.v1',currentName:'A',students:[{name:'A',record}]})),{own,record});
 await page.goto('./');await finishStartup(page);await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await page.getByRole('button',{name:'Load student',exact:true}).click();await page.getByRole('button',{name:'Preview A',exact:true}).click();await page.getByRole('button',{name:'Load selected student',exact:true}).click();
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 for(let i=0;i<6;i++){await page.keyboard.press('A');await page.clock.runFor(10000);}
 await page.clock.runFor(100);await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 const modal=page.getByRole('dialog',{name:'Mario Teaches Typing 2',exact:true});await expect(modal).toContainText('passed the beginning level.');
 let r=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).students[0].record,own);expect(r[1]).toBe(4);expect(r[5]).toBe(0);expect(r[37]).toBe(0);
 await page.clock.runFor(2000);await modal.getByRole('button',{name:'OK',exact:true}).click();
 r=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).students[0].record,own);expect(r[1]).toBe(0);expect(r[5]).toBe(1);expect(r[37]).toBe(1);
 await page.getByRole('button',{name:'Repeat',exact:true}).click();await expect(page.getByRole('status')).toContainText('Water entry pending Phase4');
 await page.clock.runFor(1000);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).students[0].record[37],own)).toBe(1);
});

test('actual new student manual Beginning selection',async({page})=>{
 await page.goto('./');await finishStartup(page);await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await page.getByRole('button',{name:'New student',exact:true}).click();await page.getByRole('button',{name:'Luigi',exact:true}).click();
 await page.keyboard.type('BEGIN');await page.keyboard.press('Enter');await page.getByRole('button',{name:'Choose lesson plan',exact:true}).click();
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();await page.getByRole('button',{name:'Beginning',exact:true}).click();
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();await page.getByRole('button',{name:'Symbols',exact:true}).click();
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await page.clock.runFor(1000);await expect(page.getByRole('status')).toContainText('State 18');
});
