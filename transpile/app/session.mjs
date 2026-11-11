import { CastleController } from '../recovered/worlds/castle.mjs';
import { createWater, stepWater } from '../recovered/worlds/water.mjs';
import { createPendingInput } from '../recovered/runtime/runtime.mjs';
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
  const special = { Enter:13, Escape:27, Tab:9, Backspace:8, Delete:0x153,
    F1:0x13b, F2:0x13c, F3:0x13d, F4:0x13e, F5:0x13f, F6:0x140, F7:0x141, F8:0x142, F9:0x143, F10:0x144,
    Home:0x147, End:0x14f, PageUp:0x149, PageDown:0x151, Insert:0x152,
    ArrowUp:0x148, ArrowLeft:0x14b, ArrowRight:0x14d, ArrowDown:0x150 };
  return special[event.key] ?? (event.key.length === 1 && event.key.charCodeAt(0) < 128 ? event.key.charCodeAt(0) : 0);
}
export function editStudent(bytes, { name, lesson, goal, character, minutes, waterMinutes, castleMinutes, practiceMinutes }) {
  const out = bytes.slice(), v = new DataView(out.buffer);
  if (name !== undefined) {
    newStudent(name);
    out.fill(0,4,15); [...name].forEach((c,i)=>out[4+i]=c.charCodeAt(0));
  }
  if (lesson !== undefined) v.setInt16(25,lesson,true);
  // Separate host-form validation. The original canvas editor owns its5..150 clamp.
  if (goal !== undefined) {
    if (!Number.isInteger(goal) || goal < 1 || goal > 32767) throw new RangeError('Goal must be 1..32767');
    v.setInt16(23,goal,true);
  }
  if (character !== undefined) out[29]=character;
  if (minutes !== undefined) v.setInt16(30,clampLessonMinutes(minutes),true);
  if (waterMinutes !== undefined) v.setInt16(32,clampLessonMinutes(waterMinutes),true);
  if (castleMinutes !== undefined) v.setInt16(34,clampLessonMinutes(castleMinutes),true);
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
    this.limit=0; this.lastPracticeCorrect=0; this.outdoorLastSecond=0;
    this.castle=null; this.castlePersistent={rockSecond:0,sandSecond:0};
    this.castleMovie=null; this.castleWait=null; this.castleEnding=null;
    this.water=null; this.input=createPendingInput(); this.lastWaitTick=0;
    this.effects=[]; this.sampleTicks=0; this.sampleSeconds=0; this.waterMovie=null;
  }
  get profile() { return readStudent(this.student); }
  get active() { return this.screen==='outdoor'||this.screen==='practice'||this.screen==='water'||this.screen==='castle'; }
  get activity() { return this.mode===4?this.practice:this.mode===3?{...this.castle.stats,aborted:this.castle.flags.exit}:this.mode===2?{...this.water.stats,aborted:this.water.aborted}:this.outdoor; }
  start(nowTicks, mode=1, wallSeconds=Math.floor(Date.now()/1000)) {
    if (![1,2,3,4].includes(mode)) throw new Error('Unsupported activity');
    // Student service normalization also follows a cancelled New (zeroed bytes).
    this.student=normalizeStudent(this.student);
    const p=this.profile, rng={seed:this.seed};
    const prefix=lessonPrefix(p.lesson,rng), kind=mode===4?practiceCorpus(p.goal):mode===2?'words':mode===3?'sentenc':'letters';
    this.corpusName=(prefix+kind).toUpperCase();
    const raw=this.data.lessons[this.corpusName];
    if (!raw) throw new Error(`Missing original corpus: ${this.corpusName}.LEE`);
    const corpus=loadCorpus(raw,this.water?.stream.previousWater ?? 0); selectCorpusSegment(corpus,rng);
    this.sampleTicks=nowTicks; this.sampleSeconds=wallSeconds; this.input.flush(); this.effects=[]; this.waterMovie=null;
    // FILE 0x12c07..0x12cbc: five bonus draws BEFORE reset/assignment of duration.
    this.bonus=mode===1?makeBonus(rng.seed,this.limit,false,this.outdoorLastSecond):null;
    if (this.bonus) rng.seed=this.bonus.seed;
    this.seed=rng.seed; this.mode=mode; this.cinematic=null;
    this.castleMovie=null; this.castleWait=null; this.castleEnding=null; this.castleEndingAck=null;
    // REENTRY.md: the last Outside object survives intervening Practice entries.
    if (mode===1) this.outdoor=createOutdoor({bytes:raw,seed:this.seed,character:p.character,lessonIndex:corpus.index,previous:this.outdoor});
    else if(mode===2) {
      this.water=createWater({stream:corpus,rng,input:this.input,
        clock:{ticks:()=>this.sampleTicks,seconds:()=>this.sampleSeconds},
        character:p.character-1,minutes:p.durations[1],previousLimitSeconds:this.limit,
        previous:this.water,profile:p,profilePresent:p.profilePresent});
      this.effects.push(...this.water.effects); this.seed=rng.seed;
    } else if(mode===3) {
      const schedule=this.data.idleSchedules[['m','l','p'][p.character-1]];
      this.castle=new CastleController({stream:corpus,rng,persistent:this.castlePersistent,
        character:p.character,minutes:p.durations[2],priorDuration:this.limit,
        previousAccuracy:p.accuracy,profile:p,profilePresent:p.profilePresent,
        resources:{bonusXs:this.data.castle.bonusXs,idleSchedule:schedule.thresholds,idlePeriod:schedule.halfTickPeriod}});
      this.consumeCastle(this.castle.step({nowTicks,nowSeconds:wallSeconds,input:this.input}));
      this.seed=rng.seed;
    } else {
      this.practice=createPractice(corpus,this.lastPracticeCorrect);
      this.practice.aborted=false; this.typed='';
    }
    // Student operation0xaf9 at 0x128d8/0xb1ca, body 0xe3f1..0xe419.
    this.student.fill(0,68); this.student[47]=0;
    new DataView(this.student.buffer).setInt16(15,mode,true);
    this.limit=mode===3?this.castle.stats.limitSeconds:mode===2?this.water.limitSeconds:lessonLimitSeconds(p.durations[mode-1],mode===1?2:10);
    this.clock=mode===3?this.castle.stats:mode===2?this.water.timer:timer(timer({},320,nowTicks),300,nowTicks);
    this.screen=mode===1?'outdoor':mode===2?'water':mode===3?'castle':'practice'; this.suspended=false; this.result=null;
  }
  suspend(value, nowTicks) {
    if (!this.active || this.suspended===value) return;
    // Host focus suspension also freezes cinematic frame scheduling.
    if(value) this.suspendedAt=nowTicks;
    else if(this.cinematic) this.cinematic.nextTick+=nowTicks-this.suspendedAt;
    if(this.mode===3) {
      if(value) { this.castleWasRunning=this.castle.stats.running; this.castle.stats=timer(this.castle.stats,310,nowTicks); }
      else if(this.castleWasRunning) this.castle.stats=timer(this.castle.stats,300,nowTicks);
      this.clock=this.castle.stats; this.input.flush();
    } else if(this.mode===2) {
      if(value) { this.waterWasRunning=this.water.timer.running; this.water.timer=timer(this.water.timer,310,nowTicks); }
      else if(this.waterWasRunning) this.water.timer=timer(this.water.timer,300,nowTicks);
      this.clock=this.water.timer;
      this.input.flush();
    } else if(!this.cinematic) this.clock=timer(this.clock,value?310:300,nowTicks);
    this.suspended=value;
  }
  stats() { if(this.mode===3) return this.castle.stats; if(this.mode===2) return this.water.stats; return score({...this.activity,ticks:this.clock.ticks,limitSeconds:this.limit,previousAccuracy:this.profile.accuracy}); }
  expression(wallSeconds) {
    return practiceExpression(wallSeconds,this.practice.lastCorrect,this.profile.profilePresent,this.stats().wpm,this.profile.goal);
  }
  step(key, nowTicks, wallSeconds=Math.floor(Date.now()/1000)) {
    if (!this.active || this.suspended) return [];
    if(this.mode===3) return this.stepCastleHost(key,nowTicks,wallSeconds);
    if(this.mode===2) return this.stepWaterHost(key,nowTicks,wallSeconds);
    if(this.cinematic) {
      // FILE 0x1425a callback: two changed BIOS ticks per BAN/ANI packet.
      if(nowTicks>=this.cinematic.nextTick) {
        this.lastWaitTick=nowTicks&65535;
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
    this.seed=this.outdoor.seed; this.outdoorLastSecond=this.bonus.lastSecond;
    if (events.some(e=>e.type==='wrong')) this.student=recordProblemKey(this.student,this.outdoor.obstacles[this.outdoor.targetIndex].code);
    if(events.some(e=>e.type==='bonus-cinematic-required')) {
      this.clock=timer(this.clock,310,nowTicks);
      this.cinematic={frame:0,nextTick:nowTicks+2};
    }
    if(!this.cinematic) this.lastWaitTick=nowTicks&65535; // shared Outside wait observation
    if (this.outdoor.ended) this.finish(nowTicks);
    return events;
  }
  enqueue(key) {
    if(key>255) this.input.enqueue(0,key-256);
    else if(key) this.input.enqueue(key);
  }
  takeEffects() { const effects=this.effects; this.effects=[]; return effects; }
  changedTick(ticks) {
    const low=ticks&65535;
    if(low===this.lastWaitTick) return false;
    this.lastWaitTick=low; return true;
  }
  stepWaterHost(key,nowTicks,wallSeconds) {
    this.sampleTicks=nowTicks; this.sampleSeconds=wallSeconds; this.enqueue(key);
    const events=[];
    const consume=effects=>{
      events.push(...effects); this.effects.push(...effects);
      for(const e of effects) {
        if(e.type==='key-error') this.student=recordProblemKey(this.student,e.code);
        if(e.type==='play-bonus') {
          this.waterMovie={frame:0,waits:0};
          const packet={type:'water-packet',frame:0}; events.push(packet); this.effects.push(packet);
        }
      }
    };
    // Drain source polling, not one key per host frame. A wait consumes a
    // changed LOW tick once; delayed browser callbacks never catch up ticks.
    while(this.water.phase!=='ended' && this.water.phase!=='quit') {
      const phase=this.water.phase;
      if(phase==='bonus') {
        if(!this.changedTick(nowTicks)) break;
        if(++this.waterMovie.waits<2) break;
        this.waterMovie.waits=0;
        const frames=this.data.water.animations[['m','l','p'][this.profile.character-1]].frames;
        if(++this.waterMovie.frame<frames.length) {
          const packet={type:'water-packet',frame:this.waterMovie.frame};
          events.push(packet); this.effects.push(packet); break;
        }
        this.waterMovie=null; consume(stepWater(this.water,{bonusComplete:true}));
      } else if(phase==='celebration') {
        // Declared Phase5 omission, no guessed duration or blocked progression.
        consume(stepWater(this.water,{celebrationComplete:true}));
      } else if(phase==='wait') {
        if(!this.changedTick(nowTicks)) break;
        consume(stepWater(this.water,{tickReady:true}));
      } else consume(stepWater(this.water));
    }
    this.clock=this.water.timer; this.seed=this.water.rng.seed;
    if(this.water.phase==='ended') {
      this.result={...this.water.stats}; this.advance=this.water.progression;
      const v=new DataView(this.student.buffer), p=this.advance.state;
      v.setInt16(17,this.result.wpm,true); v.setInt16(19,this.result.profileAccuracy,true);
      v.setInt16(21,p.previousGoal,true); v.setInt16(23,p.goal,true); v.setInt16(25,p.lesson,true);
      this.student.set(p.completed.map(Number),38); this.screen='results';
    }
    return events;
  }
  consumeCastle(effects) {
    const visible=[];
    for(let i=0;i<effects.length;i++) {
      const e=effects[i]; visible.push(e); this.effects.push(e);
      if(e.type==='key-error') this.student=recordProblemKey(this.student,e.expected);
      if(e.type==='wait-changed-tick') {
        // c01c precedes clip restoration and first-entry Ready. Keep those
        // effects behind the wait, not ahead of the first changed LOW tick.
        this.castleWait=effects.slice(i+1); break;
      }
      if(e.type==='bonus-playback') {
        this.castleMovie={frame:0,waits:0};
        const packet={type:'castle-packet',frame:0}; visible.push(packet); this.effects.push(packet);
      }
      if(e.type==='ending') {
        this.castleEnding={event:e,after:effects.slice(i+1)}; break;
      }
      if(e.type==='results') {
        this.result={...this.castle.stats}; this.advance=this.castle.result;
        const v=new DataView(this.student.buffer), p=this.advance.state;
        v.setInt16(17,this.result.wpm,true); v.setInt16(19,this.result.profileAccuracy,true);
        v.setInt16(21,p.previousGoal,true); v.setInt16(23,p.goal,true); v.setInt16(25,p.lesson,true);
        this.student.set(p.completed.map(Number),38); this.screen='results';
      }
    }
    return visible;
  }
  acknowledgeCastleEnding({omitted=false,reason=''}={}) {
    if(!this.castleEnding || (omitted && !reason)) throw new Error('Castle ending requires an explicit completion or omission reason');
    const after=this.castleEnding.after; this.castleEnding=null;
    const ack={type:'ending-acknowledged',omitted,reason}; this.castleEndingAck=ack; this.effects.push(ack);
    return [ack,...this.consumeCastle(after)];
  }
  stepCastleHost(key,nowTicks,wallSeconds) {
    this.sampleTicks=nowTicks; this.sampleSeconds=wallSeconds; this.enqueue(key);
    if(this.castleEnding) return [];
    const events=[];
    if(this.castleMovie) {
      if(!this.changedTick(nowTicks)) return events;
      if(++this.castleMovie.waits<2) return events;
      this.castleMovie.waits=0;
      const frames=this.data.castle.animations[['m','l','p'][this.profile.character-1]].frames;
      if(++this.castleMovie.frame<frames.length) {
        const packet={type:'castle-packet',frame:this.castleMovie.frame};
        events.push(packet); this.effects.push(packet); return events;
      }
      this.castleMovie=null;
      events.push(...this.consumeCastle(this.castle.resumeBonus({nowTicks,nowSeconds:wallSeconds,input:this.input})));
    } else {
      if(this.castleWait) {
        if(!this.changedTick(nowTicks)) return events;
        const tail=this.castleWait; this.castleWait=null;
        events.push(...this.consumeCastle(tail));
      }
      events.push(...this.consumeCastle(this.castle.step({nowTicks,nowSeconds:wallSeconds,input:this.input})));
    }
    this.clock=this.castle.stats; this.seed=this.castle.rng.seed;
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
    if (![1,2,3,4].includes(route.mode)) return route;
    new DataView(this.student.buffer).setInt16(25,route.lesson,true);
    this.start(nowTicks,route.mode); return route;
  }
  save(storage, profiles) {
    const bytes=studentForSave(this.student); if (!bytes) return;
    const name=readStudent(bytes).name;
    // DOS filename matching is case-insensitive. Reuse an existing host key,
    // without rewriting unrelated records or changing the stored layout.
    const key=Object.keys(profiles.students).find(n=>n.toUpperCase()===name.toUpperCase())??name;
    profiles.students[key]=Array.from(bytes); profiles.current=key;
    storage.setItem(SAVE_KEY,JSON.stringify(profiles)); this.student=bytes;
  }
}
