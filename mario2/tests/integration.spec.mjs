import {test,expect} from '@playwright/test';
const own='mtt2-static-translation.students.v1';
test.beforeEach(async({page})=>{
 // Observe the real coordinator calls without replacing transport or its results.
 await page.route('**/main.js',async route=>{
  const response=await route.fetch();
  const source=(await response.text()).replace("import {createMedia} from './media.js';",
   "import {createMedia as nativeMedia} from './media.js'; const createMedia=options=>{const media=nativeMedia(options);window.audioCalls=[];window.mediaSnapshot=()=>media.snapshot();return {...media,audio(...args){window.audioCalls.push(args);return media.audio(...args);}};};");
  await route.fulfill({response,body:source});
 });
 await page.clock.install({time:new Date(2026,0,1)});
 await page.clock.pauseAt(new Date(2026,0,1,0,0,1));
});
test('indexed menu hit requests source audio10 before selection, rejected and consumed clicks do not',async({page})=>{
 await page.goto('./');
 await expect(page.getByRole('button',{name:'Skip movie',exact:true})).toBeVisible();
 const canvas=page.locator('canvas');
 const calls=()=>page.evaluate(()=>window.audioCalls.filter(([s])=>s===10));
 // Same hotspot during Welcome speech consumes the click as movie skip.
 await canvas.click({position:{x:140,y:210}});
 expect(await calls()).toEqual([]);
 await canvas.click({position:{x:1,y:1}});
 expect(await calls()).toEqual([]);
 await page.getByRole('button',{name:'Enable audio / Retry',exact:true}).click();
 // Inclusive source rectangle left/top edge: New Student -> state2.
 await canvas.click({position:{x:90,y:175}});
 await expect(page.getByRole('status')).toContainText('Setup state 2');
 expect(await calls()).toEqual([[10,3]]);
 await expect.poll(()=>page.evaluate(()=>window.mediaSnapshot().audio.find(a=>a.selector===10)?.state)).toBe('playing');
 // FILE 0x17684: state2 selector28 is disabled with no saved students.
 expect(await page.evaluate(key=>localStorage.getItem(key),own)).toBeNull();
 const bounds=await canvas.boundingBox();
 await canvas.click({position:{x:619*bounds.width/640,y:459*bounds.height/480}});
 await expect(page.getByRole('status')).toContainText('Setup state 2');
 expect(await calls()).toEqual([[10,3]]);
 await page.getByRole('button',{name:'Quit to Welcome',exact:true}).click();
 // Inject a canvas event behind the modal to prove the coordinator guard too.
 await canvas.dispatchEvent('click',{clientX:140,clientY:210});
 expect(await calls()).toEqual([[10,3]]);
 await page.keyboard.press('Escape');
});
test('live typing and fixture canvas clicks never request menu audio10',async({page})=>{
 await enter(page);
 await page.locator('canvas').click({position:{x:140,y:210}});
 await page.keyboard.press('z');
 expect(await page.evaluate(()=>window.audioCalls.filter(([s])=>s===10))).toEqual([]);
 await page.locator('summary').click();
 await page.locator('#report').click();
 await page.locator('canvas').click({position:{x:140,y:210}});
 expect(await page.evaluate(()=>window.audioCalls.filter(([s])=>s===10))).toEqual([]);
});
async function enter(page) {
 await page.goto('./');
 await expect(page.getByRole('button',{name:'New student',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 for(const label of ['New student','Mario']) await page.getByRole('button',{name:label,exact:true}).click();
 await page.keyboard.type('LIVE');await page.keyboard.press('Enter');
 for(const label of ['Choose lesson plan','Express']) {
  await page.getByRole('button',{name:label,exact:true}).click();
  await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 }
 expect(await page.evaluate(()=>window.audioCalls.at(-1))).toEqual([0,32]);
 await page.getByRole('button',{name:'Home',exact:true}).click();
}
test('live typing accepts correct, wrong and repeat keydowns, never Enter or keyup; focus retains state',async({page},info)=>{
 await enter(page);
 const key=(await page.locator('canvas').getAttribute('aria-label')).slice('Next key: '.length);
 await page.keyboard.press(key===' '?'Space':key);
 await expect(page.getByRole('status')).toContainText('Typed: 1 | Errors: 0');
 const glyph=await page.evaluate(async key=>{
  const {loadAssets}=await import('./assets.js');const a=await loadAssets(new URL('./assets.json',location.href));
  const ctx=document.querySelector('canvas').getContext('2d');
  for(let y=0;y<8;y++) for(let x=0;x<8;x++) if(a.font[key.charCodeAt(0)*8+y]&(128>>x))
   return [Array.from(ctx.getImageData((28+x)*2,(120+y)*2,1,1).data),[...a.bitmaps.get(123).palette.slice(93,96),255]];
 },key);
 if(glyph) expect(glyph[0]).toEqual(glyph[1]);
 const next=(await page.locator('canvas').getAttribute('aria-label')).slice('Next key: '.length);
 const wrong=next==='z'?'x':'z';
 await page.keyboard.down(wrong);await page.keyboard.down(wrong);await page.keyboard.up(wrong);
 await page.keyboard.press('Enter');
 await expect(page.getByRole('status')).toContainText('Typed: 3 | Errors: 2');
 // Browser focus-event binding, not a claim about historical OS event ordering.
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await page.clock.runFor(2000);
 await expect(page.getByRole('status')).toContainText('Elapsed: 0');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 expect(await page.evaluate(()=>window.audioCalls.at(-1))).toEqual([5,3]);
 await page.getByRole('button',{name:'Enable audio / Retry',exact:true}).click();
 expect(await page.evaluate(()=>window.audioCalls.at(-1))).toEqual([5,3]);
 await page.clock.runFor(500);
 await expect(page.getByRole('status')).toContainText('Typed: 3 | Errors: 2 | Elapsed: 2');
 await page.screenshot({path:info.outputPath('live-typing.png')});
 expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([own]);
});
test('hidden-document timer gate preserves counters and catches up without rebasing (browser event vector)',async({page})=>{
 await enter(page);await page.keyboard.press('z');
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:true}));
 await page.clock.runFor(5000);
 await expect(page.getByRole('status')).toContainText('Typed: 1 | Errors: 1 | Elapsed: 0');
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:false}));
 await page.clock.runFor(500);
 await expect(page.getByRole('status')).toContainText('Elapsed: 2');
});
test('expiry is sampled then handed off on the next visit, input can intervene',async({page},info)=>{
 await enter(page);
 await page.evaluate(key=>{
  const file=JSON.parse(localStorage.getItem(key));file.students[0].record[27]=0;file.students[0].record[28]=0;
  localStorage.setItem(key,JSON.stringify(file));
 },own);
 await page.reload();await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.clock.runFor(1000);
 await page.keyboard.press('z');
 await expect(page.getByRole('status')).toContainText('Typed: 1');
 await page.clock.runFor(100);
 await expect(page.getByRole('status')).toContainText('Report');
 await page.keyboard.press('x'); // Skip only, not typing or Repeat.
 await expect(page.getByRole('status')).toContainText('Keys Typed:    1');
 await page.screenshot({path:info.outputPath('finish-handoff.png')});
});
test('real welcome movie emits a displayed frame before explicit skip',async({page},info)=>{
 await page.goto('./');
 await expect(page.locator('#media-status')).toContainText('playing');
 expect(await page.evaluate(()=>window.audioCalls[0])).toEqual([1,3]);
 await page.screenshot({path:info.outputPath('welcome-movie.png')});
 await page.keyboard.press('Enter');
 await expect(page.locator('#media-status')).toContainText('skipped');
 await expect(page.getByRole('status')).toContainText('Setup state 1');
});
test('injected autoplay refusal is visible and does not complete welcome',async({page})=>{
 await page.addInitScript(()=>{const Native=AudioContext;window.AudioContext=class extends Native {get state(){return 'suspended';} async resume(){throw Error('Injected autoplay denial');}};});
 await page.goto('./');
 await expect(page.locator('#media-status')).toContainText('autoplay-blocked');
 await page.getByRole('button',{name:'New student',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Setup state 1');
 await page.keyboard.press('a');
 await expect(page.locator('#media-status')).toContainText('skipped');
 await expect(page.getByRole('status')).toContainText('Setup state 1');
});
test('explicit audio unlock restarts selection1 while retrying welcome speech',async({page})=>{
 await page.addInitScript(()=>{
  const Native=AudioContext;window.AudioContext=class extends Native {
   enabled=false;
   get state(){return this.enabled ? super.state : 'suspended';}
   async resume(){await super.resume();this.enabled=true;}
  };
 });
 await page.goto('./');await expect(page.locator('#media-status')).toContainText('autoplay-blocked');
 await page.getByRole('button',{name:'Enable audio / Retry',exact:true}).click();
 await expect(page.locator('#media-status')).toContainText('playing');
 expect(await page.evaluate(()=>window.audioCalls)).toEqual([[1,3],[1,3]]);
});
test('late retired fetch cannot emit or revive an older clip (browser transport vector)',async({page})=>{
 await page.goto('./');await expect(page.getByRole('button',{name:'New student',exact:true})).toBeVisible();
 const events=await page.evaluate(async()=>{
  const {createMedia}=await import('./media.js');
  const manifest=await (await fetch('./assets.json')).json();
  const native=new AudioContext(), events=[];let release;
  const url=new URL(manifest.assets['movies-41'].files['frames.zlib'],location.href).href;
  const pending=new Promise(resolve=>release=resolve);
  const media=createMedia({manifest,manifestURL:location.href+'assets.json',
   audioContext:{get state(){return 'suspended';},decodeAudioData:bytes=>native.decodeAudioData(bytes)},
   fetch:async input=>{const response=await fetch(input);if(String(input)===url) await pending;return response;},emit:e=>events.push({id:e.id,type:e.type})});
  const old=media.playMovie(41);await media.playMovie(14);media.skip();release();await old;
  media.dispose();await native.close();return events;
 });
 expect(events).toEqual([{id:2,type:'autoplay-blocked'},{id:2,type:'skipped'}]);
});
test('browser renderer vectors restore each frame and distinguish index245 from10',async({page},info)=>{
 await page.goto('./');
 await expect(page.getByRole('button',{name:'New student',exact:true})).toBeVisible();
 const result=await page.evaluate(async()=>{
  const {loadAssets}=await import('./assets.js'),{createRenderer}=await import('./render.js');
  const assets=await loadAssets(new URL('./assets.json',location.href));
  const canvas=document.createElement('canvas');document.body.append(canvas);
  const renderer=createRenderer(canvas,assets,{paletteEndpoints:{low:new Uint8Array(30),high:new Uint8Array(30)}});
  renderer.enter({state:14});
  const pixel=x=>Array.from(canvas.getContext('2d').getImageData(x,0,1,1).data);
  const bg=[pixel(0),pixel(1)];
  renderer.movieFrame({width:2,height:1,pixels:Uint8Array.of(245,10),palette:assets.bitmaps.get(119).palette,x:0,y:0,transparentIndex:245});
  const first=[pixel(0),pixel(1)];
  renderer.movieFrame({width:2,height:1,pixels:Uint8Array.of(245,10),palette:assets.bitmaps.get(119).palette,x:0,y:0,transparentIndex:10});
  const second=[pixel(0),pixel(1)];
  renderer.draw();return {bg,first,second,restored:[pixel(0),pixel(1)],palette:assets.bitmaps.get(119).palette.slice(30,33)};
 });
 expect(result.first[0]).toEqual(result.bg[0]);
 expect(result.first[1]).toEqual([...Object.values(result.palette),255]);
 expect(result.second[1]).toEqual(result.bg[1]);
 expect(result.second[0]).not.toEqual(result.first[0]);
 expect(result.restored).toEqual(result.bg);
 await page.screenshot({path:info.outputPath('movie-index-vectors.png')});
});
test('integrated original movie14 frame uses AVI RGB for opaque indices',async({page},info)=>{
 await page.goto('./');await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 for(const label of ['New student','Mario']) await page.getByRole('button',{name:label,exact:true}).click();
 await page.keyboard.press('Enter');await page.getByRole('button',{name:'Choose lesson plan',exact:true}).click();
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await page.getByRole('button',{name:'Express',exact:true}).click();
 await expect(page.locator('#media-status')).toContainText('Movie 14 playing');
 const proof=await page.evaluate(async()=>{
  const {loadAssets}=await import('./assets.js');const a=await loadAssets(new URL('./assets.json',location.href));
  const entry=a.manifest.assets['movies-14'],f=entry.data.decoded_frames[0];
  const packed=await (await fetch(entry.files['frames.zlib'])).arrayBuffer();
  const pixels=new Uint8Array(await new Response(new Blob([packed.slice(f.output_offset,f.output_offset+f.compressed_bytes)])
   .stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  const palette=Uint8Array.from(f.palette_rgb_hex.match(/../g),x=>parseInt(x,16));
  const bg=a.bitmaps.get(119),ctx=document.querySelector('canvas').getContext('2d');
  let opaque=0,transparent=0,different=0;const errors=[];
  for(let y=0;y<f.height;y++) for(let x=0;x<f.width;x++){
   const index=pixels[y*f.width+x],bx=x+20,by=y+60;
   if(index===245){transparent++;continue;}
   opaque++;if(palette.slice(index*3,index*3+3).some((v,i)=>v!==bg.palette[index*3+i])) different++;
   const actual=ctx.getImageData(bx,by,1,1).data;
   if(palette.slice(index*3,index*3+3).some((v,i)=>v!==actual[i]) && errors.length<4) errors.push([x,y,index,...actual]);
  }
  return {opaque,transparent,different,errors};
 });
 expect(proof.errors).toEqual([]);expect(proof.opaque).toBeGreaterThan(0);
 // The actual first frame has no key245 pixels. Do not manufacture them.
 expect(proof.transparent).toBe(0);expect(proof.different).toBeGreaterThan(0);
 await page.screenshot({path:info.outputPath('original-movie14-palette.png')});
});
test('original movie40 and51 frames retain DIB colors through their real key77 and10 pixels',async({page},info)=>{
 await page.goto('./');
 const proofs=await page.evaluate(async()=>{
  const {loadAssets}=await import('./assets.js'),{createRenderer}=await import('./render.js');
  const a=await loadAssets(new URL('./assets.json',location.href));const proofs=[];
  for(const selector of [40,51]){
   const entry=a.manifest.assets['movies-'+selector],f=entry.data.decoded_frames[0],p=entry.placement;
   const bytes=await (await fetch(entry.files['frames.zlib'])).arrayBuffer();
   const pixels=new Uint8Array(await new Response(new Blob([bytes.slice(f.output_offset,f.output_offset+f.compressed_bytes)])
    .stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
   const palette=Uint8Array.from(f.palette_rgb_hex.match(/../g),x=>parseInt(x,16));
   const c=document.createElement('canvas');document.body.append(c);const ctx=c.getContext('2d');
   const renderer=createRenderer(c,a,{paletteEndpoints:{low:new Uint8Array(30),high:new Uint8Array(30)}});
   renderer.enter({state:14});const bg=ctx.getImageData(0,0,640,480).data;
   renderer.movieFrame({...f,pixels,palette,x:p.field_u16_2,y:p.field_u16_4,transparentIndex:p.byte6});
   const actual=ctx.getImageData(0,0,640,480).data;let transparent=0,opaque=0,errors=0;
   for(let y=0;y<f.height;y++) for(let x=0;x<f.width;x++){
    const index=pixels[y*f.width+x],at=((y+p.field_u16_4)*640+x+p.field_u16_2)*4;
    const expected=index===p.byte6 ? bg.slice(at,at+3) : palette.slice(index*3,index*3+3);
    if(index===p.byte6) transparent++;else opaque++;
    if(expected.some((v,i)=>actual[at+i]!==v)) errors++;
   }
   renderer.draw();const restored=ctx.getImageData(0,0,640,480).data;
   proofs.push({selector,transparent,opaque,errors,restored:restored.every((v,i)=>v===bg[i])});
   renderer.movieFrame({...f,pixels,palette,x:p.field_u16_2,y:p.field_u16_4,transparentIndex:p.byte6});
  }
  return proofs;
 });
 for(const p of proofs){expect(p.transparent).toBeGreaterThan(0);expect(p.opaque).toBeGreaterThan(0);expect(p.errors).toBe(0);expect(p.restored).toBe(true);}
 await page.screenshot({path:info.outputPath('original-keyed-frames.png'),fullPage:true});
});
test('pinned setup list drives every one of the 24 RNG positions',async({page})=>{
 await page.goto('./');
 const proof=await page.evaluate(async()=>{
  const table=(await (await fetch('./presentation.json')).json()).setupMovies;
  const {setupMovie}=await import('./selection.js');
  return {hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(table))),x=>x.toString(16).padStart(2,'0')).join(''),
   actual:table.map((_,next)=>setupMovie(table,{next:()=>next})),table};
 });
 expect(proof.hash).toBe('7a504184809c203f29bce8bddf5b8a085bd3972dbe56ec3983ac56f48c7eacb9');
 expect(proof.actual).toEqual(proof.table);expect(proof.table).toHaveLength(24);
});
test('failed movies visibly hold setup; a skip key cannot also select or type',async({page})=>{
 await page.route('**/stream-*-audio.wav',route=>route.fulfill({status:404,body:'missing'}));
 await page.goto('./');
 await expect(page.getByRole('button',{name:'New student',exact:true})).toBeVisible();
 await page.clock.runFor(20);
 // Wait for the fetch failure, no completion deadline is installed.
 await expect(page.locator('#media-status')).toContainText('failed');
 await page.getByRole('button',{name:'New student',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Setup state 1');
 await page.keyboard.press('a');
 await expect(page.getByRole('status')).toContainText('Setup state 1');
 await page.getByRole('button',{name:'New student',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Setup state 2');
});

async function fastContinue(page,keyset=0,threshold=0,previous=0) {
 await enter(page);
 await page.evaluate(({own,keyset,threshold,previous})=>{
  const file=JSON.parse(localStorage.getItem(own)),r=file.students[0].record;
  r[1]=keyset;r[27]=0;r[28]=0;r[35]=threshold;r[36]=0;r[11]=previous;r[12]=0;
  localStorage.setItem(own,JSON.stringify(file));
 },{own,keyset,threshold,previous});
 await page.reload();await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
}
for(const [label,threshold,previous,selectors,audio] of [
 ['pass',10,0,[51,52],7],['lower',20,13,[60,61],8],
 ['higher',20,1,[53,54],8],['equal',20,12,[56,57,58,59],8],
]) test('calculated report compares previous speed before mutation: '+label,async({page})=>{
 await fastContinue(page,0,threshold,previous);
 const key=(await page.locator('canvas').getAttribute('aria-label')).slice('Next key: '.length);
 await page.keyboard.press(key===' '?'Space':key);await page.clock.runFor(1100);
 await expect(page.locator('#media-status')).toContainText(new RegExp('Movie ('+selectors.join('|')+')'));
 await page.keyboard.press('Enter');
 await expect(page.getByRole('status')).toContainText('Word/Min:     12');
 expect(await page.evaluate(()=>window.audioCalls.at(-1))).toEqual([audio,3]);
});
test('report, Repeat and Welcome Continue use updated record; quit No preserves typing and report',async({page},info)=>{
 await fastContinue(page);
 await page.keyboard.press('z');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog',{name:'Quit confirmation (resource624)'})).toBeVisible();
 await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 await expect(page.getByRole('status')).toContainText('Typed: 1');
 await page.clock.runFor(1100);
 await page.keyboard.press('Escape'); // active report movie consumes this once
 await expect(page.getByRole('status')).toContainText('Keys Typed:    1');
 expect(await page.evaluate(()=>window.audioCalls.at(-1))).toEqual([7,3]);
 await page.screenshot({path:info.outputPath('calculated-report.png')});
 const report=await page.getByRole('status').textContent();
 await page.keyboard.press('Escape');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 expect(await page.getByRole('status').textContent()).toBe(report);
 await page.getByRole('button',{name:'Repeat',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Typed: 0');
 await page.keyboard.press('Escape');await page.keyboard.press('Enter'); // default Yes
 await expect(page.getByRole('status')).toContainText('Keyset: 1');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('State 21');
 await page.getByRole('button',{name:'Quit application',exact:true}).click();
 await page.keyboard.press('Escape'); // confirmation Escape means Yes
 await expect(page.locator('#media-status')).toContainText('40');
 await page.keyboard.press('x');
 await expect(page.getByRole('status')).toContainText('Application exited');
});
test('qualifying terminal result stops with labeled browser adaptation; failed keyset4 can Repeat',async({page},info)=>{
 await fastContinue(page,4,0);await page.clock.runFor(1100);await page.keyboard.press('Enter');
 await expect(page.getByRole('status')).toHaveText('Browser adaptation: certificate unavailable; progression stopped.');
 await expect(page.getByRole('button',{name:'Repeat',exact:true})).toHaveCount(0);
 await page.keyboard.press('Escape');await page.clock.runFor(2000);
 await expect(page.getByRole('status')).toContainText('progression stopped');
 await page.screenshot({path:info.outputPath('terminal-stop.png')});
});
test('failed report media and retry hold progression; explicit skip awards once without a manual writer',async({page})=>{
 await fastContinue(page);
 await page.route('**/stream-*-audio.wav',route=>route.fulfill({status:404,body:'missing'}));
 await page.clock.runFor(1100);
 await expect(page.locator('#media-status')).toContainText('failed');
 await expect(page.getByRole('status')).toContainText('Report');
 await page.getByRole('button',{name:'Enable audio / Retry',exact:true}).click();
 await expect(page.locator('#media-status')).toContainText('failed');
 await page.getByRole('button',{name:'Repeat',exact:true}).click(); // skip only
 await expect(page.getByRole('status')).toContainText('Keys Typed:    0');
 await page.getByRole('button',{name:'Enable audio / Retry',exact:true}).click();
 await page.keyboard.press('Escape');await page.keyboard.press('Enter');
 await expect(page.getByRole('status')).toContainText('Keyset: 1');
 const r=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).students[0].record,own);
 expect(r[1]).toBe(0);expect(r[11]).toBe(0); // no invented manual report autosave
});
test('nonqualifying terminal keyset remains repeatable and Welcome Escape omits movie40',async({page})=>{
 await fastContinue(page,4,10);await page.clock.runFor(1100);await page.keyboard.press('Enter');
 expect(await page.evaluate(()=>window.audioCalls.at(-1))).toEqual([8,3]);
 await page.getByRole('button',{name:'Repeat',exact:true}).click();
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await expect(page.getByRole('status')).toContainText('Setup state 1');
 await page.keyboard.press('Escape');await expect(page.getByRole('status')).toContainText('Application exited');
 expect(await page.locator('#media-status').textContent()).not.toContain('40');
});

// Real one-minute stored lesson, normal 100ms visits and fifth-sample clock.
// Only the browser clock is controlled; no typing/report/progression helper injection.
for (const [count,speed,keyset] of [[49,9,0],[50,10,1],[55,11,1]])
test('full-minute lifecycle and speed boundary: '+count+' correct keys',async({page},info)=>{
 await enter(page);
 await page.evaluate(key=>{
  const file=JSON.parse(localStorage.getItem(key)),r=file.students[0].record;
  r[27]=1;r[28]=0;r[35]=10;r[36]=0;
  localStorage.setItem(key,JSON.stringify(file));
 },own);
 await page.reload();await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 for(let i=0;i<count;i++) {
  const key=(await page.locator('canvas').getAttribute('aria-label')).slice('Next key: '.length);
  await page.keyboard.press(key===' '?'Space':key);
 }
 await page.clock.runFor(59000);
 await expect(page.getByRole('status')).toContainText('Typed: '+count+' | Errors: 0 | Elapsed: 59');
 await expect(page.getByRole('button',{name:'Repeat',exact:true})).toHaveCount(0);
 await page.clock.runFor(1000); // elapsed reaches60, pending finish is not consumed yet
 await expect(page.getByRole('status')).toContainText('Elapsed: 60');
 await page.clock.runFor(100); // next delivered visit owns handoff
 await expect(page.getByRole('status')).toContainText('Report');
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 const fields=['Keys Typed: '+String(count).padStart(4),'Errors:        0',
  'Word/Min:   '+String(speed).padStart(4),'Accuracy:   100%','Lesson Time: 1:00','Problem Keys:None!'];
 await expect(page.getByRole('status')).toHaveText('Report | '+fields.join(' | '));
 expect(await page.evaluate(()=>window.audioCalls.at(-1))).toEqual([speed>=10?7:8,3]);
 await page.screenshot({path:info.outputPath('full-minute-report.png')});
 await page.getByRole('button',{name:'Repeat',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Typed: 0 | Errors: 0 | Elapsed: 0');
 await page.getByRole('button',{name:'Quit to Welcome',exact:true}).click();await page.keyboard.press('Enter');
 await expect(page.getByRole('status')).toContainText('Keyset: '+keyset);
 expect(await page.evaluate(()=>window.audioCalls.slice(-2))).toEqual([[0,192],[0,32]]);
 expect(await page.evaluate(()=>window.mediaSnapshot().audio.map(a=>a.selector))).toEqual([1]);
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Typed: 0 | Errors: 0 | Elapsed: 0');
});
for(const threshold of [0,10]) test('quit report audio '+(threshold?8:7)+' closes old slots before Welcome',async({page})=>{
 await fastContinue(page,0,threshold);await page.clock.runFor(1100);
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 expect(await page.evaluate(()=>window.audioCalls.at(-1))).toEqual([threshold?8:7,3]);
 await page.getByRole('button',{name:'Quit to Welcome',exact:true}).click();await page.keyboard.press('Enter');
 expect(await page.evaluate(()=>window.audioCalls.slice(-2))).toEqual([[0,192],[0,32]]);
 expect(await page.evaluate(()=>window.mediaSnapshot().audio.map(a=>a.selector))).toEqual([1]);
});
