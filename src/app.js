import './style.css';
import { courseMode, advanceCourse, recordResult } from './course.js';
import { MODES, KEY_GROUPS, createAttempt, stats, advanceTime, pause, resume, typeKey, result, fingerHint } from './engine.js';
import { loadProfile, saveProfile } from './storage.js';
import { drawScene } from './scene.js';
import { drawTitle, drawTeacher, drawPortrait } from './screen-art.js';
import { gloveMarkup, updateGloves } from './glove-hud.js';
const root = document.querySelector('#app');
let storage; try { storage = window.localStorage; } catch { /* Private browsing. */ }
let profile = loadProfile(storage), attempt, screen = 'menu', lastTime = performance.now(), recorded = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const screenAnnouncement = document.createElement('div');
screenAnnouncement.className = 'visually-hidden';
screenAnnouncement.setAttribute('role', 'status');
screenAnnouncement.setAttribute('aria-live', 'polite');
screenAnnouncement.setAttribute('aria-atomic', 'true');
document.body.append(screenAnnouncement);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock = s => `${Math.floor(Math.ceil(s) / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;
let saveFailed = !saveProfile(profile, storage);
let lastOptions;
function save() { saveFailed = !saveProfile(profile, storage); }
function shell(content) {
  document.body.classList.toggle('playing', screen === 'game');
  root.innerHTML = `<div class="cabinet${screen === 'game' ? ' game-cabinet' : ''}"><header><a href="#" id="home" aria-label="Main menu">M<span>★</span>T</a><span>MARIO TEACHES TYPING</span><span class="edition">BROWSER EDITION</span></header>${content}<footer><span>Unofficial fan recreation · Screenshot-traced/edited art</span><span>${saveFailed ? 'Storage unavailable · session only' : 'Progress saved on this browser'}</span></footer></div>`;
  document.querySelector('#home').onclick = e => { e.preventDefault(); if(screen === 'game') { pauseGame('Lesson paused. Resume or return to the menu.'); } else menu(); };
}
function menu() {
  screen = 'menu'; attempt = null;
  shell(`<main class="menu"><div class="intro"><h1 class="title-lettering">Mario Teaches Typing</h1><a class="title-skip" href="#student-name">Choose student & lesson ↓</a><canvas id="title-art" role="img" aria-label="Mario Teaches Typing. Mario sits at a computer giving a victory sign, Princess leans over the desk, Luigi raises a glove and Toad runs beside them. Traced/edited fan reconstruction of the original title; obscured details are inferred."></canvas><p class="lede">Choose your student and lesson. Let’s-a go!</p><p class="lede fine">Traced/edited reference art with reconstructed hidden details. Luigi/Princess gameplay poses remain unsupported stand-ins.</p></div><section class="student"><p class="eyebrow">STUDENT · LESSONS</p><h2>Student information</h2><form id="profile"><label>Your name<input id="student-name" name="name" maxlength="24" value="${escapeHtml(profile.name)}" required></label><fieldset><legend>Choose your character</legend><div class="characters">${['Mario','Luigi','Princess'].map((name,i)=>`<label class="character"><input type="radio" name="character" value="${name}" ${profile.character===name?'checked':''}><canvas class="portrait p${i}" data-portrait="${name}" aria-hidden="true"></canvas><span>${name}</span></label>`).join('')}</div></fieldset><label>Lesson path<select name="path"><option value="guided" ${profile.settings.guided?'selected':''}>Guided course</option><option value="custom" ${!profile.settings.guided?'selected':''}>Custom / practice (no course progress)</option></select></label><label>Activity<select name="mode">${Object.entries(MODES).map(([id,m])=>`<option value="${id}" ${profile.settings.mode===id?'selected':''}>${m.name}</option>`).join('')}</select></label><label>Keyboard lesson<select name="group">${KEY_GROUPS.map((g,i)=>`<option value="${i}" ${profile.settings.group===i?'selected':''}>${g.name}</option>`).join('')}</select></label><div class="settings-row"><label>Goal · WPM<input name="goal" type="number" min="1" max="150" value="${profile.settings.goal}" required></label><label>Time · seconds<input name="duration" type="number" min="1" max="3600" value="${profile.settings.duration}" required></label></div><label class="sound"><input type="checkbox" name="sound" ${profile.settings.sound?'checked':''}> Sound effects</label><button class="primary" type="submit">Start lesson <span aria-hidden="true">▶</span></button><p class="fine">Reach your goal with 90% accuracy.<br>Guided lessons choose activity, keys and goal.<br>Escape pauses. Custom lessons never advance the course.</p></form>${profile.results.length?`<p class="last-result">Last lesson: ${profile.results.at(-1).wpm.toFixed(1)} WPM · ${profile.results.at(-1).accuracy.toFixed(0)}% accuracy</p>`:''}<div class="lesson-note"><strong>YOUR GUIDED COURSE</strong><span id="course-position">${profile.course.graduated ? 'Mario Graduate · Practice anytime' : `${KEY_GROUPS[profile.course.group].name} · ${profile.course.goal} WPM · ${courseMode(profile.course)}`}</span><button id="next" ${!profile.course.pending?'disabled':''}>Next lesson →</button><button id="report">Report card & certificates</button></div></section></main>`);
  drawTitle(document.querySelector('#title-art'));
  document.querySelectorAll('[data-portrait]').forEach(canvas=>drawPortrait(canvas,canvas.dataset.portrait));
  document.querySelector('#next').onclick=()=>{advanceCourse(profile,new Date().toISOString()); save(); menu();};
  document.querySelector('#report').onclick=report;
  const form=document.querySelector('#profile');
  const configure=()=>{
    const guided=form.elements.path.value==='guided' && !profile.course.graduated;
    if (profile.course.graduated && form.elements.path.value==='guided') form.elements.path.value='custom';
    for(const name of ['mode','group','goal']) form.elements[name].disabled=guided;
    if(guided) { form.elements.mode.value=courseMode(profile.course); form.elements.group.value=profile.course.group; form.elements.goal.value=profile.course.goal; }
    form.elements.duration.value=profile.settings.durations[form.elements.mode.value];
  };
  form.elements.path.onchange=configure; form.elements.mode.onchange=configure; configure();
  document.querySelector('#profile').onsubmit = e => {
    e.preventDefault(); const data = new FormData(e.target);
    profile.name = data.get('name').trim() || 'Player'; profile.character = data.get('character');
    const guided=form.elements.path.value==='guided';
    const mode=form.elements.mode.value;
    profile.settings = { ...profile.settings, guided, mode, group:Number(form.elements.group.value), goal:Number(form.elements.goal.value), duration:Number(data.get('duration')), sound:data.has('sound') };
    profile.settings.durations[mode]=profile.settings.duration;
    save(); start({...profile.settings,character:profile.character});
  };
}
function start(options = lastOptions) {
  screenAnnouncement.textContent = '';
  lastOptions = options;
  screen = 'game'; recorded = false; attempt = createAttempt({...options, reducedMotion}); lastTime = performance.now();
  shell(`<main class="play mode-${attempt.mode}">
    <div class="lesson-heading"><h1>${MODES[attempt.mode].name}</h1><span id="encounter-status">${attempt.guided?'Guided':'Custom'} · ${KEY_GROUPS[attempt.group].name}</span></div>
    <div class="game-screen">
      <div id="text-strip" class="text-strip" aria-label="Scrolling target text"></div>
      <canvas id="scene" width="640" height="280" aria-label="${attempt.mode} scene. ${attempt.mode==='outdoor'?'Type the starred target as it approaches.':'Type the displayed text.'}"></canvas>
      <section class="hud" aria-label="Lesson statistics and finger guide">
        <div class="hud-stats"><div class="hud-time">Time left <strong id="time"></strong></div><div>Typed <strong id="correct">0</strong></div><div class="hud-secondary">Accuracy <strong id="accuracy">0%</strong></div></div>
        <div class="hand-guide">${gloveMarkup('left')}<div class="target-wrap"><span>TYPE</span><strong id="target"></strong><span class="space-legend">␣ = space</span></div>${gloveMarkup('right')}</div>
        <div class="hud-stats hud-right"><div class="hud-speed">WPM <strong id="wpm">0</strong></div><div>Errors <strong id="errors">0</strong></div><div class="hud-secondary hud-goal">Goal ${attempt.goal} WPM · 90%</div></div>
        <p id="finger"></p>
      </section>
    </div>
    <div class="play-controls"><button id="pause">Pause <kbd>Esc</kbd></button><div class="next-keys"><span>UP NEXT</span><span id="preview" aria-label="Upcoming keys"></span></div><button id="keyboard-toggle" aria-expanded="false" aria-controls="keyboard-guide">Keyboard help</button></div>
    <div id="keyboard-guide" hidden><p class="fine">Match case and punctuation. Yellow marks the key finger; blue marks opposite Shift. Wrong keys do not advance. Outdoor scenery moves continuously: one exact key waits for contact; missed targets return without penalty. Reduced motion makes targets stationary and immediate. Higher custom outdoor goals move faster; try water or practice for easier reading. Very short lessons may end before first contact.</p><div class="keyboard" aria-hidden="true">${['`1234567890-=','qwertyuiop[]\\','asdfghjkl;\'','zxcvbnm,./'].map(row=>`<div>${[...row].map(k=>`<span data-key="${escapeHtml(k)}">${escapeHtml(k)}</span>`).join('')}</div>`).join('')}<div><span id="shift">Shift</span><span data-key=" " class="space">space</span></div></div></div>
    <div id="pause-panel" hidden><h2>Lesson paused</h2><p id="pause-reason"></p><button id="resume" class="primary">Resume lesson</button><button id="leave">Return to menu</button></div>
  </main>`);
  document.querySelector('#pause').onclick=()=>pauseGame();
  document.querySelector('#keyboard-toggle').onclick = e => {
    const guide = document.querySelector('#keyboard-guide');
    guide.hidden = !guide.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!guide.hidden));
  };
  document.querySelector('#resume').onclick=()=>{ resume(attempt); lastTime=performance.now(); document.querySelector('#pause-panel').hidden=true; document.querySelector('#pause').focus(); };
  document.querySelector('#leave').onclick=menu;
  update(); document.querySelector('#pause').focus();
}
function tick(now) { if(attempt) advanceTime(attempt,(now-lastTime)/1000); lastTime=now; }
function pauseGame(reason) {
  if(screen!=='game' || attempt.status==='finished') return;
  tick(performance.now()); if(attempt.status==='finished') { finish(); return; }
  pause(attempt,reason); document.querySelector('#pause-panel').hidden=false; document.querySelector('#pause-reason').textContent=attempt.pauseReason; document.querySelector('#resume').focus(); update();
}
function update() {
  if(screen!=='game') return;
  const m=stats(attempt), key=attempt.text[attempt.correct % attempt.text.length], hint=fingerHint(key);
  for(const [id,value] of Object.entries({time:clock(m.remaining),wpm:m.wpm.toFixed(1),accuracy:`${m.accuracy.toFixed(0)}%`,correct:attempt.correct,errors:attempt.errors,target:key===' '?'␣':key,finger:hint})) document.getElementById(id).textContent=value;
  if(attempt.mode==='outdoor') {
    const target=attempt.travel.obstacles.find(o=>o.id===attempt.correct);
    document.querySelector('#encounter-status').textContent=reducedMotion?'Type the starred key · motion reduced':attempt.travel.buffered?'Key held for the star · wait for contact':target.x<189?'Missed? Same key returns · type now to hold it':'Type the star as it approaches · early keys are held';
  }
  updateGloves(document.querySelector('.hand-guide'), hint);
  document.querySelector('#preview').textContent=Array.from({length:12},(_,i)=>attempt.text[(attempt.correct+i+1)%attempt.text.length]).map(k=>k===' '?'␣':k).join(' ');
  const shifted='~!@#$%^&*()_+{}|:"<>?', base='`1234567890-=[]\\;\',./';
  const physical=shifted.includes(key)?base[shifted.indexOf(key)]:key.toLowerCase();
  document.querySelectorAll('[data-key]').forEach(el=>el.classList.toggle('active',el.dataset.key===physical));
  document.querySelector('#shift').classList.toggle('active', /[A-Z]/.test(key)||shifted.includes(key));
  const upcoming=Array.from({length:attempt.mode==='practice'?400:100},(_,i)=>attempt.text[(attempt.correct+i)%attempt.text.length]).join('');
  document.querySelector('#text-strip').innerHTML=`<mark>${escapeHtml(key===' '?'␣':key)}</mark>${escapeHtml(upcoming.slice(1)).replaceAll(' ','·')}`;
  drawScene(document.querySelector('#scene'), {...attempt,reducedMotion},attempt.elapsed);
}
function finish() {
  if(recorded) return; recorded=true; screen='results';
  const r=result(attempt); recordResult(profile,r,new Date().toISOString()); save();
  const reasons = [];
  if (!r.passed) {
    if (!r.attempted) reasons.push('No keys were typed, so the attempt could not pass.');
    else {
      if (r.wpm < r.goal) reasons.push(`Speed was ${r.wpm.toFixed(1)} WPM, below your selected goal of ${r.goal} WPM.`);
      if (r.accuracy < 90) reasons.push(`Accuracy was ${r.accuracy.toFixed(1)}%, below this recreation's 90% pass rule.`);
    }
  }
  const outcome = r.passed
    ? `Passed. ${MODES[r.mode].name}. Goal reached at timeout. You met your selected WPM goal and this recreation's 90% accuracy rule.`
    : `Not passed. ${MODES[r.mode].name}. ${reasons.join(' ')}`;
  shell(`<main class="results ${r.passed?'results-passed':'results-needs-practice'}" aria-labelledby="result-title"><p class="eyebrow">LESSON COMPLETE · ${escapeHtml(profile.name)}</p><h1 id="result-title">${r.passed?'A star performance!':'Every key is practice.'}</h1><div class="classroom">${r.passed?'<p class="victory-seal" aria-hidden="true">★ VICTORY! ★</p>':''}<div class="blackboard"><p class="chalk-label">${MODES[r.mode].name} / ${escapeHtml(KEY_GROUPS[r.group].name)}</p><h2>${r.passed?'GOAL REACHED':'KEEP GOING'}</h2><dl><div><dt>Correct keys</dt><dd>${r.correct}</dd></div><div><dt>Errors</dt><dd>${r.errors}</dd></div><div><dt>Accuracy</dt><dd>${r.accuracy.toFixed(1)}%</dd></div><div><dt>Words / minute</dt><dd>${r.wpm.toFixed(1)}</dd></div><div><dt>Active lesson time</dt><dd>${clock(r.duration)}</dd></div></dl><div class="result-feedback">${r.passed?'<p>Goal reached at timeout. You met your selected WPM goal and this recreation\'s 90% accuracy rule.</p>':`<p>This attempt did not meet the pass requirements:</p><ul>${reasons.map(reason=>`<li>${escapeHtml(reason)}</li>`).join('')}</ul>`}</div></div><canvas id="teacher-art" aria-label="Mario in a graduation gown holding a pointer beside your results."></canvas></div><div class="result-actions"><button id="retry" class="primary">Try again ↻</button><button id="menu">Main menu</button><button id="next" ${!profile.course.pending?'disabled':''}>Next lesson →</button><button id="report">Report card</button></div><p class="fine">${profile.course.graduated?'Mario Graduate! Your graduation certificate is on the report card.':profile.course.pending?'Next is unlocked. Your progress is saved even if you leave or retry.':'Only a successful guided lesson unlocks Next.'}</p></main>`);
  document.querySelector('#next').onclick=()=>{advanceCourse(profile,new Date().toISOString()); save(); menu();}; document.querySelector('#report').onclick=report;
  drawTeacher(document.querySelector('#teacher-art'));
  screenAnnouncement.textContent = outcome;
  document.querySelector('#retry').onclick=()=>start(); document.querySelector('#menu').onclick=menu; document.querySelector('#retry').focus();
}
function report() {
  screen='report'; attempt=null;
  const titles={outdoor:'Outdoor graduate',underwater:'Underwater graduate',graduation:'Mario Graduate · 50 WPM castle'};
  shell(`<main class="results report"><p class="eyebrow">STUDENT RECORD · ${escapeHtml(profile.name)}</p><h1>Report card</h1><p>${profile.course.graduated?'Mario Graduate':`${KEY_GROUPS[profile.course.group].name} · Goal ${profile.course.goal} WPM`}</p><div class="table-scroll"><table><thead><tr><th>Activity</th><th>Keys</th><th>Goal</th><th>WPM</th><th>Accuracy</th><th>Result</th></tr></thead><tbody>${profile.results.slice().reverse().map(r=>`<tr><td>${MODES[r.mode].name}<small>${r.guided?'Guided':'Custom'} · ${escapeHtml(r.date.slice(0,10))}</small></td><td>${KEY_GROUPS[r.group].name}</td><td>${r.goal}</td><td>${r.wpm.toFixed(1)}</td><td>${r.accuracy.toFixed(1)}%</td><td>${r.passed?'Pass':'Retry'}</td></tr>`).join('')}</tbody></table></div>${!profile.results.length?'<p>No completed lessons yet. Start with the home row.</p>':''}<h2>Earned certificates</h2><div class="certificates">${profile.certificates.map((c,i)=>`<article class="certificate"><p>★ MARIO TEACHES TYPING ★</p><h2>${titles[c.kind]}</h2><p>Awarded to <strong>${escapeHtml(c.name)}</strong></p><p>${escapeHtml(c.date.slice(0,10))} · Guided course</p><button data-download="${i}">Download certificate</button></article>`).join('')}</div>${!profile.certificates.length?'<p>Earn certificates by moving from outdoor to water, water to castle, and graduating at 50 WPM.</p>':''}<div class="result-actions"><button id="menu">Main menu</button><button id="print">Print report & certificates</button></div></main>`);
  document.querySelector('#menu').onclick=menu;
  document.querySelector('#print').onclick=()=>window.print();
  document.querySelectorAll('[data-download]').forEach(button=>button.onclick=()=>{
    const c=profile.certificates[Number(button.dataset.download)];
    const blob=new Blob([`MARIO TEACHES TYPING\n${titles[c.kind]}\nAwarded to ${c.name}\n${c.date.slice(0,10)}\nGuided course. Unofficial fan recreation.\n`],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=`typing-certificate-${c.kind}.txt`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  document.querySelector('#menu').focus();
}
let audio;
function beep(correct) {
  if(!profile.settings.sound) return;
  try { audio ||= new AudioContext(); audio.resume(); const o=audio.createOscillator(),g=audio.createGain(); o.type='square'; o.frequency.value=correct?660:160; g.gain.setValueAtTime(.035,audio.currentTime); g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.08); o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime+.08); } catch { /* Audio is optional. */ }
}
window.addEventListener('keydown',e=>{
  if(screen!=='game') return;
  if(e.key==='Escape') { e.preventDefault(); pauseGame(); return; }
  if(attempt.status!=='running') return;
  tick(performance.now()); if(attempt.status==='finished') { finish(); return; }
  // Consume gameplay characters even when an already-held key or repeat is ignored.
  // In particular, Space must not activate the focused Pause button.
  if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.isComposing) e.preventDefault();
  const outcome=typeKey(attempt,e);
  if(outcome!=='ignored') { e.preventDefault(); beep(outcome==='correct'||outcome==='buffered'); update(); if(attempt.status==='paused') pauseGame(); }
});
window.addEventListener('blur',()=>pauseGame('The window lost focus. Resume when you are ready.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden) pauseGame('The tab was hidden. Resume when you are ready.');});
function frame(now) { if(screen==='game') { tick(now); if(attempt.status==='finished') finish(); else update(); } requestAnimationFrame(frame); }
menu(); requestAnimationFrame(frame);
