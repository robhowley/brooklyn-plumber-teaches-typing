import './style.css';
import { courseMode, advanceCourse, recordResult } from './course.js';
import { RULESET, MODES, KEY_GROUPS, createAttempt, stats, advanceTime, pause, resume, typeKey, result, fingerHint } from './engine.js';
import { loadStore, currentStudent, createStudent, selectStudent, editStudent, saveStore } from './storage.js';
import { selectLesson, HISTORICAL_NOTICE } from './lessons.js';
import { drawScene } from './scene.js';
import { drawMenuScreen, drawScreen, drawStudentScreen, menuGeometry, MENU_TRIGGERS, SCREEN_LAYOUTS, STUDENT_ACTIONS } from './screen-art.js';
import { gloveMarkup, updateGloves } from './glove-hud.js';
import { drawTitleIllustration } from './title-art.js';

const root = document.querySelector('#app');
let storage;
try { storage = window.localStorage; } catch { /* Recovery stays session-only. */ }
const session = loadStore(storage);
let profile = currentStudent(session.data), attempt, screen, lastTime = performance.now(), recorded = false, lastOptions;
let menuCleanup, suppressedSkipKey, levelEntryCleanup;
let menuState = { open: null, selected: 'file', selectedRowId: null, hasFocus: true };
let menuReturn = { focus: '#menu-file-summary', disclosure: null, selected: 'file' };
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
function clearMenuScreen() {
  levelEntryCleanup?.();
  menuCleanup?.(); menuCleanup = undefined;
  menuState = { open:null, selected:'file', selectedRowId:null, hasFocus:false };
  document.body.classList.remove('main-menu-screen');
}
function shell(content) {
  clearMenuScreen();
  document.body.classList.remove('title-screen');
  document.body.classList.toggle('playing', screen === 'game');
  root.innerHTML = `<div class="cabinet${screen === 'game' ? ' game-cabinet' : ''}"><header><a href="#" id="home" aria-label="Main menu">M<span>★</span>T</a><span>MARIO TEACHES TYPING</span><span class="edition">BROWSER EDITION</span></header>${content}<footer><span>Static 1992 archive art · Browser placement/adaptations · Rights unverified</span><span id="storage-status" role="status">${storageMessage()}</span></footer></div>`;
  document.querySelector('#home').onclick = e => { e.preventDefault(); screen === 'game' ? pauseGame('Resume or return to the menu.') : menu(); };
}
function page(name, family, title, body) {
  screen = name; attempt = null;
  shell(`<main class="archive-page" aria-labelledby="page-title"><div class="archive-illustration"><canvas id="screen-art" role="img" aria-label="Original ${family} background"></canvas><p class="fine">Original static ${family} artwork. Browser controls and layout.</p></div><section class="archive-controls"><h1 id="page-title">${title}</h1>${body}</section></main>`);
  const screenArt = document.querySelector('#screen-art');
  if (name === 'student') drawStudentScreen(screenArt); else drawScreen(screenArt, family);
  if (['PREFS','LOAD','LESSTIME','HELP','BLACKBRD','RCARD','CERTIF','GREETBG'].includes(family)) {
    const illustration = document.querySelector('.archive-illustration');
    const controls = document.querySelector('.archive-controls');
    const art = document.querySelector('#screen-art');
    const composition = document.createElement('div');
    composition.className = 'original-screen';
    composition.dataset.family = family;
    const panel = document.createElement('section');
    panel.className = `original-panel${family === 'BLACKBRD' ? ' original-panel--chalk' : ''}${name === 'student' ? ' original-panel--student' : ''}`;
    panel.setAttribute('aria-label', title);
    panel.tabIndex = 0;
    panel.style.cssText = panelPosition(family);
    illustration.prepend(composition);
    composition.append(art, panel);
    for (const child of [...controls.children]) {
      if (!child.matches('h1,button,.result-actions')) panel.append(child);
    }
    if (name === 'student') {
      const actions = panel.querySelector('.student-native-actions');
      for (const [id, action] of Object.entries(STUDENT_ACTIONS)) {
        const button = actions.querySelector(id === 'done' ? '#student-done' : '#back');
        const [x, y] = action.center, [width, height] = action.size;
        button.style.cssText = `left:${x/320*100}%;top:${y/200*100}%;--native-width:${width/320*100}cqw;--native-height:${height/320*100}cqw`;
      }
      composition.append(actions);
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
function back(action = menu, focus) {
  document.querySelector('#back').onclick = () => {
    action();
    if (focus) {
      const control = document.querySelector(focus), details = control?.closest('details');
      if (details) details.open = true;
      control?.focus();
    }
  };
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
    menu();
  };
  document.querySelector('.title-intro').onclick = leave;
  button.onkeydown = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      suppressedSkipKey = event.key;
      leave();
    }
  };
  button.focus();
  announcement.textContent = 'Mario Teaches Typing. Press Enter or Space, or click to skip the title intro.';
  dispose = drawTitleIllustration(document.querySelector('#title-art'), { onComplete: leave });
}
function next() { advanceCourse(profile, new Date().toISOString()); save(); menu(); }
function enterLevel(options) {
  if (screen !== 'menu' || levelEntryCleanup) return;
  const startOriginal = () => start({ ...options, content:'original' });
  if (reducedMotion) { startOriginal(); return; }

  const frame = root.querySelector('.main-menu-frame');
  if (!frame) return;
  const controller = new AbortController(), { signal } = controller;
  let timer;
  const cancel = () => {
    if (levelEntryCleanup !== cancel) return;
    clearTimeout(timer);
    controller.abort();
    frame.classList.remove('level-entry-fading');
    levelEntryCleanup = undefined;
  };
  const blockInput = event => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const cancelOnBlur = () => {
    cancel();
    announcement.textContent = 'Activity entry cancelled. The main menu is still open.';
  };
  const cancelWhenHidden = () => { if (document.hidden) cancelOnBlur(); };
  const launch = () => {
    if (screen !== 'menu') { cancel(); return; }
    cancel();
    startOriginal();
  };

  levelEntryCleanup = cancel;
  frame.classList.add('level-entry-fading');
  document.addEventListener('keydown', blockInput, { capture:true, signal });
  document.addEventListener('keyup', blockInput, { capture:true, signal });
  document.addEventListener('pointerdown', blockInput, { capture:true, signal });
  document.addEventListener('pointerup', blockInput, { capture:true, signal });
  document.addEventListener('click', blockInput, { capture:true, signal });
  window.addEventListener('blur', cancelOnBlur, { signal });
  document.addEventListener('visibilitychange', cancelWhenHidden, { signal });
  timer = setTimeout(launch, 200);
}
function pendingText() {
  return profile.course.pending ? `Earned Next: ${position(profile.course.pending.destination)}. The first successful attempt is retained across retries.` : 'Next is locked until a successful guided lesson.';
}
const MENU_COMMANDS = {
  file: [
    { id:'about', label:'About [A]', text:'About     [A]', disabled:true, reason:'Not implemented in the browser.' },
    { id:'help', label:'Help [F1]', text:'Help     [F1]', run:()=>help(false) },
    { id:'demo', label:'Demo [D]', text:'Demo      [D]', disabled:true, reason:'Not implemented in the browser.' },
    { id:'keyboard', label:'Keyboard [F2]', text:'Keyboard [F2]', run:()=>help(true) },
    { id:'music', label:'Music [M]', text:'Music    [M]', disabled:true, reason:'Not implemented in the browser.' },
    { id:'sound', label:'Sound F/X [S]', text:'Sound F/X [S]', disabled:true, reason:'Not implemented in the browser.' },
    { id:'speech', label:'Speech [G]', text:'Speech    [G]', disabled:true, reason:'Not implemented in the browser.' },
    { id:'quit', label:'Quit [Q]', text:'Quit      [Q]', disabled:true, reason:'Not implemented in the browser.' },
  ],
  student: [
    { id:'new-student', label:'New [W]', text:'New [W]', run:()=>studentForm(true) },
    { id:'load-student', label:'Load [L]', text:'Load [L]', run:loadStudents },
    { id:'edit-student', label:'Edit [E]', text:'Edit [E]', run:()=>studentForm(false) },
    { id:'times', label:'Lesson Times', text:'Lesson Times', run:times },
    { id:'student-certificates', label:'Certificates', text:'Certificates', run:()=>report('#certificates') },
  ],
  lessons: [
    { id:'lesson-group-0', label:'Home Row Only', group:0 },
    { id:'lesson-group-1', label:'Add Top Row', group:1 },
    { id:'lesson-group-2', label:'Add Bottom Row', group:2 },
    { id:'lesson-group-3', label:'Add Numbers', group:3 },
    { id:'lesson-group-4', label:'Add Symbols', group:4 },
    { id:'lesson-group-5', label:'All Keyboard', group:5 },
  ],
};
const ACTIVITY_BOUNDS = {
  'activity-outdoor':[233,9,303,40], 'activity-underwater':[233,40,303,71],
  'activity-castle':[233,71,303,102], 'activity-practice':[233,102,303,133],
  report:[233,133,303,164], next:[233,164,303,187],
};
const activityIds = ['activity-outdoor','activity-underwater','activity-castle','activity-practice','report','next'];
function menuEntries() {
  return Object.fromEntries(Object.entries(MENU_COMMANDS).map(([name, commands]) => [name, commands.map(command => {
    const selected = name === 'lessons' && profile.settings.group === command.group;
    const text = name === 'lessons' ? `${selected ? '>' : ' '}${command.label}` : command.text;
    const ariaLabel = `${command.label}${selected ? ', selected' : ''}${command.reason ? `, ${command.reason}` : ''}`;
    return { id:command.id, text, label:command.label, ariaLabel, disabled:!!command.disabled, selected, reason:command.reason };
  })]));
}
function nativeStyle([left, top, right, bottom], parent = [0,0,320,200]) {
  const [parentLeft, parentTop, parentRight, parentBottom] = parent;
  return `left:${(left-parentLeft)/(parentRight-parentLeft)*100}%;top:${(top-parentTop)/(parentBottom-parentTop)*100}%;width:${(right-left)/(parentRight-parentLeft)*100}%;height:${(bottom-top)/(parentBottom-parentTop)*100}%`;
}
function drawMenu(entries) {
  drawMenuScreen(document.querySelector('#screen-art'), {
    studentName:profile.name, menus:entries, openMenu:menuState.open, selectedMenu:menuState.selected,
    selectedRowId:menuState.selectedRowId, focusedId:menuState.hasFocus ? document.activeElement?.id : null,
    hasFocus:menuState.hasFocus, activityBounds:ACTIVITY_BOUNDS,
  });
}
function menuCommand(group, id) {
  const command = MENU_COMMANDS[group]?.find(item => item.id === id);
  if (!command || command.disabled) return;
  menuReturn = { focus:`#${id}`, disclosure:group, selected:group };
  if (group === 'lessons') {
    editStudent(session.data, profile.id, { settings:{ group:command.group } });
    save(); menu();
    return;
  }
  command.run?.();
}
function initialMenuRow(name, entries) {
  const rows = entries[name];
  return (name === 'lessons' ? rows.find(entry => entry.selected) : rows.find(entry => !entry.disabled))?.id ?? null;
}
function openMenu(name) {
  for (const details of root.querySelectorAll('.menu-disclosure')) details.open = details.dataset.menu === name;
  menuState.open = name; menuState.selected = name;
  menuState.selectedRowId = initialMenuRow(name, menuEntries());
  drawMenu(menuEntries());
}
function closeMenu(restoreFocus = true) {
  if (!menuState.open) return;
  const name = menuState.open;
  root.querySelector(`[data-menu="${name}"]`).open = false;
  menuState.open = null; menuState.selectedRowId = null;
  drawMenu(menuEntries());
  if (restoreFocus) root.querySelector(`#menu-${name}-summary`)?.focus();
}
function menu() {
  clearMenuScreen();
  screen = 'menu'; attempt = null;
  document.body.classList.remove('playing','title-screen');
  document.body.classList.add('main-menu-screen');
  const entries = menuEntries(), opened = menuReturn.disclosure;
  const returnRow = opened && entries[opened]?.some(entry => `#${entry.id}` === menuReturn.focus) ? menuReturn.focus.slice(1) : null;
  menuState = { open:opened, selected:menuReturn.selected ?? opened ?? 'file', selectedRowId:opened ? returnRow ?? initialMenuRow(opened, entries) : null, hasFocus:true };
  const menus = Object.entries(entries).map(([name, items]) => {
    const trigger = MENU_TRIGGERS[name], geometry = menuGeometry(name, items);
    const rows = items.map((item, index) => `<button type="button" id="${item.id}" class="menu-row" data-menu-group="${name}" aria-label="${html(item.ariaLabel)}" ${item.disabled?'disabled':''} style="${nativeStyle(geometry.rows[index], geometry.popup)}">${html(item.label)}</button>`).join('');
    return `<details class="menu-disclosure" data-menu="${name}" ${opened===name?'open':''}><summary id="menu-${name}-summary" class="menu-summary" data-menu-summary="${name}" aria-label="${trigger.label} menu" style="${nativeStyle(geometry.trigger)}">${trigger.label}</summary><div class="menu-popup" role="group" aria-label="${trigger.label} commands" style="${nativeStyle(geometry.popup)}">${rows}</div></details>`;
  }).join('');
  const goal = profile.settings.goal;
  const activities = Object.entries(MODES).map(([mode, activity], index) => {
    const id = `activity-${mode}`, label = `${index + 1}. ${activity.name}`;
    return `<button type="button" id="${id}" class="menu-hit" aria-label="${html(label)}" style="${nativeStyle(ACTIVITY_BOUNDS[id])}"></button>`;
  }).join('');
  const nextLabel = profile.course.pending ? '6. Next lesson. Commits earned progress once.' : '6. Next lesson. Disabled until successful guided progress is earned.';
  root.innerHTML = `<main class="main-menu-frame" aria-label="Mario Teaches Typing main menu"><h1 class="visually-hidden">Main menu</h1><canvas id="screen-art" width="320" height="200" role="img" aria-label="Original MAINMENU background"></canvas><p class="visually-hidden">${html(profile.name)} · ${profile.character} · Activity goal ${goal} WPM. ${html(pendingText())}</p>${menus}${activities}<button type="button" id="report" class="menu-hit" aria-label="5. Report card and certificates" style="${nativeStyle(ACTIVITY_BOUNDS.report)}"></button><button type="button" id="next" class="menu-hit" aria-label="${html(nextLabel)}" ${profile.course.pending?'':'disabled'} style="${nativeStyle(ACTIVITY_BOUNDS.next)}"></button></main>`;
  const frame = root.querySelector('.main-menu-frame');
  const controller = new AbortController(), { signal } = controller;
  const render = () => { if (screen === 'menu') drawMenu(entries); };
  for (const [name] of Object.entries(entries)) {
    const summary = root.querySelector(`#menu-${name}-summary`);
    summary.addEventListener('click', event => {
      event.preventDefault();
      if (menuState.open === name) closeMenu(false); else openMenu(name);
    }, { signal });
  }
  for (const [name, items] of Object.entries(entries)) for (const item of items) {
    if (!item.disabled) root.querySelector(`#${item.id}`).addEventListener('click', () => menuCommand(name, item.id), { signal });
  }
  for (const id of Object.keys(MODES).map(mode => `activity-${mode}`).concat(['report','next'])) {
    root.querySelector(`#${id}`).addEventListener('click', () => {
      menuReturn = { focus:`#${id}`, disclosure:null, selected:'file' };
      if (id.startsWith('activity-')) {
        const mode = id.slice('activity-'.length);
        enterLevel({ mode, group:profile.settings.group, goal:profile.settings.goal, guided:mode !== 'practice' && !profile.course.graduated && mode === courseMode(profile.course) && profile.settings.group === profile.course.group && profile.settings.goal === profile.course.goal });
      } else if (id === 'report') report(); else next();
    }, { signal });
  }
  function topNavigation(direction) {
    const names = Object.keys(MENU_TRIGGERS), active = document.activeElement?.dataset.menuSummary;
    const index = names.indexOf(active ?? menuState.selected);
    const nextName = names[(index + direction + names.length) % names.length];
    if (menuState.open) openMenu(nextName);
    else { menuState.selected = nextName; render(); }
    root.querySelector(`#menu-${nextName}-summary`)?.focus();
  }
  function rowNavigation(direction) {
    const name = menuState.open, candidates = menuEntries()[name].filter(entry => !entry.disabled);
    if (!candidates.length) return;
    const current = candidates.findIndex(entry => entry.id === document.activeElement?.id);
    const index = current < 0 ? (direction > 0 ? 0 : candidates.length - 1) : (current + direction + candidates.length) % candidates.length;
    menuState.selectedRowId = candidates[index].id;
    root.querySelector(`#${candidates[index].id}`)?.focus();
  }
  frame.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.repeat || event.isComposing || event.target.closest('input,select,textarea,[contenteditable]')) return;
    if (event.key === 'Escape' && menuState.open) { event.preventDefault(); closeMenu(); return; }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); topNavigation(event.key === 'ArrowRight' ? 1 : -1); return; }
    if (menuState.open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); rowNavigation(event.key === 'ArrowDown' ? 1 : -1); return; }
    const shortcut = { W:['student','new-student'], L:['student','load-student'], E:['student','edit-student'], F1:['file','help'], F2:['file','keyboard'], C:['student','student-certificates'] }[event.key.toUpperCase()];
    if (menuState.open) {
      if (/^[1-6]$/.test(event.key) || shortcut) event.preventDefault();
      return;
    }
    if (shortcut) { event.preventDefault(); menuCommand(...shortcut); return; }
    if (/^[1-6]$/.test(event.key)) { event.preventDefault(); root.querySelector(`#${activityIds[Number(event.key)-1]}`)?.click(); }
  }, { signal });
  let dismissedPointerTarget = null;
  document.addEventListener('pointerdown', event => {
    dismissedPointerTarget = null;
    if (!menuState.open) return;
    const popup = root.querySelector(`[data-menu="${menuState.open}"] .menu-popup`);
    if (popup?.contains(event.target) || event.target.closest?.('.menu-summary')) return;
    dismissedPointerTarget = event.target;
    event.preventDefault(); event.stopImmediatePropagation(); closeMenu();
  }, { capture:true, signal });
  document.addEventListener('pointerup', () => {
    if (dismissedPointerTarget) setTimeout(() => { dismissedPointerTarget = null; }, 0);
  }, { capture:true, signal });
  document.addEventListener('click', event => {
    if (dismissedPointerTarget && (event.target === dismissedPointerTarget || dismissedPointerTarget.contains?.(event.target))) {
      dismissedPointerTarget = null;
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (!menuState.open) return;
    const popup = root.querySelector(`[data-menu="${menuState.open}"] .menu-popup`);
    if (popup?.contains(event.target) || event.target.closest?.('.menu-summary')) return;
    event.preventDefault(); event.stopImmediatePropagation(); closeMenu();
  }, { capture:true, signal });
  frame.addEventListener('pointerover', event => {
    const row = event.target.closest?.('.menu-row');
    if (row && !row.disabled && menuState.open) { menuState.selectedRowId = row.id; render(); }
    const summary = event.target.closest?.('.menu-summary');
    if (summary) { menuState.selected = summary.dataset.menuSummary; render(); }
  }, { signal });
  frame.addEventListener('focusin', event => {
    menuState.hasFocus = true;
    const summary = event.target.closest?.('.menu-summary');
    if (summary) menuState.selected = summary.dataset.menuSummary;
    const group = event.target.dataset.menuGroup;
    if (group) menuState.selected = group;
    render();
  }, { signal });
  frame.addEventListener('focusout', event => {
    const next = event.relatedTarget;
    if (menuState.open) {
      const opened = root.querySelector(`[data-menu="${menuState.open}"]`);
      if (opened && !opened.contains(next)) { opened.open = false; menuState.open = null; menuState.selectedRowId = null; }
    }
    if (!frame.contains(next)) {
      menuState.hasFocus = false; menuState.selectedRowId = null;
      if (!menuState.open) menuState.selected = 'file';
    }
    render();
  }, { signal });
  const onBlur = () => {
    menuState.hasFocus = false; menuState.selectedRowId = null;
    if (!menuState.open) menuState.selected = 'file';
    render();
  };
  const onFocus = () => {
    menuState.hasFocus = true;
    const active = document.activeElement;
    if (active?.dataset.menuSummary) menuState.selected = active.dataset.menuSummary;
    else if (active?.dataset.menuGroup) menuState.selected = active.dataset.menuGroup;
    render();
  };
  window.addEventListener('blur', onBlur, { signal });
  window.addEventListener('focus', onFocus, { signal });
  menuCleanup = () => controller.abort();
  let target = root.querySelector(menuReturn.focus);
  if (!target || target.disabled) target = root.querySelector('#activity-outdoor') ?? root.querySelector('#menu-file-summary');
  target?.focus();
  render();
  announcement.textContent = `Main menu for ${profile.name}.`;
}
function studentForm(isNew) {
  page('student', 'PREFS', isNew?'New student':'Edit student', `<form id="student-form"><label>Name<input name="name" maxlength="24" required value="${isNew?'':html(profile.name)}"></label><label>Character<select name="character">${['Mario','Luigi','Princess'].map(c=>`<option ${!isNew&&c===profile.character?'selected':''}>${c}</option>`).join('')}</select></label><label>Activity goal · WPM<input name="goal" type="number" min="1" max="150" step="1" required value="${isNew?5:profile.settings.goal}"></label><label>Activity key group<select name="group">${KEY_GROUPS.map((g,i)=>`<option value="${i}" ${!isNew&&i===profile.settings.group?'selected':''}>${g.name}</option>`).join('')}</select></label><label class="sound"><input name="sound" type="checkbox" ${!isNew&&profile.settings.sound?'checked':''}> Synthetic sound effects (no archive audio)</label><p>Activity settings do not change your earned guided course position.</p></form><div class="student-native-actions"><button id="student-done" class="student-native-action" type="submit" form="student-form" aria-label="${isNew?'Create student':'Save student'}">Done</button><button id="back" class="student-native-action" type="button" aria-label="Cancel">Cancel</button></div>`);
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
  const browserOptions = keyboard ? '' : `<h2>Browser-only options</h2><p>These options are browser features, not DOS menu commands. Custom practice does not advance the guided course.</p><button id="guided" ${profile.course.graduated?'disabled':''}>Continue guided course</button><button id="custom">Browser custom practice</button>`;
  const contentChoices = keyboard ? '' : `<p class="historical-notice">${HISTORICAL_NOTICE}</p><p>Activities 1–4 start original-first. To choose generated practice instead, select Continue guided course or Browser custom practice here, then choose Use generated alternative. Original-first lessons still use labeled generated practice when a record needs keys outside the selected group or practice wrapping is unresolved.</p>`;
  page('help', keyboard?'KEYBOARD':'HELP', keyboard?'Keyboard guide':'Instructions', `<p>File, Student and Lessons are the main menus. Use Left/Right to move between them, Up/Down to select enabled rows, Enter to activate, and Escape or a click outside to close. Tab and Shift+Tab move through controls. Keys 1–6 select activities, Report and an earned Next when no menu is open. W/L/E open New/Load/Edit, F1 opens Instructions, F2 opens Keyboard, and C opens Certificates.</p><p>About, Demo, Music, Sound F/X, Speech and Quit are visible File commands but are not implemented. All four activities are available at every configured goal; the goal still sets the speed required to pass. Only a pass matching the current guided mode, key group, goal and course revision earns progress or certificates. Next stays disabled until successful guided progress is earned.</p>${contentChoices}<p>Storage: ${storageMessage()}. Each local student keeps separate settings, results and certificates. Recovery mode will not overwrite unreadable saved data.</p>${browserOptions}<p>Type the displayed target. Wrong keys add errors without moving it. Outdoors, ASCII upper and lowercase letters match without Shift. Other activities require exact case, punctuation and spaces. Non-ASCII, repeated keys and modified shortcuts are ignored.</p><p>Outdoor keys may wait for contact and count only once. Reduced motion makes targets stationary. Escape, losing focus, hidden tabs and castle pipe stops pause both input and the clock. Resume explicitly when ready.</p><p>Net-error integer WPM and integer accuracy use a browser active-clock approximation. Timeout, at least one key, goal WPM and 90% accuracy are the browser pass rule, not a verified universal original rule. No early success or deaths.</p><p>Only matching guided lessons advance. Next preserves the first earned destination, saves it once and returns to the menu. Custom and Expert Express never advance. Certificates use browser milestones, not claimed original triggers.</p><button id="back">Back to menu</button>`);
  back(menu,keyboard?'#keyboard':'#help');
  if (!keyboard) {
    document.querySelector('#guided').onclick=()=>prepare({ guided:true });
    document.querySelector('#custom').onclick=customPractice;
  }
  document.querySelector('#back').focus();
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
function report(focus = '#back') {
  const tables=[['Current ruleset',profile.results.filter(r=>r.ruleset===RULESET)],['Legacy history (not comparable)',profile.results.filter(r=>r.ruleset!==RULESET)]];
  page('report','RCARD','Report card',`<p>${html(profile.name)} · ${position(profile.course)}</p>${profile.legacy?`<p>Legacy course archived: ${html(JSON.stringify(profile.legacy.profile.course))}. New course began at 5 WPM/home row. Original save retained; old passes and awards were not recomputed.</p>`:''}${tables.map(([title,rows])=>`<h2>${title}</h2><div class="table-scroll"><table aria-label="${html(title)}"><thead><tr><th>Activity / ruleset</th><th>Goal</th><th>WPM</th><th>Accuracy</th><th>Result</th><th>Elapsed / limit / reason</th></tr></thead><tbody>${rows.slice().reverse().map(r=>`<tr><td>${MODES[r.mode].name}<small>${html(r.ruleset)} · ${html(r.date)} · ${r.guided?'Guided':'Practice'}<br>${html(r.label??'Legacy text source not recorded')}</small></td><td>${r.goal}</td><td>${r.wpm}</td><td>${r.accuracy}%</td><td>${r.passed?'Pass':'Retry'}</td><td>${r.ruleset===RULESET?`${r.elapsed}s / ${r.duration}s / ${r.terminalReason}`:'Not recorded under current rules'}</td></tr>`).join('')}</tbody></table></div>${rows.length?'':'<p>No results in this ruleset.</p>'}`).join('')}<h2 id="certificates" tabindex="-1">Certificates</h2>${profile.certificates.map((c,i)=>`<button data-certificate="${i}">${certificateTitles[c.kind]} · ${html(c.name)} · ${html(c.ruleset)}</button>`).join('')||'<p>No certificates yet.</p>'}<p>Browser awards: committed world transitions and the guided 50-WPM all-keyboard castle assessment. These are not asserted original triggers. Historical awards remain intact.</p><button id="back">Main menu</button><button id="print">Print report</button>`);
  document.querySelectorAll('[data-certificate]').forEach(b=>b.onclick=()=>certificate(Number(b.dataset.certificate)));
  document.querySelector('#print').onclick=()=>window.print();back();document.querySelector(focus)?.focus();
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
  if (suppressedSkipKey === e.key) { e.preventDefault(); return; }
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
window.addEventListener('keyup',e=>{ if (suppressedSkipKey === e.key) suppressedSkipKey = undefined; });
window.addEventListener('blur',()=>pauseGame('The window lost focus. Resume when ready.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame('The tab was hidden. Resume when ready.');});
function frame(now){if(screen==='game'){tick(now);if(attempt.status==='finished')finish();else update();}requestAnimationFrame(frame);}
titleIntro();requestAnimationFrame(frame);
