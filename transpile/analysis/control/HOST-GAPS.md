# Phase6 host boundaries and remaining recoverable work

**Finish synchronous audio continuations and the option10 input guards first. Keep storage unchanged and printing disabled. Mouse pixels, Practice cursor/finger hints and remaining palette callbacks are missing game code, not unavoidable browser differences.**

This is a source-only handoff, not a claim that Phase5/6 are integrated or independently verified. Baseline: frozen host worktree HEAD `2f9ad12`, with Phase4 source. Phase5 startup/celebration and Phase6 audio contracts were read from their isolated workers, not from the concurrently changing main checkout. Only this report and `tests/control/host.test.mjs` are proposed authored changes. All scratch, copied inspectors and generated data stay under this worker's ignored `.tmp/host/`.

## Priorities for the integrator

Paths below are relative to `transpile/`. These are bounded changes, not a new engine, save format, compatibility mode or printer interface.

| Priority | Exact change permitted by the evidence | Acceptance / risk |
|---|---|---|
| 1 | Suspend source execution at blocking speech calls. Use audio worker `SourceAudio.request/complete` and `BrowserAudio.perform`; split Water entry before its last-input sample, Castle's first operation tail, Outside entry, menu welcome and results entry. | Ready must finish or be explicitly acknowledged omitted before the continuation. Water timer already started before Ready: do not pause it to exclude speech. Suppress/drain VOC input, not RS input. Final-state effect replay cannot repair already-consumed RNG, input or clocks. |
| 1 | Consume Alt-X without quitting/aborting when option10 is false. Only request host quit on the original allowed branch; retain unconditional menu Quit. Share the already-planned Phase5 option guard, do not duplicate its implementation. | Verify startup hold, all four worlds including Demo, Help, student fields/dialogs, chooser and results. Test key consumption plus following ordinary input, not just the notice. Browser quit remains a notice, never `window.close()` or an invented confirmation screen. |
| 1 | Extend the local bootstrap with `startup-inspect.py`, `celebration-inspect.py`, `audio/decode.py`, then build app data last. | A source-only checkout has none of their generated inputs. Fresh regeneration succeeded below. The frozen Phase4 builder does not bundle Phase5/audio; its consumer changes still belong to integration. |
| 2 | Emit the missing source audio requests, without duplicate events: Practice correct/wrong1/11, repeated Outside jump2, shared pointer rising-edge8, menu music2/stop. Correct Water `prompt`/`prompt-stop` documentation and routing. | `prompt` calls are finger graphics, not speech. Effects1/11 bypass Sound bit2. Unsupported music/effects/RS must remain explicitly silent, not synthetic tones or guessed speech. |
| 2 | Leave certificate output disabled; apply the Phase5 `resultNextState` queue/save ordering. Preserve all three completed/printed/pending arrays. | Next queues before its save, not on celebration entry. Completion/pending never proves paper output. No pending consumer or printed mutation was established in the traced manual print path. |
| 3 | Recover Practice's input-cell cursor and finger-hint rendering using the real graphics service. Optionally bind the source mouse raster and its save/restore pump. | These are feasible missing components. Do not call a static blue cursor or silence for `prompt` a faithful translation. Trace palette/text-state restoration and source callbacks before enabling them. |
| 3 | Resolve menu palette88 and any remaining modal/world intermediate palette callbacks. Reuse Phase5's exact RGB6 arithmetic where the callee matches. | Final palette writes are recovered; hardware duration is not. Do not invent12 browser frames per fade. Preserve palette index88 for hit interception even if its visible color remains labeled provisional. |

The first three rows bound the Phase6 integration gate. The lower rows identify recoverable omissions after the six bundles, not permission to quietly expand their scope. Music/effect synthesis and RS speech are also feasible static translation projects, not fundamentally impossible host behavior; their remaining complexity does not justify guessed audio.

## Evidence and inspection

Every executable address here is a **FILE offset** in `MarioTea/MARIO/MARIO.EXE`. DS maps to FILE `0x1f270 + DS`; MZ image begins `0x2e00`. Far target = `0x2e00 + 16*segment + offset`.

| Original input | SHA256 |
|---|---|
| `Mario_Teaches_Typing_1992.zip` | `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd` |
| `MarioTea/MARIO/MARIO.EXE` | `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e` |
| `MarioTea/MARIO/MARIO.CNF` | `e3805d4f4692d3e70d0e9f3bcbaacbc859127cc175bf8447561682206a0aeacc` |
| `MarioTea/MARIO/ENGLISH.MSD` | `fd2168878e19b1b85ae0c6ce8e14ad4386a801e7c460ed134bde5f181cb29e15` |
| `MarioTea/MARIO/CERTIF.CRX` | `03fd9c5f92756d72b8013a7d60fdc5ba691b01d594b9b08e80d4d221370ae970` |

Method: direct ZIP byte/hash reads and newly authored static ELF wrappers passed only to trusted system `objdump`. The worker-local inspector compared5,992 printed byte records to ZIP bytes. Some ranges include tables or partial surrounding instructions; byte equality is not proof that those bytes execute. Routine boundaries and branches, not linear table disassembly, support the findings. No archive executable, driver, installer, script or machine-code interpreter was run. No wiki/task writes, delegation, commits or pushes occurred.

Supporting contracts: [MENU](MENU.md), [REPORT-HELP](REPORT-HELP.md), [REENTRY](../runtime/REENTRY.md), frozen `p5-startup/transpile/analysis/control/STARTUP.md`, frozen `p5-celebration/transpile/analysis/control/CELEBRATIONS.md`, and audio worker at `/Users/roberthowley/src/github.com/brooklyn-plumber-teaches-typing/transpile/.worktrees/p6-audio/transpile/analysis/audio/AUDIO.md`. Source inspection below supersedes stale statements in COVERAGE/ASSUMPTIONS where specifically noted; this worker does not edit those shared documents.

## Startup devices, option10 and input

### Devices are supplied host capabilities, not missing automatic detection

- `0x96e5..0x97f7` zeroes20 configuration bytes then reads `mario.cnf`, parses the first letter and an integer from each line, and copies music selection to effects. Jump table `0x97f8` maps A/D/E/F/I/M/T/V/Z; default initializer `0x9693..0x96e4` is for missing config, not the supplied file's values.
- Actual `MARIO.CNF` contains V0, M4, D3, F7, Z0, A544, I7, E1, T1. Thus the archive requests video0, music/effects4, speech3 and option word7. It does not request default RS speech1. This does **not** establish successful DOS device initialization. Audio availability is a separate result from `0x1837c` and the inert driver paths in AUDIO.md.
- Video selection `0x125e9..0x12614`, `0x14486..0x1450b` selects graphics-mode paths and restores text mode on teardown. Browser indexed320x200 output is an adaptation, not a video-card probe.
- Mouse initialization `0x1c02c..0x1c0e6` checks INT33 vector presence, rejects an IRET stub, calls reset function0, stores availability DS:5279 and initial pointer/button state. The later sample uses function3 at `0x1c0e7..0x1c14f`. Do not interpret browser pointer availability as a recovered DOS detection result.
- Break/error setup `0x122fb..0x1239c` installs INT23/INT1B handlers and changes DOS break checking; `0x12284..0x122fa` restores handlers. A web page cannot own these vectors. The source empty interrupt handlers at `0x1224c` and `0x12268` are not evidence for invented keyboard shortcuts or browser OS-error dialogs.

Smallest adaptation: explicitly supply available browser pointer/audio transport and selected source option/device values; report failures visibly. Do not launch configuration programs/drivers, emulate interrupts, probe ports, or turn on a substitute audio device as an undisclosed fallback. Existing save layout is unrelated to these choices.

### Exact option10 semantics

`0x15034..0x15094` lazily caches signed16 `atoi(getenv("KWD"))` at DS:2892, initially-1. Missing environment stores0. It returns the **signed comparison cachedValue >= argument** (`0x1507e..0x1508d`). "Option10" means querying threshold decimal10, not testing bit0x10 in audio word DS:5038. A negative parsed value leaves the cache negative and can trigger another lookup. There is no implemented browser KWD environment source and no reason to add one just to reproduce a developer configuration.

- `0xfbb6` uses it to bypass startup; `0x12c13..0x12c4e` still consumes the Outside delay draw before overriding delay to15. Progression gates can also admit an early-exit result when this query is true. Do not globally translate it as `canQuit`.
- Ordinary menu Q/Alt-X calls quit directly at `0x115a7 -> 0x149fc`; no threshold check precedes that menu branch. Source Escape merely closes a dropdown.
- Lesson and modal Alt-X paths conditionally query10, e.g. Outside `0x13b58..0x13b77`, Practice `0xb712..0xb73d`, manual certificate `0xadb1..0xadc4`. Disabled Alt-X is consumed but is not an abort, a scored printable key, a result transition or a quit request. Startup hold consumes it and continues when disabled (`0xfdeb..0xfe26`). Phase5's other worker owns the current correction.
- Quit helper `0x149fc..0x14a1e` invokes cleanup and exit service with status0; it does not create a quit-confirmation dialog. Browser notice is the explicitly limited transport. Do not interrupt the source lesson merely to display that notice when the guard was false.

### Queue bounds: do not guess a BIOS buffer size

- C raw read `0x4a41..0x4a59` uses a single C **pushback byte** DS:3cef/flag3cee, otherwise DOS INT21/AH07. Pending `0x4ddb..0x4dec` checks pushback then DOS AH0B. This is not a recovered16-key BIOS queue.
- Normalization `0x19241..0x1927e` reads another byte only when prefix0/E0 and pending; it then adds0x100. Flush `0x19221..0x19240` drains raw reads. Queue/typematic capacity beneath DOS is external and unestablished here.
- Browser `createPendingInput()` is intentionally unbounded; Outside/Practice's ordinary host latch drops excess events while Water/Castle use FIFO draining. These are different delivery adaptations. A fixed invented BIOS capacity would change controller pending-suppression/RNG behavior without evidence.
- Do not confuse host FIFO with Castle's recovered2,000-word metadata queue/500-byte sentence bound, chooser's30-name enumeration limit, or VOC's two0x4000-byte driver buffers. Those are proven game/resource bounds and must remain enforced.

## Three independent clocks

| Source service | Recovered behavior | Smallest faithful host treatment |
|---|---|---|
| `0x39b8..0x3a0f`, `0x333f/0x3352`, `0x7030..0x7159` | DOS date/time fields become signed32 seconds; seconds only, not hundredths. Startup passes only AX to srand at `0x126a0..0x126b3`. | Keep explicit `wallSeconds` and low16 seed injection. Default modern `Date.now()` is a labeled adaptation, not the same DOS session seed. |
| `0x735e..0x754b`, `0x754c..0x7628` | TZ parser expects three letters then signed/integer whole-hour offset; optional following three letters enable the old DST calculation. Invalid/missing TZ uses EST/EDT, +18,000 seconds. DST subtraction is one hour. Historical April/October boundary rules are not current browser timezone rules. | Existing `dosTimeSeconds` already accepts explicit offset and active-DST inputs. Retain that seam. Full TZ parser is feasible but not required to change normal browser persistence or UI. Do not claim `Intl` supplies the source algorithm. |
| Wait `0x192a2..0x192e1` | Wait until BIOS DX **low16** differs from retained DS:4e2c. One observation completes one wait. Equal low word, even after65,536 ticks, completes none. `65535 -> 0` completes one. | Share the Phase5 changed-low-word wait adapter across startup/modal/worlds, no catchup. Keep it distinct from elapsed ticks and Practice Demo's separate DS:41ac sample. |
| Tick sample `0x19317..0x1935a`, timer `0x15afb..0x15c35` | Full CX:DX participates in signed32 differences/accumulation. No midnight repair or use of BIOS rollover flag is visible here. | Low-word rollover must not reset elapsed time. Keep current monotonic browser clock an explicit adaptation; do not add a guessed24-hour correction to recovered arithmetic. |

Host focus suspension,18.2Hz conversion, browser stalls and loading/audio latency are not recovered DOS behavior. Blur currently stops active updates/timers, while wall inactivity continues: Water can fail immediately after a long pause; Practice's face can be overdue. Preserve/document that current policy rather than silently modifying source wall timestamps. Source busy-loop callbacks may run many times between ticks, so one RAF callback is not a universal source polling cadence.

## Student bytes, last-used pointer and errors

**No storage migration or layout change is needed.**

- Source `.STU` read/write length is exactly0x104 (260), `0xe296`/`0xe34c`; save requires profilePresent, writes magic `1a535455` and clears demo (`0xe2df..0xe36f`). Preserve unknown/reserved bytes and completion38..40, printed41..43, pending44..46 independently.
- The file load branch checks successful open, not returned byte count or magic. It then calls student op0xafb at `0xe2ac`, whose service entry normalizes the loaded fields before ranking problem keys, then clears demo/sets profilePresent. Malformed DOS files are not a compatibility target: browser `readStudent/loadProfiles` rejects wrong lengths/byte arrays. Do not weaken validation to reproduce partial-memory reads.
- Last-used save `0xe536..0xe590` writes `carryon` in text mode with format `%s`, no added newline, only if profilePresent; otherwise deletes it. Load `0xe593..0xe60b` reads with fgets bound20, copies nonempty text to the name, then calls `.STU` load. Startup invokes op0xaff at `0x12684`; cleanup routine `0xe128..0xe14d` invokes op0xafe. A missing file is not a request to create a saved Demo/Guest.
- Browser contract remains `mtt-static-translation.students.v1` JSON `{current,students}`; each value is an array of260 integer bytes. `Session.save` prepares bytes, reuses an existing case-insensitive name key, updates that record and `current`, then writes the whole JSON once. Unrelated records are retained. `current` is a host pointer updated on save, not literal DOS carryon bytes or its shutdown timing.
- Write failure currently occurs **after in-memory profiles mutation**, is rethrown by Session and displayed by main as memory-only changes. This is not an atomic filesystem transaction or rollback. Keep that visible existing behavior; do not add migration/journaling or rename confirmation. Source rename deletes OLD before saving NEW (`0xf3d8..0xf420`), so it is not recoverably atomic either.
- Source error UI `0x123d2..0x125b8` presents Retry/Abort-related messages and dispatches to DOS/C error services. Filesystem read/write permissions, disk-full recovery, drive paths, allocation failure and interrupt behavior cannot be made equivalent through localStorage. Existing visible storage/resource exceptions are the bounded adaptation, not a simulated successful disk write or invented recovery dialogue.

## Certificates: real document, not screenshot printing

Recovered manual path `0xaaf9..0xaea6` is profile-gated, lists completed worlds on CERTIF, and can select an already completed world. It does not require pending=true or printed=false for manual selection. `CERTIF.CRX` is the **selection UI**, not the document sent to the printer.

- Next scheduling `0x103be..0x103f7`, then `0x10457..0x10475`: set pending only when profilePresent && completed && !printed && !pending; save afterward. Never collapse these three byte arrays or mark printed merely because Next was pressed.
- Document `0xb069..0xb0a5`: allocate60 row buffers of81 bytes (`0xa8f0..0xa974`), fill80 spaces + NUL, draw `*` border (`0xb001..0xb068`), add **31 rows of executable character artwork** (`0xaecf..0xaf15`, far-pointer table FILE `0x20d4e`, indices0..30), then source-centered message/student/world text (`0xaf16..0xb000`, MSD4200..4205). Artwork rows are0..46 characters; this is not an omitted bitmap graphics driver. First row data FILE `0x20de7`, final empty row `0x21369`.
- Output `0xa9a3..0xa9f5` formats each row as `%-80.80s\r\n` (format FILE `0x20dd2`) and calls `0x14a32`; at the wrapper boundary a full document is60 rows *82 bytes =4,920 bytes. Underlying text stdio/device translation remains distinct from this formatted-string count.
- `0x14a32..0x14a8b` writes bytes through C stdio `0x65ce` and FILE object DS:3a60, clearing/checking error byte DS:4f98. The caller stops rows when this wrapper returns nonzero. The traced hook `0x14a1f..0x14a31` does not establish successful paper output or a new printed flag. Do not convert `fputc` invocation into a success acknowledgement.
- No completed/printed/pending mutations occur in the traced manual document builder/output routines. Direct indexed references in the checked listing show pending writes in the Next queue, not a proven automatic printer spooler. Indirect/untraced consumers remain unknown; do not invent retries or flag clearing.

The selection controller and exact text document are feasible remaining game components; real OS printer transport and evidence of physical printing are host-specific. For Phase6 the smallest correct behavior is retain flags and the explicit unsupported certificate request. No browser print dialog, PDF/export button, screenshot certificate, modern template, forced printed flag or new printer UX is proposed.

## Pixels and callbacks that are still recoverable

- **Mouse:** `0x148aa..0x149e0` saves a14x12 backing rectangle, writes the nonzero pixels from DS:3127 (FILE `0x22397`,168 bytes), repeatedly samples pointer/callback, then restores the backing raster. `0x1486a..0x148a9` caps x305/y187, consistent with that footprint. Browser CSS cursor is a transport/art substitution; the raster and dirty restoration are recoverable. Preserve modal button-change semantics (`0x147f2`), not every pointer move, and sound8 only on bit0 rising edge (`0x149a8..0x149c1`).
- **Practice cursor:** `0xb63f..0xb69b` establishes cell coordinates/colors, opaque state and the source text-input cursor service `0x1acbd`, supplying callback `0xb4ea`, flags4 and wait values4/2. This is related to the already recovered student cursor service, but its callback also updates expression, statistics, Demo and timeout (`0xb4ea..0xb5f0`). Reuse only after translating that caller ordering; a generic millisecond blink loses game callbacks.
- **Finger hints:** `0x18019` dispatch1101/1103 performs graphics blits (`0x18070`, `0x180b5..0x18126`, callee `0x7a47`). Water uses these at `0x17524..0x17556`; Practice requests them at `0xb62f..0xb647`. They are not per-letter speech. Real hint-resource binding/rendering is missing game behavior, not browser audio denial.
- **Palette/font state:** welcome glyphs explicitly use index88 (`0x10a04`); menu pointer interception scans that index, not RGB red. Provisional color12 and incomplete palette callbacks remain recoverable work. Intermediate fades `0x14bb4..0x14d8a` have integer RGB6 writes and optional wait/callback behavior; Phase5 startup/celebration callers pass wait0. Browser may coalesce those writes, but must not invent wait/RNG/input operations between them.

## Audio synchronization reviewed against the isolated worker

AUDIO.md recovers4 PCM VOC clips,158,254 samples;58 other sound-related members remain unsupported. Exact clip/resource identities and event call sites stay there; do not recopy guessed drivers into app data.

- `0x176c7` Water Ready is synchronous; `0x176d0` music3 and subsequent last-input sample follow it. Earlier stats/timer start at `0x16d06` must remain earlier. Splitting only main's draw queue is insufficient if `createWater` already sampled time.
- Castle `0xc060` Ready precedes music4 and continuation in the first operation tail. Outside `0x13e04` Ready precedes music1/ordinary loop. Results `0x165fc`/`0x16603` speech returns before input pump initialization; use existing result speech predicate and previousGoal.
- VOC loop `0x18a95..0x18bfb` drains pending input repeatedly and on return. Blocking does not mean key-to-skip. RS `0x18c2a..0x18d21` has different input/timing machinery, still unsupported. No historical clips queue for later autoplay unlock.
- Audio worker adapter outcomes (`locked`, denied, muted, suspended, missing or unsupported) require explicit omission completion before resuming a blocking source continuation. Source option S/G toggles do not equal host mute; correct/wrong feedback1/11 bypasses S. No guessed silent delay substitutes for a failed clip.

These are game sequencing fixes. Browser gesture unlock, device resampling/latency, synthesis hardware and actual audible-output fidelity remain host limits. Source music/effects/RS decoding is still potentially recoverable, while DOS hardware execution is forbidden throughout.

## Clean-checkout regeneration

Run from the repository/worktree root with the owner-supplied hash-pinned ZIP in `$HOME/Downloads`. Requires Python3, Node and trusted LLVM/Apple `objdump` supporting code16 flags. No archive program or driver is a prerequisite. Do not copy derived resources from another checkout.

After importing the three authored worker inspectors, run this sequence (18 scripts):

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
python3 -B transpile/tools/control/menu-inspect.py
python3 -B transpile/tools/control/report-inspect.py
python3 -B transpile/tools/control/startup-inspect.py
python3 -B transpile/tools/control/celebration-inspect.py
python3 -B transpile/tools/audio/decode.py
python3 -B transpile/tools/build-app-data.py
```

- Worlds inspect must precede control evidence/tables, world verification and celebration inspect. It regenerates `analysis/worlds/disassembly.txt`; no stale/research fallback is necessary. `control/disassemble.py` is optional focused evidence, not an app/test input.
- Render decode precedes Water bindings and the builder; asset pipeline supplies the original-derived inert `.data` bytes used by host tests. Menu/report inspectors supply `.tmp/menu/evidence.json` and `.tmp/report-evidence.json`.
- Startup inspect creates `assets/startup/manifest.json`, palettes/rasters/listings; celebration inspect creates `assets/render/celebration/bindings.json`; audio decode creates `assets/audio/manifest.json` and4 PCM files. All stay ignored. The builder must consume the integration's agreed startup/celebration/audio schema, not be replaced with the frozen Phase4 version.
- Python app tests rebuild resources; run in an isolated checkout when preserving local presentation data matters. Node tests need no npm dependencies. Browser tests separately require supplied Playwright and Google Chrome; they are not validated by asset regeneration or this worker's checks.

### Fresh-input experiment and exact checks

The worker copied only inspected authored tools into empty `.tmp/host/regen/transpile/` with empty `app/` and `.tmp/`, added frozen worker inspectors, and ran the sequence above twice. No existing evidence/assets/generated tables were copied. Tool snapshots and command logs remain ignored locally.

| Frozen additional inspector | SHA256 of authored script used |
|---|---|
| p5-startup `tools/control/startup-inspect.py` | `f4c696d3a6e894ee2f7e96bcd5e70126d53e2af3277691cec869df5cd8cc2409` |
| p5-celebration `tools/control/celebration-inspect.py` | `095e31f17ca5aea57468ba227bf0e3d09db74aabf982e059c88783017094af09` |
| p6-audio `tools/audio/decode.py` | `57a71981e931395c2d1d8f1da4ed6950239195dc1e68a3f064fed8e544b8941e` |

- `structured_return`: `python3 -B transpile/.tmp/host/regen.py`, twice, both exit0. This worker-local runner invokes the18 exact scripts above, captures each log and stops on failure. Second run matched **all2,529 generated files** under analysis/assets/recovered/app byte-for-byte in the same empty-origin tree. The count excludes `.tmp/` evidence/logs and tools. Frozen Phase4 `app/data.json` is5,660,250 bytes. This is not proof of the main integrator's changing builder or a fresh npm/Chrome install.
- New `node --test transpile/tests/control/host.test.mjs`:8 contracts, using hash-checked inert EXE bytes plus existing exports. Initial run7 passed/1 failed because a test assumed a near call at menu Quit; actual bytes prove a far call. Assertion corrected against ZIP, no production change.
- First full baseline Node run had193 passes/3 module failures because this worktree lacked generated menu/report inspector inputs. Ran `python3 -B transpile/tools/control/menu-inspect.py` and `python3 -B transpile/tools/control/report-inspect.py` locally; no source fix was necessary.
- Final `structured_return`, `node-test-text`: `node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs`, **221 passed**. New tests cover KWD bytes/unconditional menu quit, host FIFO vs source pushback, low/full tick rollover, explicit DOS calendar inputs/seed, preservation of all260 bytes, last-used storage contract, malformed/write-denied storage and certificate text/flag separation.
- Final isolated host rerun: `node --test transpile/tests/control/host.test.mjs`,8 passed through `structured_return`. `git diff --check` passed; explicit scans of both new untracked files found no trailing whitespace or em dashes. `git status --short` contains only the two owned authored files; scratch outputs were confirmed ignored.
- No browser/audio playback, Python decoder suite or integrated Phase5/6 regression result is claimed here. Final integration must run the PLAN suites plus new audio suites and independent verification. Static-source tests are not an executed-DOS comparison.

## Remaining after the six bundles

- **Recoverable missing components:** supported audio continuation/request wiring if not yet integrated; music/effect synthesis and RS speech; source certificate selector/document; Practice callback cursor and finger hints; source mouse raster; menu palette88 and untraced intermediate palette/text callbacks. Retain their exact boundaries above, not a general claim of full decompilation.
- **Deliberate host substitutions:** DOM key/pointer delivery, unspecified underlying DOS queue/typematic, focus suspension, observed tick scheduling, modern wall time/seed default, cached resources, localStorage/current pointer and visible exceptions, WebAudio unlock/resampling, process-quit notice, no printer transport.
- **Still unknown:** DOS/device-specific successful initialization, actual printer/error-driver outcomes and any untraced flag consumers, hardware busy-loop/DAC cadence and synthesis output. No omitted content may be enabled by assuming one of these outcomes.
