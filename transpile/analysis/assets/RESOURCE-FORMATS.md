# Local resource bundle

Run the stdlib-only converter from `transpile/`:

```sh
python3 tools/assets/pipeline.py
python3 -B -m unittest discover -s tests/assets -p 'test_*.py'
```

Defaults: `~/Downloads/Mario_Teaches_Typing_1992.zip` to `assets/original/`. Override with `--archive PATH --output PATH`. No packages, original executables, emulator, or existing app are required. Only the expected archive hash is accepted. Keep original and derived material local; the repository MIT license does not cover it.

## What is available

| Resource | Decoded output |
|---|---|
| Archive | 177 members, including 3 directories; all 174 files preserved byte-for-byte with `.data` suffixes |
| CRX | 20 indexed 320×200 backgrounds, embedded palettes, compressed-token provenance |
| GSK/GSO | All 567 named sprites, indexed pixels, dimensions, record offsets, checksums, preview PNGs |
| Palettes | 20 embedded CRX palettes and 7 GPO palettes, original six-bit and converted eight-bit channels |
| Fonts | Four FNT descriptions, 96 glyphs each (codes 32–127), included in the 567 sprites |
| LEE | 15 exact lesson files, 136 records, no trimming or normalization |
| MSD | 177 indexed messages |
| HLP | Two exact text resources and numeric-tag byte offsets |
| ANI | Nine tables, 489 entries and 218 distinct rasters within their respective members |
| MZ | Three EXE headers, entry offsets, all relocation table entries and their FILE offsets |
| Audio | Four VOC block descriptions; other audio retained with header metadata, never played |

`assets/original/manifest.json` is the browser-facing entrypoint. Every `path`, `indicesPath`, `rawPath`, and `tokenPath` resolves **relative to its directory**, including paths inside subsidiary JSON files. The manifest is written last. A failed conversion can leave partial files but does not leave a new completion manifest. On regeneration, the previous completion manifest is removed after validating the input archive. The converter overwrites generated files but does not remove unrelated stale files, so use a clean destination when comparing complete trees.

- `archive-manifest.json`: original names, sizes, compressed sizes, CRC32, SHA-256, original modes, inert paths, including empty files/directories.
- `backgrounds/`: PNGs and one byte per palette index; token lists preserve compressed input spans.
- `sprites/`: PNGs and one byte per palette index; use manifest family/index/name to select a sprite.
- `palettes/`: full 256-entry RGB6/RGB8 arrays, named by original resource filename.
- `fonts/`: glyph code to sprite index, PNG, indexed pixels, and dimensions.
- `text/`: exact lesson/message/help text with member-relative byte spans.
- `animations/`: ANI table entries, distinct frame rasters, and grayscale index previews.
- `metadata/`: MZ and VOC structural descriptions.
- `raw/MarioTea/`: every original file, with `.data` appended, including drivers, installers, packed floppy resources, and the empty `.ba1` member.
- `evidence-summary.json`: generated counts, validations, and limits.

No sprite PNG has transparency applied. No runtime palette binding is asserted. For faithful compositing, consume `indicesPath` and apply only a palette/mask supported by separate executable analysis. Matching-basename and MPALLET fallback sprite PNGs are previews, not proof of original colors. ANI previews deliberately use synthetic grayscale, and their exact indices are retained separately.

## Identity and safety

Archive SHA-256:

`b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`

`MarioTea/MARIO/MARIO.EXE` SHA-256:

`6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e`

MARIO.EXE FILE offset `0x08` holds 736 header paragraphs, placing the load image at FILE `0x2e00`. FILE `0x06` holds 2,594 relocations, and FILE `0x18` holds relocation-table offset `0x3e`. Initial CS:IP is 0:0 (header fields at FILE `0x16` and `0x14`), so the calculated entry FILE offset is `0x2e00`. The declared image end is 151,024 bytes, exactly the member size. These are structural observations, not execution or startup-behavior recovery. `metadata/MARIO.EXE.mz.json` includes every relocation's table and target FILE offsets.

The converter reads ZIP bytes through Python `zipfile`, never `extractall`, subprocesses, dynamic evaluation, original-code imports, or executable loading. All ZIP members are validated before output starts. Limits: 32 MiB archive, 2,048 members, 8 MiB/member, 64 MiB total uncompressed bytes. Only stored/deflated, unencrypted regular-file/directory members are accepted. It rejects traversal, absolute/drive paths, backslashes, control characters, empty/dot path components, trailing dot/space components, duplicate and case-colliding names, links, CRC failures, and SHA mismatch. Generated output paths reject symlink ancestors and hardlinked existing files; regular output files are written with mode 0600. Never run or rename original `.data` files into executable names.

The pipeline assumes a local output tree not concurrently modified by another process. It is not a defense against an adversary racing directory replacement during writes. Input hash pinning is deliberately not configurable through the CLI.

## Decoded formats

All integer resource fields below are little-endian. Byte spans are zero-based, half-open, relative to the named uncompressed ZIP member unless explicitly labeled executable FILE offsets. Every resource entry carries its original member SHA-256 or links to an entry that does.

### CRX backgrounds

- Member bytes `[0,768)` are 256 RGB triples, each channel in 0–63.
- Stream starts at `0x300`, using LZSS with a 4,096-byte ring and initial write cursor 4,078.
- Each flag byte is consumed least-significant bit first. Set bit: one literal. Clear bit: two-byte copy; position is `a | ((b & 0xf0) << 4)`, length is `(b & 15) + 3`.
- Copies may overlap their output. Every dictionary byte read must already have been written; no guessed initial dictionary values are accepted.
- All 20 members decode to exactly 64,000 pixels. Truncated tokens, extra output, and unknown dictionary references fail explicitly.
- Each token provenance tuple is `[decodedStart, decodedEnd, compressedTokenStart, compressedTokenEnd]`. Copy tokens also depend on earlier decoded data.
- PNGs preserve indices and embed a converted palette. RGB8 conversion is `round(channel * 255 / 63)`, a browser representation rather than a recovered VGA analog-output model.

### GSK/GSO sprites and fonts

GSK is ASCII `name:decimalOffset` per line. Each referenced GSO record contains four u16 words (two retained header words, width, height), then `width * height` pixel bytes, then a u16 pixel-byte sum modulo 65,536. Every next record boundary and the final member boundary agree with this structure for all 567 records. The common 34-byte prefix is preserved raw but not interpreted. The first two words are not asserted to be runtime anchors.

Manifest `index` is the zero-based position in that GSK, not a global sprite ID. Names are preserved exactly. Individual records include `offset`, `offsetHex`, `end`, `headerWords`, and `checksum16`.

FNT files are ASCII F/N/W/H numeric lines. F and N agree with glyph code range and count; W/H are retained as nominal metrics, not proven drawing advance or line spacing. GSK names `fontN_CODE` supply the code mapping, checked against the complete 32–127 range. No screenshot-based recoloring was applied.

### LEE lessons, MSD messages, HLP help

- LEE starts with `~` and ends with DOS SUB (`0x1a`). Each tilde begins a record whose payload ends before the next tilde or final SUB. JSON preserves ASCII, repeated/trailing spaces, CRLF, backticks, punctuation and case. Delimiters and terminal SUB are excluded from payload strings but retained in raw files; tests reconstruct every member exactly. This parse does not decide which control bytes are learner keystrokes.
- MSD header is u16 count and u16 payload length, followed by count `(resourceId, relativeOffset)` u16 pairs. Each offset points into the payload at a NUL-terminated ASCII string. IDs, offsets, bounds, and terminators are checked. No message's gameplay use is inferred from its text alone.
- HLP is preserved as exact ASCII including markup and CRLF. Numeric `<N>` tag positions are listed without claiming their rendering effects.

### ANI tables and rasters

Fresh archive bytes support a further structural decode, independent of previous application code:

- Table entries are eight bytes: two 16-bit words and a 32-bit member-relative raster offset.
- The first raster offset gives the table end; the last table entry is eight zero bytes.
- Every nonterminal entry references an in-bounds raster. Repeated offsets reuse frames.
- Sorting unique offsets partitions all remaining bytes into four-u16 headers plus exactly `width * height` pixels, **without** the GSO checksum trailer.
- All nine members satisfy those bounds exactly. Table order and raw first/second words are preserved; those words are also represented as signed 16-bit values, not asserted coordinates or times.

Example: `MarioTea/MARIO/MOUT.ANI`, SHA-256 `cb1396c2e5ec2e7aecb43410083ac0a1fc5c6a71adedf86e82a2c9e20cd6780c`, has its first raster at member `0x1c0`. Table entry 0 references a 10×35 raster with header words `[0,0,10,35]`. Its next distinct raster starts at `0x326`, exactly `0x1c0 + 8 + 350`. There are 55 nonterminal table entries and 28 distinct rasters. This establishes stored data layout, not invocation, cadence, collision, or character/palette binding.

### Audio and unresolved resources

VOC validates the Creative Voice signature, version checksum, block bounds and terminator. Type-1 metadata includes time constant, codec, sample span, and `1,000,000 / (256 - timeConstant)` sample rate. No audio is decoded into playback media or automatically played. XMI, PC speaker/synth resources, RS, instrument banks, and ADV driver bytes remain inert.

BAN, CASTLE.BGS, IDLE.GCO/GCK, and floppy CMP resources remain undecoded. Their raw bytes, hashes, sizes, and header previews are available; this pipeline does not invent map dimensions, animation timing, delta semantics, or bindings. ANI runtime behavior also remains unresolved despite its raster/table decode.

## Validation and prior-source review

The previous `research/executable-1992/screens/decode_assets.py`, `screens/inspect_metadata.py`, `text/scripts/analyze_corpus.py`, and `scripts/import-static-assets.mjs` were read in full for safety and format leads. They perform data decoding rather than original-code execution. They were **not run or imported**. The new converter reimplements only resource parsing using stdlib and fresh hash-verified ZIP bytes. No previous app code or derived assets were copied.

Fresh results agree with all 20 prior research background pixel SHA-256 values and all 567 prior sprite offsets/dimensions. Agreement is corroboration, not independent proof of runtime behavior. The OUTSIDE background PNG was also visually inspected as decoded imagery.

The test suite covers malformed/traversal ZIP fixtures, case collisions, symlink members/output paths, hardlinked output files, permissions, identity and CRC rejection, size bounds, LZSS overlap/truncation/unknown dictionary/overflow, sprite record geometry and checksum, lossless text, malformed MSD/ANI/MZ/VOC, all generated PNG CRCs/geometry/palette/index bytes, all raw member hashes, ANI references, inventory counts, and a complete second conversion into a fresh temporary directory. The second conversion must match every output file byte-for-byte.

Exact validation command (from `transpile/`):

```sh
python3 -B -m unittest discover -s tests/assets -p 'test_*.py'
```

Result: **19 tests passed**, using `structured_return`. These tests validate static extraction and format invariants, not original runtime behavior, color binding, transparency, timing, or browser gameplay.
