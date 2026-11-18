import { test, expect } from '@playwright/test';
import { newStudent } from '../../recovered/control/student.mjs';
import { SAVE_KEY } from '../../app/session.mjs';
import { certificateDocument } from '../../recovered/control/certificate.mjs';
import { skipStartupUI } from './source-path.mjs';

const snapshot=page=>page.evaluate(()=>translationSnapshot());
const stored=page=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])));
async function ready(page,completed=[1,1,0],name='ADA') {
  const bytes=newStudent(name);bytes.set([...completed,0,1,0,1,0,1],38);
  await page.clock.install();await page.clock.pauseAt(new Date());
  await page.addInitScript(({key,bytes})=>{
    window.__sourceTestClock=true;
    localStorage.setItem(key,JSON.stringify({current:'ADA',students:{ADA:bytes,BOB:Array(260).fill(17)}}));
    localStorage.setItem('typing-kingdom-v1','legacy-1');localStorage.setItem('typing-kingdom-v2','legacy-2');
  },{key:SAVE_KEY,bytes:Array.from(bytes)});
  await page.goto('./?seed=1');await skipStartupUI(page);
  // Observe the real frame window.print() call and native beforeprint event,
  // without opening an OS dialog in headless Chromium or replacing the host.
  await page.evaluate(()=>{
    window.printCalls=[];window.nativePrintEvents=0;window.storageWrites=[];
    const setItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(...args){storageWrites.push(args);return setItem.apply(this,args);};
    const descriptor=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'contentWindow');
    Object.defineProperty(HTMLIFrameElement.prototype,'contentWindow',{...descriptor,get(){
      const target=descriptor.get.call(this);
      if(target&&!target.__printObserved) {
        target.__printObserved=true;
        const native=target.print.bind(target);
        target.addEventListener('beforeprint',()=>{window.nativePrintEvents++;});
        target.print=()=>{printCalls.push(target.document.querySelector('pre').textContent);native();};
      }
      return target;
    }});
  });
}

test('completed and printed levels reprint exact text natively without changing profile or storage',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await ready(page,[1,1,0],'<>&"');
  const before=await snapshot(page),storage=await stored(page);
  await page.locator('#game').press('c');
  const dialog=page.getByRole('dialog'),select=dialog.getByRole('combobox');
  await expect(dialog).toBeVisible();expect((await snapshot(page)).screen).toBe('certificate');
  await expect(select.locator('option')).toHaveCount(3);
  expect(await select.locator('option').evaluateAll(options=>options.map(o=>o.disabled))).toEqual([false,false,true]);
  const data=await page.evaluate(()=>fetch('./app/data.json').then(r=>r.json()));
  for(const level of [1,2,2]) {
    await select.selectOption(String(level));await dialog.getByRole('button',{name:'Print',exact:true}).click();
    const calls=await page.evaluate(()=>printCalls);
    expect(calls.at(-1)).toBe(certificateDocument(before.profile,level,data));
    // Chromium may suppress immediate repeated dialogs; every request still
    // calls the native method, and at least one native print event must fire.
    expect(await page.evaluate(()=>nativePrintEvents)).toBeGreaterThan(0);
    await expect(dialog).toBeVisible();
  }
  expect(await page.evaluate(()=>printCalls.length)).toBe(3);
  const frame=page.frames().find(f=>f.parentFrame());
  expect(await frame.locator('pre').textContent()).toBe(certificateDocument(before.profile,2,data));
  await page.emulateMedia({media:'print'});
  const layout=await frame.locator('pre').evaluate(pre=>{
    const s=getComputedStyle(pre),r=pre.getBoundingClientRect();
    return {whiteSpace:s.whiteSpace,wrap:s.overflowWrap,break:s.wordBreak,font:s.fontFamily,
      width:r.width,height:r.height,scrollWidth:pre.scrollWidth,
      lineHeight:parseFloat(s.lineHeight),style:pre.ownerDocument.querySelector('style').textContent,
      htmlChildren:pre.children.length};
  });
  expect(layout.whiteSpace).toBe('pre');expect(layout.wrap).toBe('normal');expect(layout.break).toBe('normal');
  expect(layout.font).toContain('monospace');expect(layout.htmlChildren).toBe(0);
  expect(layout.width).toBeLessThanOrEqual(7.5*96);expect(layout.scrollWidth).toBeLessThanOrEqual(7.5*96);
  expect(layout.height).toBeCloseTo(60*layout.lineHeight,0);expect(layout.height).toBeLessThanOrEqual(10*96);
  expect(layout.style).toContain('@page { size: letter portrait; margin: 0.5in; }');
  // Test-only pagination probe of the actual print DOM/CSS, not an app export.
  const printPage=await page.context().newPage();
  await printPage.setContent(await frame.evaluate(()=>document.documentElement.outerHTML));
  const output=await printPage.pdf({preferCSSPageSize:true});
  expect(output.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  await printPage.close();
  await page.emulateMedia({media:'screen'});
  await dialog.getByRole('button',{name:'Cancel'}).click();
  await expect(dialog).toHaveCount(0);await expect(page.locator('iframe')).toHaveCount(0);
  expect((await snapshot(page)).profile).toEqual(before.profile);expect(await stored(page)).toEqual(storage);
  expect(await page.evaluate(()=>storageWrites)).toEqual([]);
  // Reopen/cancel without printing, including Escape, then print again.
  await page.locator('#game').press('c');await page.getByRole('dialog').press('Escape');
  await expect.poll(async()=>(await snapshot(page)).screen).toBe('menu');
  await expect(dialog).toHaveCount(0);
  await page.locator('#game').press('c');await dialog.getByRole('button',{name:'Print',exact:true}).click();
  expect(await page.evaluate(()=>printCalls.length)).toBe(4);
  await dialog.getByRole('button',{name:'Cancel'}).click();
  expect((await snapshot(page)).profile).toEqual(before.profile);expect(await stored(page)).toEqual(storage);
  expect(await page.evaluate(()=>storageWrites)).toEqual([]);expect(errors).toEqual([]);
});

test('no completed levels cannot print, cancellation is inert',async({page})=>{
  await ready(page,[0,0,0]);const before=await snapshot(page),storage=await stored(page);
  await page.locator('#game').press('c');const dialog=page.getByRole('dialog');
  await expect(dialog.getByText('No completed levels.')).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Print',exact:true})).toBeDisabled();
  await expect(dialog.getByRole('combobox')).toBeDisabled();
  await dialog.press('Escape');await expect(dialog).toHaveCount(0);
  expect((await snapshot(page)).profile).toEqual(before.profile);expect(await stored(page)).toEqual(storage);
  expect(await page.evaluate(()=>printCalls)).toEqual([]);expect(await page.evaluate(()=>storageWrites)).toEqual([]);
});
