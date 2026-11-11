# Phase 5 independent verification

## Verdict

**PASS for the interrupted Phase 5 verification.** The timeout correction matches the pinned source branch behavior, and fresh full Node and Chrome suites pass. This verifies translated code and static archive-byte evidence, not equivalence from running the original program.

## Evidence

| Claim checked | Command or source | Result | Decisive detail |
|---|---|---|---|
| Timeout bypasses input poll | `transpile/tests/outdoor/outdoor.test.mjs`, test `pinned archive timeout branches bypass the input poll and reach original ending states`; translated logic at `transpile/recovered/outdoor/outdoor.mjs:268-272` | Pass | Test reads ZIP bytes as data and checks archive SHA256 `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`, `MARIO.EXE` SHA256 `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc0060357e4720f5e`, branch bytes and relative destinations. FILE `0x13aaa` jumps to `0x13b89`, bypassing poll at `0x13aaf`; below-limit branches reach poll. |
| Equality/greater/below behavior protects queued keys and Demo RNG | `transpile/tests/outdoor/outdoor.test.mjs`, elapsed 119/120/121 tests | Pass | Poll runs once below limit only, after world updates. At/equal-above timeout, queued Esc/second key remain unconsumed, Demo countdown/RNG remain unchanged, while update and end-state behavior is retained. |
| Full Node tests | `TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs` | Pass | 272 passed. |
| Full Chrome tests | `TMPDIR="$PWD/transpile/.tmp" TRANSLATION_PORT=4197 PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/.tmp/phase5-resume.xml node_modules/.bin/playwright test -c transpile/playwright.config.mjs --reporter=junit` | Pass | 32 passed; JUnit reports 32 tests, 0 failures, 0 errors, 0 skipped. Used port 4197; existing port 4179 remained untouched. |
| Whitespace and generated-output scope | `git diff --check HEAD -- transpile`; `git status --short --ignored -- transpile/.tmp/phase5-resume.xml transpile/reports/browser/artifacts`; `git check-ignore -v transpile/.tmp/phase5-resume.xml` | Pass | Diff check clean. JUnit output is ignored under `transpile/.tmp/`; browser artifacts are ignored. Existing Phase 5 worktree changes remain, no source/config changes were made during this verification. |

## Python checks and limits

The existing Phase 5 record `transpile/reports/PHASE-5-VERIFICATION.md` before this rerun documented 33 passing Python checks (19 asset, 5 render, 9 app/build-data). They were not rerun because their producer/code paths were unchanged; this is prior evidence, not a fresh result.

No archive program was executed, emulated, or loaded as code. Source claims are limited to static byte spans from the hash-verified archive and behavior of newly authored translated code/tests. Native DOS/BIOS timing, hardware, audio, and full original-program differential behavior remain unverified. No files outside this report and the ignored test output were intentionally written by this verification; no commit, push, delegation, wiki, or task changes were made.
