import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMenu,menuInput,menuPixel,menuWelcomeHit,MENU_COMMANDS,createTextField,textFieldInput,
  createStudentUI,studentUIInput,studentFieldPlacement,createStudentChooser,studentChooserInput,DURATION_RECTS,createTextCursor,textCursorTick} from '../../recovered/control/menu.mjs';
import {newStudent,readStudent} from '../../recovered/control/student.mjs';
import {drawMenuWidgets,drawStudentChooserNames,drawTextField} from '../../app/menu-render.mjs';
const root=new URL('../../',import.meta.url);
const json=path=>JSON.parse(readFileSync(new URL(path,root)));
const evidence=json('.tmp/menu/evidence.json'); // regenerate: python3 -B tools/control/menu-inspect.py
const messages=Object.fromEntries(Object.entries(json('analysis/control/messages.json').resources).map(([k,v])=>[k,v.text]));
const blank=()=>new Uint8Array(64000);
const p=readStudent(newStudent('MARIO'));
function fieldKeys(field,keys) {for(const k of keys)field=textFieldInput(field,k);return field;}
function uiKeys(state,keys,names) {let effects=[];for(const key of keys){const r=studentUIInput(state,{key},names);state=r.state;effects.push(...r.effects);}return {state,effects};}
function slice(name,offset,length) {const s=evidence.slices[name];return Buffer.from(s.hex,'hex').subarray(offset-s.start,offset-s.start+length).toString('hex');}
function font(name) {
  return json(`assets/original/fonts/${name}.json`).glyphs.map(g=>({sprite:{width:g.width,height:g.height},pixels:new Uint8Array(readFileSync(new URL(`assets/original/${g.indicesPath}`,root)))}));
}

test('source bytes prove text keys, type flags, numeric clamps, name delete ordering and linear pixel bounds',()=>{
  assert.equal(evidence.exeSha256,'6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e');
  assert.deepEqual(evidence.tables.durationRects.slice(0,16),DURATION_RECTS.flat());
  assert.deepEqual(evidence.tables.textKeys,[8,13,27,315,316,317,318,319,320,321,322,323,324,327,328,329,331,333,335,336,337,338,339]);
  assert.equal(slice('text',0x1b26f,4),'837efa7f'); // input DEL is excluded by signed <127
  assert.equal(slice('text',0x1b278,3),'3b760a'); // cursor < max
  assert.equal(slice('text',0x1b349,5),'f7460c0020'); // clear-on-first flag
  assert.equal(slice('student',0xf519,8),'c45efc26837f1705'); // goal lower5
  assert.equal(slice('student',0xf52c,9),'c45efc26817f179600'); // upper150
  assert.equal(slice('student',0xf3d8,5),'83ff1b7444'); // cancel before delete
  assert.equal(slice('student',0xf3f8,8),'b8050b500ee84eed');
  assert.equal(slice('pixel',0x14fe5,6),'81f900fa7206'); // unsigned linear <64000
});

test('cursor4/2 counts use changed LOW ticks, preserve wrap and never catch up',()=>{
  assert.equal(slice('text',0x1b0de,7),'b8020050b80400');
  assert.equal(slice('cursor-wait',0x192ce,8),'a12c4e3b46f674dd');
  let c=createTextCursor(65535);c=textCursorTick(c,0);assert.equal(c.inverted,true);assert.equal(c.left,4);
  assert.equal(textCursorTick(c,65536),c);
  for(const t of [1,2,3])c=textCursorTick(c,t);assert.equal(c.inverted,true);
  c=textCursorTick(c,4);assert.equal(c.inverted,false);assert.equal(c.left,2);
  c=textCursorTick(c,60000);assert.equal(c.left,1); // a stall is one observed change
  c=textCursorTick(c,60001);assert.equal(c.inverted,true);
});

test('all dropdown rows select the same command by Enter and source pointer',()=>{
  for(let column=1;column<=3;column++) for(let row=1;row<=MENU_COMMANDS[column-1].length;row++) {
    const state={...createMenu(),column,row};
    const keyboard=menuInput(state,{key:13,messages},p);
    const pointer=menuInput(state,{pointer:{x:[40,120,210][column-1],y:row*8+3},front:blank(),messages},p);
    assert.deepEqual(pointer.effects,keyboard.effects,`${column}:${row}`);
  }
});

test('keyboard navigation wraps columns/rows; Escape closes without quit; Space opens then activates',()=>{
  let s=createMenu();s=menuInput(s,{key:0x14b}).state;assert.equal(s.column,3);assert.equal(s.row,0);
  s=menuInput(s,{key:32}).state;assert.equal(s.row,1);
  s=menuInput(s,{key:0x148}).state;assert.equal(s.row,6);
  s=menuInput(s,{key:0x14d}).state;assert.deepEqual([s.column,s.row],[1,1]);
  const r=menuInput(s,{key:27});assert.equal(r.state.row,0);assert.deepEqual(r.effects,[]);
  assert.deepEqual(menuInput(s,{key:81}).effects,[{type:'quit-request',hostCanExit:false}]);
});

test('main pointer strict bar/dropdown edges and half-open world edges',()=>{
  for(const x of [16,64,104,184,224,296]) assert.equal(menuInput(createMenu(),{pointer:{x,y:0},front:blank()}).state.row,0);
  for(const [x,column] of [[17,1],[105,2],[225,3]]) assert.equal(menuInput(createMenu(),{pointer:{x,y:7},front:blank()}).state.column,column);
  assert.deepEqual(menuInput(createMenu(),{pointer:{x:236,y:12},front:blank()},p).effects,[{type:'start',mode:1}]);
  for(const [x,y] of [[235,12],[299,12],[236,39]]) assert.deepEqual(menuInput(createMenu(),{pointer:{x,y},front:blank()},p).effects,[]);
  assert.deepEqual(menuInput({...createMenu(),row:1},{pointer:{x:236,y:105},front:blank()},p).effects,[]);
});

test('88 intercepts entire 7x7 before bar, dropdown and world; linear source wrapping is retained',()=>{
  for(const [x,y] of [[20,0],[40,15],[240,15]]) {
    const front=blank();front[((y+3)*320+x+3)&0xffff]=88;
    assert.deepEqual(menuInput({...createMenu(),row:1},{pointer:{x,y},front},p).effects,[{type:'sound-request',name:'welcome'}]);
  }
  const front=blank();front[319]=88;assert.equal(menuPixel(front,-1,1),88);assert.equal(menuWelcomeHit(front,0,1),true);
  assert.equal(menuPixel(front,-1,0),0);
  assert.deepEqual(menuInput(createMenu(),{key:49,pointer:{x:20,y:0},front},p).effects,[{type:'start',mode:1}]);
});

test('localized accelerators run before English fallback; source profile gates and XOR bits',()=>{
  assert.deepEqual(menuInput(createMenu(),{key:90,messages:{10008:'Zabout'}}).effects,[{type:'about'}]);
  assert.deepEqual(menuInput(createMenu(),{key:50},p).effects,[{type:'world-warning',mode:2}]);
  assert.deepEqual(menuInput(createMenu(),{key:53},{profilePresent:false}).effects,[]);
  assert.deepEqual(menuInput(createMenu(),{key:78},{...p,demo:true}).effects,[]);
  let s={...createMenu(),row:5};for(const key of [77,83,71])s=menuInput(s,{key}).state;
  assert.equal(s.options,7);assert.equal(s.row,0);assert.equal(menuInput(s,{key:77}).state.options,6);
});

test('source name text editor uppercase letters/digits only, eight bytes, insert/overwrite, cursor clamps',()=>{
  let f=fieldKeys(createTextField('',8,0x103),[97,32,46,95,49,126,127]);assert.equal(f.text,'A1');
  f=fieldKeys(f,[0x147,98,0x14f,99,100,101,102,103,104,105]);assert.equal(f.text,'BA1CDEFG');assert.equal(f.cursor,8);
  f=fieldKeys(f,[0x147,0x14b,0x153,0x152,122]);assert.equal(f.text,'Z1CDEFG');assert.equal(f.cursor,1);
  f=fieldKeys(f,[8]);assert.equal(f.text,'1CDEFG');assert.equal(f.cursor,0);
  f=fieldKeys(f,[8,9]);assert.equal(f.text,'1CDEFG');assert.equal(f.done,false);
  assert.equal(textFieldInput(f,0x148).key,0x148);assert.equal(textFieldInput(f,0x13b).done,true);
});

test('numeric fields clear on first accepted digit, arrows suppress clear, minus rejected; max cursor never overflows',()=>{
  assert.equal(fieldKeys(createTextField('150',3,0x2002),[57,57]).text,'99');
  assert.equal(fieldKeys(createTextField('150',3,0x2002),[0x14d,57]).text,'195');
  assert.equal(fieldKeys(createTextField('5',3,0x2002),[45,57]).text,'95');
});

test('new student cancel really leaves zero structure; collision loads existing bytes without fresh defaults',()=>{
  let r=studentUIInput(createStudentUI(newStudent('OLD'),'new'),{key:27});
  assert.equal(r.state.done,true);assert.equal(r.state.bytes.every(n=>n===0),true);assert.deepEqual(r.effects,[]);
  const saved=newStudent('MARIO');new DataView(saved.buffer).setInt16(23,77,true);
  r=uiKeys(createStudentUI(saved,'new'),[109,97,114,105,111,13],{MARIO:saved});
  assert.equal(readStudent(r.state.bytes).goal,77);assert.equal(r.effects[0].type,'loaded-student');
  r=uiKeys(createStudentUI(saved,'new'),[108,117,105,103,105,13]);assert.equal(readStudent(r.state.bytes).name,'LUIGI');assert.equal(readStudent(r.state.bytes).goal,5);
});

test('rename Escape never deletes/saves, confirmation deletes OLD before saving new, no invented collision prompt',()=>{
  const state=studentUIInput(createStudentUI(newStudent('OLD')),{pointer:{x:176,y:70}}).state;
  let r=uiKeys(state,[0x153,0x153,0x153,78,69,87,27]);assert.equal(readStudent(r.state.bytes).name,'OLD');assert.deepEqual(r.effects,[]);
  r=uiKeys(state,[0x153,0x153,0x153,78,69,87,13]);
  assert.equal(readStudent(r.state.bytes).name,'NEW');assert.deepEqual(r.effects.map(e=>e.type),['delete-student','save-student']);assert.equal(r.effects[0].name,'OLD');
});

test('student name/goal/character source pointer boundaries and keyboard parity; goal clamps5..150',()=>{
  let state=createStudentUI(newStudent('OLD'));
  assert.equal(studentUIInput(state,{pointer:{x:175,y:70}}).state.field,null);
  assert.equal(studentUIInput(state,{pointer:{x:319,y:78}}).state.field.name,'name');
  assert.equal(studentUIInput(state,{pointer:{x:319,y:79}}).state.field,null);
  for(const [i,x] of [[1,66],[2,132],[3,208]]) {
    const mouse=studentUIInput(state,{pointer:{x,y:131}}).state;
    const keys=studentUIInput({...state,selection:i+1},{key:13}).state;
    assert.equal(mouse.bytes[29],keys.bytes[29]);assert.equal(mouse.bytes[29],i);
  }
  for(const [input,goal] of [[[48],5],[[57,57,57],150]]) {
    const selected=studentUIInput(state,{pointer:{x:144,y:99}}).state;
    const r=uiKeys(selected,[...input,13]);assert.equal(readStudent(r.state.bytes).goal,goal);
  }
});

test('duration fields use inclusive rectangle endpoints, 2 digits and clamp1..60, Escape cancels field not dialog',()=>{
  const state=createStudentUI(newStudent('OLD'),'times');
  for(let i=0;i<4;i++) {
    const [x,y,w,h]=DURATION_RECTS[i];
    let r=studentUIInput(state,{pointer:{x:x+w,y:y+h}});assert.equal(r.state.field.name,String(i));
    r=uiKeys(r.state,[57,57,57,13]);assert.equal(readStudent(r.state.bytes).durations[i],60);
    r=uiKeys(studentUIInput(state,{pointer:{x,y}}).state,[48,13]);assert.equal(readStudent(r.state.bytes).durations[i],1);
    r=uiKeys(studentUIInput(state,{pointer:{x,y}}).state,[57,27]);assert.equal(r.state.done,false);assert.deepEqual(readStudent(r.state.bytes).durations,p.durations);
  }
  const tab=studentUIInput(state,{key:9}).state;
  assert.equal(studentUIInput(tab,{key:13}).state.field.name,'0');
});

test('field placement and numeric padding use source font rows; duration pointer precedes a pending Done key',()=>{
  const initial=createStudentUI(newStudent('OLD'),'new');
  assert.deepEqual(studentFieldPlacement(initial),{x:192,y:110,font:'FONT3H',foreground:15,background:0});
  const times=createStudentUI(newStudent('OLD'),'times');
  const r=studentUIInput(times,{key:68,pointer:{x:190,y:70}});
  assert.equal(r.state.done,false);assert.equal(r.state.field.text,'2 ');
  assert.deepEqual(studentFieldPlacement(r.state),{x:190,y:70,font:'FONT5H',foreground:14,background:0});
  const goal=studentUIInput(createStudentUI(newStudent('OLD')),{pointer:{x:144,y:90}}).state;
  assert.equal(goal.field.text,'5  ');assert.equal(uiKeys(goal,[0x14f]).state.field.cursor,3);
  assert.equal(createMenu({options:7}).options,7);
});

test('chooser sorted 30-name columns; D means Done/load, C/Escape cancel without deletion',()=>{
  const s=createStudentChooser(['Z','A','B'],100);assert.deepEqual(s.names,['A','B','Z']);
  for(const key of [27,67,99]) {const r=studentChooserInput(s,{key});assert.equal(r.state.done,true);assert.deepEqual(r.effects,[]);}
  for(const key of [68,100,13]) assert.deepEqual(studentChooserInput(s,{key}).effects,[{type:'load-student',name:'A'}]);
  assert.equal(studentChooserInput(s,{key:0x148}).state.selection,2);
  assert.equal(studentChooserInput(s,{key:0x14d}).state.selection,0);
  const tab=studentChooserInput(s,{key:9}).state;assert.deepEqual(studentChooserInput(tab,{key:13}).effects,[]);
  assert.equal(studentChooserInput(tab,{key:13}).state.done,true);
});

test('chooser pointer runs before key, double-press strict10 tick boundary and clamp to last item',()=>{
  let s=createStudentChooser(['A','B'],100);
  let r=studentChooserInput(s,{pointer:{x:40,y:64},ticks:110});assert.equal(r.state.done,false);
  r=studentChooserInput(s,{pointer:{x:40,y:64},ticks:109});assert.equal(r.effects[0].name,'A');
  r=studentChooserInput(s,{pointer:{x:119,y:143},ticks:110});assert.equal(r.state.selection,1);
  r=studentChooserInput(s,{pointer:{x:181,y:158},key:68,ticks:110});assert.equal(r.state.done,true);assert.deepEqual(r.effects,[]);
});

test('real FONT5H dropdown pixels, border and selected opaque cells retain source palette indices',()=>{
  const fonts=font('FONT5H'),front=blank().fill(88),state={...createMenu(),row:1};
  drawMenuWidgets(front,fonts,messages,state,1);
  assert.equal(front[8*320+14],8);assert.equal(front[73*320+121],8);
  assert.equal(front[8*320+16],1);assert.equal(front[16*320+16],fonts['H'.charCodeAt(0)-32].pixels[0]?0:14);
  assert.equal(front[74*320+14],88);assert.equal(front[7*320+14],88);
  const chooser=blank();drawStudentChooserNames(chooser,fonts,createStudentChooser(['A','B']));
  assert.equal(chooser[64*320+40],1);assert.equal(chooser[72*320+40],15);
});

test('real FONT3H caret inverts a whole cell, including source zero pixels, at max cursor',()=>{
  const fonts=font('FONT3H'),f=createTextField('A',8,0x103),a=blank(),b=blank();
  drawTextField(a,fonts,f,{x:176,y:70,inverted:false});drawTextField(b,fonts,f,{x:176,y:70,inverted:true});
  for(let y=0;y<fonts[0].sprite.height;y++)for(let x=0;x<8;x++)assert.equal(a[(70+y)*320+176+x]+b[(70+y)*320+176+x],fonts[33].pixels[y*8+x]===2?0:15);
  const end={...f,cursor:8};drawTextField(a,fonts,end,{x:176,y:70,inverted:true});assert.equal(a[70*320+240],15);
});
