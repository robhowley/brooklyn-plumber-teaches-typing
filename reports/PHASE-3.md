# Phase3: playable Castle

**Castle now runs the full repeating rockface → pipe1 → sand → pipe2 sequence through bonus, failure, timeout, abort, results and Next.** Phase2 passed independent verification and was pushed as `aaf2975`, the parent checkpoint. Phase3 is local and uncommitted; its independent post-integration review remains pending. Numeric Water/Castle HUD layout, fades/audio and optional Phase5 ending playback are not complete.

## Imports and review fixes

Only these seven authored files were copied from the named frozen workers; no directory, ignored original resource or generated evidence was imported:

| Worker | Imported paths beneath `transpile/` |
|---|---|
| `.worktrees/p3-castle/transpile/` | `recovered/worlds/castle.mjs`, `tests/worlds/castle.test.mjs`, `analysis/worlds/CASTLE-CONTROLLER.md`, `tools/worlds/castle-inspect.py` |
| `.worktrees/p3-castle-render/transpile/` | `app/castle-render.mjs`, `tests/worlds/castle-render.test.mjs`, `analysis/render/CASTLE.md` |

The two findings in `reports/continuation/phase2/verification/02-second-opinion.md` were fixed before integration:

- FILE `0xc186..0xc1bb`: preserve pre-scroll `oldX` in the player event; compute the new x directly as oldX−8+1+(step&1). The renderer already subtracts8 when restoring the previous actor. The first normal strip regression requires oldX279/newX272, not merely matching frame names.
- FILE `0xc4e2..0xc540`: emit rockface draw effects only for dirty records or changed position/raster. A phase change alone is insufficient. Tests require no effects for clean stationary records and preserve synthetic foreground pixels overlapping the actual rock raster; marking the same record dirty must change those pixels.
- Static tests verify the archive hash, all3,803 Castle instruction-byte records, the subtract8 instruction at `0xc186` and the no-draw jump at `0xc50d`. This is source provenance, not original-runtime execution.

## Integration behavior

- `Session.start` supports mode3 with the existing shared prefix/segment RNG and SENTENC corpus, followed by Castle's five bonus draws using the previous duration. Student duration field3 is byte34, with recovered default300s; the native editor exposes it for all characters.
- Session retains separate Castle rock/sand observed-second clocks across world changes. Fresh entry resets controller/queue/flags but not those clocks, shared RNG, previous duration or the existing Water state.
- `Session.stepCastleHost` allows one original operation per changed low16 tick, one consumed FIFO key per operation and no catchup. Operation3 ignores ordinary typing and does not check inactivity/accuracy or refresh statistics. Operation2 retains the source failure-before-input ordering, printable32..126, case sensitivity and typing lock. Postwait clip restoration/first-entry Ready effects are held until the changed tick, not drawn before the wait.
- The2000-word queue, fixed target index8,500-byte reader bound, signed metadata/end flags and shifts use the controller's source flow. New `text` events copy the first40 queue words at the draw call. Renderer never reconstructs them from a later queue state.
- The generator retains every rockface stage, source old-player-position trigger, stage3 timer stop/typing lock, all40 normal-scroll iterations and fast branch. Both five-pipe sequences perform four operation3 holds, erase, then draw RNG again for every delay comparison, including the final false comparison.
- Sand entrance includes its eight accelerating fall steps; active movement uses the existing WPM/text-target arithmetic; exit retains wade, jump/landing and final walk. Both source failure animations run to their own return conditions, with failure/timeout/explicit-exit flags kept separate. No lives, collision damage, retry screen or finite scene map was added.
- `Renderer.castle` applies ordered event snapshots through the real indexed compositor, not a final-state frame redraw. It preserves inclusive scene clips, actor/rock/bonus order, FONT9H target/metadata colors and FONT7H bonus composition. All40 strips use scratch rows, shifted-background bias and rounded previous/current actor restoration; finalization copies only rows0..154.
- Builder additions use existing decoded scenes/sprites/palettes and the understood BAN decoder. Bonus-X words come from executable FILE `0x213b4`; no numeric scene table was guessed. All three52-packet movies expose actual BAN write runs, including writes equal to the old background and literal zeros. Skips remain skips. ANI dirty erasure follows writes.
- Bonus interception precedes ordinary scoring. Playback starts packet0 immediately and waits for two distinct changed ticks per packet. Timer stops, pending input is not scored, and return restores the appropriate background/palette, marks rocks dirty, resets last-input wall time, resumes timer and flushes input before the suspended operation tail. Sand borrows scene0 for playback and restores scene2; rockfaces retain the postmovie background.
- `Session.acknowledgeCastleEnding` is an explicit callback boundary. Results/save effects remain deferred until completion or a reasoned omission acknowledgement. Main acknowledges `Phase5 ending playback is not translated`, with no fabricated delay or RNG. Goal, lesson, completion flags and results are still applied once. Source Next routes goal30+ to Castle; completion does not invent a route to Practice. Practice's own Next stays mode4.
- Existing guest/no-save behavior, corrupt/blocked-storage memory-only warning, missing-resource errors and all Water regressions remain exercised.

Source/member identities and full call-site tables: `analysis/worlds/CASTLE-CONTROLLER.md`, `analysis/render/CASTLE.md`, `analysis/render/BGS.md`. MARIO.EXE SHA256 is `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e`; archive SHA256 is `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`. Original bytes were read only as data. No archive program, executable, driver, script or machine-code interpreter ran.

## Verification

Commands ran from the repository root through `structured_return` (`node-test-text`, `unittest-text`, `junit-xml`):

```sh
python3 -B transpile/tools/build-app-data.py
node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs
TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/assets -p 'test_*.py'
TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/render -p 'test_*.py'
TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/app -p 'test_*.py'
TRANSLATION_PORT=4190 TMPDIR="$PWD/transpile/.tmp" \
  PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/browser/phase3-results.xml \
  node_modules/.bin/playwright test -c transpile/playwright.config.mjs --reporter=junit
git diff --check
```

| Check | Result |
|---|---|
| Full Node |178 passed, including34 Castle controller/presentation cases and7 new Session/Renderer integration cases |
| Python assets/render/app |19 +5 +7 =31 passed; app rebuild byte-identical |
| Full Chrome |19 passed, including5 new Castle cases |
| Frozen-worker regressions |Pre-scroll coordinate and stationary overlapping foreground tests pass; source instruction provenance verified |
| Scope/ignore |Only `transpile/` authored files changed; resources, app data, raw listings, numerical tables, reports/screenshots remain ignored |

Chrome runs actual authored main-loop key events using source corpus targets and Playwright's controlled clock. Each of Mario/Luigi/Princess completes two full ordinary cycles, reaches and plays a natural bonus, aborts, uses results Next, and reenters modes1/2/3/4/3. Other cases cover actual inactivity failure, one-minute source-clock timeout, group6 goal/completion advancement, explicit ending omission acknowledgement and Next. No browser test mutates controller state, stats, flags or RNG. Node tests additionally check every scroll strip, FIFO boundaries, same-low-tick/no-catchup behavior, exact input/score rules, dirty pixel preservation, bonus time exclusion/flush and source queue snapshots. Existing Chrome guest, storage-denial, missing-resource and Water cases still pass.

Earlier runs caught obsolete disabled-Castle expectations. Those were changed to real guest eligibility and profile goal30 gating. No production workaround was added to preserve stale test assumptions. Port4190 was used exclusively; the existing4179 listener was not stopped, reused or replaced.

## Changed authored paths

- Imported seven files listed above, with controller/text-snapshot fixes and integration status notes.
- `app/session.mjs`: Castle entry, FIFO/wait/bonus bridge, retained clocks, explicit ending acknowledgement and result application.
- `app/main.mjs`: mode3 eligibility/routing, FIFO delivery, duration editor, renderer dispatch, ending omission acknowledgement and read-only snapshots.
- `app/render.mjs`: ordered Castle draw consumer and decoded local resources.
- `tools/build-app-data.py`: Castle decoded resources, verified bonus-X words and exact BAN write transport.
- `index.html`: mode3 controls and explicit presentation omissions.
- `tests/app/castle-integration.test.mjs`, `tests/app/castle.spec.mjs`: new end-to-end source-key and pixel/lifecycle checks.
- `tests/app/browser.spec.mjs`: guest Castle pointer entry and abort, existing disabled-command/error checks retained.
- `tests/app/session.test.mjs`: Castle enabled and mode5 rejected.
- `tests/app/test_build.py`: Castle producer/source proof and rebuild checks.
- `tests/app/water-integration.test.mjs`: Water Next now enters Castle; existing Water regressions retained.
- `tests/app/water.spec.mjs`: Castle profile goal30 gate replaces obsolete disabled-world assertion.
- `.gitignore`: local Castle evidence patterns.
- `COVERAGE.md`: enabled mechanics and remaining presentation gaps.
- `ASSUMPTIONS.md`: Castle scheduling, rendering and explicit ending omission.
- `README.md`: play/rebuild guidance and limitations.
- `PLAN.md`: Phase2 passed/pushed checkpoint and Phase3 local verification ledger.
- `reports/PHASE-3.md`: this source/check/path record.

All listed paths are relative to `transpile/`, totaling25 authored files. Key APIs: `CastleController`, `CastleQueue`, `Session.stepCastleHost`, `Session.consumeCastle`, `Session.acknowledgeCastleEnding`, `Renderer.castle` and the transition/bonus functions in `app/castle-render.mjs`.

## Remaining limits

- Independent Phase3 post-integration review is pending; no completed review/checkpoint gate is claimed.
- Numeric Water/Castle HUD layout is deferred to Phase4. Ready/music/sound requests are not playback; intermediate palette fades are absent. Optional Phase5 ending/celebration playback is explicitly omitted, not replaced with a guessed duration or RNG sequence.
- Browser18.2Hz sampling, unbounded FIFO, DOM input/typematic and focus suspension are host adaptations. Wall inactivity continues while focus-paused. Original options/demo/device behavior remain outside the enabled path.
- The full fresh-input pipeline was not repeated in an empty checkout for Phase3. The app builder was rebuilt and checked byte-identical; source inspectors/resource tests read the local hash-pinned archive. No original-derived data was imported from worker checkouts or added as a source candidate.
- These tests prove source-byte/resource contracts and authored browser integration, not differential equivalence to an executed original. No commit, push, delegation, wiki write or task-store operation occurred.
