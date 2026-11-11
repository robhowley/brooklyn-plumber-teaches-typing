# Phase 6 review fixes

Both bounded findings are fixed. Focused checks pass: **309 Node, 26 Python, 9 Chrome**. Independent full recheck is pending; this is not merge/publication approval.

## Changes

- `app/audio.mjs`: `BrowserAudio.unlock` retains and deduplicates only the current trusted-gesture resume promise. Context construction and resume still begin synchronously inside that gesture, never at a later playback boundary.
- `BrowserAudio.perform` captures that promise only for a blocking source request made while it is already pending. It waits, then plays Ready or returns an explicit omission. Previously skipped welcome/Ready requests are not queued or replayed.
- `BrowserAudio.stop` releases a speech request waiting for unlock on mute, suspension, blur or close, even if the native resume promise has not settled. The underlying unlock remains deduplicated until it settles; late success cannot revive the canceled request.
- `app/main.mjs`: transport rejection becomes an explicit failed outcome, and continuation errors reach the existing application error handler rather than becoming unhandled promise rejections.
- `tools/render/inspect.py`, `tools/control/startup-inspect.py`, `tools/control/menu-inspect.py`: replace only the first exact `\n<authored-wrapper-path>:\tfile format ` header with the same wrapper basename. No instruction text, bytes, offsets, provenance or hashes are removed or filtered.

Source references remain the existing Ready call boundaries, EXE FILE `0x13e04` (Outside) and `0x176c7` (Water). No controller timing, audio format, resource selection or visual scope changed.

## Regression proof

- `tests/audio/audio.test.mjs`: four delayed first-unlock outcomes (success, denial, mute, suspension), concurrent gesture deduplication, skipped welcome remaining skipped, and cancellation before native resume resolves.
- `tests/app/audio.spec.mjs`: four real first-menu-key entries after natural startup. No startup skip, focus click, earlier unlock, or controller mutation. Chrome observes zero resume calls before the menu key. Native resume starts in that trusted key handler; only its result is delayed by the test.
- Those Chrome cases hold Water Ready through attempted input/Escape and clock steps, preserve RNG/attempts/lastInput and defer music3. Success continues only after actual native `ended`; elapsed ticks include the wait and Ready. Denial/mute/suspend explicitly release the continuation without replay. No page errors occurred.
- Existing Node integration retains exact Water timer/inactivity semantics: running timer before Ready, fresh wall-time lastInput after completion, strict >20 inactivity and input draining. All existing tests pass.
- `tests/render/test_inspect.py`: execute the three inspectors in two distinct temporary checkout paths; compare every generated output; verify all 38 emitted listings equal raw objdump output with only the exact known header replaced. Every inert wrapper's instruction bytes and address are checked against the hash-pinned EXE slice. Archive/EXE hash checks remain enforced.

## Existing bootstrap snapshots

Used `transpile/.worktrees/p6-host/transpile/.tmp/final-bootstrap/{run-1,run-2}`, originally built independently by the complete recipe. Inspected all 38 differences before regeneration: each differed on exactly one objdump file-header line, not instructions.

Ran only the three changed inspectors once per snapshot, not another full bootstrap. The local runner and full path/hash inventory are `transpile/.tmp/phase6-fix-repro.{py,json}`.

| Scope | Before | After |
|---|---|---|
| Generated outputs outside `.tmp`, including generated `recovered/worlds/tables.mjs` | 2,525 total, 2,497 equal, 28 listing headers different | 2,525 equal |
| `.tmp/menu` | 10 listing headers different, evidence unchanged | 11 equal outputs |
| `.tmp/{report,water,castle}-evidence.json` | Unchanged evidence | 3 equal outputs |
| Meaningful generated output total above | 38 unstable listing headers | **2,539 equal outputs** |

The 28 outside listings are 11 `analysis/render/*.asm.txt` and 17 `assets/startup/*.asm.txt`; the other 10 are `.tmp/menu/*.asm.txt`. The old 2,529 count is withdrawn. Path-bearing `.tmp/final-rebuild.log` files are expected to vary and are not durable generated outputs. No whole-text filter or semantic-difference suppression was used. All generated outputs outside `.tmp` other than the 28 headers retained their prior bytes.

Both snapshots' `app/data.json` remains SHA256 `066edada0ea12b065463a5494827f727498e9fab3d3dd740f964e5bd9693c93a`. Main resources/app data were not regenerated or intentionally changed. This uses the original full bootstrap evidence plus focused repair; independent full reconstruction is still required.

## Commands and results

All tests/regeneration commands used `structured_return`, from repository root.

| Command | Result |
|---|---|
| `TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{app,control,outdoor,worlds,runtime,render,audio}/*.test.mjs` | 309 passed |
| `TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/render -p 'test_*.py'` | 6 passed |
| Same discovery command with `transpile/tests/audio` | 11 passed |
| Same discovery command with `transpile/.worktrees/p6-host/transpile/.tmp/final-bootstrap/run-1/transpile/tests/app` | 9 passed, rebuild confined to snapshot |
| `TRANSLATION_PORT=4202 PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/browser/phase6-fixes.xml node_modules/.bin/playwright test -c transpile/playwright.config.mjs transpile/tests/app/audio.spec.mjs --grep 'first menu gesture' --reporter=junit` | 4 passed |
| `TRANSLATION_PORT=4202 PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/browser/phase6-fixes-audio.xml node_modules/.bin/playwright test -c transpile/playwright.config.mjs transpile/tests/app/audio.spec.mjs --reporter=junit` | 9 passed, includes those same 4 |
| `python3 -B transpile/.tmp/phase6-fix-repro.py` | Exit0; 2,525 outside outputs and 11 menu outputs equal; separate exact comparison confirmed 3 other evidence files |
| `git diff --check`; `git diff --cached --quiet`; port4179 listener inspection | Passed; empty index; original PID59919 still listening |

Initial Chrome attempts exposed test-only assumptions: an overlength fixture student name and expecting transient Water phase `active` after a tick had already entered `wait`. Those assertions were corrected; the final commands above passed. No production workaround was added for them.

## Changed authored paths

- `transpile/app/{audio,main}.mjs`
- `transpile/tools/render/inspect.py`
- `transpile/tools/control/{startup-inspect,menu-inspect}.py`
- `transpile/tests/audio/audio.test.mjs`
- `transpile/tests/app/audio.spec.mjs`
- `transpile/tests/render/test_inspect.py`
- `transpile/reports/{PHASE-6,PHASE-6-VERIFICATION,PHASE-6-FIXES}.md`
- `transpile/PLAN.md`

No original code ran or was emulated. No root edits, delegation, commits, pushes, wiki or task operations. The user server4179 stayed running. Full Chrome/nonaffected Python suites, fresh dependency installation, other platforms and physical audible equivalence were not repeated. The previous verifier PASS is explicitly pending review-fix recheck.
