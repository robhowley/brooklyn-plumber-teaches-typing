export const RULESET = 'original-fidelity-browser-v2';
import { selectLesson, KEY_GROUPS, CORPUS_VERSION } from './lessons.js';
export { KEY_GROUPS } from './lessons.js';
export const newId = () => globalThis.crypto.randomUUID();
const asciiUpper = text => text.replace(/[a-z]/g, c => String.fromCharCode(c.charCodeAt(0) - 32));

export const MODES = { outdoor: { name: 'Smash & Dash', duration: 120 }, underwater: { name: 'Wet World Challenge', duration: 300 }, castle: { name: 'Tunnel of Doom', duration: 300 }, practice: { name: 'Expert Express', duration: 600 } };
export function createAttempt({ mode = 'outdoor', duration = MODES[mode]?.duration, goal = 5, group = 0, character = 'Mario', text, lesson, content = 'original', guided = false, reducedMotion = false, studentId = null, courseRevision = 0 } = {}) {
  if (!Object.hasOwn(MODES, mode) || !Number.isInteger(group) || !KEY_GROUPS[group]
      || !Number.isInteger(goal) || goal < 1 || goal > 150 || !Number.isFinite(duration) || duration < 1 || duration > 3600
      || !Number.isSafeInteger(courseRevision) || courseRevision < 0) throw new RangeError('Invalid attempt options');
  if (lesson && text !== undefined) throw new TypeError('Choose lesson or explicit text');
  // Explicit text is for custom callers/tests, never the default historical path.
  lesson ??= text === undefined ? selectLesson({ mode, keyGroup: group, goal, content }) : {
    text, source: 'custom', label: 'Custom text, not original lesson text', corpusVersion: CORPUS_VERSION,
    requiredKeys: typeof text === 'string' ? [...new Set(text)].sort().join('') : '',
    records: [{ start: 0, end: text?.length }],
  };
  if (typeof lesson.text !== 'string' || !lesson.text.length || /[^\x20-\x7e]/.test(lesson.text)
      || typeof lesson.source !== 'string' || typeof lesson.label !== 'string' || typeof lesson.corpusVersion !== 'string' || !lesson.corpusVersion
      || lesson.requiredKeys !== [...new Set(lesson.text)].sort().join('')
      || !Array.isArray(lesson.records) || !lesson.records.length) throw new TypeError('Invalid lesson');
  let end = 0;
  for (const record of lesson.records) {
    if (!record || record.start !== end || !Number.isInteger(record.end) || record.end <= end || record.end > lesson.text.length) throw new TypeError('Invalid scored record bounds');
    end = record.end;
  }
  if (end !== lesson.text.length) throw new TypeError('Records must cover scored text');
  lesson = structuredClone(lesson);
  text = mode === 'outdoor' ? asciiUpper(lesson.text) : lesson.text;
  const speed = Math.max(72, goal * 14.4);
  const travel = { distance: 0, speed: mode === 'outdoor' ? speed : 48, buffered: false, contactAt: null, action: null,
    obstacles: mode === 'outdoor' ? Array.from({ length: 6 }, (_, id) => ({ id, x: reducedMotion ? 241 + id * 120 : 550 + id * 120, cleared: false })) : [] };
  return { id: newId(), studentId, courseRevision, ruleset: RULESET, corpusVersion: lesson.corpusVersion, lesson, cursor: { recordIndex: 0, characterIndex: 0 }, terminalReason: null, failure: false, mode, guided, reducedMotion, travel, castleStage: 'thwomps', sandDepth: reducedMotion ? 22 : 0, sandLiftUntil: 0, pipe: null, character, duration, goal, group,
    text, correct: 0, errors: 0, elapsed: 0, elapsedCompensation: 0, status: 'running', pauseReason: '', lastAction: null };
}
export function score(correct, errors, ticks) {
  if (![correct, errors].every(n => Number.isSafeInteger(n) && n >= 0) || !Number.isSafeInteger(correct + errors) || !Number.isSafeInteger(ticks)) throw new RangeError('Invalid score state');
  const attempted = correct + errors;
  const wpm = ticks > 0 ? Number(BigInt(Math.max(0, correct - errors)) * 182n / BigInt(ticks)) : 0;
  if (!Number.isSafeInteger(wpm)) throw new RangeError('Score exceeds safe integer range');
  return { attempted, wpm, accuracy: attempted ? Number(BigInt(correct) * 100n / BigInt(attempted)) : 0 };
}
export function stats(s) {
  if (!Number.isFinite(s.elapsed) || s.elapsed < 0 || !Number.isFinite(s.duration) || s.duration < 1 || s.duration > 3600 || s.elapsed > s.duration) throw new RangeError('Invalid active clock');
  const ticks = Math.floor(s.elapsed * 182 / 10);
  return { ...score(s.correct, s.errors, ticks), ticks, remaining: Math.max(0, s.duration - s.elapsed) };
}
export function advanceTime(s, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Invalid time delta');
  stats(s);
  if (s.status !== 'running') return;
  if (!Number.isFinite(s.elapsedCompensation)) throw new RangeError('Invalid active clock');
  // Compensated cumulative addition avoids losing a tick at ordinary frame partitions.
  const delta = seconds - s.elapsedCompensation;
  const sum = s.elapsed + delta;
  s.elapsedCompensation = (sum - s.elapsed) - delta;
  const end = Math.min(s.duration, sum);
  // Split at contact so a buffered, real key has the same action time at any frame rate.
  const contact = s.travel.buffered ? s.travel.contactAt : Infinity;
  if (contact <= end) {
    move(s, contact - s.elapsed); s.elapsed = contact; acceptKey(s);
  }
  move(s, end - s.elapsed); s.elapsed = end;
  if (s.elapsed >= s.duration) { s.status = 'finished'; s.terminalReason = 'timeout'; s.travel.buffered = false; s.travel.contactAt = null; }
}
function move(s, seconds) {
  // Recreation timing, not recovered DOS values: sink 3 px/s, rise 12 px/s,
  // bounded to 22 px. Each correct key supports one third of a goal-paced
  // key interval: sustained typing below 60% of goal sinks, above it rises.
  // Integrate across expiry exactly so frame rate cannot change the depth.
  if (s.mode === 'castle' && s.castleStage === 'quicksand' && !s.reducedMotion) {
    const rising = Math.max(0, Math.min(seconds, s.sandLiftUntil - s.elapsed));
    s.sandDepth = Math.min(22, Math.max(0, s.sandDepth - rising * 12) + (seconds - rising) * 3);
  }
  if (s.reducedMotion || s.mode === 'practice') return;
  const distance = seconds * s.travel.speed;
  s.travel.distance += distance;
  for (const obstacle of s.travel.obstacles) {
    obstacle.x -= distance;
    while (obstacle.x < -40) {
      obstacle.x += 720;
      // Reuse only after leaving the screen. Never rename a visible object.
      if (obstacle.cleared) { obstacle.id += 6; obstacle.cleared = false; }
    }
  }
}
function acceptKey(s) {
  if (stats(s).attempted === Number.MAX_SAFE_INTEGER) throw new RangeError('Attempt count exhausted');
  const obstacle = s.travel.obstacles.find(o => o.id === s.correct);
  s.lastAction = { kind: 'correct', at: s.elapsed, obstacle: s.correct % 2 ? 'turtle' : 'block' };
  if (obstacle) {
    obstacle.cleared = true;
    s.travel.action = { ...s.lastAction, id: obstacle.id, x: obstacle.x, distance: s.travel.distance };
  }
  s.travel.buffered = false;
  s.travel.contactAt = null;
  s.correct++;
  s.cursor.characterIndex++;
  const record = s.lesson.records[s.cursor.recordIndex];
  if (s.cursor.characterIndex === record.end - record.start) {
    s.cursor.characterIndex = 0;
    s.cursor.recordIndex = (s.cursor.recordIndex + 1) % s.lesson.records.length;
  }
  if (s.mode === 'castle') {
    s.sandLiftUntil = s.elapsed + 4 / s.goal;
    // Reduced motion changes only on input, never through idle WPM decay.
    if (s.reducedMotion) s.sandDepth = Math.max(0, 1 - stats(s).wpm / s.goal) * 22;
  }
  if (s.reducedMotion && s.mode === 'outdoor') {
    s.travel.obstacles = Array.from({ length: 6 }, (_, i) => ({ id: s.correct + i, x: 241 + i * 120, cleared: false }));
  }
  if (s.mode === 'castle' && s.correct % 40 === 0) {
    s.castleStage = s.castleStage === 'thwomps' ? 'quicksand' : 'thwomps';
    s.pipe = { stage: 'inside', progress: 0.5 };
    pause(s, 'Safe inside the pipe. Resume to enter the next chamber.');
  }
}
export function pause(s, reason = 'Take a breath. Your time is safe.') {
  if (s.status === 'running') { s.status = 'paused'; s.pauseReason = reason; }
}
export function resume(s) { if (s.status === 'paused') { s.status = 'running'; s.pauseReason = ''; s.pipe = null; } }
export function typeKey(s, event) {
  const metrics = stats(s);
  if (s.status !== 'running' || s.elapsed >= s.duration || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || typeof event.key !== 'string' || !/^[\x20-\x7e]$/.test(event.key)) return 'ignored';
  if (metrics.attempted === Number.MAX_SAFE_INTEGER) throw new RangeError('Attempt count exhausted');
  const key = s.mode === 'outdoor' ? asciiUpper(event.key) : event.key;
  if (key === s.text[s.lesson.records[s.cursor.recordIndex].start + s.cursor.characterIndex]) {
    if (s.mode === 'outdoor' && !s.reducedMotion) {
      const target = s.travel.obstacles.find(o => o.id === s.correct);
      if (target.x < 189 || target.x > 241) {
        if (s.travel.buffered) return 'ignored';
        s.travel.buffered = true;
        s.travel.contactAt = s.elapsed + (target.x > 241 ? target.x - 241 : target.x + 720 - 241) / s.travel.speed;
        return 'buffered';
      }
    }
    acceptKey(s);
    return 'correct';
  }
  s.errors++;
  s.lastAction = { kind: 'error', at: s.elapsed };
  return 'error';
}
export function result(s) {
  const metrics = stats(s);
  return { id: s.id, studentId: s.studentId, courseRevision: s.courseRevision, ruleset: s.ruleset, corpusVersion: s.corpusVersion, source: s.lesson.source, label: s.lesson.label, elapsed: s.elapsed, terminalReason: s.terminalReason, failure: s.failure, guided: s.guided, mode: s.mode, character: s.character, group: s.group, goal: s.goal, duration: s.duration, correct: s.correct, errors: s.errors, ...metrics,
    passed: s.status === 'finished' && s.terminalReason === 'timeout' && s.elapsed === s.duration && !s.failure && metrics.attempted > 0 && metrics.wpm >= s.goal && metrics.accuracy >= 90 };
}
export function fingerHint(key, mode) {
  if (mode === 'outdoor' && /^[A-Z]$/.test(key)) key = key.toLowerCase();
  if (key === ' ') return 'Either thumb · space';
  const groups = [['Left little', '1qaz!QA Z~`'.replaceAll(' ', '')], ['Left ring', '2wsx@WSX'], ['Left middle', '3edc#EDC'], ['Left index', '45rtfgvb$%RTFGVB'], ['Right index', '67yuhjnm^&YUHJNM'], ['Right middle', '8ik,*IK<'], ['Right ring', '9ol.(OL>'], ['Right little', '0p;:/?\'"[]{}-_=+\\|)P']];
  return `${groups.find(([, keys]) => keys.includes(key))?.[0] || 'Right little'} finger${/[A-Z~!@#$%^&*()_+{}|:"<>?]/.test(key) ? ' + opposite Shift' : ''}`;
}
