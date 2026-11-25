// Static translation: /MARIO/WINMARIO.EXE;1, SHA256
// 39a4fb53384afbfec13063c2f4c67d51013b1f8ea494788c88f1ac6c12f47f22.
// All FILE offsets refer to that member. Pure scene state, no clock or I/O.
import {typingSpeed} from './typing.js';
const u16 = n => n & 65535;
const s16 = n => (n << 16) >> 16;
const seconds = n => Math.floor((n >>> 0) / 1000);
const copy = value => structuredClone(value);

// FILE 0x33a4..0x33e5. NOT the Express row consumer. Bounded rejection
// of nonproductive custom input is a browser safety boundary, not a source loop.
export function createOutsideReader(lesson) {
  const bytes = Uint8Array.from(lesson.bytes);
  let offset = lesson.startOffset ?? 0;
  if (!bytes.length || !Number.isInteger(offset) || offset < 0 || offset >= bytes.length ||
      !bytes.some(b => ![96, 126].includes(b & 127))) throw new RangeError('Outside lesson');
  return {
    next() {
      for (;;) {
        const byte = bytes[offset] & 127;
        offset = (offset + 1) % bytes.length;
        if (byte !== 96 && byte !== 126) return byte;
      }
    },
    snapshot: () => ({offset}),
  };
}

// FILE 0x19103..0x19110 unsigned distance, 0x19266..0x192a0 signed
// strict minimum. Exported probes also make overflow/tie boundaries testable.
export const outsideCanSpawn = slots => !slots.some(o => o && u16(o.x - o.offsetX) > 220);
export function outsideTarget(slots) {
  let slot = null, x = 320;
  slots.forEach((o, i) => {
    if (o && !o.countdown && s16(o.x) < x) { slot = i; x = s16(o.x); }
  });
  return slot;
}

// FILE 0x19379..0x19407, arithmetic wraps before signed division.
export function outsideMovement(actorX, targetX, targetOffset, scrollSpeed, jumpPhase, retainedX) {
  const target = s16((jumpPhase ? retainedX : s16(targetX - targetOffset - 10)) - scrollSpeed);
  let movement = 0;
  if (s16(targetX) >= 0 && s16(actorX) !== target) {
    movement = Math.max(-8, Math.min(8, Math.trunc(s16(target - actorX) / 8) + (s16(actorX) < target ? 1 : -2)));
  }
  return {target, movement, x: Math.max(0, s16(actorX + movement)),
    scrollSpeed: Math.trunc(s16(5 * (s16(targetX) < 0 ? 319 : s16(targetX - targetOffset))) / 160)};
}

// Browser handoff: draw effects carry ordered operations with selector/frame
// references (source sprite lists), or bitmap IDs. anchor:'bottom' means y is
// the source baseline, resolved using that pinned sprite's height by renderer.
// retained is session-only. No student record fields are accepted or produced.
export function createOutside({lesson, animation, character = 0, keyset = 0, durationSeconds, random, nowMs, retained = {}}) {
  if (!random?.next) throw new TypeError('Outside needs the shared RNG');
  // Required presentation.outsideAnimation, extracted from pinned FILE
  // 0x2069c, 0x206b8/0x20774/0x20716 and 0x207da. No embedded tables.
  if (!animation) throw new TypeError('Outside needs presentation.outsideAnimation');
  const {jumpY, idleLength, idleThresholds} = copy(animation);
  let idleTicks = u16(retained.idleTicks ?? 0), idlePhase = u16(retained.idlePhase ?? 0);
  let walkDistance = u16(retained.walkDistance ?? 0), targetX = s16(retained.targetX ?? 0);
  let jumpFrame = u16(retained.jumpFrame ?? 0), samplePhase = retained.samplePhase ?? 0;
  let pendingFinish = !!retained.pendingFinish, pursuitPause = !!retained.pursuitPause;
  let read, objects, slots, characters, actor, cursor, special, finger, specialState, specialByte, specialCountdown;
  let total, errors, elapsed, inactivity, duration, sampledClock, running, held, scrollSpeed, jumpPhase, expectedIndex, soundGate;
  let nextId = 0;
  const histogram = Array(128).fill(0);
  const add = (kind, props = {}) => {
    const object = {id: nextId++, kind, status: 1, x: 0, y: 0, sprite: null, ...props};
    objects.push(object); return object;
  };
  const draw = (effects, operation) => effects.push({type: 'draw', operation: copy(operation)});
  const sprite = (selector, frame = 0) => ({selector, frame});
  function enter(args) {
    character = args.character ?? character; keyset = args.keyset ?? keyset;
    if (![0,1,2].includes(character) || ![0,1,2,3,4].includes(keyset)) throw new RangeError('Outside selection');
    if (!args.lesson.bytes.some(b => ![32,96,126].includes(b & 127))) throw new RangeError('Outside lesson has no target');
    read = createOutsideReader(args.lesson);
    objects = []; slots = Array(10).fill(null); characters = Array(10).fill(0);
    total = errors = elapsed = inactivity = expectedIndex = jumpPhase = soundGate = 0;
    histogram.fill(0); scrollSpeed = 1; duration = u16(args.durationSeconds);
    sampledClock = seconds(args.nowMs); running = true; held = false;
    add('spawner', {x: 320, y: 240});
    add('ground', {y: 168, phase: 0, baseX: 0, sprite: sprite(13)});
    add('ground', {x: 180, y: 168, phase: 0, baseX: 180, sprite: sprite(13)});
    actor = add('actor', {x: 20, y: 118, sprite: sprite(16 + character)});
    cursor = add('cursor', {sprite: sprite(10), offsetX: 0, target: null, frame: 0});
    // FILE 0x1ac28..0x1acda, then Outside overrides countdown at 0x198d6.
    const x = random.next() % 250 + 20, y = random.next() % 30 + 5;
    specialCountdown = random.next() % 30 + 30;
    do { specialByte = random.next() % 15 + 33; } while ([39,42,44].includes(specialByte));
    specialCountdown = 15 * (random.next() % 90 + 15); specialState = 1;
    special = add('special', {status: 4, x, y, sprite: sprite(12)});
    add('label', {status: 4, parent: special.id, offsetX: 6, offsetY: 3, byte: specialByte});
    add('hand', {x: 90, y: 190, sprite: {bitmap: 162}});
    add('hand', {x: 180, y: 190, sprite: {bitmap: 163}});
    finger = add('finger');
  }
  function snapshot() {
    return {character, keyset, objects: copy(objects), slots: slots.map(o => o ? copy(o) : null), characters: characters.slice(),
      actor: copy(actor), cursor: copy(cursor), expectedIndex, expectedByte: characters[expectedIndex] ?? 0,
      counters: {total, errors, speed: typingSpeed({total, errors, elapsed, divisor: 4})}, histogram: histogram.slice(),
      elapsed, inactivity, durationSeconds: duration, sampledClock, samplePhase, pendingFinish, running, held,
      scrollSpeed, jumpPhase, specialState, specialByte, specialCountdown, reader: read.snapshot(),
      retained: {idleTicks, idlePhase, walkDistance, targetX, jumpFrame, samplePhase, pendingFinish, pursuitPause}};
  }
  const result = effects => ({view: snapshot(), effects});
  // FILE 0x19a72..0x19ab8, delivered once by the entry coordinator.
  const entryEffects = () => [{type: 'interval', milliseconds: 50}, {type: 'draw', operation: {type: 'hud'}},
    {type: 'audio', selector: 11, operation: 1}, {type: 'audio', selector: 16, operation: 1},
    {type: 'audio', selector: 2, operation: 3}, {type: 'ticking', value: true}];
  function spawn() {
    if (!outsideCanSpawn(slots)) return;
    let byte; do { byte = read.next(); } while (byte === 32);
    const slot = slots.indexOf(null);
    if (slot < 0) return; // reader advances even when no free slot
    const type = random.next() % 2 + 200;
    const object = add('target', {type, slot, byte, countdown: 0,
      x: type === 200 ? 320 : 299, y: type === 200 ? 151 : 88,
      offsetX: type === 200 ? 30 : 0, sprite: sprite(type === 200 ? 11 : 12)});
    slots[slot] = object; characters[slot] = byte;
    add('label', {parent: object.id, slot, byte: byte >= 97 && byte <= 122 ? byte - 32 : byte,
      offsetX: type === 200 ? 15 : 6, offsetY: 3});
  }
  function updateActor() {
    if (inactivity >= 20) pendingFinish = true; // callback still completes
    const movement = outsideMovement(actor.x, cursor.x, cursor.offsetX, scrollSpeed, jumpPhase, targetX);
    targetX = movement.target; actor.x = movement.x; actor.y = 118; delete actor.anchor;
    scrollSpeed = movement.scrollSpeed;
    if (!jumpPhase) {
      if (movement.movement) { idleTicks = idlePhase = 0; } else idleTicks = u16(idleTicks + 1);
      if (s16(idleTicks) > 4) {
        idleTicks = 10; idlePhase = u16(idlePhase + 1);
        if (Math.trunc(s16(idlePhase) / 2) >= idleLength[character]) idlePhase = 0;
        const frameTime = Math.trunc(s16(idlePhase) / 2), thresholds = idleThresholds[character];
        const index = thresholds.findIndex(n => n > frameTime);
        actor.sprite = sprite(19 + character, index < 0 ? 0 : Math.max(0, index - 1));
        actor.y = 168; actor.anchor = 'bottom';
      } else actor.sprite = sprite(16 + character, Math.trunc(s16(walkDistance) / 6) % 12);
      walkDistance = u16(walkDistance + Math.abs(movement.movement));
    } else if (jumpPhase === 1 || jumpPhase === 2) {
      actor.sprite = sprite(22 + character, jumpFrame); actor.y = s16(118 + jumpY[jumpFrame]);
      jumpFrame = u16(jumpFrame + 1);
      if (s16(jumpFrame) >= 12) { jumpFrame = 0; jumpPhase = jumpPhase === 2 ? 3 : 0; }
    }
  }
  function updateTarget(o, effects) {
    o.x = s16(o.x - scrollSpeed);
    if (!o.countdown) return;
    o.countdown = u16(o.countdown - 1);
    if (!o.countdown) {
      o.status = 3; slots[o.slot] = null; characters[o.slot] = 0;
      if (o.type === 201) {
        // FILE 0x18fb0..0x19090: registrations occur during this traversal.
        for (const [dx,dy,bottom] of [[-2,-6,false],[-2,-3,true],[2,-6,false],[2,-3,false]]) {
          add('debris', {x: o.x, y: s16(o.y + (bottom ? 16 : 0)), dx, dy, sprite: sprite(12,1)});
        }
        effects.push({type: 'audio', selector: 11, operation: 2});
      }
    }
    if (o.type === 200) {
      if (o.countdown && !soundGate) { effects.push({type: 'audio', selector: 16, operation: 2}); soundGate = 1; }
      else if (!o.countdown) soundGate = 0;
      o.sprite = sprite(11, 1);
    }
  }
  function callback(o, effects) {
    switch (o.kind) {
      case 'spawner': spawn(); break;
      case 'ground': o.phase = u16(o.phase + scrollSpeed) % 20; o.x = o.baseX - o.phase; break;
      case 'actor': updateActor(); break;
      case 'cursor': {
        const slot = outsideTarget(slots); o.target = slot === null ? null : slots[slot].id;
        if (slot === null) { o.x = 320; break; }
        expectedIndex = slot;
        const target = slots[slot]; o.x = target.x; o.offsetX = target.offsetX;
        o.y = s16(target.y - (target.type === 200 ? 17 : 16));
        o.frame = (o.frame + 1) % 4; o.sprite = sprite(10, o.frame); break;
      }
      case 'special':
        if (specialState === 1) {
          specialCountdown = u16(specialCountdown - 1);
          if (s16(specialCountdown) <= 0) { specialState = 2; specialCountdown = 100; o.status = 2; }
        } else if (specialState === 2) {
          o.x = s16(o.x + Math.sign(actor.x - o.x)); specialCountdown = u16(specialCountdown - 1);
          if (s16(specialCountdown) <= 0) { specialState = 0; o.status = 3; }
        } else if (specialState === 3) { specialState = 0; o.status = 3; }
        break;
      case 'target': updateTarget(o, effects); break;
      case 'label': {
        const parent = objects.find(p => p.id === o.parent);
        if (!parent || parent.status === 3 || (parent.type === 200 && parent.countdown)) o.status = 3;
        else { o.x = s16(parent.x + o.offsetX); o.y = s16(parent.y + o.offsetY); o.status = parent.status; }
        break;
      }
      case 'finger': {
        const byte = characters[expectedIndex] ?? 0;
        // FILE 0x17e9a..0x17ea2 returns below32. Target labels use
        // the separate 0x18d44..0x18dbe branch, which retains controls.
        if (byte >= 32) draw(effects, {type: 'glyph', byte: byte >= 97 && byte <= 122 ? byte - 32 : byte, x: 151, y: 206, color: 15, unset: 'backing'});
        // Mapping is renderer-owned pinned font/hand data. Keep last finger
        // render input on controls, instead of clearing the prior highlight.
        if (byte >= 32 && byte < 127) o.expectedByte = byte;
        break;
      }
      case 'debris':
        o.x = s16(o.x + o.dx); o.y = s16(o.y + o.dy); o.dy = s16(o.dy + 1);
        if (o.y > 160) o.status = 3; // bitmap143 height8, FILE 0x18f3e..0x18f52
        break;
    }
  }
  function scene(effects) {
    draw(effects, {type: 'restore', top: 0, bottom: 189});
    // FILE 0x1a438..0x1a7db: re-read registration count after callback.
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i];
      if (!o.status) continue;
      if (o.status === 3) { o.status = 0; continue; }
      if (o.status === 2) o.status = 1;
      if (o.kind !== 'hand') {
        effects.push({type: 'callback', id: o.id, kind: o.kind});
        callback(o, effects);
      }
      if (o.status !== 4 && (o.sprite || o.kind === 'label' || o.kind === 'finger')) draw(effects, {type: 'object', object: o});
    }
    effects.push({type: 'present'});
  }
  function success(effects) {
    const target = objects.find(o => o.id === cursor.target);
    if (target) {
      target.countdown = 6;
      if (!jumpPhase && target.type === 201) { jumpPhase = 1; jumpFrame = 0; }
    }
    expectedIndex = u16(expectedIndex + 1);
    if (!characters[expectedIndex]) expectedIndex = 0;
    effects.push({type: 'success'});
  }
  enter({lesson, character, keyset, durationSeconds, nowMs});
  return Object.freeze({
    snapshot,
    entryEffects: entryEffects(),
    keyDown(byte) {
      const effects = [];
      if (!running || held || !byte) return result(effects);
      if (specialState === 2 && byte === specialByte) {
        held = true;
        effects.push({type: 'interval', milliseconds: 100}, {type: 'release-idle'}, {type: 'background', bitmap: 620},
          {type: 'special-playback', character, audio: {selector: 17, prepare: 1, cues: [10,29,42,50], cueOperation: 2, exit: [4,8]}});
        for (const o of objects) if (o.status === 1) o.status = 4;
        return result(effects);
      }
      const expected = characters[expectedIndex] ?? 0;
      if (expected >= 32) draw(effects, {type: 'glyph', byte: expected >= 97 && expected <= 122 ? expected - 32 : expected, x: 151, y: 206, color: 15, unset: 'backing'});
      if (byte === expected) success(effects);
      else {
        errors = u16(errors + 1);
        // FILE 0x19ae4 calls expected again while recording the error.
        if (expected >= 32) draw(effects, {type: 'glyph', byte: expected >= 97 && expected <= 122 ? expected - 32 : expected, x: 151, y: 206, color: 15, unset: 'backing'});
        if ((expected & 127) >= 32) histogram[expected & 127] = u16(histogram[expected & 127] + 1);
        effects.push({type: 'error', expectedByte: expected & 127, typedByte: byte});
      }
      total = u16(total + 1); effects.push({type: 'stats'}); draw(effects, {type: 'hud'});
      inactivity = 0; effects.push({type: 'inactivity-reset'});
      return result(effects);
    },
    // Completion acknowledges browser-paced playback, NOT a timer delivery.
    // Kept separate so queued deliveries/input cannot enter the held transaction.
    finishSpecial() {
      const effects = [];
      if (!held) return result(effects);
      for (const o of objects) if (o.status === 4) o.status = 1;
      effects.push({type: 'audio', selector: 2, operation: 12}, {type: 'background', bitmap: 120},
        {type: 'audio', selector: 2, operation: 3}, {type: 'reload-idle'}, {type: 'interval', milliseconds: 50});
      // FILE 0x16adf..0x16afa: only redraw (Outside RETF), no success,
      // counters, histogram or inactivity reset on this bypass.
      specialCountdown = 0; specialState = 3; held = false; return result(effects);
    },
    acceptedUpdate(nowMs, {transition = false, pause = pursuitPause, sharedCallback = false} = {}) {
      const effects = [];
      if (held || !running) return result(effects);
      pursuitPause = !!pause;
      specialCountdown = u16(specialCountdown - 1);
      effects.push({type: 'special-countdown', value: specialCountdown});
      if (transition) { effects.push({type: 'transition'}); return result(effects); }
      if (sharedCallback) effects.push({type: 'shared-callback'});
      if (!pursuitPause) scene(effects);
      if (pendingFinish) {
        running = false; pendingFinish = false;
        effects.push({type: 'ticking', value: false}, {type: 'teardown'}, {type: 'interval', milliseconds: 100}, {type: 'finish'});
      } else if (++samplePhase >= 5) {
        samplePhase = 0;
        const sample = seconds(nowMs), delta = Math.min((sample - sampledClock) >>> 0, 2);
        for (let i = 0; i < delta; i++) {
          elapsed = (elapsed + 1) >>> 0; inactivity = (inactivity + 1) >>> 0;
          if (elapsed >= duration) pendingFinish = true;
        }
        sampledClock = sample;
        if (delta) { effects.push({type: 'stats'}); draw(effects, {type: 'hud'}); }
      }
      return result(effects);
    },
    reenter(args) { if (held) throw new Error('Outside special transaction active'); enter(args); return result(entryEffects()); },
  });
}
