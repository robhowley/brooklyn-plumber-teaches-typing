# Phase5 integration

Startup, explicit Demo, menu idle and source progression presentations are integrated locally. Phase4 was independently verified and pushed as `2f9ad12` (parent-provided status). No Phase5 commit, push or independent approval is claimed.

## Timeout review correction

- The earlier independent **PASS** in `PHASE-5-VERIFICATION.md` is superseded by [the second opinion](continuation/phase5/verification/02-second-opinion.md). Its Outdoor timeout finding required this fix; the correction is applied and checked below, but renewed independent approval remains pending.
- Fresh data-only reads verify the pinned archive and `MarioTea/MARIO/MARIO.EXE` hashes listed below. FILE `0x13a9c..0x13aaa` compares elapsed/duration high words signed, then equal-high low words unsigned. At or above the limit, `0x13aaa` jumps to `0x13b89`, bypassing input poll `0x13aaf`.
- `recovered/outdoor/outdoor.mjs` now calls `pollInput` only below the limit, after the unchanged world updates/target selection. Timeout consumes no physical key, Demo countdown step or Demo RNG draw. World-update RNG is not suppressed. Ending mode 1 to 2, repeated timeout mode 2 to 3, statistics, and the already-ended guard are unchanged.
- `tests/outdoor/outdoor.test.mjs` adds four source-bound tests (fresh pinned bytes and elapsed 119/120/121 with limit 120). Both due and not-due Demo synthesis verify queued Escape/typeahead, shared RNG/countdown, statistics, and below-limit update-before-poll order. The existing repeated-timeout test now proves both expired ticks bypass Demo input while advancing the unfinished jump and preserving counts.
- Red/green proof: the expanded Outdoor suite before the code fix had 3 failures and 19 passes; after the fix it has 22 passes. Full Node rerun has **272 passes**. Focused Chrome startup/Demo rerun has **5 passes**, zero failures/errors/skips, using separate port 4196 and ignored JUnit `transpile/.tmp/phase5-timeout-browser.xml`.
- Exact post-fix commands, run through `structured_return` from the repository root:

```sh
TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/outdoor/outdoor.test.mjs
TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs
TMPDIR="$PWD/transpile/.tmp" TRANSLATION_PORT=4196 PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/.tmp/phase5-timeout-browser.xml \
  node_modules/.bin/playwright test -c transpile/playwright.config.mjs transpile/tests/app/startup.spec.mjs --reporter=junit
```

Only the two files named above and `reports/{PHASE-5,PHASE-5-VERIFICATION}.md` were edited for this correction. No staging, commit, push, original execution/emulation, wiki/task updates or delegation occurred. Historical verification below predates this correction; Python and the full 32-test Chrome suite were not rerun for this narrow fix.

## Scope and provenance

- Imported only the11 declared authored files from `transpile/.worktrees/p5-startup` and `p5-celebration`, listed in the presentation worker reports. No generated worker resources were copied.
- Regenerated ignored `assets/startup/` and `assets/render/celebration/bindings.json` with the inspected authored static readers, then rebuilt `app/data.json` locally.
- No original executable, installer, script or driver was run, emulated or loaded as code. Trusted objdump inspected inert wrappers only. Browser/Node/Python checks execute authored code.
- Archive SHA256: `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`; MARIO.EXE SHA256: `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e`.
- Exact member hashes, decoded indices and source FILE spans: [STARTUP](../analysis/control/STARTUP.md), [CELEBRATIONS](../analysis/control/CELEBRATIONS.md). This is static/source-derived proof, not comparison with an executed DOS reference.

## Behavior

- Startup follows FILE `0xfb90..0x103be`: LOGO, Mario zoom,13 letters and greeting. Natural seed1:291 completed source waits,27 Mario compositor calls,13 RNG draws,59 palette writes. Separate skip sites suppress only their original waits/draws; pending keys are flushed on menu entry.
- Menu callback FILE `0x10b31..0x10ce3` consumes the shared RNG before servicing bubble/blink/input. Idle displays the source bordered text panel, never gameplay. The panel uses FONT5H, six22-cell rows and palette index14; eye frames retain1/1/2 waits. File-dropdown suppression is specific to that dropdown.
- D invokes the explicit unsaved Demo mutation, not a Guest flag. All4 worlds poll their actual target at their original input site. Outside reads before replacement; Water/Castle/Practice synthesize before physical reads. Practice countdown observes changed low words. Demo returns through source abort/termination, clears its flag, flushes input and bypasses results/save/progression.
- Reviewed Alt-X issue fixed before integration. `createDemo` now receives option10 and gates quit requests. Regression tests cover true/false for all4 modes and fresh archive bytes at FILE `0xbd71..0xbd8b` and `0x13b64..0x13b77`, including option service10 and the conditional quit call.
- Outside completion uses OCASTLE,55 actor updates and up to10 low-bit-RNG fireworks. Keys interrupt only the source movement/outer-firework checks. Each packet waits twice.
- Water completion performs56 swim updates clipped at X105, then48 WCAS packets, with no skip polling. Input is flushed at source boundaries; the final prompt alone waits for input. Cleanup preserves the bit7 clear, exact fade writes, screen clear and full clip restoration.
- Castle suspends its deferred save/results tail for ENDF. All modes perform18 mandatory waits; mode4 repeats40-packet ENDF passes until a key. Its completed byte is set after presentation return. Premature ending acknowledgements are rejected.
- Results effects draw operation210 before speech request, suppression reset and input flush. Next uses the source helper to queue only completed/unprinted/nonpending certificate flags, saves the routed profile before new-world initialization, and cannot advance twice. Printed bytes and the existing260-byte save format/namespace are unchanged.
- Startup, Water ready, Castle ready and results expose synchronous audio call boundaries. Requests return `pendingPhase6-silent` without a guessed duration or unresolved playback promise. Water samples last-input after its ready callback returns. No audible playback, actual printing or browser quit is claimed.

## Integration files

| Files | Changes |
|---|---|
| `recovered/control/{startup,celebration,results}.mjs` | Source presentation/Demo/results controllers and certificate queue helpers |
| `recovered/outdoor/outdoor.mjs`, `recovered/worlds/{water,castle}.mjs` | Source-site Demo input hooks and ready/audio boundary |
| `app/session.mjs` | Startup/menu lifecycle, shared RNG, Demo, suspended presentation tails, results/Next ownership |
| `app/{main,render,startup-render,celebration-render}.mjs` | FIFO/DOM transport, deferred menu input, indexed resources/palette writes and presentation routing |
| `tools/control/{startup-inspect,celebration-inspect}.py`, `tools/build-app-data.py` | Local static regeneration and producer/consumer schema |
| `tests/control/{startup,celebration}.test.mjs` | Imported source traces plus guarded Alt-X regression |
| `tests/app/{source-path.mjs,startup-integration.test.mjs,startup.spec.mjs}` | Explicit source skip helpers, all-character/all-world integration and real UI startup/Demo tests |
| Existing `tests/app/*` | Regression fixtures now traverse source startup and the initial menu RNG/blink before selecting a world; completion tests play actual presentations; browser drivers wait for actual source dispatch |
| `analysis/control/{STARTUP,CELEBRATIONS}.md`, `PLAN.md`, `README.md`, `COVERAGE.md`, `ASSUMPTIONS.md`, `index.html` | Current behavior, bootstrap and bounded gaps |

## Verification

Run from the repository root through `structured_return`:

```sh
python3 -B transpile/tools/control/startup-inspect.py
python3 -B transpile/tools/control/celebration-inspect.py
python3 -B transpile/tools/build-app-data.py
TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs
TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/assets -p 'test_*.py'
TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/render -p 'test_*.py'
TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/app -p 'test_*.py'
TMPDIR="$PWD/transpile/.tmp" TRANSLATION_PORT=4194 PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/browser/phase5.xml \
  node_modules/.bin/playwright test -c transpile/playwright.config.mjs --reporter=junit
```

- Before the timeout correction: 268 Node tests;33 Python tests (19 assets,5 render,9 app);32 Google Chrome tests passed. These historical results did not catch the timeout poll defect. Post-correction results are recorded above.
- Source readers verify17 startup spans and3,177 celebration instruction records; movie packet counts26/25/48/40. App rebuild equality and new startup/celebration transport tests pass.
- Node integration tests cover all3 characters across all4 Demo modes and all3 world completions/normal aborts. Browser tests use only UI input and host clock control, never controller mutation; they cover startup/skips/focus/idle, all3 characters in all4 Demo modes, Water completion and repeating Castle ending.
- Chrome uses4194; the existing4179 service is untouched. Root files/configuration are unchanged. Generated assets remain ignored. `git diff --check HEAD` includes new authored files using only explicit `git add -N` paths; no file content is staged.

## Exact changed paths

```text
transpile/ASSUMPTIONS.md
transpile/COVERAGE.md
transpile/PLAN.md
transpile/README.md
transpile/analysis/control/CELEBRATIONS.md
transpile/analysis/control/STARTUP.md
transpile/app/celebration-render.mjs
transpile/app/main.mjs
transpile/app/render.mjs
transpile/app/session.mjs
transpile/app/startup-render.mjs
transpile/index.html
transpile/recovered/control/celebration.mjs
transpile/recovered/control/results.mjs
transpile/recovered/control/startup.mjs
transpile/recovered/outdoor/outdoor.mjs
transpile/recovered/worlds/castle.mjs
transpile/recovered/worlds/water.mjs
transpile/reports/PHASE-5.md
transpile/tests/app/browser.spec.mjs
transpile/tests/app/castle-integration.test.mjs
transpile/tests/app/castle.spec.mjs
transpile/tests/app/integration.spec.mjs
transpile/tests/app/integration.test.mjs
transpile/tests/app/presentation.spec.mjs
transpile/tests/app/session.test.mjs
transpile/tests/app/source-path.mjs
transpile/tests/app/startup-integration.test.mjs
transpile/tests/app/startup.spec.mjs
transpile/tests/app/test_build.py
transpile/tests/app/water-integration.test.mjs
transpile/tests/app/water.spec.mjs
transpile/tests/control/celebration.test.mjs
transpile/tests/control/startup.test.mjs
transpile/tests/outdoor/outdoor.test.mjs
transpile/reports/PHASE-5-VERIFICATION.md
transpile/tools/build-app-data.py
transpile/tools/control/celebration-inspect.py
transpile/tools/control/startup-inspect.py
```

Key functions/types: `Session`, `createStartup`, `createDemo`, `createMenuIdle`, `Celebration`, `CelebrationRenderer`, `resultEntryEffects`, `resultNextState`, world input dispatch hooks.

## Remaining gaps

- Native CPU, loader, BIOS/DAC cadence and real DOS execution equivalence are unverified. Host18.2Hz samples acknowledge one changed low word, never missed-tick catchup. Unwaited fades preserve writes but may display only their final palette in one callback.
- Focus loss freezes startup/celebration scheduling and flushes pending keys. Explicit clock replacement rebases menu elapsed timestamps and resets the wait sample; it never reseeds RNG or changes lesson statistics.
- Phase6 audio playback/option/device transport remains pending. The inspected audio worker contract informed synchronous boundaries only; its modules/assets were not imported.
- Intermediate gameplay/modal fades, original pointer imagery, welcome palette88 mapping, Practice input blink, DOS allocation/file/device errors, actual printing and tab/process quit remain unsupported. This work does not claim all original animations or hardware behavior.
