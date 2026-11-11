import { createOutdoor, makeBonus, tick } from '../recovered/outdoor/outdoor.mjs';
import { seedFromTime, lessonPrefix, loadCorpus, selectCorpusSegment, createPractice, practiceInput } from '../recovered/runtime/runtime.mjs';
import { practiceCorpus, practiceExpression } from '../recovered/worlds/routines.mjs';
import { newStudent, readStudent, normalizeStudent, studentForSave, recordProblemKey } from '../recovered/control/student.mjs';
import { progression, nextRoute } from '../recovered/control/flow.mjs';
import { score, timer } from '../recovered/control/scoring.mjs';
import { lessonLimitSeconds, clampLessonMinutes } from '../recovered/control/results.mjs';

export const SAVE_KEY = 'mtt-static-translation.students.v1';
export const BIOS_HZ = 18.2; // Host clock conversion, not measured DOS timing.
export function dosKey(event) {
  if (event.altKey && event.key.toLowerCase() === 'x') return 0x12d;
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return 0;
  const special = { Enter:13, Escape:27, Tab:9, Backspace:8, Delete:127,
    F1:0x13b, F2:0x13c, F10:0x144, ArrowUp:0x148, ArrowLeft:0x14b, ArrowRight:0x14d, ArrowDown:0x150 };
  return special[event.key] ?? (event.key.length === 1 && event.key.charCodeAt(0) < 128 ? event.key.charCodeAt(0) : 0);
}
export function editStudent(bytes, { name, lesson, goal, character, minutes, practiceMinutes }) {
  const out = bytes.slice(), v = new DataView(out.buffer);
  if (name !== undefined) {
    newStudent(name);
    out.fill(0,4,15); [...name].forEach((c,i)=>out[4+i]=c.charCodeAt(0));
  }
  if (lesson !== undefined) v.setInt16(25,lesson,true);
  // Host editor bounds; the DOS goal widget is not translated.
  if (goal !== undefined) {
    if (!Number.isInteger(goal) || goal < 1 || goal > 32767) throw new RangeError('Goal must be 1..32767');
    v.setInt16(23,goal,true);
  }
  if (character !== undefined) out[29]=character;
  if (minutes !== undefined) v.setInt16(30,clampLessonMinutes(minutes),true);
  if (practiceMinutes !== undefined) v.setInt16(36,clampLessonMinutes(practiceMinutes),true);
  return normalizeStudent(out);
}
export function loadProfiles(storage) {
  const value=JSON.parse(storage.getItem(SAVE_KEY) || '{"current":null,"students":{}}');
  if (!value || !value.students || typeof value.students !== 'object' || Array.isArray(value.students)) throw new Error('Invalid saved students');
  for (const bytes of Object.values(value.students)) {
    if (!Array.isArray(bytes) || bytes.length!==260 || bytes.some(n=>!Number.isInteger(n)||n<0||n>255)) throw new Error('Invalid saved student record');
    readStudent(Uint8Array.from(bytes));
  }
  return value;
}
export class Session {
  constructor(data, { bytes = null, seed = seedFromTime(Math.floor(Date.now()/1000)) } = {}) {
    this.data=data; this.seed=seedFromTime(seed); this.initialSeed=this.seed;
    this.screen='menu'; this.outdoor=null; this.practice=null; this.bonus=null; this.cinematic=null;
    this.student=bytes ? normalizeStudent(bytes) : newStudent('Player');
    if (!bytes) this.student[28]=0;
    this.clock=timer({},320,0); this.suspended=false; this.result=null;
    this.limit=0; this.lastPracticeCorrect=0;
  }
  get profile() { return readStudent(this.student); }
  get active() { return this.screen==='outdoor'||this.screen==='practice'; }
  get activity() { return this.mode===4?this.practice:this.outdoor; }
  start(nowTicks, mode=1) {
    if (![1,4].includes(mode)) throw new Error('Unsupported activity');
    const p=this.profile, rng={seed:this.seed};
    const prefix=lessonPrefix(p.lesson,rng), kind=mode===4?practiceCorpus(p.goal):'letters';
    this.corpusName=(prefix+kind).toUpperCase();
    const raw=this.data.lessons[this.corpusName];
    if (!raw) throw new Error(`Missing original corpus: ${this.corpusName}.LEE`);
    const corpus=loadCorpus(raw); selectCorpusSegment(corpus,rng);
    // FILE 0x12c07..0x12cbc: five bonus draws BEFORE reset/assignment of duration.
    this.bonus=mode===1?makeBonus(rng.seed,this.limit):null;
    if (this.bonus) rng.seed=this.bonus.seed;
    this.seed=rng.seed; this.mode=mode; this.cinematic=null;
    if (mode===1) this.outdoor=createOutdoor({bytes:raw,seed:this.seed,character:p.character,lessonIndex:corpus.index});
    else {
      this.practice=createPractice(corpus,this.lastPracticeCorrect);
      this.practice.aborted=false; this.typed='';
    }
    // Student operation0xaf9 at 0x128d8/0xb1ca, body 0xe3f1..0xe419.
    this.student.fill(0,68); this.student[47]=0;
    new DataView(this.student.buffer).setInt16(15,mode,true);
    this.limit=lessonLimitSeconds(p.durations[mode-1],mode===1?2:10);
    this.clock=timer(timer({},320,nowTicks),300,nowTicks);
    this.screen=mode===1?'outdoor':'practice'; this.suspended=false; this.result=null;
  }
  suspend(value, nowTicks) {
    if (!this.active || this.suspended===value) return;
    // Host focus suspension also freezes cinematic frame scheduling.
    if(value) this.suspendedAt=nowTicks;
    else if(this.cinematic) this.cinematic.nextTick+=nowTicks-this.suspendedAt;
    if(!this.cinematic) this.clock=timer(this.clock,value?310:300,nowTicks);
    this.suspended=value;
  }
  stats() { return score({...this.activity,ticks:this.clock.ticks,limitSeconds:this.limit,previousAccuracy:this.profile.accuracy}); }
  expression(wallSeconds) {
    return practiceExpression(wallSeconds,this.practice.lastCorrect,this.profile.profilePresent,this.stats().wpm,this.profile.goal);
  }
  step(key, nowTicks, wallSeconds=Math.floor(Date.now()/1000)) {
    if (!this.active || this.suspended) return [];
    if(this.cinematic) {
      // FILE 0x1425a callback: two changed BIOS ticks per BAN/ANI packet.
      if(nowTicks>=this.cinematic.nextTick) {
        this.cinematic.frame++; this.cinematic.nextTick=nowTicks+2;
        const frames=this.data.bonusAnimations[['m','l','p'][this.profile.character-1]].frames;
        if(this.cinematic.frame>=frames.length) {
          this.cinematic=null; this.clock=timer(this.clock,300,nowTicks);
          return [{type:'bonus-finished'}]; // host latch is flushed by main
        }
      }
      return [];
    }
    this.clock=timer(this.clock,100,nowTicks);
    if(this.mode===4) {
      if(this.stats().elapsedSeconds>=this.limit || key===27) {
        this.practice.aborted=key===27; this.finish(nowTicks); return [{type:'end'}];
      }
      const expected=this.practice.rows[33+this.practice.index];
      const result=practiceInput(this.practice,key,wallSeconds);
      // Practice wrong branch 0xb7be..0xb7d2 calls the same student error service.
      if(result==='retain-target') this.student=recordProblemKey(this.student,expected);
      if(result==='advance-one-byte') this.typed+=String.fromCharCode(key);
      if(result==='next-line') this.typed='';
      this.lastPracticeCorrect=this.practice.lastCorrect;
      return [{type:result}];
    }
    const prefix=['m','l','p'][this.profile.character-1], schedule=this.data.idleSchedules[prefix];
    const events=tick(this.outdoor,{key,elapsed:this.stats().elapsedSeconds,limit:this.limit,
      idleSchedule:schedule.thresholds,idlePeriod:schedule.halfTickPeriod,bonus:this.bonus,second:wallSeconds});
    this.seed=this.outdoor.seed;
    if (events.some(e=>e.type==='wrong')) this.student=recordProblemKey(this.student,this.outdoor.obstacles[this.outdoor.targetIndex].code);
    if(events.some(e=>e.type==='bonus-cinematic-required')) {
      this.clock=timer(this.clock,310,nowTicks);
      this.cinematic={frame:0,nextTick:nowTicks+2};
    }
    if (this.outdoor.ended) this.finish(nowTicks);
    return events;
  }
  finish(nowTicks) {
    this.clock=timer(this.clock,310,nowTicks); this.result=this.stats();
    const p=this.profile, v=new DataView(this.student.buffer);
    v.setInt16(17,this.result.wpm,true); v.setInt16(19,this.result.profileAccuracy,true);
    this.advance=progression(p,{mode:this.mode,resultWpm:this.result.wpm,profilePresent:p.profilePresent,exitGate:this.activity.aborted});
    const s=this.advance.state;
    v.setInt16(21,s.previousGoal,true); v.setInt16(23,s.goal,true); v.setInt16(25,s.lesson,true);
    this.student.set(s.completed.map(Number),38); this.screen='results';
  }
  next(nowTicks) {
    const route=nextRoute(this.profile);
    if (![1,4].includes(route.mode)) return route;
    new DataView(this.student.buffer).setInt16(25,route.lesson,true);
    this.start(nowTicks,route.mode); return route;
  }
  save(storage, profiles) {
    const bytes=studentForSave(this.student); if (!bytes) return;
    const name=readStudent(bytes).name;
    profiles.students[name]=Array.from(bytes); profiles.current=name;
    storage.setItem(SAVE_KEY,JSON.stringify(profiles)); this.student=bytes;
  }
}
