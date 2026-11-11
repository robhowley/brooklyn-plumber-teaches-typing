# Outdoor rendering and animation recovery

**Use additive sprite origins, transparent index 0, character palette slots 32–47, turtle slots 48–63, and the decoded IDLE frames.** The background does not scroll; only the 20×16 ground tile at rows 140–155 does. BAN packets and ANI coordinates are now decoded independently of original-code execution.

## Integration entrypoint

- `assets/render/manifest.json`: 145 decoded IDLE frames (166,926 pixels), three assembled outdoor palettes, the exact EXE ground tile, source hashes, GSK bindings, and idle schedules.
- `recovered/render/render.mjs`: dependency-free indexed rendering primitives, character name selection, ANI entry interpretation.
- `assets/render/ani-tables.json`: nine ordered coordinate/frame tables; referenced raster pixels remain available from `assets/original/animations/`.
- `assets/render/ban-packets.json`: 628 packet descriptions across all 13 BAN members, including member byte offsets and command counts. `tools/render/decode.py::decode_ban` can apply their actual pixel changes to a supplied framebuffer.
- Paths in the render manifest resolve relative to **that manifest**, not the original-assets manifest. No original pipeline files changed.

All new outputs are in the worker's `transpile/{analysis,recovered,tools,tests,assets}/render/` directories. Copy those directories into the main `transpile/` tree for integration. Imagery and byte-derived tables remain local original game material, not repository MIT material.

### Minimal renderer use

1. Load OUTSIDE's indexed pixels from `assets/original`; retain an unchanged background buffer and a separate visible 64,000-byte buffer.
2. Choose `renderManifest.palettes.m/l/p.rgb8`. Do not recolor sprite pixels individually or use the GSO preview PNG palettes.
3. Resolve the outdoor state `frame` with `characterFrame(character, frame.kind, frame.index, renderManifest.idleSchedules[prefix].thresholds)`.
4. Look up WALKING names in the original sprite manifest, IDLE names in the render manifest. Both expose `headerWords`, `width`, `height`, and `indicesPath`; read indices as a `Uint8Array`.
5. Draw at the outdoor logical X/Y with `blitSprite` for a full-redraw adaptation, or `updateSprite` for the recovered background-restoring update. **Do not subtract origins or resize IDLE frames to 40×50.**
6. `drawGround(front, tile, phase)` writes only rows 140–155. Use the outdoor routine's phase, updated with the previous scroll value.
7. Convert the final indexed buffer through the chosen palette. RGB6→RGB8 expansion in the manifest is a browser representation, not a recovered VGA analog-output model.

`updateSprite(front, background, current, previous, clip?)` takes null or `{sprite,pixels,x,y}` records; `previous` needs no pixels. It restores clipped old/new areas from the background, then draws the current sprite. Overlapping areas restore their bounding rectangle, matching the executable. Retain previous frames and coordinates per draw object. Replaying calls in recovered order can erase parts of earlier sprites, unlike ordinary alpha layering.

`blitSprite(destination, sprite, pixels, x, y, clip?)` only overlays nonzero pixels. A complete redraw from background with this helper is explicitly a browser adaptation; it is not the original dirty-rectangle algorithm. Clip coordinates must remain within the physical 320×200 buffer. Default clip is inclusive `[0,0,319,199]`.

### API/source map

| Export | Executable FILE evidence | Contract |
|---|---|---|
| `spriteRect` | `0x7a69..0x7a93` | Add signed first two header words to logical X/Y, inclusive bounds |
| `clipRect` | `0x7878..0x7942` | Signed inclusive rectangle intersection, null outside |
| `blitSprite` | `0x9e5f..0x9e91` | Zero transparent; every other byte, including 255, visible |
| `updateSprite` | `0x7a47..0x7f11` | Background restoration and current sprite overlay, no VGA port emulation |
| `drawGround` | `0x994d..0x99f9` | `tile[y*20+(x+phase)%20]` at framebuffer row 140 |
| `outdoorPalette` | `0x14b34..0x14b65`, `0x12b49..0x12b85` | Flat 768-byte RGB6 inputs; replace only slots 32–63 |
| `characterFrame` | `0x1d610..0x1d814`; outdoor frame selection previously recovered | Name binding only, no guessed cadence |
| `aniEntry` | `0x82e9..0x834a` | Signed X/Y, member-relative raster offset, zero offset sentinel |

## Evidence and identities

Only ZIP/member byte reading, static `objdump` disassembly, and authored Python/JavaScript ran. No archive program, emulator, installer, driver, or interpreter for original machine code ran.

- ZIP SHA-256: `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`.
- Original executable: `MarioTea/MARIO/MARIO.EXE`, SHA-256 `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e`.
- Executable offsets below are **FILE offsets**, not CS:IP or data-segment offsets. Load image starts at `0x2e00`; DS initialized-data base is `0x1f270`.
- `evidence.json` copies exact analyzed byte spans and identities. `*.asm.txt` are static listings. Embedded tables are data, not executable instructions; disassembly is not a control-flow proof by itself.
- Every consumed resource's full original name, size and SHA-256 appears in `assets/render/manifest.json::members`.

| Member under `MarioTea/MARIO/` | SHA-256 |
|---|---|
| IDLE.GCO | `76d661e591f6f7ad531a12e3fa7d07e88e7ffa14acf3153154cd8609add8c45f` |
| IDLE.GCK | `9e533e049d4646f7daf29907ecacee3eb729fddc2dce9bd146f752d472ed6086` |
| OUTSIDE.CRX | `a61479731c970e0ab5e7b0f3c52e58d55276321b82405f861a949c06573971b4` |
| TURTLE.GPO | `36e3fffd72f4873cdaa1ffcc5ae6d0963d04c3d4eccc630d59b271e1aa2dc9c8` |
| MOUT.BAN | `a9aeba7fe20bf8378ee5e763e2a9ea1986dd37b601864b080bafdf722f65418b` |

## 1. Sprite coordinates, masks and compositing

FILE `0x7a47` takes current `(x,y,image)` and previous `(x,y,image)` arguments. For each non-null image, it adds image words +0/+2 to X/Y, then builds the rectangle using width +4 and height +6, minus one for inclusive right/bottom. It clips against DS:`0094..009a`; initial values at FILE `0x1f304` are `(0,0,319,199)`. These globals can be changed by other code; the helper accepts a clip explicitly.

The source read starts at image+8 plus `(clippedY-originY)*width+(clippedX-originX)`, FILE `0x7b9f..0x7bbf`. Thus the first two GSO words are **additive draw origins**, not hot spots to subtract or unused padding.

The current/background/visible row descriptors go to FILE `0x9dea`. It copies a background row to a scratch row, skips runs of source byte zero, copies runs of nonzero source bytes, then copies the composed row to the visible buffer (`0x9e38..0x9eb9`). No palette-index-255 transparency or separate bitmask is involved in this routine.

Old-only and disjoint old/current rectangles restore independently. Intersecting clipped rectangles use the bounding union (`0x7c95..0x7da8`), restore rows before/after the current sprite, and use background-plus-sprite for the intervening rows. VGA presentation rounds horizontal transfer bounds to groups of four (`0x7c5e..0x7c72`); the JS translates the indexed-memory result, not planar hardware timing.

### Real bindings

The render manifest includes original GSK index/name/offset/header bindings, not new arbitrary IDs:

- OUTSIDE indices 0/1: `turt1_1`, `turt1_2`; 2: `brick1_1`; 3: `expls1_1`; 4–7: `cursor_1..4`.
- WALKING run names: `%crun0001_1` through `%crun0012_1`; outdoor jump: `%cjmp0008_1` through `%cjmp0019_1`.
- IDLE indices 0–46 Mario, 47–93 Luigi, 94–144 Peach. Names use schedule threshold values, **not slot+1**.
- IDLE index 0 `mstd0001_1`, member offset `0x22`, has origin `(3,8)`, size 25×42. Drawing logical `(20,90)` places its raster at `(23,98)`.

Character-frame resolution rejects negative/out-of-range frame indices. It does not repair the original signed run-distance overflow by inventing modulo wrapping.

## 2. Outdoor palette construction

FILE `0x12acd..0x12ad8` passes OUTSIDE's palette to FILE `0x14a8c`. Character selection chooses `m/l/p` (default `m`), formats `%cpallet.gpo` (string FILE `0x21b91`), reads 768 bytes, and copies **only indices 32..47** into the background palette (`0x14b34..0x14b65`).

Outdoor then reads `turtle.gpo` (`0x12adf..0x12b26`) and copies **only indices 48..63** into that same palette (`0x12b49..0x12b85`). All other final slots remain OUTSIDE.CRX's embedded values. This is not a whole-character-palette replacement.

The subsequent palette upload uses the assembled background palette at FILE `0x12b96..0x12bad`, followed by a transition path. The generated palettes describe the final scene palette, not intermediate fade colors or duration. An already-initialized background can take another branch, so activity reentry and transition persistence are not fully modeled here.

## 3. IDLE.GCO format and playback

All 145 GCK offsets partition GCO exactly. Each record:

| Offset | Field |
|---|---|
| +0/+2 | Signed additive X/Y origins |
| +4/+6 | u16 width/height |
| +8 | u16 compressed byte count |
| +10 | u16 zero in every supplied record; not used by this playback routine |
| +12 | LZSS compressed pixel stream, exactly the declared count |

FILE `0x152a0..0x152e7` reads +8, copies the first eight bytes to the output image, advances input by 12 and output by 8, then invokes decoder FILE `0x1a000` through byte callbacks. It alternates between two 50×50 allocations; output callback capacity is `0x9ba` bytes. No previous idle image is needed to decode a frame.

Decoder FILE `0x1a020..0x1a0fb`:

- 4096-byte ring, write cursor 4078 (`0xfee`).
- Initialize ring indices 0..4077 to ASCII space, byte `0x20`. The remaining 18 bytes are **not initialized by this routine**.
- Flags low bit first; set means literal; clear means two-byte back-reference.
- Copy position `a | ((b & 0xf0)<<4)`, length `(b & 15)+3`, overlapping writes allowed.
- Stop when the input callback returns `0xffff`; all supplied IDLE records decode to exactly width×height bytes.

The decoder rejects reads of never-initialized dictionary positions instead of guessing their contents. All 145 supplied frames pass. This also establishes an initialization detail absent from the earlier CRX resource-only investigation; it does not require changing the original-assets converter because its supplied CRX streams already avoid unknown initial reads.

Scheduling remains the previously recovered outdoor algorithm: stationary count >4 enters idle; half-ticks select signed-byte thresholds; periods are Mario 90, Luigi 124, Peach 104. Exact thresholds are copied into `idleSchedules`, from FILE `0x2260a`, `0x22639`, `0x22668`. Some high thresholds are unreachable under these periods; do not adjust periods to fit the pictures.

## 4. Ground and background

FILE `0x994d` directly reads **raw pixels**, not a sprite header, at DS:`0312` = FILE `0x1f582`. This is a 320-byte, 20×16 tile. The leading partial tile uses the suffix beginning at phase; fifteen complete tiles follow; the final partial tile uses the prefix. This is equivalent to the tested modulo formula in `drawGround`.

The destination starts at framebuffer byte `0xaf00` = row 140. Width is 320, height 16. FILE `0x1436c..0x143c0` advances phase by the preceding iteration's scroll and takes signed remainder modulo 20. The JS helper accepts reachable phases 0..19 and rejects negative phases rather than pretending malformed source state is valid.

Ground updates the visible buffer, not the persistent scene background used for sprite erasure. Do not scroll the full OUTSIDE CRX or synthesize scenic parallax. OUTSKY and OCASTLE are separate presentations.

## 5. BAN changes and ANI motion tables

### BAN packets, directly recovered

Driver FILE `0x7ff5` loads BAN bytes, traverses until first word `0xffff` (`0x837b`), and treats two zero words as a four-byte no-change packet (`0x81f0..0x8222`). For nonempty packets, chunky renderer FILE `0x9f37..0x9f8b` reads:

- u16 framebuffer start offset;
- u16 **command count**, not byte length or duration;
- eight more header bytes skipped by this chunky renderer;
- exactly that many commands.

Commands:

| Control byte | Meaning |
|---|---|
| 0..127 | Copy next control+1 literal bytes, including literal zeros |
| 129..255 | Repeat next byte `257-control` times; repeated byte zero instead skips existing destination pixels |
| 128 | Read u16 and advance destination by that many pixels without writing |

Packet end comes from walking the command stream, not the first word. Changes apply to both persistent background and visible buffer (`0x82af..0x82de`); they are not independent full frames or conventional zero-transparent sprites. All 13 supplied BAN files consume exactly through their final two-byte `ffff` sentinel. There are 628 packets total. The other eight header bytes have additional uses in planar display branches; their full geometry interpretation is not claimed here.

### ANI, directly recovered

After each BAN packet, FILE `0x82e9..0x834a` consumes one eight-byte ANI entry: signed X, signed Y, and a member-relative raster offset. It calls the same sprite compositor with those coordinates and retains previous image/coordinates for erasure. A zero raster offset stops ANI advancement; the BAN stream controls overall presentation length. The driver adds only the offset low word to its allocated ANI base; all supplied ANI members fit the supported range.

The nine ANI tables each have exactly as many nonterminal entries as their corresponding BAN packet stream. Their coordinate sequences and raster headers are exported in `ani-tables.json`. The raster format is already decoded by the original-assets worker; do not interpret the first two ANI table words as timing.

### Outdoor bonus cadence, directly recovered

The driver itself does not impose a fixed frame rate. It invokes the caller's callback once per BAN packet with zero-based packet index (`0x834e..0x835b`). Outdoor supplies FILE `0x1425a` (`0x1434e..0x14360`). That callback:

1. Adds one to the callback index.
2. Calls FILE `0x14725`, which calls the changed-BIOS-tick wait FILE `0x1470c` **twice** (`0x14733..0x14738`). The underlying BIOS wait is FILE `0x192a2`.
3. Requests sound 7 on one-based frames `[7,12,15,22,24,30,33,36,38,46,51]`, table FILE `0x219e7`.

Thus the bonus normally waits two observed BIOS tick changes per packet, not one ordinary outdoor update. Approximate 109.85 ms browser intervals are a host adaptation; processing delay and the first wait's saved tick affect real elapsed time. Do not generalize this callback cadence to all BAN users. Outdoor passes loop/skip argument zero; other callers can loop/check keyboard through `0x8364..0x838b`.

## Limits and validation

- **Recovered and translated:** additive origins, zero mask, clipping, indexed dirty compositing, final outdoor palette, raw ground tile and phase drawing, all IDLE decompression, character resource name binding, ANI coordinates, all BAN chunky pixel commands.
- **Recovered but not wired into an app:** outdoor bonus's two-wait cadence, callback sound indices, BAN background/visible updates plus ANI overlay.
- **Still unresolved:** CASTLE.BGS packing; planar BAN header fields and VGA presentation; complete palette fade/reentry behavior; exact font-family binding for DS:`4fc0`; any hardware-level tearing/timing.
- **Known separately:** outdoor glyph placement `(6,3)` for brick and `(15,3)` for turtle, mapping `[0,15,31]`, FILE `0x1413d..0x14259`. Do not silently choose a font family merely because it fits those dimensions.
- **Not tested:** browser integration, original-runtime differential comparison, sound playback. No original program was run.

Reproduce from this worker checkout root (after merge, omit the leading `transpile/` when already in main `transpile/`):

```sh
python3 -B transpile/tools/render/inspect.py
python3 -B transpile/tools/render/decode.py
node --test transpile/tests/render/render.test.mjs
python3 -B -m unittest discover -s transpile/tests/render -p 'test_*.py'
```

The inspection script requires trusted `objdump` with LLVM code16 flags. Decode/tests use only Python stdlib and Node built-ins. Tests verify fresh archive hash, member hashes, exact evidence bytes, every IDLE frame, every BAN packet, all ANI table entries, palette splice ranges, signed origins, clipping, dirty erasure, zero/255 behavior, all 20 ground phases, and every run/jump/idle name binding. Exact test results are recorded in `checks.json`; both suites run through `structured_return`.
