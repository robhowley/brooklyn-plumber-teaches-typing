import assert from 'node:assert/strict';
// Four queued source keys skip logo, zoom, title delays and greeting separately.
// This path consumes zero title RNG draws. It is not a direct-menu mode.
export function skipStartup(session) {
  for(let i=0;i<4;i++)session.enqueue(32);
  session.step(0,1,0);
  assert.equal(session.screen,'menu');assert.equal(session.input.pending(),false);
  // Original menu callback precedes selection: consume its initial RNG draw
  // and complete the1/1/2-wait blink, rather than preserving direct-menu traces.
  session.menuStep(2);
  for(let t=3;t<=6;t++)session.menuStep(t);
  session.takePresentationEffects();
  // Existing lesson fixtures explicitly replace their host clock origin.
  session.rebaseHostClock(6,0);return session;
}
export function finishCelebration(session,start=10000) {
  let t=start;
  while(session.screen==='celebration'&&t<start+3000) {
    const wait=session.celebration.wait;
    session.step(wait==='wait-input'?32:0,t++,0);
    if(session.celebrationWorld===3&&session.celebration.endMode===4&&t>start+20)session.enqueue(32);
  }
  assert.notEqual(session.screen,'celebration');return t;
}
export async function finishCelebrationUI(page) {
  for(let i=0;i<1000;i++) {
    const state=await page.evaluate(()=>translationSnapshot());
    if(state.screen!=='celebration')return;
    if(state.celebration.wait==='wait-input'||(state.celebration.world===3&&i>20))await page.locator('#game').press('Space');
    await page.clock.runFor(120);
  }
  throw new Error('Source celebration did not return');
}
export async function skipStartupUI(page,{muted=true}={}) {
  await page.waitForFunction(()=>document.querySelector('#game')?.dataset.screen);
  // Non-audio suites explicitly omit sound, never wait a fabricated clip duration.
  if(muted)await page.evaluate(()=>{AudioContext.prototype.resume=()=>Promise.reject(new Error('Audio omitted by non-audio test'));});
  await page.locator('#game').focus();
  await page.evaluate(()=>window.scrollTo(0,0));
  // Synthetic skip events do not unlock audio. Keep a trusted, non-source
  // gesture for audio suites, without adding another startup/menu key.
  if(!muted)await page.locator('#game').press('Shift');
  // Check and queue all four source skip keys in one browser turn. Separate
  // awaited commands can deliver a late Space to the menu and open File.
  await page.evaluate(()=>{
    const game=document.querySelector('#game');
    if(game.dataset.screen==='startup')for(let i=0;i<4;i++)game.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));
  });
  const ready=()=>{
    const s=translationSnapshot();
    // The menu exists before its first callback starts the initial blink.
    return s.screen==='menu'&&s.menuTimer.delayTicks>0&&s.menuIdle&&!s.menuIdle.waiting&&!s.audioHost.blocking&&!s.inputPending;
  };
  if(await page.evaluate(()=>!!window.__sourceTestClock)) {
    // Advance only browser time until the source input pump is ready.
    for(let i=0;i<80&&!await page.evaluate(ready);i++)await page.clock.runFor(60);
  }
  await page.waitForFunction(ready);
}
export async function setDurationsUI(page,durations) {
  const key=k=>page.locator('#game').press(k);
  await key('t');
  for(let i=0;i<4;i++) {
    await key('Tab');
    if(durations[i]===undefined)continue;
    await key('Enter');await key('Home');await key('Delete');await key('Delete');
    await page.keyboard.type(String(durations[i]));await key('Enter');
  }
  await key('Escape');
}
export async function createStudentUI(page,{name,goal,character,lesson=1,durations=[]}) {
  const key=k=>page.locator('#game').press(k);
  await key('w');await page.keyboard.type(name);await key('Enter');
  if(goal!==undefined||character!==undefined) {
    await key('Tab');await key('Tab');await key('Enter');await key('Home');
    for(let i=0;i<3;i++)await key('Delete');
    await page.keyboard.type(String(goal??5));await key('Enter');
    if(character!==undefined) {for(let i=0;i<character;i++)await key('Tab');await key('Enter');}
  }
  await key('Escape');
  if(durations.some(n=>n!==undefined))await setDurationsUI(page,durations);
  if(lesson!==1) {
    await key('Enter');await key('ArrowRight');await key('ArrowRight');
    for(let i=1;i<lesson;i++)await key('ArrowDown');
    await key('Enter');
  }
}
