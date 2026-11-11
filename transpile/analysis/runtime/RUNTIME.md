# Runtime: RNG, corpus cursors, practice lines and bonus keys

**The RNG seed is the low 16 bits of DOS `time(NULL)`. Practice wrapping can repeat an overlong word forever. Bonus punctuation comes from one shared four-draw initializer.** These are static-byte findings, not substitutes based on browser conventions.

Reentry, keyboard pending/consume, FONT7H binding and scene cleanup are detailed in [REENTRY.md](REENTRY.md). Outside now accepts `createOutdoor({previous})` and `makeBonus(seed, previousDuration, fast, lastSecond)`; omission still means fresh-process defaults. Keep the previous Outside object and its bonus clock across other worlds. `createPendingInput()` supplies an explicitly host-adapted raw-byte FIFO for source-order tests.

Use `../../recovered/runtime/runtime.mjs` for the newly translated routines. Existing outdoor RNG/bonus arithmetic is already correct; the main integration changes are seed ownership, shared consumption order, practice's actual line builder and cursor helpers. Do not replace the original line builder with generic word wrapping.

## Evidence and reproduction

| Source | SHA-256 |
|---|---|
| `Mario_Teaches_Typing_1992.zip` | `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd` |
| `MarioTea/MARIO/MARIO.EXE` | `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e` |

- Every address below is an executable **FILE offset**, unless prefixed DS. MZ load-image base is `0x2e00`, DS initialized-data base is `0x1f270`.
- `evidence.json` contains copied byte spans, their hashes, initialized state bytes and the two source identities. `*.asm.txt` contains focused static disassembly with original instruction bytes and far-call FILE destinations.
- `corpora.json` contains exact bytes and hashes of all 15 `MarioTea/MARIO/{H,T,B,N,S}{LETTERS,WORDS,SENTENC}.LEE` members. No corpus is replaced by generated text.
- `references.asm.txt` records direct RNG calls, seed writes and bonus-key references found by a whole-code linear scan. This is a useful reference inventory, not proof against indirect addressing or embedded-data misalignment.
- Phase1 adds focused keyboard, timer, Outside motion/cleanup, font loader and RIX-service spans plus their initialized-state evidence. `fonts` records FONT7H member identities and inert FNT/GSK metadata.
- Focused extraction restarts at `0x928b` and `0xb391`, avoiding the previous workers' jump-table misalignment at those entries. LLVM labels 16-bit opcodes 98/99 as `cwde/cdq`; interpret them as CBW/CWD.
- No original program was executed, interpreted or emulated. The ELF wrapper is temporary inert data for trusted `objdump`, never loaded as a program. It is removed after analysis.
- Copied original data and disassembly remain private and are not covered by the repository MIT license.

From this worktree root:

```sh
python3 transpile/tools/runtime/inspect.py
node --test transpile/tests/runtime/runtime.test.mjs
```

Run through `structured_return`; Node parser is `node-test-text`. Python requires code16-capable Apple/LLVM objdump; JavaScript has no package dependencies. Tests use authored arithmetic and source-derived branch expectations, never an original-code interpreter.

## 1. Exact random state and seeding

| FILE | Input / condition | State / result |
|---|---|---|
| initialized DS:3c34, FILE `0x22ea4` | Before application seeding | 32-bit seed is **1**, bytes `01 00 00 00` |
| `0x126a0..0x126b3` | Startup passes null pointer to `0x39b8`, then pushes AX into `0x37f6` | Seed is low word of returned time, not tick counter or milliseconds |
| `0x37f6..0x3806` | 16-bit seed argument | DS:3c34=argument, DS:3c36=0 |
| `0x3807..0x382c` | Each random draw | `seed=(seed*0x015a4e35+1) mod 2^32`; return `(seed>>>16)&32767` |
| `0x330c`, `0x339f` at bounded call sites | Draw and signed long bound | Low32 product, signed long division by32768 toward zero, callers retain AX |

`random15({seed})` mutates the supplied state. `scaleRandom(draw,bound)` implements `s16(trunc(s32(draw*bound)/32768))`. Ordinary positive bounds produce floor, not remainder. Negative bounds and overflow are preserved, including the outdoor bonus's pre-reset duration calculation. There is no original general `random(bound)` function at these call sites; it is a repeated compiled expression.

### Seed clock inputs, not a claim of a recorded historical seed

`0x39b8` calls:

1. `0x333f`: DOS INT21/AH2A, year/month/day.
2. `0x3352`: DOS INT21/AH2C, hour/minute/second/hundredths.
3. `0x7030`: calendar-to-seconds conversion, **ignoring hundredths**.
4. Startup takes only the returned AX. Seeds therefore repeat every65536 converted seconds.

`dosTimeSeconds` translates the calendar arithmetic for valid DOS date fields: base `0x12cea600` (1980-01-01 epoch seconds), four-year blocks, leap years tested by year&3, month-length table, hour/minute/second and signed32 wrap. It accepts timezone seconds and the resolved daylight-active flag explicitly.

The executable's `0x735e` examines environment variable `TZ` (string at DS:3d52). Missing/invalid values set offset18000 and enable daylight handling, with names EST/EDT. A valid three-letter zone plus signed numeric hours sets offset hours*3600; a following three-letter daylight name enables daylight handling. `0x754c` implements historical April/October rules, including a year>1986 April branch, not today's browser rules. These routines are copied as evidence but their environment parsing and daylight predicate are **not translated**. The JS calendar helper takes their resolved outputs. Do not feed modern browser daylight decisions into it and claim DOS timezone equivalence.

**Host adaptation:** supplying `seedFromTime(Math.floor(Date.now()/1000))` is a convenient current-host seed policy, not a recovered original-machine timezone configuration or timestamp. For reproducible runs use an explicit seed, preserve it across menus/activities, and record it. Do not reseed at every activity entry.

## 2. Random-stream consumption order

### Before outdoor entry

Startup does not imply that the first draw belongs to the lesson. The title and menu consume the same state:

| FILE | Branch | Draw consumption |
|---|---|---|
| `0xff2a..0xff75` | 13 title presentation iterations; keyboard-pending check before each delay | No pending key: one draw, delay `4+floor(4*r/32768)`; pending: no draw. Iteration index6 adds a fixed delay12 only on the no-pending path |
| `0x10b4d..0x10baa` | Signed32 `(nowTicks-lastTicks)>delayTicks` | One draw; save current ticks, set DS:483c=1, next delay=`19*(5+floor(5*r/32768))` |
| Same timer, equality or negative difference | No trigger | No draw |

`titleDelay` and `menuRandomTimer` translate those draw predicates. They do not implement title artwork, menu event pumping or complete menu animation. User timing changes the RNG state at activity entry, so a fixed seed alone does not establish a fixed course unless preceding input/tick history is fixed too.

### Outdoor initialization and ordinary course

Order below starts with the RNG state **at outdoor entry**. Direct startup draw sites are listed; ordinary resource-load helpers have no direct RNG references in the scanned code.

| Order | FILE | Consumption |
|---:|---|---|
| 1 | `0x12750 -> 0x928b`; branch `0x92e7` | Lesson6 only: one draw to select prefix1..5. Other lessons consume none |
| 2 | Loader `0x947c -> 0x964a`, draw `0x9667` | One draw for normalized corpus delimiter count; scan that many boundaries |
| 3 | `0x12c07 -> 0x14e54`, draw `0x14ea2` | Bonus X=`20+scaled(250)` |
| 4 | `0x14eca` | Bonus Y=`5+scaled(30)` |
| 5 | `0x14ef2` | Bonus initial delay=`30+scaled(30)`, later discarded outdoors |
| 6 | `0x14f1a` | Bonus key=`33+scaled(15)` |
| 7 | `0x12c13` | Replacement delay=`s16(15+scaled(s32(previousLimit-30)))`; consumed even if option10 subsequently forces15 |
| Later | `0x130b6 -> 0x9519` | Target fetch consumes **no random draw**; sequential normalized corpus bytes |
| Later | Allocator `0x12e2b` | If free slot exists: one draw, scaled(2) chooses block/turtle |
| Conditional | Block branch `0x12e69` | One additional draw with bound1, always zero; block height index is never random1..3 |
| Conditional | Demo input `0x13b2a` | On synthetic key generation: one draw for `10+scaled(10)` |
| Post-result | `0x13fe1..0x14021` | Up to10 fireworks, one draw per unskipped presentation. **Output bit0**, not scaled(2), selects `fir1` for odd, `fir2` for even |

There is no recovered precomputed course randomizer. Spawn examines existing obstacle X positions; allocation draws occur only when a slot is available. A fetched target is consumed even if allocation fails. A turtle consumes one draw, a block two, so forcing a type without consuming the correct number desynchronizes later bonuses/activities.

### The first outdoor bonus can appear unusually early

Startup `0x12678..0x12681` invokes statistics operation10. Dispatch table FILE `0x164ac` maps10 to `0x159c0`; that branch zeroes62 bytes including limit+0x1f. Outdoor computes the bonus override **before** operation111/reset and before assigning its120-second/default configured limit (`0x12c76..0x12cbc`). Therefore on an ordinary first outdoor visit with no intervening lesson, previousLimit is0 and delay can be **-14..15**, not15..104. A later visit can use a prior activity's duration. Supply actual prior statistics state, not a convenient current setting.

This is a control-flow consequence, not an invented random distribution. It also explains why a browser fixture with priorDuration120 can disagree while using the correct LCG.

## 3. Corpus loader and cursor contract

| DS state | Meaning | Initialization / lifetime |
|---|---|---|
| 40aa | Previous water-reader result | Initialized0 in executable, not reset by corpus loader/unloader |
| 40ac | Count of `~` boundaries | Loader starts1 for prepended delimiter |
| 40ae | Cursor at **next raw byte** | Initial0; unload resets0; random selection advances existing position |
| 40b0 | Normalized length including prepended delimiter | Starts1, increments for each retained file byte |
| 40b2:40b4 | Buffer far pointer | Host `Uint8Array` adaptation |
| 40b6 | Loaded flag | Lazy load if unset; unload clears it |

### Loading (`0x928b..0x9484`)

- Lesson1..5 selects h,t,b,n,s. Lesson6 draws1..5 then follows the same branch. Out-of-range values use h.
- Mode1/2/3 selects `letters`/`words`/`sentenc`, default `letters`; filename is `%c%s.%s`, language suffix from `0x8b00`. The supplied archive has `.LEE`.
- File-size limit is32000. Allocate file length+1, prepend `~`, drop CR13, stop at Ctrl-Z26. Keep LF, TAB, NUL, backtick, spaces and high-bit bytes.
- Loading immediately calls random segment selection. `loadCorpus` deliberately separates that operation so callers can preserve the shared RNG order.
- For reloads preserve `previousWater`: `loadCorpus(raw, oldStream.previousWater)`. A fresh host stream defaults0; resetting it on every lesson is not original lifetime behavior.

### Reading and rewinding

| FILE / JS export | Exact operation |
|---|---|
| `0x9519`, `nextCorpus` | Read current byte, sign-extend8 to16, then increment/wrap cursor; skip only `~` |
| `0x9561`, `nextWater` | Read as above, map TAB/LF/CR to SPACE, suppress SPACE only if prior returned water code was SPACE; store returned code |
| `0x95a1`, `nextCastle` | Same whitespace mapping, no duplicate-space suppression; backtick retained |
| `0x95cf`, `nextPractice` | Skip backtick on top of `nextCorpus`; preserve every other control byte |
| `0x94ce`, `rewindCorpus` | Decrement cursor before inspecting, wrap below0 to length-1; `~` and backtick do **not** count toward requested rewind; spaces/LF/NUL do count |
| `0x95f2`, `nextCorpusSegment` | Read/increment raw cursor until **after** next `~`; guard permits length+1 reads if absent |
| `0x964a`, `selectCorpusSegment` | Draw scaled(delimiterCount), call segment scanner that many times; does not reset cursor |

**Do not improve the random starting-block distribution.** At a fresh cursor0 the prepended `~` means draw0 and draw1 both yield the first text block. For `~A~B~C`, scaled results0/1 start A, result2 starts B. C is not selected as an initial block but is reached later by circular reading. Existing outdoor `selectLessonSegment` already follows this behavior.

The host translation throws instead of hanging on streams containing no usable bytes. It does not model DOS file-open failures, allocation failures, fatal-message rendering or far-pointer arithmetic. All supplied corpora fit the original size/range constraints.

## 4. Practice's exact 10x33 buffer

### Layout and fill order

- DS:41c3 is character index, DS:41c5..430e is330 bytes: ten rows of33. Initialized state bytes are copied in `evidence.json` and are all zero.
- Row0 (41c5) is the input/display row. Row1 (41e6) supplies the current target. Row9 (42ee) receives new lines.
- `0xb3f4..0xb407` copies264 bytes from rows2..9 into rows1..8. It does not copy row1 into row0.
- `0xb40a..0xb41b` clears row9, builds a local line and `strcpy`s it into row9.
- `0xb391..0xb3ba` clears row0 and sets index0 after each fill.
- Startup `0xb3ca..0xb3d8` calls fill exactly nine times, giving nine future lines plus a blank input row. Reentry overwrites all target rows through these nine calls.

### `practiceLine`, FILE `0xb3e1..0xb4d3`

| Stage | Condition | Effect |
|---|---|---|
| Read up to32 bytes | Use practice reader, not whitespace-normalized reader | Backticks/tilde skipped, other control bytes retained |
| Early LF | LF occurs among first32 reads | Terminate immediately; **bypass leading-space trim** |
| Track trailing fragment | Code SPACE resets DI=0; every other code incrementsDI | TAB is not a word boundary |
| Full32 path | No early LF | Set SI=`strlen(local)-1`, read one extra practice byte, incrementDI |
| Peek is SPACE, or SI==32 | `0xb47d..0xb488` | SetDI=0, consume peek without rewinding |
| Otherwise | Including peek LF | RewindDI practice-counted bytes, including peek |
| Truncate | `SI -= DI-1`; SI>=0 | Write NUL at SI; negative SI leaves local32 bytes unchanged |
| Trim | Only full32 path | Repeated overlapping `strcpy(local,local+1)` while first byte SPACE |
| Copy | Both paths | Copy up to first NUL into cleared33-byte row |

Consequences that tests preserve:

- Short `"  hello\n"` retains two leading spaces. A full-width line trims them.
- Exactly32 nonspace characters followed by SPACE are returned and the peek SPACE is consumed.
- Exactly32 nonspace characters followed by LF rewind all33 characters. The same line can repeat indefinitely.
- A word longer than32 characters likewise repeats; the original does **not** split it conventionally.
- A partial trailing word after a separating SPACE is rewound; truncation removes that separator too.
- Embedded NUL shortens `strlen`/`strcpy` even though later source bytes were consumed. LF and TAB are not silently made typable spaces.
- The `SI==32` check is retained although an ordinary full32 local string makesSI31. Do not change it to31 to repair the apparent off-by-one.

### Input, face and failure

| FILE | Predicate | Result |
|---|---|---|
| `0xb73d..0xb74d` | Key32..127 inclusive, or CR13 | Accepted into scoring; LF10 rejected before its later comparison |
| `0xb750` | Every accepted key | Increment signed16 attempts |
| `0xb766..0xb77e` | Target NUL and key SPACE or CR | Fill/advance line, count correct, sound1, reset last-correct clock |
| `0xb780..0xb7bb` | Exact signed target byte equals key | Increment index, draw typed glyph directly, correct++, sound1, save wall seconds |
| `0xb7be..0xb7e0` | Wrong accepted key | Expected-key message0xafa, sound11, errors++; no index/clock advance |
| `0xb502..0xb524` | signed32(now-lastCorrect)>15 | Face resource101, decoded practice image index0 |
| `0xb526..0xb53d` | Otherwise profile enabled AND signed WPM>goal | Face103, image index2 |
| `0xb53f` | Otherwise, including WPM==goal | Face102, image index1 |
| `0xb5c2..0xb5e3`, `0xb69e..0xb6a5` | Lesson time expires | Exit, not a low-accuracy/inactivity failure |
| `0xb712..0xb73a` | Esc / normalized0x12d | Esc exits;0x12d invokes option-gated shared exit handling. F10 has no explicit practice exit branch here |

DS:41b3..41b6 last-correct timestamp is initialized0 in the executable. No setup reset is present in this traced practice initializer; the explicit update is `0xb7b5`. On a fresh process a contemporary wall clock therefore selects the overdue face until a correct key. Reentry should carry this timestamp rather than reset it to now. `createPractice(stream,lastCorrect=0)` exposes that lifetime.

The row0 memory stays blank in ordinary correct-input handling: the glyph is drawn through `0x1aa7b`, not written into this array. A renderer may keep a separate typed-prefix view, but must not present it as recovered DS buffer contents.

Use existing `recovered/worlds/routines.mjs::practiceExpression` for face selection. Image association is the worlds worker's resource mapping: `MarioTea/MARIO/PRACTICE.GSO`, SHA256 `2cb053fb1e016d3bd322e09a64406a521a5c903a33df535c8da4acb05a3976b1`, decoded indices0/1/2 `prac0001_1`/`prac0002_1`/`prac0003_1`, offsets0x22/0xc98/0x190e, each53x60. This runtime lane verifies executable selection conditions, not a new sprite decoder.

## 5. Shared bonus-key producer and consumers

`0x14e54..0x14f3c` sets DS:5012=1, then consumes four draws in X/Y/delay/key order. **FILE `0x14f38` writes DS:5014** with `33+scaled(15)`, so the pending key is one of ASCII `!` through `/`, exact raw punctuation. It is not drawn from the lesson corpus and is not newly chosen when the bonus activates.

| Caller / consumer | Conditions and effects |
|---|---|
| Outdoor initializer `0x12c07` | Shared four draws, then fifth replacement-delay draw; key used to compose bonus block at `0x12c58` |
| Water initializer `0x16bf5` | Same shared producer; key loaded for bubble glyph at `0x16c8c` |
| Castle initializer `0xd839` | Same shared producer; key loaded for actor glyph at `0xd8d0` |
| Outdoor `0x13bb2..0x13c64` | Only mode2 and raw key==5014 intercepts; stats310, countdown0, cinematic, restore scene, stats300, flush input; ordinary attempts not incremented |
| Water `0x17801..0x17890` | Only mode2 and raw key==5014; stats310, mode3, cinematic, restore, reset inactivity timestamp, stats300; no ordinary score |
| Castle `0xbdba..0xbe80` | Only mode2 and raw key==5014; stats310, mode3, cinematic/scene restoration, stats300; no ordinary score |

`initializeBonus` returns `{mode,x,y,delay,code}` and mutates the shared RNG. `matchesBonus` exposes the common raw-key predicate, not complete cinematic dispatch. The existing outdoor `makeBonus` already combines four shared draws and the fifth override; use it **instead of**, not in addition to, these new helpers.

Water `0x17560..0x17682` may reset bonus mode as the bubble leaves view but does not write5014, so it reuses the pending key until a shared initialization. The complete reference scan found only the shared direct store at14f38; this does not exclude untraced indirect stores.

## 6. Integration examples with existing modules

### Outdoor: retain the main implementation, correct initialization inputs

```js
import { seedFromTime, lessonPrefix, loadCorpus, selectCorpusSegment }
  from './recovered/runtime/runtime.mjs';
import { createOutdoor, makeBonus, tick }
  from './recovered/outdoor/outdoor.mjs';

// Once per process/session. Fixed captured timeSeconds is reproducible.
const rng = { seed: seedFromTime(timeSeconds) };
// Title/menu helpers consume rng before entering the activity, if implemented.
const prefix = lessonPrefix(lessonNumber, rng);
const raw = await readLocalCorpus(`${prefix}letters.LEE`); // host asset lookup
const corpus = loadCorpus(raw);
selectCorpusSegment(corpus, rng);
const bonus = makeBonus(rng.seed, statistics.limitSeconds, option10, outdoorLastSecond);
rng.seed = bonus.seed;
const game = createOutdoor({ bytes: raw, seed: rng.seed,
  character, lessonIndex: corpus.index, previous: lastOutdoor });
lastOutdoor = game;
// Only now assign the outdoor statistics duration/reset in the control layer.
const events = tick(game, { key, elapsed, limit, idleSchedule, idlePeriod,
  bonus, second: wallSeconds });
// After each step or on exit, retain this state for the next activity/menu.
rng.seed = game.seed;
outdoorLastSecond = bonus.lastSecond;
// lastOutdoor=null and outdoorLastSecond=0 are initialized once per session.
```

The host lookup is intentionally not a fake corpus generator. `readLocalCorpus` must return the extracted named member's bytes. `timeSeconds`, input, ticks, renderer and resource access are host inputs, not hidden emulation. `createOutdoor` already normalizes `raw`; do not pass `corpus.bytes` there or it will prepend another tilde.

### Practice: use exact line and input state, reuse face logic

```js
import { loadCorpus, selectCorpusSegment, createPractice, practiceInput }
  from './recovered/runtime/runtime.mjs';
import { practiceCorpus, practiceExpression }
  from './recovered/worlds/routines.mjs';

const kind = practiceCorpus(goal); // goal<10 letters, <30 words, else sentenc
// Choose row prefix with lessonPrefix first, preserving lesson6 draw order.
const corpus = loadCorpus(await readLocalCorpus(`${prefix}${kind}.LEE`));
selectCorpusSegment(corpus, rng);
const practice = createPractice(corpus, retainedLastCorrect);
const result = practiceInput(practice, normalizedKey, wallSeconds);
const faceIndex = practiceExpression(wallSeconds, practice.lastCorrect,
  profileEnabled, wpm, goal);
// Render 33-byte rows directly with NUL-as-space display; target is row1[index].
// Do not also call worlds.practiceCharacter: practiceInput already scores.
```

## 7. Validation and limits

Checks cover byte-span hashes/constants, seed truncation,500 LCG transitions against independent BigInt multiplication, all32768 draws for type/height bounds, signed product overflow, DOS calendar arithmetic, delimiter/control-byte behavior, rewind, biased initial segment selection, LF/full-line differences, embedded NUL,32-character and long-word repeat cases, nine-row fill, scoring/time retention, shared six/seven-draw startup order, title/menu conditional draws, fireworks bit choice and all15 real corpus hashes/fills.

- **Recovered and translated:** LCG/srand/bounded arithmetic; valid-calendar conversion with resolved TZ/DST inputs; prefix selection; corpus normalize/read/rewind/segment helpers; practice lines/buffer/input; shared bonus producer/predicate; title/menu draw predicates; fireworks variant.
- **Recovered and reused:** outdoor ordinary RNG/type/bonus code and practice face selection already in merged main modules.
- **Not translated here:** DOS environment parser/daylight predicate, file/heap error UI, keyboard callback scheduling, complete title/menu animations, practice drawing/audio dispatch, bonus/progression ANI/BAN playback. The pending-input harness models operation semantics, not DOS hardware or queue capacity. KWD option-query and font/palette lifetimes are traced in REENTRY.md.
- **Not established:** an original historical seed, measured frame pacing, complete hidden-indirect RNG consumption, pixel-perfect browser output or behavior under corrupt files/out-of-range DOS dates.
- **Host adaptations:** explicit state objects, supplied clocks/keys, finite-scan errors instead of hangs, resource access/drawing. Long-word repeat behavior is deliberately preserved, not repaired.
- No app or other lane files were changed. This is a dependency artifact set for later integration, not a claim that the browser app now uses it.
