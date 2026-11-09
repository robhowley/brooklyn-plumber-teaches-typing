# Scene renderer contract

Replace or expand `src/scene.js` without importing the application, CSS, storage, clock, or engine. It exports one function:

```js
drawScene(canvas, state, time = 0)
```

The function draws synchronously into the supplied HTML canvas and sets its backing dimensions to **640 × 280** in all four modes. The shell controls display size and preserves the 16:7 aspect ratio, with pixelated image scaling. It must not mutate `state`, schedule animation, install events, fetch assets, or decide gameplay outcomes. Art combines edited screenshot traces and drawn reconstructions. JSON grids are imported synchronously and local PNGs preload at module initialization, never inside drawing calls.

The canvas contains scenery, characters, hazards, and outdoor letters with a guiding star. It does **not** draw HUD, mode headings, instructions, next-key cards, sentence text, or pause dialogs. Those belong to the DOM shell. Pausing freezes the scene rather than adding a second overlay.

## State supplied by the shell

| Field | Meaning |
| --- | --- |
| `mode` | `outdoor`, `underwater`, `castle`, or `practice`. |
| `character` | `Mario`, `Luigi`, or `Princess`. |
| `text` | Nonempty target string. |
| `correct` | Correct character count and progress index. Current target is `text[correct % text.length]`; preview wraps the same way. |
| `errors` | Incorrect printable-key count. |
| `elapsed` | Active seconds, frozen during pause. |
| `duration`, `goal` | Attempt duration in seconds and WPM goal. |
| `status` | `running`, `paused`, or `finished`. |
| `pauseReason` | Human-readable pause explanation. |
| `lastAction` | `null`, `{kind: 'error', at}`, or `{kind: 'correct', at, obstacle}`. `at` is active elapsed seconds; cleared obstacle is `block` or `turtle`. |
| `reducedMotion` | Boolean preference. Stationary immediate-input targets; suppress ambient movement, jumping and debris. |
| `travel` | Engine-owned `{distance, speed, buffered, action, obstacles}`. Six outdoor slots hold stable `{id, x, cleared}`; action records contact position/distance. Never mutate these in the renderer. |

`time` is active animation time in seconds, not wall time. Paused and finished scenes use frozen `state.elapsed`, ignoring later `time` values. Reduced motion disables ambient movement, jumping, and flying debris. Correct input still changes position, targets, and scenery; flipped turtles remain visible without flight. Menu previews can omit status/timing/counts other than `correct`; omitted counts/timing are zero and missing actions are absent.

## Progress, obstacles, and performance

Outdoor obstacle index is `correct`: even targets are blocks, odd targets turtles. Active time moves obstacles and background continuously, even without input. Exact input in x=189–241 clears the current object; otherwise one exact key waits for its contact. Missed objects return with the same ID and key, without penalties. Only cleared offscreen slots receive new IDs. Correct contact supplies `lastAction` and `travel.action` for nearby effects; wrong keys leave the target unchanged but do not stop travel. The star identifies the current target. Underwater/castle also travel continuously; practice does not. Pause, hidden/blur, pipe and finished states freeze active time and travel; explicit resume never charges background time. See `SCROLLING-BEHAVIOR.md` for timing and custom-goal scaling.

Performance can be computed without an engine import: WPM is `elapsed > 0 ? correct * 12 / elapsed : 0`; accuracy is `correct + errors > 0 ? correct / (correct + errors) * 100 : 0`. The renderer may use these to visualize hazards, never to end or pause attempts.

Castle supplies `castleStage: 'thwomps' | 'quicksand'`, initially `thwomps`. Every 40 correct characters toggles the stage and sets `pipe: {stage: 'inside', progress: 0.5}`. The engine pauses input and active time immediately. Explicit Resume clears `pipe` to `null` and continues in the new stage. The renderer never advances or clears the pipe. During `pipe.stage === 'inside'`, the routed pipe conceals the actor; clearing the pipe restores the normal chamber actor. Treat an absent pipe as no transition. Menu previews always supply mode, character, nonempty text and correct count, plus zero errors/elapsed and a goal.

The shell owns the scrolling DOM text strip for underwater/castle and the plain practice text panel. The renderer does not draw typing targets in those modes.

## Artwork and visual evidence

- `src/art.js` draws integer-scanline silhouettes, side-profile character poses and portraits, left-facing turtles, stars and broad blue/cyan spiked foes. `src/scene.js` composes the four scenes and caches deterministic textures. Mario ground images are 96×88, with a (48,88) foot anchor; his swimmer is 104×92, anchored at (52,64). Portraits and unsupported Luigi/Princess ground stand-ins remain 64×76; their swimmers remain 96×64.
- Outdoor uses patterned cobalt, flatter gray cloud banks, a smiling radiant sun, orange masonry targets, red debris and a 28-pixel orange walkway starting at y=252 (other worlds retain floor y=258). There are no repeating triangular hills.
- Castle uses mixed grayscale masonry, broad blue foes, silver routed pipes and stepped orange pits. Pit foreground occludes the character. Hazard positions reflect performance without changing gameplay.
- Underwater combines horizontal swimmers, branching plants, orange-rimmed black rocks, white bubbles, a red fish and white squid. Practice uses a floating front-facing portrait whose mouth and brows reflect performance.
- `src/screen-art.js` composes teacher and character-choice canvases from shared drawings and delegates the 720×450 screenshot-cropped title to `src/title-art.js`. The title module preloads its local base/final PNGs and fades subtitle glyph crops with `requestAnimationFrame`; reduced motion shows the full still. These screen illustrations do not change the scene API or gameplay.
- Combined evidence: `artifacts/component-final/index.html` and `matrix.json` cover 25 categories. `capture.mjs` captures actual production UI; `details.mjs` separately captures fixed-state source modules and checks freeze/immutability plus real-clock warm draw durations and canvas allocations. `verify.mjs` checks preserved worker/shared function bodies and served asset hashes. Reference gallery: `research/video-dJP7FTvGETM/components/index.html` (local and Git-ignored).
- Current art includes screenshot-derived traces/edits, permitted for this task. Source frames are evidence only, not runtime artwork. Hidden contours, Luigi/Princess gameplay poses, original animation cadence and fonts remain approximate or unsupported. Current evidence: `artifacts/integration/REPORT.md` and `provenance-index.json`.
- Historical `artifacts/graphics-art/` contains first-pass and final browser screenshots, a reproducible capture script, and JSON check results. These are automated Chromium interactions against a private production build over HTTP, not human manual play. Full-page evidence shows the pre-integration shell; only scene artwork is owned by this phase.
- Reproduce from the repository root: build with `./node_modules/.bin/vite build --outDir .tmp/graphics-dist --emptyOutDir`, serve the repository with `python3 -m http.server 4189 --bind 127.0.0.1`, then run `node artifacts/graphics-art/capture.mjs`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` if Chrome is elsewhere. The private build is not committed.

## Other public modules

- `engine.js`: `KEY_GROUPS`, `MODES`, `generateText(group, length, seed, mode)`, `createAttempt(options)`, `stats(state)`, `advanceTime(state, seconds)`, `typeKey(state, keyboardEventLike)`, `pause(state, reason)`, `resume(state)`, `result(state)`, `fingerHint(key)`.
- Engine operations mutate only the supplied attempt. No DOM, clock, storage, audio, or random globals. `typeKey` returns `correct`, `buffered`, `error`, or `ignored`. Buffered keys count only when resolved at contact; unresolved keys are discarded at timeout.
- `storage.js`: `STORAGE_KEY`, `defaults()`, `loadProfile(storage)`, `saveProfile(profile, storage)`. Load validates and defaults invalid data. Save returns false on unavailable storage.
