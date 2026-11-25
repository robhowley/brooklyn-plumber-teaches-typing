// Static translation of /MARIO/WINMARIO.EXE;1, SHA256
// 39a4fb53384afbfec13063c2f4c67d51013b1f8ea494788c88f1ac6c12f47f22.
// FILE offsets are member-relative. No DOM, storage, clock reads or media I/O.
import {typingSpeed} from './typing.js';
const u16 = n => n & 65535;
const s16 = n => (n << 16) >> 16;
const copy = value => structuredClone(value);
const seconds = n => Math.floor((n >>> 0) / 1000);

// FILE 0x32f4..0x3352. Unlike Outside, keeps backtick/NUL and normalizes
// whitespace with a process-retained latch. Bounded refusal is browser safety.
export function createWaterReader(lesson, lastByte = 0) {
  const bytes = Uint8Array.from(lesson.bytes);
  let offset = lesson.startOffset ?? 0;
  if (!bytes.length || !Number.isInteger(offset) || offset < 0 || offset >= bytes.length) throw new RangeError('Water lesson');
  return {
    next() {
      for (let visits = 0; visits < bytes.length * 2; visits++) {
        let byte = bytes[offset] & 127;
        offset = (offset + 1) % bytes.length;
        if (byte === 126) continue;
        if ([9,10,13].includes(byte)) byte = 32;
        if (byte === 32 && lastByte === 32) continue;
        lastByte = byte; return byte;
      }
      throw new RangeError('Water lesson cannot produce a byte');
    },
    snapshot: () => ({offset, lastByte}),
  };
}

// Required generated tables: FILE 0x20bc0..0x20c6e, 0x20c70..0x20c98,
// and ten signed stride-four samples at 0x20c98..0x20cbe. Sprite selectors
// 14,15,25..33 are NE bitmap-list joins, not embedded source arrays.
function animationInput(input) {
  if (!input) throw new TypeError('Water needs presentation.waterAnimation');
  const a = copy(input);
  const array = (v, length, min, max) => Array.isArray(v) && v.length === length && v.every(n => Number.isInteger(n) && n >= min && n <= max);
  if (!array(a.swimSelectors,3,25,27) || !array(a.fingerMap,128,0,255) ||
      !array(a.fingerX,10,0,65535) || !array(a.fingerY,10,0,65535) ||
      !array(a.pursuerY,10,-32768,32767) || !Array.isArray(a.bubblePositions) || a.bubblePositions.length !== 10 ||
      !a.bubblePositions.every(p => array(p,2,-32768,32767)) ||
      !a.frameLengths || Object.keys(a.frameLengths).sort().join(',') !== '14,15,25,26,27,28,29,30,31,32,33' ||
      !Object.entries(a.frameLengths).every(([k,n]) => n === ({14:10,15:12,25:6,26:6,27:6,28:3,29:5,30:10,31:25,32:2,33:1})[k])) throw new RangeError('Water animation');
  return a;
}

export function createWater({lesson, animation, character = 0, keyset = 0, durationSeconds, random, nowMs, retained = {}, states = {current:19,previous:0,cache:0}}) {
  if (typeof random?.next !== 'function') throw new TypeError('Water needs shared RNG');
  const a = animationInput(animation);
  states = copy(states);
  let pursuerX = s16(retained.pursuerX ?? 0), lastByte = retained.lastByte ?? 0, samplePhase = retained.samplePhase ?? 0;
  let reader, row, objects, actor, pursuer, special, total, errors, elapsed, inactivity, duration, sampledClock, running, held, pendingFinish;
  let peak, failure, stage, failureY, bubbleCount, specialState, specialByte, countdown, nextId;
  const histogram = Array(128).fill(0);
  const sprite = (selector, frame = 0) => ({selector,frame});
  const add = (kind, props) => { const o = {id:nextId++,kind,status:1,x:0,y:0,sprite:null,frame:0,anchor:'bottom',...props}; objects.push(o); return o; };
  const draw = (effects, operation) => effects.push({type:'draw',operation:copy(operation)});
  const audio = (effects, selector, operation) => effects.push({type:'audio',selector,operation});
  const expected = () => failure ? 0 : row[10];
  const speed = () => typingSpeed({total,errors,elapsed,divisor:[states.current,states.previous,states.cache].includes(18) ? 4 : 5});
  const hud = effects => draw(effects,{type:'hud',elapsed,typed:total,wrong:errors,wpm:speed()});
  const redraw = effects => { if (!failure) draw(effects,{type:'row',bytes:row.slice()}); };
  function snapshot() {
    return copy({state:19,character,keyset,row,expectedByte:expected(),total,errors,histogram,elapsedSeconds:elapsed,inactivitySeconds:inactivity,durationSeconds:duration,running,held,pendingFinish,objects,
      retained:{lastByte:reader.snapshot().lastByte,pursuerX,samplePhase},specialState,specialByte,specialCountdown:countdown,failure,stage,peak,wpm:speed()});
  }
  const result = effects => ({view:snapshot(),effects:copy(effects)});
  function enter(args) {
    const nextCharacter = args.character ?? character, nextKeyset = args.keyset ?? keyset;
    if (![0,1,2].includes(nextCharacter) || ![0,1,2,3,4].includes(nextKeyset)) throw new RangeError('Water selection');
    const nextReader = createWaterReader(args.lesson,lastByte), nextRow = Array(41).fill(0);
    for (let i = 10; i < 40; i++) nextRow[i] = nextReader.next();
    character = nextCharacter; keyset = nextKeyset; reader = nextReader; row = nextRow;
    if (args.states) states = copy(args.states);
    total = errors = elapsed = inactivity = peak = failure = stage = failureY = bubbleCount = nextId = 0;
    histogram.fill(0); objects = []; duration = u16(args.durationSeconds); sampledClock = seconds(args.nowMs);
    running = true; held = pendingFinish = false;
    // FILE 0x1b472..0x1b648, registration order is observable.
    for (let i = 0; i < 20; i++) add('seabed',{x:16*i,y:80,frame:i,sprite:sprite(31,i)});
    pursuer = add('pursuer',{x:-50,y:123,type:random.next()%2,sprite:sprite(29)});
    add('hand',{x:100,y:3,sprite:sprite(15,10)}); add('hand',{x:170,y:3,sprite:sprite(15,11)});
    add('finger',{}); actor = add('actor',{x:20,y:112,sprite:sprite(a.swimSelectors[character])});
    // FILE 0x1ac28..0x1acda draws include the overwritten shared countdown.
    const x = random.next()%250+20, y = random.next()%30+5;
    random.next();
    do { specialByte = random.next()%15+33; } while ([39,42,44].includes(specialByte));
    countdown = u16(30*(random.next()%90+15)); specialState = 1;
    special = add('special',{x,y,status:4,sprite:sprite(33)});
    add('label',{parent:special.id,byte:specialByte,offsetX:8,offsetY:7});
  }
  function entryEffects() {
    const effects = []; audio(effects,0,12); audio(effects,3,3); audio(effects,12,1);
    redraw(effects); hud(effects); effects.push({type:'ticking',value:true}); return effects;
  }
  function advance(o, selector) {
    o.frame = (o.frame+1)%a.frameLengths[selector]; o.sprite = sprite(selector,o.frame);
  }
  function callback(o,effects) {
    switch (o.kind) {
      case 'seabed': advance(o,31); break;
      // FILE 0x1b13a..0x1b255 reads actor BEFORE the actor callback.
      case 'pursuer': {
        const type = o.type; advance(o,type ? 30 : 29);
        if (failure) {
          if (stage === 1) { o.x = s16(o.x+3); if (o.x >= s16(actor.x-35)) stage = 2; }
          o.y = s16(failureY-5);
        } else {
          o.x = s16(actor.x-Math.trunc(s16(160-actor.y)/2)-48);
          if (o.x < -55) o.x = s16(o.x+368);
          o.y = s16(actor.y-5);
        }
        if (type === 1) o.y = s16(o.y+a.pursuerY[o.frame]);
        if (s16(pursuerX-40) > o.x) { o.type = 1-type; o.frame = 0; }
        pursuerX = o.x; break;
      }
      case 'finger': {
        const byte = expected();
        if (byte < 32 || byte >= 127) break;
        let index = a.fingerMap[byte]; if (index >= 40) index -= 40;
        let x = 100; if (index >= 6) { index--; x += 70; }
        if (index > 9) break;
        o.x = s16(x+a.fingerX[index]); o.y = s16(3+a.fingerY[index]); o.sprite = sprite(15,index); break;
      }
      // FILE 0x1af7e..0x1b139: low-word multiply before signed divide.
      case 'actor': {
        const wpm = speed(); if (wpm === null) throw new RangeError('Water WPM divide fault');
        peak = Math.max(10,peak,s16(wpm));
        const target = failure ? (stage === 2 ? 200 : o.y) : s16(157+Math.trunc(s16(-63*s16(wpm))/peak));
        if (failure && stage === 2 && o.y >= 199) pendingFinish = true;
        o.y = s16(o.y+Math.sign(target-o.y));
        if (!failure) {
          o.x = s16(o.x+1); if (o.x > 319) o.x = -55;
          if (inactivity >= 20) { failure = 1; stage = 1; failureY = o.y; }
        }
        if (failure && stage === 2) { o.sprite = sprite(28,character); audio(effects,12,2); }
        else advance(o,a.swimSelectors[character]);
        if (random.next()%10 === 0) {
          const [x,y] = a.bubblePositions[random.next()%10];
          if (bubbleCount < 7) { add('bubble',{x,y,age:0,sprite:sprite(32)}); bubbleCount++; }
        }
        break;
      }
      // FILE 0x1ae40..0x1af1c, NOT Outside's countdown callback.
      case 'special':
        if (specialState === 1 && actor.x >= 240) { specialState = 2; o.x = random.next()%100+20; o.y = 200; o.status = 2; }
        if (specialState === 2) {
          if (random.next()%2) o.x += random.next()%2 ? -1 : 1;
          o.x = Math.max(10,Math.min(130,o.x)); o.y = s16(o.y-3);
          if (o.y < 80) specialState = 3;
        }
        if (specialState === 3) { specialState = 0; o.status = 3; }
        break;
      case 'label':
        o.status = special.status; o.x = s16(special.x+o.offsetX); o.y = s16(special.y+o.offsetY); break;
      case 'bubble':
        o.y = s16(o.y-1); if (o.y < 79 || o.y > 197) { o.status = 3; bubbleCount--; }
        if (++o.age > 10) o.sprite = sprite(32,1); break;
    }
  }
  function scene(effects) {
    draw(effects,{type:'restore',top:74,bottom:240});
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i]; if (!o.status) continue;
      if (o.status === 3) { o.status = 0; continue; }
      if (o.status === 2) o.status = 1;
      if (o.kind !== 'hand') { effects.push({type:'callback',id:o.id,kind:o.kind}); callback(o,effects); }
      if (o.status !== 4 && o.sprite) draw(effects,{type:'object',object:o});
      if (o.kind === 'label' && o.status !== 4) draw(effects,{type:'glyph',byte:o.byte,x:o.x,y:o.y,color:15,unset:'backing'});
    }
    effects.push({type:'present'});
  }
  enter({lesson,character,keyset,durationSeconds,nowMs});
  return Object.freeze({
    snapshot,
    get entryEffects() { return copy(entryEffects()); },
    keyDown(byte) {
      const effects = []; if (!running || held || !byte) return result(effects);
      if (specialState === 2 && byte === specialByte) {
        held = true; effects.push({type:'background',bitmap:121},{type:'special-playback',character,audio:{selector:17,prepare:1,cues:[10,29,42,50],cueOperation:2,exit:[4,8]}}); return result(effects);
      }
      if (byte === expected()) {
        row.copyWithin(0,1,41); row[39] = reader.next(); row[40] = 0;
        redraw(effects); effects.push({type:'success'});
      } else {
        errors = u16(errors+1); const b = expected() & 127;
        if (b >= 32) histogram[b] = u16(histogram[b]+1);
        effects.push({type:'error',expectedByte:b,typedByte:byte});
      }
      total = u16(total+1); effects.push({type:'stats'}); hud(effects);
      inactivity = 0; effects.push({type:'inactivity-reset'}); return result(effects);
    },
    finishSpecial() {
      const effects = []; if (!held) return result(effects);
      // FILE 0x1ce23..0x1ce6d, then 0x16ae3..0x16afd. No HUD/counters.
      audio(effects,3,12); effects.push({type:'background',bitmap:121}); audio(effects,3,3);
      countdown = 0; specialState = 3; redraw(effects); held = false; return result(effects);
    },
    acceptedUpdate(nowMs,{transition = false,pause = false,sharedCallback = false} = {}) {
      const effects = []; if (held || !running) return result(effects);
      countdown = u16(countdown-1); effects.push({type:'special-countdown',value:countdown});
      if (transition) { effects.push({type:'transition'}); return result(effects); }
      if (sharedCallback) effects.push({type:'shared-callback'});
      if (!pause) scene(effects);
      if (pendingFinish) {
        running = false; pendingFinish = false;
        effects.push({type:'ticking',value:false});
        draw(effects,{type:'glyph',byte:row[10],x:80,y:48,color:244,unset:'backing'});
        effects.push({type:'teardown'},{type:'finish'});
      } else if (++samplePhase >= 5) {
        samplePhase = 0; const sample = seconds(nowMs), delta = Math.min((sample-sampledClock)>>>0,2);
        for (let i = 0; i < delta; i++) { elapsed = (elapsed+1)>>>0; inactivity = (inactivity+1)>>>0; if (elapsed >= duration) pendingFinish = true; }
        sampledClock = sample; if (delta) { effects.push({type:'stats'}); hud(effects); }
      }
      return result(effects);
    },
    reenter(args) {
      if (held) throw new Error('Water special transaction active');
      lastByte = reader.snapshot().lastByte; enter(args); return result(entryEffects());
    },
  });
}
