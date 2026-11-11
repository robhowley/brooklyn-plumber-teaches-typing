# Phase 6 final verification

## Verdict

**PASS.** Rechecked both findings in `transpile/reports/PHASE-6-FIXES.md`: delayed first-gesture audio settlement and path-stable disassembly listings. Full Node, Python, Chrome, and existing-server smoke checks pass. This is verification of the current workspace, not commit or publication approval.

## Acceptance criteria

- First trusted menu-key gesture starts audio unlock naturally, with no earlier focus unlock; delayed success and denial settle the current Ready wait, while mute/suspension release it. During the wait, input does not advance the world or RNG. Previously skipped welcome/Ready is not replayed.
- Disassembly regression checks change only the known wrapper-path header, preserve instruction bytes, and compare complete outputs across distinct paths.
- Water's timer starts before Ready, `lastInput` is sampled on continuation, and strict `>20` inactivity/input draining semantics remain. Chrome covers all four worlds.
- Run full Node and Python asset/render/app/audio suites, full Chrome using port 4203, then existing-server port 4179 smoke. Do not execute or emulate original code.

## Evidence

| Claim checked | Command or source | Result | Decisive detail |
|---|---|---|---|
| Node suite | `TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{app,control,outdoor,worlds,runtime,render,audio}/*.test.mjs` | PASS | 309 passed. |
| Python assets | `TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/assets -p 'test_*.py'` | PASS | 19 passed. |
| Python render/disassembly | `TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/render -p 'test_*.py'` | PASS | 6 passed; regression asserts all 38 listings, exact header replacement, raw instruction bytes, and equality across two distinct temporary checkout paths. |
| Python app and audio | `TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/app -p 'test_*.py'`; same command with `transpile/tests/audio` | PASS | 9 app + 11 audio passed. Python total: 45. |
| Full Chrome | `TRANSLATION_PORT=4203 PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/browser/phase6-final-reverification.xml node_modules/.bin/playwright test -c transpile/playwright.config.mjs --reporter=junit` | PASS | XML: 42 tests, 0 failures, 0 errors, 0 skipped. Includes first-menu-gesture success/denial/mute/suspend; all four worlds; startup/menu and Ready behavior. |
| Existing server smoke, run last | `LIVE_EVIDENCE=phase6-final-live-evidence.json node --test transpile/.tmp/phase6-live-smoke.test.mjs` | PASS | 1 test passed against `http://127.0.0.1:4179/`; source-key activity, Results, and Menu passed for Outside, Water, Castle, Practice. Temporary copy adapted only to wait until Water exits `ready`, has no blocking audio, and Ready is no longer pending before typing. No production source was changed for the smoke. |
| Water invariants | `transpile/tests/worlds/water.test.mjs`, `transpile/tests/app/water-integration.test.mjs`, `transpile/tests/app/water.spec.mjs` | PASS | Tests cover timer-running-at-entry, timer including final wait, fresh continuation input time, strict `>20`, ignored/wrong input resets, and input drain. |
| Scope/preservation | `git diff --check HEAD`; `git diff --cached --quiet`; `git diff --name-only HEAD -- . ':(exclude)transpile/**'`; `git check-ignore -v` on generated resources/reports/smoke files; `lsof -nP -iTCP:4179 -sTCP:LISTEN` | PASS | Whitespace clean, index empty, no changed paths outside `transpile/`; app data/assets and generated reports/scratch are ignored. PID 59919 remains the listener on 4179. |

## Limits

No original archive program, script, driver, or executable was run or emulated. The checks establish browser/API behavior, not human-perceived sound or DOS hardware equivalence. Other browsers/platforms and fresh dependency installation were not tested. No commit, push, delegation, wiki, or task operation was performed.
