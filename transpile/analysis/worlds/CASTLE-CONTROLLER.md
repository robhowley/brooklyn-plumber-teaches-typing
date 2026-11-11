# Castle controller, Phase3

**Integration update:** imported into Session/main with indexed rendering, exact bonus packets and source wait/FIFO bridging. Both frozen-worker defects are fixed: pre-scroll oldX (FILE0xc186..0xc1bb) and clean stationary rockface suppression (0xc4e2..0xc540). Regression tests cover the emitted coordinate and foreground erasure. See [Phase3](../../reports/PHASE-3.md) for current checks and explicit HUD/ending omissions. The following worker record describes its original pre-integration handoff; its disabled-world statements are historical.

**The authored controller runs the repeated rockface → pipe1 → sand → pipe2 → rockface sequence, including both failure animations. It is not integrated into the app.** Normal and fast transitions, input operations, sentence metadata, bonus interception and result/progression requests are implemented. Presentation and host-service consumers remain integration requirements.

## Integration entrypoint

Exports from `recovered/worlds/castle.mjs`:

- `castleSentence(stream)`: bounded backtick reader using the existing runtime corpus API.
- `CastleQueue`: 2000-word buffer, append/shift/initialize/accept and fixed target index8.
- `CastleController`: `step({nowTicks, nowSeconds, input})`, `resumeBonus({nowTicks, nowSeconds, input})`, observable state and ordered effect arrays.

```js
// Once per process/session, retain this object across all world changes:
const castlePersistent = { rockSecond: 0, sandSecond: 0 };
// Existing lessonPrefix/loadCorpus/selectCorpusSegment calls precede construction.
const castle = new CastleController({
  stream, rng, persistent: castlePersistent,
  character, minutes, priorDuration: statistics.limitSeconds,
  previousAccuracy: statistics.profileAccuracy,
  option10, fastScroll,
  profile, profilePresent,
  resources: {
    bonusXs, // three signed words, MARIO.EXE FILE 0x213b4
    idleSchedule: idleSchedules[characterKey].thresholds,
    idlePeriod: idleSchedules[characterKey].halfTickPeriod,
  },
});
const effects = castle.step({ nowTicks, nowSeconds, input });
```

`input` is the existing pending-input transport with `pending()`, `consume()` and `flush()`. `consume()` returns a normalized DOS key, not a DOM event. The host supplies sampled BIOS-style ticks and signed wall seconds. One `step` reaches one call of original operation `0xbb06`, ending at its changed-tick wait. The next step resumes after that wait; it is **not** a claim of one browser frame, one second, or catch-up scheduling. Source operations1 and4 also wait. Do not enqueue a key for every rendering effect or skip operation3 waits.

The controller consumes the same shared RNG object, never reseeds, and owns the scene call order. It uses `routines.mjs`, `runtime.mjs`, `scoring.mjs`, `flow.mjs` and the proven `idleFrame`/`makeBonus` routines rather than replacing their arithmetic. `makeBonus` matches Castle's four shared initialization draws plus its fifth prior-duration draw, including the draw consumed before option10 forces15. Preserve corpus-selection draws **before** these five.

### State and lifetimes

| Exposed field | Original state / lifetime |
|---|---|
| `queue.words`, `queue.index=8` | DS:46dd allocation, DS:46db; new allocation per entry, reset per active scene |
| `queue.correct`, `queue.length`, `targetX` | DS:4689,468d,468b; correct count reset per active scene, length is append endpoint and never decremented by shifting |
| `sceneType` | DS:470f, 0 rockface text and1 sand text, not BGS scene index |
| `scene` | Current BGS index0..3, implementation field |
| `x`, `y`, `frame` | DS:5006,5004,4ff0 and previous-raster state; per entry, then retained through transitions |
| `stage`, `velocity`, `walkCounter` | Sequence locals bp-4,bp-10,bp-14, reset at rockface/sand active entry |
| `rockfaces[0..2]` | DS:469f records,18 bytes each; x/y/phase/resource/dirty, recreated at every rockface entry |
| `completion`, `locked` | DS:46e1 byte and46d9 word, distinct from terminal flags |
| `flags.failed/timeout/exit` | DS:46e2/46e3/46e4, separately cleared at `0xc5a3..0xc5ad`; exit also requests global abort DS:51b6 |
| `lastInput` | DS:46d5 wall seconds; set at active entry, any consumed input and bonus return |
| `stats` | Source counters/clock/results through existing timer/score APIs; attempts/errors/correct are signed words |
| `bonus` | Shared DS:5010 countdown,5012 mode,5014 key,5016 y,5018 x; initialized per activity, not per scene |
| `persistent.rockSecond/sandSecond` | DS:431e..4321 and4322..4325, initialized zero in EXE, written only in their respective mode1 bonus clocks, survive entry/cleanup |
| `phase`, `cycle`, `ended` | Authored observability, not extra original game rules |

The source initializer/cleanup and direct-reference inventory do not reset either Castle bonus observed-second value. They are **separate** from Outside DS:4888. This is a bounded static lifetime finding, not proof about arbitrary indirect/corrupt writes. `CastleController`'s default persistence object is a fresh-process convenience; the integrator must retain and pass one object. Statistics duration supplied to the bonus is the **previous** duration, before configured Castle duration is assigned at `0xd949..0xd96f`.

New controllers reset scene counters/flags and allocations. Supply `previousAccuracy` from shared profile accuracy: score structure accuracy resets to0, but source DS:50bb survives zero/nonpositive attempts (`0x15c8f`). Capture `stats.profileAccuracy` on exit. Controllers share only explicitly supplied RNG, stream, profile input and persistence. Terminal `step` is inert, so progression/results cannot be emitted twice. Returned progression is a new profile value, to apply once through the existing session persistence path.

## Byte evidence and source corrections

All addresses here are executable **FILE offsets**, not load/segment addresses.

| Original member | SHA256 |
|---|---|
| `Mario_Teaches_Typing_1992.zip` | `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd` |
| `MarioTea/MARIO/MARIO.EXE` | `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e` |
| `MarioTea/MARIO/CASTLE.BGS` | `b4674d24c215486663d5fe0fcf17f38672fc2c160e914c868d555a062a1450df` |
| `MarioTea/MARIO/CASTLE.GSO` | `dc62d4fcfbe8499ac6da2a6e78fcecbad0a0611f3774eae90351c9f8bd177a62` |
| `MarioTea/MARIO/WALKING.GSO` | `3d5864c62f7ff7cb0c774cb2cbbb00f411fa4c156ad6e257788e1eff60de7aa0` |

`tools/worlds/castle-inspect.py` reopens the hash-pinned ZIP as data and verifies **3803 listing instruction-byte records** against its EXE. It also reads padding, bonus X words and initial surviving clocks. Its JSON stdout is original-derived local data, not a publishable numeric resource table. It does not disassemble anew, invoke archive code or interpret instructions. Existing trusted static listings remain the branch evidence; byte matching proves provenance, not dynamic DOS equivalence.

Important details beyond the earlier mechanics summary:

- `0xddcc..0xddeb`: the500-byte bound includes the backtick.499 text bytes plus delimiter succeeds;500 text bytes plus delimiter fails. Missing delimiter fails by the same bound, rather than hanging the host.
- `0xba50..0xba69`: start-metadata OR occurs before text stores, so a nonempty append overwrites it. End bits remain at the last text word. Text stores sign-extend bytes; high-bit text is not silently cleaned.
- `0xba96`: copy exactly3998 bytes left, leaving word1999 unchanged. No extra clear or length decrement.
- `0xbac5`: exactly five target-space tests/shifts, not unrestricted trimming.
- `0xbfd6`: operation3 **does not refresh statistics**. It checks cached elapsed against duration at `0xbffb`. Transition wall time alone therefore does not force a new timeout.
- `0xbc7e`: operation2 checks failure using previous statistics and previous last-input time **before** consuming the current key. A key arriving after >20 seconds can reset the timestamp but cannot undo the failure set earlier in that call.
- `0xc1db`: normal scroll checks preexisting abort/timeout after moving the player, before its operation3. A flag set by the previous wait causes one more scroll movement, then the complete next-background copy. Fast scroll calls operation3 once after its direct-260 adjustment and full copy.
- `0xc29e..0xc2a6`: rock failure returns when half-counter reaches the idle period, instead of repeating the idle animation. It has no early abort/timeout check. Sand failure likewise continues until y95 despite flags set by operation3.

## Complete scene order

The implementation uses ordinary authored generator loops to preserve suspended calls. It does not execute original instructions or use an emulator-derived schedule.

| Phase | Direct source behavior and FILE sites |
|---|---|
| Entry | x0/y92, timer320; scene0 already expanded; initialize three rockfaces and queue; operation1, last-input reset, timer300 (`0xc5bc..0xc76a`) |
| Rockfaces | Completion advances destinations20/120/210/279; stage3 timer310 and typing lock; approach calculation; rockface update with **old** x, bonus, player commit, flag check, operation2; success/failure tests follow input (`0xc76a..0xc921`) |
| Rock success | operation4 clears text; active bonus becomes mode3; idle raster; scroll to BGS1 at y92 (`0xc921..0xc961`) |
| Pipe1 | clip right46; prechecked walk+4 to x>=48; full clip; five bumps; clip left272; assign x222, walk+4 at y36 to x>=279 (`0xc961..0xcbcf`) |
| Sand entry | sceneType1; full clip, scroll BGS2/y36; do-while walk+4 to x>=40; clip bottom91; sound2; eight steps x+3/y+=1..8; sound9; reset queue/stats start (`0xcbd2..0xcd77`) |
| Active sand | Existing `castleSand` with previous WPM and text target; counter/3 modulo5 sink art; bonus before player commit; flag check; operation2; completion stops time; failure takes precedence (`0xcd7a..0xce67`) |
| Sand exit | do-while x+2 to x>=210, five sink frames counter/2; velocity starts-9, increment before each x+4/y+=velocity; positive velocity and y>=36 clamps36; full clip; do-while walk+4 to x>=279 (`0xce6a..0xd03a`) |
| Pipe2 | active bonus becomes3; scroll BGS3/y36; right44 clip; prechecked walk+4 to48; five bumps; assign x229; left269 clip; walk+4/y92 to279; full clip; source's redundant prechecked walk normally performs zero iterations (`0xd03a..0xd36f`) |
| Repeat | Check exit/timeout, return to rockface setup through scroll BGS0/y92; no lives, finite map, health reset or invented collision (`0xd378..0xd38a`) |
| Failure | Rock: one character idle schedule, bonus then rockfaces using playerX+60, operation3 (`0xc27c..0xc36d`). Sand: modulo10 counter, y+1 on odd counts, five sink frames, bonus then operation3 until95 (`0xc36e..0xc40f`) |
| Terminal | Full clip, statistics130 stop, cleanup, failure/exit/result-gated progression/ending/save, audio reset, results (`0xd38d`, `0xd97d..0xdae0`, `0xddfb..0xde2d`) |

Both pipe sequences draw CASTLE indices4..8 or9..13 at the existing `pipeX`/`pipeY` tables, request sound7, perform exactly four operation3 waits, erase, then compare delay against **4+boundedRandom(6) on every comparison**. The final unsuccessful comparison also consumes a draw (`0xcade..0xcb06`, `0xd1f1..0xd219`). No single random duration is sampled up front.

## Renderer/effect contract

Effects are returned in source order and contain snapshots where subsequent state changes would otherwise lose old positions. Apply the list in order. Do not redraw the final controller state once and discard intermediate events.

- `player` carries old/current positions and raster family/index, clip and FILE site. `special:true` denotes the transition compositor, not ordinary sprite restoration.
- `rockface-init`, `rockface` use CASTLE indices0..3. Rockface updates precede player commits and can emit sound6.
- `scroll-begin`, forty `scroll-strip` events and `scroll-end` select BGS0..3. Strip events include source strip number and scratch pointer bias. Fast mode has no strip events and one operation3.
- `clip` effects use the exact inclusive rectangles from `analysis/render/BGS.md`. Operation calls save the scene clip, set full-screen temporarily and restore it. Bonus actor replaces only the clip top (69 rock,37 sand).
- `pipe-draw`/`pipe-erase` carry the CASTLE family/index and table coordinates. `pipe-delay-test` is observable evidence, not a rendering request.
- `bonus-actor` uses CASTLE14 plus FONT7H glyph `(code-32)` on its prepared raster. `bonus-erase` does not rearm the bonus. Rock activation consumes one extra RNG draw for FILE0x213b4; sand activation consumes none.
- Run frames use WALKING character blocks0/30/60 plus0..11. Sink frames use those blocks plus25..29. Idle failure uses IDLE blocks0/47/94 plus the existing schedule-selected index. No invented crushed-character frames.
- First operation tail emits the original player erase/ready/music4 requests (`0xc058..0xc06f`), once per entry.
- `statistics`, `operation`, `wait-changed-tick` and `flush-input` expose original service order; the controller has already performed translated timer/input mutations. Do not apply them twice.

### Bonus and ending handoff

Bonus interception precedes ordinary acceptance, even when typing is locked. Operation3 never intercepts bonus keys. On a matching operation2 key, stop timer310, set mode3 and return `bonus-playback`; attempts/correct/errors do not change. Further `step` calls throw until the host completes local BAN/ANI playback and calls `resumeBonus`.

`bonus-playback` selects MCAS/LCAS/PCAS, the original two-changed-tick callback waits and source scene0 preparation when in sand (`0xde6c..0xdf45`). The existing render manifest supplies ANI/BAN resources and sound-frame lists. `resumeBonus` marks all rockfaces dirty, requests resource/background/palette restoration (scene2 for sand), resets last-input wall time, resumes timer300, flushes pending input, then completes the suspended operation tail (`0xbdea..0xbe80`). Movie ticks are excluded. Renderer reload/restoration must finish **before** resume, not after the controller is allowed to move again.

Termination calls existing `progression` with Castle mode3 and last refreshed stats WPM (DS:51ee). Failure blocks progression. Explicit exit blocks it unless option10 overrides. Lesson<6 requests end mode1; lesson6 below45 requests2; first >=45 completion requests4, repeated completion requests1. Ordered `ending`, `save-profile`, `audio-reset`, `results` effects are requests for the consumer to serialize; this module does not claim an implementation of the ending presentation. Results must not become visible before the preceding ending effect is completed.

## Checks

Executed from this isolated worktree repository root through `structured_return`:

```sh
node --test transpile/tests/worlds/castle.test.mjs
node --test transpile/tests/{worlds,runtime,control}/*.test.mjs
```

- Initial Castle suite:19 passed; final expanded combined suite:71 passed, including22 Castle cases. `git diff --check` and explicit whitespace checks of all four new files passed.
- Tests reopen the actual archive and verify3803 instruction-byte records, sentence499/500 edges, queue metadata/last word, keys32/126/127,49/50 attempts,69/70 accuracy and20/21 seconds.
- Traces cover two full normal cycles (320 strips), all stages and pipe waits, independent BigInt RNG stream/draw count, old-X triggering, entrance acceleration, landing, all three characters through two fast cycles, both full failures, abort/timeout boundaries, bonus stop/restore/flush, retained clocks, fresh entry and ending modes.
- The5 shared initializer draws and repeated pipe comparisons are checked independently, not by comparing a function to itself. No browser or original-machine execution was used as an oracle.

## Remaining blockers and bounded gaps

**Do not enable Castle in the shared app from this worker output.** Water checkpoint and independent Castle review/integration are still required.

1. **Presentation consumer:** the special scratch-background transition compositor and all emitted old/current raster operations must be integrated and pixel-verified. The foundation's visible-strip helper alone is insufficient. This controller supplies ordering, not framebuffer implementation.
2. **Host scheduling:** changed-tick waits, raw pending input, focus/typematic and sampled clocks require an explicit host adapter. There is no invented millisecond animation schedule here.
3. **Bonus/ending playback:** the consumer must perform local BAN/ANI playback and resource restoration, then resume. Ending effects require the phase5 presentation implementation or an explicitly disabled presentation path; they must not silently be treated as completed.
4. **Original option service:** key0x12d with option10 emits the existing `0x149fc` request; no browser quit/pause behavior is fabricated. Demo scheduling is rejected at construction, pending phase5. Option20 diagnostic memory reporting and original allocation-failure debug waits are omitted, not normal gameplay mechanics.
5. **Data producer:** add FILE0x213b4's three signed bonus-X words to the single shared app-data builder during integration. This worker intentionally changes no shared schema or generated data files. The inspector exposes the exact local values for tests/review.
6. **Audio/fades:** sound IDs, ready/music and palette restoration requests are exposed; device audio and intermediate VGA fades remain unsupported presentation work.

The controller's complete ordinary scene loop and failure paths are implemented rather than blocked on a guessed schedule. Source offset/branch tests are not proof of full DOS equivalence. Host exceptions for bounded malformed corpus/queue input replace original fatal-error/memory-overrun behavior. No general collision, lives, retry screen or finite-level mechanics were added. Original-derived data/resources remain local and outside the repository MIT license.
