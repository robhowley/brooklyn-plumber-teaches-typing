// Trusted offline data reader. Never imports or executes anything from the archive.
// Usage: node scripts/import-lessons.mjs /absolute/path/to/research/executable-1992
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CORPUS_VERSION = 'mtt-1992-reviewed-1';
export const ARCHIVE_SHA256 = 'b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd';
// Pins bind the content review to these exact members, not to arbitrary future input.
export const MEMBER_HASHES = {
  BLETTERS: '46248d1375a1f755bc6a2c3161e517bc1cab18fb24f235ce3615df276de9f5f0',
  BSENTENC: 'a303b33f863bc5082523db99b9013325a234aca06fd9eef7e2446a2a1e5eede9',
  BWORDS: '7abe27bc7e798438c40168a3403204ee0bae0ff17de900e8301e3a6e91845083',
  HLETTERS: 'f88a87845e17856c63192813208f67a29fea46c41f8fde164ff972eff15e71ba',
  HSENTENC: '9f849288ff5d40ec858ca1a8eaf8bcc12b334caa7ff4092f8798196a82ea6aef',
  HWORDS: '4850ea6c75791905a9fdceb052f528d5d3b01514177a37d87c5bdd8ba79fbde2',
  NLETTERS: '68930cfead2bd446cb61a6381390cf112cfe73abb2d1886e8cbabcfdb0b3acf9',
  NSENTENC: '10914b3d4f69a52c8fd7a2275b24fa51707a46d2ccaa931b66be189f3c8f126e',
  NWORDS: '29509b1925d75c2b1a8a5d9ba7f419d1218641ec4064b89863570e4b58dfe8f2',
  SLETTERS: '0f84e57b29424c0ae8e8a5fd2838c9c70fc600e07889a40248280087341f322b',
  SSENTENC: '025cca858b5997b32be4c7954f2d638b2acb317d9579b36a7b178f5a17616dd1',
  SWORDS: '29cfcdeedfc195733c96e154ed37a9d34f22e13ca025e8a126b304e3e89fc77b',
  TLETTERS: '57d5d3f2731062630bc4c7a58fedb5da163fb3bbf92419f311c9862d8b7dd91f',
  TSENTENC: 'e22bc97051a48aad235461a357db7aa32c60e9430d2c5c5cb82790ff93e5ad7c',
  TWORDS: '58a2839fbe46ecac594f4fc8bfeb99eed2c21d91b3e7528fd677027fe043d5cb',
};
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (condition, message) => { if (!condition) throw new Error(message); };

export function parseMember(bytes) {
  check(Buffer.isBuffer(bytes), 'Expected a Buffer');
  check(bytes.length >= 3 && bytes[0] === 126 && bytes.at(-1) === 26, 'Expected initial tilde and terminal DOS EOF');
  for (let i = 0; i < bytes.length - 1; i++) {
    const b = bytes[i];
    check((b >= 32 && b <= 126) || [9, 10, 13].includes(b), `Unsupported byte ${b} at ${i}`);
  }
  const records = [];
  let start = 1;
  for (let i = 1; i < bytes.length; i++) {
    if (bytes[i] !== 126 && bytes[i] !== 26) continue;
    check(i > start, `Empty record at ${start}`);
    const payload = bytes.subarray(start, i);
    const controls = [];
    for (let j = 0; j < payload.length; j++) {
      const kind = { 9: 'tab', 10: 'LF', 13: 'CR', 96: 'sentence-break' }[payload[j]];
      if (kind) controls.push({ offset: start + j, kind });
    }
    records.push({ record: records.length + 1, byteSpan: [start, i], sha256: sha256(payload), controls, rawText: payload.toString('ascii') });
    start = i + 1;
  }
  return records;
}

export function transformRecord(rawText, mode) {
  // The loader discards CR before any mode reader sees the bytes.
  const loaded = rawText.replaceAll('\r', '');
  if (mode === 'outdoor') return { text: loaded.replace(/[\x00-\x20\x7f-\xff]/g, '').replace(/[a-z]/g, c => String.fromCharCode(c.charCodeAt(0) - 32)), sentenceEnds: [] };
  if (mode === 'underwater') return { text: loaded.replace(/[\n\t]/g, ' ').replace(/ +/g, ' '), sentenceEnds: [] };
  check(mode === 'castle', 'Practice scored wrapping is unresolved');
  let text = '';
  const sentenceEnds = [];
  for (const c of loaded) {
    if (c === '`') sentenceEnds.push(text.length);
    else text += c === '\n' || c === '\t' ? ' ' : c;
  }
  return { text, sentenceEnds };
}

// Full review: all 136 strings read, including drills, spelling/case anomalies,
// punctuation, and all 17 historical passages. Wording is not fact-corrected.
const THEMES = {
  HSENTENC: [['war', 'outdated-or-inaccurate-claims'], ['war', 'slavery', 'outdated-or-inaccurate-claims'], ['assassination']],
  TSENTENC: [['disaster', 'death', 'outdated-or-inaccurate-claims'], ['war', 'atomic-bombing', 'outdated-or-inaccurate-claims'], ['assassination', 'outdated-or-inaccurate-claims']],
  BSENTENC: Array.from({ length: 3 }, () => ['outdated-or-inaccurate-claims']),
  NSENTENC: [['subjective-historical-claims'], ['outdated-or-inaccurate-claims'], [], []],
  SSENTENC: [['mythology'], [], ['outdated-or-inaccurate-claims'], ['outdated-or-inaccurate-claims']],
};

export async function importLessons(root) {
  const evidence = join(root, 'text/evidence');
  const reference = JSON.parse(await readFile(join(evidence, 'generated/lesson-corpus.json'), 'utf8'));
  const inventory = JSON.parse(await readFile(join(root, 'inventory/artifacts/ui-flow/archive-manifest.json'), 'utf8'));
  check(reference.archive.sha256 === ARCHIVE_SHA256 && inventory.archive_sha256 === ARCHIVE_SHA256, 'Archive identity mismatch');
  check(reference.members.length === 15, 'Expected 15 members');
  const data = { corpusVersion: CORPUS_VERSION, members: [] };
  const provenance = { corpusVersion: CORPUS_VERSION, archiveSha256: ARCHIVE_SHA256, review: 'All 136 ASCII records reviewed; historical wording retained, not endorsed. Rights unverified.', members: [] };
  let totalBytes = 0, totalRecords = 0;
  for (const [stem, hash] of Object.entries(MEMBER_HASHES)) {
    const member = `${stem}.LEE`;
    const bytes = await readFile(join(evidence, 'raw', member));
    const ref = reference.members.find(m => m.memberName === member);
    const inv = inventory.members.find(m => m.name === `MarioTea/MARIO/${member}`);
    check(sha256(bytes) === hash && ref?.sha256 === hash, `Member hash mismatch: ${member}`);
    check(ref.sizeBytes === bytes.length && inv?.uncompressed_size === bytes.length, `Member size mismatch: ${member}`);
    const parsed = parseMember(bytes);
    check(parsed.length === ref.recordCount && parsed.length === ref.records.length, `Record count mismatch: ${member}`);
    const mode = stem.endsWith('LETTERS') ? 'outdoor' : stem.endsWith('WORDS') ? 'underwater' : 'castle';
    const records = [], recordEvidence = [];
    for (const r of parsed) {
      const old = ref.records[r.record - 1];
      check(JSON.stringify(r.byteSpan) === JSON.stringify(old.byteSpan) && old.delimiterOffset === r.byteSpan[0] - 1 && old.recordNumber === r.record && old.rawLengthBytes === r.byteSpan[1] - r.byteSpan[0] && old.rawText === r.rawText && old.rawHex === bytes.subarray(...r.byteSpan).toString('hex'), `Record mismatch: ${member}:${r.record}`);
      const transformed = transformRecord(r.rawText, mode);
      check(transformed.text.length > 0 && /^[\x20-\x7e]+$/.test(transformed.text), `Invalid learner text: ${member}:${r.record}`);
      records.push({ record: r.record, ...transformed, themes: THEMES[stem]?.[r.record - 1] ?? [] });
      const { rawText, ...metadata } = r;
      recordEvidence.push({ ...metadata, textSha256: sha256(transformed.text) });
    }
    data.members.push({ member, mode, records });
    provenance.members.push({ member, archiveMember: ref.archiveMember, sha256: hash, sizeBytes: bytes.length, eofOffset: bytes.length - 1, records: recordEvidence });
    totalBytes += bytes.length; totalRecords += parsed.length;
  }
  check(totalBytes === 24090 && totalRecords === 136, 'Corpus totals mismatch');
  provenance.totals = { files: 15, bytes: totalBytes, records: totalRecords };
  return { data, provenance };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  check(process.argv.length === 3, 'Usage: node scripts/import-lessons.mjs RESEARCH_ROOT');
  const { data, provenance } = await importLessons(resolve(process.argv[2]));
  const output = new URL('../src/data/', import.meta.url);
  await mkdir(output, { recursive: true });
  for (const [name, value] of [['lessons.json', data], ['lessons-provenance.json', provenance]]) {
    await writeFile(new URL(name, output), JSON.stringify(value, null, 2) + '\n');
  }
  console.log(JSON.stringify(provenance.totals));
}
