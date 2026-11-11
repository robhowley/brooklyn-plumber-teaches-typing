# Live server verification, 2026-11-11

**PASS: the existing server on port 4179 serves all four activities. The reproduced console 404 was only the browser's implicit favicon request.**

## Cause and change

- Before change, isolated Chrome recorded HTTP 404 for exactly `http://127.0.0.1:4179/favicon.ico` (CDP resource type `Other`).
- The console reported `Failed to load resource: the server responded with a status of 404 (File not found)` at that URL, line 0, column 0.
- All other 32 browser responses were HTTP 200; there were no page errors or failed network requests. HTTP 404 responses are not transport failures.
- Added only `<link rel="icon" href="data:,">` to `transpile/index.html`. This prevents the implicit request without inventing artwork or changing game assets, generators or consumers.
- Added `transpile/tests/app/favicon.spec.mjs`, a regression checking the empty icon declaration, absence of an HTTP favicon response and absence of console errors.
- Existing Phase 5 edits, including other changes already present in `transpile/index.html`, were preserved.

## Existing server and exact entry URL

- Server process remains PID **59919**, listening on `127.0.0.1:4179`; 59919 is the process ID, not a second server port.
- Its command is `python3 -m http.server 4179 --bind 127.0.0.1 --directory /Users/roberthowley/src/github.com/brooklyn-plumber-teaches-typing/transpile`.
- `http://127.0.0.1:4179/`: HTTP 200.
- `http://127.0.0.1:4179/?seed=1`: actual browser entry, HTTP 200.
- `http://127.0.0.1:4179/app/data.json`: HTTP 200.
- `http://127.0.0.1:4179/transpile/`: HTTP 404 when explicitly probed with curl, because this server already serves the `transpile/` directory as its root. This was not requested by the game and is separate from the reproduced browser error.
- No server was started, stopped, replaced or reconfigured.

## Actual UI checks

- Used a newly launched headless Chrome and a fresh nonpersistent browser context, not the user's browser connection, tabs or stored profiles.
- Loaded the real startup screen and used the existing `skipStartupUI` source-path helper, which sends real Space key events to consume the separate startup skip sites and reach menu.
- Created a temporary student through the visible browser form, goal 30, to enable all four worlds. Saves were confined to the disposable context.
- Used real Playwright key events and read-only `translationSnapshot()` observations; no controller mutation, synthetic DOM key dispatch, clock mocking or storage injection.
- Every row below continued through real Escape to results, then M back to menu, in the same fresh context.

| Activity | Observed source code | Real key | Correct count | Errors |
| --- | --- | --- | --- | --- |
| Outside | 70 (`F`) | `f`, accepted case normalization | 0 → 1 | 0 |
| Water | 102 (`f`) | `f` | 0 → 1 | 0 |
| Castle | 65 (`A`) | `A` | 0 → 1 | 0 |
| Practice | 84 (`T`) | `T` | 0 → 1 | 0 |

- Before-change UI smoke: 2026-11-11T17:30:03.551Z through 17:30:12.469Z, all activity checks passed, favicon 404 captured.
- After-change strict UI smoke: 2026-11-11T17:30:43.987Z through 17:30:49.100Z, all activity checks passed, **32 responses, all HTTP 200, zero console messages, zero page errors, zero failed requests, no favicon HTTP request**.

## Commands and reusable evidence

Commands were run through `structured_return` from the repository root:

```sh
LIVE_DIAGNOSE=1 LIVE_EVIDENCE=live-server-before.json node --test transpile/.tmp/live-server-smoke.test.mjs
node --test transpile/.tmp/live-server-smoke.test.mjs
PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/.tmp/live-server-favicon.xml node_modules/.bin/playwright test -c transpile/.tmp/live-server.config.mjs --reporter=junit
```

- Results: diagnostic smoke 1 passed, strict smoke 1 passed, focused favicon regression 1 passed.
- `transpile/.tmp/live-server-smoke.test.mjs`: reusable live smoke; defaults to the existing server, never launches a server. Supports `LIVE_URL` and `LIVE_EVIDENCE` overrides.
- `transpile/.tmp/live-server-before.json`: complete before-change URLs/statuses, console source location, page errors, failed requests and UI checkpoints.
- `transpile/.tmp/live-server-evidence.json`: complete after-change record with the same fields.
- `transpile/.tmp/live-server.config.mjs`: focused Chrome regression configuration with no `webServer` hook, so it cannot replace port 4179.
- `transpile/.tmp/live-server-favicon.xml`: regression JUnit result.
- `git diff --check HEAD -- transpile`: passed after source/test changes.

## Exact successful browser URLs after change

All returned HTTP 200:

```text
http://127.0.0.1:4179/?seed=1
http://127.0.0.1:4179/app/style.css
http://127.0.0.1:4179/app/main.mjs
http://127.0.0.1:4179/app/session.mjs
http://127.0.0.1:4179/app/render.mjs
http://127.0.0.1:4179/recovered/control/student.mjs
http://127.0.0.1:4179/recovered/control/menu.mjs
http://127.0.0.1:4179/recovered/control/report.mjs
http://127.0.0.1:4179/recovered/control/flow.mjs
http://127.0.0.1:4179/recovered/control/results.mjs
http://127.0.0.1:4179/recovered/worlds/water.mjs
http://127.0.0.1:4179/recovered/worlds/castle.mjs
http://127.0.0.1:4179/recovered/runtime/runtime.mjs
http://127.0.0.1:4179/recovered/outdoor/outdoor.mjs
http://127.0.0.1:4179/recovered/control/startup.mjs
http://127.0.0.1:4179/recovered/control/scoring.mjs
http://127.0.0.1:4179/recovered/worlds/routines.mjs
http://127.0.0.1:4179/recovered/control/celebration.mjs
http://127.0.0.1:4179/app/celebration-render.mjs
http://127.0.0.1:4179/app/startup-render.mjs
http://127.0.0.1:4179/app/castle-render.mjs
http://127.0.0.1:4179/recovered/render/render.mjs
http://127.0.0.1:4179/app/water-render.mjs
http://127.0.0.1:4179/app/menu-render.mjs
http://127.0.0.1:4179/app/report-render.mjs
http://127.0.0.1:4179/app/stats-render.mjs
http://127.0.0.1:4179/app/help-render.mjs
http://127.0.0.1:4179/recovered/worlds/tables.mjs
http://127.0.0.1:4179/app/data.json
http://127.0.0.1:4179/assets/app/MOUT.backgrounds.indices
http://127.0.0.1:4179/assets/app/LOUT.backgrounds.indices
http://127.0.0.1:4179/assets/app/POUT.backgrounds.indices
```

## Limits

- Did not rerun Phase 5 full suites. Their independent 272 Node / 32 Chrome passing results remain documented in `PHASE-5-VERIFICATION.md`; the new favicon test was run separately.
- This smoke verifies real source-key entry, one correct increment and early-exit/results/menu routing per activity. Natural unskipped startup timing and complete lessons are outside this retry's scope.
- No original archive code execution or emulation, audio work/playback, root edits, commits, pushes, wiki changes, delegation or task changes.

## Independent pre-Phase-5 commit gate, 2026-11-11

**PASS.** The live smoke was rerun against the existing port 4179 server without starting, stopping, or replacing it. All four activities accepted their observed exact source key, incremented correct from 0 to 1 with zero errors, then Escape reached results and M returned to menu. Strict smoke recorded no required failures, console errors, page errors, or failed requests. The favicon regression passed on a separately served port 4198. The HTML addition is exactly `<link rel="icon" href="data:,">`; no asset path or source resource publication was added. Existing Phase 5 HTML copy remains as it was before this favicon-only change.

| Claim checked | Exact command or source | Result | Decisive detail |
| --- | --- | --- | --- |
| Existing-server UI smoke | `node --test .tmp/live-server-smoke.test.mjs` (cwd `transpile/`, via `structured_return`) | Pass, 1 passed | `transpile/.tmp/live-server-evidence.json` has `passed: true`, all four key/score/result/menu sequences, empty `badResponses`, console, pageerrors and requestfailed; 4179 still PID 59919. |
| Separate-port favicon test | `TRANSLATION_PORT=4198 PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/.tmp/favicon-independent.xml node_modules/.bin/playwright test -c transpile/playwright.config.mjs --grep 'entry uses an empty authored icon' --reporter=junit` (repo root, via `structured_return`) | Pass, 1 test, 0 failures/errors/skips | JUnit reports one test and zero failures; test server on 4198 exited, existing 4179 remained PID 59919. |
| HTML incremental change and publication boundary | `git diff HEAD -- transpile/index.html`; `git diff --name-only HEAD -- transpile/assets` | Pass | The favicon insertion is one `<link>` using inline empty data; asset-path diff is empty. The other index content changes are the already-existing Phase 5 updates, preserved. |
| Whitespace integrity | `git diff --check HEAD -- transpile` | Pass | No whitespace errors. |

The independent gate did not rerun the Phase 5 full suites, as requested. It made no source/config edits and did not run, emulate, or play audio from original code; no commit, push, wiki, or task action was taken.
