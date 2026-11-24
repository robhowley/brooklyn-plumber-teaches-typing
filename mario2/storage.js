// Browser-owned envelope, not a STU import or a complete source-record schema.
export const STORAGE_KEY = 'mtt2-static-translation.students.v1';
const schema = 'mario2-students.v1';
const failure = (code, message) => ({ok: false, error: {code, message}});
const word = (r, p) => r[p] + 256 * r[p + 1];

function validName(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 8 &&
    [...name].every(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126);
}

// WINMARIO.EXE;1 SHA256 39a4fb53384afbfec13063c2f4c67d51013b1f8ea494788c88f1ac6c12f47f22.
// WINDATA-0005: FILE 0x132d4..0x13312, 0x17d16..0x17e58;
// XPRESS-0001: FILE 0x14032..0x140ec, 0x14132..0x14182, 0x14220..0x1426c.
// Validate only byte bounds, setup indices and ordinary terminated name. All
// other bytes (including bytes after the name's NUL) survive unchanged.
function validFile(file) {
  if (!file || file.schema !== schema || !Array.isArray(file.students)) return false;
  const names = new Set();
  for (const student of file.students) {
    if (!student || !validName(student.name)) return false;
    const folded = student.name.toUpperCase();
    if (names.has(folded)) return false;
    names.add(folded);
    const r = student.record;
    if (!Array.isArray(r) || r.length !== 292 ||
        !r.every(b => Number.isInteger(b) && b >= 0 && b <= 255) ||
        word(r, 1) > 4 || word(r, 3) > 2 || word(r, 5) > 3) return false;
    if (r[274 + student.name.length] !== 0 ||
        [...student.name].some((c, i) => r[274 + i] !== c.charCodeAt(0))) return false;
  }
  return file.currentName === null ||
    (typeof file.currentName === 'string' && file.students.some(s => s.name === file.currentName));
}

export function createStudentStore(getStorage) {
  function load() {
    let raw;
    try {
      raw = getStorage().getItem(STORAGE_KEY);
    } catch {
      return failure('unavailable', 'Student storage cannot be read. Existing data has not been replaced.');
    }
    if (raw === null) return {ok: true, value: {schema, currentName: null, students: []}};
    try {
      const file = JSON.parse(raw);
      if (validFile(file)) return {ok: true, value: file};
    } catch { /* Refuse malformed data, never repair it. */ }
    return failure('invalid', 'Student storage is invalid. Existing data has not been replaced.');
  }
  return {
    load,
    save(file) {
      if (!validFile(file)) return failure('invalid', 'Student data is invalid. Nothing was saved.');
      // Refuse a denied read or newly corrupted own key, even after an earlier
      // successful load. No enumeration, deletion, or legacy-key access.
      const previous = load();
      if (!previous.ok) return previous;
      try {
        getStorage().setItem(STORAGE_KEY, JSON.stringify(file));
        return {ok: true, value: undefined};
      } catch {
        return failure('write-failed', 'Student storage could not be written. Setup has not been saved.');
      }
    },
  };
}
