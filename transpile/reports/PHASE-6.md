# Phase6: bounded audio and host corrections

Four exact VOC clips now play at source call boundaries. Phase5 was independently verified and pushed as `764788a` (user-provided status); Phase6 remains local, uncommitted and unpushed. This is not a claim that every source component is complete.

## Imported scope and safety

- Read `AGENTS.md`, Phase6 PLAN, presentation audio handoff, Phase5 host handoff and the prior audio static audit (`continuation/phase4/verification/03-second-opinion.md`, LGTM).
- Imported only the audio worker's six authored paths actually present: `tools/audio/decode.py`, `recovered/audio/audio.mjs`, `app/audio.mjs`, `tests/audio/{audio.test.mjs,test_decode.py}`, `analysis/audio/AUDIO.md`. The request said seven, but both its handoff and worktree listed six. No generated audio, assembly listings or other worker files were imported.
- Imported only host `analysis/control/HOST-GAPS.md` and `tests/control/host.test.mjs`.
- All mutations stay under `transpile/`. No delegation, commits, pushes, staging, wiki or task operations. No archive executable, driver, script or original machine code was executed, emulated or loaded as code. Only inert byte readers/decoders, trusted static objdump and newly authored Python/JavaScript ran.
- PID59919 continued listening on127.0.0.1:4179. Playwright used4199 and never replaced that server.

## Implemented behavior

| Owner / boundary | Integrated behavior |
|---|---|
| `tools/audio/decode.py` | Strict single-block VOC decoder; exact158,254 unsigned8 mono samples across congrats34,008, ready40,099, toobad46,462 and welcome37,685. Nominal rate1,000,000/56 Hz. Hash-pinned archive/EXE/CNF/VOCs, bounded malformed-resource rejection and58 unsupported member records. |
| CNF / builder | `decode_config` reads actual supplied M4/D3/F7 into music4/effects4/speech3/options7. No speculative missing-config RS default. `tools/build-app-data.py` bundles config, provenance, inventory and exact PCM bytes into ignored `app/data.json`; no resource-name guessing in main. |
| `SourceAudio` | Independent M/S/G gates, effect1/11 S bypass,11 alias10, request/stop ordering, explicit availability, blocking token and completion ownership. Unsupported music/effect handles represent requests only, never audible synthesis or guessed durations. |
| `BrowserAudio` / main | Trusted gesture unlock; real mono Float32 AudioBuffers with every sample `(byte-128)/128`; visible separate browser mute and source options. No oscillator, speech synthesis, fallback clip or historical request queue. Browser availability is explicitly supplied transport policy, not successful DOS driver detection. |
| Water entry | `createWater(...deferReady:true)` returns phase `ready`. Its timer already runs. `Session.completeAudio` resumes `resumeWaterEntry`: music3, then a fresh wall-time lastInput sample. No world/RNG/input pump advances during Ready, and Ready elapsed time is included in lesson ticks. |
| Castle entry | First operation-tail effects remain behind their changed-tick wait; Ready suspends consumption before music4 and before the next controller operation. No replay of effects after additional RNG/movement. |
| Outside entry | Ready completes before music1 and the ordinary tick. Menu cleanup music-stop precedes corpus/world initialization. |
| Welcome/results | Welcome holds before menu pump initialization or resumed idle pump. Result speech uses the existing previous-goal predicate, before suppression reset, flush and results input initialization. Practice/Demo/suppressed cases retain source gating. |
| Effects | Water/Castle sounds dispatch from their actual controller emission sites. Outside correct/wrong/destruction and repeated jump2 dispatch within tick before later work. Practice emits one correct/wrong1/11. Pointer sound8 uses left-button rising edges. M toggles immediate music2/stop, S/G change future gates. Bonus sound7 uses decoded one-based callback tables, including newly bundled Outside table bytes. No duplicate batch replay. |
| Omission/focus | Blocking speech awaits only the trusted gesture unlock already in flight at its source boundary. Earlier locked speech is never replayed. Locked, denied, muted, missing, failed, suspended or blurred speech settles visibly as omitted and releases its continuation without a guessed wait. VOC input is suppressed/drained through completion. Speech itself does not pause a running timer. Blur stops PCM and applies the existing explicit host focus pause; wall inactivity continues. Host editor/load actions cannot mutate source state during blocking speech. |
| Alt-X/storage/printing | KWD>=10 is separate from audio bits. Disabled Alt-X is consumed without abort/quit across startup, worlds, Demo, fields, chooser, Help and results; world inactivity handling still sees actual consumed input. Ordinary menu Quit remains unconditional, notice only. Storage namespace/layout and260-byte records unchanged. Certificate completed/printed/pending remain independent; printing stays disabled. |

Water/Practice `prompt` and `prompt-stop` are graphics service1101/1103, not speech. The old Water controller documentation was corrected; finger-hint graphics were not invented.

## Review corrections

Two later findings corrected the original acceptance claim: first-menu-key Ready raced an in-flight browser unlock, and 38 disassembly headers contained checkout paths. Both have bounded fixes and focused regression evidence in `PHASE-6-FIXES.md`. Independent full recheck is pending; the earlier verifier PASS is not current approval.

## Verification

All commands below ran through `structured_return`. Paths are relative to the repository root.

| Check | Exact command / result |
|---|---|
| Audio/build | `python3 -B transpile/tools/audio/decode.py && python3 -B transpile/tools/build-app-data.py`, exit0. |
| Full Node, including audio | `TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{app,control,outdoor,worlds,runtime,render,audio}/*.test.mjs`, **305 passed**. |
| Python assets | `python3 -B -m unittest discover -s transpile/.tmp/phase6-rebuild/transpile/tests/assets -p 'test_*.py'`, **19 passed**. |
| Python render | Same command with `tests/render`, **5 passed**. |
| Python app | Same command with `tests/app`, **9 passed**. |
| Python audio | Same command with `tests/audio`, **11 passed**. Total Python **44 passed**. |
| Full native Chrome | `TRANSLATION_PORT=4199 PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/browser/phase6-results.xml node_modules/.bin/playwright test -c transpile/playwright.config.mjs --reporter=junit`, **38 passed** on the final source. |
| Existing live server | `LIVE_EVIDENCE=phase6-live-server-evidence.json node --test transpile/.tmp/live-server-smoke.test.mjs`, **1 passed**. Reused4179, actual source target typed in every world, correct counter increment/no errors, Escape results and menu, no failed requests/page errors. Local evidence `.tmp/phase6-live-server-evidence.json`. |
| Whitespace/scope | `git diff --check HEAD`; separate untracked authored-file whitespace checks; index remained empty. Assets and temporary rebuild outputs are ignored and unstaged. |

### What the tests prove

- Fake transport checks every actual decoded sample, stop/option semantics, busy/stale completion, missing data, mute, suspended/closed context and denial/retry.
- Native Chrome schedules all four real PCM buffers and compares every sample against decoded data; each source token remains blocking until native `ended`.
- Real Water Ready suppresses attempted input/Escape, starts music3 only after completion and includes at least39 host ticks of actual speech time, rather than skipping Ready to obtain a timer pass.
- Native denial releases speech, and a later trusted unlock never replays skipped welcome/Ready. Blur/mute release active speech, unmute/focus do not replay it.
- Node tests hold Water/Outside/Castle/welcome/results continuations across delayed completion. Water tests verify refreshed lastInput, exact elapsed ticks, attempts/correct and strict >20 inactivity with the proper stopped timer.
- Natural versus skipped startup tests prove13 versus0 title effect1 calls and only the source welcome speech, not invented decorating/per-letter speech.
- Chrome exercises disabled Alt-X in fields, chooser, Help/results and all four worlds both normal and Demo. Existing source tests cover startup hold and both option states. Storage and certificate byte contracts continue passing.
- Initial full Node run exposed stale silent-status assertions and two frozen Phase4 host fixtures. Initial Chrome run exposed stale option0 expectations and tests sending Escape during newly drained Ready input. Those tests now explicitly mute non-audio scenarios and wait for source readiness, rather than weakening audio draining.

These are static-byte and authored-browser proofs, not an executed DOS differential comparison or an audible hardware-quality assessment.

## Fresh-input rebuild

The full18-script recipe in `PLAN.md#fresh-clone-local-inputs` now includes `tools/audio/decode.py` before the builder. A source-only temporary tree at `.tmp/phase6-rebuild/` received authored tools/tests/modules, not existing resources/evidence/generated tables. It ran Phase1 through Phase5 inspectors, audio decoder and builder in order, then all four Python suites. No raw project data was overwritten.

- Runner: `python3 -B transpile/.tmp/phase6-rebuild.py`, exit0.
- Corrected count from the independent two-snapshot rebuild: **2,525 generated outputs outside `.tmp`**, including generated `recovered/worlds/tables.mjs`. Before the review fix, 2,497 matched and 28 listing headers differed. Another 10 menu listing headers differed inside `.tmp/menu`. The earlier 2,529 count did not have a reproducible scope and is withdrawn.
- After regenerating only the three affected inspectors in each existing snapshot, all **2,525** outside-`.tmp` outputs, **11** menu outputs (10 listings plus evidence), and **3** other `.tmp` evidence JSON files matched, **2,539 meaningful outputs** total. Path-bearing build logs are not durable generated outputs. This focused repair is not a new full clean bootstrap; independent full recheck remains pending. See `PHASE-6-FIXES.md`.
- Rebuilt `app/data.json` matched main byte-for-byte, SHA256 `066edada0ea12b065463a5494827f727498e9fab3d3dd740f964e5bd9693c93a`.
- Fresh dependency installation, another OS and physical sound hardware were not tested. Python app tests rebuilt only the isolated tree, preserving main's live assets.

## Remaining recoverable work and host limits

- **Recoverable audio:** music/effect synthesis, RS speech and the58 inventoried sequence/bank/driver resources remain silent. Driver execution is forbidden; any future work must be new static translation. Menu's default invalid-command effect10 remains documented in AUDIO.md but is not newly exposed by this bounded integration.
- **Recoverable visuals/control:** original mouse raster/save-restore pump, Practice callback cursor, finger hints, original welcome palette88 and remaining intermediate modal/world palette/text callbacks. These are missing components, not inherently impossible browser behavior.
- **Recoverable certificates:** source selector and exact60-row text document, plus untraced flag consumers. No printer transport or printed-flag success is claimed.
- **Host adaptations:** DOM input/typematic/queue policy,18.2Hz observed scheduling, epoch clock/seed, focus pause, cached resources, localStorage/current pointer, WebAudio unlock/resampling/latency and process-quit notice. DOS device initialization, busy-loop/DAC timing, filesystem/printer outcomes and audible equivalence remain unknown or unverified.
- Independent Phase6 review and any publication authorization remain outside this worker's work. No source component is marked complete merely because its resource exists.
