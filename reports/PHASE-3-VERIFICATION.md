# Phase 3 independent verification

**Verdict: PASS.** The Phase 3 Castle gate criteria checked below are met by the inspected source and rerun authored-code tests. This is an independent post-integration gate, not a claim of DOS-runtime equivalence.

## Scope and evidence

Acceptance criteria: independently verify both prior static-review fixes and their regressions; inspect the Castle controller/session/main/render bridge for source-order, repeated-scene, input, timing, scoring, bonus, terminal and reentry behavior; rerun all Node, Python asset/render/app and Chrome tests; verify browser tests use real app input and only controlled host time; preserve port4179; and check source/config boundaries, ignored publication resources and diff cleanliness.

No original program, driver, script, or machine-code interpreter was executed. The archive is used only as static data by authored tests/tools. The reported source provenance is supported by the project reports and executable-byte assertions, not by dynamic comparison against the original.

| Claim checked | Command or source | Result | Decisive detail |
|---|---|---|---|
| Node regressions | `TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs` | PASS | 178 tests passed. |
| Python assets | `TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/assets -p 'test_*.py'` | PASS | 19 tests passed. |
| Python render | `TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/render -p 'test_*.py'` | PASS | 5 tests passed. |
| Python app/build | `TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/app -p 'test_*.py'` | PASS | 7 tests passed; includes builder/rebuild checks. |
| Chrome authored app tests | `TRANSLATION_PORT=4191 TMPDIR="$PWD/transpile/.tmp" PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/continuation/phase3/verification/01-independent-results.xml node_modules/.bin/playwright test -c transpile/playwright.config.mjs --reporter=junit` | PASS | JUnit XML exact count: 19 tests, 0 failures, 0 skipped, 0 errors. Suite counts: browser4, Castle5, integration5, Water5. |
| Earlier static defects | `transpile/tests/worlds/castle.test.mjs:130-138,158-168`; `transpile/tests/app/castle-integration.test.mjs:50-60`; `transpile/recovered/worlds/castle.mjs:121-133` | PASS | First scroll preserves pre-scroll oldX279 and emits newX272; clean stationary rocks emit no draw; integration pixel regression preserves overlapping foreground until dirtied. Source sites are MARIO.EXE FILE `0xc186..0xc1bb` and `0xc4e2..0xc540`, per `transpile/analysis/worlds/CASTLE-CONTROLLER.md`. |
| Controller and host bridge | `transpile/recovered/worlds/castle.mjs`; `transpile/app/session.mjs:226-281`; `transpile/tests/worlds/castle.test.mjs:105-195`; `transpile/tests/app/castle-integration.test.mjs:20-104` | PASS | Two normal cycles test all40 strips per transition, source scene/pipe order and independently checked repeated pipe RNG comparisons. Session waits for changed low16 ticks before resuming, does not catch up, consumes FIFO one key per op2, retains input through op3, and handles bonus stop/restore/flush. Integration verifies all3 characters, failure/timeout/abort, result/Next and modes1–4 reentry. |
| Browser test method | `transpile/tests/app/castle.spec.mjs`; JUnit above | PASS | Exercises app key events with Playwright's controlled clock and source corpus targets. Test code reads snapshots/assertions but does not set controller stats, flags, RNG or state. Browser tests do not use a DOS execution oracle. |
| Port, ignore and scope | `transpile/playwright.config.mjs`; `lsof -nP -iTCP:4179 -sTCP:LISTEN`; `git check-ignore -v ...`; `git diff --check`; `git status --short` | PASS | Playwright used4191. Existing Python listener on4179 remained PID59919, not stopped or replaced. Original assets, generated app data and JUnit output are ignored. All pre-existing implementation edits and this report are under `transpile/`; only scoped test reports/artifacts were generated. `git diff --check` is clean. |

## Independent source review

- The previously reported static defects are fixed in production source and have specific regressions. `oldX` is captured before scroll movement; the test asserts279→272, preventing the renderer's subtract-eight restore from double shifting. Rockface rendering is emitted only for dirty or changed records; the compositor test demonstrates the no-draw case preserves foreground pixels over the rock raster, and a dirty record redraws.
- Castle controller tests preserve operation distinctions and sequencing: operation2 checks prior failure/inactivity state before input; op3 transition operations do not score ordinary typing, refresh stats, or consume queued keys. Session waits on changed low16 ticks, does not step or consume input on a no-tick sample, and resumes deferred post-wait effects only after a changed tick. Pending FIFO input is consumed once by an op2 operation, while op3 leaves it pending.
- Coverage includes two full normal scene cycles, all40 scroll steps on each transition, repeated random draws during pipe delay comparisons including failed comparisons, old-player-position rock trigger, sand entrance/active/exit, source failure animations, timeout/failure/abort state separation, bonus timers/input flush/background restore, and new-session reentry. Three-character browser runs use actual source-word key input through two cycles and a natural bonus, followed by abort/results/Next and mode1/2/3/4/3 reentry.
- Completion and Next are not redirected to Practice. Result progression and completion flags are applied once after the ending request receives an explicit acknowledgement; the browser test confirms the documented Phase5 ending omission acknowledgement, and Castle remains the route for goal30+ while Practice has its own mode4 route.
- Deferred numeric HUD layout, intermediate fades, audio playback and optional Phase5 ending presentation are explicitly documented as omitted in `transpile/reports/PHASE-3.md`, `transpile/ASSUMPTIONS.md` and the app UI. They are not required Castle controller/browser gate behavior and are not represented as recovered.
- Publication boundary check found no candidate outside `transpile/`. `.gitignore` excludes `/assets/`, `/app/data.json` and browser XML; `git check-ignore` confirmed the representative generated resource/data/report paths. No source/configuration edits were made during this verification. Existing dirty/untracked Phase3 implementation was left untouched.

## Must Fix

None.

## Residual risk

- These tests verify authored translations against static bytes/resources and browser behavior, not runtime equivalence with the original executable.
- Browser clock/input cadence, focus and keyboard delivery remain host adaptations.
- The full fresh-input regeneration sequence was not rerun in an empty checkout; this gate reran the complete test suites and the app rebuild tests only.
- Numeric HUD presentation, fades, audio and optional ending playback remain deferred as documented.
