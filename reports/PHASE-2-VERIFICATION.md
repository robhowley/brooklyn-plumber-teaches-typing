# Independent Phase 2 Water verification

## Verdict

**PASS.** Both frozen-worker findings are fixed in the integrated source: bonus mode 3 is erased before reset, and newly allocated bubbles are included in the pre-movement rectangle snapshot. Targeted source, indexed-pixel, full Node/Python, and Chrome checks pass. Castle remains disabled.

## Acceptance criteria checked

- Verify the two review findings in MAIN, including source order, renderer effects, and regression coverage.
- Verify the Water host bridge uses a real pending-input pump, low-word changed-tick waits, deferred redraw, shared RNG/state, bonus timing, input flush, result caching, terminal paths, and strict progression.
- Verify all supported Water characters/resources and that Outside/Practice behavior remains covered; Castle remains disabled.
- Run Node, all Python assets/render/app suites, and Chrome without using or disturbing port 4179.
- Check current documentation, no-original-execution constraints, resource/export scope, and whitespace.

## Findings and evidence

| Claim checked | Command or source | Result | Decisive detail |
|---|---|---|---|
| Bonus mode3 erasure | `transpile/recovered/worlds/water.mjs:58`; `transpile/app/render.mjs:176-183`; `transpile/app/water-render.mjs:64-68`; `transpile/tests/worlds/water-render.test.mjs:130-137` | Pass | Controller emits `bonus-erase` while mode is still 3, then resets to 0. Renderer converts that effect to a mode3 null-current operation with the remembered previous sprite. Pixel test confirms the old raster is erased to the scene, including expiry at y=200. |
| Fresh bubble snapshot | `transpile/recovered/worlds/water.mjs:82-119`; `transpile/app/water-render.mjs:55-61`; `transpile/tests/worlds/water.test.mjs:149-170`; `transpile/tests/worlds/water-render.test.mjs:102-117` | Pass | Allocations occur before `previous = s.bubbles.map(...)`, and the bubble event carries that snapshot alongside moved bubbles. Renderer processes every previously active snapshot slot, including a bubble allocated in this update. Tests cover first-free allocation/random order and indexed dirty restoration. |
| Input pump, redraw, changed ticks, wrap/no catchup | `transpile/app/session.mjs:126-170`; `transpile/tests/app/water-integration.test.mjs:11-25` | Pass | Session drains FIFO events through source iterations, pauses only at wait/bonus boundaries, and compares low16 tick values; same tick and wrapped equality do not move actors, later observations advance once without catchup. Six-key redraw is asserted. |
| Shared state/RNG, reentry, timeout/abort/failure, result caching | `transpile/app/session.mjs:53-70, 185-205`; `transpile/recovered/worlds/water.mjs:28-54, 70-105, 152-230`; `transpile/tests/app/water-integration.test.mjs:26-89`; `transpile/tests/worlds/water.test.mjs:109-170, 191-260` | Pass | Reentry retains the tested Water words and shared RNG. Tests distinguish inactivity failure, abort, timeout, sink, final wait/stop ordering, cached result fields, bonus during failure (timer resumes and failure exit does not stop it), and strict >30 progression. |
| Browser and existing activity behavior | `transpile/tests/app/water.spec.mjs`; `transpile/tests/app/integration.spec.mjs`; `transpile/tests/app/browser.spec.mjs`; Chrome JUnit below | Pass | Browser tests cover all three characters, real input, bonus, failure, editor/storage/focus, results/Next, and disabled Castle. Existing Outside/Practice browser and Node regression suites are included in the full runs. |
| Node suite | `TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs` | Pass, 137 tests | Structured result: 137 passed. |
| Python suites | `TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/assets -p 'test_*.py'`; same command with `-s transpile/tests/render`; same with `-s transpile/tests/app` | Pass, 19 + 5 + 6 = 30 tests | All three independently rerun and passed. App rebuild test confirms generated app data is byte-identical. |
| Chrome suite | `TMPDIR="$PWD/transpile/.tmp" TRANSLATION_PORT=4188 PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/browser/phase2-independent.xml node_modules/.bin/playwright test -c transpile/playwright.config.mjs --reporter=junit` | Pass, 14 tests | JUnit XML reports tests=14, failures=0, errors=0, skipped=0. Config starts its own server on 4188; no command used port 4179. |
| Scope and current documentation | `git diff --check`; `git status --short --untracked-files=all`; `git diff --name-only`; `git ls-files --others --exclude-standard -- transpile`; `transpile/README.md`, `transpile/COVERAGE.md`, `transpile/ASSUMPTIONS.md`, `transpile/PLAN.md`, `transpile/reports/PHASE-2.md` | Pass | Diff check is clean. Existing Phase2 changes/candidates are confined to `transpile/`; no original-resource paths are tracked or candidate files. Docs say Water HUD, fades, sound, and optional celebration remain omitted, and Castle is disabled. No original program was run, emulated, or used as a runtime oracle. |

## Limits and deferred scope

- Water numeric HUD remains intentionally omitted, not approximated; original report/text layout belongs to Phase 4. Optional fades, sound, and celebration remain later-phase work. These omissions do not block the Water gate.
- Full fresh-input rebuild in a separate empty checkout and the additional repeated Chrome run were not part of this independent rerun. Integration's historical counts are not treated as evidence here.
- Browser behavior remains subject to documented host clock, event-delivery, focus, and FIFO-capacity differences. Tests establish authored source-derived behavior, not differential equivalence to a running DOS original.

## Workspace note

The pre-test and post-test `git status --short --untracked-files=all` lists were identical for the existing Phase2 worktree. Test commands left the worktree unchanged; only this report and the separately assigned verifier artifact were added afterward. No source/configuration was modified, and nothing was committed, pushed, delegated, or sent externally.
