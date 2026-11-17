import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const coverage = JSON.parse(read('analysis/worlds/coverage.json'));
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function ranges(values) {
  assert.ok(Array.isArray(values) && values.length > 0);
  for (const range of values) {
    assert.match(range, /^0x[0-9a-f]+-0x[0-9a-f]+$/);
    const [start, end] = range.split('-').map(Number);
    assert.ok(start <= end, range);
  }
}

test('curated coverage retains the source pins and explicit non-exhaustive scope', () => {
  const pins = read('tools/source.py');
  assert.ok(pins.includes(`EXE_MEMBER = '${coverage.source}'`));
  assert.ok(pins.includes(`EXE_SHA256 = '${coverage.sha256}'`));
  assert.ok(pins.includes(`SHA256 = '${coverage.archiveSha256}'`));
  assert.match(coverage.offsetKind, /FILE byte offsets.*inclusive/);
  assert.match(coverage.scope, /not.*exhaustive equivalence/);
  assert.equal('translated' in coverage, false);
  assert.equal('notTranslated' in coverage, false);
  assert.deepEqual(Object.keys(coverage.statusMeaning).sort(), ['implemented', 'omitted', 'unknown']);
});

test('every coverage claim has a status, FILE citations and existing function/test references', () => {
  assert.ok(coverage.entries.length > 0);
  assert.equal(new Set(coverage.entries.map(entry => entry.id)).size, coverage.entries.length);
  for (const entry of coverage.entries) {
    assert.ok(Object.hasOwn(coverage.statusMeaning, entry.status), entry.id);
    assert.ok(entry.claim?.trim(), entry.id);
    ranges(entry.ranges);
    for (const resource of entry.resources ?? []) {
      assert.match(resource.member, /^MarioTea\/MARIO\/[A-Z0-9]+\.[A-Z0-9]+$/);
      assert.match(resource.sha256, /^[0-9a-f]{64}$/);
      assert.ok(resource.indices.length > 0);
      assert.ok(resource.indices.every(index => Number.isInteger(index) && index >= 0));
      if (resource.ids) assert.equal(resource.ids.length, resource.indices.length);
      if (resource.ranges) ranges(resource.ranges);
    }
    assert.ok(entry.implementation?.length > 0, entry.id);
    for (const reference of entry.implementation) {
      const [path, symbol] = reference.split('#');
      assert.match(path, /^(app|recovered)\/[\w/-]+\.mjs$/);
      assert.ok(symbol, reference);
      // Read authored JS as text, do not import modules or execute source data.
      assert.match(read(path), new RegExp(`^\\s*(?:export )?(?:async )?(?:function |const )?\\*?${escape(symbol)}\\s*(?:\\(|=)`, 'm'), reference);
    }
    assert.ok(entry.tests?.length > 0, entry.id);
    for (const reference of entry.tests) {
      const [path, name] = reference.split('#');
      assert.match(path, /^tests\/[\w/-]+\.(test|spec)\.mjs$/);
      assert.ok(name, reference);
      assert.match(read(path), new RegExp(`\\btest\\(['"]${escape(name)}['"]\\s*,`), reference);
    }
  }
});
