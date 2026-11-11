import corpus from './data/lessons.json' with { type: 'json' };

export const CORPUS_VERSION = corpus.corpusVersion;
const letters = 'abcdefghijklmnopqrstuvwxyz';
// Shifted letter case uses the same row. Other modes still compare exact case.
const withCase = keys => keys + keys.replace(/[^a-z]/g, '').toUpperCase();
export const KEY_GROUPS = Object.freeze([
  { name: 'Home row', keys: withCase('asdfghjkl; ') },
  { name: 'Add top row', keys: withCase('asdfghjkl;qwertyuiop ') },
  { name: 'Add bottom row', keys: withCase(letters + ';,./ ') },
  { name: 'Add numbers', keys: withCase(letters + ';,./0123456789 ') },
  { name: 'Add symbols', keys: withCase(letters + '0123456789;,.!?\'"-:/()@#$%^&*+<=>[]_{} ') },
  { name: 'All keyboard', keys: Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('') },
].map(Object.freeze));

export const HISTORICAL_NOTICE = 'Original 1992 lesson text contains outdated or inaccurate claims and references to war, slavery, assassination and disasters. Historical wording is preserved, not endorsed. Choose generated practice to avoid this material.';
export const GENERATED_LABEL = 'Generated practice, not original lesson text';
const PREFIXES = ['H', 'T', 'B', 'N', 'S'];
const SUFFIXES = { outdoor: 'LETTERS', underwater: 'WORDS', castle: 'SENTENC' };
const passages = [
  'a lad asks a lass; a lass adds a salad; ',
  'the sailor sails; the quiet lake is still; ',
  'we swim past the reef; brave friends explore the castle; ',
  'we swim 12 laps; collect 34 coins; open gate 56; ',
  'swim past the reef! find 12 coins, then rest. ',
  'The reef has 12 fish. Swim past the gate! "Ready?" Yes, let us go. ',
];
const requiredKeys = text => [...new Set(text)].sort().join('');
function generatedText(mode, keyGroup) {
  // Outdoor drills deliberately cover every advertised printable key (ASCII
  // letters folded, no spaces); the other modes use reviewed neutral passages.
  if (mode !== 'outdoor') return passages[keyGroup];
  return [...new Set(KEY_GROUPS[keyGroup].keys.replaceAll(' ', '').replace(/[a-z]/g, c => c.toUpperCase()))].join('');
}
function validate(mode, keyGroup, goal, content) {
  if (!['outdoor', 'underwater', 'castle', 'practice'].includes(mode)) throw new RangeError('Unknown lesson mode');
  if (!Number.isInteger(keyGroup) || !KEY_GROUPS[keyGroup]) throw new RangeError('Unknown key group');
  if (!Number.isInteger(goal) || goal < 1 || goal > 150) throw new RangeError('Goal must be an integer from 1 to 150');
  if (!['original', 'generated'].includes(content)) throw new RangeError('Unknown content choice');
}
function sourceRecords(mode, keyGroup, goal) {
  const category = mode === 'practice' ? (goal < 10 ? 'outdoor' : goal < 30 ? 'underwater' : 'castle') : mode;
  const prefixes = keyGroup === 5 ? PREFIXES : [PREFIXES[keyGroup]];
  return prefixes.flatMap(prefix => {
    const member = corpus.members.find(m => m.member === `${prefix}${SUFFIXES[category]}.LEE`);
    return member.records.map(record => ({ member: member.member, ...record }));
  });
}
function classify(record, mode, keyGroup) {
  const missingKeys = [...requiredKeys(record.text)].filter(key => !KEY_GROUPS[keyGroup].keys.includes(key)).join('');
  const reason = mode === 'practice' ? 'Practice scored wrapping and separators are unresolved' : missingKeys ? 'Source record requires keys outside the selected group' : null;
  return { source: reason ? 'generated' : 'original', reason, missingKeys };
}

/** One complete deterministic cycle, not a duration-sized buffer.
 * Retry calls this with the same options; exhaustion repeats text from index 0.
 * The engine alone owns {recordIndex, characterIndex}, advancing within these
 * half-open [start,end) scored bounds only on accepted input. Selection has no
 * mutable cursor. No raw byte offsets are used here, and no separators added.
 * Mixed cycles report source='generated' conservatively; each record discloses
 * its actual source and fallback reason, so original records are never hidden.
 * Render text with textContent/Canvas, never innerHTML. '<' and '&' are targets.
 */
export function selectLesson({ mode = 'outdoor', keyGroup = 0, goal = 5, content = 'original' } = {}) {
  validate(mode, keyGroup, goal, content);
  let text = '';
  const records = [];
  const selected = content === 'generated' ? [{ member: null, record: null, text: '', sentenceEnds: [], themes: [] }] : sourceRecords(mode, keyGroup, goal);
  for (const record of selected) {
    const classification = content === 'generated'
      ? { source: 'generated', reason: 'Explicit generated alternative', missingKeys: '' }
      : classify(record, mode, keyGroup);
    let part = classification.source === 'original' ? record.text : generatedText(mode, keyGroup);
    // Water's collapse crosses record boundaries as well as internal runs.
    if (mode === 'underwater' && text.endsWith(' ') && part.startsWith(' ')) part = part.slice(1);
    const start = text.length;
    text += part;
    records.push({ member: record.member, record: record.record, start, end: text.length,
      ...classification, label: classification.source === 'original' ? 'Original 1992 lesson text' : GENERATED_LABEL,
      requiredKeys: requiredKeys(part), originalRequiredKeys: requiredKeys(record.text),
      sentenceEnds: classification.source === 'original' ? [...record.sentenceEnds] : [],
      themes: classification.source === 'original' ? [...record.themes] : [] });
  }
  const hasOriginal = records.some(r => r.source === 'original');
  const hasGenerated = records.some(r => r.source === 'generated');
  const source = hasGenerated ? 'generated' : 'original';
  const label = hasGenerated ? (hasOriginal ? `Original 1992 text with ${GENERATED_LABEL}` : GENERATED_LABEL) : 'Original 1992 lesson text';
  return { text, source, label, corpusVersion: CORPUS_VERSION, requiredKeys: requiredKeys(text), records,
    hasOriginal, hasGenerated, mode, keyGroup, goal, content, repeat: 'cycle',
    selectionPolicy: keyGroup === 5 ? 'Browser choice: source order H → T → B → N → S; retry restarts H' : 'Browser choice: source order; retry restarts record 1' };
}

// Exact record-level matrix, including each practice goal band. No unavailable
// key is silently removed and no incompatible record silently skipped.
export const LESSON_COVERAGE = Object.freeze(
  ['outdoor', 'underwater', 'castle', 'practice'].flatMap(mode =>
    KEY_GROUPS.flatMap((_, keyGroup) => (mode === 'practice' ? [5, 10, 30] : [5]).map(goal =>
      Object.freeze({ mode, keyGroup, goalBand: mode === 'practice' ? (goal < 10 ? '1-9' : goal < 30 ? '10-29' : '30-150') : '1-150',
        records: Object.freeze(sourceRecords(mode, keyGroup, goal).map(record => Object.freeze({
          member: record.member, record: record.record, requiredKeys: requiredKeys(record.text), ...classify(record, mode, keyGroup),
        }))) })
    ))
  )
);
