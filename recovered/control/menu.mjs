// Static translation only. FILE offsets/member hashes: tools/control/menu-inspect.py.
import { mainMenuCommand, mainMenuHit, menuNavigation, nextRoute } from './flow.mjs';
import { newStudent, normalizeStudent, readStudent, STUDENT_SIZE } from './student.mjs';
import { s16 } from './scoring.mjs';

export const MENU_COMMANDS = Object.freeze([
  ['about','help','demo','keyboard','toggle-music','toggle-sound','toggle-speech','quit'],
  ['new-student','load-student','edit-student','lesson-times','certificate'],
  Array.from({length:6},(_,i)=>`lesson-${i+1}`),
]);
const upper = key => key>=97 && key<=122 ? key-32 : key;
const inside = (x,y,[a,b,c,d]) => x>=a && y>=b && x<c && y<d;
const word = (bytes,offset,value) => new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).setInt16(offset,s16(value),true);
const setName = (bytes,name) => {
  const length=Math.min(8,name.length);
  for(let i=0;i<length;i++) bytes[4+i]=name.charCodeAt(i);
  bytes[4+length]=0; // strcpy leaves the bytes after this terminator untouched.
};

// 0x14fd6..0x14ff7 checks a low-word LINEAR address, not independent x/y clipping.
export function menuPixel(front,x,y) {
  const offset=(s16(y)*320+s16(x))&0xffff;
  return offset<64000 ? front[offset] : 0;
}
// 0x10e66..0x10eb7 and 0x110ce..0x1111a. Inner loop breaks, outer continues.
export function menuWelcomeHit(front,x,y) {
  if(!(front instanceof Uint8Array) || front.length!==64000) throw new RangeError('320x200 indexed menu required');
  for(let dx=-3;dx<4;dx++) for(let dy=-3;dy<4;dy++) if(menuPixel(front,s16(x+dx),s16(y+dy))===88) return true;
  return false;
}
// MARIO.EXE FILE 0x10d9f..0x10dc4, guest position then profile override.
export function createMenu({options=0,profilePresent=false}={}) { return {column:1,row:0,options,pointer:profilePresent?{x:267,y:175}:{x:160,y:100}}; }

// One pump iteration. A pending key wins over pointer input (0x10e1c..0x10e46).
// pointer is a source press edge, not hover; caller maps browser coordinates explicitly.
export function menuInput(state,{key=0,pointer=null,front=null,messages={}}={},profile={}) {
  const s={...state,pointer:{...state.pointer}}, effects=[];
  let command='none';
  if(key) {
    const localized=[[10008,'about'],[10014,'help'],[10009,'demo'],[10016,'keyboard'],[10010,'toggle-music'],[10011,'toggle-sound'],[10012,'toggle-speech'],[10013,'quit'],[10004,'new-student'],[10007,'load-student'],[10006,'edit-student'],[10015,'lesson-times'],[10005,'certificate'],[10003,'next']];
    command=localized.find(([id])=>messages[id] && upper(key)===messages[id].charCodeAt(0))?.[1]??mainMenuCommand(key);
  } else if(pointer) {
    const x=s16(pointer.x),y=s16(pointer.y); s.pointer={x,y};
    // Palette interception precedes both bar and dropdown/lesson geometry.
    if(!front) throw new TypeError('Pointer menu dispatch requires the displayed indexed raster');
    if(menuWelcomeHit(front,x,y)) return {state:s,effects:[{type:'sound-request',name:'welcome'}]};
    if(y<8) {
      const column=x>16&&x<64?1:x>104&&x<184?2:x>224&&x<296?3:0;
      s.row=0;
      if(column) {s.column=column;s.row=1;}
      return {state:s,effects};
    }
    if(s.row) {
      const bounds=[[24,128,8],[112,208,5],[200,352,6]][s.column-1];
      const row=Math.trunc(y/8);
      if(x>bounds[0]&&x<bounds[1]&&row>=1&&row<=bounds[2]) {
        s.row=row;command=MENU_COMMANDS[s.column-1][row-1];
      }
      s.row=0; // Clicking outside an open dropdown closes, never selects a world.
    } else {
      const hit=mainMenuHit(x,y);
      if(hit>=0) command=['outdoor','water','castle','practice','report','next'][hit];
      else if(x>=50&&x<=75&&y>=47&&y<=66) effects.push({type:'incomplete',command:'menu-character-animation'});
    }
  }
  if(command==='activate-menu'&&s.row) command=MENU_COMMANDS[s.column-1][s.row-1];
  else if(['activate-menu','close-menu','menu-up','menu-down','menu-left','menu-right'].includes(command)) {
    Object.assign(s,menuNavigation(s,command)); return {state:s,effects};
  }
  const mode=['outdoor','water','castle','practice'].indexOf(command)+1;
  if(mode) {
    // Browser adaptation: all activities are selectable at any goal.
    // Intentionally omit MARIO.EXE FILE 0x11465..0x114ce goal gates.
    effects.push({type:'start',mode});
  } else if(command==='next') {
    if(!profile.demo) effects.push({type:'start',...nextRoute(profile)});
  } else if(command.startsWith('lesson-') && command!=='lesson-times') {
    effects.push({type:'set-lesson',lesson:Number(command.slice(7))},{type:'save-student'});s.row=0;
  } else if(command.startsWith('toggle-')) {
    const bit={'toggle-music':1,'toggle-sound':2,'toggle-speech':4}[command];
    s.options^=bit; effects.push({type:'options',value:s.options});
  } else if(command==='report'||command==='edit-student') {
    if(profile.profilePresent) effects.push({type:command});
  } else if(command==='help') effects.push({type:'help',operation:1});
  else if(command==='quit') effects.push({type:'quit-request',hostCanExit:false});
  else if(command==='certificate') effects.push({type:'certificate-request',hostCanPrint:false});
  else if(['new-student','load-student','demo','lesson-times','about','keyboard'].includes(command)) effects.push({type:command});
  else if(!['none','unrecognized'].includes(command)) effects.push({type:'incomplete',command});
  // Explicit close calls, not a blanket modal-close policy (0x113d1..0x11598).
  const activatedRow=(key===13||key===32)&&state.row;
  if(['help','keyboard','new-student','load-student','demo','edit-student','about','quit','toggle-music','toggle-sound','toggle-speech'].includes(command)&&effects.length &&
      !(activatedRow&&['about','edit-student'].includes(command))) s.row=0;
  return {state:s,effects};
}

// 0x1b0de passes4/2 to0x1aced; each countdown step waits for a
// changed LOW BIOS tick at0x192a2. The host supplies the shared wait observation.
export function createTextCursor(tick=0) { return {tick:tick&65535,left:0,inverted:false}; }
export function textCursorTick(cursor,tick) {
  tick&=65535;
  if(tick===cursor.tick)return cursor;
  const out={...cursor,tick,left:cursor.left-1};
  if(out.left<=0) {out.inverted=!out.inverted;out.left=out.inverted?4:2;}
  return out;
}

// 0x1af30 flags: name=0103, goal/minutes=2002. No guessed Tab/word navigation.
export function createTextField(value,maxLength,flags) {
  return {text:String(value).slice(0,maxLength),cursor:flags&0x1000?Math.min(String(value).length,maxLength):0,
    maxLength,flags,insert:!(flags&0x4000),first:true,done:false,key:0};
}
export function textFieldInput(field,key) {
  if(field.done) return field;
  const s={...field};
  if([13,27,0x148,0x149,0x150,0x151].includes(key)||(key>=0x13b&&key<=0x144)) {s.done=true;s.key=key;}
  else if(key===0x147) s.cursor=0;
  else if(key===0x14f) s.cursor=s.text.length;
  else if(key===0x14b) s.cursor=Math.max(0,s.cursor-1);
  else if(key===0x14d) s.cursor=Math.min(s.text.length,s.cursor+1);
  else if(key===0x152) s.insert=!s.insert;
  else if(key===8 || key===0x153) {
    if(key===8 && s.cursor>0) s.cursor--;
    else if(key===8) {s.first=false;return s;}
    if(s.cursor<s.maxLength) s.text=s.text.slice(0,s.cursor)+s.text.slice(s.cursor+1);
  } else if(key>=32&&key<127&&s.cursor<s.maxLength) {
    const letter=(key>=65&&key<=90)||(key>=97&&key<=122),digit=key>=48&&key<=57;
    if((letter&&s.flags&1)||(digit&&s.flags&2)||(!letter&&!digit&&s.flags&4)||(key===32&&s.flags&8)) {
      if(s.cursor===0&&s.first&&s.flags&0x2000) s.text='';
      if(letter&&s.flags&0x100) key=upper(key);
      if(letter&&s.flags&0x200&&key>=65&&key<=90) key+=32;
      s.text=(s.text.slice(0,s.cursor)+String.fromCharCode(key)+s.text.slice(s.cursor+(s.insert?0:1))).slice(0,s.maxLength);
      s.cursor++;
    }
  }
  s.first=false;return s;
}
export function createStudentUI(bytes,kind='edit') {
  // New command clears the source structure BEFORE its cancellable name prompt.
  const out=kind==='new'?new Uint8Array(STUDENT_SIZE):normalizeStudent(bytes);
  const p=readStudent(out);
  if(kind==='times'&&!p.durations[0]) [2,5,5,10].forEach((n,i)=>word(out,30+i*2,n));
  if(kind==='edit') prefsDisplay(out);
  return {kind,bytes:out,selection:kind==='times'?4:5,pointer:kind==='times'?{x:285,y:182}:{x:292,y:186},
    field:kind==='new'?{name:'name',...createTextField('',8,0x103)}:null,done:false};
}
const STUDENT_POINTERS=[[207,74],[154,94],[89,157],[154,157],[225,157],[292,186]];
export const DURATION_RECTS=Object.freeze([[190,70,24,10],[190,90,24,10],[190,110,24,10],[190,130,24,10]]);
const DURATION_POINTERS=[...DURATION_RECTS.map(([x,y,w,h])=>[x+Math.trunc(w/2),y+Math.trunc(h/2)]),[285,182]];
function beginField(s,name,value,maxLength,flags) {s.field={name,...createTextField(value,maxLength,flags)};}

// names is a source-name -> 260-byte map supplied by host storage, never localStorage here.
export function studentUIInput(state,{key=0,pointer=null,messages={}}={},names={}) {
  // Duration pump checks pointer before keyboard, unlike PREFS (0x8f6e,0xf189).
  if(state.kind==='times'&&pointer&&key&&!state.field&&!state.done) {
    const first=studentUIInput(state,{pointer,messages},names);
    if(first.state.done||first.state.field) return first;
    return studentUIInput(first.state,{key,messages},names);
  }
  const s={...state,bytes:state.bytes.slice()},effects=[];
  if(s.done) return {state:s,effects};
  if(s.field) {
    if(!key) return {state:s,effects};
    const f=textFieldInput(s.field,key);s.field=f;
    if(!f.done) return {state:s,effects};
    s.field=null;
    if(f.key===27) {if(s.kind==='new') s.done=true;return {state:s,effects};}
    if(f.name==='name') {
      if(s.kind==='new') {
        if(!f.text.length) {s.done=true;return {state:s,effects};}
        const name=f.text.split('.')[0];
        const collision=Object.keys(names).find(n=>n.toUpperCase()===name.toUpperCase());
        s.bytes=collision?normalizeLoaded(names[collision]):newStudent(name);
        prefsDisplay(s.bytes);s.kind='edit';s.pointer={x:292,y:186};effects.push({type:collision?'loaded-student':'created-student',name});
      } else if(f.text!==readStudent(s.bytes).name) {
        // 0xf3d8..0xf420: Escape is the ONLY cancellation. No collision prompt.
        if(readStudent(s.bytes).profilePresent) effects.push({type:'delete-student',name:readStudent(s.bytes).name});
        setName(s.bytes,f.text);effects.push({type:'save-student',bytes:s.bytes.slice()});
      }
    } else {
      const value=Number.parseInt(f.text,10)||0;
      if(f.name==='goal') word(s.bytes,23,Math.max(5,Math.min(150,s16(value))));
      else word(s.bytes,30+Number(f.name)*2,Math.max(1,Math.min(60,s16(value))));
    }
    return {state:s,effects};
  }
  const times=s.kind==='times',count=times?5:6,positions=times?DURATION_POINTERS:STUDENT_POINTERS;
  let activate=false;
  if(key) {
    if([27,68,100].includes(key)||upper(key)===(messages[10000]??'Done').charCodeAt(0)) {s.done=true;effects.push({type:'save-student',bytes:s.bytes.slice()});return {state:s,effects};}
    if(key===0x12d) return {state:s,effects:[{type:'conditional-quit-request',option:10,hostCanExit:false}]};
    if([9,0x14d,0x150,0x14b,0x148].includes(key)) {
      s.selection=(s.selection+([0x14b,0x148].includes(key)?count-1:1))%count;
      const [x,y]=positions[s.selection];s.pointer={x,y};
    } else if(key===13) {
      // Duration Enter dispatches the CURRENT pointer, not a separate focus action.
      if(times) pointer=s.pointer;else activate=true;
    }
  }
  if(pointer && (!key || key===13&&times)) {
    const x=s16(pointer.x),y=s16(pointer.y);s.pointer={x,y};
    if(times) {
      if(x>=266&&x<=305&&y>=177&&y<=187) {s.done=true;effects.push({type:'save-student',bytes:s.bytes.slice()});}
      else {const i=DURATION_RECTS.findIndex(([a,b,w,h])=>x>=a&&x<=a+w&&y>=b&&y<=b+h);if(i>=0){s.selection=i;activate=true;}}
    } else {
      if(inside(x,y,[273,179,312,193])) {s.done=true;effects.push({type:'save-student',bytes:s.bytes.slice()});}
      else if(y>130&&y<180) {
        const i=[[66,116],[132,182],[208,258]].findIndex(([a,b])=>x>=a&&x<b);
        if(i>=0) {s.bytes[29]=i+1;return {state:s,effects};}
      }
      // Source has no upper x bound for the name field (0xf30b..0xf332).
      if(x>=176&&y>=70&&y<79) {s.selection=0;activate=true;}
      else if(x>=144&&x<168&&y>=90&&y<=99) {s.selection=1;activate=true;}
    }
  }
  if(activate) {
    const p=readStudent(s.bytes);
    if(times && s.selection<4) beginField(s,String(s.selection),String(p.durations[s.selection]&0xffff).padEnd(2,' '),2,0x2002);
    else if(!times&&s.selection===0) beginField(s,'name',p.name,8,0x103);
    else if(!times&&s.selection===1) beginField(s,'goal',String(p.goal&0xffff).padEnd(3,' '),3,0x2002);
    else if(!times&&s.selection<5) s.bytes[29]=s.selection-1;
    else {s.done=true;effects.push({type:'save-student',bytes:s.bytes.slice()});}
  }
  return {state:s,effects};
}
// 0xed01,0xf360,0xf487 and0x904c. FONT3H=8x10; FONT5H=8x8.
export function studentFieldPlacement(state) {
  if(!state.field) return null;
  if(state.kind==='times') {const [x,y]=DURATION_RECTS[Number(state.field.name)];return {x,y,font:'FONT5H',foreground:14,background:0};}
  return {x:state.kind==='new'?192:state.field.name==='goal'?144:176,
    y:state.kind==='new'?110:state.field.name==='goal'?90:70,font:'FONT3H',foreground:15,background:0};
}
// 0xef95..0xf08c redraw normalizes mode/group/character to1, not the service clamps.
function prefsDisplay(bytes) {
  const p=readStudent(bytes);
  if(p.mode<1||p.mode>3) word(bytes,15,1);
  if(p.lesson<1||p.lesson>6) word(bytes,25,1);
  if(((p.character<<24)>>24)<1||((p.character<<24)>>24)>3) bytes[29]=1;
}
function normalizeLoaded(bytes) {
  // 0xe25d load occurs AFTER service normalization. Do not clamp newly read bytes.
  readStudent(bytes);const out=bytes.slice();out[27]=0;out[28]=1;return out;
}

// 0xf653..0xfb19: 30 names, sorted bytewise strcmp, 3 columns of 10.
// There is NO delete button: D is localized Done. Deletion belongs only to rename.
export function createStudentChooser(names,ticks=0) {
  return {names:[...names].slice(0,30).map(n=>n.split('.')[0].slice(0,8)).sort(),selection:0,
    button:1,pointer:{x:265,y:165},lastPress:ticks|0,done:false};
}
export function studentChooserInput(state,{key=0,pointer=null,ticks=0,messages={}}={}) {
  const s={...state},effects=[],count=s.names.length;
  if(s.done) return {state:s,effects};
  if(!count) return {state:{...s,done:!!key||!!pointer},effects};
  const load=()=>{s.done=true;effects.push({type:'load-student',name:s.names[s.selection]});};
  const cancel=()=>{s.done=true;};
  // Chooser pointer runs BEFORE pending keyboard (unlike main menu/editor).
  if(pointer) {
    const x=s16(pointer.x),y=s16(pointer.y),previous=s.lastPress;s.lastPress=ticks|0;s.pointer={x,y};
    if(y>=158&&y<=172&&x>=181&&x<=234) cancel();
    else if(y>=158&&y<=172&&x>=246&&x<=285) load();
    else if(x>=40&&x<(Math.trunc(count/10)+1)*80+40&&y>=64&&y<144) {
      const old=s.selection;s.selection=Math.min(count-1,Math.trunc((x-40)/80)*10+Math.trunc((y-64)/8));
      // Signed high-word comparison: any negative difference qualifies, strict <10.
      if(old===s.selection&&((ticks-previous)|0)<10) load();
    }
  }
  if(!s.done&&key) {
    if(upper(key)===(messages[10000]??'Done').charCodeAt(0)||[68,100].includes(key)) load();
    else if(upper(key)===(messages[10001]??'Cancel').charCodeAt(0)||[27,67,99].includes(key)) cancel();
    else if(key===0x148) s.selection=s.selection? s.selection-1:count-1;
    else if(key===0x150) s.selection=s.selection<count-1?s.selection+1:0;
    else if(key===0x14b) {if(s.selection>=10)s.selection-=10;}
    else if(key===0x14d) {if(s.selection<count-10)s.selection+=10;}
    else if(key===9) {s.button=(s.button+1)%2;const [x,y]=[[207,165],[265,165]][s.button];s.pointer={x,y};}
    else if(key===13) {
      const {x,y}=s.pointer;
      // 0xfb03 jumps into x tests at f94a, WITHOUT testing y.
      if(x>=181&&x<=234) cancel();else if(x>=246&&x<=285) load();
    } else if(key===0x12d) effects.push({type:'conditional-quit-request',option:10,hostCanExit:false});
  }
  return {state:s,effects};
}
