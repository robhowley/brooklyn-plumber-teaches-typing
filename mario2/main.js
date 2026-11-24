import {loadAssets} from './assets.js';
import {createRenderer} from './render.js';
import {createSetup} from './setup.js';
import {createStudentStore} from './storage.js';
import {createTyping,normalizeTypingKey,createRandom,seedFromCalendar} from './typing.js';
import {createMedia} from './media.js';
import {selectLesson,setupMovie,welcomeMovie} from './selection.js';

const canvas=document.querySelector('canvas'), status=document.querySelector('#status');
const error=document.querySelector('#error'), controls=document.querySelector('#controls');
const dialog=document.querySelector('#duplicate');
// Browser adaptation: explicit Windows-style endpoint colors, not historical OS pixel equality.
const low=[0,0,0,128,0,0,0,128,0,128,128,0,0,0,128,128,0,128,0,128,128,192,192,192,192,220,192,166,202,240];
const high=[255,251,240,160,160,164,128,128,128,255,0,0,0,255,0,255,255,0,0,0,255,255,0,255,0,255,255,255,255,255];
try {
  const assets=await loadAssets(new URL('./assets.json',import.meta.url));
  const setup=createSetup({store:createStudentStore(()=>window.localStorage),nameKeyFlags:assets.presentation.nameKeyFlags});
  const renderer=createRenderer(canvas,assets,{paletteEndpoints:{low,high}});
  let view, fixture=false, typing=null, movie=false, continuation=null, finished=false, focused=true, timer, musicSelector=1;
  const date=new Date();
  // Browser input mapping: local calendar tuple, recovered absent-TZ defaults.
  const random=createRandom(seedFromCalendar({year:date.getFullYear(),month:date.getMonth()+1,
    day:date.getDate(),hour:date.getHours(),minute:date.getMinutes(),second:date.getSeconds()}));
  const mediaStatus=document.createElement('p'); mediaStatus.id='media-status'; controls.before(mediaStatus);
  const context=new AudioContext();
  const media=createMedia({manifest:assets.manifest,manifestURL:new URL('./assets.json',import.meta.url),
    audioContext:context,emit(event){
      if(event.kind==='movie' && event.id!==media.snapshot().movie?.id) return;
      if(event.type==='frame') {mediaStatus.textContent='Movie '+event.selector+' playing';renderer.movieFrame(event);}
      else if(event.type==='ended'||event.type==='skipped') {
        if(event.kind!=='movie') return;
        movie=false; mediaStatus.textContent='Movie '+event.type; renderer.draw(); const next=continuation; continuation=null; next?.();
      } else if(event.type==='failed'||event.type==='autoplay-blocked')
        mediaStatus.textContent='Media '+event.type+': '+(event.message??'Use Enable audio / Retry or Skip movie.');
    }});
  function play(selector,next=()=>{}) {
    movie=true; continuation=next; mediaStatus.textContent='Movie '+selector+' loading.';
    media.playMovie(selector); // only terminal events continue, never this loading promise
  }
  const enable=document.createElement('button'); enable.textContent='Enable audio / Retry';
  enable.onclick=async()=>{if(await media.unlock()){
    if(musicSelector) media.audio(musicSelector,3);
    const clip=media.snapshot().movie;
    if(movie && clip) play(clip.selector,continuation);
  }};
  const skip=document.createElement('button'); skip.textContent='Skip movie'; skip.onclick=()=>media.skip();
  controls.before(enable,skip);
  function update(result) {
    if(result.effects.some(e=>e.type==='finish')) {
      finished=true; musicSelector=0; media.audio(0,0xc0);
    }
    display({...view,...result.view});
  }
  function startTyping() {
    const lesson=selectLesson(assets.manifest.lessons['lesson-'+'htbns'[view.keyset]],random);
    typing=createTyping({lesson,durationSeconds:view.durationSeconds,nowMs:performance.now()});
    update({view:typing.snapshot(),effects:[]});
    musicSelector=5; media.audio(0,0xc0); media.audio(5,3);
  }
  function startTimer() {
    clearInterval(timer);
    timer=setInterval(()=>{
      if(fixture||movie||finished||!view) return;
      if(view.state===21 && typing) update(typing.acceptedUpdate(performance.now()));
      renderer.visitOverlay({state:view.state,transition:0,movie:0,timerDelivered:true});
    },100);
  }
  window.addEventListener('blur',()=>{focused=false;clearInterval(timer);media.audio(0,0xc0);});
  // WINMARIO FILE 0x17166..0x17264 preserves the signed active selector
  // across blur, then reopens that selector with flags3 (not operation32).
  window.addEventListener('focus',()=>{if(!focused){focused=true;startTimer();if(musicSelector) media.audio(musicSelector,3);}});
  window.addEventListener('pagehide',()=>{clearInterval(timer);media.dispose();context.close();});
  const choices={
    1:[['New student',2],['Continue',39]],
    2:[['Mario',3,0],['Princess',3,1],['Luigi',3,2]],
    3:[['Confirm name',4]],4:[['Choose lesson plan',5]],
    5:[['Express',14,3]],
    14:['Home','Top','Bottom','Numbers','Symbols'].map((s,i)=>[s,17,i]),
  };
  function display(next) {
    const reenter=!view || view.state!==next.state ||
      (next.state===1 && Boolean(view.name)!==Boolean(next.name));
    view=next;
    if(view.state===21 && view.expectedByte!==undefined) canvas.setAttribute('aria-label','Next key: '+String.fromCharCode(view.expectedByte));
    else canvas.setAttribute('aria-label','Mario typing display');
    if(reenter) renderer.enter(view);
    else renderer.draw(view);
    status.textContent=fixture ? 'Renderer fixture only, no mechanics or statistics calculated.' :
      view.state===21 ? finished ? 'Finish handoff for I6. Report and progression are not implemented.' :
        'State 21 | Typed: '+(view.counters?.total??0)+' | Errors: '+(view.counters?.errors??0)+' | Elapsed: '+(view.elapsed??0) :
      'Setup state '+view.state+' | Name: '+(view.name||'(blank)')+' | Character: '+view.character+' | Keyset: '+view.keyset;
    error.textContent=view.storageError ? 'Persistence refused: '+view.storageError.message : '';
    controls.replaceChildren();
    if (!fixture) for (const [label,selector,argument] of choices[view.state]??[]) {
      const button=document.createElement('button');
      button.textContent=label;
      button.onclick=()=>dispatch({type:'select',selector,argument});
      controls.append(button);
    }
    if (view.state===3 && !fixture) {
      const hint=document.createElement('p');
      hint.textContent='Type a name (8 bytes maximum). Backspace edits; Enter confirms. Blank becomes NONAME.';
      controls.append(hint);
    }
    if(view.duplicate && !dialog.open) dialog.showModal();
    else if(!view.duplicate && dialog.open) dialog.close();
  }
  function dispatch(action){
    if(fixture||movie||finished) return;
    const old=view.state;
    display(setup.dispatch(action));
    if(view.state===21 && old!==21) startTyping();
    else if(view.state===5 && old!==5) play(setupMovie(assets.presentation.setupMovies,random));
    // FILE 0x15706..0x15728: keyset entry restores SELECT1 with operation32.
    else if(view.state===14 && old!==14) play(14,()=>{musicSelector=1;media.audio(0,0x20);});
  }
  dialog.querySelectorAll('button').forEach(b=>b.onclick=()=>dispatch({type:'duplicate-result',result:Number(b.value)}));
  dialog.addEventListener('cancel',event=>{event.preventDefault();dispatch({type:'duplicate-result',result:2});});
  window.addEventListener('keydown',event=>{
    if(fixture) return;
    if(movie){event.preventDefault();media.skip();return;}
    if(view.state===21 && typing && !finished && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const virtualKey=event.keyCode;
      update(typing.keyDown(normalizeTypingKey({virtualKey,shift:event.shiftKey,capsLock:event.getModifierState('CapsLock')})));
      return;
    }
    if(view.state!==3 || view.duplicate || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if(event.key==='Enter'){event.preventDefault();dispatch({type:'confirm-name'});}
    else if(event.key==='Backspace'){event.preventDefault();dispatch({type:'name-key',key:8,byte:8});}
    else if(event.key.length===1 && event.key.charCodeAt(0)<=255){
      event.preventDefault();dispatch({type:'name-key',key:event.key.charCodeAt(0),byte:event.key.charCodeAt(0)});
    }
  });
  canvas.addEventListener('click',event=>{
    if(movie){media.skip();return;}
    if(fixture || view.duplicate || finished) return;
    const bounds=canvas.getBoundingClientRect();
    const x=(event.clientX-bounds.left)*640/bounds.width, y=(event.clientY-bounds.top)*480/bounds.height;
    const hit=(assets.presentation.hotspots[view.state]??[]).find(({rectangle:[l,t,r,b]})=>x>=l&&x<=r&&y>=t&&y<=b);
    if(hit) dispatch({type:'select',selector:hit.selector,argument:hit.argument});
  });
  document.querySelector('#typing').onclick=()=>{fixture=true;display({state:21,rows:['SOURCE RENDER FIXTURE','asdf jkl;'],expectedByte:74,cursorColumn:2});};
  document.querySelector('#report').onclick=()=>{fixture=true;display({state:10,reportStrings:['FIXTURE','0','0','0','0','0']});};
  document.querySelector('#overlay').onclick=()=>renderer.visitOverlay({state:view.state,transition:0,movie:0,timerDelivered:true});
  document.querySelector('#setup').onclick=()=>{fixture=false;display(setup.snapshot());};
  display(setup.snapshot());
  // FILE 0x154e4..0x155b2: selection music before welcome speech.
  media.audio(1,3);
  startTimer(); play(welcomeMovie(random));
} catch (failure) {
  status.textContent='Unable to start.';
  error.textContent='Load refused: '+failure.message;
}
