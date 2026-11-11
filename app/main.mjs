import { Session, BIOS_HZ, SAVE_KEY, dosKey, editStudent, loadProfiles } from './session.mjs';
import { Renderer } from './render.mjs';
import { newStudent, normalizeStudent, readStudent } from '../recovered/control/student.mjs';
import { createMenu, menuInput, createStudentUI, studentUIInput, createStudentChooser, studentChooserInput, createTextCursor, textCursorTick } from '../recovered/control/menu.mjs';
import { openHelp, helpInput, helpPointer, modalReturn, keyboardInput } from '../recovered/control/report.mjs';
import { mainMenuHit, canSelectMode } from '../recovered/control/flow.mjs';
import { resultCommand, resultHit } from '../recovered/control/results.mjs';
import { SourceAudio } from '../recovered/audio/audio.mjs';
import { BrowserAudio } from './audio.mjs';

const canvas=document.querySelector('#game'), status=document.querySelector('#status'), form=document.querySelector('#setup');
const now=()=>Math.floor(performance.now()*BIOS_HZ/1000);
let stopped=false;
function stop(error) { stopped=true;status.textContent=`Application stopped: ${error?.message||error}`; }
window.addEventListener('error',e=>stop(e.error??e.message));
window.addEventListener('unhandledrejection',e=>stop(e.reason));
const data=await fetch('./app/data.json').then(r=>{if(!r.ok)throw new Error('Decoded app bundle unavailable');return r.json();});
let storage, profiles, storageWarning='';
try { storage=localStorage; profiles=loadProfiles(storage); }
catch(error) { storageWarning=`Storage unavailable or invalid (${error.message}). Students are in memory only.`; profiles={current:null,students:{}}; }
const current=Object.hasOwn(profiles.students,profiles.current)?profiles.students[profiles.current]:null;
const seedParam=new URLSearchParams(location.search).get('seed');
const audioStatus=document.querySelector('#audio-status');
const browserAudio=new BrowserAudio({onState:()=>showAudio()});
const sourceAudio=new SourceAudio({...data.audio.config,
  // Explicit browser transport choices, not emulated DOS driver detection.
  available:{music:true,effects:true,speech:typeof globalThis.AudioContext==='function'}});
let audioWarning='', audioOutcomes=[];
for(const [name,clip] of Object.entries(data.audio.clips)) {
  try {browserAudio.register(name,Uint8Array.from(atob(clip.pcm),c=>c.charCodeAt(0)),clip);}
  catch(error) {audioWarning=`${name} unavailable: ${error.message}`;}
}
function showAudio() {
  audioStatus.textContent=`Browser audio: ${browserAudio.state}${browserAudio.muted?', host muted':''}. Source M/S/G bits ${sourceAudio.options}. VOC only, 58 resources unsupported and silent. ${audioWarning}`;
  document.querySelector('#host-mute').textContent=browserAudio.muted?'Unmute browser audio':'Mute browser audio';
}
function handleAudio(request) {
  const decision=sourceAudio.request({...request,type:request.type==='music-stop'?'stop-music':request.type});
  const performed=browserAudio.perform(decision).catch(()=>[{channel:'speech',status:'failed'}]);
  if(!decision.blocking)return {status:decision.status,actions:decision.actions};
  performed.then(outcomes=>{
    audioOutcomes.push({name:request.name,outcomes});
    if(outcomes.some(o=>o.status!=='ended'))audioWarning=`${request.name} omitted (${outcomes.map(o=>o.status).join(', ')}), continuing without a guessed delay.`;
    sourceAudio.complete(decision.token);flush();
    session.completeAudio(outcomes,now(),Math.floor(Date.now()/1000));showAudio();draw();
  }).catch(stop);
  return {status:'pending',inputPolicy:decision.inputPolicy,token:decision.token,actions:decision.actions};
}
const session=new Session(data,{bytes:current?Uint8Array.from(current):null,audioBoundary:handleAudio,...(seedParam===null?{}:{seed:Number(seedParam)})});
const renderer=new Renderer(canvas,data); await renderer.load();
let pointer={x:308,y:94}, leftPressed=false, pendingKey=0, pendingMenuPointer=null, selection=0, editorReturn='menu', isNew=false;
let menu=createMenu({options:sourceAudio.options}), studentUI=null, chooser=null, modal=null, savedModal=null, controlPointer=null;
let caret=createTextCursor(session.lastWaitTick);
function notice(text) { status.textContent=[storageWarning,text].filter(Boolean).join(' '); }
function storageError(error) { storageWarning=`Browser storage unavailable (${error.message}). Student changes remain in memory only.`; notice(''); }
function save() { try { session.save(storage,profiles); } catch(error) { storageError(error); } refreshStudents(); }
function deleteStudent(name) {
  const actual=findName(name); if(actual===undefined)return;
  delete profiles.students[actual];if(profiles.current===actual)profiles.current=null;
  try { storage.setItem(SAVE_KEY,JSON.stringify(profiles)); } catch(error) { storageError(error); }
  refreshStudents();
}
function findName(name) { return Object.keys(profiles.students).find(n=>n.toUpperCase()===name.toUpperCase()); }
function refreshStudents() {
  const select=document.querySelector('#students'); select.replaceChildren(new Option('Choose...',''));
  for(const name of Object.keys(profiles.students)) select.add(new Option(name,name));
  select.value=profiles.current??'';
}
function draw() {
  const p=session.profile;
  const presentation=session.takePresentationEffects();
  if(presentation.length) {
    if(session.mode===2)renderer.water(session.takeEffects(),session.water);
    if(session.mode===3)renderer.castle(session.takeEffects(),session.castle);
    renderer.presentation(presentation,p.character);
  }
  for(const e of session.resultEffects.splice(0)) {
    if(e.type==='result-stats')renderer.results(session.result,p,session.activity);
    else if(e.type==='flush-input')flush();
    else if(e.type==='set-result-suppression')session.student[47]=Number(e.value);
    else if(e.type==='result-pointer')pointer={x:e.x,y:e.y};
    else if(e.type==='save-profile')save();
    else if(e.type==='host-clock-reset') {pendingKey=0;session.lastWaitTick=now()&65535;}
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
  document.querySelector('#suspend').disabled=!session.active;
  document.querySelector('#suspend').textContent=session.suspended?'Resume':'Suspend';
  for(const id of ['new','edit','times','load','students']) document.getElementById(id).disabled=!['menu','results'].includes(session.screen)||!!session.audioPending||!!modal||!!chooser||!!studentUI;
  canvas.dataset.screen=session.screen; canvas.dataset.suspended=String(session.suspended);
  canvas.dataset.audioBlocking=String(!!session.audioPending);
}
function flush() { pendingKey=0;pendingMenuPointer=null;session.input.flush(); }
function focusGame() {
  if(stopped)return;canvas.focus();session.suspend(false,now());flush();
  if(session.screen==='menu'&&session.menuIdle&&!session.menuIdle.state.waiting)session.menuIdle.restartPump(now());
  draw();
}
function start(mode=1) { if(session.audioPending)return;form.hidden=true;studentUI=null;chooser=null;menu.row=0;flush();session.start(now(),mode);notice('Match the marked target. Escape ends. Browser focus loss suspends the lesson.');focusGame(); }
function next() {
  const route=session.next(now(),save);if(!route)return;draw();flush();menu.row=0;
  if(![1,2,3,4].includes(route.mode)) notice(`${data.messages[99+route.mode]} is not implemented. No substitute activity was started.`);
  else { form.hidden=true;focusGame(); }
  draw();
}
function resetCaret() { caret=createTextCursor(session.lastWaitTick); }
function openEditor(kind) {
  if(stopped||session.audioPending||!['menu','results'].includes(session.screen)||modal||chooser||studentUI)return;
  if(kind==='edit'&&!session.profile.profilePresent) {notice('Create a student first.');return;}
  editorReturn=session.screen==='results'?'results':'menu';isNew=kind==='new';controlPointer={...pointer};
  const p=isNew?readStudent(newStudent('Student')):session.profile;
  studentUI=createStudentUI(session.student,kind);session.student=studentUI.bytes;resetCaret();
  session.screen=kind==='times'?'times':'student';form.hidden=false;
  const values={name:isNew?'':p.name,lesson:p.lesson,goal:p.goal,character:p.character,minutes:p.durations[0]||2,waterMinutes:p.durations[1]||5,castleMinutes:p.durations[2]||5,practiceMinutes:p.durations[3]||10};
  for(const [key,value] of Object.entries(values)) form.elements[key].value=value;
  for(const key of ['name','lesson','goal','character']) form.elements[key].disabled=kind==='times';
  notice('Canvas: original student keys and fields. Separate browser form below is an explicit fallback. Escape in a field cancels that field; outside fields it saves and returns.');focusGame();
}
function closeEditor() { studentUI=null;form.hidden=true;session.screen=editorReturn;pointer=controlPointer;controlPointer=null;flush();focusGame(); }
function studentEvent(event) {
  const result=studentUIInput(studentUI,{...event,messages:data.messages},Object.fromEntries(Object.entries(profiles.students).map(([n,b])=>[n,Uint8Array.from(b)])));
  studentUI=result.state;session.student=studentUI.bytes;resetCaret();
  for(const effect of result.effects) {
    if(effect.type==='delete-student') deleteStudent(effect.name);
    else if(effect.type==='save-student') save();
    else if(effect.type==='loaded-student'||effect.type==='created-student') {isNew=false;notice(`${effect.type}: ${effect.name}`);}
    else limitation(effect);
  }
  studentUI.bytes=session.student;
  if(studentUI.done) closeEditor();else draw();
}
function openChooser() {
  controlPointer={...pointer};chooser=createStudentChooser(Object.keys(profiles.students),now());session.screen='load';form.hidden=true;flush();
  notice(chooser.names.length?'Choose a student. D means Done/load, C or Escape cancels. No delete command.':'No saved students. Press a key to return.');focusGame();
}
function loadStudent(name) {
  const actual=findName(name);if(actual===undefined) {notice(`Student unavailable: ${name}`);return;}
  session.student=Uint8Array.from(profiles.students[actual]);session.student[27]=0;session.student[28]=1;
  session.student=normalizeStudent(session.student);save();
}
function chooserEvent(event) {
  const result=studentChooserInput(chooser,{...event,ticks:now(),messages:data.messages});chooser=result.state;
  for(const effect of result.effects) if(effect.type==='load-student')loadStudent(effect.name);else limitation(effect);
  if(chooser.done) {chooser=null;session.screen='menu';pointer=controlPointer;controlPointer=null;flush();focusGame();}else draw();
}
function openModal(kind,section=1) {
  if(session.screen==='menu')renderer.menu(session.profile,menu);
  savedModal={screen:session.screen,front:renderer.front.slice(),palette:renderer.palette,pointer:{...pointer},operations:renderer.operations};
  modal=kind==='help'?openHelp(section,session.screen,data.control.help[section]):{kind,returnTo:session.screen,closed:false};
  session.screen=kind;flush();if(kind==='help')pointer=helpPointer(modal);notice(`${kind}. Closing input is consumed before returning.`);focusGame();
}
function modalEvent(event) {
  modal=modal.kind==='help'?helpInput(modal,{key:event.key??null,x:event.pointer?.x,y:event.pointer?.y,leftButton:!!event.pointer,doneKey:data.messages[10000].charCodeAt(0),quitAllowed:session.option10}):
    (modal.kind==='keyboard'?keyboardInput:modalReturn)(modal,{key:event.key??null,pointerEnabled:true,pointerChanged:!!event.pointer});
  if(modal.closed) {
    session.screen=modal.route;modal=null;pointer=savedModal.pointer;flush();
    renderer.front.set(savedModal.front);renderer.palette=savedModal.palette;renderer.operations=savedModal.operations;renderer.present();savedModal=null;
    canvas.dataset.screen=session.screen;
    if(session.screen==='menu'&&!session.menuIdle.state.waiting)session.menuIdle.restartPump(now());
    notice('Returned to '+session.screen+'.');
  } else {if(modal.kind==='help')pointer=helpPointer(modal);draw();}
}
function limitation(effect) {
  if(effect.type.includes('quit')&&effect.type!=='quit-request'&&!session.option10)return;
  if(effect.type.includes('quit')) notice('Original Quit exits DOS. A browser page cannot quit its process or close this tab; no lesson was started.');
  else if(effect.type==='options') {
    const musicChanged=(sourceAudio.options^effect.value)&1;sourceAudio.setOptions(effect.value);
    if(musicChanged)session.audio(effect.value&1?{type:'music',id:2}:{type:'music-stop'});
    showAudio();notice(`Source M/S/G bits ${effect.value}, separate from browser mute. Effects1/11 bypass S.`);
  }
  else if(effect.type==='sound-request') session.audio({type:'speech',name:effect.name});
  else notice(`${effect.type}${effect.command?': '+effect.command:''} is not translated. No substitute action was performed.`);
}
function menuEvent(event) {
  if(session.audioPending)return;
  renderer.menuBubble=false;
  if(session.menuIdle&&!session.menuIdle.state.waiting)session.menuIdle.restartPump(now());
  const result=menuInput(menu,{...event,front:renderer.front,messages:data.messages},session.profile);menu=result.state;
  for(const effect of result.effects) {
    if(effect.type==='start') {if(effect.lesson)new DataView(session.student.buffer).setInt16(25,effect.lesson,true);if([1,2,3,4].includes(effect.mode))start(effect.mode);else limitation(effect);}
    else if(effect.type==='set-lesson')new DataView(session.student.buffer).setInt16(25,effect.lesson,true);
    else if(effect.type==='save-student')save();
    else if(effect.type==='demo') {session.selectDemo();notice('Explicit Demo, choose a world. No saved progress.');}
    else if(effect.type==='new-student')openEditor('new');
    else if(effect.type==='edit-student')openEditor('edit');
    else if(effect.type==='lesson-times')openEditor('times');
    else if(effect.type==='load-student')openChooser();
    else if(['help','keyboard','about','report'].includes(effect.type))openModal(effect.type,effect.operation);
    else if(effect.type==='world-warning')notice(`${effect.mode===2?'Water':'Castle'} requires goal ${effect.mode===2?10:30} WPM.`);
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
  else if(command==='select-next'||command==='select-previous') {selection=1-selection;pointer={x:selection?157:78,y:184};}
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
function locationInCanvas(event) {const r=canvas.getBoundingClientRect();return {x:Math.floor((event.clientX-r.left)*320/r.width),y:Math.floor((event.clientY-r.top)*200/r.height)};}
canvas.addEventListener('pointermove',event=>{
  pointer=locationInCanvas(event);const hit=session.screen==='menu'?mainMenuHit(pointer.x,pointer.y):-1;
  canvas.style.cursor=session.screen==='menu'&&(pointer.y<8||hit>=0)?(hit>=0&&[1,2].includes(hit)&&!canSelectMode(hit+1,session.profile)?'not-allowed':'pointer'):'default';
});
// A fresh left press, not a click synthesized after a release or a right button.
canvas.addEventListener('pointerdown',event=>{
  if(stopped||session.audioPending)return;
  if(event.button===0) {
    if(!leftPressed)session.audio({type:'effect',id:8,file:0x149bc});
    leftPressed=true;
  }
  if(session.screen==='celebration'&&!session.suspended) {event.preventDefault();session.stepPresentation(0,now(),true);draw();return;}
  if(modal&&['report','about'].includes(modal.kind)) {event.preventDefault();modalEvent({pointer:locationInCanvas(event)});return;}
  if(event.button!==0)return;event.preventDefault();leftPressed=true;pointer=locationInCanvas(event);canvas.focus();
  if(modal)modalEvent({pointer});else if(studentUI)studentEvent({pointer});else if(chooser)chooserEvent({pointer});
  else if(session.screen==='menu') {pendingMenuPointer={...pointer};pumpMenu();}else if(session.screen==='results')resultsAction(resultHit(pointer.x,pointer.y));else if(session.active&&session.suspended)focusGame();
});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
window.addEventListener('pointerup',event=>{
  if(event.button===0)leftPressed=false;
  if(!stopped&&!session.audioPending&&!session.suspended&&session.screen==='celebration') {session.stepPresentation(0,now(),true);draw();}
});
window.addEventListener('pointercancel',()=>{leftPressed=false;});
function suspend() {browserAudio.stop('blur');leftPressed=false;if(!session.active&&!['startup','celebration'].includes(session.screen))return;session.suspend(true,now());flush();notice('Suspended by browser host. Focus game to resume.');draw();}
canvas.addEventListener('blur',suspend);window.addEventListener('blur',suspend);
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
// Unlock only on trusted gestures. Missed requests are never queued/replayed.
for(const type of ['pointerdown','keydown'])document.addEventListener(type,event=>{void browserAudio.unlock(event);},true);
document.querySelector('#audio-unlock').onclick=event=>{void browserAudio.unlock(event);};
document.querySelector('#host-mute').onclick=()=>{browserAudio.setMuted(!browserAudio.muted);showAudio();};
document.querySelector('#focus').onclick=focusGame;
document.querySelector('#suspend').onpointerdown=event=>{event.preventDefault();if(session.suspended)focusGame();else suspend();};
document.querySelector('#suspend').onclick=event=>{if(event.detail===0){if(session.suspended)focusGame();else suspend();}};
for(const id of ['new','edit','times'])document.getElementById(id).onclick=()=>openEditor(id);
document.querySelector('#load').onclick=()=>{if(session.active||session.audioPending||modal||studentUI||chooser)return;const name=document.querySelector('#students').value;if(!name){notice('Choose a saved student first.');return;}loadStudent(name);session.screen='menu';focusGame();};
// Explicit host form fallback. It does not claim DOS text editing or selection.
document.querySelector('#cancel').onclick=()=>{if(studentUI)studentEvent({key:27});};
form.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(studentUI)studentEvent({key:27});}});
form.addEventListener('submit',event=>{
  event.preventDefault();if(!studentUI)return;
  try {
    const values=Object.fromEntries(new FormData(form));let candidate=session.student;
    if(isNew) {const name=values.name.split('.')[0],existing=findName(name);candidate=existing===undefined?newStudent(name):normalizeStudent(Uint8Array.from(profiles.students[existing]));if(existing!==undefined){session.student=candidate;save();closeEditor();return;}values.name=name;}
    const old=session.profile.name;
    const edited=editStudent(candidate,Object.fromEntries(Object.entries(values).map(([k,v])=>[k,k==='name'?v:Number(v)])));
    if(!isNew&&values.name!==undefined&&values.name!==old)deleteStudent(old);
    session.student=edited;save();closeEditor();
  } catch(error) {notice(error.message);}
});
for(let i=1;i<=6;i++)form.elements.lesson.add(new Option(data.messages[299+i],i));
showAudio();refreshStudents();notice('Original menu: arrows/Enter, accelerators or pointer. Browser controls remain separate.');draw();
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
  if(session.screen==='results') {save();selection=0;notice(session.activity.aborted?'Activity ended early. Progression withheld. N Next · M Menu.':'Results. N Next · M Menu · F1 Help · F2 Keyboard.');}
  draw();
},1000/BIOS_HZ);
// Read-only authored verification. No mutation hooks or original code execution.
window.translationSnapshot=()=>({screen:session.screen,inputPending:session.input.pending(),profile:session.profile,result:session.result,suspended:session.suspended,
  menu:structuredClone(menu),studentUI:studentUI?{kind:studentUI.kind,field:studentUI.field,selection:studentUI.selection,caret:{...caret}}:null,
  chooser:structuredClone(chooser),modal:modal?{...modal,lines:undefined}:null,pointer:{...pointer},palette:renderer.palette,operations:renderer.operations,
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
