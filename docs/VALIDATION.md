# Integration validation

## Direct MAINMENU reconstruction follow-up, 2026-11-10

The user has replaced the `TITLE → GREET welcome → browser menu` flow with a direct `TITLE → reconstructed MAINMENU` handoff. The follow-up test/documentation work adds browser-helper migration, title handoff assertions and `tests/browser/main-menu.spec.js` coverage for reference pixels, 8:5 geometry, controls, commands, settings persistence and deferred Next. It also updates the current-flow docs and records the decision after D8.

The source and browser changes are integrated in the current worktree. From starting HEAD `1e8925dcab3288a49111924d24506d320cc28ea4`, source-backed Node tests passed **61/61, zero skips**; the private Vite build succeeded (one large-chunk warning). Focused title/menu Playwright passed **33/33**, then the full browser suite passed **82/82, zero skips** against `.tmp/title-menu-validation/dist` on port 4191. JUnit and command logs are `.tmp/title-menu-validation/{focused,browser}.{xml,log}`; build identity and source hashes are in `build-evidence.json`. Fresh screenshots include `.tmp/test-results/playwright/main-menu-MAINMENU-keeps-i-bd726-and-hit-regions-at-1280x720/main-menu-1280x720.png`, the File/Student/Lessons open-menu captures in the sibling dropdown test directory, the named greeting capture, and six lesson-group captures. The retained references are read from the base repository via `ORIGINAL_FIDELITY_SOURCE`; no provenance skips were accepted. Tracked `dist/` was not used or changed. Automated integration and independent visual acceptance passed; human playtesting and accessibility review remain pending.

**Earlier-build record:** all six previous automated implementation and verification phases were complete. Their reports and test results describe the welcome→menu build only, not this reconstruction. They are not release approval, human-playtested status or DOS runtime validation.

## Direct level-entry follow-up, 2026-11-10

Normal activities 1–4 now use a user-selected hard cutover to original-first gameplay after an approximately 200 ms outgoing-menu fade. Reduced motion skips it. There is no normal-entry source chooser, loading screen or black hold. File → Help carries the historical notice and explains the generated route; Help's guided/custom browser options retain their source chooser and generated alternative. Labeled fallback records and generated practice remain unchanged. This bounded flow change does not claim full original gameplay parity.

Browser coverage updates normal-entry callers and checks pointer, numeric, Enter and Space activation; focus, unscored activation and transition input, exactly-once results, transition clock timing, blur/hidden cancellation with clean restart, retry, course matching, the then-current access gates and NEXT. Those 10/30-WPM menu gates were later superseded by unconditional activity access; their mention here is historical, not current behavior.

- Integration checks: source-backed `LESSON_RESEARCH_ROOT=$PWD/research/executable-1992 ORIGINAL_FIDELITY_SOURCE=$PWD node --test tests/*.test.js` passed **61/61, zero skips**. Log: `.pi/structured-returns/6e8f48fa-b924-4ba9-a596-50a1048cb795.combined.log`.
- Private `vite build --outDir .tmp/level-entry-integrated-dist` succeeded with the large-chunk warning. Build log: `.pi/structured-returns/6aaa256a-e650-4aae-b20c-581f6b3777d2.combined.log`.
- Production Playwright on port **4203** passed **56/56 focused**, then **92/92 full-suite**. Actual JUnit testcase elements were checked: **zero failures, errors or skips** in both `.tmp/level-entry-integrated-validation/{focused,full}.xml`. No repair reruns were needed.
- Fresh screenshots: `.tmp/level-entry-integrated-validation/screenshots/` contains 14 captures covering normal/reduced motion at 1280px and 390px, gameplay, Help notice and Help source options. `no-preference-*-fade.png` freezes the production CSS transition at 100 ms for a deterministic illustration, not a wall-clock timing measurement. The full-suite screenshots remain under `.tmp/level-entry-integrated-validation/full/`.
- `git diff --check` passed. Existing dirty `dist/` file hashes and git status exactly match `.tmp/level-entry-fanout/dist-before.json`; the pre-existing README diff was also preserved.
- Independent acceptance passed: the [verifier](/Users/roberthowley/.pi/subagent-runs/20261110T191655Z-2r3ruyy6/01-verifier.md) reran **61 Node tests and 92 browser tests**, with zero failures or skips, against a fresh `.tmp/level-entry-independent-dist` build on port 4204. Browser evidence: `.tmp/level-entry-independent-junit.xml`.
- The [independent code and visual review](/Users/roberthowley/.pi/subagent-runs/20261110T191655Z-2r3ruyy6/02-second-opinion.md) returned **LGTM**, inspected all 14 captures, and found no in-scope blocker. These are automated checks and agent screenshot inspection; human playtesting and accessibility review were not performed.

## Current fidelity build, 2026-11-10

- Final independent reports: [production verifier](/Users/roberthowley/.pi/subagent-runs/20261110T045947Z-zo1h2pya/01-verifier.md), [visual second opinion](/Users/roberthowley/.pi/subagent-runs/20261110T045947Z-zo1h2pya/02-second-opinion.md), [bundle/documentation verifier](/Users/roberthowley/.pi/subagent-runs/20261110T045947Z-zo1h2pya/03-verifier.md), all PASS (visual verdict LGTM).
- Independent production replay: **51 passed, zero failures/skips**; all four tracked/served file hashes match. Evidence: [final-verifier/](../.tmp/fidelity-validation/final-verifier/).
- Independent Node run: **59 passed, zero failures, two optional provenance skips**. Separately, the coordinator subsequently reran `LESSON_RESEARCH_ROOT="$PWD/research/executable-1992" ORIGINAL_FIDELITY_SOURCE="$PWD" node --test tests/*.test.js` via `structured_return`: **61 passed, zero failures/skips**. These are distinct runs; the independent run is not source-verification proof.
- Fresh agent visual review: **46 screenshots**, all four modes and three characters at desktop, 720px and 390px, PASS. Evidence: [final-visual/review.json](../.tmp/fidelity-validation/final-visual/review.json). Native browser zoom, screen-reader listening and human play remain untested.

- Phase 5 independent replay: **61 Node and 38 browser tests passed, zero skips**. Reports: `/Users/roberthowley/.pi/subagent-runs/20261110T043125Z-c8wng0kz/01-verifier.md` and `02-second-opinion.md` (same directory). Earlier phase evidence is in the [phase ledger](FIDELITY-DECISIONS.md#phase-acceptance-ledger).
- Final integration rebuilt tracked `dist/` with `./node_modules/.bin/vite build`, then reran the reviewed static audit. Private runner output and tracked output have identical hashes. HEAD is `9a42074703b5f445240378d8ca033c4ef11e8143`, **with dirty source changes**, not a HEAD-only reproducible build.
- Exact source/dependency hashes (22 files), build hashes, source status, archive identity and record-level selector coverage: [final bundle-audit.json](../.tmp/fidelity-validation/phase6-final/bundle-audit.json). Re-run the retained repository-owned audit with `FIDELITY_AUDIT_OUTPUT=.tmp/fidelity-validation/phase6-final/bundle-audit.json node .tmp/fidelity-validation/audit-bundle.mjs`. The earlier root audit remains intact.
- Source-backed corpus/art recheck: **21 passed, zero failures/skips**. Log: `.pi/structured-returns/093c1f3a-37d6-4970-9823-51deed5cf838.combined.log`. No archive program, archive script or audio was executed.

### Production artifact inventory at the Phase 6 checkpoint

The following table records that checkpoint's four-file build. The later three-fix preview build has a separate six-file HTTP identity record under `.tmp/three-fixes-integration/preview-identity.txt`.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `dist/index.html` | 455 | `5eb5440bb4c20af022d00795336969b254ded582b70b6909f23ab299e153cde0` |
| `dist/assets/index-Drf9fmbt.js` | 2472220 | `209ebd81d37684145c482f6c35d9644ed8f46214f2befaa0450c1ff39880a213` |
| `dist/assets/index-DYeVULVd.css` | 28360 | `5b92c43eb155e825245e166f113c96e93cb9723b81f10294273dd5ca7d9e6b74` |
| `dist/assets/hud-texture-CKXA8tq2.svg` | 6928 | `00b8e1baa68751056c5184a292916e4aae267d6ad45b14981179a2ea23d129c7` |

### Static audit scope and results

| Check | Result and method |
|---|---|
| Runtime dependency contents | PASS: traced all 16 local JS/JSON/CSS/SVG dependencies from `src/app.js`, including CSS URLs; inspected all four output files and parsed the production JS without executing it. |
| Selected static art | PASS: all **20 backgrounds and 166 sprites/glyphs** match source raster object hashes in the actual bundle, including JSON.parse-packed data. No screenshot-derived title or old traced-art imports. |
| Reviewed corpus | PASS: all **136 learner strings** from 15 members occur in the actual bundle; source-backed tests verify member, record-span and transformed-text hashes. Raw corpus/research and provenance manifests are not runtime imports. |
| Executable/unreviewed payload exclusion | PASS within the inspected dependency graph and output: no archive EXE, driver, installer, script, compressed archive, DOS decoder or runtime archive reader; no unreviewed archive resource imported. Base64 palette-indexed static pixels are permitted data, not archive code. |
| Local assets | PASS static URL/import inspection: no external runtime asset URLs. The SVG namespace `http://www.w3.org/2000/svg` is present but is not a request. Documentation/source-reference URLs are not runtime dependencies. Final HTTP byte checks pass for every output file; the production welcome records same-origin-only browser requests. |
| Provenance | PASS: retained ZIP SHA-256 is `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`; source-backed checks compare selected raw members, palettes, sprite indexes and decoded-reference hashes. Hashes establish identity, **not rights**. |
| Sound and disclosure | PASS source inspection: oscillator synthesis only, no archive audio. Welcome/footer/settings/source captions disclose archive art, adaptations, unverified rights and synthetic sound. |

**Public redistribution rights: UNVERIFIED.** Decoded static art is approved for this implementation scope, not legally cleared for public redistribution. Palette bindings, masks, faces, placement and animation remain qualified in [Scene art](ART.md).

### Exact original-first coverage

Derived from `LESSON_COVERAGE` in `src/lessons.js`, not inferred from file names. Cells give **original/generated record counts**; O = original, M = mixed, G = generated. Groups correspond to H/T/B/N/S, then all-keyboard H→T→B→N→S.

| Mode / goal band | Home | +Top | +Bottom | +Numbers | +Symbols | All |
|---|---|---|---|---|---|---|
| Outdoor, all goals | O 27/0 | O 14/0 | O 15/0 | O 17/0 | O 5/0 | O 78/0 |
| Water, all goals | G 0/6 | M 2/5 | O 8/0 | O 7/0 | O 13/0 | O 41/0 |
| Castle, all goals | G 0/3 | G 0/3 | G 0/3 | M 1/3 | O 4/0 | O 17/0 |
| Practice, goals 1–9 | G 0/27 | G 0/14 | G 0/15 | G 0/17 | G 0/5 | G 0/78 |
| Practice, goals 10–29 | G 0/6 | G 0/7 | G 0/8 | G 0/7 | G 0/13 | G 0/41 |
| Practice, goals 30–150 | G 0/3 | G 0/3 | G 0/3 | G 0/4 | G 0/4 | G 0/17 |

- Water preserves TWORDS records 1–2; records 3–7 are generated. All six HWORDS records are generated for home row.
- Castle preserves only NSENTENC record 2 for the numbers group; records 1, 3, 4 are generated. All H/T/B sentence records are generated in their corresponding groups.
- All-keyboard action modes preserve every historical record. Practice substitutes generated text for every record because scored wrapping/separators remain unresolved. An explicit generated alternative uses one generated record in every mode/group.
- Mixed sequences conservatively store `source: 'generated'`, with per-record source and a mixed label. No unavailable characters are silently filtered from historical records. The visible notice names outdated claims, war, slavery, assassination and disasters.
- Source-order cycles and retry from the first record are deterministic browser choices, not recovered original randomness. Correct acceptance alone advances the engine's record/character cursor.

### Current rules and remaining historical limits

- WPM is `floor(max(0, correct-errors)*182/ticks)`; accuracy is `floor(100*correct/attempts)`, zero without attempts. Ticks are `floor(activeSeconds*182/10)`. **G1** still lacks exact DOS sampling/pause conversion.
- Timeout, positive attempts, goal WPM, at least 90% accuracy and no failure establish browser eligibility. First eligible guided result becomes immutable pending progress; explicit Next commits once. Retries/reloads cannot replace it. **G2** original guards, award semantics and Next timing remain incomplete.
- Stages 1–5 advance key group. At stage 6, achieved WPM raises goal by +2 capped at 10 outdoors, +5 capped at 30 in water, and +5 capped at the browser's 50-WPM assessment in castle. World changes reset to home row; same-world increases retain all-keyboard. Transition awards occur on Next; the eligible goal-50 castle assessment awards graduation once.
- Save v2 (`typing-kingdom-v2`) supports non-destructive New/Load/Edit local student slots. Migration preserves v1 bytes and read-only results/awards, archives the old course position, and starts fresh at 5 WPM/home row. Rankings stay separate; corrupt/unavailable storage is not overwritten and session-only/recovery status is visible.
- **G3** retains the precise generated gaps above; raw controls are separate from learner text. **G4** lacks browser hazard-state/terminal mapping: all early deaths remain disabled. Results expose timeout reason and actual active elapsed time separately from configured limit.
- Scrolling/contact, explicit pause/resume, reduced motion and custom/practice isolation remain browser choices. The current flow is direct TITLE→MAINMENU, then normal original-first level entry with an approximately 200 ms fade. All four activities are available to new and existing students at every configured goal. The goal still controls guided course routing and pass requirements; an off-course result remains ineligible. Default limits are 120/300/300/600 active seconds; overrides are supported.

### Current access, renderer and student-control decisions

- All four activities are accessible for new and existing students at every configured goal. This explicitly supersedes the former browser 10/30-WPM menu gates; DOS Help's historical gate evidence is preserved. Access changes no saved goal, key group, course position, results, pending progress or certificates. Only an exact matching guided result earns course progress or certificates; Next stays earned-only.
- OUTSIDE draws fixed sky `(0,0,320,140)` and soil `(0,156,320,44)`, repeating only pavement `(0,140,20,16)` every 40 canvas pixels. Rectangles are `(x,y,width,height)`. The 3-native-pixel/s cadence (6 canvas px/s at 2× scale) is an estimate from footage, not original timing. WATER is fixed; Castle, Practice, gameplay movement and metrics are unchanged.
- PREFS Done is the existing static artwork. The unchanged LOAD Cancel crop `[180,157,236,174)` is placed at `[208,178,264,195)` as a browser adaptation. Transparent semantic controls provide form submit/cancel, visible focus and at least 44 CSS-pixel targets. Exact original hit bounds, pressed states and timing are not claimed.

### Reproduce and complete the evidence

```sh
npm ci
npx playwright install chromium # if no supported local Chrome executable
LESSON_RESEARCH_ROOT="$PWD/research/executable-1992" ORIGINAL_FIDELITY_SOURCE="$PWD" node --test tests/*.test.js
./node_modules/.bin/vite build
node scripts/fidelity-validation.mjs # private production build, complete browser suite, JSON/JUnit/traces
```

The source-backed tests need the retained ignored research directory; omit those environment variables only when accepting skipped provenance checks. Playwright serves `dist/` over HTTP with strict port binding and no server reuse. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` or `CHROME_PATH` selects a local browser. Deterministic keyboard replay/fake-clock time is automation, not measurement of human typing speed. Some rendering tests intercept source modules, so they are not production-bundle proof by themselves.

### Phase 6 integration evidence

- **51 browser tests pass, zero failures/skips**: existing 38, six full-course/identity regressions and seven focus/geometry regressions. Bounded run: `FIDELITY_EVIDENCE=.tmp/fidelity-validation/phase6-bounded node scripts/fidelity-validation.mjs --bounded`. Final complete run: `node scripts/fidelity-validation.mjs`.
- **61 source-backed Node tests pass, zero failures/skips** with the environment shown above; final log `phase6-final/node-source-tests.log`. A preliminary environment-free run passed 59 and skipped the two source checks; it is not the source-verification result.
- Both fresh-student routes traverse all six groups per world, odd 7/9 goals, world resets, exact-50 graduation and successful retry, then isolated practice, under normal and reduced motion. Separate 48→50 overshoot, returning missed outdoor target, deferred Next/reload, certificates/downloads and literal DOM names remain covered. Controlled keyboard events and fake active clocks, not human-speed measurement.
- Final evidence root: `.tmp/fidelity-validation/phase6-final/`. `browser.json`, `browser.xml`, `commands.json`, `traces/`, `course-{no-preference,reduce}.json`, certificate downloads, `screenshots/`, and `build-evidence.json` retain outcomes, browser version, source/ruleset/corpus/build hashes and same-origin welcome requests.
- `production-dist/` independently reruns the HTTP identity test against actual tracked `dist/` (one pass). `existing-http-identity.json` proves ports 4173 and 4175 serve the same final bytes. The stale Phase 5 preview at 4173 was replaced with a strict-port preview of `dist/`; unrelated historical worktree port 4189 was left untouched.
- Visual regression evidence includes 390px, 720px (200%-equivalent reflow, not native browser zoom) and 1280px practice, time controls, results/status, student/load/help/report and HUD captures. Component bounds, original panel percentages and nonblank DOM are asserted. Times and result panels scroll to retain readable text rather than shrink it; controls remain keyboard reachable.
- Focused interactive controls ignore all typing attempts while preserving native Space/Enter activation. Start, resume and closing keyboard help focus the typing surface. Practice DOM occupies its recovered white panel; results occupy the blackboard; time/student/help/report/certificate content occupies its corresponding panel. No raster/corpus/model rewrite.
- Pre-fix acceptance evidence is preserved in `acceptance-before-visual-fixes/`; the original root audit and `visual-review/` remain intact. `phase6-first-full/` retains the first complete integration run before the final time-control layout adjustment. Independent Phase 6 reviews subsequently passed; see the [final D1–D8 automated review](FIDELITY-DECISIONS.md#final-automated-review-2026-11-10).

### Three-fix integration, 2026-11-10

- Source-backed `ORIGINAL_FIDELITY_SOURCE=$PWD LESSON_RESEARCH_ROOT=$PWD/research/executable-1992 node --test tests/*.test.js`: **63 passed**. Private Vite build `.tmp/three-fixes-integration/dist`: passed.
- Full production-browser suite on port **43814**, serving that private build: **105 passed, 0 failures, 0 errors, 0 skips**. JUnit: `.tmp/three-fixes-integration/browser-junit.xml` (105 testcase elements). Source-backed captures: `.tmp/three-fixes-integration/evidence/screenshots/`.
- Inspected outdoor sky/soil across the old wrap, fixed WATER, and student-form captures at 390/720/1280px plus visible focus. These are automated Chromium captures and agent inspection, not human visual or accessibility approval.
- After checks, `bash scripts/restart-preview.sh` rebuilt local `dist/` and restarted preview at 4173. PID **52978** runs this repository's Vite preview. HTTP index and all five asset files return 200 and byte-match `dist/`; hashes are retained in `.tmp/three-fixes-integration/preview-identity.txt`.

### Human review record

**NOT PERFORMED.** No human keyboard playthrough, human visual/fidelity approval, assistive-technology listening session, audible sound review or physical print review is claimed. Automated keys, simulated clocks, print-dispatch assertions and agent screenshot inspection do not satisfy those reviews. No DOS executable was run. All six automated phases are complete with these omissions explicit; that is not public-release or human-playtested approval. Native browser-zoom UI review also remains NOT PERFORMED; 720px reflow checks are not native zoom.

## Historical validation below

The remaining entries describe superseded builds, rules, dimensions and assets. They are retained as provenance, not assertions about the current build. In particular, old five-character WPM, fixed 15-pass progression, screenshot title, 640×280 scene and three-file inventory no longer apply.

**Previous traced-art integration: build, 23 Node tests, 6 focused asset tests and 27 production browser tests passed.** Automated interaction and agent image inspection, not human manual play or human fidelity approval.

## Screenshot-tracing integration (2026-11-09)

- Integrated six bundles serially: title, characters, outdoor, underwater, castle, HUD. Shared functions match their assigned workers; engine/course/storage and reference originals are unchanged.
- Rebuilt shared `dist/`; verified all nine served build files against disk hashes, twelve underwater images loaded and all gameplay canvases remain 640×280.
- Evidence includes desktop/mobile/menu/results, four modes, pause/resume, reduced motion, normal-clock outdoor action, pipe/quicksand and animation contact sheets.
- Details, reproduction and remaining gaps: [`../artifacts/integration/REPORT.md`](../artifacts/integration/REPORT.md). Source crops, edits and bundle evidence: [`../artifacts/integration/provenance-index.json`](../artifacts/integration/provenance-index.json).
- Art now includes screenshot traces/edits. Older assertions below about wholly newly drawn art or a three-file build describe earlier versions only.

## Previous title and scrolling integration (2026-11-09)

- Recovered retained commits serially as `44b5b91` (title) and `84ed9da` (scrolling), preserving all worker evidence/videos. No conflicts or cleanup. Course/storage bytes remain identical to `270184b`.
- Dedicated title art is separate from gameplay. Outdoor has six stable-ID slots, continuous active-time travel, one buffered exact key and nearby contact actions; missed targets return without penalties. Water/castle travel continuously; practice stays plain. Pause/finished/hidden/pipe freeze time and movement; resume resets the wall-clock baseline.
- Removed the hidden 144 px/s cap: speed is `max(72, goal * 12)`. The original 5–12 WPM feel is unchanged. Tests prove achievable 30/75/150 WPM custom goals over 120 seconds without changing goals or pass math. Very short overrides may expire before contact; goal-5 first contact is about 4.292 active seconds.
- Full Node and production-HTTP Playwright suites ran serially. The initial combined browser run found the title worker's one-second immediate-input fixture incompatible with normal-motion contact; it now explicitly uses reduced motion without weakening assertions. Added a separate 20-second normal-clock guided outdoor pass/Next/reload test. Final totals: 23 Node, 27 browser, no failures.
- `artifacts/title-scrolling-final/capture.mjs` separately captured normal-motion production UI at live preview 4175. Guided result: 10 correct, 0 errors, 100% accuracy, 6.0 WPM over exactly 20 active seconds; wall duration 21.022 seconds includes an 800 ms explicit pause and capture overhead. Pending Next survives reload; advancing then reloading retains Add top row with Next disabled.
- New evidence includes 1440/1280 desktop and 390 mobile menus, native title, approach/action strips, pause/resume, water/castle motion pairs, practice and `normal-clock.webm`. `evidence.json` records exact HUD samples, saved result, asset hashes, no page errors and no external runtime requests. Index: [`../artifacts/title-scrolling-final/index.html`](../artifacts/title-scrolling-final/index.html).
- Live HTML/JS/CSS/SVG all match disk SHA-256. JS `assets/index-N7oAXKDb.js`: `1a86560a82932dee4dd76e29e431a29b64f4a0f83f568efe037d0735bfc5a529`. Existing preview PID 1164 remains running.
- Inspected final native title, desktop/mobile menu, source/before title comparison and outdoor motion strips. Seated pose, V-sign, desk and ensemble composition are much closer to the supplied illustration than the earlier reused sprites; shading, hair and Luigi foreshortening are still approximations, not a pixel match. Motion frames show the same star/object approaching the runner, then local debris, rather than a replaced stationary target row.
- Historical component/worker evidence below is unchanged and describes earlier builds. The full 15-pass real-clock course was not repeated; the full progression tests remain, explicitly reduced motion where immediate input is required. No human manual playtest is claimed.

Reproduce: `npm run build`; `node --test tests/*.test.js`; `PLAYWRIGHT_JUNIT_OUTPUT_FILE=artifacts/title-scrolling-final/browser-results.xml npx playwright test --reporter=junit`; serve dist on 4175; `node artifacts/title-scrolling-final/capture.mjs`; `python3 artifacts/title-scrolling-final/gallery.py`.

## Previous combined component pass (2026-11-09)

- Cherry-picked all six workers serially onto `8255698`: characters `8f2f957`, outdoor `f63c178`, underwater `cb6eaf8`, castle `4050081`, HUD `9fcb045`, menus `3304089`. Git merged shared files without conflicts. Reviewed function boundaries and scoped CSS; All worker/shared function bodies remain exact except the reviewed one-line castle transit visibility correction. The verifier checks that exact exception, not a broader exclusion.
- `src/engine.js`, `src/course.js` and `src/storage.js` remain byte-identical to `8255698`, checked by `artifacts/component-final/verify.mjs`. Build passed; all 13 Node tests and all 18 unchanged production-HTTP Playwright tests plus the new pipe-visibility test passed. The new test renders engine-generated inside/resumed states with Mario and Luigi: their images must be identical while concealed and different after Resume, without stored image snapshots. Browser suite runs serially on 4173. Node JUnit puts testcase elements directly under testsuites, so use the text report for the count.
- Browse [`../artifacts/component-final/index.html`](../artifacts/component-final/index.html), in the local, Git-ignored evidence directory. Its 25-category `matrix.json` links original exemplars, preserved worker before frames, combined after images and actual production screens. All 75 displayed images decoded in Chromium. Source gallery remains read-only at `research/video-dJP7FTvGETM/components/index.html`.
- `capture.mjs` produced 22 full-page production captures and 10 native scene exports: all four modes at 1280×900, 1440×900, 1366×768 and 390×844, plus typed actions, pipe pause and resumed quicksand. Assertions cover scene dimensions, target/finger agreement, layout boundaries, visible controls and no overflow.
- `details.mjs` added 18 production UI captures: title/menu, three character choices, desktop/mobile results/report, all three underwater characters, opposite Shift, normal finger, both thumbs, keyboard help and actual-keyboard block/flip effects. It checks six groups, three choices, guided pass, Next and reload. Ten separately labeled `fixed-*.png` source-module captures check immutable state and pause/finish/reduced-motion freezing. These are not mislabeled as production bundle renders.
- Inspected all six worker comparison boards, all eight supplied screenshots, selected original exemplars from all 25 categories, and combined production/native images. Horizontal swimmers fit between fish and squid without intersecting seabed rocks. Castle sand covers the lower body continuously; the pipe route now conceals the inside actor, matching the reference and pause explanation. Refreshed pipe and resumed-quicksand native images were inspected through the image tool. Shared head drawings fit title, choices and teacher canvases. Gameplay and menu CSS remain separately scoped. Independent review identified the exposed transit actor; only that renderer condition changed.
- Fixed outdoor/water/castle comparisons match worker state and active animation time; source-video poses never match exactly. The Mario running baseline differs in pose/state. UI source layout, target and timing also differ. Luigi, Peach and Toad video evidence is title-only; their playable poses remain original approximations.
- The earlier unyielded underwater sample was median/p95 3.9/37.4 ms. Follow-up `water-performance.json` measures quiet serial Chrome with 30 warmups and 120 draws per state, yielding each frame: two batches across progress 0/30/75 and reduced motion gave medians 4.0–4.6 ms, p95 4.6–5.0 ms, maximum 10.3 ms. Actual production RAF callbacks (including DOM updates), 120 each at progress 0/30/75, gave median/p95/max 4.0/4.5/4.7, 4.2/5.0/5.3, and 4.2/4.7/4.8 ms. All warmed canvas allocations were zero. The earlier <2 ms baseline was not reproduced, but neither were the >16 ms tails. No consistent frame-budget issue was observed, so underwater art is unchanged and no speculative cache was added. These measurements are not an FPS or human-visible-jank guarantee. `checks.json` retains the refreshed original unyielded measurement method.
- Preview `http://127.0.0.1:4175/` was left running. HTTP HTML and every current JS/CSS/SVG asset match disk SHA-256 (`verification.json`). Current bundle is `assets/index-owBAesP-.js`, SHA-256 `482167a57fa7f76c90e3648fe5eb78915dc75a3431739ec52defc19f9534baff`; CSS is `assets/index-B06W19ze.css`. No external runtime asset requests or page errors occurred.
- Remaining fidelity gaps: rounded character torsos, no detached cap, geometric rock/cloud details, one pipe route, gameplay poses reused in the title, a small teacher red brim, and 100-character practice preview rather than the source nine-row drill. Source pixels are evidence only, never runtime assets.
- All evidence is automated interaction plus agent visual inspection, not human manual play. The historical normal-clock 15-pass exploration was not rerun; existing course tests did run. Historical screenshots overwritten by baseline tests were restored.

Reproduce from the repository root with current `dist/` served on 4175:

```sh
npm run build
node --test tests/*.test.js
PLAYWRIGHT_JUNIT_OUTPUT_FILE=artifacts/component-final/browser-results.xml npx playwright test --reporter=junit
node artifacts/component-final/capture.mjs
node artifacts/component-final/details.mjs
node artifacts/component-final/water-performance.mjs
python3 artifacts/component-final/gallery.py
node artifacts/component-final/verify.mjs
```

Reports, scripts and captures are under `artifacts/component-final/`. `gallery.py` requires the read-only research collection at the path above. The index itself works without JavaScript; open locally for file links. All historical component and graphics evidence remains intact.

## Previous combined graphics pass (2026-11-09)

- Integrated art `f33a717` and HUD `477cb45` onto `df05483`; `src/engine.js`, `src/course.js` and `src/storage.js` are unchanged.
- Shaded sprites, clouds/sun, thin stone walkway and textured castle walls/teal spiked foes replace the simpler scenery. The brown bottom HUD owns gloves, target and statistics; the renderer adds no duplicate headings or instructional cards.
- Adapted the Node drawing mock for cached secondary canvases. Moved graphics-suite screenshots to `.tmp/test-results/graphics/` so reruns do not overwrite private worker evidence.
- All four modes fit without scrolling at 1280×900, 1440×900, 1366×768 and 390×844. Captures assert the 640×280 canvas, strip above scene, HUD below scene, visible controls, equal strip/HUD target and two gloves. Mobile captures use reduced motion.
- Inspected combined outdoor, castle, underwater, practice, mobile, Shift, space, pipe and quicksand images. Outdoor `d`/`r` match the starred object; castle `T`/space/`!`/`R` match the HUD and finger guide. No overlapping scene/HUD boundaries or duplicate text panels were found. Practice retains a compact, letterboxed portrait rather than a full action scene.
- Captures use current `dist/` at `http://127.0.0.1:4175/`, not either worker's private build. `capture.mjs` checks HTTP HTML against disk, verifies the served JS SHA-256 and confirms each page requested `assets/index-B1EAf3I7.js`. No page/console errors or external asset requests were observed. The existing port-4175 server was left running.
- Newly drawn art is closer to the DOS references but remains an approximation: character proportions, cloud shading, gloves, animation and typography are not pixel-exact. Small scenery letters on mobile rely on the larger DOM target; no touch keyboard is implemented.

### Reproduce previous graphics checks

```sh
npx vite build
node --test tests/*.test.js
PLAYWRIGHT_JUNIT_OUTPUT_FILE=artifacts/graphics-final/browser-results.xml npx playwright test --reporter=junit
# In another terminal if port 4175 is not already serving dist/:
python3 -m http.server 4175 --bind 127.0.0.1 --directory dist
node artifacts/graphics-final/capture.mjs
```

Results: `artifacts/graphics-final/build.log`, `node-results.log` and `node-results.xml` (13 passed), `browser-results.xml` (18 passed), `evidence.json` (22 full-page captures, 10 native-stage exports, measured boundaries and asset hash). Node's JUnit output lists 13 testcase elements directly under testsuites; its comments report pass 13/fail 0.

Representative previous graphics screenshots, all under `artifacts/graphics-final/`:

| View | File |
| --- | --- |
| Outdoor Mario and action | `outdoor-1280x900.png`, `outdoor-action.png` |
| Castle Luigi, uppercase target and opposite Shift | `castle-1440x900.png` |
| Space target, both thumbs | `castle-action.png` |
| Underwater Princess | `underwater-1280x900.png` |
| Practice portrait | `practice-1280x900.png` |
| Pipe pause and resumed quicksand | `castle-pipe.png`, `castle-quicksand.png` |
| Short desktop | `castle-1366x768.png` |
| Mobile | `outdoor-390x844.png`, `castle-390x844.png`, `underwater-390x844.png`, `practice-390x844.png` |

Each mode also has all three desktop viewport captures. Native canvas exports use the `-stage.png` suffix. Supplied comparison images are preserved under `references/graphics-iteration/` and are not in `dist/`.

The previous normal-clock 15-pass exploration below was not rerun: gameplay models did not change, and the full existing progression/browser tests passed again. Worker-private evidence under `artifacts/graphics-art/` and `artifacts/graphics-hud/` is historical, not combined production evidence.

## Previous gameplay integration

**Previously passed: 13 Node tests, 7 production-HTTP browser tests, and a separate normal-clock Chrome playthrough of all four activities and all 15 guided passes.** These are agent-driven interactions, not a human playtest or a measurement of human typing speed.

### Reproduce previous exploration

From the project root with Node/npm dependencies installed:

```sh
npm ci
npm test
node --test --test-reporter=junit tests/*.test.js > artifacts/node-results.xml
npm run build
PLAYWRIGHT_JUNIT_OUTPUT_FILE=artifacts/browser-results.xml npx playwright test --reporter=junit
```

The browser suite starts production preview at `http://127.0.0.1:4173`. Six gameplay tests install Playwright's simulated clock and use browser keyboard events; tests that need elapsed time advance it explicitly. Blur and visibility events are dispatched, not physical window switching. The seventh test navigates with Tab/Enter/Escape using the normal clock.

Separate exploratory session, in two terminals:

```sh
python3 -m http.server 4174 --bind 127.0.0.1
node tests/explore.mjs
```

The exploration launches Chrome through Playwright, loads `http://127.0.0.1:4174/dist/`, reads visible targets and presses real keyboard keys. It never installs a fake clock, seeds course progress, or calls the game model. It clears localStorage once to start the fresh guided course. UI duration overrides are three seconds, except the six-second custom castle attempt. Escape and pipe pauses each include a real 1.2-second wait. See README for Chromium installation and executable overrides.

## Previous gameplay checks and evidence

| Check | Evidence |
| --- | --- |
| Exact keys, case, spaces, punctuation; ignored repeat/composition/modifier/shortcut keys | `tests/engine.test.js`, `tests/browser/outdoor.spec.js` |
| Timeout-only pass, exact goal and 90% boundaries, zero-attempt failure | Node boundary tests and browser pass/fail cases |
| Previous validation: four mode defaults; each of six key groups appeared in generated text for all four modes, with no outside-set keys | `tests/course.test.js` at that revision |
| Previous browser run: non-initial uppercase `Z` and symbol `@` reached in underwater and castle; castle pipe resumed | `tests/browser/outdoor.spec.js` at that revision |
| Active-time freeze, explicit resume, 40-character pipe, alternating chambers | Node model tests; simulated browser lifecycle tests; real-clock Escape/pipe exploration |
| Exactly 15 passes, pending Next reload, idempotent Next, custom isolation, failed retries | Course tests and production browser suite; separate fresh-profile real-clock course |
| Persisted character/settings/results/certificates/graduation; corrupt/blocked storage | Storage tests, browser suite, exploration reload and report |
| Renderer accepts engine states without mutation and changes on correct input | `tests/integration.test.js`, all modes and all three characters |
| Keyboard-only start/pause/resume/menu | `tests/browser/keyboard.spec.js` |
| Desktop and 390px layout, reduced-motion gameplay | `artifacts/final-menu.png`, `final-narrow-menu.png`, `final-narrow-reduced-motion.png` |
| Production subpath assets, no external requests or console/page errors | `artifacts/final-exploration.json` |

Durable results: `artifacts/browser-results.xml` (7 passed), `artifacts/node-results.xml` (13 passed), `artifacts/final-exploration.json` (four mode loops and 15 guided passes). New Playwright target screenshots go under `.tmp/test-results/playwright/`; the `artifacts/final-{underwater,castle}-key-drill.png` files remain historical captures from the earlier generated-drill behavior.

### Separate exploratory findings

- Outdoor Mario, underwater Luigi, castle Princess and practice Princess each passed with correct input plus one mistake, then failed a zero-input retry at timeout.
- Outdoor scenery/targets changed after typing; the wrong key left the target and correct count unchanged. Underwater showed swimming, clams and word progress; castle changed from Thwomps through pipe pause to quicksand; practice changed portrait feedback without platform scenery.
- An earlier production browser test typed non-initial `Z` and `@` targets in underwater and castle. Castle input paused at the 40-key pipe boundary and resumed before continuing. The two saved screenshots show the target, preview and text strips clearly.
- All 15 guided passes used 20 correct characters over three active seconds, yielding 80 WPM. Character choice rotated across Mario, Luigi and Princess. Next was disabled after each advancement.
- Reload with pending Next retained the unlock; reload after graduation retained graduation. Report contained 15 results and three certificates. Download saved as `artifacts/final-graduation-certificate.txt`.
- HTTP requests were only the local HTML, bundled JS and bundled CSS. `dist/` contains those three files only, with no reference screenshots, manual, external fonts or runtime images.
- Inspected screenshots directly: desktop menu, outdoor before/after/results, underwater after, castle pipe/quicksand, practice after, narrow menu/gameplay and graduation report. Yellow/purple cabinet, selected-character stand-ins, focus outlines and DOM targets remained readable. Narrow canvas captions are small; the larger DOM target and hints carry gameplay information.

Screenshots: `artifacts/final-{outdoor,underwater,castle,practice}-{before,after,results,failure}.png`, plus `final-underwater-key-drill.png`, `final-castle-key-drill.png`, `final-escape.png`, `final-castle-pipe.png`, `final-castle-quicksand.png`, `final-pending-next-reload.png`, `final-graduation.png`, `final-report.png` and layout screenshots above. The key-drill captures document earlier generated-drill behavior; phase-1 evidence remains historical, not the final validation.

## Previous integration decisions and fixes

- Both supplied patches passed `git apply --check` and applied without conflicts. Engine-owned `castleStage`, `pipe`, active elapsed time and correct count match the documented renderer contract.
- Fixed overlapping underwater completed-word text found by screenshot inspection.
- Added a data favicon after the exploratory HTTP run exposed an otherwise harmless browser favicon 404. The final rerun has no console errors.
- Default Vite base is relative; the complete course was exercised from `/dist/`, proving subpath loading rather than only root deployment.
- Added portable Playwright executable selection, renderer/input regression tests and keyboard-only browser coverage.
- Removed only the separator-only manual text extraction; retained the scanned PDF and every other source reference. Updated AGENTS and README accordingly. `.pi/` is ignored.

## Limits

- No human manual playtest, physical keyboard-layout certification, audible sound-quality review or physical printer test was performed.
- Browser lifecycle freeze is covered by simulated lifecycle events and model checks; real OS tab/window switching was not separately explored.
- Art/sound are newly drawn/synthesized stand-ins. Hazards cannot kill the player; practice intentionally has no moving platform character.
- Reload abandons an in-flight attempt; only completed results and course/settings persist. Records are local and not tamper-proof.
- No known failing acceptance behavior remains in the tested scope. Full default-duration sessions were not waited out in real time; defaults and long-time scoring are tested deterministically.
