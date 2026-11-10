import { RULESET, newId, MODES } from './engine.js';
import { CORPUS_VERSION } from './lessons.js';
import { validCourse, validPending, validResult, eligibleResult, freezePending, courseMode, destination } from './course.js';

export const LEGACY_STORAGE_KEY = 'typing-kingdom-v1';
export const STORAGE_KEY = 'typing-kingdom-v2';
export const LEGACY_RULESET = 'typing-kingdom-v1';
const characters = ['Mario', 'Luigi', 'Princess'];
const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
const named = name => typeof name === 'string' && name.trim().length > 0 && name.length <= 24;
const settings = () => ({ duration: 120, goal: 5, group: 0, sound: false, mode: 'outdoor', guided: true, durations: { outdoor: 120, underwater: 300, castle: 300, practice: 600 } });
export const defaults = ({ name = 'Player', character = 'Mario', corpusVersion = CORPUS_VERSION } = {}) => ({
  version: 2, id: newId(), ruleset: RULESET, corpusVersion, name, character, settings: settings(),
  course: { group: 0, goal: 5, revision: 0, graduated: false, pending: null }, results: [], certificates: [], legacy: null,
});
function validSettings(s, legacy = false) {
  return !!s && integer(s.duration, 1, 3600) && integer(s.goal, 1, 150) && integer(s.group, 0, 5)
    && typeof s.sound === 'boolean' && typeof s.guided === 'boolean' && Object.hasOwn(MODES, s.mode)
    && ((legacy && s.durations === undefined) || (s.durations && Object.keys(MODES).every(m => integer(s.durations[m], 1, 3600))));
}
function validLegacyResult(r) {
  return !!r && typeof r.passed === 'boolean' && Object.hasOwn(MODES, r.mode) && integer(r.group, 0, 5)
    && Number.isFinite(r.goal) && r.goal >= 1 && r.goal <= 150 && typeof r.date === 'string'
    && ['correct', 'errors', 'wpm', 'accuracy', 'duration'].every(k => Number.isFinite(r[k]) && r[k] >= 0)
    && Number.isInteger(r.correct) && Number.isInteger(r.errors) && r.accuracy <= 100 && r.duration >= 1 && r.duration <= 3600;
}
function validCertificate(c) {
  return !!c && ['outdoor', 'underwater', 'graduation'].includes(c.kind) && typeof c.name === 'string' && typeof c.date === 'string';
}
// This is a separate boundary: v2 integer goals/world resets never loosen the v1 course shape.
export function validateV1(p) {
  const c = p?.course;
  return !!p && p.version === 1 && named(p.name) && characters.includes(p.character) && validSettings(p.settings, true)
    && !!c && integer(c.group, 0, 5) && integer(c.goal, 5, 50) && c.goal % 5 === 0 && (c.group === 5 || c.goal === 5)
    && typeof c.graduated === 'boolean' && (!c.graduated || (c.group === 5 && c.goal === 50))
    && (c.pending === null || (!c.graduated && c.pending === `${c.group}:${c.goal}`))
    && Array.isArray(p.results) && p.results.every(validLegacyResult)
    && Array.isArray(p.certificates) && p.certificates.every(validCertificate);
}
export function convertV1(old) {
  if (!validateV1(old)) throw new TypeError('Invalid v1 save');
  const p = defaults({ name: old.name, character: old.character });
  p.settings = { ...p.settings, ...structuredClone(old.settings) };
  p.legacy = { storageKey: LEGACY_STORAGE_KEY, ruleset: LEGACY_RULESET, profile: structuredClone(old) };
  p.results = old.results.map(legacyEntry);
  p.certificates = old.certificates.map(legacyEntry);
  return p;
}
function legacyEntry(entry) {
  return { ...structuredClone(entry), ruleset: LEGACY_RULESET, provenance: { storageKey: LEGACY_STORAGE_KEY, version: 1 } };
}
function validNewCertificate(c, p, results) {
  const r = results.find(r => r.id === c.resultId);
  if (!r || !eligibleResult(r) || r.group !== 5 || r.wpm !== c.achieved || r.corpusVersion !== c.corpusVersion) return false;
  // Awards bind the first eligible result at that course position, not a later retry.
  const first = results.find(other => eligibleResult(other) && other.group === r.group
    && other.goal === r.goal && other.courseRevision === r.courseRevision && other.mode === r.mode);
  if (first?.id !== r.id) return false;
  if (c.kind === 'graduation') return r.mode === 'castle' && r.goal === 50
    && r.courseRevision === p.course.revision && p.course.graduated;
  const source = { group: r.group, goal: r.goal, revision: r.courseRevision };
  return c.kind === r.mode && r.mode === courseMode(source) && p.course.revision > r.courseRevision && courseMode(destination(source, r.wpm)) !== r.mode;
}
export function validateProfile(p) {
  if (!p || p.version !== 2 || typeof p.id !== 'string' || !p.id || p.ruleset !== RULESET
      || typeof p.corpusVersion !== 'string' || !p.corpusVersion || !named(p.name) || !characters.includes(p.character)
      || !validSettings(p.settings) || !validCourse(p.course) || !Array.isArray(p.results) || !Array.isArray(p.certificates)) return false;
  const current = p.results.filter(r => r?.ruleset === RULESET);
  if (new Set(current.map(r => r.id)).size !== current.length
      || current.some((r, i) => r.sequence !== i + 1)) return false;
  if (!p.results.every(r => r && (r.ruleset === RULESET ? validResult(r) && r.studentId === p.id && typeof r.date === 'string'
    : r.ruleset === LEGACY_RULESET && validLegacyResult(r) && r.provenance?.storageKey === LEGACY_STORAGE_KEY))) return false;
  if (!p.certificates.every(c => validCertificate(c) && (c.ruleset === LEGACY_RULESET ? c.provenance?.storageKey === LEGACY_STORAGE_KEY
    : c.ruleset === RULESET && validNewCertificate(c, p, current)))) return false;
  const newCertificates = p.certificates.filter(c => c.ruleset === RULESET);
  if (new Set(newCertificates.map(c => c.kind)).size !== newCertificates.length || (p.course.graduated && !newCertificates.some(c => c.kind === 'graduation'))) return false;
  if (p.legacy !== null && (!p.legacy || p.legacy.storageKey !== LEGACY_STORAGE_KEY || p.legacy.ruleset !== LEGACY_RULESET || !validateV1(p.legacy.profile))) return false;
  for (const field of ['results', 'certificates']) {
    const preserved = p[field].filter(entry => entry.ruleset === LEGACY_RULESET);
    const expected = p.legacy ? p.legacy.profile[field].map(legacyEntry) : [];
    if (JSON.stringify(preserved) !== JSON.stringify(expected)) return false;
  }
  return validPending(p);
}
export function createStore(profile = defaults()) {
  if (!validateProfile(profile)) throw new TypeError('Invalid student');
  return { version: 2, ruleset: RULESET, corpusVersion: profile.corpusVersion, currentStudentId: profile.id, students: [profile] };
}
export function validateStore(data) {
  return !!data && data.version === 2 && data.ruleset === RULESET && typeof data.corpusVersion === 'string' && !!data.corpusVersion
    && Array.isArray(data.students) && data.students.length > 0 && data.students.every(validateProfile)
    && new Set(data.students.map(p => p.id)).size === data.students.length
    && data.students.some(p => p.id === data.currentStudentId);
}
export const currentStudent = data => data.students.find(p => p.id === data.currentStudentId);
export function createStudent(data, options) {
  const p = defaults(options);
  if (!validateStore(data) || !validateProfile(p)) throw new TypeError('Invalid student');
  data.students.push(p);
  data.currentStudentId = p.id;
  return p;
}
export function selectStudent(data, id) {
  if (!data.students.some(p => p.id === id)) return false;
  data.currentStudentId = id;
  return true;
}
export function editStudent(data, id, changes) {
  const p = data.students.find(p => p.id === id);
  if (!p || !changes || Object.keys(changes).some(k => !['name', 'character', 'settings'].includes(k))
      || (Object.hasOwn(changes, 'settings') && (!changes.settings || typeof changes.settings !== 'object'))) return false;
  const candidate = { ...p, ...changes, settings: changes.settings ? { ...p.settings, ...changes.settings, durations: { ...p.settings.durations, ...changes.settings.durations } } : p.settings };
  if (!validateProfile(candidate)) return false;
  Object.assign(p, candidate);
  return true;
}
// Recovery sessions are usable, but cannot overwrite unreadable/unknown data.
export function loadStore(storage) {
  const fresh = () => createStore();
  let raw, legacyRaw;
  try {
    raw = storage.getItem(STORAGE_KEY);
    if (raw != null) {
      const data = JSON.parse(raw);
      if (!validateStore(data)) return { data: fresh(), persistence: { status: 'recovery', reason: 'invalid-v2', writable: false, raw } };
      data.students.forEach(p => freezePending(p.course.pending));
      return { data, persistence: { status: 'saved', reason: null, writable: true } };
    }
    legacyRaw = storage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw != null) {
      const legacy = JSON.parse(legacyRaw);
      if (!validateV1(legacy)) return { data: fresh(), persistence: { status: 'recovery', reason: 'invalid-v1', writable: false, raw: legacyRaw } };
      return { data: createStore(convertV1(legacy)), persistence: { status: 'migration-pending', reason: null, writable: true } };
    }
    return { data: fresh(), persistence: { status: 'unsaved', reason: null, writable: true } };
  } catch (error) {
    return { data: fresh(), persistence: { status: raw != null || legacyRaw != null ? 'recovery' : 'session-only', reason: error.message, writable: false, raw: raw ?? legacyRaw ?? null } };
  }
}
export function saveStore(session, storage) {
  if (!session.persistence.writable) return false;
  if (!validateStore(session.data)) {
    session.persistence = { ...session.persistence, status: 'session-only', reason: 'invalid-state' };
    return false;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(session.data));
    session.persistence = { status: 'saved', reason: null, writable: true };
    return true;
  } catch (error) {
    session.persistence = { ...session.persistence, status: 'session-only', reason: error.message };
    return false;
  }
}
// Single-profile callers retain their shape; the session remains available for recovery UI.
const profileSessions = new WeakMap();
export function loadProfile(storage) {
  const session = loadStore(storage), profile = currentStudent(session.data);
  profileSessions.set(profile, session);
  return profile;
}
export const storageState = profile => profileSessions.get(profile)?.persistence ?? { status: 'unsaved', reason: null, writable: true };
export function saveProfile(profile, storage) {
  let session = profileSessions.get(profile);
  if (!session) {
    session = loadStore(storage);
    if (!session.persistence.writable) { profileSessions.set(profile, session); return false; }
    if (session.persistence.status === 'unsaved') session.data.students = [];
    const index = session.data.students.findIndex(p => p.id === profile.id);
    if (index < 0) session.data.students.push(profile); else session.data.students[index] = profile;
    session.data.currentStudentId = profile.id;
    profileSessions.set(profile, session);
  }
  return saveStore(session, storage);
}
