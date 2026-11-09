# Integration validation

**Current traced-art integration: build, 23 Node tests, 6 focused asset tests and 27 production browser tests passed.** Automated interaction and agent image inspection, not human manual play or human fidelity approval.

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
