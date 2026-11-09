# Brooklyn Plumber Teaches Typing

A keyboard-first typing course with four activities, saved progress, report cards and downloadable certificates. Unofficial fan recreation, not an emulator or an original game release. No accounts, server API or external runtime assets.

The [gameplay fidelity audit](docs/GAMEPLAY-FIDELITY.md) compares original-source evidence with implemented behavior, fixed gaps and deliberate differences, including quicksand, practice expressions, outcomes and lesson text.

## Local research and evidence

`research/` contains the original research collection, including `video-dJP7FTvGETM/components/index.html`. `artifacts/` contains comparisons, provenance, captures and validation reports. Both directories, along with reference images and PDFs under `references/`, are Git-ignored and are not included in a fresh clone. Runtime artwork stays in `src/` and the production build in `dist/`.

The previous project and research directories were archived before migration. Historical reports retain their original paths and commit IDs; they describe the old checkout, not this repository's Git history. Local migration details are in `artifacts/migration/README.md`.

## Run

Requires Node.js 20+ and npm.

```sh
npm ci
npm run dev
```

Open the URL Vite prints. Select a character and start a guided lesson. Type the highlighted character, including spaces, case and punctuation. Escape pauses; Resume is explicit. Wrong keys count errors without moving the target. Action worlds scroll continuously. Outdoors, type the star as it approaches: one early/late exact key waits for contact; missed targets return without penalties. Reduced motion makes targets stationary and immediate. Higher custom outdoor goals increase speed, so water or practice can be easier to read. At goal 5 the first buffered contact takes about 4.292 seconds; shorter duration overrides may finish before any key counts.

- **Guided course:** activity, key group and WPM goal are chosen for you. Duration remains editable (1–3600 seconds).
- **Custom / practice:** choose any activity, key group and goal. These attempts never advance the course.
- **Next lesson:** unlocks after a guided pass. Select it to advance once; it does not start the next attempt. Pending Next survives reload, failed retries and custom play.
- **Report card & certificates:** review the last 50 attempts, print the report, or download earned certificates as text files.
- Settings/profile changes save when starting a lesson. Leaving a running lesson or reloading abandons that attempt, not previously earned progress.

## Build and deploy

```sh
npm run build
npm run preview -- --port 4173
```

Serve the contents of `dist/` over HTTP(S), not `file://`. Upload `dist/` to any static host. There are no server routes or secrets. The default build uses relative asset links, so the same directory works at the host root or a subpath. An explicit subdirectory deployment can also use:

```sh
npm run build -- --base=/typing/
```

Then serve `dist/` at `/typing/`. Alternatively `npm run build -- --base=./` produces relative asset links for a portable static directory. Local progress is specific to the browser and origin; moving hosts does not transfer it.

## Lessons and scoring

| Activity | Targets | Default active time |
| --- | --- | --- |
| Smash & Dash (outdoor) | Individual keys on objects | 120 seconds |
| Wet World Challenge (underwater) | Scrolling words | 300 seconds |
| Tunnel of Doom (castle) | Scrolling constrained sentences | 300 seconds |
| Expert Express (practice) | Plain constrained passages | 600 seconds |

Each mode remembers its duration override. Only correct characters advance. Printable mistakes count attempts/errors; spaces count. Modifier-only keys, Backspace, held-key repeat, composition and Ctrl/Meta/Alt shortcuts are ignored. Shifted characters are matched exactly.

WPM is `correct / 5 / active minutes`; accuracy is `correct / (correct + errors)`. At timeout, passing requires at least one attempt, the WPM goal and at least 90% accuracy, using unrounded values. There is no early victory, death or inactivity penalty. Escape, window blur and a hidden tab freeze input and time. Background time is never charged when explicitly resuming.

Castle alternates Thwomps and quicksand after every 40 correct characters. Each boundary pauses inside a pipe, with explicit Resume to enter the next chamber. This is a recreation decision, not a recovered original timing rule.

## Guided progression

Start at home row and 5 WPM. Five passes expand through the remaining key selections; passing all keyboard retains that group and raises the goal by 5 WPM. Outdoor is used below 10 WPM, underwater from 10, castle from 30. The 15th successful attempt is the 50-WPM all-keyboard castle graduation. Graduation is awarded at timeout without requiring a final Next. Practice and custom lessons remain available.

Certificates are awarded on Next when crossing outdoor → underwater and underwater → castle, and immediately on graduation. Failed or abandoned attempts never reduce course progress. Course position, pending Next, profile, character, settings, results and certificates use validated version-1 localStorage. Corrupt or blocked storage falls back to a usable session with a visible warning when saving is unavailable. Existing phase-1 version-1 profiles retain their valid fields; absent new fields default safely.

### Key selections (US keyboard)

1. Home row: `asdfghjkl;` and space.
2. Add top row: home row plus `qwertyuiop`.
3. Add bottom row: all lowercase letters, semicolon and space.
4. Add numbers: previous selection plus `0123456789`.
5. Add symbols: lowercase letters, digits, space and `; , . ! ? ' " - : / ( )`.
6. All keyboard: printable US ASCII, including uppercase, brackets, braces, backslash and shifted symbols.

Outdoor targets use deterministic pseudo-random keys. Underwater, castle and practice use one newly written passage per key selection. Each passage uses only allowed keys and loops directly to its beginning when completed; it does not append an alphabet or symbol drill, and it need not use every selected key. Early groups use short clauses rather than impossible capitalized/punctuated sentences. Finger guidance maps physical US keys, highlights numbers/symbol keys and indicates opposite Shift for capitals/shifted punctuation. Other physical keyboard layouts may need different fingers.

## Checks and evidence

```sh
npm test
npm run build -- --base=./
npm run test:browser
```

Browser tests start Vite's **production preview over HTTP** at port 4173, not the development server. They use installed macOS Google Chrome when available, otherwise Playwright's installed Chromium. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to override the executable (`CHROME_PATH` is also accepted by the suite). On machines without Chrome, run `npx playwright install chromium` first, or `npx playwright install --with-deps chromium` on Linux. No test-only gameplay bypass exists in production.

Tests cover exact input/scoring boundaries, ignored events, all defaults, outdoor key coverage and constrained fixed passages across six groups, castle stages, a fresh 15-pass course, idempotent Next, saved pending progression, failed retries, graduation, custom isolation, downloads, Escape/blur/visibility/pipe pauses, corrupt/unavailable storage and narrow layout. A production browser test types the all-keyboard underwater passage through repeated wraps, checks exact-case and space targets, the preview at the boundary and the continuing timer. Immediate-input regression tests explicitly use reduced motion with **Playwright simulated time**. Separate normal-clock tests cover outdoor contact, missed recovery, continuous travel, freeze/resume and a 20-second guided pass with Next/reload. Blur/visibility are explicitly dispatched lifecycle events. This is automated browser interaction, not human manual play or a real-time typing-speed certification.

JUnit output and screenshots can be preserved without modifying shipped assets:

```sh
PLAYWRIGHT_JUNIT_OUTPUT_FILE=.tmp/test-results/browser.xml npx playwright test --reporter=junit
```

Current traced-art integration evidence is [`artifacts/integration/REPORT.md`](artifacts/integration/REPORT.md), with bundle links in [`provenance-index.json`](artifacts/integration/provenance-index.json). Historical title/scrolling evidence is [`artifacts/title-scrolling-final/index.html`](artifacts/title-scrolling-final/index.html): 23 Node tests, 27 browser tests, live-preview hashes, normal-clock video and a 20-second guided pass (10 correct, 0 errors, 6 WPM), followed by Next/reload. Run `node artifacts/title-scrolling-final/capture.mjs` with current `dist/` served on 4175; video requires `npx playwright install ffmpeg`. Timing rules: [`docs/SCROLLING-BEHAVIOR.md`](docs/SCROLLING-BEHAVIOR.md).

Graphics test screenshots are written under `.tmp/test-results/graphics/`. Historical combined component evidence is in [`docs/VALIDATION.md`](docs/VALIDATION.md) and [`artifacts/component-final/index.html`](artifacts/component-final/index.html): 25 source/before/combined-after comparisons, 13 passing unit tests, 18 passing production browser tests plus one pipe-visibility renderer test, and all four modes at three desktop sizes and 390px mobile. Open the comparison index locally to follow reference-only file links. The read-only source gallery is `research/video-dJP7FTvGETM/components/index.html`.

For the historical component build only (its verifier expects the old engine), with that `dist/` served on port 4175 (or `GRAPHICS_URL`), run `node artifacts/component-final/capture.mjs`, `node artifacts/component-final/details.mjs`, then `node artifacts/component-final/verify.mjs`. The first captures actual production UI; the second adds keyboard flows and separately labeled fixed-state source-module renders. Verification checks served HTML/JS/CSS/SVG hashes, preserved function bodies and byte-identical engine/course/storage against `8255698`. Regenerate comparison navigation with `python3 artifacts/component-final/gallery.py`.

The title canvas shows a 720×450 source-video screenshot crop, with sequential image-based fades for “TEACHES TYPING”; it retains the original copyright notice. Other artwork combines screenshot-derived edits and fan-drawn stand-ins, not recovered DOS sprites. Luigi/Princess gameplay poses remain unsupported stand-ins. The detached-cap pose is available but not selected by the existing gameplay animation. The denser practice preview is readable DOM text, not the original DOS font. All four gameplay canvases remain 640×280; engine, course and storage are unchanged by this art integration. See [title provenance and timing](docs/TITLE-SCREEN.md).

Earlier normal-clock course evidence remains in `artifacts/final-*`; the full 15-pass normal-clock run was not repeated after scrolling. Current course regression tests use reduced motion; the new outdoor timing path has its own normal-clock pass evidence. That separate agent-driven playthrough uses `node tests/explore.mjs` with a static server on port 4174. No human playtest is claimed.

## Source and limitations

- `src/engine.js`: deterministic input, active-time scoring, text, hints and pipe state.
- `src/course.js`: result recording, gated advancement and certificate awards.
- `src/storage.js`: validated persistence; no storage dependency in the engine.
- `src/app.js`: DOM, clock, keyboard, audio and print/download adapters.
- `src/scene.js`, `src/art.js`, `src/assets/`, `src/outdoor-assets/`: traced/edited local assets and drawn reconstructions rendered with Canvas 2D, separate from gameplay. Contract: [`docs/RENDERER-CONTRACT.md`](docs/RENDERER-CONTRACT.md).
- `src/glove-hud.js`: glove drawings and highlights driven by engine finger hints.
- `src/style.css`, `src/hud-texture.svg`: purple/yellow menus, compact brown gameplay HUD, focus, responsive layout and print styles.

Mario names, characters and historical reference imagery belong to their respective rights holders. This unofficial educational fan recreation is not endorsed by Nintendo or the original publishers; no rights to their material are granted. Artwork combines authorized screenshot traces/edits and drawn stand-ins; sound is synthesized. This task's tracing permission does not grant redistribution rights. The repository's MIT license does not grant rights to third-party characters, imagery or traced artwork. Complete reference screenshots, source frames and creator overlays are never loaded by the game. No NES campaign, CD-ROM story, original voices, account sync, touch keyboard or printer-specific original formatting. Hazards show performance but cannot kill the player. Saved records are local convenience data, not tamper-proof credentials.

The governing brief is [`references/IMPLEMENTATION.md`](references/IMPLEMENTATION.md), with research in [`references/README.md`](references/README.md). `references/manual-1992.pdf` is scanned; the empty extraction was removed. Consult the PDF or the sourced research instead. The brief's timing, accuracy, speed increments and progression decisions intentionally resolve uncertainties about the original.
