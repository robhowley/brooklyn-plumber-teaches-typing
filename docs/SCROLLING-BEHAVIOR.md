# Active-time scrolling

Action worlds now travel without typing. Outdoor keys act on approaching objects, not on a stationary row that is replaced after every key.

## Outdoor rules

- The runner stays near x=215 while gait, paving, clouds and six letter objects move continuously. Objects keep their IDs and positions when a key is pressed. Cleared slots receive a new ID only after leaving the left edge.
- The star and DOM target both identify `text[correct % text.length]`. Other visible letters are previews, not alternative targets.
- The first object starts at x=550. Travel is `max(goal * 12, 72)` (goal validated to 1–150) pixels/active second; objects are 120 pixels apart. At 5–12 WPM goals, this gives about 2.1–4.3 seconds before first contact and 0.83–1.67 seconds between later contacts. Both goals are achievable over the normal 120-second attempt with room for the runway.
- **On time:** an exact key with the object between x=189 and x=241 counts once, advances the target and triggers a nearby jump/smash or turtle flip. Debris and shells follow the cleared object's position, not a fixed distant effect location.
- **Early:** retain one exact key until that same object reaches x=241. The target does not advance while waiting. The heading says “Key held for the star”. Additional copies of the held correct key are ignored, not queued.
- **Late/missed:** within the rear contact window, act immediately. Otherwise the same object circles back, without changing its letter or adding errors. Its full circuit takes `720 / speed` active seconds (5–10 seconds at beginner goals). A late exact key can wait for that return. Future objects continue passing; no letter is silently skipped.
- **Wrong:** every eligible wrong printable key counts an error and retains the current target, even while a correct key is held. Case, spaces and punctuation remain exact. Existing ignored-event rules are unchanged.
- A held key contributes one correct character only when its encounter resolves. It never generates additional correct counts. A held key still waiting at timeout is discarded without an accuracy penalty. This timing consequence is explicit: very short outdoor duration overrides can end before the first encounter.
- Reduced motion uses stationary objects and immediate exact-key advancement, without a timing window or continuous travel. Input still changes targets and poses.

The beginner scene keeps its 5–12 WPM pacing. Explicit higher custom goals increase speed without a hidden cap: 120-pixel spacing yields 1.2 times the goal's required encounter rate, allowing runway overhead over normal durations. At 150 WPM speed is 1800 px/s; this is fast and harder to read. Water, practice or reduced motion remain alternatives, not requirements. Deterministic tests prove normal-motion throughput at 30, 75 and 150 WPM over 120 seconds. At goal 5 the first buffered contact is 309/72 ≈ 4.292 active seconds; a shorter override can legitimately finish with zero correct keys. Duration overrides do not shorten the runway or change pass math.

## Other worlds and lifecycle

- Underwater plants, seabed and rocks move with active time, and the swimmer cycles poses. Word/sentence typing and performance response are unchanged.
- Castle masonry, floor, foes and pipes move with active time. Sentence typing and the existing 40-correct pipe transition remain unchanged. The quicksand foreground remains a fixed chamber illustration over moving masonry.
- Practice has no world travel.
- Escape, blur, hidden-tab and pipe pauses stop both active time and travel. Explicit Resume resets the application's wall-clock reference. Finished attempts cannot move or accept keys.
- WPM remains `correct / 5 / active minutes`; accuracy remains `correct / attempted`. Timeout requires attempts > 0, the WPM goal and at least 90% accuracy. Course, profile schema, persistence, certificates and graduation were not changed.

## Ownership and superseded assumptions

`src/engine.js` owns `travel`: distance, speed, six `{id, x, cleared}` objects, a one-key `buffered` flag and the most recent spatial `action`. `advanceTime` resolves contact at its exact active timestamp, independently of frame size. `typeKey` additionally returns `buffered` when retaining an early/late exact key.

`src/app.js` supplies the reduced-motion preference at attempt creation and explains waiting/recovery in the gameplay heading. `src/scene.js` consumes model positions and draws synchronously at 640×280. It does not mutate the attempt, read a clock, attach events or decide encounters.

This request supersedes descriptions in the implementation brief and renderer contract that correct counts alone move scenery, wrong input means a stationary world, or outdoor positions are computed from `correct`. Correct input still exclusively advances the text. Integration owns updates to those shared documents. Menu/title artwork, CSS and shared character drawings were not edited.

## Original-video observations

Read-only source: `research/video-dJP7FTvGETM/` (local and Git-ignored).

- Inspected `components/index.html`, the outdoor segment manifest, chronological sheets 03 and 05, and the sequential full frames listed in `artifacts/scrolling-iteration/reference-sequences.json`.
- **21.333–21.917 seconds, frames 1280–1315:** the runner's ground poses change, the starred L turtle closes the gap, then a flipped shell appears nearby; the displayed typed count changes from 38 to 39 and the star marks the following turtle.
- **29.000–29.500 seconds, frames 1740–1770:** a letter block approaches, the runner rises beneath it, the block becomes debris and the runner lands. Neighboring targets and ground continue moving. The typed count changes from 49 to 50 before the visible block disappears.
- These sequences establish approach/action/recovery and spatial continuity. They do **not** reveal physical keypress timestamps, an idle-input experiment, the original timing window, buffering policy or missed-target rules. Our continuous no-input travel follows the user's request; the buffer, circuit and forgiving recovery are recreation decisions, not historical claims.

## Checks and dynamic evidence

All evidence is automated Chromium interaction and visual inspection of captured sequences, not human manual play.

- `artifacts/scrolling-iteration/baseline/`: production capture from `270184b`, normal clock, six no-input samples followed by wrong/correct input. Actor and world remain fixed without input; minor glyph raster differences are not world motion.
- `after-pass1/`: first motion review verified approach, passage and retained targets. Review prompted continuous offscreen cloud wrapping and tiled castle masonry to remove periodic scenery resets.
- `after-pass2/`: second reviewed approach strip, dense jump/flip action strip, normal-clock browser video and timestamped `capture.json`. Objects pass without input; subsequent actions occur beside the runner. Paused frame pairs are identical in both passes.
- `reference-sequences.jpg` and `.json`: chronological original-video evidence with exact timestamps, frame indices and paths. Reference-only, not game assets.
- `browser-final.xml`: **23 browser tests passed**, including four new real-clock scrolling tests, keyboard events, early/on-time/missed recovery, wrong input, Escape/blur/hidden freeze, pipe resume, reduced motion, scoring thresholds, guided Next, complete graduation and reload.
- `node-final.txt`: **22 Node tests passed**, including nine new deterministic movement/encounter tests. Instant outdoor scoring/course fixtures explicitly select reduced motion; normal motion has separate encounter tests rather than weakening scoring assertions.
- The first browser pass had one premature pixel comparison immediately after Resume, before the next animation frame. Waiting for that frame fixed the test; the final report is clean.

Reproduce from the repository root (private build, no tracked `dist/` mutation):

```sh
./node_modules/.bin/vite build --outDir .tmp/scrolling-dist --emptyOutDir
python3 -m http.server 4192 --bind 127.0.0.1 --directory .tmp/scrolling-dist
node --test tests/*.test.js
PLAYWRIGHT_JUNIT_OUTPUT_FILE=artifacts/scrolling-iteration/browser-new.xml \
  ./node_modules/.bin/playwright test \
  --config artifacts/scrolling-iteration/playwright.config.js --reporter=junit
node artifacts/scrolling-iteration/capture.mjs new-review
```

The capture script needs Playwright's ffmpeg. This worker used a private `.tmp/browsers/ffmpeg-1013/ffmpeg-mac` symlink to the research venv's existing `imageio_ffmpeg` binary, with `PLAYWRIGHT_BROWSERS_PATH=$PWD/.tmp/browsers`; no global install was made. `strips.py` uses Pillow from that read-only venv to produce contact sheets. Videos and screenshots preserve the actual normal-clock captures; `checks.json` records their hashes and pause equality.
