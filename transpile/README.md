# Mario Teaches Typing, static JavaScript translation

**Outside, Water, Castle and Practice are playable through results and Next using locally decoded original art and source-derived routines.**

```sh
python3 -m http.server 4179 --bind 127.0.0.1 --directory transpile
```

Open **http://127.0.0.1:4179/**. Native JavaScript and Python are sufficient; no build or original executable runs. Serve this directory, not the repository root. Original and derived resources are private local-use material, **not covered by the repository MIT license**. Do not publish them.

## Play

- Click the canvas, then **1 Outside**, **2 Water**, **3 Castle** or **4 Practice**, or click their original right-side menu pictures.
- Outside accepts the marked target immediately, including lowercase equivalents. Type a displayed bonus punctuation key to play its recovered BAN/ANI sequence; lesson time stops during playback.
- Practice preserves case. Copy the second text row into the first; at the line end press **SPACE or Enter**. Nine source rows remain buffered. Wrapping uses the original cursor/rewind algorithm, including its overlong-word quirk, not conventional word wrap.
- Water matches case in the highlighted word window. Any input resets inactivity; strictly more than20 seconds starts the scripted chase and sink. Bonus punctuation stops lesson time during MSWM/LSWM/PSWM playback.
- Castle repeats rockfaces, pipe1, sand and pipe2. Match the colored FONT9H target; bonus punctuation plays MCAS/LCAS/PCAS with stopped lesson time. Escape exits; F10 is ignored. Numeric HUD layout, fades/audio and optional Phase5 endings remain omitted.
- **Escape** ends any activity early; **F10** also ends Outside/Water but is ignored in Practice. There are no lives, countdown, contact typing gate or invented Practice failure.
- Results: **N Next**, **M / Escape Menu**. Enter activates the pointer position; Tab/arrows select the original button positions. Space does not activate results.
- **W / E / T** open the visibly separate browser new-student, edit and duration controls. Outside, Water, Castle and Practice minutes are independently editable. New names truncate at a dot; an existing name loads that student.
- Focus loss pauses both motion and active lesson time. **Focus game** resumes. This is a host adaptation, not a recovered pause key.

Guest `Player` is unsaved, not the original automatic Demo. New students default to goal5, group1, Mario and durations2/5/5/10 minutes. Practice never advances the group; its Next stays in Practice. Next enters Water at goal10 and Castle at30. Practice Next stays in Practice; Castle completion does not invent a route to Practice.

## Fidelity boundaries

- Recovered: lesson bytes/cursors, shared activity RNG draws, low16 seed, Outside mechanics/order, bonus interception and timer stop/restart, Practice rows/input/expression, scoring/results/progression, sprite origins/index-zero mask, ground, final Outside palettes, decoded idle and bonus rasters.
- Host adaptations: current epoch seconds supply the seed and wall clock; approximately18.2Hz updates; one pending key for Outside/Practice, an unbounded FIFO for Water/Castle; focus pause; Outside/Practice full-scene redraw; editor/storage; some text placement and static Practice cursor.
- Unsupported: title/menu idle and their RNG draws, dropdowns, Water/Castle numeric HUD layout, optional progression celebrations/endings, audio, help/report/demo, printing, DOS timezone/daylight parsing and original hardware presentation.

`?seed=1` fixes the **entry seed of this slice**, not an original startup replay. The original title/menu consume timing-dependent draws; these omitted presentations do not secretly consume fabricated draws. State is retained across supported activities. There is no source-selector interstitial or three-second countdown.

Outside counters and its observed-second bonus clock now survive repeated entry and intervening Practice. Source contracts: [reentry/FONT7H](analysis/runtime/REENTRY.md) and [decoded Water/Castle foundations](analysis/render/BGS.md). Water retains its whitespace, animation counters and failure phase across other activities. Its controller drains pending keys before actor updates and waits on changed low ticks. See [Water controller](analysis/worlds/WATER-CONTROLLER.md), [presentation](analysis/render/WATER.md) and [Phase2 checks](reports/PHASE-2.md). Phase2 passed independent review and was pushed as `aaf2975`. Castle retains separate rock/sand observed-second clocks, uses one pending key per source operation, and consumes ordered draw snapshots including transition scratch bias. [Controller](analysis/worlds/CASTLE-CONTROLLER.md), [presentation](analysis/render/CASTLE.md) and [Phase3 checks](reports/PHASE-3.md) document the integration. Ending playback is explicitly acknowledged as omitted, without fabricated waits or RNG; goal/completion/results are preserved.

See [coverage](COVERAGE.md), [adaptations](ASSUMPTIONS.md) and [Phase 1 results](reports/PHASE-1.md). Missing assets stop visibly; blocked/corrupt storage produces a persistent memory-only warning. No generic art or generated corpus fallback is used.

## Files and evidence

| Path | Role |
|---|---|
| `app/main.mjs` | DOM input, focus, editor and host scheduling |
| `app/session.mjs` | Calls recovered control, outdoor, runtime and worlds routines |
| `app/render.mjs` | Calls recovered indexed renderer; isolates host drawing choices |
| `app/data.json`, `assets/app/` | Local generated resources, ignored by Git |
| `tools/build-app-data.py` | Bundles inert resources; applies tested Python BAN decoder |
| `recovered/{control,outdoor,worlds,runtime,render}/` | Source-cited, tested APIs, including Phase 1 retained-state and world-render primitives |
| `assets/render/manifest.json` | Local next-phase world API: `worlds`, family/index sprite records, palettes, scenes and ANI paths; all paths relative to this manifest |
| `analysis/*/` | Executable FILE offsets, hashes, resource indices and limits |

The browser fetches only authored modules, JSON and decoded bonus backgrounds. It never fetches executable/archive/raw files or imports the old app. All analysis reads original bytes as inert data; no original machine code is executed, interpreted or emulated.

## Rebuild and verify

A clean clone has no assets. Supply the hash-pinned local ZIP and run the [ordered regeneration recipe](PLAN.md#fresh-clone-local-inputs), which uses only authored static tools. Control evidence accepts only the freshly generated worlds listing and verifies its bytes, never an external research fallback. After decoded inputs change:

```sh
python3 -B transpile/tools/render/water-bindings.py
python3 -B transpile/tools/build-app-data.py
node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs
python3 -B -m unittest discover -s transpile/tests/assets -p 'test_*.py'
python3 -B -m unittest discover -s transpile/tests/render -p 'test_*.py'
python3 -B -m unittest discover -s transpile/tests/app -p 'test_*.py'
mkdir -p transpile/.tmp
TMPDIR="$PWD/transpile/.tmp" PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/browser/results.xml \
  node_modules/.bin/playwright test -c transpile/playwright.config.mjs --reporter=junit
```

Run checks through `structured_return` in Pi (`node-test-text`, `unittest-text`, `junit-xml`). Browser tests use the existing root Playwright installation and installed Google Chrome and write artifacts under `transpile/`. The checked-in config starts port4179 and refuses an existing listener. If4179 is already your server, leave it running and set `TRANSLATION_PORT=4190` for Playwright (used for Phase3). In worker checkouts the supplied `transpile/node_modules` symlink may be the CLI location; it is ignored, not a vendored dependency. Root configuration is unchanged. Python resource validation requires the original ZIP; running the built app does not.

Passing checks establish authored integration and byte-derived expectations, not pixel-perfect or runtime equivalence to an executed DOS reference. `.gitignore` keeps worktrees, scratch, local binary bundles and browser/worker artifacts on disk but out of accidental adds.
