# Water and Castle render foundations

**CASTLE.BGS contains four 320×129 indexed scenes, drawn opaquely at (0,26).** Water bubbles, all Water/Castle/WALKING sprites, character palettes and bonus ANI rasters now resolve through the existing render manifest. These are indexed-memory operations, not a collision system or a complete world renderer.

## Integrator contract

Run `python3 -B transpile/tools/render/decode.py` from the checkout root. No additional generated input is required beyond the original ZIP. Existing supplied original assets remain untouched. All newly generated files stay in ignored `assets/render/`.

| Existing manifest extension | Meaning |
|---|---|
| `sprites[]` | First 145 IDLE records unchanged; appended WATER (37), CASTLE (15), WALKING (90), WATER_INLINE (2). Resolve by **family and index**, never global array index. Each has additive `headerWords`, `originX/Y`, dimensions, `indicesPath`, SHA-256. GSO records retain original checksum and member offsets. |
| `worlds.water/castle.background` | Decoded 320×200 CRX, path and pixel hash. |
| `worlds.water/castle.palettes.m/l/p` | Final RGB6/RGB8 palettes, `baseMember`, `characterMember`, inclusive character slots32..47; Water additionally splices BITER48..63 (`replacedSlots:[32,63]`). |
| `worlds.castle.scenes[0..3]` | BGS source offsets/sizes, original indices, dimensions, explicit inclusive source/destination rectangles, local paths and pixel hashes. |
| `worlds.*.frames` | Original resource indices, detailed below. |
| `worlds.castle.clipChanges` | Ordered static call sites and inclusive clip rectangles, **not** an automatic time sequence. Controller branches select these changes. |
| `worlds.castle.temporaryClips` | Save/set/restore FILE sites; full-screen or replace-top operations. Caller preserves all other clip coordinates. |
| `worlds.*.bonus.m/l/p` | Exact BAN/ANI member keys into the existing packet/table files. |
| `worlds.*.bonusPlayback` | Callback FILE offset, two changed-tick waits per packet, sound7 one-based frame list and table FILE offset. No millisecond interval claim. |
| `ani-tables.json[member][]` | Existing x/y/member raster offsets now also expose decoded dimensions, origins, pixel path/hash. Paths still resolve against **render manifest directory**, not this table's member name. |

`drawCastleScene(destination,pixels)` overwrites only framebuffer rows 26..154, including zero pixels. Retain CRX rows 0..25 and 155..199. `scrollCastleStrip(front,nextScene,step)` takes step 0..39, shifts each visible scene row left eight pixels, then copies the corresponding eight source pixels into x312..319. It modifies only the visible buffer. Do not use `blitSprite` for an opaque scene.

`worldPalette(base,character)` replaces only slots32..47. No turtle splice applies to these worlds. `updateSprite` retains the existing dirty-background contract and source call order. Its current raster is validated before restoration; out-of-screen clips and inconsistent/truncated raster dimensions fail before writes. A scoped clip should be saved by value, replaced for the call, and restored before the next actor call. No process-global clip manager was added.

### Resource indices

| Consumer | Family / indices |
|---|---|
| Water swim m/l/p | WATER 0..5 / 6..11 / 12..17, `%cswm0001_1..0006_1` |
| Water bite / octo | WATER 18..22 / 23..32 |
| Water bonus / sunk m/l/p | WATER 33 / 34,35,36 |
| Water small / large bubble | WATER_INLINE 0 / 1, not GSK records |
| Castle rockfaces / pipe1 / pipe2 / bonus | CASTLE 0..3 / 4..8 / 9..13 / 14 (`brick1_cblock`) |
| Castle run m/l/p | WALKING 0..11 / 30..41 / 60..71 |
| Castle jump m/l/p | WALKING 12..24 / 42..54 / 72..84, includes `%cjmp0020_1` |
| Castle sink m/l/p | WALKING 25..29 / 55..59 / 85..89 (`%csin0001_1..0005_1`) |
| Castle rockface failure m/l/p | IDLE 0..46 / 47..93 / 94..144, selected by existing `idleSchedules` thresholds, not special crushed art |

Water loader FILE `0x167f3..0x169b1` binds swim/sunk/bite/octo; bonus binding is in the same Water initialization path. Shared character loader FILE `0x1d610..0x1d813` binds run, thirteen jumps, Castle-only five sink frames, and IDLE schedule frames. Formats reside at FILE `0x22af8`, `0x22b03`, `0x22b0e`, `0x22b19`; `idle` is at `0x22b24`. Castle FILE `0xd6a4..0xd74a` loads rockfaces, both bump sequences and bonus block.

Rockface failure FILE `0xc27c..0xc36d` compares half its counter with the character period, finds the preceding threshold, then calls IDLE selector `0x15264` and decoded-frame getter `0x15309`. Sand failure FILE `0xc36e..0xc40f` uses the five sink frames. Water sinking uses the sunk character raster at FILE `0x17404..0x17415`. Its post-failure function `0x17eab..0x17eba` contains only stack checking and return, no additional failure movie.

## BGS packing and decompression proof

FILE `0xd409` allocates 320×129 bytes. FILE `0xd483..0xd4f6` repeats **four** times: read a four-byte length, allocate its low word, read that many bytes into DS:4640+4×index. The member has an additional unused zero dword after these four streams; the loader does not read a fifth scene.

FILE `0xb905..0xb958` supplies byte callbacks to the same LZSS callee FILE `0x1a000` already used by IDLE. Input callback `0xb89a..0xb8c6` advances one byte unless output completion is flagged. Output callback `0xb8c7..0xb904` writes until the supplied capacity reaches zero, then flags completion on the next attempted output. There is no input-length parameter at this call boundary. The authored decoder instead bounds reads to the member-declared compressed stream and requires exactly 41,280 output pixels. All four streams end at precisely that size without reading beyond their declarations. This safety check does not emulate the original allocation overread.

FILE `0xd677..0xd692` expands scene0 to full background+`0x2080` (26×320), capacity `0xa140` (129×320). FILE `0xc09d..0xc0bc` expands the scene selected by its argument to the 41,280-byte transition buffer. FILE `0xc202..0xc21e` copies that entire buffer back to background row26. Thus dimensions and placement come from callers, not image appearance.

| Index | Length-field FILE-relative member offset | Compressed bytes | First pixel | Decoded SHA-256 |
|---|---:|---:|---:|---|
| 0 | `0x0000` | 10246 | 27 | `88a8c7d7fc4cf87d3f541d2392e8f53ea48c4bbdea56d76c99dccc4d7407f0a5` |
| 1 | `0x280a` | 13499 | 16 | `9f45ba040b171957b69ea59129e58accb280eec0e1a8526460c53bf8c50dd605` |
| 2 | `0x5cc9` | 11207 | 23 | `be4825c68afd1975e4129e5798b3fec256f2a49dc6676f8673b5209206812bd4` |
| 3 | `0x8894` | 13272 | 7 | `4af4d9c1070daa61fa513e15004fd63e437fe2108fedb104e860bbb732b7229b` |

Trailer is four zero bytes at member offset `0xbc70`. Source rectangles are `[0,0,319,128]`; destination rectangles `[0,26,319,154]`, all inclusive. Scenes have no individual palettes.

### Scene callers and source rectangles

- First entry expands scene0 at `0xd68f`; recurring rockface entry requests scene0 at `0xc686`.
- Pipe1 requests scene1 at `0xc955`, player transition y92.
- Sand requests scene2 at `0xcbf6`, player transition y36.
- Pipe2 requests scene3 at `0xd065`, player transition y36; sequence repeats through `0xd38a`.
- Visible scroll FILE `0x9a25..0x9a57`: copy x8..319 to x0..311 for 129 rows starting y26. Then FILE `0xb959..0xb9bf`: next scene source x8×step..8×step+7, rows0..128, to screen x312..319, rows26..154. Exactly forty steps at `0xc1fa`.
- Transition background scratch FILE `0xc0bf..0xc160`: for 50 rows starting player transition y, copy old background x256..319 to x0..63, and next-scene x0..63 at source row `(playerY-26)` to background x64..127. It temporarily biases the background pointer by -256 and advances it eight bytes per iteration (`0xc186..0xc18b`). This scratch/pointer behavior is **documented but not implemented** by the visible-strip helper.
- Special transition compositor FILE `0x7f1f..0x7ff4` unions old/current sprite rectangles, rounds horizontal bounds to four-pixel groups, and calls `0x7a47` with that union as an old-image rectangle. It is not interchangeable with ordinary `updateSprite` during the scratch-pointer transition without reproducing those source reads.

## Clipping, palettes and bonus returns

Clip setter FILE `0x782d` writes DS:0094..009a in left/top/right/bottom order; getter FILE `0x7855` saves all four. Values are inclusive. These calls are visibility masks, not collision bounds.

| Setter FILE offset | Inclusive rectangle | Context |
|---|---|---|
| `0xc96f` | `[0,0,46,199]` | Pipe1 entrance |
| `0xca0c` | `[0,0,319,199]` | Before pipe1 bumps |
| `0xcb23` | `[272,0,319,199]` | Pipe1 exit |
| `0xcbca` | full screen | Before sand transition |
| `0xcc95` | `[0,0,319,91]` | Sand entrance, active and sinking phases |
| `0xcfac` | full screen | After sand escape reaches y36 |
| `0xd07f` | `[0,0,44,199]` | Pipe2 entrance |
| `0xd11f` | full screen | Before pipe2 bumps |
| `0xd23f` | `[269,0,319,199]` | Pipe2 exit |
| `0xd2e0`, `0xd39b` | full screen | Exit walk and sequence cleanup |

Castle operation `0xbb06` saves the scene clip at `0xbb27`, sets full screen at `0xbb3c` (including bonus handling), and restores at `0xc02d`. Bonus actor saves at `0xdb87`, replaces **top only** with69 at `0xdb9b`, restores at `0xdbee`. The other bonus actor path saves at `0xdcab`, replaces top with37 at `0xdcbf`, restores at `0xdd54`. Do not intersect these replacement top values with an assumed universal world viewport.

Castle sand bonus temporarily expands scene0 at `0xde9c`, then after movie playback and resource reload the caller expands scene2 at `0xbe28`. Both target rows26..154. Return path marks all three rockfaces dirty (`0xbdea..0xbe07`), redraws background, restores palette at `0xbe56`, and later restores the caller's saved clip at `0xc02d`.

Castle palette starts from CASTLE.CRX: FILE `0xd635..0xd64e` copies768 bytes, `0xd808` applies character slots32..47. Water applies the same character splice to WATER.CRX at `0x16ac7`, then loads BITER.GPO and copies slots48..63 at `0x16ace..0x16b74`. This corrects the Phase1 omission; no TURTLE palette is used for Water. Original character helper is `0x14a8c..0x14b65`. See WATER.md for BITER member hash and tests. Intermediate fades and persistent reentry palette state remain outside these final-palette exports.

Water bonus FILE `0x17ef9..0x17fa3` selects MSWM/LSWM/PSWM BAN+ANI. Castle `0xde6c..0xdf45` selects MCAS/LCAS/PCAS. Both callbacks (`0x17ebb`, `0xde2e`) call the two-wait helper `0x14725`, rather than assuming Outside timing. Sound7 tables are FILE `0x21d29` and `0x21430`, eleven one-based packet numbers each. BAN retains its existing persistent-write semantics; ANI rasters are overlaid at signed table coordinates using their additive origins. Full bonus orchestration and intermediate fades are not implemented here.

## Water inline source pixels

- FILE `0x21d0c` (DS:2a9c): header `[0,0,2,2]`, pixels `[0,0,0,15]`.
- FILE `0x21d18` (DS:2aa8): header `[0,0,3,3]`, pixels `[0,15,0,15,0,15,0,15,0]`.
- FILE `0x16f4c..0x17109` chooses these pointers. Zero is transparent through the already-proven compositor, not a black bubble outline.

## Source identities and checks

Every member below is under `MarioTea/MARIO/`. Full names, sizes and hashes for all additional character palettes, BAN and ANI members are also in `manifest.members`.

| Member | SHA-256 |
|---|---|
| MARIO.EXE | `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e` |
| CASTLE.BGS | `b4674d24c215486663d5fe0fcf17f38672fc2c160e914c868d555a062a1450df` |
| CASTLE.CRX | `c295095534fdbb637e845a83adc7095950ce11b843fcaf56d1193cecda2835c7` |
| WATER.CRX | `49cf8c922e2b195395b31bdc7866acd68119c3b58aa0e5282c827627c8d2e0c7` |
| WATER.GSO | `1d61258b81c917bfd48a7bd7d22905ae8181e114d1154389853b63bd06836aae` |
| WATER.GSK | `5bdd499152114e541dcbc1f3636c334f9eb5c6f513245b4e20ab65becfe96edb` |
| CASTLE.GSO | `dc62d4fcfbe8499ac6da2a6e78fcecbad0a0611f3774eae90351c9f8bd177a62` |
| CASTLE.GSK | `0ccec8312f971005b635314d5b739a9c0f086ad601fa5d453d2081434116b77a` |
| WALKING.GSO | `3d5864c62f7ff7cb0c774cb2cbbb00f411fa4c156ad6e257788e1eff60de7aa0` |
| WALKING.GSK | `338adf9d19ea1b49c544d00351e20a5ba75905578e3c555ae8b115a652e02d33` |

ZIP SHA-256: `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`. EXE citations are FILE offsets; BGS offsets in the packing table are member-relative. Tests compare static listing instruction bytes to fresh ZIP bytes, but do not execute those instructions. Decoders/tests run only newly authored Python/JavaScript.

Validation through `structured_return`, from worktree root:

- `python3 -B transpile/tools/render/decode.py && python3 -B -m unittest discover -s transpile/tests/render -p 'test_*.py'`: 5 tests passed.
- `node --test transpile/tests/render/render.test.mjs`: 11 tests passed.
- Tests pin four independently recorded scene hashes, member lengths/offsets, exact bubble pixels, original GSO checksums, every per-character binding, malformed/truncated inputs, all clip edges, restoration call order, opaque scene placement, all forty scroll strips and palette splice ranges.

Remaining limits: transition scratch-background/special compositor integration; controller-selected clips and bonus save/restore orchestration; intermediate palette fades; planar hardware presentation; browser integration and original-runtime differential comparison. No guessed collision, timing or original execution was used. RGB6→RGB8 remains a browser representation. Derived assets are local-only original material, not MIT-licensed project code.
