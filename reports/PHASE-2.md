# Phase2: playable Water

**Water is integrated locally through input, indexed drawing, bonus, failure, results and Next.** Phase1 was pushed as `5d26db4`, the frozen parent for this work. No commit or push was made here. Castle remains disabled; no Phase3 files were imported. Independent post-integration review remains pending.

## Changes and source evidence

- Imported only the eight authored files enumerated in `reports/continuation/worlds/{01,02}-worker-hard.md`, from `.worktrees/p2-water` and `.worktrees/p2-water-render`. No generated resources or other worker changes were copied.
- `Session` mode2 uses the shared lesson-prefix/corpus selection and RNG, duration field2 at student byte32, retained previous duration/whitespace and Water counters. `editStudent` and the native editor expose Water minutes for new and existing students.
- `Session.stepWaterHost` drains explicit pending/consume input in controller order. Pending bytes suppress actors/RNG at FILE `0x17943..0x1794c`; it does not turn DOM events into generic game ticks. Six deferred shifts force text redraw; an empty queue does not invent a dirty-flag flush.
- Wait acknowledgments compare the low16 sampled tick with the process-retained previous wait word (`0x192a2..0x192e1`). Delayed callbacks never catch up missed movement. Outside wait observations share this word. Water final timer stop occurs after its final wait, and results use cached source statistics rather than recomputing from stopped time.
- Any consumed input resets wall inactivity; strict >20 is checked before input (`0x176e6..0x17733`). The chase and sink finish through results/Next. Failure, timeout and abort remain distinct; failure/abort gate advancement. A bonus during failure still resumes the timer, and the empty failure-exit routine does not stop it.
- Water movies use all three56-packet MSWM/LSWM/PSWM BAN/ANI sequences. Each packet draws immediately, then waits for two distinct changed-tick acknowledgments (`0x17ebb ->0x14725`). Pending input is retained during playback and flushed on return, not scored. Lesson time is stopped; restored scene/text/palette precede the source tail.
- The optional Phase5 celebration is explicitly omitted by immediate acknowledgment. This does not suppress ordinary advancement, cleanup, results or Next. No invented animation duration or RNG calls were added. Strict goal >30 completion is tested, separately from goal exactly30.
- `Renderer.water` consumes source draw-time effects, not final controller state: swimmer failure phase precedes pursuer transition; pursuer uses selected resource/drawnX; bubble events include pre-movement allocations; bonus mode3 erases before reset. Real indexed compositor calls preserve dirty restoration order.
- The previously unconsumed `background-update` is translated from `0x9cab..0x9d3f`: retained counter initialized-1 at FILE0x1f572, then0..49, twenty16×14 tiles at y65,25 source records at FILE `0x1f6c6`, stride228, zero restores scene. The supplemental exporter supplies only local raster data. Producer and real Renderer tests compare pixels to executable bytes.
- Corrected Phase1 palette producer and consumer expectations: Water applies BITER.GPO slots48..63 after character slots32..47 (`0x16ace..0x16b74`). Existing `analysis/render/BGS.md` now records the correction. Prompt uses FONT9H at(0,47); bonus punctuation uses FONT7H.

Full offsets and member hashes: `analysis/worlds/WATER-CONTROLLER.md`, `analysis/render/WATER.md`, `analysis/render/BGS.md`. Archive SHA256 remains `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`; MARIO.EXE remains `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e`. Original code was read as data only, never executed/emulated.

## Bridge review and checks

The Session/main bridge was inspected separately from controller tests: DOM events enter a FIFO, one host callback drains source loops until an actual wait/bonus boundary, bonus packets share the same changed-tick word, and renderer effects retain the phase at each draw call. Main does not compute a frame-wide pending boolean or advance Water through Outside's generic tick path.

Seven new Session/Renderer integration tests cover queue draining and six-key redraw, same-low-tick/no-catchup behavior, wrong-case/error-key persistence, ignored-key inactivity reset and >20 failure, all-character/cross-world reentry, bonus time exclusion/flush, pending abort, bonus during failure, cached timeout/final wait, strict completion threshold and unavailable Castle routing. The Renderer test substitutes only the browser canvas transport and local fetch; it runs the real font, palette, movie and dirty-pixel code, comparing wave pixels with fresh executable data and movie restoration with the original scene.

Five new Chrome cases run real main-loop input/canvas paths: all three characters, correct/wrong case, queued bursts, naturally reached bonus, frozen bonus stats and input flush, F10/Escape, results/Next, retained counters, native duration editor/storage/reload, focus suspension, inactivity chase/sink, normal timeout/advancement and disabled Castle. No asset or page errors were observed in the all-character checks. Screenshots are local under `reports/browser/water-{1,2,3}.png`, `water-bonus-{1,2,3}.png` and `water-failure.png`. The Mario normal-play capture was visually inspected; screenshots are not an original-runtime comparison.

All test/build commands below ran through `structured_return` from the repository root. Parsers: `node-test-text`, `unittest-text`, `junit-xml`; builders use plain completion output.

```sh
python3 -B transpile/tools/render/decode.py
python3 -B transpile/tools/render/water-bindings.py
python3 -B transpile/tools/build-app-data.py
python3 -B transpile/tools/worlds/water-inspect.py
TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs
TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/assets -p 'test_*.py'
TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/render -p 'test_*.py'
TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/app -p 'test_*.py'
TMPDIR="$PWD/transpile/.tmp" TRANSLATION_PORT=4187 \
  PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/browser/phase2-results.xml \
  node_modules/.bin/playwright test -c transpile/playwright.config.mjs --reporter=junit
TMPDIR="$PWD/transpile/.tmp" TRANSLATION_PORT=4187 \
  PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/browser/water-repeat.xml \
  node_modules/.bin/playwright test -c transpile/playwright.config.mjs water.spec.mjs --repeat-each=2 --reporter=junit
git diff --check
```

| Check | Final result |
|---|---|
| Full Node |137 passed |
| Python assets/render/app |19 +5 +6 =30 passed |
| Full Chrome |14 passed |
| Bounded Water repeat |10 passed (five cases, twice) |
| Static Water inspector |2,251 Water +44,994 supporting instructions verified against ZIP bytes |
| App-data rebuild |Byte-identical (Python test) |
| Whitespace/scope/ignore audit |Clean diff check; changes only under `transpile/`; generated data/evidence/screenshots ignored |

Earlier tests caught stale disabled-Water assertions and an overly short natural-bonus search. Browser bonus capture was moved before the search so taking a screenshot cannot let the short-lived bubble expire before typing. Final full and repeated runs pass. Port4187 was used exclusively; the user's4179 listener was not stopped or replaced. The full fresh-input pipeline from Phase1 was not rerun in a second empty checkout; the updated ordered recipe includes the supplemental exporter, and the app rebuild was checked in place.

## Exact authored export scope

New imported files (some extended during integration):

- `transpile/recovered/worlds/water.mjs`: `createWater`, `stepWater`; bubble event adds pre-movement snapshot.
- `transpile/tests/worlds/water.test.mjs`:26 controller cases.
- `transpile/analysis/worlds/WATER-CONTROLLER.md`: controller/lifetime/source contract and integration status.
- `transpile/tools/worlds/water-inspect.py`: static byte verification.
- `transpile/app/water-render.mjs`: Water actor/text/palette/movie helpers.
- `transpile/tests/worlds/water-render.test.mjs`:11 independent pixel/resource cases.
- `transpile/tools/render/water-bindings.py`: palette, exact BAN writes and wave exports.
- `transpile/analysis/render/WATER.md`: presentation and wave evidence.

Integration files:

- `transpile/app/session.mjs`, `transpile/app/main.mjs`, `transpile/app/render.mjs`: host bridge, route/editor/input, ordered indexed rendering.
- `transpile/index.html`: Water controls and explicit omissions.
- `transpile/tools/build-app-data.py`, `transpile/tools/render/decode.py`: enabled Water resources and BITER correction.
- `transpile/tests/app/{water-integration.test.mjs,water.spec.mjs,session.test.mjs,browser.spec.mjs,test_build.py}`: new integration proof and changed enablement expectations.
- `transpile/tests/render/{render.test.mjs,test_decode.py}`: corrected palette producer/consumer checks.
- `transpile/playwright.config.mjs`: optional `TRANSLATION_PORT`, default unchanged4179.
- `transpile/{.gitignore,README.md,COVERAGE.md,ASSUMPTIONS.md,PLAN.md}`, `transpile/analysis/render/BGS.md`, `transpile/reports/PHASE-2.md`: ignore/bootstrap/status/evidence.

The authored export has29 candidate files, all under `transpile/`. Only authored files are candidates for later export. `app/data.json`, all `assets/`, raw listings/byte evidence and browser/worker artifacts remain local and ignored. No original-derived resource data is included in the authored export.

## Remaining limits

- Host18.2Hz sampling, event delivery, unlimited FIFO capacity, typematic and focus are adaptations, not DOS hardware fidelity. Focus freezes active time/updates but not wall inactivity; a long Water pause can fail on resume. Outside retains its existing two-tick movie approximation and one-slot input latch.
- Numeric Water HUD, intermediate fades, sound and Phase5 celebration remain disabled. Phase5 will add presentation/RNG calls; today's seed describes only the enabled entry path. Early movie cancellation is not implemented.
- Castle is disabled. Unsupported extended options/process quit and original UI/filesystem/device behavior remain explicit gaps.
- Tests prove static-byte-derived contracts and authored integration, not differential equivalence to an executed original. Independent reviewer approval is still required before claiming the phase checkpoint gate complete.
