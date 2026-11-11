# Phase 1 independent verification

### Verdict
**PASS** — the phase 1 source contracts hold, all 93 Node, 29 Python and 9 Chrome tests passed, and the browser run left the existing port 4179 server untouched.

### Acceptance criteria checked
- Retained Outside counters/last-second state and FONT7H binding match the documented source contracts; Water and Castle remain disabled.
- BGS scene clipping and render-manifest additions are consistent with their tests and do not enable world controllers.
- Local generation has no external research fallback; generated/original assets stay ignored and no project-root files changed.
- Node, Python asset/render/app and Chrome suites pass; `git diff --check` is clean.

### Evidence
| Claim checked | Command or source | Result | Decisive detail |
|---|---|---|---|
| Retained state and source binding | `transpile/app/session.mjs`, `transpile/recovered/outdoor/outdoor.mjs`, `transpile/analysis/runtime/REENTRY.md`, `transpile/tests/app/integration.spec.mjs` | PASS | Prior Outside is passed back into entry; bonus last-second survives; retained fields are copied while entry state resets. FONT7H is tied to the source data and has pixel/member checks. |
| Render records and world availability | `transpile/tools/render/decode.py`, `transpile/recovered/render/render.mjs`, `transpile/analysis/render/BGS.md`, `transpile/tests/render/{render.test.mjs,test_decode.py}` | PASS | BGS is four 320×129 scenes placed at y=26; inclusive clipping/strip bounds and decoded hashes are tested. No controller added. |
| Water/Castle disabled | `transpile/README.md`, `transpile/COVERAGE.md`, `transpile/app/session.mjs`, `transpile/tests/app/session.test.mjs` | PASS | Both remain visibly unavailable; render manifest records are not bundled as playable app worlds. |
| No research fallback | `rg -n '/Users/[^" ]+|research/executable|research/' transpile/tools transpile/app transpile/recovered transpile/tests --glob '*.py' --glob '*.mjs'` and `TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/app -p 'test_*.py'` | PASS | No research path in source. The missing-fresh-listing regression rejects stale evidence; app suite 5 passed. Tools do expect the documented hash-pinned ZIP under `$HOME/Downloads`. |
| Full Node tests | `TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs` | PASS | 93 passed. |
| Python asset/render tests | `TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/assets -p 'test_*.py'`; `TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/render -p 'test_*.py'` | PASS | 19 + 5 passed. |
| Chrome tests and port protection | `TMPDIR="$PWD/transpile/.tmp" PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/.tmp/phase1-verification-results.xml node_modules/.bin/playwright test -c transpile/.tmp/phase1-playwright.config.mjs --reporter=junit`; `python3` XML parse of that result; `lsof -nP -iTCP:4179 -sTCP:LISTEN` | PASS | JUnit XML says tests=9, failures=0, errors=0, skipped=0. Config uses port 4181. Existing port 4179 remains PID 59919 and returns HTTP 200. |
| Resource publication and whitespace | `git check-ignore -v` on original raw executable, original sprites, render manifest/pixels and app data; `git ls-files --others --exclude-standard -- transpile`; `git diff --check` | PASS | All derived resources checked are ignored; only three authored markdown files are untracked candidates. Diff check clean. `git status` shows changes only under `transpile/`. |

### Must Fix
None.

### Residual Risk
- The complete 2,402-file clean-input regeneration was recorded in `transpile/reports/PHASE-1.md`, not rerun in this independent gate. The app-data rebuild/idempotence and fresh-listing regression ran in the Python suite.
- Full controller sequencing, transition scratch compositor, intermediate palette fades and original-runtime differential behavior remain outside Phase 1 and are correctly disabled/unclaimed.
- Rebuild prerequisites remain a local compatible `objdump`, runtimes and the pinned archive at `$HOME/Downloads`; these are documented environment inputs, not research fallbacks.
