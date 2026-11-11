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
  if(muted && !await page.evaluate(()=>translationSnapshot().audioHost.muted))await page.locator('#host-mute').click();
  await page.locator('#focus').click();
  await page.evaluate(()=>window.scrollTo(0,0));
  // Queue separate keys for each original skip site before the next sampled tick.
  for(let i=0;i<4;i++)await page.locator('#game').press('Space');
  for(let i=0;i<80;i++) {
    const state=await page.locator('#game').getAttribute('data-screen');
    if(state==='menu')break;
    await page.locator('#game').press('Space');
    // Browser clock only. Never mutate a controller through page.evaluate.
    if(await page.evaluate(()=>!!window.__sourceTestClock))await page.clock.runFor(60);
    else await page.waitForTimeout(60);
  }
  await page.waitForFunction(()=>!translationSnapshot().audioHost.blocking);
  if(await page.evaluate(()=>!!window.__sourceTestClock))await page.clock.runFor(300);
  else await page.waitForTimeout(300);
}
