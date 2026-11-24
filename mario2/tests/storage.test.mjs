import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudentStore, STORAGE_KEY} from '../storage.js';

function fixture() {
  const record = Array.from({length: 292}, (_, i) => (i * 13) & 255);
  for (const p of [1, 3, 5]) { record[p] = 0; record[p + 1] = 0; }
  record[274] = 65; record[275] = 0;
  return {schema: 'mario2-students.v1', currentName: 'A', students: [{name: 'A', record}]};
}
function memory(raw = null) {
  return {getItem(key) { assert.equal(key, STORAGE_KEY); return raw; },
    setItem(key, value) { assert.equal(key, STORAGE_KEY); raw = value; }, raw: () => raw};
}

test('independent key only, complete 292-byte round trip, no probing/enumeration', () => {
  assert.equal(STORAGE_KEY, 'mtt2-static-translation.students.v1');
  // Every property other than these two methods throws, including key/clear/length.
  const backing = memory();
  const access = new Proxy(backing, {get(target, key) {
    assert.ok(['getItem', 'setItem'].includes(key)); return target[key];
  }});
  const store = createStudentStore(() => access);
  assert.deepEqual(store.load().value, {schema: 'mario2-students.v1', currentName: null, students: []});
  const file = fixture();
  assert.equal(store.save(file).ok, true);
  assert.deepEqual(createStudentStore(() => access).load().value, file);
  const loaded = store.load().value;
  loaded.students[0].record[100] = 0;
  assert.deepEqual(store.load().value, file);
});

test('getter/read/write failures are distinct, never delete or overwrite on read denial', () => {
  assert.equal(createStudentStore(() => { throw Error(); }).load().error.code, 'unavailable');
  let writes = 0;
  const store = createStudentStore(() => ({getItem() { throw Error(); }, setItem() { writes++; }}));
  assert.equal(store.load().error.code, 'unavailable');
  assert.equal(store.save(fixture()).error.code, 'unavailable');
  assert.equal(writes, 0);
  const failed = createStudentStore(() => ({getItem: () => null, setItem() { throw Error('quota'); }}));
  assert.equal(failed.save(fixture()).error.code, 'write-failed');
});

test('malformed own key refuses both read and save without resetting', () => {
  for (const raw of ['{', 'null', '{}', '[]', '{"schema":"other"}']) {
    const backing = memory(raw);
    const store = createStudentStore(() => backing);
    assert.equal(store.load().error.code, 'invalid');
    assert.equal(store.save(fixture()).error.code, 'invalid');
    assert.equal(backing.raw(), raw);
  }
});

test('known setup indices/name/byte bounds are validated, unknown bytes are not normalized', () => {
  const mutations = [
    f => f.students[0].record.pop(),
    f => { f.students[0].record[99] = -1; },
    f => { f.students[0].record[99] = 256; },
    f => { f.students[0].record[99] = 0.5; },
    ...[[1, 5], [3, 3], [5, 4], [2, 1], [4, 1], [6, 1]].map(([p, n]) => f => { f.students[0].record[p] = n; }),
    f => { f.students[0].record[275] = 1; },
    f => { f.students[0].name = 'B'; },
    f => { f.currentName = 'MISSING'; },
    f => { f.students.push(structuredClone(f.students[0])); },
  ];
  for (const mutate of mutations) {
    const file = fixture(); mutate(file);
    const backing = memory();
    assert.equal(createStudentStore(() => backing).save(file).error.code, 'invalid');
    assert.equal(backing.raw(), null);
  }
  const backing = memory();
  assert.equal(createStudentStore(() => backing).save(fixture()).ok, true);
});

test('save rechecks newly corrupted own data', () => {
  const backing = memory();
  const store = createStudentStore(() => backing);
  assert.equal(store.load().ok, true);
  backing.setItem(STORAGE_KEY, 'broken');
  assert.equal(store.save(fixture()).error.code, 'invalid');
  assert.equal(backing.raw(), 'broken');
});
