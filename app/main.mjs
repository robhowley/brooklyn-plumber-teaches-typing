import { Session, BIOS_HZ, SAVE_KEY, dosKey, loadProfiles } from './session.mjs';
import { Renderer } from './render.mjs';
import { normalizeStudent } from '../recovered/control/student.mjs';
import { createMenu, menuInput, createStudentUI, studentUIInput, createStudentChooser, studentChooserInput, createTextCursor, textCursorTick } from '../recovered/control/menu.mjs';
import { openHelp, helpInput, helpPointer, modalReturn, keyboardInput } from '../recovered/control/report.mjs';
import { resultCommand, resultHit } from '../recovered/control/results.mjs';
import { SourceAudio } from '../recovered/audio/audio.mjs';
import { BrowserAudio } from './audio.mjs';

const canvas=document.querySelector('#game'), status=document.querySelector('#status');
const now=()=>Math.floor(performance.now()*BIOS_HZ/1000);
let stopped=false, renderer=null, cursorVisible=false;
function stop(error) {
  stopped=true;cursorVisible=false;canvas.style.removeProperty('cursor');
  status.textContent=`Application stopped: ${error?.message||error}`;status.hidden=false;
  if(renderer?.palette) {renderer.setCursor(null);renderer.present();}
}
window.addEventListener('error',e=>stop(e.error??e.message));
window.addEventListener('unhandledrejection',e=>stop(e.reason));
const data=await fetch('./app/data.json').then(r=>{if(!r.ok)throw new Error('Decoded app bundle unavailable');return r.json();});
let storage, profiles, storageWarning='';
try { storage=localStorage; profiles=loadProfiles(storage); }
catch(error) { storageWarning=`Storage unavailable or invalid (${error.message}). Students are in memory only.`; profiles={current:null,students:{}}; }
const current=Object.hasOwn(profiles.students,profiles.current)?profiles.students[profiles.current]:null;
const seedParam=new URLSearchParams(location.search).get('seed');
const browserAudio=new BrowserAudio();
const sourceAudio=new SourceAudio({...data.audio.config,
  // Explicit browser transport choices, not emulated DOS driver detection.
  available:{music:true,effects:true,speech:typeof globalThis.AudioContext==='function'}});
let audioOutcomes=[];
for(const [name,clip] of Object.entries(data.audio.clips)) {
  try {browserAudio.register(name,Uint8Array.from(atob(clip.pcm),c=>c.charCodeAt(0)),clip);}
  catch(error) {status.textContent=`Audio resource ${name} unavailable: ${error.message}`;status.hidden=false;}
}
function handleAudio(request) {
  const decision=sourceAudio.request({...request,type:request.type==='music-stop'?'stop-music':request.type});
  const performed=browserAudio.perform(decision).catch(()=>[{channel:'speech',status:'failed'}]);
  if(!decision.blocking)return {status:decision.status,actions:decision.actions};
  performed.then(outcomes=>{
    audioOutcomes.push({name:request.name,outcomes});
    sourceAudio.complete(decision.token);flush();
    session.completeAudio(outcomes,now(),Math.floor(Date.now()/1000));draw();
  }).catch(stop);
  return {status:'pending',inputPolicy:decision.inputPolicy,token:decision.token,actions:decision.actions};
}
const session=new Session(data,{bytes:current?Uint8Array.from(current):null,audioBoundary:handleAudio,...(seedParam===null?{}:{seed:Number(seedParam)})});
renderer=new Renderer(canvas,data); await renderer.load();
// Source citations below refer to MarioTea/MARIO/MARIO.EXE, SHA256
// 6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e.
let pointer={x:160,y:100}, leftPressed=false, pendingKey=0, pendingMenuPointer=null, selection=0, editorReturn='menu', editorReset=false;
let menu=createMenu({options:sourceAudio.options}), studentUI=null, chooser=null, modal=null, savedModal=null;
// Browser policy: retain logical position on leave/blur, hide until re-entry/focus.
// Keyboard positioning never warps the OS pointer; touch uses the same mapped press.
let pointerInside=true, browserFocused=true, seenMenuEntries=0;
function setPointer(position) {
  pointer={...position};
  if(studentUI)studentUI.pointer={...pointer};
  if(chooser)chooser.pointer={...pointer};
  if(session.screen==='menu')menu.pointer={...pointer};
}
function syncCursor() {
  // Only shared-pump waits own the arrow, not fields, animations, audio or
  // main blink waits (FILE 0x10c27..0x10ce3). Final celebration pumps are
  // FILE 0x14113/0x17d77/0xe0fe; preceding ready/abort/movie waits are not.
  const waiting=modal||studentUI&&!studentUI.field||chooser||
    session.screen==='menu'&&session.menuIdle&&!session.menuIdle.state.waiting||
    session.screen==='results'||session.screen==='celebration'&&session.celebration?.wait==='wait-input';
  cursorVisible=!!waiting&&!stopped&&!session.audioPending&&!session.suspended&&
    pointerInside&&browserFocused&&!document.hidden;
  renderer.setCursor(cursorVisible?pointer:null);
  if(cursorVisible)canvas.style.cursor='none';else canvas.style.removeProperty('cursor');
}
function presentPointer() {syncCursor();if(renderer.palette)renderer.present();}
let caret=createTextCursor(session.lastWaitTick);
function storageError(error) { storageWarning=`Browser storage unavailable (${error.message}). Student changes remain in memory only.`;status.textContent=storageWarning;status.hidden=false; }
function save() { try { session.save(storage,profiles); } catch(error) { storageError(error); } }
function deleteStudent(name) {
  const actual=findName(name); if(actual===undefined)return;
  delete profiles.students[actual];if(profiles.current===actual)profiles.current=null;
  try { storage.setItem(SAVE_KEY,JSON.stringify(profiles)); } catch(error) { storageError(error); }
}
function findName(name) { return Object.keys(profiles.students).find(n=>n.toUpperCase()===name.toUpperCase()); }
function draw() {
  const p=session.profile;
  if(session.menuEntries!==seenMenuEntries) {
    seenMenuEntries=session.menuEntries;setPointer(p.profilePresent?{x:267,y:175}:{x:160,y:100});
  }
  for(const e of session.resultEffects.splice(0)) {
    // Statistics drawing precedes the result pump and owns no cursor wait.
    if(e.type==='result-stats') {renderer.setCursor(null);renderer.results(session.result,p,session.activity);}
    else if(e.type==='flush-input')flush();
    else if(e.type==='set-result-suppression')session.student[47]=Number(e.value);
    else if(e.type==='result-pointer')setPointer({x:e.x,y:e.y});
    else if(e.type==='save-profile')save();
    else if(e.type==='host-clock-reset') {pendingKey=0;session.lastWaitTick=now()&65535;}
  }
  syncCursor();
  const presentation=session.takePresentationEffects();
  if(presentation.length) {
    if(session.mode===2)renderer.water(session.takeEffects(),session.water);
    if(session.mode===3)renderer.castle(session.takeEffects(),session.castle);
    renderer.presentation(presentation,p.character);
  }
  if(modal) renderer.modal(modal,session.student);
  else if(studentUI) renderer.studentUI(studentUI,caret.inverted);
  else if(chooser) renderer.chooser(chooser);
  else if(session.screen==='menu') renderer.menu(p,menu);
  else if(session.screen==='startup'||session.screen==='celebration')renderer.present();
  else if(session.cinematic) renderer.cinematic(p.character,session.cinematic.frame);
  else if(session.screen==='castle') renderer.castle(session.takeEffects(),session.castle);
  else if(session.screen==='water') renderer.water(session.takeEffects(),session.water);
  else if(session.screen==='outdoor') renderer.outdoor(session.outdoor,session.stats(),session.bonus);
  else if(session.screen==='practice') renderer.practice(session.practice,session.stats(),session.expression(Math.floor(Date.now()/1000)),session.typed);
  else if(session.screen==='results') renderer.results(session.result,p,session.activity);
  canvas.dataset.screen=session.screen; canvas.dataset.suspended=String(session.suspended);
  canvas.dataset.audioBlocking=String(!!session.audioPending);
}
function flush() { pendingKey=0;pendingMenuPointer=null;session.input.flush(); }
function focusGame() {
  if(stopped)return;browserFocused=true;canvas.focus();session.suspend(false,now());flush();
  if(session.screen==='menu'&&session.menuIdle&&!session.menuIdle.state.waiting)session.menuIdle.restartPump(now());
  draw();
}
function start(mode=1) { if(session.audioPending)return;studentUI=null;chooser=null;menu.row=0;flush();session.start(now(),mode);focusGame(); }
function next() {
  const route=session.next(now(),save);if(!route)return;draw();flush();menu.row=0;
  if([1,2,3,4].includes(route.mode))focusGame();
  draw();
}
function resetCaret() { caret=createTextCursor(session.lastWaitTick); }
function openEditor(kind,fromDropdown=false) {
  if(stopped||session.audioPending||!['menu','results'].includes(session.screen)||modal||chooser||studentUI)return;
  if(kind==='edit'&&!session.profile.profilePresent)return;
  editorReturn=session.screen==='results'?'results':'menu';
  // Direct New/Edit callers reposition at FILE 0x11408; dropdown Enter
  // callers 0x1162c..0x1165e retain the callee's position. Durations do too.
  editorReset=editorReturn==='menu'&&kind!=='times'&&!fromDropdown;
  const inherited={...pointer};studentUI=createStudentUI(session.student,kind);session.student=studentUI.bytes;resetCaret();
  session.screen=kind==='times'?'times':'student';setPointer(kind==='new'?inherited:studentUI.pointer);focusGame();
}
function closeEditor() { studentUI=null;session.screen=editorReturn;setPointer(editorReset?{x:267,y:175}:pointer);flush();focusGame(); }
function studentEvent(event) {
  const result=studentUIInput(studentUI,{...event,messages:data.messages},Object.fromEntries(Object.entries(profiles.students).map(([n,b])=>[n,Uint8Array.from(b)])));
  studentUI=result.state;setPointer(studentUI.pointer);session.student=studentUI.bytes;resetCaret();
  for(const effect of result.effects) {
    if(effect.type==='delete-student') deleteStudent(effect.name);
    else if(effect.type==='save-student') save();
    else limitation(effect);
  }
  studentUI.bytes=session.student;
  if(studentUI.done) closeEditor();else draw();
}
function openChooser() {
  chooser=createStudentChooser(Object.keys(profiles.students),now());session.screen='load';
  // Empty Load has no positioning call (FILE 0xf7b5..0xf7f7).
  setPointer(chooser.names.length?chooser.pointer:pointer);flush();
  focusGame();
}
function loadStudent(name) {
  const actual=findName(name);if(actual===undefined)return;
  session.student=Uint8Array.from(profiles.students[actual]);session.student[27]=0;session.student[28]=1;
  session.student=normalizeStudent(session.student);save();
}
function chooserEvent(event) {
  const result=studentChooserInput(chooser,{...event,ticks:now(),messages:data.messages});chooser=result.state;setPointer(chooser.pointer);
  for(const effect of result.effects) if(effect.type==='load-student')loadStudent(effect.name);else limitation(effect);
  if(chooser.done) {chooser=null;session.screen='menu';setPointer(pointer);flush();focusGame();}else draw();
}
function openModal(kind,section=1) {
  syncCursor();if(session.screen==='menu')renderer.menu(session.profile,menu);
  // Only main's Report caller saves coordinates (FILE 0x114d5..0x114ff).
  savedModal={screen:session.screen,front:renderer.front.slice(),palette:renderer.palette,
    pointer:kind==='report'&&session.screen==='menu'?{...pointer}:null,operations:renderer.operations};
  modal=kind==='help'?openHelp(section,session.screen,data.control.help[section]):{kind,returnTo:session.screen,closed:false};
  session.screen=kind;flush();
  // Entry positioning: FILE 0xe94c, 0x14650, 0x1218e, 0x155fc.
  setPointer(kind==='help'?helpPointer(modal):{report:{x:300,y:100},keyboard:{x:160,y:100},about:{x:300,y:180}}[kind]);focusGame();
}
function modalEvent(event) {
  modal=modal.kind==='help'?helpInput(modal,{key:event.key??null,x:pointer.x,y:pointer.y,leftButton:!!event.pointer,doneKey:data.messages[10000].charCodeAt(0),quitAllowed:session.option10}):
    (modal.kind==='keyboard'?keyboardInput:modalReturn)(modal,{key:event.key??null,pointerEnabled:true,pointerChanged:!!event.pointer});
  if(modal.closed) {
    session.screen=modal.route;modal=null;setPointer(savedModal.pointer??pointer);flush();
    renderer.front.set(savedModal.front);renderer.palette=savedModal.palette;renderer.operations=savedModal.operations;
    if(session.screen==='menu'&&!session.menuIdle.state.waiting)session.menuIdle.restartPump(now());
    syncCursor();renderer.present();savedModal=null;canvas.dataset.screen=session.screen;
  } else {
    // Help scrolling and physical motion do not reposition, only navigation
    // at FILE 0x15870..0x15886 does, including a full cycle back to index 2.
    if(modal.kind==='help'&&[9,0x14b,0x14d].includes(event.key))setPointer(helpPointer(modal));
    draw();
  }
}
function limitation(effect) {
  if(effect.type==='options') {
    const musicChanged=(sourceAudio.options^effect.value)&1;sourceAudio.setOptions(effect.value);
    if(musicChanged)session.audio(effect.value&1?{type:'music',id:2}:{type:'music-stop'});
  }
  else if(effect.type==='sound-request') session.audio({type:'speech',name:effect.name});
}
function menuEvent(event) {
  if(session.audioPending)return;
  renderer.menuBubble=false;
  if(session.menuIdle&&!session.menuIdle.state.waiting)session.menuIdle.restartPump(now());
  const fromDropdown=(event.key===13||event.key===32)&&menu.row>0;
  const result=menuInput(menu,{...event,front:renderer.front,messages:data.messages},session.profile);menu=result.state;
  // A queued press may be older than the latest physical motion.
  menu.pointer={...pointer};
  for(const effect of result.effects) {
    if(effect.type==='start') {if(effect.lesson)new DataView(session.student.buffer).setInt16(25,effect.lesson,true);if([1,2,3,4].includes(effect.mode))start(effect.mode);else limitation(effect);}
    else if(effect.type==='set-lesson')new DataView(session.student.buffer).setInt16(25,effect.lesson,true);
    else if(effect.type==='save-student')save();
    else if(effect.type==='demo') {session.selectDemo();}
    else if(effect.type==='new-student')openEditor('new',fromDropdown);
    else if(effect.type==='edit-student')openEditor('edit',fromDropdown);
    else if(effect.type==='lesson-times')openEditor('times');
    else if(effect.type==='load-student')openChooser();
    else if(['help','keyboard','about','report'].includes(effect.type))openModal(effect.type,effect.operation);
    else limitation(effect);
  }
  draw();
}
function pumpMenu() {
  session.menuStep(now(),menu.column===1&&menu.row>0);
  if(session.audioPending||!session.menuIdle) {draw();return;}
  if(!session.menuIdle.state.waiting&&pendingMenuPointer) {const point=pendingMenuPointer;pendingMenuPointer=null;menuEvent({pointer:point});}
  else if(!session.menuIdle.state.waiting&&session.input.pending())menuEvent({key:session.input.consume()});
  else draw();
}
function resultsAction(command) {
  if(command==='menu') {session.enterMenu(now());menu=createMenu({options:menu.options});renderer.menuBubble=false;flush();focusGame();}
  else if(command==='next')next();
  else if(command==='help-results')openModal('help',2);
  else if(command==='keyboard')openModal('keyboard');
  else if(command==='select-next'||command==='select-previous') {selection=1-selection;setPointer({x:selection?157:78,y:184});}
  else if(command)limitation({type:command});
  draw();
}
canvas.addEventListener('keydown',event=>{
  if(stopped)return;
  const key=dosKey(event);if(!key)return;event.preventDefault();
  if(session.audioPending || (key===0x12d&&!session.option10&&!session.active&&!['menu','startup'].includes(session.screen))) {flush();return;}
  if(modal)modalEvent({key});
  else if(studentUI)studentEvent({key});
  else if(chooser)chooserEvent({key,pointer:leftPressed?pointer:null});
  else if(session.screen==='startup'||session.screen==='celebration') {if(!session.suspended)session.enqueue(key);}
  else if(session.active) {if(!session.suspended&&([2,3].includes(session.mode)||session.demo))session.enqueue(key);else if(!session.suspended&&!session.cinematic&&!pendingKey)pendingKey=key;}
  else if(session.screen==='menu') {session.enqueue(key);pumpMenu();}
  else if(session.screen==='results')resultsAction(resultCommand(key,pointer.x,pointer.y));
});
function locationInCanvas(event) {
  const r=canvas.getBoundingClientRect();
  // Preserve floored browser scaling and recovered poll upper caps, FILE
  // 0x1486a..0x148aa. The renderer safely clips exceptional negative positions.
  return {x:Math.min(305,Math.floor((event.clientX-r.left)*320/r.width)),y:Math.min(187,Math.floor((event.clientY-r.top)*200/r.height))};
}
// Browser motion is tracked even during fields; original driver polling there
// is unestablished. Motion never calls an activation reducer or redraws front.
canvas.addEventListener('pointermove',event=>{setPointer(locationInCanvas(event));presentPointer();});
canvas.addEventListener('pointerenter',event=>{pointerInside=true;setPointer(locationInCanvas(event));presentPointer();});
canvas.addEventListener('pointerleave',()=>{pointerInside=false;presentPointer();});
// A fresh left press, not a click synthesized after a release or a right button.
canvas.addEventListener('pointerdown',event=>{
  if(stopped||session.audioPending)return;
  pointerInside=true;setPointer(locationInCanvas(event));
  if(event.button===0) {
    if(!leftPressed)session.audio({type:'effect',id:8,file:0x149bc});
    leftPressed=true;
  }
  if(session.screen==='celebration'&&!session.suspended) {event.preventDefault();session.stepPresentation(0,now(),true);draw();return;}
  if(modal&&['report','about'].includes(modal.kind)) {event.preventDefault();modalEvent({pointer});return;}
  if(event.button!==0)return;event.preventDefault();leftPressed=true;canvas.focus();
  if(modal)modalEvent({pointer});else if(studentUI)studentEvent({pointer});else if(chooser)chooserEvent({pointer});
  else if(session.screen==='menu') {pendingMenuPointer={...pointer};pumpMenu();}else if(session.screen==='results')resultsAction(resultHit(pointer.x,pointer.y));else if(session.active&&session.suspended)focusGame();
});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
window.addEventListener('pointerup',event=>{
  if(event.button===0)leftPressed=false;
  if(!stopped&&!session.audioPending&&!session.suspended&&session.screen==='celebration') {session.stepPresentation(0,now(),true);draw();}
});
window.addEventListener('pointercancel',()=>{leftPressed=false;});
function suspend() {browserFocused=false;browserAudio.stop('blur');leftPressed=false;if(session.active||['startup','celebration'].includes(session.screen)) {session.suspend(true,now());flush();}draw();}
canvas.addEventListener('blur',suspend);window.addEventListener('blur',suspend);
canvas.addEventListener('focus',focusGame);
window.addEventListener('focus',()=>{if(!document.hidden)focusGame();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else focusGame();});
// Unlock only on trusted gestures. Missed requests are never queued/replayed.
for(const type of ['pointerdown','keydown'])document.addEventListener(type,event=>{void browserAudio.unlock(event);},true);
if(storageWarning) {status.textContent=storageWarning;status.hidden=false;}
focusGame();
setInterval(()=>{
  if(stopped||session.audioPending)return;
  if(chooser&&leftPressed) {chooserEvent({pointer});return;}
  if(studentUI?.field) {
    const tick=now()&65535;
    if(document.activeElement===canvas&&!document.hidden&&tick!==caret.tick) {caret=textCursorTick(caret,tick);session.lastWaitTick=caret.tick;draw();}
    return;
  }
  if(session.screen==='menu') {pumpMenu();return;}
  if((!session.active&&!['startup','celebration'].includes(session.screen))||session.suspended)return;
  const key=pendingKey;pendingKey=0;
  try {
    session.step(key,now());
  } catch(error) {session.suspend(true,now());stop(error);return;}
  if(session.screen==='results') {save();selection=0;}
  draw();
},1000/BIOS_HZ);
// Read-only authored verification. No mutation hooks or original code execution.
window.translationSnapshot=()=>({screen:session.screen,inputPending:session.input.pending(),profile:session.profile,result:session.result,suspended:session.suspended,
  menu:structuredClone(menu),studentUI:studentUI?{kind:studentUI.kind,field:studentUI.field,selection:studentUI.selection,pointer:{...studentUI.pointer},caret:{...caret}}:null,
  chooser:structuredClone(chooser),modal:modal?{...modal,lines:undefined}:null,pointer:{...pointer},cursor:{visible:cursorVisible,inside:pointerInside,focused:browserFocused},palette:renderer.palette,operations:renderer.operations,
  startup:{...structuredClone(session.startup.state)},paletteWrites:renderer.paletteWrites,
  menuIdle:session.menuIdle?structuredClone(session.menuIdle.state):null,menuTimer:{...session.menuTimer},
  celebration:session.celebration?{world:session.celebrationWorld,wait:session.celebration.wait,complete:session.celebration.complete,x:session.celebration.x,y:session.celebration.y}:null,
  demo:session.demo?{...session.demo.state}:null,audio:session.audioLog.slice(-40),
  audioHost:{state:browserAudio.state,muted:browserAudio.muted,active:!!browserAudio.active,blocking:!!session.audioPending,
    sourceOptions:sourceAudio.options,config:data.audio.config,available:{...sourceAudio.available},outcomes:audioOutcomes.slice(-20)},
  ticks:session.clock.ticks,seed:session.seed,initialSeed:session.initialSeed,limit:session.limit,corpusName:session.corpusName,
  bonus:structuredClone(session.bonus),cinematic:structuredClone(session.cinematic),
  practice:session.practice?{...structuredClone(session.practice),rows:Array.from(session.practice.rows),expression:session.expression(Math.floor(Date.now()/1000))}:null,
  water:session.water?{phase:session.water.phase,window:Array.from(session.water.window),display:Array.from(session.water.display),
    targetIndex:session.water.targetIndex,redrawCount:session.water.redrawCount,stats:{...session.water.stats},
    swimmer:{...session.water.swimmer},pursuer:{...session.water.pursuer},bonus:{...session.water.bonus},
    failed:session.water.failed,failurePhase:session.water.failurePhase,aborted:session.water.aborted,lastInput:session.water.lastInput,timedOut:session.water.timedOut,movie:structuredClone(session.waterMovie)}:null,
  castle:session.castle?{phase:session.castle.phase,cycle:session.castle.cycle,stage:session.castle.stage,x:session.castle.x,y:session.castle.y,scene:session.castle.scene,sceneType:session.castle.sceneType,
    words:Array.from(session.castle.queue.words.slice(0,40)),target:session.castle.queue.target,locked:session.castle.locked,stats:{...session.castle.stats},flags:{...session.castle.flags},bonus:{...session.castle.bonus},movie:structuredClone(session.castleMovie),persistent:{...session.castlePersistent},ending:session.castleEnding?.event??null,endingAck:session.castleEndingAck??null}:null,
  outdoor:session.outdoor?structuredClone(session.outdoor):null});
