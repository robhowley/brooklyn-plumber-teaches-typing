import {test,expect} from '@playwright/test';
const own='mtt2-static-translation.students.v1';
const chars=['Mario','Princess','Luigi'],keysets=['Home','Top','Bottom','Numbers','Symbols'];
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  const forbidden=['mtt-static-translation.students.v1','typing-kingdom-v1','typing-kingdom-v2'];
  window.protectedAccesses=[];
  for(const method of ['getItem','setItem','removeItem']){
   const original=Storage.prototype[method];
   Storage.prototype[method]=function(key,...args){
    if(forbidden.includes(key)){window.protectedAccesses.push(key);throw Error('Protected key');}
    return original.call(this,key,...args);
   };
  }
 });
});
async function open(page){await page.goto('./');await expect(page.getByRole('button',{name:'New student',exact:true})).toBeVisible();}
async function name(page,c=0,value='ALICE'){
 await page.getByRole('button',{name:'New student',exact:true}).click();
 await page.getByRole('button',{name:chars[c],exact:true}).click();
 await page.keyboard.type(value);
 await page.keyboard.press('Enter');
}
async function finish(page,k=0){
 await page.getByRole('button',{name:'Choose lesson plan',exact:true}).click();
 await page.getByRole('button',{name:'Express',exact:true}).click();
 await page.getByRole('button',{name:keysets[k],exact:true}).click();
 await expect(page.getByRole('status')).toContainText('State 21: typing is not implemented');
}
for(let c=0;c<3;c++)for(let k=0;k<5;k++)test('setup '+chars[c]+' / '+keysets[k],async({page},info)=>{
 await open(page);await name(page,c);await finish(page,k);
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),own);
 expect(saved.students[0].record[3]).toBe(c);expect(saved.students[0].record[1]).toBe(k);
 // Capture each asserted display separately, never label a reload as a handoff.
 const capture=async filename=>{
  if(c!==2||k!==4)return;
  await info.attach(filename+'.status',{body:await page.getByRole('status').innerText(),contentType:'text/plain'});
  await page.screenshot({path:info.outputPath(filename+'.png')});
 };
 await expect(page.getByRole('status')).toHaveText('State 21: typing is not implemented in this setup and renderer preview.');
 await capture('setup-handoff');
 await page.reload();
 await expect(page.getByRole('status')).toHaveText('Setup state 1 | Name: ALICE | Character: '+c+' | Keyset: '+k);
 await capture('setup-reload');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('State 21: typing is not implemented in this setup and renderer preview.');
 await capture('setup-continued');
 expect(await page.evaluate(()=>window.protectedAccesses)).toEqual([]);
});
test('indexed hotspot path, name editing, duplicates and blank name',async({page},info)=>{
 await open(page);
 const hotspots=await page.evaluate(async()=> (await (await fetch('./presentation.json')).json()).hotspots);
 async function hit(state,selector,arg){
  const h=hotspots[state].find(h=>h.selector===selector&&(arg===undefined||h.argument===arg));
  const [l,t,r,b]=h.rectangle;
  const canvas=page.locator('canvas'),box=await canvas.boundingBox();
  await canvas.click({position:{x:(l+r)/2*box.width/640,y:(t+b)/2*box.height/480}});
 }
 await hit(1,2);await hit(2,3,1);
 await page.keyboard.type('ABCDEFGHIJK');await expect(page.getByRole('status')).toContainText('ABCDEFGH');
 await page.keyboard.press('Backspace');await expect(page.getByRole('status')).toContainText('ABCDEFG');
 await page.keyboard.type('!');await expect(page.getByRole('status')).toContainText('ABCDEFG!');
 await page.keyboard.press('Backspace');
 await page.keyboard.press('Enter');await hit(4,5);await hit(5,14,3);await hit(14,17,2);
 await page.reload();await name(page,0,'ABCDEFG');await expect(page.locator('dialog')).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Setup state 3');
 await page.keyboard.press('Enter');await page.getByRole('button',{name:'OK',exact:true}).click();await finish(page);
 await page.reload();await name(page,2,'');await expect(page.getByRole('status')).toContainText('NONAME');
 await page.screenshot({path:info.outputPath('blank-name.png')});
});
for(const failure of ['getter','read','write','invalid'])test('visible persistence refusal: '+failure,async({page})=>{
 await page.addInitScript(({failure,own})=>{
  if(failure==='getter')Object.defineProperty(window,'localStorage',{get(){throw Error('Denied getter');}});
  if(failure==='read')Storage.prototype.getItem=function(){throw Error('Denied read');};
  if(failure==='write')Storage.prototype.setItem=function(){throw Error('Denied write');};
  if(failure==='invalid')localStorage.setItem(own,'INVALID ORIGINAL');
 },{failure,own});
 await open(page);
 if(failure==='write')await name(page);
 await expect(page.getByRole('alert')).toContainText('Persistence refused');
 if(failure==='invalid')expect(await page.evaluate(key=>localStorage.getItem(key),own)).toBe('INVALID ORIGINAL');
 expect(await page.evaluate(()=>window.protectedAccesses)).toEqual([]);
});
test('name edits preserve overlay visits through UI dispatch',async({page})=>{
 await open(page);
 await page.getByRole('button',{name:'New student',exact:true}).click();
 await page.getByRole('button',{name:'Mario',exact:true}).click();
 await page.locator('details').evaluate(e=>e.open=true);
 // State 3 overlay occupies y=112..215, separate from the name at y=266.
 const pixels=()=>page.locator('canvas').evaluate(c=>{
  let hash=2166136261;
  for(const byte of c.getContext('2d').getImageData(0,112,640,104).data)hash=Math.imul(hash^byte,16777619);
  return hash>>>0;
 });
 const visit=()=>page.getByRole('button',{name:'Deliver one overlay visit'}).click();
 const reference=[await pixels()];
 for(let tick=1;tick<=41;tick++){await visit();reference.push(await pixels());}
 expect(reference[10]).not.toBe(reference[0]);
 expect(reference[41]).toBe(reference[0]);
 // Genuine state changes restore the backdrop and restart its visit counters.
 await page.getByRole('button',{name:'Typing / hands fixture'}).click();
 await page.getByRole('button',{name:'Return to setup'}).click();
 expect(await pixels()).toBe(reference[0]);
 for(let tick=1;tick<=41;tick++){
  if([5,15,25,35].includes(tick)){
   await page.keyboard.press(tick===15||tick===35?'Backspace':'A');
   await expect(page.getByRole('status')).toContainText(tick===15||tick===35?'Name: (blank)':'Name: A');
   expect(await pixels()).toBe(reference[tick-1]);
  }
  await visit();expect(await pixels()).toBe(reference[tick]);
 }
});
test('real renderer fixtures, hand cues, overlays, report and load refusal',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await open(page);
 const pixels=()=>page.locator('canvas').evaluate(c=>{let hash=2166136261;for(const byte of c.getContext('2d').getImageData(0,0,640,480).data)hash=Math.imul(hash^byte,16777619);return hash>>>0;});
 const initial=await pixels();
 await page.locator('details').evaluate(e=>e.open=true);
 let changed=false;
 for(let i=0;i<30;i++){
  await page.getByRole('button',{name:'Deliver one overlay visit'}).click();
  if(await pixels()!==initial){changed=true;break;}
 }
 expect(changed).toBe(true);
 await page.locator('details').evaluate(e=>e.open=true);
 await page.getByRole('button',{name:'Typing / hands fixture'}).click();
 await expect(page.getByRole('status')).toContainText('Renderer fixture only');
 const typing=await pixels();expect(typing).not.toBe(initial);
 await page.screenshot({path:info.outputPath('typing-hands.png')});
 await page.getByRole('button',{name:'Report fixture',exact:true}).click();
 expect(await pixels()).not.toBe(typing);
 await page.screenshot({path:info.outputPath('report.png')});
 await page.getByRole('button',{name:'Return to setup'}).click();
 expect(await pixels()).toBe(initial);expect(errors).toEqual([]);
 await page.route('**/font.bin',route=>route.fulfill({status:404,body:'missing'}));
 await page.reload();await expect(page.getByRole('alert')).toContainText('Load refused');
});
