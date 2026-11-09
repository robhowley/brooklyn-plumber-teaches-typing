export const KEY_GROUPS = [
  { name: 'Home row', keys: 'asdfghjkl; ' },
  { name: 'Add top row', keys: 'asdfghjkl;qwertyuiop ' },
  { name: 'Add bottom row', keys: 'abcdefghijklmnopqrstuvwxyz; ' },
  { name: 'Add numbers', keys: 'abcdefghijklmnopqrstuvwxyz;0123456789 ' },
  { name: 'Add symbols', keys: 'abcdefghijklmnopqrstuvwxyz0123456789;,.!?\'"-:/() ' },
  { name: 'All keyboard', keys: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`~!@#$%^&*()-_=+[{]}\\|;:\'",<.>/? ' },
];
export const MODES = { outdoor: { name: 'Smash & Dash', duration: 120 }, underwater: { name: 'Wet World Challenge', duration: 300 }, castle: { name: 'Tunnel of Doom', duration: 300 }, practice: { name: 'Expert Express', duration: 600 } };
export function generateText(group = 0, length = 12000, seed = 19, mode = 'outdoor') {
  if (mode !== 'outdoor') {
    const passages = ['a lad asks a lass; a lass adds a salad; ', 'the sailor sails; the quiet lake is still; ', 'we swim past the reef; brave friends explore the castle; ', 'we swim 12 laps; collect 34 coins; open gate 56; ', 'swim past the reef! find 12 coins, then rest. ', 'The reef has 12 fish. Swim past the gate! "Ready?" Yes, let us go. '];
    const drills = KEY_GROUPS[group].keys.trim();
    const passage = passages[group] + drills + ' ';
    return passage.repeat(Math.ceil(length / passage.length)).slice(0, length);
  }
  const keys = KEY_GROUPS[group].keys;
  let text = '';
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    text += keys[seed % keys.length];
  }
  return text;
}
export function createAttempt({ mode = 'outdoor', duration, goal = 5, group = 0, character = 'Mario', text, guided = false, reducedMotion = false } = {}) {
  if (!MODES[mode]) mode = 'outdoor';
  if (!Number.isInteger(group) || !KEY_GROUPS[group]) group = 0;
  goal = Math.max(1, Math.min(150, Number(goal) || 5));
  const speed = Math.max(72, goal * 12);
  const travel = { distance: 0, speed: mode === 'outdoor' ? speed : 48, buffered: false, action: null,
    obstacles: mode === 'outdoor' ? Array.from({ length: 6 }, (_, id) => ({ id, x: reducedMotion ? 241 + id * 120 : 550 + id * 120, cleared: false })) : [] };
  return { mode, guided, reducedMotion, travel, castleStage: 'thwomps', pipe: null, character, duration: Math.max(1, Math.min(3600, Number(duration) || MODES[mode].duration)), goal, group,
    text: text || generateText(group, 12000, 19, mode), correct: 0, errors: 0, elapsed: 0, status: 'running', pauseReason: '', lastAction: null };
}
export function stats(s) {
  const attempted = s.correct + s.errors;
  return { attempted, wpm: s.elapsed ? s.correct * 12 / s.elapsed : 0, accuracy: attempted ? s.correct / attempted * 100 : 0, remaining: Math.max(0, s.duration - s.elapsed) };
}
export function advanceTime(s, seconds) {
  if (s.status !== 'running') return;
  const end = Math.min(s.duration, s.elapsed + Math.max(0, seconds));
  // Split at contact so a buffered, real key has the same action time at any frame rate.
  const target = s.travel.obstacles.find(o => o.id === s.correct);
  const contact = target && s.travel.buffered && !s.reducedMotion
    ? s.elapsed + (target.x > 241 ? target.x - 241 : target.x + 720 - 241) / s.travel.speed : Infinity;
  if (contact <= end) {
    move(s, contact - s.elapsed); s.elapsed = contact; acceptKey(s);
  }
  move(s, end - s.elapsed); s.elapsed = end;
  if (s.elapsed >= s.duration) { s.status = 'finished'; s.travel.buffered = false; }
}
function move(s, seconds) {
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
  const obstacle = s.travel.obstacles.find(o => o.id === s.correct);
  s.lastAction = { kind: 'correct', at: s.elapsed, obstacle: s.correct % 2 ? 'turtle' : 'block' };
  if (obstacle) {
    obstacle.cleared = true;
    s.travel.action = { ...s.lastAction, id: obstacle.id, x: obstacle.x, distance: s.travel.distance };
  }
  s.travel.buffered = false;
  s.correct++;
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
  if (s.status !== 'running' || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return 'ignored';
  if (event.key === s.text[s.correct % s.text.length]) {
    if (s.mode === 'outdoor' && !s.reducedMotion) {
      const target = s.travel.obstacles.find(o => o.id === s.correct);
      if (target.x < 189 || target.x > 241) {
        if (s.travel.buffered) return 'ignored';
        s.travel.buffered = true;
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
  return { guided: s.guided, mode: s.mode, character: s.character, group: s.group, goal: s.goal, duration: s.duration, correct: s.correct, errors: s.errors, ...metrics,
    passed: s.status === 'finished' && metrics.attempted > 0 && metrics.wpm >= s.goal && metrics.accuracy >= 90 };
}
export function fingerHint(key) {
  if (key === ' ') return 'Either thumb · space';
  const groups = [['Left little', '1qaz!QA Z~`'.replaceAll(' ', '')], ['Left ring', '2wsx@WSX'], ['Left middle', '3edc#EDC'], ['Left index', '45rtfgvb$%RTFGVB'], ['Right index', '67yuhjnm^&YUHJNM'], ['Right middle', '8ik,*IK<'], ['Right ring', '9ol.(OL>'], ['Right little', '0p;:/?\'"[]{}-_=+\\|)P']];
  return `${groups.find(([, keys]) => keys.includes(key))?.[0] || 'Right little'} finger${/[A-Z~!@#$%^&*()_+{}|:"<>?]/.test(key) ? ' + opposite Shift' : ''}`;
}
