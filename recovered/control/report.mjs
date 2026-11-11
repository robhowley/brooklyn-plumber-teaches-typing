import { normalizeStudent, readStudent, problemKeys } from './student.mjs';

// The small printf subset actually used by these callers (FILE 0xe764..0xe92f,
// 0x15d9c..0x16445, 0x15729). Values are passed as 16-bit C arguments.
export function sourceFormat(format, ...values) {
  let i=0;
  return format.replace(/%%|%(-)?(\d+)?(?:\.(\d+))?([us])/g,(match,left,width,precision,type)=>{
    if(match==='%%') return '%';
    const value=values[i++];
    let text=type==='u'?String(Number(value)&65535):String(value);
    if(type==='s' && precision!==undefined) text=text.slice(0,Number(precision));
    const n=Number(width)||0;
    return left?text.padEnd(n,' '):text.padStart(n,match.includes('%0')?'0':' ');
  });
}

// FILE 0xe446..0xe527. Reuse the signed ranking helper, not unsigned frequency
// sorting. The source copies MSD2100 then overwrites its first byte with NUL
// when no key was emitted, so the visible result really is empty, not "None!".
export function reportProblemKeys(studentBytes) { return problemKeys(studentBytes); }

// FILE 0xe67d gate; every student service normalizes before dispatch (0xe184).
export function reportProfile(studentBytes) {
  const profile=readStudent(normalizeStudent(studentBytes));
  return profile.profilePresent?{...profile,problemKeys:reportProblemKeys(studentBytes)}:null;
}

// Modal callers save/restore both the screen and font state. The host owns that
// saved image and return target. Report/About flush queued input on return;
// keyboard consumes its one pending key instead (0x14669..0x14677).
export function modalReturn(state,{key=null,pointerChanged=false,pointerEnabled=false}={}) {
  return key!==null || (pointerEnabled&&pointerChanged)
    ?{...state,closed:true,route:state.returnTo,flushInput:state.kind!=='keyboard'}:state;
}

// FILE 0x14655..0x1467f: F1 repeats the keyboard-screen wait; other keys
// close it. Do not open main-menu help while the keyboard screen owns input.
export function keyboardInput(state,event={}) {
  // Unlike Report/About's0x147f2 callback,0x14669 only polls a key.
  return event.key===null||event.key===undefined||event.key===0x13b?state:modalReturn(state,event);
}

// FILE0x21bdc..0x21be8 (DS:296c), consumed by0x15870..0x15886.
export function helpPointer(state) {
  return {x:[36,91,280][state.button],y:182};
}

// FILE 0x15507..0x155c4 counts CRs and uses only CR-terminated lines. EOF/SUB
// after the last CR is not another line. Tags are foreground colors, not fonts.
export function helpLines(text) {
  const lines=[];
  let start=0;
  for(let p=0;p<text.length;p++) if(text.charCodeAt(p)===13) {
    lines.push(text.slice(start,p)); start=p+2;
  }
  return lines;
}
export function openHelp(section,returnTo,text) {
  if(!Number.isInteger(section)||section<1) throw new RangeError('help section');
  return {kind:'help',section,returnTo,top:0,button:2,closed:false,
    available:typeof text==='string',lines:typeof text==='string'?helpLines(text):[]};
}
// FILE 0x1575f..0x158c7, decoded DOS key values. Pointer fields are physical x/y.
// Short documents expose an original negative-index bug. Clamp to zero here as
// a bounded host safety adaptation rather than reading before a pointer table.
export function helpInput(state,{key=null,x=0,y=0,leftButton=false,doneKey=68,quitAllowed=false}={}) {
  if(state.closed) return state;
  const out={...state}, max=Math.max(0,state.lines.length-18);
  let action=null;
  if(leftButton&&y>=178&&y<=188) {
    if(x>=17&&x<=56) action='down';
    else if(x>=72&&x<=111) action='up';
    else if(x>=261&&x<=300) action='done';
  }
  if(action===null) {
    if(key===doneKey||key===doneKey+32||key===27) action='done';
    else action=new Map([[9,'tab'],[13,'enter'],[68,'done'],[100,'done'],[301,'quit'],[327,'home'],[328,'up'],
      [329,'pageUp'],[331,'left'],[333,'tab'],[335,'end'],[336,'down'],[337,'pageDown']]).get(key);
  }
  if(action==='enter') action=['down','up','done'][out.button];
  switch(action) {
    case 'done':out.closed=true;out.route=out.returnTo;out.flushInput=true;break;
    case 'quit':if(quitAllowed) out.request='quit';break;
    case 'home':out.top=0;break;
    case 'end':out.top=max;break;
    case 'up':out.top=Math.max(0,out.top-1);break;
    case 'down':out.top=Math.min(max,out.top+1);break;
    case 'pageUp':out.top=Math.max(0,out.top-17);break;
    case 'pageDown':out.top=Math.min(max,out.top+17);break;
    case 'left':out.button=(out.button+2)%3;break;
    case 'tab':out.button=(out.button+1)%3;break;
  }
  return out;
}
