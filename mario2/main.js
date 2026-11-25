import {createOutside} from './outside.js';
import {createStartup} from './startup.js';
import {loadAssets} from './assets.js';
import {createRenderer} from './render.js';
import {createSetup} from './setup.js';
import {createStudentStore} from './storage.js';
import {createTyping,normalizeTypingKey,createRandom,seedFromCalendar} from './typing.js';
import {createMedia} from './media.js';
import {calculateReport} from './report.js';
import {selectLesson,setupMovie,welcomeMovie,reportMovie} from './selection.js';

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
  let outside=null, intervalMs=100, specialHold=false, pendingTimer=false, outsideSpeech=false;
  const outsideStories=new Set();
  const heldEvents=[];
  let view, fixture=false, typing=null, movie=false, continuation=null, finished=false, focused=true, timer, musicSelector=0, startup;
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
  const skip=document.createElement('button'); skip.textContent='Skip movie'; skip.onclick=()=>startup?.active() ? startup.skip() : media.skip();
  controls.before(enable,skip);
  const quit=document.createElement('dialog');
  quit.setAttribute('aria-label','Quit confirmation (resource624)');
  quit.innerHTML='<p>Quit?</p><button value="2" autofocus>Yes</button><button value="1">No</button>';
  document.body.append(quit);
  const deletion=document.createElement('dialog');
  deletion.setAttribute('aria-label','Delete student (resource626)');
  deletion.innerHTML='<p></p><button value="1" autofocus>OK</button><button value="2">Cancel</button>';
  document.body.append(deletion);
  deletion.querySelectorAll('button').forEach(b=>b.onclick=()=>dispatch({type:'delete-result',result:Number(b.value)}));
  deletion.addEventListener('cancel',event=>{event.preventDefault();dispatch({type:'delete-result',result:2});});
  let quitApplication=false, exited=false, terminal=false;
  function exit() {
    exited=true; musicSelector=0; clearInterval(timer); media.dispose();
    controls.replaceChildren(); status.textContent='Application exited. Reload to start again.';
  }
  function confirmQuit(application=false) {
    if(specialHold) {heldEvents.push(()=>confirmQuit(application));return;}
    if(certificate.open) return;
    if(terminal||exited) return;
    quitApplication=application; quit.showModal(); quit.querySelector('[value="2"]').focus();
  }
  function quitResult(yes) {
    quit.close();
    if(!yes) return;
    intervalMs=100;startTimer();
    if(quitApplication) {setup.welcome();musicSelector=0;media.audio(0,0xc0);play(40,exit);}
    else {
      // WINMARIO FILE 0x1ce8c teardown stops audio; 0x1476a..0x14a3b returns to Welcome with operation32.
      media.audio(0,0xc0); finished=false; musicSelector=1;
      display(setup.welcome());media.audio(0,0x20);
    }
  }
  quit.querySelectorAll('button').forEach(b=>b.onclick=()=>quitResult(b.value==='2'));
  quit.addEventListener('cancel',event=>{event.preventDefault();quitResult(true);});
  function update(result) {
    if(view.state===18) {
      for(const effect of result.effects) {
        if(effect.type==='interval') {intervalMs=effect.milliseconds;startTimer();}
        if(effect.type==='audio') media.audio(effect.selector,effect.operation);
        if(effect.type==='background') renderer.outsideBackground(effect.bitmap);
        if(effect.type==='special-playback') specialPlayback(effect).catch(failure=>{
          // Browser refusal: keep the transaction held until reload, but release
          // audio and queued work. Never manufacture source completion on error.
          clearInterval(timer); musicSelector=0; media.audio(0,0xc0);
          heldEvents.length=0; pendingTimer=false;
          error.textContent='Outside special refused: '+failure.message+' Reload to restart.';
          // No synthetic completion or saved progression after a bad plane.
        });
      }
    }
    if(result.effects.some(e=>e.type==='finish') && !finished) {
      finished=true; musicSelector=0; media.audio(0,0xc0);
      const report=calculateReport(result.view), prior=setup.reportContext();
      display(setup.beginReport(report));
      play(reportMovie({speed:report.speed,...prior},random),()=>{
        display({...view,reportStrings:report.reportStrings});
        musicSelector=(report.speed&65535)>=(prior.threshold&65535)?7:8;
        media.audio(0,0xc0);media.audio(musicSelector,3);
        const next=setup.finishReport(); terminal=!!next.terminal;
        display({...next,reportStrings:report.reportStrings});
      });
      return;
    }
    display({...view,...result.view,...(view.state===18?{outsideOperations:result.effects}: {})});
  }
  // FILE 0x1a970..0x1a997 has no message pump. Browser pacing holds the
  // transaction; input/focus wait, timer notifications coalesce, not catch up.
  async function specialPlayback(effect) {
    specialHold=true;
    const stem='MPL'[effect.character]+'OUT';
    const bans=assets.outsideAnimations.get(stem+'.BAN'), anis=assets.outsideAnimations.get(stem+'.ANI');
    media.audio(17,1);let n=0,iteration=0;
    for(const ban of bans) {
      if(ban.empty) continue;
      await new Promise(requestAnimationFrame);
      iteration++;
      if(effect.audio.cues.includes(iteration)) media.audio(17,2);
      renderer.outsideSpecial(ban,anis[n++]);
    }
    media.audio(17,4);media.audio(17,8);
    update(outside.finishSpecial());specialHold=false;
    while(heldEvents.length) heldEvents.shift()();
    if(pendingTimer) {pendingTimer=false;if(focused&&!document.hidden&&view.state===18&&!movie&&!quit.open) update(outside.acceptedUpdate(performance.now()));}
  }
  const certificate=document.createElement('dialog');
  certificate.setAttribute('aria-label','Mario Teaches Typing 2');
  // FILE 0x1de2f..0x1de47, valid Beginning relocation FILE 0x25e18.
  certificate.innerHTML='<p>Congratulations!  You have just passed the beginning level.\nTo print your certificate, click on OPTIONS, then click on\nPRINT CERTIFICATE.</p><button>OK</button>';
  document.body.append(certificate);
  function certificateReturn(){certificate.close();display({...setup.certificateReturn(),reportStrings:view.reportStrings});}
  certificate.querySelector('button').onclick=certificateReturn;
  certificate.addEventListener('cancel',e=>{e.preventDefault();certificateReturn();});
  function enterOutside() {
    // FILE 0x157a4..0x1592e and shared story return FILE 0x15d8f.
    display({...view,bitmap:616,outsideOperations:undefined});renderer.outsideBackground(616);
    function speech(){
      let selector=47;
      if(outsideSpeech) {
        const index=random.next()%(view.character===0?7:8);
        selector=index===7?(view.character===2?69:70):assets.presentation.outsideRepeatSpeech[index];
      }
      outsideSpeech=true;play(selector,startOutside);
    }
    const story=view.keyset===0?2:view.keyset===3?3:null;
    if(story && !outsideStories.has(story)) {outsideStories.add(story);play(story,speech);}
    else speech();
  }
  function startOutside() {
    renderer.outsideBackground(120);
    view={...view,bitmap:120};
    let result;
    try {
      const lesson=selectLesson(assets.manifest.lessons['lesson-'+'htbns'[view.keyset]],random);
      const args={lesson,character:view.character,keyset:view.keyset,durationSeconds:view.durationSeconds,nowMs:performance.now()};
      result=outside ? outside.reenter(args) : null;
      if(!outside) outside=createOutside({...args,animation:assets.presentation.outsideAnimation,random});
    } catch(failure) {
      // /MARIO/WINMARIO.EXE;1 SHA256
      // 39a4fb53384afbfec13063c2f4c67d51013b1f8ea494788c88f1ac6c12f47f22:
      // FILE 0x1590e..0x15926 takes 03:09b0 on loader failure, not 03:648a.
      // Browser adaptation: refuse this entry and require reload, without
      // ticking, teardown/report writers or fabricated successful completion.
      console.error('Outside entry refused',failure);
      continuation=null;movie=false;heldEvents.length=0;pendingTimer=false;
      exit();
      document.querySelectorAll('details button').forEach(button=>button.disabled=true);
      status.textContent='Outside entry refused. Reload to retry.';
      error.textContent='Outside entry refused: '+failure.message;
      const reload=document.createElement('button');reload.textContent='Reload to retry';
      reload.onclick=()=>window.location.reload();controls.append(reload);
      return;
    }
    setup.beginTyping();
    finished=false;musicSelector=2;
    update(result??{view:outside.snapshot(),effects:outside.entryEffects});
  }
  function startTyping() {
    setup.beginTyping();
    const lesson=selectLesson(assets.manifest.lessons['lesson-'+'htbns'[view.keyset]],random);
    const args={lesson,durationSeconds:view.durationSeconds,nowMs:performance.now()};
    if(typing) typing.reenter(args);
    else typing=createTyping(args);
    finished=false;
    update({view:typing.snapshot(),effects:[]});
    musicSelector=5; media.audio(0,0xc0); media.audio(5,3);
  }
  function startTimer() {
    clearInterval(timer);
    timer=setInterval(()=>{
      if(specialHold) {pendingTimer=true;return;}
      if(document.hidden||exited||terminal||quit.open||certificate.open) return;
      if(startup?.active()) {startup.tick();return;}
      if(fixture||movie||!view) return;
      if(view.state===18 && outside) update(outside.acceptedUpdate(performance.now()));
      if(view.state===21 && typing) update(typing.acceptedUpdate(performance.now()));
      renderer.visitOverlay({state:view.state,transition:0,movie:0,timerDelivered:true});
    },intervalMs);
  }
  function blur(){if(exited) return;focused=false;clearInterval(timer);media.audio(0,0xc0);}
  window.addEventListener('blur',()=>{if(specialHold) heldEvents.push(blur);else blur();});
  // WINMARIO FILE 0x17166..0x17264 preserves the signed active selector
  // across blur, then reopens that selector with flags3 (not operation32).
  function focus(){if(exited) return;if(!focused){focused=true;startTimer();if(musicSelector) media.audio(musicSelector,3);}}
  window.addEventListener('focus',()=>{if(specialHold) heldEvents.push(focus);else focus();});
  window.addEventListener('pagehide',()=>{clearInterval(timer);media.dispose();context.close();});
  const choices={
    1:[['New student',2],['Continue',39,28],['Load student',6]],
    2:[['Mario',3,0],['Princess',3,1],['Luigi',3,2]],
    3:[['Confirm name',4]],4:[['Choose lesson plan',5]],
    5:[['Beginning',14,0],['Express',14,3]],
    6:[['Back to Welcome screen',1]],
    10:[['Repeat',39]],
    14:['Home','Top','Bottom','Numbers','Symbols'].map((s,i)=>[s,17,i]),
  };
  function display(next) {
    const reenter=!view || view.state!==next.state ||
      (next.state===1 && Boolean(view.displayName??view.name)!==Boolean(next.displayName??next.name));
    view=next;
    if([18,21].includes(view.state) && view.expectedByte!==undefined) canvas.setAttribute('aria-label','Next key: '+String.fromCharCode(view.expectedByte));
    else canvas.setAttribute('aria-label','Mario typing display');
    if(reenter) renderer.enter(view);
    else renderer.draw(view);
    status.textContent=fixture ? 'Renderer fixture only, no mechanics or statistics calculated.' :
      terminal ? 'Browser adaptation: certificate unavailable; progression stopped.' :
      view.state===10 ? 'Report | '+view.reportStrings?.join(' | ') :
      view.state===19 ? 'Water entry pending Phase4. No substitute lesson is started.' :
      [18,21].includes(view.state) ?
        'State '+view.state+' | Typed: '+(view.counters?.total??0)+' | Errors: '+(view.counters?.errors??0)+' | Elapsed: '+(view.elapsed??0) :
      'Setup state '+view.state+' | Name: '+(view.name||'(blank)')+' | Character: '+view.character+' | Keyset: '+view.keyset;
    error.textContent=view.storageError ? 'Persistence refused: '+view.storageError.message : view.listError??'';
    controls.replaceChildren();
    if (!fixture && !terminal) for (const [label,selector,argument] of choices[view.state]??[]) {
      const button=document.createElement('button');
      button.textContent=label;
      button.onclick=()=>dispatch({type:'select',selector,argument});
      controls.append(button);
    }
    if(view.state===6 && !fixture && !terminal) {
      for(const [label,x,y] of [['Scroll up',610,100],['Scroll down',610,300],['Load selected student',300,440],['Delete selected student',450,440]]) {
        const button=document.createElement('button');button.textContent=label;
        button.onclick=()=>dispatch({type:'list-click',x,y});controls.append(button);
      }
      (view.students??[]).forEach((name,i)=>{
        const button=document.createElement('button');button.textContent='Preview '+name;
        button.onclick=()=>dispatch({type:'list-click',x:370,y:80+16*i});controls.append(button);
      });
    }
    if(view.certificatePending && !certificate.open) certificate.showModal();
    if(view.deletePrompt && !deletion.open) {deletion.querySelector('p').textContent=view.deletePrompt.message;deletion.showModal();}
    else if(!view.deletePrompt && deletion.open) deletion.close();
    if(!fixture && !terminal) {
      for(const [label,application] of [['Quit to Welcome',false],['Quit application',true]]) {
        const button=document.createElement('button');button.textContent=label;
        button.onclick=()=>{if(movie){media.skip();return;}confirmQuit(application);};controls.append(button);
      }
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
    if(specialHold) {heldEvents.push(()=>dispatch(action));return;}
    if(startup?.active()) {startup.skip();return;}
    if(fixture||quit.open||certificate.open||terminal||exited) return;
    if(movie){media.skip();return;}
    if(action.type==='select' && action.selector===16){confirmQuit(true);return;}
    if(!setup.accepts(action)) return;
    // Accepted menu actions share the pre-audio display-string gate on canvas and buttons.
    if(action.type==='select') media.audio(10,3);
    const old=view.state;
    display(setup.dispatch(action));
    if(view.state===1 && old===6) {musicSelector=1;media.audio(0,0x20);}
    else if(view.state===18 && old!==18) enterOutside();
    else if(view.state===21 && old!==21) startTyping();
    else if(view.state===5 && old!==5) play(setupMovie(assets.presentation.setupMovies,random));
    // FILE 0x15706..0x15728: keyset entry restores SELECT1 with operation32.
    else if(view.state===14 && old!==14) play(14,()=>{musicSelector=1;media.audio(0,0x20);});
  }
  dialog.querySelectorAll('button').forEach(b=>b.onclick=()=>dispatch({type:'duplicate-result',result:Number(b.value)}));
  dialog.addEventListener('cancel',event=>{event.preventDefault();dispatch({type:'duplicate-result',result:2});});
  window.addEventListener('keydown',event=>{
    if(specialHold) {
      event.preventDefault();
      // Copy immutable browser key properties, not the dispatched Event.
      const key=new KeyboardEvent('keydown',{key:event.key,keyCode:event.keyCode,shiftKey:event.shiftKey,ctrlKey:event.ctrlKey,altKey:event.altKey,metaKey:event.metaKey,repeat:event.repeat,modifierCapsLock:event.getModifierState('CapsLock')});
      heldEvents.push(()=>window.dispatchEvent(key));return;
    }
    if(startup?.active()) {event.preventDefault();startup.skip();return;}
    if(fixture||terminal||exited) return;
    if(movie){event.preventDefault();media.skip();return;}
    if(quit.open) {
      if(event.key==='Escape'){event.preventDefault();quitResult(true);}
      else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
        event.preventDefault();quit.querySelector(document.activeElement.value==='2'?'[value="1"]':'[value="2"]').focus();
      }
      return;
    }
    if(deletion.open) return;
    // Let the modal's native Escape cancel reach certificateReturn before quit handling.
    if(certificate.open) return;
    if(event.key==='Escape'){event.preventDefault();if(view.state===1)exit();else confirmQuit();return;}
    if(view.state===18 && outside && !finished && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();update(outside.keyDown(normalizeTypingKey({virtualKey:event.keyCode,shift:event.shiftKey,capsLock:event.getModifierState('CapsLock')})));return;
    }
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
    if(startup?.active()) {startup.skip();return;}
    if(movie){media.skip();return;}
    if(fixture || view.duplicate || quit.open || terminal || exited) return;
    const bounds=canvas.getBoundingClientRect();
    const x=(event.clientX-bounds.left)*640/bounds.width, y=(event.clientY-bounds.top)*480/bounds.height;
    if(deletion.open) return;
    const hit=(assets.presentation.hotspots[view.state]??[]).find(({rectangle:[l,t,r,b]})=>x>=l&&x<=r&&y>=t&&y<=b);
    if(view.state===6 && !hit) {dispatch({type:'list-click',x,y});return;}
    if(hit) {
      dispatch({type:'select',selector:hit.selector,argument:hit.argument});
    }
  });
  document.querySelector('#typing').onclick=()=>{fixture=true;display({state:21,rows:['SOURCE RENDER FIXTURE','asdf jkl;'],expectedByte:74,cursorColumn:2});};
  document.querySelector('#report').onclick=()=>{fixture=true;display({state:10,reportStrings:['FIXTURE','0','0','0','0','0']});};
  document.querySelector('#overlay').onclick=()=>renderer.visitOverlay({state:view.state,transition:0,movie:0,timerDelivered:true});
  document.querySelector('#setup').onclick=()=>{fixture=false;display(setup.snapshot());};
  // Existing fixture controls cannot bypass the startup handoff.
  document.querySelectorAll('details button').forEach(button=>button.disabled=true);
  startup=createStartup({
    backdrop(bitmap){view={state:0,bitmap};renderer.enter(view);controls.replaceChildren();status.textContent='Startup '+(bitmap===485?'LOGO':'INTRO');},
    play,
    close(){movie=false;continuation=null;media.closeMovie();},
    fade:renderer.fade,restore:renderer.restore,
    welcome(){
      document.querySelectorAll('details button').forEach(button=>button.disabled=false);
      display(setup.snapshot());
      // FILE 0x154e4..0x155b2: selection music before existing welcome speech.
      media.audio(10,1);musicSelector=1;media.audio(1,3);play(welcomeMovie(random));
    },
  });
  startTimer();
} catch (failure) {
  status.textContent='Unable to start.';
  error.textContent='Load refused: '+failure.message;
}
