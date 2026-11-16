import {test,expect} from '@playwright/test';
import {skipStartupUI,createStudentUI} from './source-path.mjs';

// Compare decoded resource samples to browser RGBA, not reference screenshots
// or original hardware. FILE/resource identities are pinned by outdoor.test.mjs
// and the generated analysis/outdoor/evidence.json, assets/render/manifest.json.
async function promptPixels(page,code) {
 return page.evaluate(async code=>{
  const data=await fetch('./app/data.json').then(r=>r.json());
  const raw=Uint8Array.from(atob(data.sprites[`FONT7H/font7_${code}`].pixels),c=>c.charCodeAt(0));
  const background=Uint8Array.from(atob(data.backgrounds.OUTSIDE.pixels),c=>c.charCodeAt(0));
  const actual=document.querySelector('#game').getContext('2d').getImageData(0,0,320,200).data;
  const palette=data.palettes[`outdoor-${['m','l','p'][translationSnapshot().profile.character-1]}`];
  let mismatches=0;
  raw.forEach((v,i)=>{
   const p=(155+Math.floor(i/10))*320+175+i%10,index=v===1?15:v===2?0:background[p];
   if(!palette.slice(index*3,index*3+3).every((v,c)=>actual[p*4+c]===v))mismatches++;
  });
  return mismatches;
 },code);
}

for(const character of [1,2,3]) {
 test(`Outside character${character} live prompt snapshots before input and clears from background`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.addInitScript(()=>{window.__sourceTestClock=true;});
  await page.goto('./?seed=1');await skipStartupUI(page);
  await createStudentUI(page,{name:'IMAGERY',character});
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
  const game=page.locator('#game');await game.press('1');await page.clock.runFor(60);
  let s=await page.evaluate(()=>translationSnapshot());
  const code=s.outdoor.obstacles[s.outdoor.targetIndex].code;
  expect(s.outdoor.promptCode).toBe(code);expect(await promptPixels(page,code)).toBe(0);
  for(const key of ['Tab',String.fromCharCode(code===65?66:65)]) {
   await game.press(key);await page.clock.runFor(60);
   s=await page.evaluate(()=>translationSnapshot());
   expect(s.outdoor.promptCode).toBe(code);expect(await promptPixels(page,code)).toBe(0);
  }
  await game.press(String.fromCharCode(code));await page.clock.runFor(60);
  s=await page.evaluate(()=>translationSnapshot());
  expect(s.outdoor.correct).toBe(1);expect(s.outdoor.obstacles[0].code).toBe(0);
  expect(s.outdoor.obstacles[0].countdown).toBe(6);
  expect(s.outdoor.promptCode).toBe(code);expect(await promptPixels(page,code)).toBe(0);
  await page.clock.runFor(60);s=await page.evaluate(()=>translationSnapshot());
  expect(s.outdoor.promptCode).toBe(32);expect(await promptPixels(page,32)).toBe(0);
  expect(errors).toEqual([]);
 });

 test(`Outside character${character} decoded actors, stamped lifetimes, abort and reentry`,async({page},testInfo)=>{
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto('./?seed=1');
  // Test-owned canvas and ordinary exported modules from built dist. No injected
  // production mutation API, served-module replacement or archive execution.
  const result=await page.evaluate(async character=>{
   const {Renderer}=await import('./app/render.mjs');
   const {createOutdoor,makeObstacle,selectTarget,acceptKey,updateObstacles,updatePlayer}=await import('./recovered/outdoor/outdoor.mjs');
   const data=await fetch('./app/data.json').then(r=>r.json()),prefix=['m','l','p'][character-1];
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=200;
   const r=new Renderer(canvas,data);await r.load();const schedule=data.idleSchedules[prefix];
   const fresh=previous=>createOutdoor({bytes:new TextEncoder().encode('AB'),seed:1,character,previous});
   const decode=s=>Uint8Array.from(atob(s.pixels),c=>c.charCodeAt(0));
   const palette=data.palettes[`outdoor-${prefix}`],failures=[],trace=[];
   const compare=(sprite,raw,x,y,label,opaque=false)=>{
    const actual=canvas.getContext('2d').getImageData(0,0,320,200).data;
    const [ox,oy]=sprite.headerWords;let compared=0,mismatches=0;
    raw.forEach((v,i)=>{
     if(!v&&!opaque)return;const px=x+ox+i%sprite.width,py=y+oy+Math.floor(i/sprite.width);
     if(px<0||px>=320||py<0||py>=200)return;
     if(!palette.slice(v*3,v*3+3).every((v,c)=>actual[(py*320+px)*4+c]===v))mismatches++;
     compared++;
    });
    trace.push({label,index:sprite.index,compared,mismatches});
    if(!compared||mismatches)failures.push(label);
   };
   let s=fresh();
   const actor=(kind,index,label)=>{
    if(s.frame.kind!==kind||s.frame.index!==index)failures.push(label+' frame');
    r.outdoor(s,{},null);
    const name=kind==='idle'?`IDLE/${prefix}std${String(schedule.thresholds[index]).padStart(4,'0')}_1`:`WALKING/${prefix}jmp0019_1`;
    const sprite=data.sprites[name];compare(sprite,decode(sprite),s.x,s.y,label);
   };
   const abort=(index,label)=>{
    s.mode=1;s.jumpIndex=0;updatePlayer(s,schedule.thresholds,schedule.halfTickPeriod);s.mode=2;
    for(let n=1;n<=11;n++) {
     updatePlayer(s,schedule.thresholds,schedule.halfTickPeriod);
     actor(n===11?'jump':'idle',n===11?11:index,`${label}-${n}`);
    }
    if(s.mode!==3||s.y!==85)failures.push(label+' terminal');
   };
   actor('idle',0,'entry');abort(0,'initial-idle-abort');
   s.mode=0;s.cursorX=-1;s.stillTicks=10;s.idleTicks=schedule.thresholds[2]*2;
   updatePlayer(s,schedule.thresholds,schedule.halfTickPeriod);const later=s.frame.index;
   if(later<=0)failures.push('later idle');
   s.cursorX=300;updatePlayer(s,schedule.thresholds,schedule.halfTickPeriod);
   abort(later,'later-idle-abort');s=fresh(s);actor('idle',0,'reentry');abort(0,'reentry-abort');
   for(const draw of [0,32767]) {
    s=fresh();const o={...makeObstacle(65,draw),x:200};s.obstacles[0]=o;s.scroll=0;
    selectTarget(s);acceptKey(s,65);
    for(let n=0;n<=6;n++) {
     r.outdoor(s,{},null);
     if(o.active!==(n<6)||o.countdown!==6-n)failures.push(`lifetime-${draw}-${n}`);
     if(n<6) {
      const block=o.type===1,name=`OUTSIDE/${block?'brick1_1':n?'turt1_2':'turt1_1'}`;
      const sprite=data.sprites[name],raw=decode(sprite);
      if(block||n===0) {
       const glyph=data.sprites['FONT7H/font7_65'];
       decode(glyph).forEach((v,i)=>{if(v)raw[(3+Math.floor(i/10))*sprite.width+(block?6:15)+i%10]=v===1?15:31;});
      }
      compare(sprite,raw,o.x+(block?(character===3?36:0):30),o.y+(block&&character===3?30:0),`obstacle-${draw}-${n}`);
     }
     if(n===6) {
      const background=decode(data.backgrounds.OUTSIDE);
      for(const p of s.particles) {
       const sprite=data.sprites['OUTSIDE/expls1_1'],[ox,oy]=sprite.headerWords;
       decode(sprite).forEach((v,i)=>{if(v)background[(p.y+oy+Math.floor(i/sprite.width))*320+p.x+ox+i%sprite.width]=v;});
      }
      const block=o.type===1,width=block?20:30,height=block?16:17;
      const x=200+(block?(character===3?36:0):30),y=o.y+(block&&character===3?30:0);
      const raw=Uint8Array.from({length:width*height},(_,i)=>background[(y+Math.floor(i/width))*320+x+i%width]);
      compare({headerWords:[0,0,width,height],width,height},raw,x,y,`destroyed-${draw}`,true);
     } else updateObstacles(s);
    }
   }
   return {character,failures,trace};
  },character);
  await testInfo.attach('decoded-source-comparisons',{body:JSON.stringify(result),contentType:'application/json'});
  expect(result.failures).toEqual([]);expect(result.trace.length).toBe(49);
 });
}
