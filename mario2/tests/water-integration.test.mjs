import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {createWater} from '../water.js';
import {waterOperations,renderWater} from '../water-render.js';

test('direct Water rules transport and scene pixels at first/input/reentry/failure/special boundaries',()=>{
  const dist=new URL('../dist/',import.meta.url);
  const catalog=JSON.parse(readFileSync(new URL('assets.json',dist)));
  const presentation=JSON.parse(readFileSync(new URL('presentation.json',dist)));
  const font=new Uint8Array(readFileSync(new URL('font.bin',dist)));
  const bitmaps=new Map(Object.entries(catalog.assets).filter(([id])=>id.startsWith('ne-2-')).map(([id,a])=>[
    Number(id.slice(5)),{...a.data.image,pixels:new Uint8Array(inflateSync(readFileSync(new URL(a.files['pixels.zlib'],dist))))},
  ]));
  const backing=bitmaps.get(121).pixels,current=new Uint8Array(backing),expected=new Uint8Array(backing);
  const scene=()=>createWater({animation:presentation.waterAnimation,lesson:{bytes:[97,98,99]},random:{next:()=>1},nowMs:0,durationSeconds:600});
  function check(name,result,count){
    // Pass production effects unchanged. An independent effect walk checks the
    // object boundary and paints the scene below the separately tested HUD/row.
    const effects=result.effects,operations=waterOperations(effects,{font,bitmaps,presentation});
    const objects=effects.filter(e=>e.type==='draw'&&e.operation.type==='object').map(e=>e.operation.object);
    const sprites=operations.filter(o=>o.kind==='sprite');
    assert.equal(sprites.length,count??objects.length,name+' sprites');
    assert.equal(sprites.length,objects.length,name+' no dropped objects');
    for(const effect of effects){
      if(effect.type!=='draw')continue;
      const op=effect.operation;
      if(op.type==='restore')expected.set(backing.subarray(74*320),74*320);
      if(op.type==='object'){
        const o=op.object,image=bitmaps.get(presentation.waterSprites[o.sprite.selector][o.sprite.frame]);
        const top=o.anchor==='bottom'?o.y-image.height:o.y;
        for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
          const dx=o.x+x,dy=top+y,v=image.pixels[y*image.width+x];
          if(dx>=0&&dx<320&&dy>=74&&dy<240&&v!==0&&v!==63)expected[dy*320+dx]=v;
        }
      }
      if(op.type==='glyph')for(let y=0;y<8;y++)for(let x=0;x<8;x++){
        const dx=op.x+x,dy=op.y+y,p=dy*320+dx;
        if(dx<0||dx>=320||dy<74||dy>=240)continue;
        if(font[op.byte*8+y]&(128>>x))expected[p]=op.color;
        else if(op.unset==='backing')expected[p]=backing[p];
      }
    }
    renderWater({backing,current,operations});
    assert.deepEqual(current.subarray(74*320),expected.subarray(74*320),name+' scene pixels');
  }
  const s=scene();check('entry',{effects:s.entryEffects},0);
  check('first',s.acceptedUpdate(0),25);
  check('correct',s.keyDown(97),0);check('wrong',s.keyDown(1),0);
  check('after-input',s.acceptedUpdate(0),25);
  check('reentry',s.reenter({lesson:{bytes:[32,97]},durationSeconds:600,nowMs:0}),0);
  check('reentry-first',s.acceptedUpdate(0),25);
  const failure=scene();
  for(let t=1;t<=248;t++){
    const r=failure.acceptedUpdate(t*100);
    if([200,201,205,206,247,248].includes(t))check('failure'+t,r,25);
  }
  const special=scene();let r;
  for(let t=1;t<=220;t++){
    if(t===100||t===200)special.keyDown(1);
    r=special.acceptedUpdate(t*100);
  }
  check('special-active',r,26);
  check('special-held',special.keyDown(r.view.specialByte),0);
  check('special-return',special.finishSpecial(),0);
  check('retirement-draw',special.acceptedUpdate(22100),26);
  check('retired',special.acceptedUpdate(22200),25);
});
