// Static source sequencing, FILE offsets in analysis/control/CELEBRATIONS.md.
import { fireworkVariant, s16 } from '../runtime/runtime.mjs';

const FULL = {left:0,top:0,right:319,bottom:199};
const tick = {type:'wait-tick'};
const key = {type:'wait-input'};

// The world has ALREADY scored and stopped its timer. This component never
// resumes it, recalculates progression, saves, prints, or invents audio requests.
// Resources are decoded by tools/control/celebration-inspect.py, then hydrated
// by app/celebration-render.mjs. Shared RNG object is mutated only by fireworks.
export class Celebration {
  constructor({world, character, goal, lesson, endMode=0, swimFrame, rng, resources}) {
    if (![1,2,3].includes(world) || ![1,2,3].includes(character)) throw new RangeError('celebration world/character');
    if(!Number.isInteger(goal) || !Number.isInteger(lesson)) throw new TypeError('celebration goal/lesson required');
    if (world===2 && (!Number.isInteger(swimFrame) || swimFrame<0 || swimFrame>5)) throw new RangeError('surviving Water frame required');
    if (world===3 && ![1,2,4].includes(endMode)) throw new RangeError('Castle end mode');
    if (world===1 && !Number.isInteger(rng?.seed)) throw new TypeError('shared RNG required');
    this.world=world; this.character=character; this.goal=s16(goal); this.lesson=s16(lesson);
    this.endMode=endMode; this.swimFrame=swimFrame; this.rng=rng; this.resources=resources;
    // Validate the complete chosen path BEFORE any input, RNG, or scene mutation.
    const scene=world===1?'OCASTLE':world===2?'WCAS0001':'ENDF';
    if (resources?.scenes?.[scene]?.pixels?.length!==64000) throw new Error(`Missing celebration scene ${scene}`);
    const movies=world===1?['FIR1','FIR2']:world===2?['WCAS']:endMode&4?['ENDF']:[];
    for (const movie of movies) if (!resources.movies?.[movie]?.frames?.length) throw new Error(`Missing celebration movie ${movie}`);
    const family=world===1?'WALKING':'WATER', start=(character-1)*(world===1?30:6), count=world===1?12:6;
    if (world!==3) for(let i=0;i<count;i++) if (!resources.actors?.[family]?.[start+i]) throw new Error(`Missing celebration actor ${family}:${start+i}`);
    const font=world===3?'FONT5H':'FONT3H';
    if(resources.actors?.[font]?.length!==96 || !resources.fonts?.[font]) throw new Error(`Missing celebration font ${font}`);
    const ids=world===3?[7010,6100,6101,50420]:world===1?[7010,50420]:[6010,6011,50420];
    if(world===3 || this.goal<(world===1?10:30)) ids.push(6100,6101,(this.lesson+299)&65535);
    if(world<3 && this.goal>=(world===1?10:30)) ids.push(world===1?7050:6050,4300,4301,4302);
    if(world===3 && endMode===4) ids.push(4300,4301,4302);
    for(const id of ids) if(typeof resources.messages?.[id]?.text!=='string') throw new Error(`Missing celebration message ${id}`);
    this.complete=false; this.wait=null; this.iterator=this.play();
  }
  flush() { this.input.flush(); return {type:'flush-input'}; }
  // Supply the existing DOS-byte queue, not a DOM key latch. One tickReady
  // acknowledges ONE changed-low-word wait, never catches up missed frames.
  step({input, tickReady=false, pointerChanged=false}={}) {
    if (this.complete) return [];
    if (!input || typeof input.pending!=='function' || typeof input.flush!=='function') throw new TypeError('keyboard queue required');
    this.input=input;
    if (this.wait==='wait-tick' && !tickReady) return [];
    if (this.wait==='wait-input' && !input.pending() && !pointerChanged) return [];
    this.wait=null;
    const effects=[];
    for (;;) {
      const next=this.iterator.next();
      if (next.done) { this.complete=true; effects.push({type:'celebration-complete',world:this.world}); break; }
      const e=next.value;
      if (e.type==='wait-tick' || e.type==='wait-input') { this.wait=e.type; break; }
      effects.push(e);
    }
    return effects;
  }
  *movie(name, repeat=false) {
    // 0x81df resets packet counter and BAN pointer per pass. No ANI was passed
    // by any of these four callers. Repeated ENDF preserves existing pixels.
    do {
      const frames=this.resources.movies[name].frames;
      for (let frame=0;frame<frames.length;frame++) {
        yield {type:'movie-packet',name,frame};
        yield tick; yield tick; // callback 0x14725, NOT selected-frame bonus sound
        if (repeat && this.input.pending()) { yield this.flush(); return; }
      }
    } while(repeat);
  }
  *progressText() {
    const cap=this.world===1?10:30;
    if (this.goal>=cap) {
      yield {type:'text',id:this.world===1?7050:6050,column:3,row:5};
      for(let i=0;i<3;i++) yield {type:'text',id:4300+i,column:3,row:8+i};
    } else {
      yield {type:'text',id:6100,column:3,row:5,args:[this.goal]};
      yield {type:'text',id:6101,column:3,row:6,lesson:this.lesson};
    }
  }
  *play() {
    if (this.world===1) yield* this.outside();
    else if (this.world===2) yield* this.water();
    else yield* this.castle();
  }
  *outside() {
    // 0x13e70..0x13eef. Palette goes black immediately; no guessed fade delay.
    yield {type:'palette-black'};
    yield {type:'scene',name:'OCASTLE'};
    yield {type:'palette-scene',name:'OCASTLE'};
    yield {type:'text-save',font:'FONT3H'};
    yield this.flush();
    this.x=-50; this.y=110; let dx=5,dy=1,frame=0,skipped=false,previous=null;
    // DOS retains its old raster pointer, but at x=-50 its right edge is
    // off-screen for every recovered run/jump/idle raster. Omit that erasure.
    while (this.x<185) {
      if (this.x>155) {dx=2;dy=-3;}
      frame=(frame+1)%12;
      const x=this.x+dx,y=this.y+dy;
      const current={family:'WALKING',index:(this.character-1)*30+frame,x,y};
      yield {type:'actor',...current,previous};
      previous=current; this.x=x; this.y=y;
      yield tick;
      if (this.input.pending()) {yield this.flush();skipped=true;break;}
    }
    if (!skipped) {
      yield {type:'actor-remove'};
      yield {type:'character-resources-free'}; // 0x13fd8, absent on early skip
      for(let i=0;i<10;i++) {
        if (this.input.pending()) {yield this.flush();break;}
        yield* this.movie(`FIR${fireworkVariant(this.rng)}`);
      }
    }
    yield {type:'text',id:7010,column:3,row:2};
    yield* this.progressText();
    yield {type:'text',id:50420,column:13,row:20};
    yield this.flush(); yield key; yield this.flush();
    yield {type:'text-restore'};
    yield {type:'scene-free',name:'OCASTLE'};
  }
  *water() {
    // 0x17afc..0x17b45 saves text state before black/load/palette.
    yield {type:'text-save',font:'FONT3H'};
    yield {type:'palette-black'};
    yield {type:'scene',name:'WCAS0001'};
    yield {type:'text',id:6010,column:3,row:2};
    yield {type:'text',id:6011,column:3,row:3};
    yield {type:'palette-fade',name:'WCAS0001',from:'black',steps:12,wait:false};
    this.x=-45; this.y=110; let count=0;
    do {
      const x=this.x+3, y=this.y+(x<65 && this.y<140?1:0), old=this.swimFrame;
      if (!(++count&1)) this.swimFrame++;
      if (this.swimFrame>=6) this.swimFrame=0;
      yield {type:'clip',clip:{left:0,top:0,right:105,bottom:199}};
      yield {type:'actor',family:'WATER',index:(this.character-1)*6+this.swimFrame,x,y,
             previous:{family:'WATER',index:(this.character-1)*6+old,x:this.x,y:this.y}};
      yield {type:'clip',clip:{...FULL}};
      this.x=x; this.y=y; yield tick;
    } while(this.x<=120); // 56 updates, no key polling at all
    yield this.flush();
    yield* this.movie('WCAS'); // once, unskippable, no RNG
    yield* this.progressText();
    yield {type:'text',id:50420,column:13,row:20};
    yield this.flush(); yield key; yield this.flush();
    // 0x17d84: loaded CRX object owns this scene; original enabled graphics path.
    yield {type:'clear-high-bit'};
    yield {type:'palette-fade',name:'WCAS0001',to:'black',steps:12,wait:false};
    yield {type:'clear-screen',color:0}; // 0x1ac9a, not resource cleanup
    yield {type:'scene-free',name:'WCAS0001'};
    yield {type:'text-restore'};
  }
  *castle() {
    yield {type:'palette-black'};
    yield {type:'scene',name:'ENDF'};
    yield {type:'text-save',font:'FONT5H'};
    // All modes print both goal and lesson. Only BIT4 selects a different path.
    yield {type:'text',id:7010,column:4,row:2};
    yield {type:'text',id:6100,column:4,row:4,args:[this.goal]};
    yield {type:'text',id:6101,column:4,row:5,lesson:this.lesson};
    if (this.endMode&4) for(let i=0;i<3;i++) yield {type:'text',id:4300+i,column:4,row:20+i};
    yield {type:'palette-fade',name:'ENDF',from:'black',steps:12,wait:false};
    yield {type:'text',id:50420,column:13,row:25};
    for(let i=0;i<18;i++) yield tick; // 0xe0b6..0xe0c3, keys do not skip
    yield this.flush();
    if(this.endMode&4) yield* this.movie('ENDF',true); // repeat UNTIL key, not once
    else yield key;
    yield this.flush();
    yield {type:'text-restore'};
    yield {type:'scene-free',name:'ENDF'};
    // 0xdacb happens AFTER presentation return, unlike progression's final snapshot.
    if(this.endMode===4) yield {type:'set-completed',index:2};
  }
}
