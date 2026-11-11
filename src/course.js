import { RULESET, score } from './engine.js';

export const courseMode = course => course.goal < 10 ? 'outdoor' : course.goal < 30 ? 'underwater' : 'castle';
export const coursePosition = course => `${course.group}:${course.goal}`;
export function validCourse(c) {
  return !!c && Number.isInteger(c.group) && c.group >= 0 && c.group <= 5
    && Number.isInteger(c.goal) && c.goal >= 5 && c.goal <= 50
    && Number.isSafeInteger(c.revision) && c.revision >= 0
    && typeof c.graduated === 'boolean' && (!c.graduated || (c.goal === 50 && c.group === 5 && c.pending === null));
}
export function validResult(r) {
  if (!r || r.ruleset !== RULESET || typeof r.id !== 'string' || !r.id || typeof r.studentId !== 'string' || !r.studentId
      || typeof r.corpusVersion !== 'string' || !r.corpusVersion || typeof r.source !== 'string' || typeof r.label !== 'string'
      || !Number.isSafeInteger(r.courseRevision) || r.courseRevision < 0
      || !['outdoor', 'underwater', 'castle', 'practice'].includes(r.mode)
      || !Number.isInteger(r.group) || r.group < 0 || r.group > 5 || !Number.isInteger(r.goal) || r.goal < 1 || r.goal > 150
      || !Number.isFinite(r.duration) || r.duration < 1 || r.duration > 3600 || r.elapsed !== r.duration
      || r.terminalReason !== 'timeout' || typeof r.failure !== 'boolean' || typeof r.guided !== 'boolean' || typeof r.passed !== 'boolean') return false;
  try {
    const ticks = Math.floor(r.elapsed * 182 / 10);
    const m = score(r.correct, r.errors, ticks);
    return r.ticks === ticks && r.attempted === m.attempted && r.wpm === m.wpm && r.accuracy === m.accuracy
      && r.passed === (m.attempted > 0 && m.wpm >= r.goal && m.accuracy >= 90 && !r.failure);
  } catch { return false; }
}
export function destination(c, achieved) {
  if (!Number.isSafeInteger(c.revision + 1)) throw new RangeError('Course revision exhausted');
  if (c.group < 5) return { group: c.group + 1, goal: c.goal, revision: c.revision + 1 };
  const mode = courseMode(c);
  const goal = mode === 'outdoor' ? Math.min(10, achieved + 2) : mode === 'underwater' ? Math.min(30, achieved + 5) : Math.min(50, achieved + 5);
  return { group: courseMode({ goal }) === mode ? 5 : 0, goal, revision: c.revision + 1 };
}
const samePosition = (a, b) => a.group === b.group && a.goal === b.goal && a.revision === b.revision;
export const eligibleResult = r => validResult(r) && r.guided && r.passed && r.mode !== 'practice'
  && (r.source === 'original' || r.source === 'generated');
const eligible = (p, r) => eligibleResult(r) && r.studentId === p.id
  && !p.course.graduated && samePosition(p.course, { group: r.group, goal: r.goal, revision: r.courseRevision }) && r.mode === courseMode(p.course);
export function validPending(profile) {
  const c = profile.course, pending = c.pending;
  if (pending === null) return true;
  if (!pending || c.graduated || c.revision === Number.MAX_SAFE_INTEGER || pending.studentId !== profile.id || pending.ruleset !== RULESET
      || !pending.source || !pending.destination || !samePosition(c, pending.source)) return false;
  const current = profile.results.filter(r => r.ruleset === RULESET);
  if (current.some((r, i) => r.sequence !== i + 1)) return false;
  const r = current.find(r => eligible(profile, r));
  return !!r && r.id === pending.resultId && !(c.group === 5 && c.goal === 50)
    && pending.achieved === r.wpm && pending.corpusVersion === r.corpusVersion
    && samePosition(pending.destination, destination(c, r.wpm));
}
export function freezePending(pending) {
  if (pending) { Object.freeze(pending.source); Object.freeze(pending.destination); Object.freeze(pending); }
  return pending;
}
export function recordResult(profile, result, date) {
  if (!validCourse(profile.course) || !validPending(profile)) throw new TypeError('Invalid course state');
  if (!validResult(result) || result.studentId !== profile.id || typeof date !== 'string') throw new TypeError('Invalid result');
  if (profile.results.some(r => r.id === result.id)) return false;
  // Persist append order independently of array placement and caller timestamps.
  const sequence = profile.results.filter(r => r.ruleset === RULESET).length + 1;
  const r = structuredClone({ ...result, date, sequence });
  const next = !profile.course.pending && eligible(profile, r) && !(profile.course.group === 5 && profile.course.goal === 50)
    ? destination(profile.course, r.wpm) : null;
  profile.results.push(r);
  const c = profile.course;
  // Keep the first earned transition even when a retry is faster or fails.
  if (c.pending || !eligible(profile, r)) return true;
  if (c.group === 5 && c.goal === 50) {
    c.graduated = true;
    c.pending = null;
    earn(profile, 'graduation', date, r);
  } else {
    c.pending = freezePending({ studentId: profile.id, resultId: r.id, ruleset: RULESET, corpusVersion: r.corpusVersion,
      achieved: r.wpm, source: { group: c.group, goal: c.goal, revision: c.revision }, destination: next });
  }
  return true;
}
function earn(profile, kind, date, r) {
  if (!profile.certificates.some(c => c.kind === kind && c.ruleset === RULESET)) {
    profile.certificates.push({ kind, date, name: profile.name, ruleset: RULESET, corpusVersion: r.corpusVersion, resultId: r.id, achieved: r.wpm });
  }
}
export function advanceCourse(profile, date) {
  const c = profile.course;
  if (!validCourse(c) || !validPending(profile)) throw new TypeError('Invalid course state');
  if (c.graduated || !c.pending) return false;
  if (typeof date !== 'string') throw new TypeError('Invalid transition date');
  const before = courseMode(c), pending = c.pending;
  const r = profile.results.find(r => r.id === pending.resultId);
  Object.assign(c, pending.destination, { pending: null });
  if (before !== courseMode(c)) earn(profile, before, date, r);
  return true;
}
