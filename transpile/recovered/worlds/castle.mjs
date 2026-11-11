/** MarioTea/MARIO/MARIO.EXE SHA256
 * 6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e.
 * FILE 0xbb06..0xde2d. Authored control flow, not a machine-code interpreter.
 * One step reaches one original bb06 wait. No browser/frame cadence is assumed.
 */
import { nextCastle, boundedRandom } from '../runtime/runtime.mjs';
import { timer, score } from '../control/scoring.mjs';
import { progression } from '../control/flow.mjs';
import { idleFrame, makeBonus } from '../outdoor/outdoor.mjs';
import { i16, castleApproach, castleRockface, castleSand, castleTextTarget,
  castleFailure, durationSeconds } from './routines.mjs';
import { thwompX, pipeX, pipeY } from './tables.mjs';

// dd93..ddfa: bound INCLUDES the delimiter; 499 text bytes + backtick is valid.
export function castleSentence(stream) {
  const bytes = [];
  for (let count = 1; ; count++) {
    const code = nextCastle(stream);
    if (count > 500) throw new RangeError('Castle sentence exceeds 500 collected bytes');
    if (code === 96) return Uint8Array.from(bytes);
    bytes.push(code & 255);
  }
}

export class CastleQueue {
  constructor(stream) {
    this.stream = stream;
    this.words = new Uint16Array(2000); // DS:46dd, 4000 bytes
    this.index = 8; // d7b8, not a moving text cursor
    this.length = 0; // DS:468d, last append endpoint, NOT decremented by shift
    this.correct = 0; // DS:4689, per scene
  }
  get target() { return this.words[this.index] & 255; }
  // b9e5..ba95. The initial metadata OR is overwritten by the first text store.
  append(bytes, startBits = 0, endBits = 0) {
    let start = this.words.findIndex(word => (word & 255) === 0);
    const nul = bytes.indexOf(0), length = nul < 0 ? bytes.length : nul;
    if (start < 0 || start + length >= 2000) throw new RangeError('Castle queue exhausted');
    this.length = start + length;
    this.words[start] |= startBits << 8;
    for (let i = 0; i < length; i++) this.words[start + i] = (bytes[i] << 24) >> 24;
    if (start + length === 0) throw new RangeError('Original empty append writes before queue');
    this.words[start + length - 1] |= endBits << 8;
  }
  shift() { this.words.copyWithin(0, 1); } // ba96: last word is NOT cleared
  initialize(sceneType) {
    if (sceneType !== 0 && sceneType !== 1) throw new RangeError('Unknown Castle text scene');
    this.words.fill(0);
    this.append(new Uint8Array(8).fill(32));
    for (let i = 0; i < 3; i++) this.append(castleSentence(this.stream), 0,
      sceneType === 0 || i === 2 ? 4 : 0);
    // bac5: five independent tests, not an unlimited whitespace trim.
    for (let i = 0; i < 5; i++) if (this.target === 32) this.shift();
    this.correct = 0;
  }
  accept() {
    this.correct = i16(this.correct + 1);
    this.words[this.index] |= 0x100;
    // bf02 divides SIGNED word by256, rather than shifting its unsigned bits.
    const end = (Math.trunc(i16(this.words[this.index]) / 256) & 4) !== 0;
    this.shift();
    return end;
  }
}

/** Session-owned observed-second fields survive Castle exit (DS:431e,4322).
 * Pass this same object on reentry. rng and stream are also caller-owned.
 * resources: {bonusXs (FILE 0x213b4), idleSchedule, idlePeriod} from local bytes.
 * Input is the runtime pending()/consume()/flush() transport, not a key latch.
 */
export class CastleController {
  constructor({ stream, rng, resources, persistent = { rockSecond: 0, sandSecond: 0 },
    character = 1, minutes = 0, priorDuration = 0, previousAccuracy = 0, option10 = false,
    fastScroll = false, profile = null, profilePresent = false, demo = false }) {
    if (demo) throw new RangeError('Castle demo input scheduling is not enabled');
    if (![1, 2, 3].includes(character)) throw new RangeError('Character must be 1..3');
    if (!resources?.idleSchedule?.length || !(resources.idlePeriod > 0) || resources.bonusXs?.length !== 3)
      throw new RangeError('Castle requires decoded idle schedule and bonus X table');
    Object.assign(this, { stream, rng, resources, persistent, character, option10,
      fastScroll, profile, profilePresent });
    this.queue = new CastleQueue(stream);
    this.stats = { attempts: 0, correct: 0, errors: 0, ticks: 0, running: false,
      lastTicks: 0, elapsedSeconds: 0, accuracy: 0, wpm: 0, previousAccuracy: i16(previousAccuracy),
      limitSeconds: durationSeconds(minutes, 300) };
    // Shared initializer 14e54 + Castle d83e..d880: same five draws as makeBonus.
    this.bonus = makeBonus(rng.seed, priorDuration, option10);
    rng.seed = this.bonus.seed;
    this.flags = { failed: false, timeout: false, exit: false };
    this.x = 0; this.y = 92; this.frame = this.idle();
    this.sceneType = 0; this.scene = 0; this.phase = 'entry'; this.cycle = 0;
    this.locked = false; this.completion = false; this.targetX = 0;
    this.lastInput = 0; this.walkCounter = 0; this.stage = 0; this.velocity = 0;
    this.rockfaces = []; this.clip = [0, 0, 319, 199]; this.effects = [];
    this.ended = false; this.awaitingBonus = false; this.pendingOperation = null;
    this.readyPending = true; // d55e, consumed at the tail of the first bb06 call
    this.sequence = this.scenes();
  }
  emit(type, fields = {}) { this.effects.push({ type, ...fields }); }
  sound(id) { this.emit('sound', { id }); }
  setClip(rect, file) { this.clip = [...rect]; this.emit('clip', { rect: [...rect], file }); }
  stopped() { return this.flags.exit || this.flags.timeout; }
  clock(operation) {
    this.stats = timer(this.stats, operation, this.nowTicks);
    this.emit('statistics', { operation });
  }
  refresh() {
    this.stats = timer(this.stats, 100, this.nowTicks);
    Object.assign(this.stats, score(this.stats));
    this.stats.previousAccuracy = this.stats.profileAccuracy;
    this.emit('statistics', { operation: 200 });
  }
  runFrame() {
    this.walkCounter = i16(this.walkCounter + 1);
    return { family: 'WALKING', index: (this.character - 1) * 30 + this.walkCounter % 12 };
  }
  sinkFrame(index) { return { family: 'WALKING', index: (this.character - 1) * 30 + 25 + index }; }
  idle(index = 0) {
    return { family: 'IDLE', index: [0, 47, 94][this.character - 1] + index };
  }
  move(x, y, frame, file, special = false) {
    this.emit('player', { oldX: this.x, oldY: this.y, oldFrame: this.frame,
      x: i16(x), y: i16(y), frame, file, special, clip: [...this.clip] });
    this.x = i16(x); this.y = i16(y); this.frame = frame;
  }
  updateRocks(playerX) {
    this.rockfaces = this.rockfaces.map((rock, index) => {
      const next = castleRockface(rock, playerX);
      if (next.triggered) this.sound(6);
      // c4e2..c540: phase alone is not a raster change. A stationary clean
      // record must not restore its rectangle over the foreground player.
      if (rock.dirty || next.x !== rock.x || next.y !== rock.y || next.resourceIndex !== rock.resourceIndex)
        this.emit('rockface', { index, previous: rock, current: next, playerX, file: 0xc410 });
      return { ...next, dirty: false };
    });
  }
  // daeb and dc2d, separate surviving observed-second clocks; no rearm after mode0.
  updateBonus(sand) {
    const b = this.bonus, field = sand ? 'sandSecond' : 'rockSecond';
    if (b.mode === 1) {
      if (this.persistent[field] !== this.nowSeconds) {
        this.persistent[field] = this.nowSeconds;
        if (b.countdown > 0) b.countdown = i16(b.countdown - 1);
      }
      if (b.countdown <= 0) {
        b.mode = 2;
        b.x = sand ? 61 : this.resources.bonusXs[boundedRandom(this.rng, 3)];
        b.y = sand ? 15 : 90;
        if (sand) b.countdown = 0;
      }
    }
    if (b.mode === 2) {
      const oldX = b.x, oldY = b.y;
      if (sand) {
        b.countdown = i16(b.countdown + 1);
        b.x = i16(b.x + 2);
        b.y = i16(b.y + (b.countdown < 20 ? 2 : b.countdown < 60 ? 0 : -2));
        if (b.countdown > 80) b.mode = 3;
      } else {
        b.y = i16(b.y - 1);
        if (b.y < 45) b.mode = 3;
      }
      this.emit('bonus-actor', { oldX, oldY, x: b.x, y: b.y, code: b.code,
        family: 'CASTLE', index: 14, clip: [this.clip[0], sand ? 37 : 69, this.clip[2], this.clip[3]] });
    }
    if (b.mode === 3) { this.emit('bonus-erase', { x: b.x, y: b.y }); b.mode = 0; }
  }
  operation(operation, input) {
    this.emit('operation', { operation, file: 0xbb06 });
    this.emit('clip-save-full', { saved: [...this.clip] });
    if (operation === 1) {
      this.lastInput = this.nowSeconds;
      this.queue.initialize(this.sceneType);
      input.flush(); this.emit('flush-input');
    } else if (operation === 2 || operation === 3) {
      const expected = this.queue.target;
      this.flags.failed = castleFailure({ operation, failed: this.flags.failed,
        attempts: this.stats.attempts, accuracy: this.stats.accuracy,
        now: this.nowSeconds, lastInput: this.lastInput });
      if (input.pending()) {
        const key = i16(input.consume());
        this.lastInput = this.nowSeconds; // even wrong, ignored, locked, transition keys
        if (key === 27) { this.flags.exit = true; this.emit('global-abort'); }
        else if (key === 0x12d) { if (this.option10) this.emit('conditional-quit', { file: 0x149fc }); }
        else if (key === 13) { if (this.option10) this.completion = true; }
        else if (operation !== 3) {
          if (this.bonus.mode === 2 && key === this.bonus.code) {
            this.clock(310); this.bonus.mode = 3; this.awaitingBonus = true;
            this.pendingOperation = operation;
            this.emit('bonus-playback', { file: 0xde6c, stem: ['mcas', 'lcas', 'pcas'][this.character - 1],
              sceneBefore: this.sceneType === 1 ? 0 : this.scene, waitsPerPacket: 2 });
            return;
          }
          if (key >= 32 && key < 127 && !this.locked) {
            this.stats.attempts = i16(this.stats.attempts + 1);
            if (key === expected) {
              this.stats.correct = i16(this.stats.correct + 1);
              const end = this.queue.accept();
              this.completion = this.completion || end; this.sound(1);
            } else {
              this.stats.errors = i16(this.stats.errors + 1); this.sound(11);
              this.emit('key-error', { expected, file: 0xbef0 });
            }
          }
        }
      }
      this.targetX = castleTextTarget(this.queue.correct, this.queue.length, this.targetX);
    } else if (operation === 4) this.emit('text-clear', { file: 0xbf5c });
    this.operationTail(operation);
  }
  operationTail(operation) {
    if (operation !== 4) this.emit('text', { words: this.queue.words.slice(0, 40),
      file: operation === 1 ? 0xbc21 : 0xbf4a });
    if (operation !== 3) this.refresh(); // bfd6: operation3 does NOT refresh score/time
    if ((this.stats.elapsedSeconds | 0) >= (this.stats.limitSeconds | 0)) this.flags.timeout = true;
    this.emit('wait-changed-tick', { file: 0xc01c });
    this.emit('clip-restore', { rect: [...this.clip] });
    if (this.readyPending) {
      this.emit('player-erase', { x: this.x, y: this.y, frame: this.frame, file: 0xc058 });
      this.emit('ready', { file: 0xc060 });
      this.emit('music', { operation: 4, file: 0xc069 });
      this.readyPending = false;
    }
  }
  /** Called only after local BAN/ANI playback completes. Does not advance the scene. */
  resumeBonus({ nowTicks, nowSeconds, input }) {
    if (!this.awaitingBonus) throw new Error('No Castle bonus awaiting completion');
    this.effects = []; this.nowTicks = nowTicks | 0; this.nowSeconds = nowSeconds | 0;
    for (const rock of this.rockfaces) rock.dirty = true;
    this.emit('bonus-restore', { scene: this.sceneType === 1 ? 2 : this.scene,
      palette: 'castle-character', reloadResources: true, file: 0xbe09 });
    this.lastInput = this.nowSeconds;
    this.clock(300); input.flush(); this.emit('flush-input');
    this.targetX = castleTextTarget(this.queue.correct, this.queue.length, this.targetX);
    this.operationTail(this.pendingOperation);
    this.pendingOperation = null; this.awaitingBonus = false;
    return this.effects;
  }
  step({ nowTicks, nowSeconds, input }) {
    if (this.awaitingBonus) throw new Error('Complete Castle bonus before stepping');
    this.effects = [];
    if (this.ended) return this.effects;
    this.nowTicks = nowTicks | 0; this.nowSeconds = nowSeconds | 0;
    const next = this.sequence.next();
    if (next.done) this.finish();
    else this.operation(next.value, input);
    return this.effects;
  }
  // c082..c27b, abort check AFTER movement and BEFORE operation3. Fast branch polls once.
  *scroll(scene, y) {
    this.phase = 'scroll'; this.emit('scroll-begin', { scene, y, file: 0xc082 });
    let interrupted = false;
    if (this.fastScroll) this.x = i16(this.x - 260);
    else for (let step = 0; step < 40; step++) {
      this.emit('scroll-strip', { scene, step, scratchBias: -256 + 8 * (step + 1) });
      // c186..c1bb: preserve the actor position BEFORE scrolling for restore.
      this.move(this.x - 8 + 1 + (step & 1), y, this.idle(), 0xc1bb, true);
      if (this.stopped()) { interrupted = true; break; }
      yield 3;
    }
    this.scene = scene;
    this.emit('scroll-end', { scene, interrupted, file: 0xc202 });
    if (this.fastScroll) yield 3;
    return interrupted;
  }
  *walkTo(target, y, file, atLeastOnce = false, dx = 4, sink = false) {
    do {
      if (!atLeastOnce && this.x >= target) break;
      atLeastOnce = false;
      if (sink) this.walkCounter = i16(this.walkCounter + 1);
      const frame = sink ? this.sinkFrame(Math.trunc(this.walkCounter / 2) % 5) : this.runFrame();
      this.move(this.x + dx, y, frame, file);
      if (this.stopped()) return false;
      yield 3;
    } while (this.x < target);
    return true;
  }
  // ca14..cb14 and d127..d227. Draw on EVERY comparison, including the final false one.
  *pipes(second) {
    this.phase = second ? 'pipe2-bumps' : 'pipe1-bumps';
    for (let index = 0; index < 5; index++) {
      const table = index + (second ? 5 : 0);
      const sprite = { family: 'CASTLE', index: 4 + table, x: pipeX[table], y: pipeY[table] };
      this.emit('pipe-draw', sprite); this.sound(7);
      for (let hold = 0; hold < 4; hold++) {
        yield 3;
        if (this.stopped()) return false;
      }
      this.emit('pipe-erase', sprite);
      for (let delay = 0; ; delay++) {
        const threshold = 4 + boundedRandom(this.rng, 6);
        this.emit('pipe-delay-test', { delay, threshold, file: second ? 0xd1f8 : 0xcae5 });
        if (threshold <= delay) break;
        yield 3;
        if (this.stopped()) return false;
      }
    }
    return true;
  }
  *failure(sand) {
    this.phase = sand ? 'sand-failure' : 'rock-failure';
    let count = 0;
    if (sand) {
      do {
        count = (count + 1) % 10;
        this.move(this.x, this.y + (count & 1), this.sinkFrame(Math.trunc(count / 2)), 0xc3d4);
        this.updateBonus(true);
        yield 3; // no abort/timeout early return in this failure subroutine
      } while (this.y < 95);
    } else {
      for (;;) {
        const frame = idleFrame(count, this.resources.idleSchedule, this.resources.idlePeriod);
        if (frame.ticks === 0) break; // c2a4 returns, rather than restarting idle cycle
        count = frame.ticks;
        this.move(this.x, this.y, this.idle(frame.index), 0xc319);
        this.updateBonus(false); this.updateRocks(i16(this.x + 60));
        yield 3;
      }
    }
  }
  *scenes() {
    this.clock(320);
    this.emit('scene', { scene: 0, file: 0xd68f });
    for (;;) {
      this.sceneType = 0;
      if (this.cycle && (yield* this.scroll(0, 92))) return;
      this.phase = 'rockfaces';
      this.rockfaces = thwompX.map(x => ({ x: x - 29, y: 40, phase: 0, resourceIndex: 0, dirty: true }));
      this.rockfaces.forEach((current, index) => this.emit('rockface-init', { index, current, file: 0xc70d }));
      this.completion = false; this.locked = false; this.stage = 0; this.velocity = 0; this.walkCounter = 0;
      yield 1;
      this.lastInput = this.nowSeconds; this.clock(300);
      for (;;) {
        if (this.completion) {
          if (this.stage < 3 && ++this.stage === 3) { this.clock(310); this.locked = true; }
          this.completion = false;
        }
        const target = [20, 120, 210, 279][this.stage];
        const next = castleApproach(this.x, this.velocity, target);
        this.velocity = next.velocity;
        const frame = this.velocity ? this.runFrame() : this.idle();
        this.updateRocks(this.x); this.updateBonus(false); // c886 BEFORE commit of new X
        this.move(next.x, this.y, frame, 0xc8a9);
        if (this.stopped()) return;
        yield 2;
        const complete = this.stage === 3 && this.x === target && this.rockfaces[2].phase === 100;
        if (this.flags.failed && this.x === target) { yield* this.failure(false); return; }
        if (complete) break;
      }
      yield 4;
      if (this.bonus.mode === 2) this.bonus.mode = 3;
      if (yield* this.scroll(1, 92)) return;
      this.phase = 'pipe1-enter'; this.setClip([0, 0, 46, 199], 0xc96f);
      if (!(yield* this.walkTo(48, 92, 0xc9bc))) return;
      this.setClip([0, 0, 319, 199], 0xca0c);
      if (!(yield* this.pipes(false))) return;
      this.phase = 'pipe1-exit'; this.setClip([272, 0, 319, 199], 0xcb23);
      this.x = 222;
      if (!(yield* this.walkTo(279, 36, 0xcb79))) return;
      this.setClip([0, 0, 319, 199], 0xcbca);
      this.sceneType = 1;
      if (yield* this.scroll(2, 36)) return;
      this.phase = 'sand-enter-walk';
      if (!(yield* this.walkTo(40, 36, 0xcc45, true))) return;
      this.setClip([0, 0, 319, 91], 0xcc95); this.sound(2);
      this.phase = 'sand-enter-fall';
      for (let velocity = 1; velocity <= 8; velocity++) {
        this.move(this.x + 3, this.y + velocity, this.sinkFrame(0), 0xcce7);
        if (this.stopped()) return;
        yield 3;
      }
      this.sound(9); this.phase = 'sand';
      this.completion = false; this.locked = false; this.walkCounter = 0; this.velocity = 0; this.stage = 0;
      yield 1;
      this.targetX = this.x; this.lastInput = this.nowSeconds; this.clock(300);
      for (;;) {
        const next = castleSand(this.x, this.targetX, this.stats.wpm);
        this.walkCounter = i16(this.walkCounter + 1);
        this.updateBonus(true);
        this.move(next.x, next.y, this.sinkFrame(Math.trunc(this.walkCounter / 3) % 5), 0xcdf6);
        if (this.stopped()) return;
        yield 2;
        const complete = this.completion;
        if (complete) { this.clock(310); this.completion = false; }
        if (this.flags.failed) { yield* this.failure(true); return; }
        if (complete) break;
      }
      this.phase = 'sand-exit-wade'; this.walkCounter = 0;
      if (!(yield* this.walkTo(210, this.y, 0xceb7, true, 2, true))) return;
      this.phase = 'sand-exit-jump'; this.sound(2);
      let vy = -9, landed = false;
      do {
        vy = i16(vy + 1);
        let y = i16(this.y + vy);
        if (vy > 0 && y >= 36) { y = 36; landed = true; }
        this.move(this.x + 4, y, this.sinkFrame(0), 0xcf5a);
        if (this.stopped()) return;
        yield 3;
      } while (!landed);
      this.setClip([0, 0, 319, 199], 0xcfac);
      this.phase = 'sand-exit-walk';
      if (!(yield* this.walkTo(279, 36, 0xcff7, true))) return;
      if (this.bonus.mode === 2) this.bonus.mode = 3;
      if (yield* this.scroll(3, 36)) return;
      this.phase = 'pipe2-enter'; this.setClip([0, 0, 44, 199], 0xd07f);
      if (!(yield* this.walkTo(48, 36, 0xd0cf))) return;
      this.setClip([0, 0, 319, 199], 0xd11f);
      if (!(yield* this.pipes(true))) return;
      this.phase = 'pipe2-exit'; this.x = 229;
      this.setClip([269, 0, 319, 199], 0xd23f);
      if (!(yield* this.walkTo(279, 92, 0xd28f))) return;
      this.setClip([0, 0, 319, 199], 0xd2e0);
      // d2e8: prechecked redundant walk is retained, no extra fabricated step.
      if (!(yield* this.walkTo(279, 92, 0xd32d))) return;
      if (this.stopped()) return;
      this.cycle++;
    }
  }
  finish() {
    this.ended = true; this.phase = 'ended';
    this.setClip([0, 0, 319, 199], 0xd39b);
    this.stats = timer(this.stats, 310, this.nowTicks); // stats130 at d3ad
    this.emit('statistics', { operation: 130 });
    this.emit('cleanup', { file: 0xd97d });
    // da7e reads stats DS:51ee (last refreshed WPM), not a new final refresh.
    this.result = this.profile ? progression(this.profile, { mode: 3,
      resultWpm: this.stats.wpm, profilePresent: this.profilePresent,
      failed: this.flags.failed, exitGate: this.flags.exit, gateOverride: this.option10 }) : null;
    if (this.result?.ending) this.emit('ending', { mode: this.result.ending, file: 0xdf46 });
    if (this.result?.save) this.emit('save-profile', { file: 0xdadc });
    this.emit('audio-reset', { file: 0xde20 });
    this.emit('results', { file: 0xde25, flags: { ...this.flags }, progression: this.result });
  }
}
