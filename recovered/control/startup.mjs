// MARIO.EXE FILE offsets. Static evidence: tools/control/startup-inspect.py.
import { titleDelay, menuRandomTimer, boundedRandom, s16 } from '../runtime/runtime.mjs';
import { normalizeStudent, readStudent } from './student.mjs';

const wait = (count, file) => ({type:'wait', service:0x192a2, count, file});
const draw = (family, name, x, y, extra={}) => ({type:'sprite',family,name,x,y,...extra});

// One acknowledgement is one completed source wait call, NOT one RAF or millisecond.
// Non-wait events run in source order. Input is checked only at original call sites.
export function createStartup({rng, input, option10=false, audioBoundary=()=>{}}) {
  if (!rng || !input) throw new TypeError('Shared RNG and pending-input FIFO required');
  const state={phase:'new',done:false,waiting:null};
  const exitKey = function* () {
    const key=input.consume();
    yield {type:'consume',key};
    if (key===0x12d && option10) yield {type:'quit-request',file:0x149fc};
    return key;
  };
  function* fade(from,to) {
    // Mode argument 0 at all four startup calls: no wait between palette writes.
    yield {type:'fade',from,to,steps:12,waitEach:false,file:0x14bb4};
  }
  function* run() {
    if (option10) { state.phase='complete'; return; } // 0xfbb6
    state.phase='logo';
    yield {type:'palette',name:'black',file:0xfbe7};
    yield {type:'scene',name:'LOGO',file:0xfbd0};
    yield* fade('black','LOGO');
    for(let i=0;i<57;i++) {
      yield wait(1,0xfc3b);
      if(input.pending()) break;
    }
    if(input.pending()) yield* exitKey();
    yield* fade('LOGO','purple'); // RGB6=(29,0,45), 0xfc80..0xfcdc
    yield {type:'palette',name:'purple',file:0xfd12};
    yield {type:'scene',name:'GREETBG',file:0xfcf6};
    yield* fade('purple','GREETBG');
    state.phase='zoom';
    let skipped=false;
    for(let i=19;i>=0;i--) {
      yield draw('zoom',i,160,100,{center:true,file:0x101f1});
      if(input.pending()) { yield* exitKey(); skipped=true; break; }
      yield wait(1,0x10247);
    }
    if(!skipped) {
      yield wait(19,0x10258);
      for(let i=1;i<=6;i++) {
        yield i===6 ? draw('GREET','lmario_1',7,2,{file:0x102fb})
          : draw('zoom',i,160-14*i,100-11*i,{center:true,file:0x102fb});
        if(input.pending()) { yield* exitKey(); skipped=true; break; }
        yield wait(1,0x10350);
      }
      if(!skipped) yield draw('zoom',7,7,3,{file:0x10388});
    }
    state.phase='letters';
    yield {type:'scene',name:'GREET',file:0xfd8d};
    // GREET sets palette directly, not a fade. 0xfddb -> 0x14d0b.
    yield {type:'palette',name:'GREET',file:0xfddb};
    for(let i=0;i<13;i++) {
      yield {type:'letter',index:i,file:0xff22};
      if(!input.pending()) {
        audioBoundary({type:'effect',id:1,file:0xff37});
        yield {type:'sound-request',id:1,file:0xff37};
        const delay=titleDelay(rng,false);
        yield wait(delay,0xff5c);
        if(i===6) yield wait(12,0xff6b);
      }
    }
    if(input.pending()) yield* exitKey();
    state.phase='hold';
    for(let i=0;i<114;i++) {
      if(input.pending()) {
        const key=yield* exitKey();
        if(key!==0x12d) break; // Alt-X option disabled continues the hold.
      }
      yield wait(1,0xfe1d);
    }
    yield* fade('GREET','black');
    yield {type:'release',file:0xfe61};
    state.phase='complete';
  }
  const iterator=run();
  function pump() {
    const events=[];
    while(!state.done) {
      const next=iterator.next();
      if(next.done) {state.done=true;state.waiting=null;break;}
      events.push(next.value);
      if(next.value.type==='wait') {state.waiting={...next.value};break;}
    }
    return events;
  }
  return {state, start() {
    if(state.phase!=='new') throw new Error('Startup already started');
    return pump();
  }, step({completedWaits=0}={}) {
    if(!Number.isInteger(completedWaits)||completedWaits<0) throw new RangeError('Completed source waits');
    if(state.phase==='new') throw new Error('Call start first');
    const events=[];
    while(completedWaits && state.waiting) {
      const n=Math.min(completedWaits,state.waiting.count);
      state.waiting.count-=n;completedWaits-=n;
      if(state.waiting.count===0) {state.waiting=null;events.push(...pump());}
    }
    return events;
  }};
}

// FILE 0x192a2 waits for BIOS INT1A/AH0 DX to differ from DS:4e2c.
// Missed changes are NOT queued. This adapter accepts observed low words only,
// never invents a frequency, and persists across startup and menu controllers.
export function createSourceWaitClock(lastLowTick=0) {
  if(!Number.isInteger(lastLowTick)||lastLowTick<0||lastLowTick>65535) throw new RangeError('BIOS low tick sample');
  const state={lastLowTick:lastLowTick&65535};
  function sample(controller,lowTick,context={}) {
    if(!Number.isInteger(lowTick)||lowTick<0||lowTick>65535) throw new RangeError('BIOS low tick sample');
    if(!controller.state.waiting||lowTick===state.lastLowTick) return [];
    const events=controller.step({...context,completedWaits:1});
    state.lastLowTick=lowTick;
    return events;
  }
  return {state,sample,reset(lowTick) {
    if(!Number.isInteger(lowTick)||lowTick<0||lowTick>65535) throw new RangeError('BIOS low tick sample');
    state.lastLowTick=lowTick;
  }};
}

// DS:4833/4837 survive menu reentry, initialized zero, not set by 0x10ce3.
export const createMenuIdleState = () => ({lastTicks:0,delayTicks:0});
export function createMenuIdle({rng,input,timer,nowTicks,demo=false}) {
  if(!timer) throw new TypeError('Persistent menu timer required');
  if(!Number.isInteger(nowTicks)) throw new TypeError('Explicit source tick sample required');
  const state={idleSince:nowTicks|0,demoSeen:false,demoActive:demo,blink:false,bubble:false,waiting:null};
  let sequence=[];
  function drain() {
    const events=[];
    while(sequence.length) {
      const event=sequence.shift();events.push(event);
      if(event.type==='wait') {state.waiting={...event};break;}
    }
    return events;
  }
  input.flush(); // 0x10dd8, return-to-menu clears unread lesson/demo keys.
  return {state,
    step({nowTicks,demo:activeDemo=state.demoActive,fileDropdownOpen=false,completedWaits=0}={}) {
      const events=[];
      if(!Number.isInteger(nowTicks)) throw new TypeError('Explicit source tick sample required');
      if(!Number.isInteger(completedWaits)||completedWaits<0) throw new RangeError('Completed source waits');
      if(state.waiting) {
        while(completedWaits && state.waiting) {
          const n=Math.min(completedWaits,state.waiting.count);
          state.waiting.count-=n;completedWaits-=n;
          if(state.waiting.count===0) {state.waiting=null;events.push(...drain());}
        }
        if(!state.waiting) state.idleSince=nowTicks|0; // outer loop returns through 0x10ddd
        return events;
      }
      // Called by 0x148aa's callback (0x10b31) before the outer menu consumes keys.
      if(menuRandomTimer(timer,rng,nowTicks)) state.blink=true;
      if((state.idleSince!==-1 && ((nowTicks-state.idleSince)|0)>90) || (activeDemo&&!state.demoSeen)) {
        state.idleSince=-1;state.bubble=true;
      }
      state.demoSeen=activeDemo;state.demoActive=activeDemo;
      if(state.bubble) {
        state.bubble=false;state.idleSince=nowTicks|0;
        events.push({type:'menu-bubble-request',demo:activeDemo,file:0x1072f});
      } else if(state.blink) {
        state.blink=false;
        if(fileDropdownOpen) state.idleSince=nowTicks|0;
        else {
          sequence=[wait(1,0x10c50),draw('GREET2','eyes0044_halfway',50,47),
            wait(1,0x10c79),draw('GREET2','eyes0043_closed',50,47),wait(2,0x10cae),
            draw('GREET2','eyes0042_open',50,47)];
          events.push(...drain());
        }
      }
      return events;
    },
    // 0x10ddd is reached again after any processed key/pointer event too.
    restartPump(nowTicks) {
      if(!Number.isInteger(nowTicks)) throw new TypeError('Explicit source tick sample required');
      if(state.waiting) throw new Error('Menu blink still waiting');
      state.idleSince=nowTicks|0;
    },
    // Host clock replacement is explicit. Preserve elapsed time, never treat a
    // reset clock as a huge unsigned gap and never reseed on presentation return.
    rebaseClock(oldTicks,newTicks) {
      if(!Number.isInteger(oldTicks)||!Number.isInteger(newTicks)) throw new TypeError('Explicit source tick samples required');
      const delta=(newTicks-oldTicks)|0;
      timer.lastTicks=(timer.lastTicks+delta)|0;
      if(state.idleSince!==-1) state.idleSince=(state.idleSince+delta)|0;
    }
  };
}

// 0xe3bc changes only normalized name/demo/profile fields, not world/group/goal.
export function demoStudent(bytes) {
  const out=normalizeStudent(bytes);out.fill(0,4,9);out.set([68,101,109,111],4);
  out[27]=1;out[28]=0;return out;
}

// No invented attract course or AI. Caller selects an original world and passes
// its actual target at its original input-dispatch point, after world updates.
export function createDemo({student,rng,input,mode,lowTick=0,option10=false}) {
  const profile=readStudent(student);
  if(!profile.demo||profile.profilePresent) throw new Error('Explicit Demo profile required (unsaved); Guest is not Demo');
  if(![1,2,3,4].includes(mode)) throw new RangeError('Demo world');
  const selectedStudent=student.slice();
  new DataView(selectedStudent.buffer,selectedStudent.byteOffset,selectedStudent.byteLength).setInt16(15,mode,true);
  const state={mode,countdown:30,lastLowTick:lowTick&65535,done:false};
  return {state,
    poll({target,targetPresent=true,lowTick=state.lastLowTick}={}) {
      if(state.done) throw new Error('Demo has returned');
      if((mode!==1||targetPresent)&&(!Number.isInteger(target)||target<-32768||target>32767))
        throw new RangeError('Actual source target required');
      let key=0,synthetic=false,physicalKeyRead=false;
      if(mode===4 && (lowTick&65535)!==state.lastLowTick) {
        state.lastLowTick=lowTick&65535;state.countdown=s16(state.countdown-1); // 0xb5b2
      }
      if(mode===1 && input.pending()) {key=input.consume();physicalKeyRead=true;} // BEFORE replacement
      if(state.countdown===0 && (mode!==1 || targetPresent)) {
        key=mode===4 && target===0?13:target;synthetic=true;
        state.countdown=(mode===1?10:1)+boundedRandom(rng,mode===1?10:mode===2?5:3);
      } else if(mode!==4 && state.countdown!==0) state.countdown=s16(state.countdown-1);
      if(mode!==1 && key===0 && input.pending()) {key=input.consume();synthetic=false;physicalKeyRead=true;}
      const abort=mode===3?(key===27):mode===4?(key===27):(key===27||key===0x144);
      return {type:'demo-key',key,synthetic,physicalKeyRead,abort,quitRequest:key===0x12d && option10,
        resetInactivity:mode===1?physicalKeyRead:(mode===2||mode===3)&&(physicalKeyRead||key!==0)};
    },
    finish() {
      if(state.done) throw new Error('Demo already returned');
      state.done=true;input.flush(); // next menu 0x10d04/0x10dd8, not a fake results screen
      const out=selectedStudent.slice();out[27]=0;
      return {type:'menu-return',student:out,suppressResults:true,resetHostClock:true};
    }
  };
}
