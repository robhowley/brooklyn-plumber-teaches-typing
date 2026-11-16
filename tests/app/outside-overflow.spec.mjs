import {test,expect} from '@playwright/test';
import {skipStartupUI,createStudentUI} from './source-path.mjs';

for(const [character,prefix,base] of [[1,'m',0],[2,'l',30],[3,'p',60]]) test(`Outside renders across signed distance overflow for ${prefix}`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Bounded browser fixture only: seed entry distance near the boundary in the
 // served authored module, not via a production mutation API. The Node lifecycle
 // regression reaches this boundary through retained movement without injection.
 await page.route('**/recovered/outdoor/outdoor.mjs',async route=>{
  const response=await route.fetch(),source=await response.text();
  const original='distance: previous?.distance ?? 0';
  expect(source.split(original)).toHaveLength(2);
  await route.fulfill({response,body:source.replace(original,'distance: previous?.distance ?? 32760')});
 });
 await page.clock.install();await page.addInitScript(()=>{window.__sourceTestClock=true;});
 await page.goto('./?seed=1');await skipStartupUI(page);
 await createStudentUI(page,{name:'OVERFLOW',character});
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 const game=page.locator('#game');await game.press('1');
 expect((await page.evaluate(()=>translationSnapshot())).outdoor.distance).toBe(32760);
 let crossed=false,negative=false;
 for(let i=0;i<12;i++) {
  await page.clock.runFor(60);
  const s=await page.evaluate(()=>translationSnapshot());
  crossed ||= s.outdoor.distance<0;
  if(s.outdoor.frame.kind==='run'&&s.outdoor.frame.index<0) {
   negative=true;
   const expected=`${prefix}jmp${String(s.outdoor.frame.index+21).padStart(4,'0')}_1`;
   const rendered=await page.evaluate(async({expected,base,index})=>{
    const data=await fetch('./app/data.json').then(r=>r.json());
    const sprite=data.sprites[`WALKING/${expected}`];
    // Confirm the live canvas contains the selected sprite's nonzero pixels.
    const s=translationSnapshot();
    const actual=document.querySelector('#game').getContext('2d').getImageData(0,0,320,200).data;
    const pixels=Uint8Array.from(atob(sprite.pixels),c=>c.charCodeAt(0));
    const [ox,oy]=sprite.headerWords;
    let compared=0,matches=true;
    pixels.forEach((value,i)=>{
     if(!value)return;
     const x=s.outdoor.x+ox+i%sprite.width,y=s.outdoor.y+oy+Math.floor(i/sprite.width);
     if(x<0||x>=320||y<0||y>=200)return;
     const rgb=data.palettes[`outdoor-${['m','l','p'][s.profile.character-1]}`].slice(value*3,value*3+3);
     matches &&= rgb.every((v,c)=>actual[(y*320+x)*4+c]===v);compared++;
    });
    return {index:sprite.index,expectedIndex:base+index+25,compared,matches};
   },{expected,base,index:s.outdoor.frame.index});
   expect(rendered.index).toBe(rendered.expectedIndex);expect(rendered.compared).toBeGreaterThan(0);expect(rendered.matches).toBe(true);
   break;
  }
 }
 expect(crossed).toBe(true);expect(negative).toBe(true);
 const before=await page.evaluate(()=>translationSnapshot().ticks);
 await page.clock.runFor(600);
 expect(await page.evaluate(()=>translationSnapshot().ticks)).toBeGreaterThan(before);
 await expect(page.locator('#status')).not.toContainText('Application stopped');
 await expect(game).toHaveAttribute('data-screen','outdoor');
 await game.press('Escape');await page.clock.runFor(60);
 await expect(game).toHaveAttribute('data-screen','results');expect(errors).toEqual([]);
});
