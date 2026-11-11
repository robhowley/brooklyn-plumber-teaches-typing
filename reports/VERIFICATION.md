# Final independent verification

## Verdict

**PASS**: The bounded Outside and Practice app, inert-archive pipeline, documented limits, and authored verification checks satisfy the stated acceptance criteria. Tests exercise translated behavior and inert data, not the original runtime.

## Acceptance checked

- Hash-verified ZIP parsing and inert `.data` extraction; root tracked files remain unchanged.
- No original executable, archive script, driver, emulator, or interpreter was run. Decoders and worker commands were inspected for static/data-only behavior.
- Separate browser app uses the recovered Outside and Practice APIs, recovered art, and all lesson corpora. Results/Next, profile/guest handling, persistence, and focus behavior are exercised.
- Water/Castle and unsupported commands are visibly disabled. Current `COVERAGE.md` links the superseding runtime/render evidence and explicitly bounds claims; older handoffs are not presented as current status.
- Mechanics and assumptions cite FILE offsets, member/resource provenance, adaptations, and unknowns. README instructions are reproducible; this run avoided the real-output data generator.
- Outside/Practice transitions, event ordering, bonus clock and input handling, RNG state, practice wrap/input/expression, profile/guest progression, supported field combinations, storage/assets failures, focus loss, and browser operation were reviewed and tested.

## Evidence

| Claim checked | Command or source | Result | Decisive detail |
|---|---|---|---|
| Initial/final workspace boundary | `git status --short`; `git diff --exit-code -- .`; `git diff --cached --exit-code -- .` | PASS | Status was only `?? transpile/`; no tracked or staged changes. Report and scoped test artifacts are under `transpile/`. |
| Archive identity and inert extraction | `sha256sum "$HOME/Downloads/Mario_Teaches_Typing_1992.zip"`; `TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/assets -p 'test_*.py'` | PASS | ZIP hash `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`; 19 tests passed, including fresh archive rebuild, hash/CRC/path validation, and inert file naming/modes. |
| Translated APIs and arithmetic | `TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs` | PASS | 80 tests passed across all six folders. |
| Render decoders and source bindings | `TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/render -p 'test_*.py'` | PASS | 3 tests passed; ZIP resource hashes, GCO/BAN/ANI decoding, palettes, tile, and executable byte spans validated as data. |
| App bundle tests without real-output generation | `TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/.tmp/app-suite/transpile/tests/app -p 'test_*.py'` | PASS | 3 tests passed in an isolated staged copy. The deterministic rebuild wrote only to `transpile/.tmp/app-suite/`, not real app outputs. |
| Chrome behavior and local requests | `TMPDIR="$PWD/transpile/.tmp" PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/browser/results.xml node_modules/.bin/playwright test -c transpile/playwright.config.mjs --reporter=junit` | PASS | 8 Google Chrome tests passed for menu/results, Outside, Practice, focus, persistence/guest, bonus, storage denial, missing assets, and no executable/archive requests. |
| Supported long-session stress | `TMPDIR="$PWD/transpile/.tmp" node --input-type=module -e 'import fs from "node:fs"; import {Session,editStudent} from "./transpile/app/session.mjs"; import {newStudent} from "./transpile/recovered/control/student.mjs"; const d=JSON.parse(fs.readFileSync("transpile/app/data.json")); let max={distance:0},failures=[]; for(let seed=0;seed<100;seed++){const s=new Session(d,{bytes:editStudent(newStudent("Probe"),{minutes:60}),seed});s.start(0,1);try{for(let i=1;i<=65520&&s.active;i++){const a=s.outdoor,o=a.targetIndex>=0?a.obstacles[a.targetIndex]:null;let k=o?.code??0;if(s.bonus?.mode===2&&k===s.bonus.code)k=0;s.step(k,i,Math.floor(i/18.2));if(a.distance>max.distance)max={seed,i,distance:a.distance};}}catch(e){failures.push({seed,error:e.message,iteration:s.clock.lastTicks,distance:s.outdoor.distance});break;}}console.log(JSON.stringify({seeds:100,max,failures}));'` | PASS, bounded | 100 fixed-seed 60-minute sessions ended normally; max signed distance 30,025 (seed 8), below the 32,768 wrap. This is a stress sample, not exhaustive proof of all inputs. |
| Source/config scope and original-execution constraint | Read `transpile/tools/assets/pipeline.py`, `transpile/tools/render/decode.py`, `transpile/tools/build-app-data.py`, Playwright config/tests, and implementation/integration worker transcripts | PASS | Pipeline parses ZIP members as bytes and writes inert `.data`; render code uses understood decoders; app builder only bundles decoded resources. Worker commands show static extraction/disassembly (`objdump`) and authored tests, no emulator/runtime launch. |

## Integration review

- `transpile/app/session.mjs` follows recovered `tick` ordering and shares the low-16-bit seed across group selection, corpus segment, bonus draws, and obstacle draws. Bonus interception pauses the scoring clock and does not count as ordinary input; cinematic completion resumes it. Practice delegates line buffer, acceptance, and expression calculations to recovered APIs.
- Start/finish/Next behavior preserves Outside progression gates and Practice mode. Guest profiles do not persist or advance. Duration fields clamp to 1..60; supported characters/groups and source corpus selection have tests. Water/Castle routing reports disabled instead of substituting a playable world.
- Browser key dispatch is attached to the canvas, not globally to editable form controls. Focus loss clears pending input and freezes active ticks; focus restoration resumes. Storage read denial/corruption and missing bonus resources are visible. A write failure is caught in `main.mjs`; `Session.save` updates in-memory state before the attempted write.
- The app fetches its authored modules, JSON and decoded bonus frames. Browser tests assert no `.EXE`, raw archive, ZIP, or old `src/` requests and observe no page errors in supported flows.
- `README.md`, `COVERAGE.md`, and `ASSUMPTIONS.md` clearly distinguish recovered routines from host adaptations and unsupported areas. COVERAGE explicitly points to newer runtime/render reports; prior gap ledgers are historical where superseded, not silently treated as current behavior.

## Must Fix

None.

## Residual Risk

- No DOS differential execution, exhaustive decompilation, or pixel/timing equivalence was attempted or required.
- Negative run-frame indices after signed-distance overflow remain explicitly unmodeled. The 100-seed maximum-duration high-input stress did not reach overflow; all valid user-input patterns were not exhaustively enumerated.
- Outside reentry counters, native DOS scheduling/queue behavior, title/menu RNG draws, and browser timing remain declared limitations/adaptations.
- Browser storage write-denial visibility was inspected in the exception path; the browser suite directly tests read denial, not a denied `setItem` end-to-end.
- Water and Castle, audio, original DOS UI widgets, and original OS/device behavior remain unsupported by design.
