# Outdoor: recovered update and input loop

**Outdoor accepts the next letter immediately, without a contact gate.** The player follows that target, while scrolling slows to zero near an unanswered target. Typing the right letter clears its character immediately and removes its obstacle six updates later. A block starts a twelve-update jump; a turtle does not. These are executable findings, not assumptions from the previous browser game.

The dependency-free translation in `../../recovered/outdoor/outdoor.mjs` covers the ordinary loop, motion, targets, case handling, obstacle removal, debris, animation selection, ending, and the bonus appearance timer. It does not render an app or claim full executable equivalence. Bonus cinematics, shared statistics, sound and pixel compositing remain integration work.

## Evidence and reproduction

All original material was read as data. No archive executable, installer, driver or machine-code routine was run or emulated. A newly authored Python script wraps inert code bytes in an ELF section for trusted `objdump` static disassembly. Newly authored JavaScript tests exercise translated expressions, not an original-code interpreter.

| Identity | SHA-256 |
|---|---|
| `Mario_Teaches_Typing_1992.zip` | `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd` |
| `MarioTea/MARIO/MARIO.EXE` | `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e` |
| `MarioTea/MARIO/WALKING.GSO` | `3d5864c62f7ff7cb0c774cb2cbbb00f411fa4c156ad6e257788e1eff60de7aa0` |
| `MarioTea/MARIO/IDLE.GCO` | `76d661e591f6f7ad531a12e3fa7d07e88e7ffa14acf3153154cd8609add8c45f` |

`evidence.json` contains archive/member identities, copied hexadecimal byte spans, and outdoor direct call edges. `tables.json` contains signed tables, named sprite resource indices, original member hashes, resource offsets and headers, and lesson hashes. `mechanics.json` ties behavioral claims and confidence to byte ranges. `outdoor.asm.txt` is focused disassembly with routine annotations; `dependencies.asm.txt` covers called helpers. The copied `*LETTERS.LEE.data` files make lesson tests self-contained. These are original/derived private game materials, not MIT-licensed assets; do not publish them.

From the worker checkout root:

```sh
python3 transpile/tools/outdoor/inspect.py
node --test transpile/tests/outdoor/outdoor.test.mjs
```

The extraction command verifies the expected ZIP hash before reading fixed named members; it does not extract untrusted member paths. It requires macOS/LLVM `objdump` with code16 support. Tests require Node, no npm packages or original archive. Run tests through the harness `structured_return`, parser `node-test-text`.

### Address conventions

- **FILE** is a byte offset in the original, unrelocated `MARIO.EXE`, not an instruction pointer.
- The MZ load image begins at FILE `0x2e00`. A load-relative far address `CS:IP` maps to `0x2e00 + CS*16 + IP`.
- Outdoor's code segment is load-relative `0x0f92`, base FILE `0x12720`. Entry FILE `0x13dc3` is `0f92:16a3`; loop FILE `0x1397c` is `0f92:125c`.
- **DS offsets** are data addresses, not FILE offsets. Entry bytes at FILE `0x2e00` load `DX=0x1c47`, then FILE `0x2e14` loads DS from DX. Thus initialized DS data begins at FILE `0x1f270`.
- Example: DS:`0x2744` jump table is FILE `0x219b4`, not FILE `0x2744`.
- LLVM prints `cwde`/`cdq` for bytes `98`/`99` in these listings. In this 16-bit code their semantics are **CBW/CWD**. Treat registers and signed arithmetic accordingly.
- A linear sweep across embedded data can misalign the following entry. The dependency extractor restarts disassembly at known routine starts, notably FILE `0x928b`. Embedded switch tables still appear as instruction-looking data; they must not be followed as code.

## 1. Start, frame order, ready and end

### Entry and initialization

FILE `0x13dc3..0x13e28`:

1. Set DS:`4fec=1` (outdoor activity).
2. Call audio/control helper FILE `0x18a49`.
3. Initialize outdoor at FILE `0x1272e`.
4. Draw the initial player image with FILE `0x07a47`.
5. Call FILE `0x14f58`, whose DS:`2941` string is `ready` and whose callee is audio wrapper FILE `0x18d22`.
6. Call FILE `0x188d9` with argument 1, then loop FILE `0x1397c`.
7. Free outdoor resources FILE `0x12cc3`, call audio helper, then results/report entry FILE `0x164dc`.

Do not replace this with an invented three-second countdown. The ready resource name and call order are proven; blocking duration and audio-disabled behavior require the audio worker's full call trace.

Initialization allocates ten 30-byte obstacle records and sixteen 9-byte debris records (FILE `0x12858..0x12881`). Each obstacle has two `0x834`-byte image buffers. Start player coordinates passed to drawing are `(20,90)`, mode 0; base speed is 5, previous scroll initially 1; cursor X is -1. Constants are at FILE `0x128e2`, `0x12a21..0x12a8c`.

The default duration is 120 seconds. A nonzero configured duration at DS:`50c6` is multiplied by 60, its **low word** sign-extended into the statistics duration field at +`0x1f`; see FILE `0x12c90..0x12cbc`. Large invalid settings can overflow. No arbitrary failure time or lives count appears in the ordinary outdoor loop.

### Exact update order

FILE `0x139c7..0x139e0`, before polling input:

| Order | FILE routine | Effect |
|---|---|---|
| 1 | `0x1436c` | Ground phase using **previous** scroll |
| 2 | `0x13852` | Bonus appearance/timer using previous player X |
| 3 | `0x135c9` | Player pursuit, animation, calculate **new** scroll |
| 4 | `0x13058` | Spawn, move and retire obstacles using new scroll |
| 5 | `0x12f59` | Move debris, including fragments created in step 4 |
| 6 | `0x133f7` | Select target/cursor after obstacle movement/compaction |
| 7 | `0x15965`, operation 200 | Shared statistics/HUD update |
| 8 | inline | Check duration; poll one key if time remains |
| 9 | `0x1470c` | Wait for a changed BIOS tick word |

This order produces a one-frame lag between target selection and pursuit. It also means an arriving key is evaluated against the target selected **after this frame's movement**, not the previous frame's target.

FILE `0x1470c` calls FILE `0x192a2`. The latter loops on BIOS INT `1Ah`, AH=0, until the returned low tick word differs from saved DS:`4e2c`. It stores the newly observed value. There is no delta catchup and no VSync instruction in this wait. The familiar roughly 18.2 Hz is standard BIOS clock context, not a measured archive runtime. A browser can schedule approximately 54.925 ms updates as an explicit host adaptation, but must not claim this proves exact original elapsed timing under load.

### Ending, including a subtle repeated check

After HUD/statistics, FILE `0x13a8e..0x13aad` compares signed 32-bit elapsed (+`0x17`) with duration (+`0x1f`). At or above the limit it skips keyboard input and requests ending. Esc (`27`) or normalized F10 (`0x144`) sets abort flags and reaches the same branch (FILE `0x13b51..0x13b9e`).

- If mode is 1, change to 2.
- Otherwise change to 3.
- Mode 3 sets the local loop exit flag at FILE `0x13d1c`.
- The tick wait still runs before return.

Mode 2 can finish the jump sequence in the player routine, but **a persistent expired-duration condition changes mode 2 to 3 on the next loop**. It does not unconditionally wait twelve frames for a landing. Esc without a repeated key can instead allow the remaining mode-2 sequence to finish. The JS test covers the repeated-timeout behavior.

### Pause and special keys

No outdoor-specific pause/resume branch was found in the complete input loop. Normalized `0x12d` invokes FILE `0x149fc` only when option query 10 is true; that routine calls program-exit machinery. It is **not a pause**. The normalizer at FILE `0x19241..0x1927f` converts a `0` or `0xe0` prefix followed by a scan byte to `0x100+scan`. Thus `0x12d` corresponds to extended scan `0x2d` (normally Alt-X), while `0x144` corresponds to F10. Scan-key naming is PC keyboard convention; the numerical dispatch is directly recovered.

A browser pause button must be labeled host adaptation, freeze both game updates and lesson elapsed time deliberately, and must not pretend the executable recovered a pause key.

## 2. Lessons and target generation

### Corpus selection, not arbitrary random letters

Lesson loader FILE `0x928b..0x9484` uses DS:`50c1` to choose a prefix via the six-word jump table at FILE `0x9485`:

| Lesson | Prefix | Outdoor letter file |
|---|---|---|
| 1 | H | `MarioTea/MARIO/HLETTERS.LEE` |
| 2 | T | `MarioTea/MARIO/TLETTERS.LEE` |
| 3 | B | `MarioTea/MARIO/BLETTERS.LEE` |
| 4 | N | `MarioTea/MARIO/NLETTERS.LEE` |
| 5 | S | `MarioTea/MARIO/SLETTERS.LEE` |
| 6 | random 1..5, once during load | One of the above |

Out-of-range lesson values use H. FILE `0x9307..0x9337` chooses `letters`, `words` or `sentenc` from DS:`50b7`; the outdoor letter activity expects selection 1. File suffix comes from shared language handling. This archive supplies `.LEE` corpora. Full language preference resolution belongs to the control worker.

The loader prepends `~`, strips CR (`13`), stops at Ctrl-Z (`26`), counts `~` delimiters, and preserves LF and spaces (FILE `0x93f6..0x946b`). FILE `0x964a..0x9692` chooses `floor(rand15*delimiterCount/32768)` and advances that many delimiter scans. The prepended delimiter counts, so the random start is not equivalent to uniformly picking an arbitrary character offset.

Reader FILE `0x9519..0x9560` advances and wraps the stream and skips `~`. Outdoor at FILE `0x130b6..0x130ce` additionally rejects codes `<=32` and `>=127`, then uppercases the result. It therefore omits spaces/newlines from targets, preserves punctuation, and does **not** call the alternate backtick-skipping reader at FILE `0x95cf`.

The JS constructor's default index 0 is a deterministic host fixture, not the original random start. For faithful initialization, use `lessonBytes`, `selectLessonSegment`, and pass `lessonIndex`; coordinate the shared RNG stream with the control/bonus initializer. `seed` is required rather than silently inventing a startup seed.

### Spawn condition and object pool

FILE `0x1306b..0x130d5` scans all ten active objects. If **any** has X strictly greater than 220, no new object is generated. At exactly 220, generation is allowed. Otherwise it obtains one eligible character and calls FILE `0x12dbb`.

That allocator chooses the first inactive slot, marks it active, clears flag/+`0x16`/countdown, and stores the target at +`0x14`. If all slots are active, the fetched corpus character is still consumed but no object is made.

| Record field | Offset | Meaning |
|---|---|---|
| active | byte +`0x00` | Active slot |
| flag | byte +`0x01` | Set on first record at jump completion; no input gate reads it |
| X, Y | words +`0x02`, +`0x04` | Logical draw coordinate |
| draw X offset | word +`0x06` | 0 for block, 30 for turtle |
| current/previous image | far pointers +`0x0c`, +`0x10` | Drawing buffers |
| target | word +`0x14` | Uppercased code, zero immediately after success |
| auxiliary | word +`0x16` | Initialized zero, no meaningful outdoor use recovered |
| countdown | word +`0x18` | Six-frame hit/removal counter |
| type | word +`0x1a` | 1 block, 2 turtle |
| variant | word +`0x1c` | Block height-table index |

### RNG and the unreachable extra block heights

FILE `0x3807..0x382c` advances a 32-bit LCG:

```
seed = (seed * 0x015a4e35 + 1) mod 2^32
rand15 = (seed >>> 16) & 0x7fff
```

Type is `floor(2*rand15/32768)`, then branch 0 creates type 1, branch 1 creates type 2 (FILE `0x12e24..0x12eb6`). Block starts at `(293,57)` with draw X offset 0; turtle starts at `(283,123)` with draw X offset 30.

The block branch consumes another random draw and computes **`floor(rand15/32768)` without a multiplier** (FILE `0x12e62..0x12e8d`). Since the random result is at most 32767, this is always zero. DS:`2766` contains heights `[57,50,42,33]`, but only 57 is reachable through this allocator. Do not invent randomized heights from the existence of the table. Tests cover every possible 15-bit draw.

## 3. Input, case, correctness and contact

### Selection is not collision

FILE `0x1343f..0x134cc` resets selected index and cursor X to -1, scans slots in order, stops at the first inactive slot, skips zero target codes, and selects the first remaining target. There is no X-distance, player-position, jump-state, ground-state, contact or obstacle-type test in this selection.

FILE `0x13ba1..0x13d1a` accepts normal input if:

1. code is in `[32,127]` inclusive;
2. no special bonus interception applies;
3. selected index is nonnegative.

It increments attempts at stats +`0x05` and compares the uppercase key with object +`0x14`. Correct input increments +`0x09`, requests sound 1, sets countdown 6, and clears the target to 0. Wrong input increments +`0x07`, reports message `0xafa` with the expected target, requests sound 11, and leaves the obstacle unchanged.

Normal lowercase is accepted for an uppercase letter. FILE `0x3a3c` tests DS:`3903[byte] & 8`; the copied classification table marks **only a..z**. It is not Unicode case folding. A space or DEL can count as a wrong attempt, even though neither can be generated as an outdoor target. Other control/extended keys are ignored unless separately dispatched.

### No additional application buffer

The main loop polls once and obtains one normalized key at FILE `0x13aaf..0x13aee`. There is no local string queue, contact-ready key stash, auto-correct or multi-character scan. Any queued/typeahead behavior belongs to the DOS/BIOS input layer. Therefore a browser must explicitly decide how to translate host keyboard events into one normalized key per game iteration; do not turn every DOM event into a separate simulation update.

Success can happen at the right edge, far before visual contact. It clears the code immediately, so next tick's selection can advance to another still-visible object while the previous one is in its six-update removal phase. The selected index is not recalculated again within the same input iteration.

### Demo mode

DS:`50c3` enables synthetic input at FILE `0x13afc..0x13b51`. When DS:`4f96` reaches zero and a target exists, it supplies the selected code, then resets the countdown to `10+floor(rand15*10/32768)`; otherwise it decrements the counter. Initial countdown is 30. This is a distinct demo path, not ordinary buffering or contact gating. It is documented but not enabled in the ordinary JS loop.

## 4. Motion and animation

### Horizontal pursuit and adaptive scroll

FILE `0x135dc..0x136a0` uses signed 16-bit words. In mode 0:

```
followX = s16(previousCursorX - 10)
followX = s16(followX - previousScroll)
```

Modes other than 0 retain the previous follow point, then subtract previous scroll. When a target exists:

```
dx = trunc(s16(followX - playerX) / 8)
dx += followX > playerX ? 1 : -2
dx = clamp(dx, -8, 8)
if followX == playerX: dx = 0
nextX = max(0, s16(playerX + dx))
```

If cursor X is negative, DX starts at zero and remains zero. The apparent deceleration branch at FILE `0x1364f` cannot gradually ease a previous velocity because FILE `0x135f3` already cleared DS:`4880`.

New scroll is `trunc(s16(5*cursorX)/160)`; missing target substitutes X=319. The IMUL high word is discarded by CWD before IDIV, so signed **low-word** overflow matters. The logical X value, not cursor rendering offsets or turtle +30, controls scroll.

For reachable nonnegative cursor X below 32, scroll becomes zero. This is how the level waits at unanswered targets. It is not a collision hold or a timeout that removes targets. No-input tests settle at a stationary obstacle without attempts or an invented loss condition.

### Run/idle selection

FILE `0x136cb..0x1378e`:

- Moving DX resets still counter DS:`4882` and idle counter DS:`4886`.
- Stationary DX increments still counter.
- Through counter 4, run frame is `trunc(signedDistance/6) % 12`; only afterward add `abs(dx)` to signed word DS:`4884`.
- At counter >4, set still counter to 10 and use idle scheduling.
- Idle counter increments each update; halve with truncation toward zero, reset at character-specific period, scan signed-byte frame thresholds, and choose the preceding threshold's resource slot. If no greater threshold is found, the initialized default slot is 0.

The distance counter is a signed wrapping word. Extremely long sessions can produce negative run indices after overflow. The translation preserves the integer result, but a browser renderer must not silently claim an invented wraparound fixes original out-of-bounds pointer behavior.

FILE `0x1d610..0x1d814` normalizes character choice to 1..3, default 1:

| Character | Resource prefix | Idle table DS / FILE | Entries | Half-tick period |
|---|---|---|---:|---:|
| 1 (Mario) | m | `339a` / `2260a` | 47 | 90 |
| 2 (Luigi) | l | `33c9` / `22639` | 47 | 124 |
| 3 (Peach) | p | `33f8` / `22668` | 51 | 104 |

Tables are fully copied in `tables.json`. Do not swap the Mario/Luigi periods to make them match the largest threshold; these are the actual constants and some late entries are consequently not selected by this loop. Idle resource names use the threshold values, not the table slot number: `mstd0001_1`, etc. FILE `0x15264` decompresses the selected IDLE image into alternating buffers; FILE `0x15309` returns the current buffer.

Running resources are `%crun0001_1` through `%crun0012_1` from WALKING. Jump resources loaded are `%cjmp0008_1` through `%cjmp0020_1` (13), but outdoor's twelve-step jump uses the first twelve, through 0019.

### Jump is a fixed table, not ballistic physics

A correct block while mode 0 sets mode 1 and jump index 0 at FILE `0x13ca9..0x13cd1`. Correct turtle input never starts this jump; correct block input during an existing jump does not restart it.

FILE `0x13790..0x137eb` uses DS:`2744`:

```
Y offsets: 0, -19, -26, -28, -28, -25, -20, -2, 0, 0, 0, 0
base Y: 90
```

Increment the index after using it. At index 12, reset to zero, override this update's Y with **85**, set first obstacle's byte +1, and change mode 1 to 0 or mode 2 to 3. The next ordinary update uses Y=90 again. Mode 2 normally retains the previous character image while advancing Y; a final transition to mode 3 bypasses that image hold. Every jump-path update requests sound 2.

The JS exposes image kind and index but does not currently emit that repeated jump sound. Sound-request semantics are recovered here for the audio integrator; actual overlap/throttling is not established.

### Coordinates and character-specific offsets

Coordinates above are arguments to the sprite compositor, not a claim that all visible pixels begin at those coordinates. Resource headers include origins; the renderer must honor the asset worker's verified origin semantics.

Character 3 sets DS:`48f3=36`, DS:`48f1=30`; others use zero (FILE `0x12760..0x12779`). These offsets apply to block rendering, block debris and the target cursor over a block, **not to the pursuit coordinate**. The target cursor is drawn at:

```
X = object.X + object.drawXOffset + 10 + (PeachBlock ? 36 : 0)
Y = object.Y - cursorSprite.height - 2 + (PeachBlock ? 30 : 0)
```

Cursor height is 10. The phase counter increments and wraps at 12; frame slots are `[0,1,2,3,2,1][trunc(counter/2)]` (FILE `0x1340c..0x1343c`, DS:`2734`). Slots map to `cursor_1..4`.

When no target exists, the original cursor draw path can read an uninitialized local Y (FILE `0x13542..0x135be`). The port intentionally does not invent a meaningful cursor position in this case. Hide the marker when selected index is -1.

## 5. Obstacles, removal and debris

FILE `0x130fe..0x13324` subtracts new scroll from every active object's X. Y stays fixed. A nonzero countdown decrements once. At zero or below, the computed X becomes -1 so the ordinary off-left branch retires it.

Block expiration at FILE `0x13146..0x131f7` spawns up to four fragments using the object's **old** position (before this frame's scroll), plus character offsets:

| Relative position | Velocity |
|---|---|
| `(0,0)` | `(-2,-6)` |
| `(0,8)` | `(-2,-3)` |
| `(10,0)` | `(2,-6)` |
| `(10,8)` | `(2,-3)` |

Each fragment allocator scans sixteen slots; a full pool drops the new fragment. Expiration requests sound 4. Turtle hit countdown copies the `turt1_2` shell-like image into its image buffer on every countdown update and expiration requests sound 3. Sprite visual naming as turtle/shell is supported by the `turt` names and decoded image association; no separate autonomous turtle motion is recovered.

Debris FILE `0x12f59..0x13057` computes `newX=s16(x+vx-scroll)`, `newY=s16(y+vy)`, then increments VY. It retires a fragment outside inclusive X `0..309` or Y `0..131`. Surviving fragments store new coordinates. Newly spawned debris advances immediately because this routine follows obstacle update.

After all objects, if slot 0 is inactive, FILE `0x1332d..0x133ef` shifts exactly nine records down one, clears the last record, and retains/recycles its two image buffers. It does not compact all holes. The JS preserves the one-record shift and logical allocation order; buffers are omitted.

## 6. Real resource indices and drawing

Resource index numbers here are zero-based entries of the original GSK/GCK, not executable offsets. Full hashes and byte offsets are in `tables.json`.

| Original member | Index / name | Header size | Runtime role |
|---|---|---|---|
| `MarioTea/MARIO/OUTSIDE.GSO` | 0 `turt1_1`, resource offset `0x22` | 30x17 | Turtle target base |
| same | 1 `turt1_2`, `0x22a` | 25x17 | Hit turtle image |
| same | 2 `brick1_1`, `0x3dd` | 20x16 | Block target base |
| same | 3 `expls1_1`, `0x527` | 10x8 | Debris |
| same | 4..7 `cursor_1..4` | 11x10 | Animated target marker |
| `MarioTea/MARIO/WALKING.GSO` | 0..11 `mrun0001_1..0012_1` | 40x50 | Mario running |
| same | 12..23 `mjmp0008_1..0019_1` | 40x50 | Mario outdoor jump |
| same | 30 `lrun0001_1` onward | 40x50 | Luigi run family |
| same | 72 `pjmp0008_1` onward | 40x50 | Peach jump family |
| `MarioTea/MARIO/IDLE.GCO` | 0 `mstd0001_1`, 94 `pstd0001_1` | variable origins/sizes | Compressed idle family |

FILE `0x1413d..0x14259` composes the target glyph over the base image. It clamps codes outside 32..127 to 127, subtracts 32 to index the font pointer array DS:`4fc0`, and draws using a three-byte mapping `[0,15,31]`. Type 1 uses glyph coordinate `(6,3)` on `brick1_1`; type 2 uses `(15,3)` on `turt1_1`. This is not generic centered text. The font-family binding and palette ownership should be taken from the shared asset/control traces, not guessed here.

## 7. Ground scrolling, bonus scene and progression scene

### Normal scrolling is a small ground strip

FILE `0x1436c..0x143c0` adds **old** scroll to DS:`51ac`, takes signed remainder modulo 20, and calls FILE `0x994d` when enabled by DS:`4feb`. The blitter uses the 20x16 tile at DS:`0312` (FILE `0x1f582`) and writes a 320-pixel-wide strip beginning at framebuffer offset `0xaf00`, row 140. It fills rows 140..155 with a phase-shifted repeat. The initializer sets the enabled byte to 1.

There is no ordinary-loop advance through a sequence of full scenic backgrounds. The OUTSIDE scene remains while objects/player/ground are redrawn. OUTSKY and OCASTLE are separate bonus and progression presentations, not a recovered repeating landscape cycle.

### One-shot punctuation bonus

Shared initializer FILE `0x14e54..0x14f3c` allocates the image and sets mode 1. Four RNG draws produce:

- X = `20+floor(rand15*250/32768)`;
- Y = `5+floor(rand15*30/32768)`;
- initial delay = `30+floor(rand15*30/32768)`;
- character = `33+floor(rand15*15/32768)`, punctuation `!` through `/`.

Outdoor immediately replaces the delay at FILE `0x12c0c..0x12c4e` using a fifth draw: `15+trunc(rand15*(stats.duration-30)/32768)`, or 15 if option query 10 is enabled. The statistics duration read here is **before the final outdoor duration assignment**. Shared statistics initialization must resolve its exact initial value. Do not substitute current configured duration without checking that call order.

FILE `0x13852..0x1397b`:

- Mode 1 compares wall-second value with DS:`4888`; a change decrements delay once, even if several seconds elapsed.
- At delay <=0, switch to mode 2 and set countdown 45.
- Mode 2 moves X one pixel toward the previous player X and decrements countdown **every game update**.
- At zero, mode becomes 0 and the image is erased. This routine does not rearm it.

The raw matching punctuation key intercepts before ordinary attempts at FILE `0x13bb2..0x13bc5`. It calls statistics operation 310, sets countdown 0, runs FILE `0x14298`, restores OUTSIDE/palette/cursor, calls statistics operation 300, and flushes queued keys with FILE `0x19221`. It does not clear the ordinary target as a normal successful key would.

FILE `0x14298..0x1436b` loads `outsky`, chooses `mout.ban/mout.ani`, `lout...` or `pout...` from character, and calls animation driver FILE `0x07ff5`. The translation emits `bonus-cinematic-required` rather than silently substituting an invented animation. Header bytes alone are not sufficient to prove ANI/BAN playback, so this worker does not implement that driver.

### Progression presentation

After results statistics operation 130, FILE `0x13d61..0x13db2` checks progression enabled, result word +`0x37` against goal DS:`50bf`, and abort/option conditions. Below lesson 6 it increments lesson. At lesson 6 it sets goal to result DS:`51ee`+2, caps at 10 and marks DS:`50ce` if exceeding 10. Eligible success invokes FILE `0x13e29`.

That routine loads `ocastle`, starts player at `(-50,110)` with movement `(5,1)`, changes movement to `(2,-3)` after X>155, and advances twelve run images by frame modulo 12. At X>=185 it removes the player and runs ten random `fir1`/`fir2` animation presentations. Keys can skip the movement/fireworks. It then displays progression text and waits for input. This is a results celebration, not obstacle physics or a normal outdoor scene transition. It is documented, not translated.

## 8. Integration contract and remaining limits

### Useful slice

`createOutdoor` creates a fresh-process logical state. `tick` updates it once in recovered order. Supply a normalized numeric key, elapsed/limit values from shared statistics, and the selected character's idle schedule/period. State carries logical obstacles, debris, cursor selection, animation kind/index, coordinates and basic attempt counters. Events report correct/wrong, destruction sounds, program exit, end and unsupported bonus cinematic.

`makeBonus` and `updateBonus` are independently usable. When passed to `tick`, the bonus update runs before player movement and raw bonus input intercepts normal matching. A renderer must pause this loop while handling `bonus-cinematic-required`, restore the scene, flush host queued keys, and use the control worker's elapsed-time treatment. Those host operations are not secretly simulated by this module.

Character frame names resolve using prefix and the resource table, with running slot +1, jump slot +8, and idle schedule value at the returned idle slot. Draw the original OUTSIDE art, the ground strip, actual target composited images, player frames, particles and cursor. Do not move the entire background just because logical scroll is nonzero.

### Explicit limits

- **Recovered but not implemented:** demo synthetic typing, repeated jump sound requests, progression presentation, full statistics/message operations, pixel-exact glyph/palette/compositor behavior and ready/audio branches.
- **Partially recovered:** bonus timer/matching fully translated, cinematic driver/playback not translated.
- **Unknown:** precise original keyboard queue capacity/typematic, startup RNG seed, ready blocking with each sound configuration, behavior of renderer memory reads after signed-distance overflow.
- **Fresh-process limitation:** some DS animation/ground/wall-second counters are zero-initialized but not reset by every outdoor entry. The constructor resets them. Exact activity reentry requires carrying those original persistent fields through shared state.
- **Browser adaptations:** named objects instead of far-pointer records; drawing/audio events instead of DOS side effects; externally supplied clocks and key normalization; rejection of an unproductive lesson instead of hanging; hiding a missing-target cursor instead of using undefined stack Y.
- **Not claimed:** full decompilation, pixel/byte-for-byte equivalence, complete original menus, all activities, or measured frame pacing.

### Checks

The authored test suite checks source-table/byte agreement, copied lesson hashes, key filtering and case, RNG overflow, all block-height random inputs, spawn boundary, immediate distant acceptance, wrong-key counting, six-update removal, particle clipping/gravity, signed pursuit and scroll math, run/idle/jump boundaries, end ordering, repeated timeout, ground old-scroll order, bonus clock units/interception, and a 400-step no-input stop.

The initial run passed 14 tests. The final run after adding bonus tests is recorded in `checks.json`. These are source-derived expectations and arithmetic boundary tests, not differential tests against an executed original. No browser renderer, audio or cinematic was tested by this worker.
