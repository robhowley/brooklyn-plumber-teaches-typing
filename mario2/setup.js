// Source for all recovered behavior below: /MARIO/WINMARIO.EXE;1, SHA256
// 39a4fb53384afbfec13063c2f4c67d51013b1f8ea494788c88f1ac6c12f47f22.
// Browser persistence of manual mode/keyset selections is an adaptation;
// original manual Express did not promise immediate saves (WINDATA-0009).
import {qualifies} from './report.js';
const word = (r, p) => r[p] + 256 * r[p + 1];
function setWord(r, p, value) {
  r[p] = value & 255;
  r[p + 1] = value >>> 8;
}
function freshRecord() {
  // WINDATA-0005, FILE 0x132d4..0x13312 and reset 0x1d700..0x1d750.
  const r = Array(292).fill(0);
  [2, 5, 5, 5, 10, 30, 50, 10].forEach((n, i) => setWord(r, 21 + 2 * i, n));
  return r;
}
function recordName(r) {
  const end = r.indexOf(0, 274);
  return String.fromCharCode(...r.slice(274, end));
}
function setName(r, name) {
  // Preserve bytes beyond the new terminator, like the source string writes.
  [...name].forEach((c, i) => { r[274 + i] = c.charCodeAt(0); });
  r[274 + name.length] = 0;
}

export function createSetup({store, nameKeyFlags}) {
  // DS:273f table supplied by generated presentation.json, no guessed whitelist.
  if (!nameKeyFlags || nameKeyFlags.length !== 256 ||
      !Array.from(nameKeyFlags).every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
    throw new TypeError('Expected 256 source name-key flags');
  }
  const flags = Array.from(nameKeyFlags);
  const loaded = store.load();
  let file = loaded.ok ? structuredClone(loaded.value) : null;
  let storageError = loaded.ok ? null : loaded.error;
  let record = file?.students.find(s => s.name === file.currentName)?.record.slice() ?? freshRecord();
  let state = 1;
  let duplicate = null;
  let report = null, terminal = false;
  const snapshot = () => ({state, name: recordName(record), character: word(record, 3),
    mode: word(record, 5), keyset: word(record, 1), durationSeconds: word(record, 27)*60,
    duplicate: duplicate && {...duplicate}, storageError: storageError && {...storageError},
    ...(terminal ? {terminal:true} : {})});

  function persist(candidate, nextState) {
    if (!file) return; // A failed load must never turn into an empty-file overwrite.
    const name = recordName(candidate);
    const next = structuredClone(file);
    // Case-insensitive identity models ordinary Windows filename collisions.
    const index = next.students.findIndex(s => s.name.toUpperCase() === name.toUpperCase());
    const student = {name, record: candidate.slice()};
    if (index < 0) next.students.push(student);
    else next.students[index] = student;
    next.currentName = name;
    const saved = store.save(next);
    storageError = saved.ok ? null : saved.error;
    if (saved.ok) {
      file = next;
      record = candidate;
      state = nextState;
      duplicate = null;
    }
  }
  function confirmName() {
    // XPRESS-0001 FILE 0x14060..0x140ec: NONAME, check, write, state4.
    if (!recordName(record)) setName(record, 'NONAME');
    if (file?.students.some(s => s.name.toUpperCase() === recordName(record).toUpperCase())) {
      // RT_DIALOG626 FILE 0x15f8000, SHA256
      // 147f289d7b40c58e3d6bae25f6ba3321dc7936f34e5eb41ad2705074dbb09a8f:
      // OK ID1 overwrites with the fresh record; Cancel ID2 keeps name editing.
      duplicate = {resource: 626};
    } else persist(record.slice(), 4);
  }
  return {
    snapshot,
    studentCount: () => file?.students.length ?? 0,
    reportContext: () => ({previous:word(record,11),threshold:word(record,29+2*word(record,5))}),
    beginReport(value) {
      if(state!==21 || report || terminal) return snapshot();
      report=value; state=10;
      return snapshot();
    },
    finishReport() {
      if(state!==10 || !report || report.applied) return snapshot();
      report.applied=true;
      // FILE 0x2ae0..0x2b58: manual +920=0 updates WPM and progression
      // in memory only. No accuracy/time/problem history write or source writer.
      setWord(record,11,report.speed);
      if(qualifies(report,word(record,29+2*word(record,5)),word(record,21+2*word(record,5)))) {
        if(word(record,1)===4) terminal=true;
        else setWord(record,1,word(record,1)+1);
      }
      return snapshot();
    },
    welcome() {if(!terminal) state=1; return snapshot();},
    dispatch(action) {
      if (!action) return snapshot();
      if (duplicate) {
        if (action.type === 'duplicate-result' && action.result === 1) persist(record.slice(), 4);
        else if (action.type === 'duplicate-result' && action.result === 2) duplicate = null;
        return snapshot();
      }
      if (state === 3 && action.type === 'confirm-name') confirmName();
      else if (state === 3 && action.type === 'name-key') {
        // WINDATA-0005 FILE 0x17d16..0x17e58: flags[key]&0x57,
        // max eight bytes, Backspace. Enter belongs only to confirm-name.
        const {key, byte} = action;
        const name = recordName(record);
        if (key === 8 && name.length) setName(record, name.slice(0, -1));
        else if (Number.isInteger(key) && key >= 0 && key <= 255 && key !== 13 &&
                 (flags[key] & 0x57) && name.length < 8 &&
                 Number.isInteger(byte) && byte > 0 && byte <= 255) {
          setName(record, name + String.fromCharCode(byte));
        }
      } else if (action.type === 'select') {
        // XPRESS-0001 FILE 0x14032..0x140ec, 0x14132..0x14182,
        // 0x14220..0x1426c. Ordinary Express setup selectors.
        const {selector, argument: arg} = action;
        if (state === 1 && selector === 2) state = 2;
        else if (state === 2 && selector === 3 && Number.isInteger(arg) && arg >= 0 && arg <= 2) {
          record = freshRecord();
          setWord(record, 3, arg);
          state = 3;
        } else if (state === 3 && selector === 4) confirmName();
        else if (state === 4 && selector === 5) state = 5;
        else if (state === 5 && selector === 14 && arg === 3) {
          const candidate = record.slice();
          setWord(candidate, 5, 3);
          persist(candidate, 14);
        } else if (state === 14 && selector === 17 && Number.isInteger(arg) && arg >= 0 && arg <= 4) {
          const candidate = record.slice();
          setWord(candidate, 1, arg);
          persist(candidate, 21);
        } else if ((state === 1 || state === 10) && selector === 39 && recordName(record) && word(record, 5) === 3 && !terminal) {
          report=null;
          state = 21; // Repeat and Continue use the actual in-memory record.
        }
      }
      return snapshot();
    },
  };
}
