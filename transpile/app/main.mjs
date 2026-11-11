import { Session, BIOS_HZ, dosKey, editStudent, loadProfiles } from './session.mjs';
import { Renderer } from './render.mjs';
import { newStudent, normalizeStudent } from '../recovered/control/student.mjs';
import { mainMenuCommand, mainMenuHit, canSelectMode } from '../recovered/control/flow.mjs';
import { resultCommand, resultHit } from '../recovered/control/results.mjs';

const canvas=document.querySelector('#game'), status=document.querySelector('#status'), form=document.querySelector('#setup');
const now=()=>Math.floor(performance.now()*BIOS_HZ/1000);
// Missing resources are fatal and visible, never substituted with generic art.
window.addEventListener('error',e=>{status.textContent=`Application stopped: ${e.message}`;});
window.addEventListener('unhandledrejection',e=>{status.textContent=`Application stopped: ${e.reason?.message||e.reason}`;});
const data=await fetch('./app/data.json').then(r=>{if(!r.ok)throw new Error('Decoded app bundle unavailable');return r.json();});
let storage, profiles, storageWarning='';
try { storage=localStorage; profiles=loadProfiles(storage); }
catch(error) { storageWarning=`Storage unavailable or invalid (${error.message}). Students are in memory only.`; profiles={current:null,students:{}}; }
const current=Object.hasOwn(profiles.students,profiles.current)?profiles.students[profiles.current]:null;
const seedParam=new URLSearchParams(location.search).get('seed');
const session=new Session(data,{bytes:current?Uint8Array.from(current):null,...(seedParam===null?{}:{seed:Number(seedParam)})});
const renderer=new Renderer(canvas,data); await renderer.load();
let pointer={x:-1,y:-1}, pendingKey=0, selection=0, isNew=false, editorReturn='menu';
function notice(text) { status.textContent=[storageWarning,text].filter(Boolean).join(' '); }
function save() { try { session.save(storage,profiles); refreshStudents(); } catch { storageWarning='Browser storage unavailable. Student remains in memory only.'; notice(''); } }
function refreshStudents() {
  const select=document.querySelector('#students'); select.replaceChildren(new Option('Choose...',''));
  for(const name of Object.keys(profiles.students)) select.add(new Option(name,name));
  select.value=profiles.current??'';
}
function draw() {
  const p=session.profile;
  if(session.screen==='menu') renderer.menu(p);
  else if(session.screen==='student'||session.screen==='times') renderer.setup(p,session.screen==='times');
  else if(session.cinematic) renderer.cinematic(p.character,session.cinematic.frame);
  else if(session.screen==='outdoor') renderer.outdoor(session.outdoor,session.stats(),session.bonus);
  else if(session.screen==='practice') renderer.practice(session.practice,session.stats(),session.expression(Math.floor(Date.now()/1000)),session.typed);
  else if(session.screen==='results') renderer.results(session.result,p,session.activity);
  document.querySelector('#suspend').disabled=!session.active;
  document.querySelector('#suspend').textContent=session.suspended?'Resume':'Suspend';
  for(const id of ['new','edit','times','load','students']) document.getElementById(id).disabled=session.active;
  canvas.dataset.screen=session.screen; canvas.dataset.suspended=String(session.suspended);
}
function focusGame() {
  canvas.focus(); session.suspend(false,now()); pendingKey=0;
  notice(session.screen==='practice'?'Practice. Match case. SPACE or Enter at line ends. Escape ends the activity.':session.screen==='outdoor'?'Outside. Type the marked target. Escape or F10 ends the activity.':'1 Outside · 4 Practice · W new student · E edit · T times · N Next'); draw();
}
function start(mode=1) { form.hidden=true; pendingKey=0; session.start(now(),mode); focusGame(); }
function next() {
  const route=session.next(now()); pendingKey=0;
  if(![1,4].includes(route.mode)) notice(`${data.messages[99+route.mode]} is not implemented. Next routes there at goal ${session.profile.goal}; no substitute activity was started.`);
  else focusGame();
  draw();
}
function openEditor(kind) {
  if(session.active) return;
  if(kind==='edit'&&!session.profile.profilePresent) { notice('Create a student with W first.'); return; }
  editorReturn=session.screen==='results'?'results':'menu'; isNew=kind==='new';
  const p=isNew ? new Session(data,{bytes:newStudent('Student')}).profile:session.profile;
  session.screen=kind==='times'?'times':'student'; form.hidden=false;
  const values={name:isNew?'':p.name,lesson:p.lesson,goal:p.goal,character:p.character,minutes:p.durations[0]||2,practiceMinutes:p.durations[3]||10};
  for(const [key,value] of Object.entries(values)) form.elements[key].value=value;
  for(const key of ['name','lesson','goal','character']) form.elements[key].disabled=kind==='times';
  notice('Browser editor. Values use recovered student fields; original widget behavior is not claimed.'); draw();
  form.elements[kind==='times'?'minutes':'name'].focus();
}
function menuAction(command) {
  if(command==='outdoor') start();
  else if(command==='practice') start(4);
  else if(command==='next') next();
  else if(command==='new-student') openEditor('new');
  else if(command==='edit-student') openEditor('edit');
  else if(command==='lesson-times') openEditor('times');
  else if(command==='load-student') { document.querySelector('#students').focus(); notice('Choose a saved student in the browser selector, then Load.'); }
  else if(command==='water'||command==='castle') {
    const mode=command==='water'?2:3;
    notice(canSelectMode(mode,session.profile)?`${command} is disabled: not implemented.`:`${command} requires goal ${mode===2?10:30} WPM and is not implemented.`);
  } else if(!['none','unrecognized','close-menu'].includes(command)) notice(`${command} is disabled in this slice. See fidelity note below.`);
  draw();
}
function resultsAction(command) {
  if(command==='menu') { session.screen='menu'; pendingKey=0; focusGame(); }
  else if(command==='next') next();
  else if(command==='select-next'||command==='select-previous') {
    selection=1-selection; pointer={x:selection?157:78,y:184};
    notice(`Results selection: ${selection?'Menu':'Next'}. Enter activates this position.`);
  } else if(command) notice(`${command} is disabled. See fidelity note.`);
  draw();
}
canvas.addEventListener('keydown',event=>{
  const key=dosKey(event); if(!key)return;
  event.preventDefault();
  if(session.active) {
    if(!session.suspended && !session.cinematic && !pendingKey) pendingKey=key; // one-slot host latch, not a DOS queue claim
  } else if(session.screen==='menu') menuAction(mainMenuCommand(key));
  else if(session.screen==='results') resultsAction(resultCommand(key,pointer.x,pointer.y));
  else if(key===27) cancelEditor();
});
function locationInCanvas(event) {
  const rect=canvas.getBoundingClientRect(); return {x:Math.floor((event.clientX-rect.left)*320/rect.width),y:Math.floor((event.clientY-rect.top)*200/rect.height)};
}
canvas.addEventListener('pointermove',event=>{
  pointer=locationInCanvas(event);
  const hit=session.screen==='menu'?mainMenuHit(pointer.x,pointer.y):-1;
  canvas.style.cursor=session.screen==='menu'&&hit>=0?([0,3,5].includes(hit)?'pointer':'not-allowed'):session.screen==='results'&&resultHit(pointer.x,pointer.y)?'pointer':'default';
});
canvas.addEventListener('click',event=>{
  pointer=locationInCanvas(event); canvas.focus();
  if(session.screen==='menu') {
    if(pointer.y<8) notice('Dropdowns are disabled. Use W/E/T or the browser controls.');
    else { const index=mainMenuHit(pointer.x,pointer.y); if(index>=0) menuAction(['outdoor','water','castle','practice','report','next'][index]); }
  } else if(session.screen==='results') resultsAction(resultHit(pointer.x,pointer.y));
  else if(session.active&&session.suspended) focusGame();
});
function suspend() {
  if(!session.active)return;
  session.suspend(true,now()); pendingKey=0; notice('Suspended by browser host. Focus game to resume.'); draw();
}
canvas.addEventListener('blur',suspend); window.addEventListener('blur',suspend);
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
document.querySelector('#focus').onclick=focusGame;
// Pointer-down happens before canvas blur, so the suspend button must not toggle twice.
document.querySelector('#suspend').onpointerdown=event=>{event.preventDefault(); if(session.suspended)focusGame();else suspend();};
document.querySelector('#suspend').onclick=event=>{if(event.detail===0){if(session.suspended)focusGame();else suspend();}};
for(const id of ['new','edit','times']) document.getElementById(id).onclick=()=>openEditor(id);
document.querySelector('#load').onclick=()=>{
  const name=document.querySelector('#students').value;
  if(!Object.hasOwn(profiles.students,name)) {notice('Choose a saved student first.');return;}
  session.student=normalizeStudent(Uint8Array.from(profiles.students[name])); session.screen='menu'; form.hidden=true; save(); focusGame();
};
function cancelEditor() { form.hidden=true; session.screen=editorReturn; focusGame(); }
document.querySelector('#cancel').onclick=cancelEditor;
form.addEventListener('submit',event=>{
  event.preventDefault();
  try {
    const values=Object.fromEntries(new FormData(form));
    let candidate=session.student;
    if(isNew) {
      const name=values.name.split('.')[0];
      const exists=Object.hasOwn(profiles.students,name);
      candidate=exists?normalizeStudent(Uint8Array.from(profiles.students[name])):newStudent(name);
      // Original new-name collision loads existing student instead of replacing defaults.
      if(exists) { session.student=candidate;form.hidden=true;session.screen='menu';save();focusGame();return; }
      values.name=name;
    }
    session.student=editStudent(candidate,Object.fromEntries(Object.entries(values).map(([k,v])=>[k,k==='name'?v:Number(v)])));
    form.hidden=true;session.screen='menu';save();focusGame();
  } catch(error) { notice(error.message); }
});
for(let i=1;i<=6;i++) form.elements.lesson.add(new Option(data.messages[299+i],i));
refreshStudents(); notice('1 Outside · 4 Practice · W new student · E edit · T times · N Next. Click the canvas to focus.'); draw();
setInterval(()=>{
  if(!session.active||session.suspended)return;
  const key=pendingKey;pendingKey=0;
  try { session.step(key,now()); }
  catch(error) { session.suspend(true,now()); notice(`Application stopped: ${error.message}`); return; }
  if(session.screen==='results') {
    save(); selection=0;
    notice(session.activity.aborted?'Activity ended early. Progression withheld. N Next · M Menu.':`Results. ${session.advance.advanced?'Student advanced. ':''}N Next · M Menu.`);
  }
  draw();
},1000/BIOS_HZ);
// Read-only snapshots for authored verification, no browser controls can mutate simulation state.
window.translationSnapshot=()=>({screen:session.screen,profile:session.profile,result:session.result,suspended:session.suspended,
  ticks:session.clock.ticks,seed:session.seed,initialSeed:session.initialSeed,limit:session.limit,corpusName:session.corpusName,
  bonus:structuredClone(session.bonus),cinematic:structuredClone(session.cinematic),
  practice:session.practice?{...structuredClone(session.practice),rows:Array.from(session.practice.rows),expression:session.expression(Math.floor(Date.now()/1000))}:null,
  outdoor:session.outdoor?structuredClone(session.outdoor):null});
