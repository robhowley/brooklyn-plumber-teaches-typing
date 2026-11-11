import { s16 } from './scoring.mjs';

// Student structure at DS:50a8, raw .STU read/write length 0x104 (FILE 0xe296/0xe34c).
// Unknown bytes deliberately preserved. Browser storage transport is NOT recovered.
export const STUDENT_SIZE = 0x104;
export const STUDENT_FIELDS = Object.freeze({ mode: 0x0f, lastWpm: 0x11, accuracy: 0x13,
  previousGoal: 0x15, goal: 0x17, lesson: 0x19, demo: 0x1b, profilePresent: 0x1c,
  character: 0x1d, durations: 0x1e, completed: 0x26, printed: 0x29, pending: 0x2c,
  problemKeys: 0x2f, errorCounts: 0x44 });
function view(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== STUDENT_SIZE)
    throw new RangeError('Expected exactly 260 student bytes');
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
function text(bytes, start, end) {
  let result = '';
  for (let i = start; i < end && bytes[i]; ++i) result += String.fromCharCode(bytes[i]);
  return result;
}
export function readStudent(bytes) {
  const v = view(bytes);
  return { name: text(bytes, 4, 15), mode: v.getInt16(15, true), lastWpm: v.getInt16(17, true),
    accuracy: v.getInt16(19, true), previousGoal: v.getInt16(21, true), goal: v.getInt16(23, true),
    lesson: v.getInt16(25, true), demo: bytes[27] !== 0, profilePresent: bytes[28] !== 0,
    character: bytes[29], durations: [30,32,34,36].map(o => v.getInt16(o,true)),
    completed: Array.from(bytes.slice(38,41)), printed: Array.from(bytes.slice(41,44)),
    pending: Array.from(bytes.slice(44,47)), problemKeys: text(bytes,47,68),
    errorCounts: Array.from({length:96},(_,i)=>v.getInt16(68+i*2,true)) };
}
// FILE 0xe184..0xe1cb runs BEFORE every student service, including load/save.
export function normalizeStudent(bytes) {
  const out = bytes.slice(); const v = view(out);
  v.setInt16(0x19, Math.max(1,Math.min(6,v.getInt16(0x19,true))),true);
  v.setInt16(0x13, Math.max(0,Math.min(100,v.getInt16(0x13,true))),true);
  const signedCharacter = (out[0x1d] << 24) >> 24;
  out[0x1d] = Math.max(1,Math.min(3,signedCharacter));
  return out;
}
// FILE 0xe39c zeroes structure; 0xee28..0xee83 installs these new-student defaults.
// Eight-character name limit is passed to editor at 0xed41. This helper does not implement editor UI.
export function newStudent(name) {
  if (!/^[\x20-\x7e]{1,8}$/.test(name) || name.includes('.'))
    throw new RangeError('Supply an already accepted 1..8 character ASCII student name without a dot');
  const out = new Uint8Array(STUDENT_SIZE); const v = view(out);
  for (let i=0;i<name.length;i++) out[4+i]=name.charCodeAt(i);
  out[28]=1; out[29]=1; v.setInt16(15,1,true); v.setInt16(23,5,true); v.setInt16(25,1,true);
  [2,5,5,10].forEach((n,i)=>v.setInt16(30+i*2,n,true)); // 0xebad..0xebc8, minutes
  return out;
}
// FILE 0xe31f..0xe35a, only called for profilePresent != 0. Save clears demo, writes magic.
export function studentForSave(bytes) {
  const out = normalizeStudent(bytes);
  if (!out[28]) return null;
  out.set([0x1a,0x53,0x54,0x55],0); out[27]=0;
  return out;
}
// FILE 0xe41c..0xe43f: printable ASCII range includes DEL (0x7f), counter wraps.
export function recordProblemKey(bytes, characterCode) {
  const out = bytes.slice(); const v = view(out); const index=s16(characterCode-32);
  if (index>=0 && index<96) v.setInt16(68+index*2,s16(v.getInt16(68+index*2,true)+1),true);
  return out;
}
// FILE 0xe446..0xe4ef ranks by descending signed count, ties by ascending character.
// Space is excluded from output; at most five entries. Presentation fallback is not fabricated.
export function problemKeys(bytes) {
  const {errorCounts} = readStudent(bytes);
  return errorCounts.map((count,i)=>({count,i})).filter(x=>x.i!==0&&x.count>0)
    .sort((a,b)=>b.count-a.count||a.i-b.i).slice(0,5).map(x=>' '+String.fromCharCode(x.i+32)).join('');
}
