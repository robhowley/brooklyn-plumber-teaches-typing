# Activity reentry and pending input

Keep Outside's five animation counters and its observed-second clock across activity entries. Keep Water's previous returned character, Practice's last-correct timestamp, statistics duration and the shared RNG independently of the current world. Rebuild scene allocations and Practice rows, not these surviving values.

This phase supplies runtime contracts, not Water/Castle controllers or an app integration. All addresses below are executable **FILE offsets**; DS addresses identify original memory fields. `tools/runtime/inspect.py` reads the archive as data and verifies every disassembled instruction against its member bytes. Trusted `objdump` is the only disassembly subprocess. No original code was run or emulated.

## Source identities

| Original input | SHA256 |
|---|---|
| `Mario_Teaches_Typing_1992.zip` | `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd` |
| `MarioTea/MARIO/MARIO.EXE` | `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e` |
| `MarioTea/MARIO/FONT7H.FNT` | `2c2442ff73c44bfccb4fc879ce62e01b13e0b589485c588066569332c49b68c8` |
| `MarioTea/MARIO/FONT7H.GSK` | `d011ba960556d56b29644a4cda97496513f5a4306e1fa105b94e552c5854bd6d` |
| `MarioTea/MARIO/FONT7H.GSO` | `b2287d630e98c5fa4547eeac92355715be660ab5a06281d343eb0a95ce668918` |

Private `evidence.json` holds focused byte spans, initialized data, hashes and FONT7H metadata. `references.asm.txt` inventories direct references to the retained fields. A linear reference inventory alone cannot rule out indirect writes; lifetime conclusions also follow the traced entry, ordinary update and cleanup paths. No claim is made about corrupt pointers or arbitrary machine memory writes.

## State lifetimes

| Value | Initialization and writes | Entry behavior / API |
|---|---|---|
| Outside cursor phase, DS:487e | Zero at FILE `0x23aee`; INC and signed >=12 reset at `0x1340c..0x1341d` | Retain `cursorCounter` |
| Outside stationary counter, DS:4882 | Zero in initialized data; moving resets at `0x136de`; stationary INC then >4 clamp10 at `0x136ec..0x136f7` | Retain `stillTicks`, including stale10 |
| Outside distance, DS:4884 | Zero in initialized data; signed frame division at `0x1375e..0x1376b`, word ADD at `0x1378a` | Retain `distance`; do not repair negative frame indices after wrap |
| Outside idle counter, DS:4886 | Moving resets at `0x136e4`; INC at `0x136fd`, period reset at `0x1370f` | Retain `idleTicks`; selected character's schedule applies on the next update |
| Outside last observed wall second, DS:4888..488b | Initialized zero; compared/stored at `0x13894..0x138af` only in bonus mode1 | Retain `bonus.lastSecond`, even across Water/Castle bonuses |
| Ground phase, DS:51ac | Zero at FILE `0x2441c`; word ADD then signed remainder20 at `0x1437a..0x1438a`; disabled-ground branch resets at `0x143a1` | Retain `groundPhase`; ordinary Outside entry enables ground at `0x128fd` |
| Water previous result, DS:40aa | Initialized0; `0x9561` suppresses consecutive normalized spaces and stores returned code | Existing `loadCorpus(raw, previousWater)` carries it across unload/reload; Castle/Practice readers do not overwrite it |
| Practice last-correct, DS:41b3..41b6 | Initialized0; correct input stores wall seconds at `0xb7b5` | Existing `createPractice(stream,lastCorrect)` retains it; wrong/ignored keys do not reset it |
| Statistics duration, structure+1f | Operation10 clears it at startup; Outside reads it at `0x12c13..0x12c2e` before operation111/reset and configured duration assignment `0x12c76..0x12cbc` | Pass the **previous statistics duration**, including0, to `makeBonus`; do not replace it with new settings |
| RNG, DS:3c34..3c37 | Initialized1, startup `0x126ae` seeds once with low16 time | One shared stream through title, menu, corpus, bonuses and obstacles |

The Outside initializer `0x1272e..0x12cc2` and cleanup `0x12cc3..0x12dba` do not clear those animation counters. Player X/Y, mode, scrolling speed, obstacle allocations and attempt counters are per-entry. `createOutdoor({previous})` copies only the five retained counters from the previous Outside object. It does not retain ended flags, obstacles, particles, targets or score. Follow-X is overwritten in mode0 before use, so carrying it buys no recovered behavior. Jump state likewise has its own start/reset path.

Practice's nine fill calls overwrite all target rows and clear input/index (`0xb391..0xb4d3`), while its timestamp survives. Water's prior whitespace is not a property of the new resource file; callers must retain it even if intervening worlds never call `nextWater`.

### Signed boundaries

- Outside timeout compares the high words signed, then equal-high low words unsigned (`0x13aa0`, `0x13aa8`). `tick` now coerces elapsed/limit to signed32 before comparing, so unsigned host representation `0x80000000` is not mistaken for a positive timeout.
- Outside bonus compares both words of `time(NULL)` (`0x1389a..0x138a4`). `updateBonus` normalizes sampled seconds to signed32; `0xffffffff` and -1 denote the same stored time and must not decrement twice.
- Word counter overflow remains intact. Distance32767 plus8 becomes -32761; negative animation indices remain an unsupported renderer memory-read case, not modulo-positive wrapping.
- Ground uses the old scroll first, then motion computes the new scroll. Reentry restores scroll1, not the previous lesson's scroll9.

## Keyboard operations, not a single-slot latch

| FILE | Operation | Recovered behavior |
|---|---|---|
| `0x4ddb..0x4dec` | Pending | Runtime pushback flag DS:3cee wins; otherwise DOS INT21/AH0b status; does not consume |
| `0x4a41..0x4a59` | Raw read | Consume runtime pushback byte DS:3cef if present; otherwise DOS INT21/AH07; zero-extend returned byte |
| `0x19241..0x1927e` | Normalized consume | Raw read; for prefix0 or224 only, test pending again; if available consume next byte and add256; otherwise return prefix unchanged |
| `0x19221..0x19240` | Flush | While pending, consume raw bytes until empty |
| `0x192a2..0x192e1` | Tick wait | Wait until BIOS low tick word differs from retained DS:4e2c; no catchup iteration count |

`createPendingInput()` is an explicit **host test transport** with `enqueue(...rawBytes)`, `pending()`, `consume()` and `flush()`. It uses an unbounded FIFO to make multiple pending bytes observable, not to assert the DOS queue's capacity. Empty `consume()` throws instead of blocking. No runtime pushback producer or DOS hardware queue is emulated. The consumed sequence implements the source normalizer, including its incomplete-prefix branch. Enqueue rejects invalid bytes before changing the queue.

Water polls/consumes earlier in its loop, then tests pending again at `0x17943`. Nonempty jumps directly to `0x17a09`, skipping the random bubble test and subsequent ordinary update block. Do **not** substitute “a key was consumed this frame” for “another byte is still pending.” Castle tests pending at `0xbd15`, consumes at `0xbd21`; operation3 and its other branches remain the Castle controller's responsibility. Both bonus returns flush (`0x1788b`, `0xbe7b`), as does Outside (`0x13c5e`). An ignored key is still consumed; it must not remain latched forever.

The harness tests these source predicates and byte consumption. It is not proof of complete Water/Castle loop ordering. Host event delivery, typematic, focus, overflow/drop policy and arrivals during a blocking DOS read remain adaptations/unknowns. Later controllers must request pending status at the source call sites rather than accept a precomputed frame-wide boolean.

## Timer, options and random draws

Use existing `recovered/control/scoring.mjs::timer`; do not create another timer:

- Operation300 at `0x15afb` starts only when stopped and saves the current tick baseline.
- Operation310 at `0x15b20` adds the signed32 tick difference only when running, then stops. Repeated stop cannot count cinematic time.
- Operation320 at `0x15b66` clears active ticks/elapsed/running, not the previous duration policy by itself.
- Refresh at `0x15bee` updates baseline even while stopped. Arithmetic uses SUB/SBB and ADD/ADC, not monotonic browser-number arithmetic.
- Water bonus stop/resume calls are `0x1781a`/`0x1787f`; Castle `0xbdd3`/`0xbe6f`; Outside has the corresponding stop/restore/resume sequence documented in RUNTIME.md. A host pause can reuse these arithmetic operations but is not a recovered P-key command.

“Option10” is **not a sound-option bit**. `0x15034..0x15094` uses signed cached DS:2892, initialized -1 at FILE `0x21b02`. When negative it obtains environment `KWD` (name FILE `0x21bcf`), converts its text to an integer or sets0 when missing, then compares signed value >= requested threshold. Negative values cause lookup again on the next query. The host can pass the resolved boolean `option10 = signedKwdLevel >= 10`; no browser environment parser is invented here. Water uses that query before the exit handler at `0x178e8..0x178f6`; Castle at `0xbd78..0xbd86`. There is no evidence these branches are pause commands.

Title pending checks consume zero draws when pending, otherwise one delay draw per iteration (`0xff2a..0xff75`). Menu draws only when signed tick difference is strictly greater than stored delay (`0x10b31..0x10bad`). No reseed occurs on activity entry. The existing initializer consumes four bonus draws; Outside adds a fifth even when option10 forces15. Tests calculate expected draws independently using BigInt LCG arithmetic and the executable constants, not recorded JS output. Complete title/menu presentations remain phase5 work.

## Fonts and palette lifetime

**DS:4fc0 is FONT7H's glyph-pointer array, not an unknown font family.** Startup passes the `font7h` name and descriptor DS:4fb5 to `0x1b5ff` at `0x1263e..0x12647`. The loader writes descriptor+0xb/+0xd at `0x1b7f8..0x1b7fc`; 0x4fb5+0xb is0x4fc0. It parses the GSK name suffix, subtracts the descriptor's first code at `0x1b93a`, then stores each decoded raster pointer at that slot (`0x1b9b5..0x1b9cc`).

Archive metadata verifies first code32, count96, nominal10x10. GSK decoded indices0..95 are `font7_32` through `font7_127`, in order. Thus ordinary Outside glyph `(clampedCode-32)` and shared Water/Castle bonus punctuation use FONT7H, not whichever font visually fits. The loader allocates these at startup, not at each world constructor. Keep decoded font resources at session/resource-cache lifetime; no new runtime font state object is required. Text-service style/remapping state is separate from the glyph array and remains with rendering/UI work.

**Outside's scene descriptor is freed, not a permanent palette cache.** The initializer addresses DS:48d8 (`0x12743`) and tests its loaded byte+3 before loading. Exit `0x12d1f..0x12d30` invokes RIX operation30. The dispatch table at `0x1ca24` maps30 to `0x1c5b7`: free non-null palette/image pointers, then call operation10 (`0x1c623`), which clears12 bytes and restores the RIX signature (`0x1c588..0x1c5b4`). Ordinary complete exit therefore returns this descriptor to unloaded state.

On entry, character indices32..47 and turtle indices48..63 are spliced into the scene palette even if a loaded descriptor was supplied (`0x12acd..0x12b85`). The upload/transition branch then tests loaded state (`0x12b8a`). Do not introduce a persistent boolean that skips reassembling a palette on the next character/world. Current VGA palette and fade scratch state can survive until overwritten, but this work does not translate intermediate fades or prove all indirect palette-service effects. Use the render worker's final palette/resource contract, not a fabricated global reset. Ordinary scene cleanup is established; arbitrary interrupted initialization is not.

## Integrator calls

Existing exports remain compatible; callers omitting retention arguments still request fresh-process defaults. No shared app files changed.

```js
// Session-owned retained values, initialized once (not in Session.start):
let lastOutdoor = null, outdoorLastSecond = 0;
let previousWater = 0, practiceLastCorrect = 0;
// Keep existing shared rng and statistics objects, do not reseed here.

// Before replacing a Water stream:
previousWater = waterStream.previousWater;
// Any later load, including after other worlds:
const corpus = loadCorpus(rawBytes, previousWater);
// Preserve existing lessonPrefix -> load -> selectCorpusSegment order.

// Outside entry, BEFORE resetting statistics or assigning new duration:
const bonus = makeBonus(rng.seed, statistics.limitSeconds, option10, outdoorLastSecond);
rng.seed = bonus.seed;
const game = createOutdoor({ bytes: rawBytes, seed: rng.seed,
  character, lessonIndex: corpus.index, previous: lastOutdoor });
lastOutdoor = game; // keep this object even while Water/Castle/Practice runs
// After updates/exit, preserve RNG as existing Session does and:
outdoorLastSecond = bonus.lastSecond;

// Practice entry and after every correct-input update/exit:
const practice = createPractice(corpus, practiceLastCorrect);
practiceLastCorrect = practice.lastCorrect;
```

Capture the latest `previousWater`, `practiceLastCorrect` and `outdoorLastSecond` before discarding their producing object, including abort/timeout paths. Do not overwrite `outdoorLastSecond` from another world's bonus object. If using normalized host keys rather than raw DOS bytes, keep that transport explicitly separate from `createPendingInput`; passing0x144 to `enqueue` is an error, use `[0,0x44]`.

No app-data schema change is needed for these counters. Font binding needs FONT7H resource records already in the original-resource manifest; the integrator/render worker can bind indices0..95 by the verified mapping above.

## Checks and limits

Executed from the worktree repository root:

- `python3 -B transpile/tools/runtime/inspect.py`: 37 verified spans, 15 corpora and 74 direct references; includes keyboard, timer, font loader, RIX cleanup and retained-counter references.
- `TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{runtime,outdoor}/*.test.mjs`: 39 passed after initial implementation.
- `TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs`: 87 passed on the final rerun, including font/palette, timer and KWD evidence tests.

`git diff --check` passed. Node runs use `structured_return`, parser `node-test-text`. Tests cover same-world entry, Outside/Practice/Water cross-world retention, stale/zero values, signed wrap, old-scroll update order, repeated stop/resume, raw extended prefixes, pending bursts/flush, ignored keys and source-derived draw counts. Existing result/scoring and app tests remain regression coverage; the shared app has not yet adopted the new Outside retention arguments. No browser cadence, DOS queue capacity, full Water/Castle orchestration, fade timing or original-machine differential behavior is claimed.
