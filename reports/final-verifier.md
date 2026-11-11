### Verdict
**PASS** — The bounded app and verification checks passed; the original executable was not run. Full report: [`transpile/reports/VERIFICATION.md`](transpile/reports/VERIFICATION.md).

### Evidence

| Claim checked | Command or source | Result | Decisive detail |
|---|---|---|---|
| Workspace scope | `git status --short`; `git diff --exit-code -- .`; `git diff --cached --exit-code -- .` | PASS | Only `?? transpile/`; no tracked or staged changes. |
| Node tests | `TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs` | PASS | 80 passed. |
| Python asset/render/app tests | Commands and isolated app-suite invocation in report | PASS | 25 passed; app rebuild ran only in `transpile/.tmp`. |
| Chrome browser tests | `TMPDIR="$PWD/transpile/.tmp" PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/browser/results.xml node_modules/.bin/playwright test -c transpile/playwright.config.mjs --reporter=junit` | PASS | 8 passed. |
| Archive and long-session checks | ZIP SHA-256; 100 fixed-seed, 60-minute stress run | PASS, bounded | Expected archive hash; no signed-distance overflow in the stress sample. |

**Must Fix:** None.

**Residual Risk:** No DOS differential run. Signed-distance overflow and browser storage write-denial behavior were not exhaustively verified; Water and Castle remain intentionally unsupported.