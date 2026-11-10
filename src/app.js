import './style.css';
import { courseMode, advanceCourse, recordResult } from './course.js';
import { RULESET, MODES, KEY_GROUPS, createAttempt, stats, advanceTime, pause, resume, typeKey, result, fingerHint } from './engine.js';
import { loadStore, currentStudent, createStudent, selectStudent, editStudent, saveStore } from './storage.js';
import { selectLesson, HISTORICAL_NOTICE } from './lessons.js';
import { drawScene } from './scene.js';
import { drawScreen, SCREEN_LAYOUTS } from './screen-art.js';
import { gloveMarkup, updateGloves } from './glove-hud.js';
import { drawTitleIllustration } from './title-art.js';

const root = document.querySelector('#app');
let storage;
try { storage = window.localStorage; } catch { /* Recovery stays session-only. */ }
const session = loadStore(storage);
let profile = currentStudent(session.data), attempt, screen, lastTime = performance.now(), recorded = false, lastOptions;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const announcement = document.createElement('div');
announcement.className = 'visually-hidden';
announcement.setAttribute('role', 'status');
announcement.setAttribute('aria-live', 'polite');
document.body.append(announcement);
const html = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock = s => `${Math.floor(Math.ceil(s) / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;
const position = c => `${KEY_GROUPS[c.group].name} · ${c.goal} WPM · ${MODES[courseMode(c)].name}`;
function save() { saveStore(session, storage); }
save();
function storageMessage() {
  if (session.persistence.status === 'recovery') return 'Recovery blocked saving: existing data is unreadable or unsupported and has NOT been overwritten. This session is temporary. Keep the original browser data for recovery.';
  if (session.persistence.status !== 'saved') return 'Storage unavailable or full: session only. Changes and earned progress may be lost on reload. Existing saved data has not been replaced.';
  return 'Progress saved on this browser';
}
function shell(content) {
  document.body.classList.toggle('playing', screen === 'game');
  root.innerHTML = `<div class="cabinet${screen === 'game' ? ' game-cabinet' : ''}"><header><a href="#" id="home" aria-label="Main menu">M<span>★</span>T</a><span>MARIO TEACHES TYPING</span><span class="edition">BROWSER EDITION</span></header>${content}<footer><span>Static 1992 archive art · Browser placement/adaptations · Rights unverified</span><span id="storage-status" role="status">${storageMessage()}</span></footer></div>`;
  document.querySelector('#home').onclick = e => { e.preventDefault(); screen === 'game' ? pauseGame('Resume or return to the menu.') : menu(); };
}
function page(name, family, title, body) {
  screen = name; attempt = null;
  shell(`<main class="archive-page" aria-labelledby="page-title"><div class="archive-illustration"><canvas id="screen-art" role="img" aria-label="Original ${family} background"></canvas><p class="fine">Original static ${family} artwork. Browser controls and layout.</p></div><section class="archive-controls"><h1 id="page-title">${title}</h1>${body}</section></main>`);
  drawScreen(document.querySelector('#screen-art'), family);
  if (['PREFS','LOAD','LESSTIME','HELP','BLACKBRD','RCARD','CERTIF','GREETBG'].includes(family)) {
    const illustration = document.querySelector('.archive-illustration');
    const controls = document.querySelector('.archive-controls');
    const art = document.querySelector('#screen-art');
    const composition = document.createElement('div');
    composition.className = 'original-screen';
    composition.dataset.family = family;
    const panel = document.createElement('section');
    panel.className = `original-panel${family === 'BLACKBRD' ? ' original-panel--chalk' : ''}`;
    panel.setAttribute('aria-label', title);
    panel.tabIndex = 0;
    panel.style.cssText = panelPosition(family);
    illustration.prepend(composition);
    composition.append(art, panel);
    for (const child of [...controls.children]) {
      if (!child.matches('h1,button,.result-actions')) panel.append(child);
    }
    document.querySelector('.archive-page').classList.add('archive-page--overlay');
    illustration.querySelector('.fine').textContent = `Original static ${family} artwork with browser DOM in its panel. Scroll the panel for more; Tab reaches every control.`;
    if (family === 'LESSTIME') controls.append(panel.querySelector('#times-form > p'));
    if (family === 'BLACKBRD') {
      const metrics = panel.querySelector('.result-metrics');
      panel.prepend(metrics);
    }
    controls.prepend(document.querySelector('#page-title'));
  }
}
function panelPosition(family) {
  const [x,y,width,height] = SCREEN_LAYOUTS[family].panel;
  return `--panel-x:${x/320*100}%;--panel-y:${y/200*100}%;--panel-width:${width/320*100}%;--panel-height:${height/200*100}%`;
}
function back(action = menu, focus = '#activity-outdoor') {
  document.querySelector('#back').onclick = () => { action(); const control=document.querySelector(focus); const details=control?.closest('details'); if(details)details.open=true; control?.focus(); };
}
function titleIntro() {
  screen = 'title';
  document.body.classList.add('title-screen');
  root.innerHTML = '<main class="title-intro"><button id="skip-title" aria-label="Skip title intro"><canvas id="title-art" role="img" aria-label="Mario Teaches Typing title"></canvas></button></main>';
  const button = document.querySelector('#skip-title');
  let dispose;
  const leave = () => {
    if (screen !== 'title') return;
    dispose?.();
    document.body.classList.remove('title-screen');
    announcement.textContent = '';
    welcome();
  };
  document.querySelector('.title-intro').onclick = leave;
  // Handle keydown so holding Space cannot activate the newly focused welcome button.
  button.onkeydown = event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); leave(); }
  };
  button.focus();
  announcement.textContent = 'Mario Teaches Typing. Press Enter or Space, or click to skip the title intro.';
  dispose = drawTitleIllustration(document.querySelector('#title-art'), { onComplete: leave });
}
function welcome() {
  page('welcome', 'GREET', 'Mario Teaches Typing', '<p>Choose a student, then learn one key at a time.</p><p>Unofficial browser recreation using static archive artwork. No original program or audio runs here.</p><button id="enter" class="primary">Enter main menu</button>');
  document.querySelector('#enter').onclick = () => menu();
  document.querySelector('#enter').focus();
}
function next() { advanceCourse(profile, new Date().toISOString()); save(); menu(); }
function pendingText() {
  return profile.course.pending ? `Earned Next: ${position(profile.course.pending.destination)}. The first successful attempt is retained across retries.` : 'Next is locked until a successful guided lesson.';
}
function menu(focus = '#activity-outdoor') {
  page('menu', 'MAINMENU', 'Main menu', `<p id="student-summary">${html(profile.name)} · ${profile.character}</p><nav class="menu-bar" aria-label="Application menus"><details><summary>File</summary><button id="new-student">New student</button><button id="load-student">Load student</button></details><details><summary>Student</summary><button id="edit-student">Edit student</button><button id="times">Lesson times</button></details><details><summary>Lessons</summary><button id="guided" ${profile.course.graduated?'disabled':''}>Continue guided course</button><button id="custom">Browser custom practice</button></details><details><summary>Help</summary><button id="help">Instructions</button><button id="keyboard">Keyboard guide</button></details></nav><p id="course-position">${profile.course.graduated ? 'Graduated at 50 WPM. Practice remains available.' : `Guided course: ${position(profile.course)}`}</p><p>Normal activities use your editable student goal (${profile.settings.goal} WPM). Only the matching guided course position advances.</p><div class="activity-list">${Object.entries(MODES).map(([mode,m],i)=>`<button id="activity-${mode}" ${mode==='underwater'&&profile.settings.goal<10 || mode==='castle'&&profile.settings.goal<30?'disabled':''}>${i+1}. ${m.name}</button>`).join('')}<button id="report">5. Report card & certificates</button><button id="next" ${!profile.course.pending?'disabled':''}>6. Next lesson</button></div><p class="fine">Water requires a student goal of at least 10 WPM; castle requires 30. Edit student to change the activity goal. Browser custom practice bypasses these gates but never advances.</p><p id="pending">${pendingText()}</p><p class="fine">Keys 1–6 select these actions outside text fields. Sound: ${profile.settings.sound?'synthetic cues on':'off'}.</p>`);
  document.querySelector('#new-student').onclick=()=>studentForm(true);
  document.querySelector('#load-student').onclick=loadStudents;
  document.querySelector('#edit-student').onclick=()=>studentForm(false);
  document.querySelector('#times').onclick=times;
  document.querySelector('#guided').onclick=()=>prepare({ guided:true });
  document.querySelector('#custom').onclick=customPractice;
  document.querySelector('#help').onclick=()=>help(false);
  document.querySelector('#keyboard').onclick=()=>help(true);
  Object.keys(MODES).forEach(mode=>document.querySelector(`#activity-${mode}`).onclick=()=>prepare({ mode, group:profile.settings.group, goal:profile.settings.goal, guided: mode !== 'practice' && !profile.course.graduated && mode===courseMode(profile.course) && profile.settings.group===profile.course.group && profile.settings.goal===profile.course.goal }));
  document.querySelector('#report').onclick=report;
  document.querySelector('#next').onclick=next;
  document.querySelector(focus)?.focus();
}
function studentForm(isNew) {
  page('student', 'PREFS', isNew?'New student':'Edit student', `<form id="student-form"><label>Name<input name="name" maxlength="24" required value="${isNew?'':html(profile.name)}"></label><label>Character<select name="character">${['Mario','Luigi','Princess'].map(c=>`<option ${!isNew&&c===profile.character?'selected':''}>${c}</option>`).join('')}</select></label><label>Activity goal · WPM<input name="goal" type="number" min="1" max="150" step="1" required value="${isNew?5:profile.settings.goal}"></label><label>Activity key group<select name="group">${KEY_GROUPS.map((g,i)=>`<option value="${i}" ${!isNew&&i===profile.settings.group?'selected':''}>${g.name}</option>`).join('')}</select></label><label class="sound"><input name="sound" type="checkbox" ${!isNew&&profile.settings.sound?'checked':''}> Synthetic sound effects (no archive audio)</label><p>Activity settings do not change your earned guided course position.</p><button class="primary" type="submit">${isNew?'Create student':'Save student'}</button><button id="back" type="button">Cancel</button></form>`);
  document.querySelector('#student-form').onsubmit=e=>{
    e.preventDefault(); const data=new FormData(e.target), name=data.get('name').trim();
    if (!name) { e.target.elements.name.setCustomValidity('Enter a name.'); e.target.elements.name.reportValidity(); return; }
    if(isNew) profile=createStudent(session.data,{name,character:data.get('character')});
    editStudent(session.data,profile.id,{name,character:data.get('character'),settings:{goal:Number(data.get('goal')),group:Number(data.get('group')),sound:data.has('sound')}});
    save(); menu();
  };
  document.querySelector('[name=name]').oninput=e=>e.target.setCustomValidity('');
  back(); document.querySelector('[name=name]').focus();
}
function loadStudents() {
  page('load', 'LOAD', 'Load student', `<form id="load-form"><label>Saved local students<select name="student">${session.data.students.map(p=>`<option value="${p.id}" ${p.id===profile.id?'selected':''}>${html(p.name)} · ${p.character}</option>`).join('')}</select></label><button class="primary">Load selected student</button><button type="button" id="back">Cancel</button></form><p>Each student's settings, results and certificates stay separate.</p>`);
  document.querySelector('#load-form').onsubmit=e=>{e.preventDefault();selectStudent(session.data,e.target.elements.student.value);profile=currentStudent(session.data);save();menu();};
  back(); document.querySelector('[name=student]').focus();
}
function times() {
  page('times', 'LESSTIME', 'Lesson times', `<form id="times-form"><p>Defaults: 2 / 5 / 5 / 10 minutes. A seconds override takes precedence.</p>${Object.entries(MODES).map(([mode,m])=>`<fieldset><legend>${m.name}</legend><label>Minutes<input name="${mode}-minutes" type="number" min="0" max="60" step="any" value="${profile.settings.durations[mode]/60}" required></label><label>Seconds override<input name="${mode}-seconds" type="number" min="1" max="3600" step="1" value="${profile.settings.durations[mode]}" placeholder="Optional"></label></fieldset>`).join('')}<p id="time-error" role="alert"></p><button class="primary">Save times</button><button id="back" type="button">Cancel</button></form>`);
  for(const mode of Object.keys(MODES)) document.querySelector(`[name="${mode}-minutes"]`).oninput=()=>{document.querySelector(`[name="${mode}-seconds"]`).value='';};
  document.querySelector('#times-form').onsubmit=e=>{
    e.preventDefault();const data=new FormData(e.target),durations={};
    for(const mode of Object.keys(MODES)) durations[mode]=data.get(`${mode}-seconds`)===''?Number(data.get(`${mode}-minutes`))*60:Number(data.get(`${mode}-seconds`));
    if(!Object.values(durations).every(n=>Number.isInteger(n)&&n>=1&&n<=3600)){document.querySelector('#time-error').textContent='Choose whole seconds between 1 and 3600.';return;}
    editStudent(session.data,profile.id,{settings:{durations,duration:durations[profile.settings.mode]}}); save();menu();
  };
  back();document.querySelector('.original-panel').focus();
}
function customPractice() {
  page('custom', 'PREFS', 'Browser custom practice', `<form id="custom-form"><p>Unrestricted browser activity selection. This never advances the guided course.</p><label for="custom-activity">Activity</label><select id="custom-activity" name="mode">${Object.entries(MODES).map(([id,m])=>`<option value="${id}" ${profile.settings.mode===id?'selected':''}>${m.name}</option>`).join('')}</select><label>Key group<select name="group">${KEY_GROUPS.map((g,i)=>`<option value="${i}" ${profile.settings.group===i?'selected':''}>${g.name}</option>`).join('')}</select></label><label>Goal · WPM<input name="goal" type="number" min="1" max="150" step="1" required value="${profile.settings.goal}"></label><button class="primary">Choose lesson text</button><button id="back" type="button">Cancel</button></form>`);
  document.querySelector('#custom-form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target);const options={mode:data.get('mode'),group:Number(data.get('group')),goal:Number(data.get('goal')),guided:false};editStudent(session.data,profile.id,{settings:options});save();prepare(options);};
  back();document.querySelector('main select').focus();
}
function prepare(options) {
  if(options.guided) options={mode:courseMode(profile.course),group:profile.course.group,goal:profile.course.goal,guided:true};
  const lesson=selectLesson({mode:options.mode,keyGroup:options.group,goal:options.goal});
  page('content', 'GREETBG', 'Choose lesson text', `<p>${options.guided?'Guided course':'Browser practice, no course progress'} · ${MODES[options.mode].name} · ${KEY_GROUPS[options.group].name} · ${options.goal} WPM · ${clock(profile.settings.durations[options.mode])}</p><p class="historical-notice">${HISTORICAL_NOTICE}</p><p id="coverage">${html(lesson.label)}. ${lesson.records.filter(r=>r.source==='original').length} of ${lesson.records.length} records use historical text. Other records use generated practice where keys are incompatible or practice wrapping remains unresolved.</p><button id="original" class="primary">Start original-first lesson</button><button id="generated">Use generated alternative</button><button id="back">Cancel</button>`);
  document.querySelector('#original').onclick=()=>start({...options,content:'original'});
  document.querySelector('#generated').onclick=()=>start({...options,content:'generated'});
  back();document.querySelector('#original').focus();
}
function help(keyboard) {
  page('help', keyboard?'KEYBOARD':'HELP', keyboard?'Keyboard guide':'Instructions', `<p>Use Tab and Shift+Tab to move between controls; Enter activates buttons. On the main menu, keys 1–4 select activities, 5 opens the report and 6 commits an earned Next.</p><p>Type the displayed target. Wrong keys add errors without moving it. Outdoors, ASCII upper and lowercase letters match without Shift. Other activities require exact case, punctuation and spaces. Non-ASCII, repeated keys and modified shortcuts are ignored.</p><p>Outdoor keys may wait for contact and count only once. Reduced motion makes targets stationary. Escape, losing focus, hidden tabs and castle pipe stops pause both input and the clock. Resume explicitly when ready.</p><p>Net-error integer WPM and integer accuracy use a browser active-clock approximation. Timeout, at least one key, goal WPM and 90% accuracy are the browser pass rule, not a verified universal original rule. No early success or deaths.</p><p>Only matching guided lessons advance. Next preserves the first earned destination, saves it once and returns to the menu. Custom and Expert Express never advance. Certificates use browser milestones, not claimed original triggers.</p><button id="back">Back to menu</button>`);
  back(menu,keyboard?'#keyboard':'#help');document.querySelector('#back').focus();
}
function start(options=lastOptions) {
  lastOptions=options;screen='game';recorded=false;announcement.textContent='';
  attempt=createAttempt({...options,duration:profile.settings.durations[options.mode],character:profile.character,studentId:profile.id,courseRevision:profile.course.revision,reducedMotion});lastTime=performance.now();
  shell(`<main class="play mode-${attempt.mode}" tabindex="-1" aria-label="Typing activity"><div class="lesson-heading"><h1>${MODES[attempt.mode].name}</h1><span id="encounter-status">${attempt.guided?'Guided':'Browser practice'} · ${KEY_GROUPS[attempt.group].name}</span></div><p id="source-caption" class="source-caption"></p><div class="game-screen"><div id="text-strip" class="text-strip" aria-label="Scrolling target text"></div><canvas id="scene" width="640" height="400" role="img" aria-label="${attempt.mode} activity scene; target and statistics are available as text below"></canvas><section class="hud" aria-label="Lesson statistics and finger guide"><div class="hud-stats"><div>Time left <strong id="time"></strong></div><div>Typed <strong id="correct">0</strong></div><div>Accuracy <strong id="accuracy">0%</strong></div></div><div class="hand-guide">${gloveMarkup('left')}<div class="target-wrap"><span>TYPE</span><strong id="target"></strong><span class="space-legend">␣ = space</span></div>${gloveMarkup('right')}</div><div class="hud-stats hud-right"><div>WPM <strong id="wpm">0</strong></div><div>Errors <strong id="errors">0</strong></div><div>Goal ${attempt.goal} WPM · 90%</div></div><p id="finger"></p></section></div><div class="play-controls"><button id="pause">Pause <kbd>Esc</kbd></button><div class="next-keys"><span>UP NEXT</span><span id="preview"></span></div><button id="keyboard-toggle" aria-expanded="false" aria-controls="keyboard-guide">Keyboard help</button></div><div id="keyboard-guide" hidden><p>Wrong keys do not advance. Outdoors, lowercase ASCII letters also match. Other modes require exact case. ␣ means space. Escape pauses. No early deaths.</p></div><div id="pause-panel" hidden role="dialog" aria-modal="true" aria-labelledby="pause-title"><h2 id="pause-title">Lesson paused</h2><p id="pause-reason"></p><button id="resume" class="primary">Resume lesson</button><button id="leave">Return to menu</button></div></main>`);
  document.querySelector('#pause').onclick=()=>pauseGame();
  document.querySelector('#keyboard-toggle').onclick=e=>{const guide=document.querySelector('#keyboard-guide');guide.hidden=!guide.hidden;e.currentTarget.setAttribute('aria-expanded',String(!guide.hidden));if(guide.hidden)document.querySelector('main.play').focus();};
  document.querySelector('#resume').onclick=()=>{resume(attempt);lastTime=performance.now();document.querySelector('#pause-panel').hidden=true;document.querySelector('main.play').focus();};
  document.querySelector('#leave').onclick=()=>menu();
  if (attempt.mode === 'practice') {
    const composition = document.createElement('div');
    composition.className = 'original-screen practice-screen';
    composition.dataset.family = 'PRACTICE';
    const canvas = document.querySelector('#scene');
    canvas.before(composition);
    const prompt = document.querySelector('#text-strip');
    prompt.classList.add('original-panel');
    prompt.style.cssText = panelPosition('PRACTICE');
    composition.append(canvas, prompt);
  }
  update();document.querySelector('main.play').focus();
}
function tick(now) { if(attempt) advanceTime(attempt,Math.max(0,(now-lastTime)/1000));lastTime=now; }
function pauseGame(reason) {
  if(screen!=='game'||attempt.status==='finished') return;
  tick(performance.now());if(attempt.status==='finished'){finish();return;}
  pause(attempt,reason);document.querySelector('#pause-panel').hidden=false;document.querySelector('#pause-reason').textContent=attempt.pauseReason;document.querySelector('#resume').focus();update();
}
function update() {
  const m=stats(attempt), key=attempt.text[attempt.correct%attempt.text.length],hint=fingerHint(key,attempt.mode);
  for(const [id,value] of Object.entries({time:clock(m.remaining),wpm:m.wpm,accuracy:`${m.accuracy}%`,correct:attempt.correct,errors:attempt.errors,target:key===' '?'␣':key,finger:hint})) document.getElementById(id).textContent=value;
  const record=attempt.lesson.records[attempt.cursor.recordIndex];
  document.querySelector('#source-caption').textContent=`${record.label} · ${attempt.lesson.label} · Sound: ${profile.settings.sound?'synthetic':'off'}`;
  if(attempt.mode==='outdoor')document.querySelector('#encounter-status').textContent=reducedMotion?'Stationary targets · reduced motion':attempt.travel.buffered?'Key held for contact; counted once':'Type the starred target; early keys wait for contact';
  updateGloves(document.querySelector('.hand-guide'),hint);
  document.querySelector('#preview').textContent=Array.from({length:12},(_,i)=>attempt.text[(attempt.correct+i+1)%attempt.text.length]).map(k=>k===' '?'␣':k).join(' ');
  const upcoming=Array.from({length:attempt.mode==='practice'?400:100},(_,i)=>attempt.text[(attempt.correct+i)%attempt.text.length]).join('');
  document.querySelector('#text-strip').innerHTML=`<mark>${html(key===' '?'␣':key)}</mark>${html(upcoming.slice(1)).replaceAll(' ','·')}`;
  drawScene(document.querySelector('#scene'),attempt,attempt.elapsed);
}
function finish() {
  if(recorded)return;recorded=true;
  const r=result(attempt);recordResult(profile,r,new Date().toISOString());save();
  const reasons=!r.attempted?'No keys were typed.':`${r.wpm<r.goal?'Speed is below your goal. ':''}${r.accuracy<90?'Accuracy is below 90%.':''}`;
  page('results','BLACKBRD',r.passed?'Goal reached':'Keep practicing',`<p id="outcome">${r.passed?'Passed at timeout.':`Not passed. ${reasons}`} Browser pass rule: goal WPM, 90% accuracy and at least one attempt at timeout.</p><dl class="result-metrics">${Object.entries({'Correct keys':r.correct,'Errors':r.errors,'WPM':r.wpm,'Accuracy':`${r.accuracy}%`,'Activity':MODES[r.mode].name,'Active elapsed':`${r.elapsed.toFixed(2)} seconds`,'Configured limit':`${r.duration} seconds`,'Terminal reason':r.terminalReason,'Text source':r.label}).map(([key,value])=>`<div><dt>${key}</dt><dd>${html(value)}</dd></div>`).join('')}</dl><p>${profile.course.graduated?'Graduated at 50 WPM. Certificate retained in your report.':pendingText()}</p><div class="result-actions"><button id="retry" class="primary">Try again</button><button id="menu">Main menu</button><button id="next" ${!profile.course.pending?'disabled':''}>Next lesson</button><button id="report">Report card</button></div>`);
  document.querySelector('#retry').onclick=()=>start();document.querySelector('#menu').onclick=()=>menu();document.querySelector('#next').onclick=next;document.querySelector('#report').onclick=report;
  announcement.textContent=`${r.passed?'Passed':'Not passed'}. Timeout. ${r.wpm} WPM, ${r.accuracy}% accuracy. ${reasons}`;document.querySelector('#retry').focus();
}
const certificateTitles={outdoor:'Outdoor graduate',underwater:'Underwater graduate',graduation:'Mario Graduate · 50 WPM castle'};
function report() {
  const tables=[['Current ruleset',profile.results.filter(r=>r.ruleset===RULESET)],['Legacy history (not comparable)',profile.results.filter(r=>r.ruleset!==RULESET)]];
  page('report','RCARD','Report card',`<p>${html(profile.name)} · ${position(profile.course)}</p>${profile.legacy?`<p>Legacy course archived: ${html(JSON.stringify(profile.legacy.profile.course))}. New course began at 5 WPM/home row. Original save retained; old passes and awards were not recomputed.</p>`:''}${tables.map(([title,rows])=>`<h2>${title}</h2><div class="table-scroll"><table aria-label="${html(title)}"><thead><tr><th>Activity / ruleset</th><th>Goal</th><th>WPM</th><th>Accuracy</th><th>Result</th><th>Elapsed / limit / reason</th></tr></thead><tbody>${rows.slice().reverse().map(r=>`<tr><td>${MODES[r.mode].name}<small>${html(r.ruleset)} · ${html(r.date)} · ${r.guided?'Guided':'Practice'}<br>${html(r.label??'Legacy text source not recorded')}</small></td><td>${r.goal}</td><td>${r.wpm}</td><td>${r.accuracy}%</td><td>${r.passed?'Pass':'Retry'}</td><td>${r.ruleset===RULESET?`${r.elapsed}s / ${r.duration}s / ${r.terminalReason}`:'Not recorded under current rules'}</td></tr>`).join('')}</tbody></table></div>${rows.length?'':'<p>No results in this ruleset.</p>'}`).join('')}<h2>Certificates</h2>${profile.certificates.map((c,i)=>`<button data-certificate="${i}">${certificateTitles[c.kind]} · ${html(c.name)} · ${html(c.ruleset)}</button>`).join('')||'<p>No certificates yet.</p>'}<p>Browser awards: committed world transitions and the guided 50-WPM all-keyboard castle assessment. These are not asserted original triggers. Historical awards remain intact.</p><button id="back">Main menu</button><button id="print">Print report</button>`);
  document.querySelectorAll('[data-certificate]').forEach(b=>b.onclick=()=>certificate(Number(b.dataset.certificate)));
  document.querySelector('#print').onclick=()=>window.print();back();document.querySelector('#back').focus();
}
function certificate(index) {
  const c=profile.certificates[index];
  const provenance=c.ruleset===RULESET?`Browser milestone. Achieved ${c.achieved} WPM. Corpus ${c.corpusVersion}. Result ${c.resultId}. Not an asserted original trigger.`:`Historical award preserved without recomputation. Source ${c.provenance.storageKey}, version ${c.provenance.version}.`;
  const text=`MARIO TEACHES TYPING\n${certificateTitles[c.kind]}\nAwarded to ${c.name}\n${c.date}\nRuleset: ${c.ruleset}\n${provenance}\nUnofficial browser recreation.\n`;
  page('certificate','CERTIF','Certificate',`<article class="certificate"><h2>${certificateTitles[c.kind]}</h2><p>Awarded to <strong>${html(c.name)}</strong></p><p>${html(c.date)}</p><p>Ruleset: ${html(c.ruleset)}</p><p>${html(provenance)}</p></article><button id="download">Download certificate text</button><button id="print">Print certificate</button><button id="back">Back to report</button>`);
  document.querySelector('#download').onclick=()=>{const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`typing-certificate-${c.kind}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  document.querySelector('#print').onclick=()=>window.print();back(report,'#back');document.querySelector('#download').focus();
}
let audio;
function beep(correct) {
  if(!profile.settings.sound)return;
  try {audio ||= new AudioContext();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='square';o.frequency.value=correct?660:160;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.08);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.08);}catch{/* Optional synthesized cues never control outcomes. */}
}
window.addEventListener('keydown',e=>{
  if(screen==='menu'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.repeat&&!e.isComposing&&!e.target.closest('input,select,textarea,[contenteditable]')&&/^[1-6]$/.test(e.key)) {
    e.preventDefault();document.querySelector(['#activity-outdoor','#activity-underwater','#activity-castle','#activity-practice','#report','#next'][Number(e.key)-1]).click();return;
  }
  if(screen!=='game')return;
  if(e.key==='Escape'){e.preventDefault();pauseGame();return;}
  if(attempt.status==='paused'){
    if(e.key==='Tab'){const first=document.querySelector('#resume'),last=document.querySelector('#leave');if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    return;
  }
  if(attempt.status!=='running')return;
  if(e.target.closest('input,select,textarea,[contenteditable],button,a,summary,[role="button"]'))return;
  tick(performance.now());if(attempt.status==='finished'){finish();return;}
  if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.isComposing)e.preventDefault();
  const outcome=typeKey(attempt,e);
  if(outcome!=='ignored'){e.preventDefault();beep(outcome==='correct'||outcome==='buffered');update();if(attempt.status==='paused')pauseGame();}
});
window.addEventListener('blur',()=>pauseGame('The window lost focus. Resume when ready.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame('The tab was hidden. Resume when ready.');});
function frame(now){if(screen==='game'){tick(now);if(attempt.status==='finished')finish();else update();}requestAnimationFrame(frame);}
titleIntro();requestAnimationFrame(frame);
