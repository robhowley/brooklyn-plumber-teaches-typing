# Final integration

**Working, verified two-activity slice: Outside and Practice.** Final checks: **80 Node tests, 25 Python tests, 8 Google Chrome tests passed**. No original code was executed/emulated, no recovered module changed, no worktree edited, no commit/push/delegation/wiki write occurred.

## Changed

| Paths | Integration |
|---|---|
| `app/session.mjs` | Shared low16 entry seed, exact prefix/segment/bonus draw order, previous-duration bonus initialization, recovered Outside tick, timer-stopped bonus playback, exact Practice cursor/rows/input, expression, duration, results/Next, student error reset/counting |
| `app/render.mjs` | Indexed recovered origins/masks/clipping, exact final Outside palettes and ground tile, real idle frames, Practice face/text, decoded Outside BAN/ANI playback |
| `app/main.mjs`, `index.html` | Practice original menu hit/hotkey, original results controls, two-activity focus suspension, separate duration fields, visible asset/storage failures, copied verification snapshots |
| `tools/build-app-data.py`, `app/data.json`, `assets/app/{MOUT,LOUT,POUT}.backgrounds.indices` | All15 original corpora,145 idle frames, Practice assets, assembled palettes/tile,55 ordered bonus frames per character; deterministic data-only build |
| `tests/app/{session.test,integration.test,integration.spec}.mjs`, `tests/app/test_build.py` | Integration, pixel-index/source binding, input/state/timing, reproducibility and Chrome checks |
| `.gitignore`, `README.md`, `COVERAGE.md`, `ASSUMPTIONS.md` | Local bundle/scratch exclusions, current run instructions, exhaustive bounded activity/UI gaps and adaptation ledger |

No changes to `recovered/`, `.worktrees/`, root app/configuration or previous gameplay. Existing `tests/app/browser.spec.mjs` and Playwright config were reused unchanged.

## Source-backed behavior now connected

All executable addresses are **FILE offsets** in `MarioTea/MARIO/MARIO.EXE`, SHA256 `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e`; archive SHA256 `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`.

- Startup low16 seed follows `runtime.seedFromTime`, FILE0x126a0..0x126b3/0x37f6. Host epoch seconds are explicitly substituted for original DOS calendar/TZ resolution. Optional query seed is an entry seed, not a DOS replay.
- Activity draw order: lesson6 prefix, delimiter selection, four bonus initializer draws, fifth prior-duration override, then ordinary allocations. Practice consumes only prefix/segment draws. Previous duration starts0, so the original early first-bonus behavior remains possible. Shared seed survives supported activity changes.
- Outside still calls the tested `tick` once: old-scroll ground, bonus, player, obstacles, particles, target, elapsed/key dispatch, ending. Host time is sampled once for this atomic step; no per-DOM-event extra updates or contact gate.
- Bonus key interception stops timer310 without incrementing ordinary attempts; MOUT/LOUT/POUT play against OUTSKY, two observed host ticks per packet; scene restoration resumes300 and input is discarded. Source0x13bb2..0x13c64,0x14298..0x14360, callback0x1425a and compositor0x82e9..0x835b.
- Practice uses `practiceCorpus`, exact `loadCorpus/selectCorpusSegment/createPractice/practiceInput`, and `practiceExpression`, not a second wrap implementation. Real source bytes/case, SPACE/CR line ends, signed counters, nine target rows, overlong-word repeat and retained last-correct timestamp are preserved.
- Practice uses original PRACTICE.CRX/GSO indices0/1/2 at142,21, rows30,96+10*r, and FONT5H. Default600 seconds or student duration, Esc early results, F10 ignored, no invented inactivity/accuracy failure, no group advancement, Next remains Practice.
- Student operation0xaf9 clears96 error counters and only the first problem-text byte at entry (calls0x128d8/0xb1ca, body0xe3f1..0xe419). Practice wrong-input0xb7be..0xb7d2 calls the same recovered expected-key counter as Outside.
- Outside palette slots32..47 and48..63, additive origins, transparent raw index0, exact ground tile and all idle frames replace provisional choices. Local manifests retain original members/hashes/resource indices.

### Additional font evidence checked during integration

The existing verified static listing and original inert EXE bytes establish:

- FILE0x12631 selects DS:4fc4 for FONT5H;0x12643 selects DS:4fb5 for FONT7H.
- FILE0x14185 loads glyph pointer DS:4fc0. FONT7H base4fb5 plus field+b equals4fc0; text routine0x1a7ba loads that same field+b.
- Practice0xb2f0 writes glyph mapping[0]=15,[1]=0;0xb2fe changes foreground to1 for input. FILE0x1a86e..0x1a87e performs palette lookup, so recolored zero must be written, not treated as transparent raw sprite zero.
- Python integration tests compare these instruction bytes and OUTSKY/MOUT filename bytes against the hash-verified EXE, and verify FONT5H glyphs contain only0/1 with width8.

No recovered API needed a mutation for these findings. Full text-engine control codes, activity font-state restoration and blinking-input callback remain outside this slice.

## Verification

All commands ran through `structured_return`. Browser/Python temporary files use `transpile/.tmp` or test-owned directories under `transpile/`.

| Command | Final result |
|---|---|
| `python3 -B transpile/tools/build-app-data.py` | Build succeeded |
| `node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs` | 80 passed |
| `TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/assets -p 'test_*.py'` | 19 passed, including fresh archive rebuild |
| Same Python command with `-s transpile/tests/render` | 3 passed, all GCO/BAN/ANI/source bytes/palettes/tile validated |
| Same Python command with `-s transpile/tests/app` | 3 passed, deterministic app rebuild, all165 bonus packet backgrounds/raster coordinates, font source bytes |
| `TMPDIR="$PWD/transpile/.tmp" PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/browser/results.xml node_modules/.bin/playwright test --config transpile/playwright.config.mjs --reporter=junit` | 8 passed in installed Google Chrome |

App Node tests cover shared RNG/prior duration, recovered frame ordering, bonus timer/input exclusion, exact Practice rows/case/ignored keys/SPACE and CR, expression timestamps, duration/pause/early exit/Next, guest state, per-key counters/reset, palette values, idle additive origin, ground pixels, all three character bonus endpoints and missing sprites.

Chrome checks cover local-resource-only loading, original menu/results hit regions, student edits/load/persistence/gating, Outside wrong/right inputs and timeout, Practice wrong/ignored/right keys/line advance/expression/timeout, focus adaptation, guest nonpersistence, natural bonus activation/timer freeze/playback/restart, missing assets and blocked storage. Screenshots inspected: `reports/browser/outdoor-mobile.png`, `practice.png`; bonus/results/menu snapshots also saved. They are inspection artifacts, not original-runtime golden images.

Intermediate test failures were corrected: the old storage test expected silent corruption fallback; the new visible-error assertion initially included a browser-dependent `Uncaught Error` prefix; a source-string fixture included one extra terminator byte. Screenshot inspection caught invisible Practice text caused by applying sprite-zero transparency after font recoloring. The font mapping was corrected and a pixel-index regression assertion added. Final suites above are green.

`git status --short` showed only the pre-existing untracked `transpile/` tree. `git check-ignore` confirmed worktrees, scratch, generated data, bonus binary frames and browser XML are excluded. Nothing was removed from disk.

## Known gaps and reviewer handoff

- **Water/Castle disabled:** Water pending-key suppression, full random bubble scheduling and failure/bonus orchestration are not integrated. Castle metadata queue, operation2/3 transitions, repeated-random pipe delays, complete scene/failure sequence and BGS/clipping remain incomplete. Detailed evidence and no-invention rationale are retained in `COVERAGE.md` and `analysis/worlds/MECHANICS.md`.
- **Title/menu/fireworks omitted:** no fake playback or speculative RNG draws. Shared activity stream is exact for this slice's entry history, not an original session replay.
- **Host presentation:** full-scene redraw, approximate18.2Hz/two-tick waits, sampled clocks, one-key latch, focus pause, native editor/storage, HUD/result text layout, menu greeting color and static Practice cursor are declared adaptations. Fades/audio/original dropdowns/widgets are absent.
- **Reentry:** Outside constructor still resets motion/animation counters that may survive original activity reentry. Runtime RNG, prior duration and Practice last-correct do persist. Independent reviewer should assess whether a future recovered reentry API is warranted; no module was patched around this gap.
- **Long signed-distance overflow:** recovered frame binding rejects unsupported negative indices instead of inventing wrapping. App reports an error and suspends if reached. Long-session original behavior is not established by this integration.
- **No DOS differential run:** tests validate authored behavior and inert bytes only, not exact original timing, all intermediate pixels or exhaustive decompilation.

Key app APIs touched: `Session.start/step/suspend/finish/next`, `editStudent/loadProfiles`, `Renderer.load/text/outdoor/practice/cinematic`, and data builder. Recovered APIs called directly are listed in `ASSUMPTIONS.md`. No known recovered-module correctness fix is asserted by this integration; remaining API/lifecycle questions above are for the independent audit.
