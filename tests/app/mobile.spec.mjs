import {test,expect} from '@playwright/test';

test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
const snap=page=>page.evaluate(()=>translationSnapshot());
const game=page=>page.locator('#game');
const input=page=>page.locator('#mobile-input');
const button=(page,name)=>page.getByRole('button',{name,exact:true});
async function tapCanvas(page,x=160,y=100) {
  const r=await game(page).boundingBox();
  await page.touchscreen.tap(r.x+x*r.width/320,r.y+y*r.height/200);
}
async function key(page,name) {await button(page,name).tap();await page.clock.runFor(60);}
async function text(page,value) {await expect(input(page)).toBeFocused();await page.keyboard.insertText(value);}
async function until(page,predicate) {
  for(let i=0;i<300;i++) {
    const state=await snap(page);if(predicate(state))return state;
    await page.clock.runFor(60);
  }
  throw new Error(`Mobile state did not advance: ${JSON.stringify(await snap(page))}`);
}
async function ready(page) {
  await page.clock.install();
  await page.addInitScript(()=>{
    // Omit speech through the existing host boundary, not a fabricated delay.
    AudioContext.prototype.resume=()=>Promise.reject(new Error('Audio omitted by mobile test'));
  });
  await page.goto('./?seed=1');
  await page.waitForFunction(()=>!!window.translationSnapshot);
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
  for(let i=0;i<12&&(await snap(page)).screen==='startup';i++) {
    await tapCanvas(page);await page.clock.runFor(60);
  }
  await expect(game(page)).toHaveAttribute('data-screen','menu');
  await expect(input(page)).toBeFocused();await page.clock.runFor(300);
}

test('trusted touch opens a real editor; input-only text plays all four activities and Back returns through results',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
  await expect(input(page)).toBeVisible();
  for(const [name,value] of Object.entries({autocapitalize:'off',autocorrect:'off',autocomplete:'off',spellcheck:'false',inputmode:'text'}))
    await expect(input(page)).toHaveAttribute(name,value);
  expect(await input(page).evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
  for(const [index,screen] of ['outdoor','water','castle','practice'].entries()) {
    await page.clock.runFor(300);
    // Real canvas picture hit, not a DOM replacement menu or a physical key.
    await tapCanvas(page,250,20+index*31);
    await expect(game(page)).toHaveAttribute('data-screen',screen);
    await expect(input(page)).toBeFocused();
    let s=await until(page,s=>!s.audioHost.blocking&&(screen==='outdoor'?s.outdoor.targetIndex>=0:
      screen==='water'?['active','wait'].includes(s.water.phase):screen==='castle'?s.castle.stats.running&&!s.castle.locked&&['rockfaces','sand'].includes(s.castle.phase):true));
    const stats=s=>screen==='outdoor'?s.outdoor:screen==='water'?s.water.stats:screen==='castle'?s.castle.stats:s.practice;
    const code=screen==='outdoor'?s.outdoor.obstacles[s.outdoor.targetIndex].code:screen==='water'?s.water.window[10]:screen==='castle'?s.castle.target:s.practice.rows[33+s.practice.index];
    expect(code).toBeGreaterThan(0);
    if(screen==='outdoor') {
      const wrong=code===65?'b':'a';await text(page,wrong.repeat(3));await page.clock.runFor(180);
      expect((await snap(page)).outdoor.errors).toBe(3);
    }
    const before=stats(await snap(page)).correct;
    const committed=screen==='practice'?String.fromCharCode(...s.practice.rows.slice(33,36)):String.fromCharCode(code);
    await text(page,screen==='outdoor'?committed.toLowerCase():committed);
    s=await until(page,s=>stats(s).correct===before+committed.length);
    expect(stats(s).correct).toBe(before+committed.length);
    if(screen==='practice')expect(stats(s).attempts).toBe(3);
    await key(page,'Back');await until(page,s=>s.screen==='results');
    await expect(game(page)).toHaveAttribute('data-screen','results');
    expect((await snap(page)).hostInputPending).toBe(0);
    await expect(input(page)).toBeFocused();
    await key(page,'Back');await expect(game(page)).toHaveAttribute('data-screen','menu');
  }
  await expect(page.locator('#status')).toBeHidden();expect(errors).toEqual([]);
});

test('touch text, arrows and Enter operate original student fields, durations, chooser, help and results',async({page})=>{
  await ready(page);
  await text(page,'w');await expect(game(page)).toHaveAttribute('data-screen','student');
  await text(page,'ADAX');
  await input(page).evaluate(e=>{e.value='';e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward'}));});
  expect((await snap(page)).studentUI.field.text).toBe('ADA');
  await key(page,'Enter');await key(page,'Back');
  expect((await snap(page)).profile.name).toBe('ADA');
  await text(page,'e');await tapCanvas(page,180,74);
  await key(page,'Right');await text(page,'X');await key(page,'Enter');await key(page,'Back');
  expect((await snap(page)).profile.name).toBe('AXDA');
  await text(page,'t');await tapCanvas(page,195,74);await text(page,'3');await key(page,'Enter');await key(page,'Back');
  expect((await snap(page)).profile.durations[0]).toBe(3);
  await text(page,'w');await text(page,'BOB');await key(page,'Enter');await key(page,'Back');
  await text(page,'l');await expect(game(page)).toHaveAttribute('data-screen','load');
  await key(page,'Down');expect((await snap(page)).chooser.selection).toBe(1);
  await key(page,'Up');await key(page,'Enter');expect((await snap(page)).profile.name).toBe('AXDA');
  await text(page,'h');await expect(game(page)).toHaveAttribute('data-screen','help');
  await key(page,'Down');await key(page,'Back');await expect(game(page)).toHaveAttribute('data-screen','menu');
  await tapCanvas(page,250,113);await expect(game(page)).toHaveAttribute('data-screen','practice');
  await key(page,'Back');await expect(game(page)).toHaveAttribute('data-screen','results');
  // Initial result pointer selects Next; arrows select Menu, Enter activates it.
  await key(page,'Right');await key(page,'Enter');await expect(game(page)).toHaveAttribute('data-screen','menu');
  await expect(input(page)).toBeFocused();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mtt-static-translation.students.v1')));
  expect(Object.keys(saved).sort()).toEqual(['current','students']);expect(saved.students.AXDA).toHaveLength(260);
});

test('DOM composition resets the caret before the next native insertion; host loss cancels stale composition',async({page})=>{
  await ready(page);await text(page,'w');
  await input(page).evaluate(e=>{
    e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
    e.value+='AB';
    e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:'AB',isComposing:true}));
    e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'AB'}));
    e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'AB'}));
  });
  await page.keyboard.insertText('CD');
  expect((await snap(page)).studentUI.field.text).toBe('ABCD');
  await page.keyboard.press('Backspace');await page.keyboard.press('Backspace');await page.keyboard.press('Enter');
  expect((await snap(page)).profile.name).toBe('AB');
  await key(page,'Back');await text(page,'e');await tapCanvas(page,180,74);
  await input(page).evaluate(e=>{
    e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.value+='stale';
    window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));
    e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'stale'}));
  });
  expect((await snap(page)).studentUI.field.text).toBe('AB');
});

test('editor and toolbar keep gameplay running; real host blur flushes committed text and resumes without moving focus',async({page})=>{
  await ready(page);await tapCanvas(page,250,113);
  await expect(game(page)).toHaveAttribute('data-screen','practice');
  await input(page).tap();const a=await snap(page);await page.clock.runFor(240);
  expect((await snap(page)).ticks).toBeGreaterThan(a.ticks);
  await key(page,'Left');await expect(game(page)).toHaveAttribute('data-suspended','false');await expect(input(page)).toBeFocused();
  // Keydown plus input from a hardware keyboard in the editor is not doubled.
  const code=(await snap(page)).practice.rows[33];await page.keyboard.type(String.fromCharCode(code));await page.clock.runFor(120);
  expect((await snap(page)).practice.attempts).toBe(1);
  await text(page,'z'.repeat(300));expect((await snap(page)).hostInputPending).toBe(300);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect(game(page)).toHaveAttribute('data-suspended','true');expect((await snap(page)).hostInputPending).toBe(0);
  const paused=await snap(page);await page.clock.runFor(10000);expect((await snap(page)).ticks).toBe(paused.ticks);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(input(page)).toBeFocused();await expect(game(page)).toHaveAttribute('data-suspended','false');
  await page.clock.runFor(120);expect((await snap(page)).practice.attempts).toBe(1);
  const before=await snap(page),target=before.practice.rows[33+before.practice.index];
  const wrong=target===65?'B':'A';
  await text(page,wrong.repeat(299)+String.fromCharCode(target));
  expect((await snap(page)).hostInputPending).toBe(300);
  // Advance less than one host interval at a time so the final correct key
  // stays queued while we prove all preceding keys were consumed in order.
  for(let i=0;i<310&&(await snap(page)).hostInputPending>1;i++)await page.clock.runFor(54);
  const tail=await snap(page);
  expect(tail.hostInputPending).toBe(1);
  expect(tail.practice.attempts).toBe(before.practice.attempts+299);
  expect(tail.practice.correct).toBe(before.practice.correct);
  await page.clock.runFor(60);
  const consumed=await snap(page);
  expect(consumed.hostInputPending).toBe(0);
  expect(consumed.practice.attempts).toBe(before.practice.attempts+300);
  expect(consumed.practice.correct).toBe(before.practice.correct+1);
  expect(consumed.practice.index).toBe(before.practice.index+1);
  await text(page,'z'.repeat(300));await key(page,'Back');
  await expect(game(page)).toHaveAttribute('data-screen','results');expect((await snap(page)).hostInputPending).toBe(0);
  await key(page,'Back');await page.clock.runFor(300);await tapCanvas(page,250,113);
  await expect(game(page)).toHaveAttribute('data-screen','practice');
  expect((await snap(page)).practice.attempts).toBe(0);await expect(input(page)).toBeFocused();
});

test('short portrait and landscape keep the complete raster, editable field and key strip in the visible viewport',async({page})=>{
  await ready(page);await tapCanvas(page,250,113);
  await page.screenshot({path:`.tmp/mobile-${test.info().project.name}-portrait.png`});
  for(const viewport of [{width:390,height:340},{width:844,height:250},{width:320,height:240}]) {
    await page.setViewportSize(viewport);await input(page).tap();
    const view=await page.evaluate(()=>({width:visualViewport.width,height:visualViewport.height,left:visualViewport.offsetLeft,top:visualViewport.offsetTop}));
    const raster=await game(page).boundingBox(),editor=await input(page).boundingBox(),controls=await page.locator('#mobile-controls').boundingBox();
    expect(raster.width/raster.height).toBeCloseTo(1.6,2);
    for(const bounds of [raster,editor,controls]) {
      expect(bounds.x).toBeGreaterThanOrEqual(view.left-1);expect(bounds.y).toBeGreaterThanOrEqual(view.top-1);
      expect(bounds.x+bounds.width).toBeLessThanOrEqual(view.left+view.width+1);
      expect(bounds.y+bounds.height).toBeLessThanOrEqual(view.top+view.height+1);
    }
    expect(raster.y+raster.height).toBeLessThanOrEqual(controls.y);
    for(const name of ['Back','Enter','Left','Up','Down','Right'])await expect(button(page,name)).toBeInViewport();
    await expect(input(page)).toBeFocused();await expect(game(page)).toHaveAttribute('data-suspended','false');
    await page.screenshot({path:`.tmp/mobile-${test.info().project.name}-${viewport.width}x${viewport.height}.png`});
  }
});
