import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CORPUS_VERSION, KEY_GROUPS, selectLesson, LESSON_COVERAGE, HISTORICAL_NOTICE, GENERATED_LABEL } from '../src/lessons.js';
import { parseMember, transformRecord, importLessons, sha256 } from '../scripts/import-lessons.mjs';
const corpus = JSON.parse(await readFile(new URL('../src/data/lessons.json', import.meta.url)));
import { createAttempt, typeKey, resume, advanceTime, result } from '../src/engine.js';
const modes = ['outdoor', 'underwater', 'castle', 'practice'];

test('shipped corpus retains reviewed content, 15 members and 136 valid records', () => {
  assert.equal(CORPUS_VERSION, 'mtt-1992-reviewed-1');
  assert.equal(corpus.corpusVersion, CORPUS_VERSION);
  assert.equal(sha256(JSON.stringify(corpus)), '25acc600dcda35e63e9994cf1fe44786bb6fd6474fe0227315057db8783d54b1');
  assert.equal(corpus.members.length, 15);
  assert.equal(new Set(corpus.members.map(m => m.member)).size, 15);
  const counts = { outdoor: 0, underwater: 0, castle: 0 };
  for (const member of corpus.members) {
    assert.match(member.member, /^[HTBNS](LETTERS|WORDS|SENTENC)\.LEE$/);
    for (const [i, record] of member.records.entries()) {
      assert.equal(record.record, i + 1);
      assert.match(record.text, /^[\x20-\x7e]+$/);
      assert.ok(!record.text.includes('`') && !record.text.includes('~'));
      assert.ok(record.sentenceEnds.every((end, j, ends) => Number.isInteger(end) && end > (ends[j - 1] ?? -1) && end <= record.text.length));
      assert.ok(record.themes.every(theme => typeof theme === 'string'));
      assert.ok(!('rawText' in record) && !('rawHex' in record));
    }
    counts[member.mode] += member.records.length;
  }
  assert.deepEqual(counts, { outdoor: 78, underwater: 41, castle: 17 });
});

test('offline reader rechecks every raw byte, hash and reference span, without shipping raw fixtures', { skip: !process.env.LESSON_RESEARCH_ROOT }, async () => {
  const result = await importLessons(process.env.LESSON_RESEARCH_ROOT);
  assert.deepEqual(result.data, corpus);
  const provenance = JSON.parse(await readFile(new URL('../research/provenance/lessons.json', import.meta.url)));
  assert.deepEqual(result.provenance, provenance);
});

test('byte parser retains record bytes, spans, hashes and control provenance', () => {
  const bytes = Buffer.from('~a\r\nb`~ C\tD \x1a', 'ascii');
  const records = parseMember(bytes);
  assert.deepEqual(records.map(r => r.byteSpan), [[1, 6], [7, 12]]);
  assert.deepEqual(records.map(r => r.rawText), ['a\r\nb`', ' C\tD ']);
  assert.equal(records[0].sha256, sha256(bytes.subarray(1, 6)));
  assert.deepEqual(records[0].controls, [{ offset: 2, kind: 'CR' }, { offset: 3, kind: 'LF' }, { offset: 5, kind: 'sentence-break' }]);
  assert.equal(bytes.toString('ascii'), '~a\r\nb`~ C\tD \x1a');
});

test('malformed byte fixtures fail closed', () => {
  for (const fixture of ['', '~', 'abc\x1a', '~abc', '~~a\x1a', '~a~\x1a', '~a\0b\x1a', '~a\x1ab\x1a', '~a\x7f\x1a']) {
    assert.throws(() => parseMember(Buffer.from(fixture, 'ascii')));
  }
  assert.throws(() => parseMember(Buffer.from([126, 255, 26])));
  assert.throws(() => parseMember('~a\x1a'));
});

test('proven reader transformations preserve exact case, spaces and sentence boundaries', () => {
  assert.deepEqual(transformRecord('a z; \r\n\t', 'outdoor'), { text: 'AZ;', sentenceEnds: [] });
  assert.deepEqual(transformRecord('a  b\r\nc\tD ', 'underwater'), { text: 'a b c D ', sentenceEnds: [] });
  assert.equal(transformRecord('a\rb', 'underwater').text, 'ab'); // Loader removes CR, not a new scored space.
  assert.deepEqual(transformRecord('A.  B.`  C.`\r\n', 'castle'), { text: 'A.  B.  C. ', sentenceEnds: [6, 10] });
  assert.throws(() => transformRecord('A.`\nB`', 'practice'), /unresolved/);
});

test('historical memberships include corrected punctuation and shifted row letters', () => {
  for (const group of [2, 3]) for (const c of ',./') assert.ok(KEY_GROUPS[group].keys.includes(c));
  for (const c of '@#$%^&*+<=>[]_{}') assert.ok(KEY_GROUPS[4].keys.includes(c));
  assert.ok(KEY_GROUPS[1].keys.includes('T') && KEY_GROUPS[1].keys.includes('P'));
  assert.equal(KEY_GROUPS[5].keys.length, 95);
});

test('exact mode/group original counts and per-record fallback coverage', () => {
  const expected = { outdoor: [27, 14, 15, 17, 5, 78], underwater: [0, 2, 8, 7, 13, 41], castle: [0, 0, 0, 1, 4, 17] };
  assert.equal(LESSON_COVERAGE.length, 36);
  for (const row of LESSON_COVERAGE) {
    assert.equal(row.records.filter(r => r.source === 'original').length, row.mode === 'practice' ? 0 : expected[row.mode][row.keyGroup]);
    for (const r of row.records) {
      assert.equal(r.missingKeys, [...new Set(r.requiredKeys)].filter(c => !KEY_GROUPS[row.keyGroup].keys.includes(c)).join(''));
      assert.equal(r.source, row.mode === 'practice' || r.missingKeys ? 'generated' : 'original');
    }
  }
  const topWords = selectLesson({ mode: 'underwater', keyGroup: 1 });
  assert.deepEqual(topWords.records.map(r => r.source), ['original', 'original', ...Array(5).fill('generated')]);
  assert.equal(topWords.source, 'generated');
  assert.ok(topWords.hasOriginal && topWords.hasGenerated);
  assert.match(topWords.label, /Original 1992 text with Generated practice, not original lesson text/);
  const numberSentences = selectLesson({ mode: 'castle', keyGroup: 3 });
  assert.deepEqual(numberSentences.records.map(r => r.source), ['generated', 'original', 'generated', 'generated']);
});

test('all 24 combinations and explicit alternatives are nonempty, supported, replayable cycles', () => {
  for (const mode of modes) for (let keyGroup = 0; keyGroup < 6; keyGroup++) for (const content of ['original', 'generated']) {
    const options = { mode, keyGroup, content, goal: 30 };
    const lesson = selectLesson(options);
    assert.deepEqual(selectLesson(options), lesson);
    assert.match(lesson.text, /^[\x20-\x7e]+$/);
    assert.ok([...lesson.text].every(c => KEY_GROUPS[keyGroup].keys.includes(c)));
    if (mode === 'outdoor') {
      assert.ok(!/[a-z ]/.test(lesson.text));
      if (content === 'generated') {
        const advertised = KEY_GROUPS[keyGroup].keys.replaceAll(' ', '').replace(/[a-z]/g, c => c.toUpperCase());
        assert.equal(lesson.requiredKeys, [...new Set(advertised)].sort().join(''));
      }
    }
    if (mode === 'underwater') assert.ok(!lesson.text.includes('  '));
    assert.equal(lesson.repeat, 'cycle');
    let end = 0;
    for (const r of lesson.records) {
      assert.equal(r.start, end);
      assert.ok(r.end > r.start);
      assert.equal(r.requiredKeys, [...new Set(lesson.text.slice(r.start, r.end))].sort().join(''));
      if (r.source === 'generated') assert.equal(r.label, GENERATED_LABEL);
      else {
        const original = corpus.members.find(m => m.member === r.member).records[r.record - 1];
        assert.equal(lesson.text.slice(r.start, r.end), original.text);
      }
      end = r.end;
    }
    assert.equal(end, lesson.text.length);
    // Exercise the real selector -> engine boundary, including every record edge.
    const attempt = createAttempt({ mode, group:keyGroup, goal:30, lesson, reducedMotion:true });
    assert.deepEqual(attempt.lesson, lesson);
    assert.deepEqual(createAttempt({mode,group:keyGroup,goal:30,content}).lesson, lesson);
    for (let cycle=0; cycle<2; cycle++) for (const [recordIndex, record] of lesson.records.entries()) {
      for (let offset=record.start; offset<record.end; offset++) {
        const cursor={recordIndex,characterIndex:offset-record.start};
        assert.deepEqual(attempt.cursor,cursor);
        if (offset===record.start || offset===record.end-1) {
          const wrong=lesson.text[offset]==='?'?'!':'?';
          assert.equal(typeKey(attempt,{key:wrong}),'error');
          assert.deepEqual(attempt.cursor,cursor);
        }
        assert.equal(typeKey(attempt,{key:lesson.text[offset]}),'correct');
        resume(attempt); // Castle's browser pipe pause does not consume text.
      }
      assert.deepEqual(attempt.cursor,{recordIndex:(recordIndex+1)%lesson.records.length,characterIndex:0});
    }
    assert.equal(attempt.correct,lesson.text.length*2);
    const retry=createAttempt({mode,group:keyGroup,goal:30,lesson:selectLesson(options),reducedMotion:true});
    assert.deepEqual(retry.cursor,{recordIndex:0,characterIndex:0});
    assert.equal(retry.text,attempt.text);
    assert.equal(typeKey(attempt,{key:lesson.text[0]}),'correct');
    advanceTime(attempt,attempt.duration);
    assert.equal(result(attempt).corpusVersion,CORPUS_VERSION);
    lesson.records[0].themes.push('mutated');
    assert.ok(!selectLesson(options).records[0].themes.includes('mutated'));
  }
});

test('all-keyboard consumes every member in H/T/B/N/S source order and retries at H', () => {
  for (const mode of modes.slice(0, 3)) {
    const selected = selectLesson({ mode, keyGroup: 5 });
    assert.equal(selected.source, 'original');
    assert.deepEqual([...new Set(selected.records.map(r => r.member[0]))], ['H', 'T', 'B', 'N', 'S']);
    assert.match(selected.selectionPolicy, /Browser choice.*retry restarts H/);
    for (const prefix of ['H', 'T', 'B', 'N', 'S']) {
      const records = selected.records.filter(r => r.member[0] === prefix);
      assert.deepEqual(records.map(r => r.record), records.map((_, i) => i + 1));
    }
    assert.equal(selectLesson({ mode, keyGroup: 5 }).records[0].record, 1);
  }
});

test('practice goal bands select provenance but never claim unresolved scored wrapping', () => {
  for (const [goal, suffix] of [[1, 'LETTERS'], [9, 'LETTERS'], [10, 'WORDS'], [29, 'WORDS'], [30, 'SENTENC'], [150, 'SENTENC']]) {
    const selected = selectLesson({ mode: 'practice', keyGroup: 5, goal });
    assert.ok(selected.records.every(r => r.member.endsWith(`${suffix}.LEE`) && r.source === 'generated' && /unresolved/.test(r.reason)));
    assert.equal(selected.hasOriginal, false);
  }
});

test('review notice and themes identify sensitive history without editing wording', () => {
  for (const word of ['outdated', 'war', 'slavery', 'assassination', 'disasters', 'generated']) assert.ok(HISTORICAL_NOTICE.includes(word));
  const lesson = selectLesson({ mode: 'castle', keyGroup: 5 });
  assert.ok(lesson.text.includes('dentures made of wood'));
  assert.ok(lesson.text.includes('nine planets'));
  assert.ok(lesson.records.some(r => r.themes.includes('slavery')));
  assert.ok(lesson.records.some(r => r.themes.includes('atomic-bombing')));
  assert.ok(lesson.records.some(r => r.themes.includes('disaster')));
});

test('punctuation is literal text, JSON round trips without HTML entities or evaluation', () => {
  const lesson = selectLesson({ mode: 'underwater', keyGroup: 4 });
  for (const text of ['112<200', '"This & That!"', '{One, Two, Three}', '[Lost & Found]']) assert.ok(lesson.text.includes(text));
  assert.equal(JSON.parse(JSON.stringify(lesson)).text, lesson.text);
  assert.ok(!lesson.text.includes('&lt;') && !lesson.text.includes('&amp;'));
  // DOM escaping belongs to the consumer. The selector must not turn a single
  // scored '<' into four scored characters, or claim HTML is safe to inject.
});

test('invalid options fail explicitly; defaults prefer historical content', () => {
  assert.equal(selectLesson().source, 'original');
  for (const options of [{ mode: 'water' }, { keyGroup: 6 }, { keyGroup: -1 }, { keyGroup: '0' }, { goal: NaN }, { goal: 0 }, { goal: 151 }, { goal: 1.5 }, { content: 'silent' }]) assert.throws(() => selectLesson(options), RangeError);
});
