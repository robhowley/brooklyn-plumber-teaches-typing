import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {boot,activate,custom,enterActivity,openMenu,fixture,stored,selectedStudent,typeTargets} from './helpers.js';
import {advanceCourse,recordResult} from '../../src/course.js';
import {advanceTime,createAttempt,resume,result,typeKey} from '../../src/engine.js';
import {createStore} from '../../src/storage.js';

// Source-image checks are opt-in; normal collection never reads local research.
const source=process.env.ORIGINAL_FIDELITY_SOURCE;
const image=(path)=>`data:image/png;base64,${readFileSync(resolve(source,path)).toString('base64')}`;
test('optional local source images match menu, dropdown and named greeting',async({page})=>{
 test.skip(!source,'Set ORIGINAL_FIDELITY_SOURCE to the checkout containing research images');
 await boot(page,{data:null});
 const pixels=await compareDefaultPixels(page);
 for(const comparison of Object.values(pixels))expect(comparison.count).toBe(0);
 await openMenu(page,'File');
 const file=await fileDropdownReferenceBounds(page,image('research/artifacts/video-r-LxHUgI2W0/frames/frame-00000750.png'));
 for(const edge of ['left','top','right','bottom'])expect(Math.abs(file.actual[edge]-file.reference[edge])).toBeLessThanOrEqual(2);
 await page.keyboard.press('Escape');
 await openMenu(page,'Student');await page.locator('#edit-student').click();
 await page.getByLabel('Name',{exact:true}).fill('Alex');await activate(page,'#student-done');await page.keyboard.press('Escape');
 const greeting=await redGreetingBounds(page,image('research/artifacts/video-r-LxHUgI2W0/frames/frame-00004800.png'));
 expect(greeting.actual.count).toBeGreaterThan(30);expect(greeting.reference.count).toBeGreaterThan(30);
 for(const edge of ['left','top','right','bottom'])expect(Math.abs(greeting.actual[edge]-greeting.reference[edge])).toBeLessThanOrEqual(3);
});
const viewports=[{width:1280,height:720},{width:390,height:844},{width:844,height:390}];
const actions=[
 ['#activity-outdoor',[233,9,303,40],'Smash & Dash'],
 ['#activity-underwater',[233,40,303,71],'Wet World Challenge'],
 ['#activity-castle',[233,71,303,102],'Tunnel of Doom'],
 ['#activity-practice',[233,102,303,133],'Expert Express'],
 ['#report',[233,133,303,164],'Report card'],
 ['#next',[233,164,303,187],'Next'],
];

function details(page,name){
 return page.locator('details').filter({has:page.locator('summary').filter({hasText:new RegExp(`^${name}$`)})});
}
async function expectAllModesEnabled(page){
 for(const mode of ['outdoor','underwater','castle','practice'])await expect(page.locator(`#activity-${mode}`)).toBeEnabled();
}
function existingCertifiedFixture(){
 const profile=fixture({duration:3,goal:5,group:0}).students[0],date='2026-11-10T00:00:00.000Z';
 profile.course.group=5;
 const state=createAttempt({...profile.course,mode:'outdoor',guided:true,studentId:profile.id,courseRevision:profile.course.revision,duration:60,reducedMotion:true});
 for(let i=0;i<48;i++){
  typeKey(state,{key:state.text[state.lesson.records[state.cursor.recordIndex].start+state.cursor.characterIndex]});
  resume(state);
 }
 advanceTime(state,60);recordResult(profile,result(state),date);advanceCourse(profile,date);
 return createStore(profile);
}
async function nativeBox(page,selector){
 const target=typeof selector==='string'?page.locator(selector):selector;
 const canvas=await page.locator('#screen-art').boundingBox(),box=await target.boundingBox();
 const scale=canvas.width/320;
 return [(box.x-canvas.x)/scale,(box.y-canvas.y)/scale,(box.x+box.width-canvas.x)/scale,(box.y+box.height-canvas.y)/scale];
}
async function expectNativeBox(page,selector,expected,tolerance=.25){
 const actual=await nativeBox(page,selector);
 for(let i=0;i<4;i++)expect(Math.abs(actual[i]-expected[i]),`${selector} native edge ${i}: ${actual}`).toBeLessThan(tolerance);
}
async function clickNative(page,x,y){
 const box=await page.locator('#screen-art').boundingBox(),scale=box.width/320;
 await page.mouse.click(box.x+x*scale,box.y+y*scale);
}
async function canvasPixels(page){return page.locator('#screen-art').evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,320,200).data));}
async function canvasHash(page){return page.locator('#screen-art').evaluate(async c=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',c.getContext('2d').getImageData(0,0,320,200).data)),n=>n.toString(16).padStart(2,'0')).join(''));}
async function compareDefaultPixels(page){
 return page.locator('#screen-art').evaluate(async(canvas,refs)=>{
  async function decode(src){const img=new Image();img.src=src;await img.decode();return img;}
  function pixels(img){const surface=document.createElement('canvas');surface.width=320;surface.height=200;const ctx=surface.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,320,200).data;}
  const [menu,background]=await Promise.all([decode(refs.menu),decode(refs.background)]);
  const actual=canvas.getContext('2d').getImageData(0,0,320,200).data,menuPixels=pixels(menu),backgroundPixels=pixels(background);
  function mismatches(expected,include,tolerance=0){let count=0,compared=0;for(let y=0;y<200;y++)for(let x=0;x<320;x++){
   if(!include(x,y))continue;const offset=(y*320+x)*4;compared++;
   if([0,1,2].some(channel=>Math.abs(actual[offset+channel]-expected[offset+channel])>tolerance))count++;
  }return {count,compared};}
  return {
   unchangedArt:mismatches(backgroundPixels,(x,y)=>y>=8&&!(x>=130&&x<200&&y>=22&&y<74)),
   menuBar:mismatches(menuPixels,(_x,y)=>y<8),
   // Screenshot compression shifts a few bubble-edge channels by one, not the drawn greeting pixels.
   genericGreeting:mismatches(menuPixels,(x,y)=>x>=130&&x<200&&y>=22&&y<74,1),
  };
 },{menu:image('research/images/menu.png'),background:image('research/executable-1992/screens/decoded/MAINMENU.png')});
}
async function fileDropdownReferenceBounds(page,sourceImage){
 return page.locator('#screen-art').evaluate(async(canvas,src)=>{
  const img=new Image();img.src=src;await img.decode();const surface=document.createElement('canvas');surface.width=img.width;surface.height=img.height;
  const ctx=surface.getContext('2d');ctx.drawImage(img,0,0);const reference=ctx.getImageData(0,0,img.width,img.height).data;
  const actual=canvas.getContext('2d').getImageData(0,0,320,200).data;
  function bounds(data,width,sample,referenceImage){let left=Infinity,top=Infinity,right=-1,bottom=-1;
   for(let y=8;y<75;y++)for(let x=15;x<122;x++){
    const [sampleX,sampleY]=sample(x,y),i=(sampleY*width+sampleX)*4;
    const yellow=referenceImage?data[i]>180&&data[i+1]>170&&data[i+2]<130:data[i]>220&&data[i+1]>220&&data[i+2]<130;
    if(yellow){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
   }
   return {left,top,right:right+1,bottom:bottom+1};
  }
  return {
   actual:bounds(actual,320,(x,y)=>[x,y],false),
   reference:bounds(reference,img.width,(x,y)=>[Math.floor((x+.5)*2.25),14+Math.floor((y+.5)*2.25)],true),
  };
 },sourceImage);
}
async function redGreetingBounds(page,sourceImage=null){
 return page.locator('#screen-art').evaluate(async(canvas,src)=>{
  const img=new Image();let reference;
  if(src){img.src=src;await img.decode();const surface=document.createElement('canvas');surface.width=img.width;surface.height=img.height;
   const ctx=surface.getContext('2d');ctx.drawImage(img,0,0);reference=ctx.getImageData(0,0,img.width,img.height).data;}
  const actual=canvas.getContext('2d').getImageData(0,0,320,200).data;
  function bounds(data,width,height,sample){let left=Infinity,top=Infinity,right=-1,bottom=-1,count=0;
   for(let y=24;y<74;y++)for(let x=130;x<208;x++){
    const [offsetX,offsetY]=sample(x,y),i=(offsetY*width+offsetX)*4;
    if(data[i]>150&&data[i+1]<125&&data[i+2]<125){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);count++;}
   }
   return {left,top,right:right+1,bottom:bottom+1,count};
  }
  const actualBounds=bounds(actual,320,200,(x,y)=>[x,y]);
  const referenceBounds=src&&bounds(reference,img.width,img.height,(x,y)=>[Math.floor((x+.5)*2.25),14+Math.floor((y+.5)*2.25)]);
  return {actual:actualBounds,reference:referenceBounds};
 },sourceImage);
}

for(const viewport of viewports)test(`MAINMENU keeps its native composition and hit regions at ${viewport.width}x${viewport.height}`,async({page},info)=>{
 await page.setViewportSize(viewport);await boot(page,{data:null});
 const canvas=page.locator('#screen-art'),box=await canvas.boundingBox();
 await expect(canvas).toHaveAttribute('width','320');await expect(canvas).toHaveAttribute('height','200');
 await expect(details(page,'File')).not.toHaveAttribute('open','');
 expect(box.width/box.height).toBeCloseTo(1.6,3);
 expect(box.width).toBeCloseTo(Math.min(viewport.width,viewport.height*1.6),1);
 expect(box.x).toBeCloseTo((viewport.width-box.width)/2,1);expect(box.y).toBeCloseTo((viewport.height-box.height)/2,1);
 expect(await canvas.evaluate(el=>getComputedStyle(el).imageRendering)).toBe('pixelated');
 const hitStyle=await page.locator('#activity-outdoor').evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,border:s.borderWidth,shadow:s.boxShadow};});
 expect(hitStyle).toEqual({background:'rgba(0, 0, 0, 0)',border:'0px',shadow:'none'});
 expect(await page.locator('summary').first().evaluate(el=>getComputedStyle(el).listStyleType)).toBe('none');
 expect(await page.evaluate(()=>document.body.classList.contains('title-screen')||document.body.classList.contains('playing'))).toBe(false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 await expect(page.locator('.cabinet,header,footer,.archive-controls,.archive-illustration,#page-title')).toHaveCount(0);
 await expect(page.locator('#enter')).toHaveCount(0);await expect(page.locator('summary').first()).toBeFocused();
 for(const [selector,rect] of [
  ['details:first-of-type > summary', [16,0,64,8]],
  ...actions.map(([selector,rect])=>[selector,rect]),
 ])await expectNativeBox(page,selector,rect);
 await page.screenshot({path:info.outputPath(`main-menu-${viewport.width}x${viewport.height}.png`),fullPage:true});
});

test('File, Student and Lessons dropdowns match native geometry, order and pixel colors',async({page},info)=>{
 await boot(page,{data:null});
 const top=[['File',[16,0,64,8]],['Student',[104,0,176,8]],['Lessons',[224,0,296,8]]];
 for(const [name,rect] of top)await expectNativeBox(page,details(page,name).locator('summary'),rect);
 await openMenu(page,'File');
 const file=details(page,'File'),rows=file.locator('button');
 await expect(rows).toHaveText(['About [A]','Help [F1]','Demo [D]','Keyboard [F2]','Music [M]','Sound F/X [S]','Speech [G]','Quit [Q]']);
 for(const name of ['About [A]','Demo [D]','Music [M]','Sound F/X [S]','Speech [G]','Quit [Q]'])await expect(rows.filter({hasText:name})).toBeDisabled();
 await expect(rows.filter({hasText:'Help [F1]'})).toBeEnabled();await expect(rows.filter({hasText:'Keyboard [F2]'})).toBeEnabled();
 const first=await rows.first().boundingBox(),canvasBox=await page.locator('#screen-art').boundingBox(),scale=canvasBox.width/320;
 expect(Math.abs((first.x-canvasBox.x)/scale-16)).toBeLessThan(1);
 expect(Math.abs((first.y-canvasBox.y)/scale-9)).toBeLessThan(1);
 for(let i=1;i<8;i++){
  const row=await rows.nth(i).boundingBox(),previous=await rows.nth(i-1).boundingBox();
  expect(Math.abs(row.y-previous.y-first.height)).toBeLessThan(1);
 }
 await page.screenshot({path:info.outputPath('main-menu-file-open.png'),fullPage:true});
 const colorCounts=await page.locator('#screen-art').evaluate(c=>{
  const data=c.getContext('2d').getImageData(0,0,320,200).data;let yellow=0,blue=0;
  for(let y=8;y<74;y++)for(let x=15;x<121;x++){const i=(y*320+x)*4;
   if(data[i]===255&&data[i+1]===255&&data[i+2]===85)yellow++;
   if(data[i]===0&&data[i+1]===0&&data[i+2]===170)blue++;
  }return {yellow,blue};
 });
 expect(colorCounts.yellow).toBeGreaterThan(100);expect(colorCounts.blue).toBeGreaterThan(20);
 await page.keyboard.press('Escape');await openMenu(page,'Student');await page.screenshot({path:info.outputPath('main-menu-student-open.png'),fullPage:true});
 await expect(details(page,'Student').locator('button')).toHaveText(['New [W]','Load [L]','Edit [E]','Lesson Times','Certificates']);
 await page.keyboard.press('Escape');await openMenu(page,'Lessons');await page.screenshot({path:info.outputPath('main-menu-lessons-open.png'),fullPage:true});
 await expect(details(page,'Lessons').locator('button')).toHaveText(['Home Row Only','Add Top Row','Add Bottom Row','Add Numbers','Add Symbols','All Keyboard']);
});

test('top-menu keyboard navigation, click-off, Escape and raster focus stay visible',async({page},info)=>{
 await boot(page,{data:null});const file=page.locator('summary').filter({hasText:/^File$/}),student=page.locator('summary').filter({hasText:/^Student$/}),lessons=page.locator('summary').filter({hasText:/^Lessons$/});
 const fileFocus=await canvasPixels(page);
 await page.keyboard.press('Tab');await expect(student).toBeFocused();const studentFocus=await canvasPixels(page);expect(studentFocus).not.toEqual(fileFocus);
 await page.keyboard.press('Shift+Tab');await expect(file).toBeFocused();expect(await canvasPixels(page)).toEqual(fileFocus);
 await page.keyboard.press('ArrowRight');await expect(student).toBeFocused();
 await page.keyboard.press('ArrowRight');await expect(lessons).toBeFocused();
 await page.keyboard.press('ArrowLeft');await expect(student).toBeFocused();
 await page.keyboard.press('Enter');await expect(details(page,'Student')).toHaveAttribute('open','');
 if(await page.evaluate(()=>document.activeElement.id)!=='new-student')await page.keyboard.press('ArrowDown');
 await expect(page.locator('#new-student')).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'New student',exact:true})).toBeVisible();
 await activate(page,'#back');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');
 await openMenu(page,'Lessons');await page.keyboard.press('1');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');await expect(page.locator('#target')).toHaveCount(0);
 await page.keyboard.press('Escape');await expect(details(page,'Lessons')).not.toHaveAttribute('open','');await expect(page.locator('summary').filter({hasText:/^Lessons$/})).toBeFocused();
 await page.keyboard.press('Space');await expect(details(page,'Lessons')).toHaveAttribute('open','');await page.keyboard.press('Escape');
 await openMenu(page,'Student');await clickNative(page,190,120);await expect(details(page,'Student')).not.toHaveAttribute('open','');await expect(student).toBeFocused();
 await page.screenshot({path:info.outputPath('main-menu-focus.png'),fullPage:true});
});

test('Lesson Times and all six Lessons rows activate through keyboard navigation',async({page})=>{
 await boot(page,{data:fixture({group:5})});await openMenu(page,'Student');
 for(let i=0;i<4;i++)await page.keyboard.press('ArrowDown');
 await expect(page.locator('#times')).toBeFocused();await page.keyboard.press('Enter');
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original LESSTIME background');
 await activate(page,'#back');await expect(page.locator('#times')).toBeFocused();
 await openMenu(page,'Lessons');
 const labels=['Home Row Only','Add Top Row','Add Bottom Row','Add Numbers','Add Symbols','All Keyboard'];
 for(let group=0;group<labels.length;group++){
  await page.keyboard.press('ArrowDown');await expect(page.locator(`#lesson-group-${group}`)).toBeFocused();
  await page.keyboard.press('Enter');expect((await selectedStudent(page)).settings.group).toBe(group);
  await expect(page.locator(`#lesson-group-${group}`)).toHaveAttribute('aria-label',`${labels[group]}, selected`);
 }
 await page.keyboard.press('Escape');await enterActivity(page,'practice');
 await expect(page.locator('#scene')).toBeVisible();await expect(page.locator('#encounter-status')).toContainText(/All keyboard/i);
});

test('File Keyboard and Report commands work through pointer and keyboard input',async({page})=>{
 await boot(page);
 await page.locator('summary').filter({hasText:/^File$/}).click();await page.locator('#keyboard').click();
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original KEYBOARD background');await page.locator('#back').click();
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');await page.keyboard.press('Escape');
 await openMenu(page,'File');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
 await expect(page.locator('#keyboard')).toBeFocused();await page.keyboard.press('Enter');
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original KEYBOARD background');await activate(page,'#back');await page.keyboard.press('Escape');
 await page.locator('#report').click();await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original RCARD background');
 await page.locator('#back').click();await page.keyboard.press('5');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original RCARD background');
});

test('Help browser options keep guided/custom source choices and generated alternatives',async({page})=>{
 await boot(page);
 async function openHelp(){await openMenu(page,'File');await page.locator('#help').click();}
 await openHelp();await page.locator('#custom').click();await expect(page.getByRole('heading',{name:'Browser custom practice',exact:true})).toBeVisible();await activate(page,'#back');
 await openHelp();await page.locator('#custom').focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Browser custom practice',exact:true})).toBeVisible();await activate(page,'#back');
 await openHelp();await page.locator('#guided').click();await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original GREETBG background');await expect(page.locator('#original')).toBeVisible();await expect(page.locator('#generated')).toBeVisible();await activate(page,'#back');
 await openHelp();await page.locator('#guided').focus();await page.keyboard.press('Enter');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original GREETBG background');await activate(page,'#generated');
 await expect(page.locator('#target')).toBeVisible();await expect(page.locator('#source-caption')).toContainText('Generated practice, not original lesson text');
 await page.keyboard.press('Escape');await activate(page,'#leave');
 await custom(page,'outdoor',{generated:true});await expect(page.locator('#source-caption')).toContainText('Generated practice, not original lesson text');
});

test('numeric shortcuts launch every mode at the default goal without scoring the selection key',async({page})=>{
 await boot(page,{data:fixture({duration:3,goal:5})});
 const modes=['outdoor','underwater','castle','practice'];
 for(let i=0;i<modes.length;i++){
  const mode=modes[i];await enterActivity(page,mode);
  await expect(page.locator('#scene')).toBeVisible();await expect(page.getByRole('main',{name:'Typing activity'})).toBeFocused();
  await expect(page.locator('#correct')).toHaveText('0');await expect(page.locator('#errors')).toHaveText('0');
  const first=await page.locator('#target').textContent();await page.keyboard.press(first==='␣'?'Space':first);await expect(page.locator('#correct')).toHaveText('1');
  await page.clock.runFor(3100);await expect(page.locator('#outcome')).toBeVisible();
  const results=(await selectedStudent(page)).results;expect(results).toHaveLength(i+1);expect(results.at(-1)).toMatchObject({mode,correct:1,errors:0});
  await activate(page,'#menu');await page.clock.runFor(4000);await expect(page.locator('#target')).toHaveCount(0);await expect(page.locator(`#activity-${mode}`)).toBeFocused();
 }
});

test('File help exposes browser-only options, unsupported commands do nothing, and shortcuts work',async({page},info)=>{
 await boot(page,{data:fixture()});await openMenu(page,'File');
 const rows=details(page,'File').locator('button');
 for(const name of ['About [A]','Demo [D]','Music [M]','Sound F/X [S]','Speech [G]','Quit [Q]'])await rows.filter({hasText:name}).evaluate(el=>el.click());
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');await expect(page.locator('#target')).toHaveCount(0);
 let focused=await page.evaluate(()=>document.activeElement.id);
 if(focused!=='help')await page.keyboard.press(focused==='keyboard'?'ArrowUp':'ArrowDown');
 await expect(page.locator('#help')).toBeFocused();await page.keyboard.press('ArrowDown');await expect(page.locator('#keyboard')).toBeFocused();
 await page.keyboard.press('ArrowUp');await expect(page.locator('#help')).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original HELP background');
 await expect(page.locator('#storage-status')).toBeVisible();await expect(page.locator('#guided')).toBeVisible();await expect(page.locator('#custom')).toBeVisible();
 await expect(page.locator('.archive-page')).toContainText('All four activities are available at every configured goal; the goal still sets the speed required to pass.');
 await page.screenshot({path:info.outputPath('menu-help.png'),fullPage:true});
 await activate(page,'#custom');await expect(page.getByRole('heading',{name:'Browser custom practice',exact:true})).toBeVisible();await activate(page,'#back');
 await page.keyboard.press('Escape');await page.keyboard.press('F2');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original KEYBOARD background');await activate(page,'#back');
 await page.keyboard.press('Escape');await page.keyboard.press('F1');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original HELP background');await activate(page,'#back');await page.keyboard.press('Escape');
 await page.locator('summary').filter({hasText:/^File$/}).click();await page.locator('#help').click();await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original HELP background');await activate(page,'#back');await page.keyboard.press('Escape');
 for(const [key,form,menu,row] of [['w','#student-form','Student','#new-student'],['l','#load-form','Student','#load-student'],['e','#student-form','Student','#edit-student']]){
  await page.keyboard.press(key);await expect(page.locator(form)).toBeVisible();await activate(page,'#back');
  await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');
  await expect(details(page,menu)).toHaveAttribute('open','');await expect(page.locator(row)).toBeFocused();await page.keyboard.press('Escape');
 }
 await page.keyboard.press('c');await expect(page.getByRole('heading',{name:'Certificates',exact:true})).toBeInViewport();
 await activate(page,'#back');await openMenu(page,'Student');await page.getByRole('button',{name:'Certificates',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Certificates',exact:true})).toBeInViewport();await activate(page,'#back');
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');
 await expect(details(page,'Student')).toHaveAttribute('open','');await expect(page.getByRole('button',{name:'Certificates',exact:true})).toBeFocused();
});

test('named, long and Unicode student greetings preserve names and fit the greeting area',async({page},info)=>{
 await boot(page,{data:fixture()});
 async function rename(name){await page.locator('summary').filter({hasText:/^Student$/}).click();await page.locator('#edit-student').click();await page.getByLabel('Name',{exact:true}).fill(name);await activate(page,'#student-done');expect((await selectedStudent(page)).name).toBe(name);await page.keyboard.press('Escape');}
 await rename('Alex');await page.screenshot({path:info.outputPath('main-menu-named-greeting.png'),fullPage:true});
 expect((await redGreetingBounds(page)).actual.count).toBeGreaterThan(30);
 await rename('A very long student name');
 const longGreeting=await redGreetingBounds(page);expect(longGreeting.actual.right-longGreeting.actual.left).toBeLessThanOrEqual(88);
 await rename('Élodie Ω');expect((await selectedStudent(page)).name).toBe('Élodie Ω');
 expect((await redGreetingBounds(page)).actual.count).toBeGreaterThan(0);
 await page.screenshot({path:info.outputPath('main-menu-unicode-greeting.png'),fullPage:true});
 await page.reload();await activate(page,'#skip-title');expect((await selectedStudent(page)).name).toBe('Élodie Ω');
});

for(const goal of [5,9,10,29,30])test(`all four activities stay available at ${goal} WPM`,async({page})=>{
 await boot(page,{data:fixture({goal})});
 await expectAllModesEnabled(page);
});

test('fresh and newly created students can access every mode at the default goal',async({page})=>{
 await boot(page,{data:null});
 const fresh=await selectedStudent(page);
 expect(fresh.name).toBe('Player');expect(fresh.settings).toMatchObject({goal:5,group:0});
 expect(fresh.course).toMatchObject({group:0,goal:5,revision:0,pending:null,graduated:false});
 expect(fresh.results).toEqual([]);expect(fresh.certificates).toEqual([]);
 await expectAllModesEnabled(page);await expect(page.locator('#next')).toBeDisabled();
 await page.reload();await page.locator('#skip-title').click();
 expect(await selectedStudent(page)).toEqual(fresh);await expectAllModesEnabled(page);

 await openMenu(page,'Student');await activate(page,'#new-student');
 await expect(page.getByLabel('Activity goal')).toHaveValue('5');
 await page.getByLabel('Name',{exact:true}).fill('Grace');await activate(page,'#student-done');
 const created=await selectedStudent(page);
 expect(created.name).toBe('Grace');expect(created.settings).toMatchObject({goal:5,group:0});
 expect(created.course).toMatchObject({group:0,goal:5,revision:0,pending:null,graduated:false});
 expect(created.results).toEqual([]);expect(created.certificates).toEqual([]);
 await expectAllModesEnabled(page);await expect(page.locator('#next')).toBeDisabled();
 await page.reload();await page.locator('#skip-title').click();
 expect(await selectedStudent(page)).toEqual(created);await expectAllModesEnabled(page);
});

test('existing saved students keep earned records while an off-course pass stays off-course',async({page})=>{
 await boot(page,{data:existingCertifiedFixture()});
 const before=await selectedStudent(page);
 expect(before.settings).toMatchObject({goal:5,group:0});
 expect(before.course).toMatchObject({group:0,goal:10,revision:1,pending:null});
 expect(before.results).toHaveLength(1);expect(before.certificates.map(c=>c.kind)).toEqual(['outdoor']);
 await expectAllModesEnabled(page);await expect(page.locator('#next')).toBeDisabled();
 await page.reload();await page.locator('#skip-title').click();
 expect(await selectedStudent(page)).toEqual(before);await expectAllModesEnabled(page);

 await enterActivity(page,'underwater','pointer');
 await expect(page.locator('#encounter-status')).toContainText('Browser practice');
 await typeTargets(page,12);await page.clock.runFor(3100);
 const after=await selectedStudent(page),offCourse=after.results.at(-1);
 expect(offCourse).toMatchObject({mode:'underwater',group:0,goal:5,guided:false,passed:true});
 expect(after.settings).toEqual(before.settings);expect(after.course).toEqual(before.course);
 expect(after.certificates).toEqual(before.certificates);expect(after.results).toHaveLength(before.results.length+1);
 await expect(page.locator('#next')).toBeDisabled();
 await page.reload();await page.locator('#skip-title').click();
 expect(await selectedStudent(page)).toEqual(after);await expectAllModesEnabled(page);await expect(page.locator('#next')).toBeDisabled();
});

test('activity tile edge clicks launch once at the default goal and preserve original-first fallbacks',async({page},info)=>{
 await boot(page,{data:fixture({goal:5})});
 for(const [selector,rect] of actions.slice(0,4)){
  const mode=selector.slice('#activity-'.length);await clickNative(page,rect[0]+.5,rect[1]+.5);
  await expect(page.locator('#scene')).toBeVisible();await expect(page.getByRole('main',{name:'Typing activity'})).toBeFocused();
  await expect(page.locator('#target')).toBeVisible();await expect(page.locator('#correct')).toHaveText('0');await expect(page.locator('#errors')).toHaveText('0');
  await expect(page.locator('#source-caption')).toContainText(mode==='practice'?'Generated practice, not original lesson text':'Original 1992 lesson text');
  await page.screenshot({path:info.outputPath(`level-entry-${mode}-initial-gameplay.png`),fullPage:true});
  const key=await page.locator('#target').textContent();await page.keyboard.press(key==='␣'?'Space':key);await expect(page.locator('#correct')).toHaveText('1');
  await page.keyboard.press('Escape');await activate(page,'#leave');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');
  await expect(page.locator(selector)).toBeFocused();
 }
});

test('practice starts with its generated fallback and retry keeps the same source without course progress',async({page})=>{
 await boot(page,{data:fixture({duration:3,goal:5,group:0})});const course=(await selectedStudent(page)).course;
 await enterActivity(page,'practice');await expect(page.locator('#source-caption')).toContainText('Generated practice, not original lesson text');
 const firstTarget=await page.locator('#target').textContent();await typeTargets(page,1);await page.clock.runFor(3100);await expect(page.locator('#outcome')).toBeVisible();
 let student=await selectedStudent(page);expect(student.results[0]).toMatchObject({guided:false,label:'Generated practice, not original lesson text'});expect(student.course).toEqual(course);
 await activate(page,'#retry');await expect(page.locator('#source-caption')).toContainText('Generated practice, not original lesson text');
 await expect(page.locator('#target')).toHaveText(firstTarget);await expect(page.locator('#correct')).toHaveText('0');await expect(page.locator('#errors')).toHaveText('0');
 await typeTargets(page,1);await page.clock.runFor(3100);await expect(page.locator('#outcome')).toBeVisible();student=await selectedStudent(page);
 expect(student.results).toHaveLength(2);expect(student.results[1]).toMatchObject({guided:false,label:'Generated practice, not original lesson text'});expect(student.course).toEqual(course);
});

test('underwater and castle activate with Enter and Space at the default goal',async({page})=>{
 await boot(page,{data:fixture({goal:5})});
 for(const [mode,key] of [['underwater','Enter'],['castle','Space']]){
  await page.locator(`#activity-${mode}`).focus();await page.keyboard.press(key);
  await expect(page.locator('#scene')).toBeVisible();await expect(page.getByRole('main',{name:'Typing activity'})).toBeFocused();
  await expect(page.locator('#correct')).toHaveText('0');await expect(page.locator('#errors')).toHaveText('0');
  await page.keyboard.press('Escape');await activate(page,'#leave');
 }
});

test('reduced motion skips the menu fade',async({page},info)=>{
 await boot(page,{motion:'reduce',data:fixture({duration:3})});await enterActivity(page,'outdoor','pointer');
 await expect(page.locator('#scene')).toBeVisible();await expect(page.locator('#time')).toHaveText('0:03');
 await page.screenshot({path:info.outputPath('level-entry-reduced-motion-gameplay.png'),fullPage:true});
});

test('normal motion fades the menu before starting gameplay time',async({page},info)=>{
 await page.setViewportSize({width:1280,height:900});await boot(page,{motion:'no-preference',data:fixture({duration:1})});
 await enterActivity(page,'outdoor','pointer',{waitForGameplay:false});
 await page.keyboard.press('4');await page.keyboard.press('Space');
 await page.locator('#activity-practice').dispatchEvent('click');
 await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'1',repeat:true,bubbles:true})));
 await page.clock.runFor(100);
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');await expect(page.locator('#scene')).toHaveCount(0);
 await page.screenshot({path:info.outputPath('level-entry-menu-fade-100ms.png'),fullPage:true});
 await page.clock.runFor(180);await expect(page.locator('#scene')).toBeVisible();await expect(page.locator('#time')).toHaveText('0:01');
 await expect(page.locator('#correct')).toHaveText('0');await expect(page.locator('#errors')).toHaveText('0');
 await page.screenshot({path:info.outputPath('level-entry-gameplay-after-fade.png'),fullPage:true});
 await page.clock.runFor(750);await expect(page.locator('#outcome')).toHaveCount(0);
 await page.clock.runFor(350);await expect(page.locator('#outcome')).toBeVisible();
 const results=(await selectedStudent(page)).results;expect(results).toHaveLength(1);expect(results[0].mode).toBe('outdoor');
});

test('initial direct-entry gameplay fits a narrow viewport',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await boot(page,{data:fixture({goal:30})});await enterActivity(page,'underwater','pointer');
 await expect(page.locator('#scene')).toBeVisible();await expect(page.getByRole('main',{name:'Typing activity'})).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:info.outputPath('level-entry-gameplay-390x844.png'),fullPage:true});
});

for(const cause of ['blur','hidden'])test(`${cause} during the fade cancels entry and permits a clean restart`,async({page})=>{
 await boot(page,{motion:'no-preference',data:fixture({duration:3})});await enterActivity(page,'outdoor','pointer',{waitForGameplay:false});await page.clock.runFor(75);
 await page.evaluate(cause=>{
  if(cause==='blur')window.dispatchEvent(new Event('blur'));
  else{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}
 },cause);
 await page.clock.runFor(500);
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');
 await expect(page.locator('#scene')).toHaveCount(0);
 await page.evaluate(cause=>{
  if(cause==='blur')window.dispatchEvent(new Event('focus'));
  else{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));}
 },cause);
 await page.clock.runFor(1000);
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');await expect(page.locator('#scene')).toHaveCount(0);
 await enterActivity(page,'practice');await expect(page.locator('#correct')).toHaveText('0');await expect(page.locator('#errors')).toHaveText('0');
 await page.clock.runFor(3100);expect((await selectedStudent(page)).results).toHaveLength(1);
});

test('numeric shortcuts, modifiers, repeat, composition and text-field input are isolated',async({page})=>{
 await boot(page,{data:fixture({goal:30})});await page.keyboard.press('Control+1');await page.keyboard.press('Alt+1');
 await page.evaluate(()=>{
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true,repeat:true}));
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true,isComposing:true}));
 });
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');await expect(page.locator('#target')).toHaveCount(0);
 await page.keyboard.press('5');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original RCARD background');await activate(page,'#back');
 await page.keyboard.press('6');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');await expect(page.locator('#target')).toHaveCount(0);
 await page.keyboard.press('e');await expect(page.locator('#student-form')).toBeVisible();
 await page.keyboard.press('1');await expect(page.locator('#student-form')).toBeVisible();await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original PREFS background');
});

test('File > Help explains direct level entry and keeps the historical notice visible',async({page},info)=>{
 await page.setViewportSize({width:1280,height:900});await boot(page,{data:null});
 for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  await page.setViewportSize(viewport);await openMenu(page,'File');await activate(page,'#help');
  await expect(page.locator('.historical-notice')).toContainText('outdated or inaccurate claims');
  await expect(page.locator('.historical-notice')).toContainText('war, slavery, assassination and disasters');
  const text=(await page.locator('.archive-page').innerText()).replace(/\s+/g,' ');
  expect(text).toMatch(/activities 1\s*(?:–|-)\s*4/i);expect(text).toMatch(/original-first/i);
  expect(text).toMatch(/help.*(?:generated|custom)|(?:generated|custom).*help/i);
  await page.screenshot({path:info.outputPath(`level-entry-help-${viewport.width}x${viewport.height}.png`),fullPage:true});
  await activate(page,'#back');
 }
});

test('Lessons changes persist without changing earned or pending course state',async({page},info)=>{
 await boot(page,{data:fixture({duration:3,goal:5,group:0})});await enterActivity(page,'outdoor');await typeTargets(page,12);
 await page.clock.runFor(3100);await expect(page.locator('#next')).toBeEnabled();
 const earned=(await selectedStudent(page)).course;expect(earned.pending).not.toBeNull();await activate(page,'#menu');
 expect(await page.evaluate(()=>document.body.classList.contains('playing')||document.body.classList.contains('title-screen'))).toBe(false);
 const labels=['Home Row Only','Add Top Row','Add Bottom Row','Add Numbers','Add Symbols','All Keyboard'],signatures=[];
 for(let group=0;group<labels.length;group++){
  await openMenu(page,'Lessons');await page.locator(`#lesson-group-${group}`).click();
  const selected=await selectedStudent(page);expect(selected.settings.group).toBe(group);expect(selected.settings.goal).toBe(5);expect(selected.course).toEqual(earned);
  await expect(page.locator('#next')).toBeEnabled();
  await openMenu(page,'Lessons');signatures.push(await canvasHash(page));await page.screenshot({path:info.outputPath(`main-menu-lessons-group-${group}.png`),fullPage:true});
  await page.keyboard.press('Escape');
 }
 expect(new Set(signatures).size).toBe(6);
 await page.reload();await activate(page,'#skip-title');const reloaded=await selectedStudent(page);expect(reloaded.settings.group).toBe(5);expect(reloaded.course).toEqual(earned);
 await enterActivity(page,'practice');await expect(page.locator('#scene')).toBeVisible();
 await expect(page.locator('#encounter-status')).toContainText(/All keyboard/i);await expect(page.locator('#next')).toHaveCount(0);
});

test('earned NEXT commits once from the keyboard and remains committed after reload',async({page})=>{
 await boot(page,{data:fixture({duration:3,goal:5,group:0})});await enterActivity(page,'outdoor');await typeTargets(page,12);
 await page.clock.runFor(3100);await expect(page.locator('#next')).toBeEnabled();await activate(page,'#menu');
 await page.keyboard.press('6');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');
 const committed=(await selectedStudent(page)).course;expect(committed).toMatchObject({group:1,goal:5,revision:1,pending:null});await expect(page.locator('#next')).toBeDisabled();
 await page.keyboard.press('6');expect((await selectedStudent(page)).course).toEqual(committed);
 await page.reload();await activate(page,'#skip-title');await expect(page.locator('#next')).toBeDisabled();expect((await selectedStudent(page)).course).toEqual(committed);
});

test('earned NEXT commits once by pointer, returns to the menu, and stays committed after reload',async({page})=>{
 await boot(page,{data:fixture({duration:3,goal:5,group:0})});await enterActivity(page,'outdoor');await typeTargets(page,12);
 await page.clock.runFor(3100);await expect(page.locator('#next')).toBeEnabled();await activate(page,'#menu');
 const rect=actions.at(-1)[1];await clickNative(page,rect[2]-.5,rect[3]-.5);
 await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');
 const committed=(await selectedStudent(page)).course;expect(committed).toMatchObject({group:1,goal:5,revision:1,pending:null});await expect(page.locator('#next')).toBeDisabled();
 await page.keyboard.press('6');expect((await selectedStudent(page)).course).toEqual(committed);
 await page.reload();await activate(page,'#skip-title');await expect(page.locator('#next')).toBeDisabled();expect((await selectedStudent(page)).course).toEqual(committed);
});
