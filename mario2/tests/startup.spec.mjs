import {test,expect} from '@playwright/test';
import {finishStartup} from './startup-entry.mjs';
// Hashes from independent inert-data oracle, LOGO/INTRO member hashes in pins.json.
// Plane hashes are concatenated as ASCII hex in source frame order, then SHA256.
const oracle=[
 {frames:48,planes:'db7ba07b1e0d648b49901bfc52d24532a835e542068f7ffc05c5dfe23b9a1b4a',palette:'68dff72189a4c726ab8f9938c94e603838bae80208885317309574257851949d',pcm:'66dea79ba6c91597f9f36322231720e01962c6e2c9af51ff87f36503e35f6811'},
 {frames:266,planes:'ffc6cecff32905e00b62ed19f41ab0392c1523c86c9c079db1182d7f834a7145',palette:'1b300cc861596071aa25cd1da5dccd8c6d0196284e5101a77a16f18bd4f134f6',pcm:'212bf7ba466991280affc6b2741c6dff96831b6872da0369297613997b4bfd9d'},
];
async function observe(page){
 await page.route('**/main.js',async route=>{
  const response=await route.fetch();
  const source=(await response.text()).replace("import {createMedia} from './media.js';",`
 import {createMedia as originalMedia} from './media.js';
 const createMedia=options=>{
  window.startupTrace=[];window.startupFrames=[[],[]];window.startupPixels=[];window.audioCalls=[];window.movieCalls=[];
  const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  const media=originalMedia({...options,emit(event){
   options.emit(event);
   if(event.kind==='movie')window.startupTrace.push([event.selector,event.type,event.frame]);
   if(event.type==='frame'&&event.selector<2){
    window.startupFrames[event.selector].push(Promise.all([digest(event.pixels),digest(event.palette)]));
    const actual=document.querySelector('canvas').getContext('2d').getImageData(0,0,640,480).data;
    let errors=0;for(let i=0;i<event.pixels.length;i++)for(let c=0;c<3;c++)if(actual[i*4+c]!==event.palette[event.pixels[i]*3+c])errors++;
    window.startupPixels.push(errors);
   }
  }});
  return {...media,playMovie(selector){window.movieCalls.push(selector);return media.playMovie(selector);},audio(...args){window.audioCalls.push(args);return media.audio(...args);}};
 };`);
  await route.fulfill({response,body:source});
 });
}
test('natural 314-frame route, every displayed opaque pixel and palette, PCM and one-shot Welcome',async({page},info)=>{
 test.setTimeout(90000);await observe(page);
 await page.addInitScript(()=>{
  const Native=AudioContext;window.AudioContext=class extends Native {
   enabled=false;get state(){return this.enabled?super.state:'suspended';}
   async resume(){await super.resume();this.enabled=true;}
  };
 });
 await page.goto('./');await expect(page.locator('#media-status')).toContainText('autoplay-blocked');
 await expect(page.getByRole('status')).toHaveText('Startup LOGO');
 await page.getByRole('button',{name:'Enable audio / Retry',exact:true}).click();
 await expect(page.locator('#media-status')).toContainText('Movie 0 playing');
 await page.screenshot({path:info.outputPath('startup-logo.png')});
 await expect(page.getByRole('status')).toHaveText('Startup INTRO',{timeout:15000});
 await expect(page.locator('#media-status')).toContainText('Movie 1 playing');
 await page.screenshot({path:info.outputPath('startup-intro.png')});
 expect(await page.evaluate(()=>window.audioCalls)).toEqual([]);
 await expect(page.getByRole('button',{name:'New student',exact:true})).toBeVisible({timeout:40000});
 const proof=await page.evaluate(async()=>{
  const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  const a=await(await fetch('./assets.json')).json(),movies=[];
  for(let selector=0;selector<2;selector++){
   const frames=await Promise.all(window.startupFrames[selector]);
   const entry=a.assets['movies-'+selector],url=Object.entries(entry.files).find(([name])=>name.endsWith('-audio.wav'))[1];
   const wav=new Uint8Array(await(await fetch(url)).arrayBuffer()),v=new DataView(wav.buffer);let pcm;
   for(let p=12;p+8<=wav.length;){const size=v.getUint32(p+4,true);if(String.fromCharCode(...wav.slice(p,p+4))==='data'){pcm=wav.slice(p+8,p+8+size);break;}p+=8+size+(size&1);}
   movies.push({frames:frames.length,planes:await digest(new TextEncoder().encode(frames.map(f=>f[0]).join(''))),palettes:[...new Set(frames.map(f=>f[1]))],pcm:await digest(pcm)});
  }
  return {movies,pixelErrors:window.startupPixels.filter(Boolean),trace:window.startupTrace.filter(([,t])=>t==='ended'||t==='skipped'),audio:window.audioCalls};
 });
 expect(proof.pixelErrors).toEqual([]);
 for(let i=0;i<2;i++){
  const {palette,...expected}=oracle[i];expect(proof.movies[i]).toEqual({...expected,palettes:[palette]});
 }
 expect(proof.trace).toEqual([[0,'ended',undefined],[1,'ended',undefined]]);
 expect(proof.audio.slice(0,2)).toEqual([[10,1],[1,3]]);
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await page.screenshot({path:info.outputPath('startup-welcome.png')});
});
test('failed startup holds, retry has no Welcome music, ordered keyboard/mouse skip, focus/hidden and reentry',async({page})=>{
 await observe(page);await page.clock.install();await page.clock.pauseAt(new Date());
 await page.route('**/stream-*-audio.wav',route=>route.fulfill({status:404,body:'missing'}));
 await page.goto('./');await expect(page.locator('#media-status')).toContainText('failed');
 await page.clock.runFor(5000);await expect(page.getByRole('status')).toHaveText('Startup LOGO');
 await page.getByRole('button',{name:'Enable audio / Retry',exact:true}).click();
 expect(await page.evaluate(()=>window.audioCalls)).toEqual([]);
 await page.keyboard.press('Escape'); // consumed, cannot exit
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.clock.runFor(2000);
 await expect(page.getByRole('status')).toHaveText('Startup LOGO');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:true}));
 await page.clock.runFor(2000);await expect(page.getByRole('status')).toHaveText('Startup LOGO');
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:false}));
 await page.clock.runFor(400);await expect(page.getByRole('status')).toHaveText('Startup INTRO');
 await page.locator('canvas').click();await page.clock.runFor(600);
 await expect(page.getByRole('status')).toContainText('Setup state 1');
 await page.keyboard.press('a'); // welcome speech skip, no New Student
 await expect(page.getByRole('status')).toContainText('Setup state 1');
 await page.getByRole('button',{name:'New student',exact:true}).click();
 await page.getByRole('button',{name:'Quit to Welcome',exact:true}).click();await page.keyboard.press('Enter');
 await expect(page.getByRole('status')).toContainText('Setup state 1');
 expect(await page.evaluate(()=>window.movieCalls.filter(s=>s<2))).toEqual([0,0,1]);
 await page.reload();await finishStartup(page);
});
