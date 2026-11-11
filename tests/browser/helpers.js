import { expect } from '@playwright/test';
import { defaults, createStore, STORAGE_KEY } from '../../src/storage.js';

export function fixture({duration=3,goal=5,group=5,character='Mario'}={}) {
  const p=defaults({name:'Ada',character});
  Object.assign(p.settings,{goal,group,duration,durations:{outdoor:duration,underwater:duration,castle:duration,practice:duration}});
  return createStore(p);
}
export async function activate(page,selector) {
  await page.locator(selector).focus();
  await page.keyboard.press('Enter');
}
export async function enterActivity(page,mode,via='shortcut',{waitForGameplay=true}={}) {
  const modes={outdoor:'1',underwater:'2',castle:'3',practice:'4'};
  if(!modes[mode])throw new RangeError(`Unknown activity: ${mode}`);
  if(via==='pointer')await page.locator(`#activity-${mode}`).click();
  else if(via==='shortcut')await page.keyboard.press(modes[mode]);
  else throw new RangeError(`Unknown activity entry: ${via}`);
  if(waitForGameplay){
    if(page.levelEntryTestMotion==='no-preference'){
      if(page.levelEntryTestClock)await page.clock.runFor(200);
      else await page.waitForTimeout(250);
    }
    await page.locator('#scene').waitFor({state:'visible'});
  }
}
export async function boot(page,{data=fixture(),motion='reduce',clock=true}={}) {
  page.levelEntryTestMotion=motion;page.levelEntryTestClock=clock;
  await page.emulateMedia({reducedMotion:motion});
  if(data) await page.addInitScript(({key,data})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(data));},{key:STORAGE_KEY,data});
  if(clock)await page.clock.install({time:new Date('2026-11-10T00:00:00Z')});
  await page.goto('/');
  await page.locator('#skip-title').click();
  await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');
  await expect(page.locator('summary').first()).toContainText('File');
  await expect(page.locator('summary').first()).toBeFocused();
  if(clock)await page.clock.pauseAt(new Date('2026-11-10T00:01:00Z'));
}
export async function openMenu(page,name) {
  const summary=page.locator('summary').filter({hasText:new RegExp(`^${name}$`)});
  if(await summary.locator('..').getAttribute('open')===null){await summary.focus();await page.keyboard.press('Enter');}
}
export async function custom(page,mode,{generated=true}={}) {
  await openMenu(page,'File');await activate(page,'#help');await activate(page,'#custom');
  await page.getByRole('combobox',{name:'Activity',exact:true}).selectOption(mode);
  await activate(page,'#custom-form button.primary');
  await activate(page,generated?'#generated':'#original');
}
export async function typeTargets(page,count,{resumePipe=true,lowercase=false}={}) {
  for(let i=0;i<count;i++) {
    const key=await page.locator('#target').textContent();
    await page.keyboard.press(key==='␣'?'Space':lowercase?key.toLowerCase():key);
    if(resumePipe&&await page.locator('#resume').isVisible())await activate(page,'#resume');
  }
}
export async function returnMenu(page) {await page.keyboard.press('Escape');await activate(page,'#leave');}
export async function stored(page) {return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE_KEY);}
export async function selectedStudent(page) {const data=await stored(page);return data.students.find(student=>student.id===data.currentStudentId);}
