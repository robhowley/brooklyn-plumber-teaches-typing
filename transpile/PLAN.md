# Continue the static translation

Checkpoint0 is published as `026f577`; Phase1 is pushed as `5d26db4`. Phase2 Water passed independent verification and was pushed as `aaf2975`. Phase3 Castle is integrated locally, with both frozen-worker review defects fixed, full repeating controller/indexed presentation, bonus and results/Next. Phase3 independent post-integration review remains pending. Nothing from Phase3 was committed or pushed. Every enabled behavior must have executable-byte or resource evidence; missing evidence leaves that behavior disabled, not approximated with invented mechanics.

## Rules and working baseline

- Only newly authored static readers, decoders, translated JavaScript and tests run. Never execute, emulate, interpret, or launch an archive program, script, installer or driver. Static disassembly is data inspection, not an execution oracle.
- All writes stay under `transpile/`. Paths below are relative to that directory unless stated otherwise. Root app/configuration and `../research/` are read-only; research supplies leads, never proof.
- Main may checkpoint/push with the user's explicit authorization. Workers never commit/push. Original archive, generated resources, numerical resource tables, byte dumps, screenshots and host/tool artifacts stay local and ignored. Never force-add them or apply MIT to them.
- Current evidence: [coverage](COVERAGE.md), [adaptations](ASSUMPTIONS.md), [Phase 1 verification](reports/PHASE-1.md); [earlier verification](reports/VERIFICATION.md) is historical. Historical worker reports can be superseded by runtime/render recovery.
- Already integrated: shared RNG/corpus selection, exact Practice buffer/input, Outside mechanics, idle art, indexed compositor, ground tile, Outside BAN/ANI bonus, student bytes, scoring/results/Next.
- Recovered but not integrated: original menu navigation, report/help presentation, title/menu RNG helpers and later presentations.
- Phase2 integrates Water polling/order, failure/bonus orchestration, source draw snapshots and wave tiles. Phase3 integrates Castle's metadata queue, operation2/3 branches, repeating rockface/pipe/sand sequence, scratch compositor and exact BAN write runs. Numeric Water/Castle HUD layout, intermediate fades, original widgets, title/help/reports/celebrations/endings and audio remain omitted. Castle ending requests require an explicit completion/omission acknowledgement before results; main acknowledges the Phase5 omission without invented delay/RNG.

## Checkpoint 0: publish authored work only

The ignore audit found publishable-list leaks: `reports/server.pid`, full executable listings, hexadecimal executable/corpus copies, extracted message text and original numeric tables (including generated `recovered/worlds/tables.mjs`). These are now ignored alongside assets and worker artifacts. Authored reports, implementation, tests, tools and provenance metadata remain candidates. `analysis/control/evidence.json` is an authored routine map, unlike the excluded raw-byte evidence files.

The source/test review and earlier independent verification support the no-original-execution constraint: subprocesses in analysis tools invoke trusted `objdump` on inert data; archive extraction validates paths/hashes and gives every member a `.data` suffix; browser tests reject executable/archive/raw/old-app requests. This is source and recorded-command evidence, not a claim to have observed every historical process.

Main's publication gate, from the repository root:

```sh
git ls-files --others --exclude-standard -- transpile
git status --short
# Review candidate content, then stage only this directory, without -f.
git add -- transpile
git diff --cached --stat
git diff --cached --name-only
git diff --cached --check
```

Confirm the index contains only `transpile/`, no ignored resources and no pre-existing unrelated staged changes. Recount bytes/files from the final index, including any later authorized edits, before committing. A clone intentionally cannot run the game or all tests until its owner supplies the hash-pinned archive and rebuilds local inputs. This is a source checkpoint, not a distributable asset bundle.

### Fresh-clone local inputs

Prerequisites: Python 3, Node, and a trusted LLVM/Apple `objdump` accepting `--triple=i386-unknown-unknown-code16`. The scripts currently locate the user's own archive at `$HOME/Downloads/Mario_Teaches_Typing_1992.zip`, SHA256 `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`. Do not obtain an archive from committed output or execute anything inside it.

Run these newly authored tools from the repository root, in order:

```sh
mkdir -p transpile/analysis/control transpile/.tmp
python3 -B transpile/tools/worlds/inspect.py
python3 -B transpile/tools/control/evidence.py
python3 -B transpile/tools/control/tables.py
python3 -B transpile/tools/worlds/tables.py
python3 -B transpile/tools/outdoor/inspect.py
python3 -B transpile/tools/runtime/inspect.py
python3 -B transpile/tools/render/inspect.py
python3 -B transpile/tools/assets/pipeline.py
python3 -B transpile/tools/render/decode.py
python3 -B transpile/tools/render/water-bindings.py
python3 -B transpile/tools/worlds/water-inspect.py
python3 -B transpile/tools/worlds/castle-inspect.py > transpile/.tmp/castle-evidence.json
python3 -B transpile/tools/build-app-data.py
python3 -m http.server 4179 --bind 127.0.0.1 --directory transpile
```

`control/evidence.py` reads only `analysis/worlds/disassembly.txt`, newly generated by the first command, and verifies its instruction bytes again. There is no research fallback/comparison. A missing or empty listing fails with a regeneration instruction; a stale `analysis/control/verified-disassembly.txt` is never an input. For additional focused control listings, run `python3 -B transpile/tools/control/disassemble.py`; those listings are not app/test prerequisites.

| Ignored input required by app/tests | Regenerator |
|---|---|
| `analysis/control/{byte-slices,messages,tables}.json` | Control evidence/tables commands above |
| `analysis/outdoor/{evidence,tables}.json`, `*LETTERS.LEE.data` | Outdoor inspect |
| `analysis/runtime/{evidence,corpora}.json` | Runtime inspect |
| `analysis/render/evidence.json` | Render inspect |
| `analysis/worlds/tables.json`, `recovered/worlds/tables.mjs` | Worlds tables |
| `assets/original/`, `assets/render/` | Asset pipeline, render decode |
| `assets/render/water/bindings.json` | Supplemental Water bindings, after render decode; palettes, exact BAN writes and wave rasters stay local |
| `.tmp/{water,castle}-evidence.json` | World inspectors validate generated listings against ZIP bytes; Castle inspector stdout must stay local |
| `app/data.json`, `assets/app/` | App-data builder, after all inputs above |

Other excluded listings, strings, raw wrappers and worker logs are not runtime/test inputs. Listings can be regenerated by their corresponding inspectors. Historical exact annotations are not guaranteed to reproduce; authored reports retain offsets and hashes. No excluded evidence input requires executing original code. The bootstrap worker ran the original sequence twice in an isolated checkout. Phase 1 integration reran the revised sequence both in main and in an empty ignored tree containing only authored tools and empty destination directories: 2,402 generated resource/app/evidence files matched byte-for-byte. This is a fresh-input rebuild, not a fresh dependency-install experiment. See PHASE-1 for scope and commands.

## Ordered phase bundles

| Bundle | Depends on | Parallel isolated workers | Gate before checkpoint |
|---|---|---|---|
| 1. Runtime and world rendering foundations | 0 | Runtime/reentry; BGS/assets/render; bootstrap verifier | Persistent-state contracts, decoded/clipped scene proof, clean-clone rebuild |
| 2. Playable Water | 1 | Water controller; Water presentation | Pending-input order, failure/bonus/results and reentry verified |
| 3. Playable Castle | 1 and integrated 2 | Castle queue/controller; Castle presentation | Full repeated scene cycle, failure/exit/progression and clipping verified |
| 4. Original menus/student/report/help | 3 | UI/control; report/help | Original command paths exercised, host transport kept explicit |
| 5. Title/demo/celebrations/endings | 4 | Title/demo; celebration/ending | Shared RNG order and presentation return paths verified |
| 6. Audio and bounded host gaps | 5 | Static audio decoder; host/control analysis | Source-derived requests/playback, explicit unsupported hardware gaps |

Castle byte analysis may start alongside Water after bundle 1, but shared integration waits for bundle 2. Later bundles may inspect inert bytes early; they must not change shared app files ahead of their dependencies.

### Worker and integration contract

Main supplies the frozen parent checkpoint, owned files, required exports/data fields and acceptance cases. Each worker uses an isolated checkout under `.worktrees/`, writes only owned paths, and returns a short report with paths, FILE offsets/member hashes, commands/results and remaining unknowns. Do not pass entire transcripts back to main. No nested delegation. Main applies reviewed artifacts, then dispatches one integration worker and an independent read-only verifier. Overlapping files are never edited by concurrent workers.

Per bundle, only the integration worker owns `app/session.mjs`, `app/main.mjs`, `app/render.mjs`, `app/style.css`, `index.html`, `tools/build-app-data.py`, `tests/app/`, `COVERAGE.md`, `ASSUMPTIONS.md`, `README.md` and the phase ledger below. Generated data remains ignored. Workers propose additions to the app-data schema; integration makes that single schema change after reviewing producer/consumer tests.

Preserve `Session.start/step/finish/next`, source-derived `timer`, `score`, `progression`, RNG and corpus APIs where they fit. Do not create a universal game engine. A world controller receives explicit keys/pending-input status, sampled active ticks and wall seconds, shared RNG/corpus and persistent state; it exposes source-derived state and ordered effects for rendering/audio/results. The controller owns original branch/update ordering; the host supplies events/clocks, not guessed world cadence. Field names are implementation choices, but evidence must settle state lifetimes and every transition before exposing the world.

### 1. Runtime and world rendering foundations

**Runtime worker owns:** `recovered/runtime/runtime.mjs`, `recovered/outdoor/outdoor.mjs`, `tests/runtime/runtime.test.mjs`, `tests/outdoor/outdoor.test.mjs`, `tools/runtime/inspect.py`, `analysis/runtime/RUNTIME.md`, new `analysis/runtime/REENTRY.md`.

- Trace surviving DS counters and initialization/reset paths, including Outside motion, previous duration, Water previous whitespace, Practice last-correct, font/palette state and shared RNG callers. Classify process lifetime versus per-entry state. Move only proven surviving values out of fresh constructors; no fabricated reset policy.
- Trace keyboard pending/consume and timer/option services used by Water and Castle. Keep browser delivery/typematic/focus limitations explicit. Provide a pending-input test harness rather than pretending the current single-slot latch proves DOS queue behavior.
- Acceptance: repeated same-world and cross-world entry, zero/stale state, signed overflow edges, exact random draw counts, pause/bonus stop/resume and ignored-key boundaries. Preserve existing Outside/Practice results.

**Render worker owns:** `tools/render/decode.py`, `recovered/render/render.mjs`, `tests/render/{render.test.mjs,test_decode.py}`, `analysis/render/RENDERING.md`, new `analysis/render/BGS.md` (generated `assets/render/` only locally).

- Follow `0xb905` and Castle callers to establish BGS packing, scene indices, palettes and clip changes. Reuse understood decompression/compositor primitives only where byte/callee evidence matches. Decode Water inline bubble rasters and bind Water/Castle character, failure and bonus frames by original indices.
- Extend the existing render manifest, keeping explicit origins, bounds, palette provenance, and resource paths. Test exact dimensions, offsets/checksums, truncated/bad inputs, inclusive clipping at every edge, restoration order and scene palette changes. No invented Castle background or generic collision renderer.

**Bootstrap verifier:** read-only source review plus generated files under its own checkout's ignored paths. Execute the fresh-clone sequence and all baseline checks. It reports exact missing inputs/tool assumptions; any source fix returns to its owning worker. Phase 0 itself changes no implementation.

### 2. Playable Water

**Controller worker owns:** new `recovered/worlds/water.mjs`, `tests/worlds/water.test.mjs`, `analysis/worlds/WATER-CONTROLLER.md`. Import existing `routines.mjs` and `runtime.mjs`, do not fork their arithmetic.

- Translate initialization, 20/40-byte windows and target indices, refill/sanitation, case-sensitive input, deferred redraw and pending-key suppression (`0x17943..0x1794c`). Preserve stats/swimmer/pursuer/bubble/bonus ordering and exact bubble RNG calls.
- Translate any-input inactivity reset, strict >20 failure, scripted chase/sink, timeout versus abort, bonus interception before scoring, timer stop/restore, and failure-gated progression/results. Trace remaining callees rather than deriving a loop from numeric helpers.
- Tests: accepted key endpoints, wrong-input inactivity extension, pending-key bursts that suppress movement, six-update redraw threshold, wrap/pursuer transition, first-free bubble allocation, random stream position, sink completion, bonus time exclusion and each terminal path.

**Presentation worker owns:** new `app/water-render.mjs`, `tests/worlds/water-render.test.mjs`, `analysis/render/WATER.md`. Use the indexed primitives and resource records from bundle 1; return source-ordered drawing operations without owning Session or DOM events. Establish Water BAN/ANI restoration and clipping, not Outside's callback cadence by assumption.

**Integration gate:** update Session mode2, source duration field, eligibility/Next routing, renderer and data builder together. Chrome tests exercise real input through success, inactivity failure, abort, bonus, results/Next and all three characters. Unresolved decorative/audio paths remain explicitly disabled; required controller/render paths block enabling Water.

### 3. Playable Castle

**Controller worker owns:** new `recovered/worlds/castle.mjs`, `tests/worlds/castle.test.mjs`, `analysis/worlds/CASTLE-CONTROLLER.md`.

- Translate the 2000-word metadata queue, backtick sentence reader/500-byte bound, end markers and shift rules. Keep operation2 (typing/failure) distinct from operation3 (transitions); retain separate timeout, failure and explicit-exit flags.
- Translate the complete loop through rockface stages, 40-step scrolling and fast branch, pipe sequences with repeated random delay draws, sand entrance/active/exit, failure animations and return to rockfaces (`0xbb06..0xde2d`). Reuse tested approach/rockface/sand arithmetic.
- Tests: metadata bits and queue bounds, keys32..126 versus127, attempts49/50 and accuracy69/70, strict inactivity threshold, typing locks, old-player-position rockface trigger, all40 scroll steps, repeated RNG comparison, sink/timeout/abort at transitions, two complete scene cycles and progression/end-mode gates.

**Presentation worker owns:** new `app/castle-render.mjs`, `tests/worlds/castle-render.test.mjs`, `analysis/render/CASTLE.md`. Bind BGS scenes and character/failure frames, trace clip save/restore at every segment and bonus return. Test indexed pixels against independently decoded data and exact bounds/order, not self-generated screenshots alone.

**Integration gate:** enable mode3 only after full loop and resource checks. Browser tests cover rockface to sand to repeated rockface, bonus, failure, timeout/abort, all characters and mode1→2→3→4 reentry. No invented lives, collision damage, retry screen or finite level map.

### 4. Original menus, students, reports and help

**UI worker owns:** `recovered/control/{flow,student}.mjs`, new `recovered/control/menu.mjs`, `tests/control/menu.test.mjs`, `tests/control/control.test.mjs`, `analysis/control/MECHANICS.md`.

**Report/help worker owns:** new `recovered/control/report.mjs`, `app/report-render.mjs`, `app/help-render.mjs`, `tests/control/report.test.mjs`, `analysis/control/REPORT-HELP.md`.

- Recover dropdown geometry/event pump, accelerators/pointer interception, text cursor/edit bounds, load/delete/name collision and duration/character/group commands. Replace the separate host forms only when their original command is proven; retain browser storage transport and current save layout, with no speculative migration.
- Recover per-key ranking/report-card layout, BLACKBRD statistics text operation210, help/keyboard/about routing and original resource text/font controls. Establish menu color88 and cursor behavior from bytes, not visual guesses. Wire quit/error paths as explicit browser limitations rather than tab-closing impersonation.
- Acceptance: keyboard and pointer parity for supported commands, field/cancel boundaries, duplicate names, load/delete/save denial, report ranking ties/overflow, help back-navigation, focus behavior, and correct rendering after activity reentry. Data/command helpers already recovered are reused.

### 5. Startup, demo, celebrations and endings

**Title/demo worker owns:** new `recovered/control/startup.mjs`, `app/startup-render.mjs`, `tests/control/startup.test.mjs`, `analysis/control/STARTUP.md`.

**Celebration worker owns:** `recovered/control/results.mjs`, new `recovered/control/celebration.mjs`, `app/celebration-render.mjs`, `tests/control/celebration.test.mjs`, `analysis/control/CELEBRATIONS.md`.

- Recover logo/title/greeting/menu idle and demo entry/exit, palette transitions and input skip behavior. Guest must not silently become Demo. Use existing title/menu RNG helpers with proven call order; deterministic seed now describes the implemented entry path, not the old direct-menu slice.
- Recover Outside fireworks/OCASTLE, Water/Castle progression presentations, end modes/ENDF, results speech requests and certificate queue flags. Reuse BAN/ANI; establish each presentation's callback/timer/input policy independently.
- Acceptance: early skip versus full playback draw counts, no input leaking back to a lesson, correct timer restoration, repeated entry and completion flags, no double progression on Next, demo abort, and resource exhaustion/missing-data failure visibility. Certificate scheduling is not permission to invent printer output.

### 6. Audio and remaining host differences

**Audio worker owns:** new `tools/audio/decode.py`, `recovered/audio/audio.mjs`, `app/audio.mjs`, `tests/audio/test_decode.py`, `tests/audio/audio.test.mjs`, `analysis/audio/AUDIO.md` (generated `assets/audio/` stays ignored).

**Host-analysis worker owns:** new `analysis/control/HOST-GAPS.md`, `tests/control/host.test.mjs`; propose necessary source changes to integration, not concurrent shared-file edits.

- Recover VOC/resource formats and request/stop/priority/option-bit behavior through static data/call analysis. Decode understood formats with authored code; do not execute sound drivers or synthesize guessed music. Unsupported synthesis/speech paths stay silent and labeled.
- Audit clock/timezone assumptions, filesystem/carryon/error semantics, cursor/input delivery, certificate/printing and device detection. Browser audio unlock, local storage and print transport remain host adaptations; do not promise DOS hardware fidelity. OS/device behavior unsupported by source evidence remains documented, not faked.
- Acceptance: decoded PCM lengths/rates and block bounds, malformed resources, source-event ordering, option toggles, interruption/reentry, muted/autoplay-denied behavior, and no archive-code/network fetches. Any browser printing/export proposal must preserve original document data and clearly label host transport.

## Verification and checkpoint ledger

Each bundle requires source-offset/member-hash citations, branch-boundary tests, producer/consumer resource tests, regression checks and an independent review. Browser tests run only authored JavaScript. Source-derived expected traces are not DOS differential tests. Do not claim full machine equivalence or a percentage of completion.

From the repository root, after regenerating local inputs:

```sh
TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs
TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/assets -p 'test_*.py'
TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/render -p 'test_*.py'
TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/app -p 'test_*.py'
TMPDIR="$PWD/transpile/.tmp" PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/browser/results.xml \
  node_modules/.bin/playwright test -c transpile/playwright.config.mjs --reporter=junit
```

Use `structured_return` (`node-test-text`, `unittest-text`, `junit-xml`). The app Python tests rebuild outputs, so run them in an isolated checkout when preserving current local assets matters. Browser checks currently need the existing root Playwright installation and installed Google Chrome; do not edit root configuration. Add the bundle6 audio suites explicitly when created. Check `git diff --check`, directory boundaries and the exact index before every authorized checkpoint.

| Bundle | Verification/checkpoint record |
|---|---|
| 0 | Published checkpoint `026f577` (provided by main). Docs/ignore audit; earlier verification records80 Node +25 Python +8 Chrome passes. |
| 1 | Pushed checkpoint `5d26db4` (provided by parent). runtime/render worker handoffs `reports/continuation/phase1/{01-worker-hard,02-worker-hard}.md`; bootstrap verifier `03-verifier.md` in p1-bootstrap. Revised fresh-input regeneration:2,402 matching files;93 Node +29 Python +9 Chrome pass. Contracts: `analysis/runtime/REENTRY.md`, `analysis/render/BGS.md`; integration evidence and exact files: `reports/PHASE-1.md`. Water/Castle disabled; independent post-integration review pending, so the full review/checkpoint gate is not claimed complete. |
| 2 | Gate passed and pushed as `aaf2975` (parent checkpoint). Independent verifier PASS:137 Node +30 Python +14 Chrome, review `reports/PHASE-2-VERIFICATION.md`. Water bonus erasure/bubble snapshots fixed. Historical implementation record: `reports/PHASE-2.md`. |
| 3 | Integrated locally, no commit/push. Only seven authored Castle worker files imported. Fixed pre-scroll oldX and clean stationary-rock redraw defects with source/pixel regressions.178 Node +31 Python +19 Chrome pass; Chrome uses4190, preserving4179. Real source keys drive two complete cycles for all3 characters. See `reports/PHASE-3.md`. Independent post-integration review pending; no checkpoint gate claimed yet. |
| 4–6 | Pending. Original UI/HUD, optional presentations and audio remain omitted. |

This ledger sequences implementation and records evidence/checkpoints. It is not a personal task store.
