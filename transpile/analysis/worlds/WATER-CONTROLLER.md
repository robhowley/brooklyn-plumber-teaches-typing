# Water controller and integration contract

`recovered/worlds/water.mjs` translates Water's polling controller and suspends at explicit tick, bonus and progression-presentation boundaries. Phase2 now enables it through Session and the indexed renderer. The integration handles ordered effects, source background tiles, bonus restoration and changed-tick acknowledgments; optional Phase5 celebration is explicitly skipped without suppressing progression. See `reports/PHASE-2.md`.

## API and ownership

Exports: `createWater(options)` and `stepWater(state, acknowledgments)`. Both use existing `routines.mjs`, `runtime.mjs`, `scoring.mjs` and `flow.mjs`; there is no second RNG, timer, corpus normalizer or progression implementation.

```js
// Session owns rng, profile, input transport, clocks and retained Water object.
// Keep the existing lessonPrefix -> loadCorpus -> selectCorpusSegment order.
const stream = loadCorpus(rawCorpus, previousWater);
selectCorpusSegment(stream, rng);
const water = createWater({
  stream, rng, input, clock: { ticks: sampleBiosTicks, seconds: sampleWallSeconds },
  character: 0,                  // Mario0, Luigi1, Peach2
  shortWindow: false,            // raw DS:4fe4 !=0 selects20, otherwise40
  minutes: configuredWaterMinutes,
  previousLimitSeconds: statistics.limitSeconds, // BEFORE statistics reset
  previous: lastWater,           // retain even through intervening worlds
  profile, profilePresent: profile.profilePresent, option10, option20,
});
lastWater = water;
consumeOrderedEffects(water.effects); // includes initial text/ready/music

// One polling loop. Do not supply a precomputed frame-wide pending boolean.
consumeOrderedEffects(stepWater(water));
// On wait-tick: honor the process-retained changed-low-BIOS-tick wait, THEN:
consumeOrderedEffects(stepWater(water, { tickReady: true }));
// During bonus: no input consumption, RNG or clock accumulation in this module.
// Only after actual Water BAN/ANI playback/restoration boundary is reached:
consumeOrderedEffects(stepWater(water, { bonusComplete: true }));
// Progression presentation is a distinct phase5 consumer, not a guessed delay:
consumeOrderedEffects(stepWater(water, { celebrationComplete: true }));

previousWater = water.stream.previousWater; // on every exit, including abort
// On results, use water.progression.state. Do not call progression again.
// Use the emitted cached stats. Do not recompute score from stopped ticks.
```

- `input` implements `pending()`, `consume()` and `flush()`, matching `createPendingInput()`. That helper takes raw bytes, including `[0,scan]` extended keys, not DOM events. A normalized host adapter must provide the same separate operations.
- `clock.ticks()` returns sampled signed32 BIOS ticks, not milliseconds or elapsed seconds. `clock.seconds()` returns sampled signed32 wall seconds. Sampling occurs only at translated call sites.
- `tickReady` means the shared FILE `0x192a2` wait has completed against its retained low-tick word. It is not permission to catch up every missed browser frame. The host retains that wait state across worlds and bonus packet waits. A false/missing acknowledgment while `phase==='wait'` makes no progress.
- After a wait acknowledgment, a nonterminal controller begins the next loop in that call. A terminal controller finalizes instead. Polling with additional pending bytes skips the wait and may therefore require several immediate steps before any tick wait.
- `draw(bound)` optionally replaces per-loop `boundedRandom(rng,bound)` for instrumentation/tests. Entry always uses the shared initializer and delay functions directly, advancing `rng.seed` five times. An integrator should normally omit `draw`.
- The controller copies `profile` and `completed`. Ordinary statistics refresh writes `water.profile.lastWpm/accuracy`; progression returns its next copy. No mutation of the caller's original profile is hidden.
- `phase` is `active`, `wait`, `bonus`, `celebration`, `ended` or `quit`. `ended`, `aborted`, `exitGate`, `timedOut`, `failed` and `sunk` remain distinct. `quit` represents original process exit, not a lesson abort or a browser tab close.

## Ordered renderer and presentation effects

Effects are new ordered records on each call; text and bubble arrays are copied. Use each actor effect's resource selection rather than recalculating it from the final state after the whole loop. In particular the pursuer may change failure phase **after** the swimmer was drawn.

| Effect | Consumer meaning |
|---|---|
| `scene {character}` | Fresh WATER scene/palette/resources, not a retained loaded-scene shortcut |
| `text {bytes,targetIndex}` | Sanitized temporary display copy,20 or40 bytes; prefix/target/suffix rendering follows `0x16e8a..0x16f3d` |
| `prompt-stop`, `prompt {code,argument:5}` | Source speech-service requests; silence is an explicit unsupported-audio policy, not invented speech |
| `background-update` | Call-site `0x17736 -> 0x9cab`, occurs before input every loop, including motion-suppressed loops; not a generic scene redraw |
| `stats` | Operation200's refreshed counters/elapsed/accuracy/WPM, before any actor movement; `startedAt/stoppedAt/refreshedAt` are source wall-time fields, not the elapsed timer |
| `swimmer` | `x/y` current position, `frame`0..5, signed `counter`, horizontal `delay`, `peak/target`, `resourceIndex`; WATER0..17 swimming or34..36 sunk |
| `pursuer` | `x` unadjusted, `drawnX` includes bite's -2 adjustment, `y` includes octo table offset, `frame` update counter, `mode` next mode, `resourceIndex` current WATER18..32 |
| `bubbles {bubbles}` | Ten slots in allocation/update order; active, x/y, dx/dy, `large` selects WATER_INLINE0/1; renderer keeps old rectangles per slot |
| `bonus` | Current actor x/y/mode/code with WATER33; expiry still emits the offscreen y200 update before mode remains0 |
| `bonus-erase` | Mode3's old image is erased, then mode becomes0 |
| `sound {id}` | Source IDs1 correct,11 wrong,5 swimmer bubble; no inferred sound playback |
| `key-error {code}` | Shared student operation0xafa for the **expected** byte, not the typed byte; integration owns per-key error persistence |
| `ready`, `music {operation:3}`, `audio-reset` | Original source requests, not host soundtrack timing |
| `wait-tick` | Suspend before end testing/final timer stop; acknowledge only after the shared changed-tick wait |
| `play-bonus {character}` | Suspend at `0x1782e`; Water MSWM/LSWM/PSWM BAN/ANI, two changed-tick waits per packet per BGS.md |
| `restore-scene`, `prompt-stop`, `text`, `restore-palette` | Bonus return order before inactivity reset, timer resume and input flush |
| `failure-start`, `failure-exit` | Failure is scripted; `0x17eab` is empty, so no failure movie is invented |
| `normal-exit` | Nonfailed operation130 stop and final scene fade request; no guessed intermediate palette ramp |
| `celebration {progression}` | Suspend at `0x17e8b ->0x17aa3`; do not silently simulate the phase5 presentation |
| `save-profile`, `cleanup`, `audio-reset`, `results` | Celebration return/save, free scene, audio reset, shared results in original order; results include cached stats/progression/demo/suppression |
| `quit`, `debug-key` | Option10 process exit and option20 diagnostic console branch; explicit host policy required |

The `background-update` raster operation is deliberately delegated to presentation, not approximated with moving actors. Its state/table interpretation and the original progression presentation are not implemented in this controller. An unhandled required effect is a blocker to enabling the corresponding Water path.

## Recovered control flow

All addresses are **MARIO.EXE FILE offsets**, not load-relative offsets.

| Source | Implemented behavior |
|---|---|
| `0x167f3..0x16d40` | Character binding, reset allocations/player/peak,20/40 width and5/10 target, shared four-draw bonus initializer plus fifth delay draw based on previous duration; stats reset/start then duration assignment |
| `0x16a04..0x16a32`, `0x176a6..0x176e1` | Clear40 bytes; draw initial empty window; shift until byte after target is nonzero, then shift once more; ready/music and last-input sampling |
| `0x16e0c..0x16f4b` | Reset redraw counter, sanitize only temporary display bytes outside32..127; raw target comparison is signed-byte exact |
| `0x174a1..0x1755f` | Shift one byte via `nextWater`; pending shift increments signed counter, redraw when >5; absent pending redraw unless filling; update prompt |
| `0x176e6..0x17733` | Signed32 wall subtraction strictly >20 starts failure **before polling input**; stop active timer, save swimmer y, set phase1 |
| `0x1774c..0x177d8` | Demo starts delay30; at zero synthesizes current target and draws `1+random(5)`; otherwise decrement; synthetic nonzero key bypasses physical consumption |
| `0x177d8..0x1790e` | Every consumed/synthetic event resets inactivity, even wrong/ignored keys; Escape/0x144 set abort and exit gate; option10 gates0x12d process exit; bonus precedes ordinary32..127 exact-case scoring |
| `0x17814..0x17890` | Bonus pause, mode3, playback, scene/prompt/text/palette restore, sample last input, unconditional resume, flush pending input, continue at timeout test |
| `0x17923..0x1794c` | Compare **cached** signed32 elapsed to limit, then poll pending again; additional pending bytes suppress all random bubbles/statistics/actors/wait, even when one key was already consumed |
| `0x1794f..0x17a04` | Environmental random bubble; stats200/refresh; swimmer and its random bubble; pursuer; pool; bonus; one changed-tick wait |
| `0x17a09..0x17a9b` | After wait, sink completion ends; failure calls empty routine, nonfailure stops timer. Abort/timeout still receive their final ordinary update when input is empty |
| `0x17e24..0x17ea2` | Existing progression gates, optional celebration/save, cleanup/audio reset/results. Failure prevents advancement, abort prevents it unless option10 overrides |

### Details that should not be simplified

- FILE `0x174db/0x17507` set DS:4c9f to1. The redraw routine does **not** clear it. FILE `0x17910` redraws only if it is0. A conventional dirty-bit flush on the next empty-input frame changes recovered behavior; tests preserve the literal branch.
- Bubble draws are `random(10)` then a second `random(10)` only if the first is0; swimmer always draws `random(15)`. A successful swimmer bubble attempt requests sound5 even with a full pool. Allocation consumes no additional random values and takes the first inactive slot.
- Both bubble allocations precede that iteration's pool update, so new bubbles immediately move up1 and get dy=-1. Pool bounds are inclusive x0..317/y79..197. At new dy<-10 the larger raster is selected.
- Bonus mode1 activates at swimmer x>=240 with `20+random(100)`, y200, and falls through to movement: draw `random(2)`; only if nonzero draw another `random(2)` (nonzero moves left, zero right). Clamp10..130, subtract3 from y. Below80 set mode0/y200. No rearm is invented.
- Failure phase1 chases from previous **drawn** pursuer x+3 until x>=playerX-35. The swimmer sees phase2 on the following update, sinks toward200, and marks completion when its **old** y>=199. There is no rectangle collision, contact gate, health, lives or retry loop.
- Correct and wrong input remain accepted during failure. A bonus can also intercept during failure. Bonus return resumes the timer without clearing failure; the empty failure-exit routine does not stop that resumed timer. This unusual path is preserved and tested, not repaired.
- Timeout uses last refreshed elapsed. Crossing the limit during stats200 ends on the next polling loop. The final wait occurs before nonfailure timer stop. `tickReady` suspension ensures those last ticks are not omitted.
- Operation130 stops time without calling score refresh; progression/results consume the cached WPM, not a host recomputation from the newly stopped total.
- Operation111 also sets previousGoal to current goal. Refresh writes profile WPM unconditionally (`0x15d71`) and profile accuracy only when attempts>0 (`0x15cd7`); failure blocks progression, not those statistics writes.
- Character output indices are zero-based decoded resource indices. No source resource numbers are derived from image appearance.

## Reentry findings beyond the Phase1 contract

Fresh ZIP bytes and the direct-reference inventory show these Water-specific words initialized0 but not cleared by ordinary Water entry/cleanup:

| Retained field | DS | FILE initial data | Writes |
|---|---:|---:|---|
| Swimmer animation counter | `4c1a` | `23e8a` | INC at `0x17389`; signed wrap retained |
| Failure phase | `4c1d` | `23e8d` | Set1 at `0x1772a`, set2 at `0x17196` |
| Pursuer frame counter | `4c33` | `23ea3` | Store at `0x172cf` |
| Pursuer y | `4c35` | `23ea5` | Store at `0x172cc` |
| Pursuer unadjusted x | `4c37` | `23ea7` | Store at `0x172c5` |
| Pursuer drawn x | `4c39` | `23ea9` | Store at `0x172c2` |

Pass `previous:lastWater`, even after Castle/Outside/Practice, to retain these fields. Entry resets pursuer mode1, not its frame counter. Swimmer frame resets0 while its even/odd counter survives. Retained phase2 does not select sunk art unless failure is also set (`0x173fd..0x17409`). Old sprite allocations are freed; retained coordinates are not permission to restore old freed pixels on a fresh scene.

`stream.previousWater` remains the separate process-lifetime whitespace state proven in REENTRY.md. Do not reset it just because scene resources were freed. The shared RNG and previous statistics duration likewise survive independently of this controller.

These lifetime conclusions cover traced ordinary entry/update/cleanup and direct references; they do not claim proof against arbitrary indirect writes or corrupted pointers.

## Source identities and verification

| Original member/input | SHA256 |
|---|---|
| `Mario_Teaches_Typing_1992.zip` | `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd` |
| `MarioTea/MARIO/MARIO.EXE` | `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e` |
| `MarioTea/MARIO/WATER.GSO` | `1d61258b81c917bfd48a7bd7d22905ae8181e114d1154389853b63bd06836aae` |
| `MarioTea/MARIO/WATER.GSK` | `5bdd499152114e541dcbc1f3636c334f9eb5c6f513245b4e20ab65becfe96edb` |
| `MarioTea/MARIO/WATER.CRX` | `49cf8c922e2b195395b31bdc7866acd68119c3b58aa0e5282c827627c8d2e0c7` |

The new inspector reads ZIP members only as data. It verifies all2,251 Water-listing instructions and44,994 supporting-listing instructions against the freshly hashed executable, reads the six initialized words and bubble-source coordinates at FILE `0x21cdc`, and hashes WATER.GSO/GSK/CRX directly from the archive. Output stays in ignored `.tmp/water-evidence.json`. Existing listings were inspected as data; no original program, emulator, interpreter or driver ran.

Commands from this worktree root:

```sh
python3 -B transpile/tools/worlds/water-inspect.py
node --test transpile/tests/worlds/water.test.mjs
node --test transpile/tests/{worlds,runtime,control}/*.test.mjs
node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs
```

Node commands use `structured_return`, parser `node-test-text`. Final targeted run: **26 Water tests passed**. Final full Node regression run: **119 passed**. The earlier worlds/runtime/control run passed74 before the final clock-order test was added. Expected traces use literal source branch boundaries/coordinates and independent BigInt LCG calculations, not output snapshots. `git diff --check` passes.

## Original worker handoff limits (integration status above supersedes blockers)

- **Required consumer integration remains:** Session mode2, clock wait acknowledgment, per-key error/profile persistence, Water indexed renderer, background effect, bonus packet playback/restore and results routing. No shared app files were changed.
- **Progression presentation remains phase5:** this controller stops at `celebration` until the original presentation is implemented or an explicit host adaptation is approved. It never guesses playback length or silently skips it.
- **No browser cadence proof:** `tickReady` is a host boundary, not DOS hardware emulation. Browser event delivery, typematic/focus, queue capacity/drop behavior and actual BIOS frequency transport remain adaptations.
- **Unsupported presentation/device details:** intermediate fades, audio and option20 diagnostic-console rendering are emitted source requests, not implemented effects. Option10 process quit requires a host policy rather than pretending to terminate a browser process.
- **Bad original-data states fail visibly:** all-NUL prefill and unusable corpus throw instead of hanging; negative resource indices from extreme counter overflow remain an unsupported renderer memory-read case, not repaired modulo wrapping.
- No full original-machine differential test, Water browser test or rendered-screen fidelity claim is made. These tests establish the translated controller's source-derived state/order boundaries only.
