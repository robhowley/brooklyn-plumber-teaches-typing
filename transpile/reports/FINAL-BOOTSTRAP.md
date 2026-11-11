# Independent final bootstrap: PASS

Two newly created source snapshots independently completed all 18 PLAN regeneration commands. All 2,543 generated files match exactly, including all 38 previously path-dependent listing headers. No main source was edited.

## Scope and inputs

- Main, read only: `/Users/roberthowley/src/github.com/brooklyn-plumber-teaches-typing`.
- Worker root: `/Users/roberthowley/src/github.com/brooklyn-plumber-teaches-typing/transpile/.worktrees/p6-host`.
- Local experiment: `transpile/.tmp/bootstrap-final-independent/`, relative to worker root throughout this report.
- Successful snapshots: `run-1/` and `run-2/`, both created empty for this experiment, not the earlier fix-worker snapshots.
- Read current main `transpile/AGENTS.md`, full `transpile/PLAN.md`, `transpile/reports/PHASE-6-FIXES.md`, tools and focused tests before running. Reviewed archive readers, subprocess invocations and output roots. Only authored Python and trusted static objdump ran; archive members remained inert data.
- Source enumeration: `git ls-files --cached --others --exclude-standard -z -- transpile`, deduplicated, from main. Copied 138 source files, marked read-only and hash-checked after execution. No dependency symlink or installation was needed.
- Four tracked generated provenance files were intentionally omitted before copying: `transpile/analysis/worlds/{manifest,identity,sprites}.json` and `transpile/analysis/control/identity.json`. They were regenerated, not imported as evidence inputs. No ignored main assets, evidence, research data or app data were copied.
- Supplied archive: `$HOME/Downloads/Mario_Teaches_Typing_1992.zip`, SHA256 `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`.
- Original member: `MarioTea/MARIO/MARIO.EXE`, SHA256 `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e`. Static listings use executable FILE offsets, not emulation or runtime traces.

## Commands and observed results

All regeneration and verification ran through `structured_return`.

1. From worker root: `python3 -B transpile/.tmp/bootstrap-final-independent/run.py`, exit 0, 36 successful commands (18 per snapshot).
2. From worker root: `python3 -B -m unittest discover -s transpile/.tmp/bootstrap-final-independent/run-1/transpile/tests/render -p 'test_inspect.py'`, 1 passed.
3. From worker root: `python3 -B -m unittest discover -s transpile/.tmp/bootstrap-final-independent/run-1/transpile/tests/app -p 'test_build.py'`, 9 passed.
4. From worker root: `python3 -B transpile/.tmp/bootstrap-final-independent/compare.py`, exit 0, exact output comparison and independent instruction-byte verification passed, including after the focused tests.

The runner executes `python3 -B transpile/tools/<script>` in each snapshot, in this exact order:

```text
worlds/inspect.py
control/evidence.py
control/tables.py
worlds/tables.py
outdoor/inspect.py
runtime/inspect.py
render/inspect.py
assets/pipeline.py
render/decode.py
render/water-bindings.py
worlds/water-inspect.py
worlds/castle-inspect.py > transpile/.tmp/castle-evidence.json
control/menu-inspect.py
control/report-inspect.py
control/startup-inspect.py
control/celebration-inspect.py
audio/decode.py
build-app-data.py
```

`mkdir -p transpile/analysis/control transpile/.tmp` was performed before each sequence. The PLAN's HTTP server command was intentionally not run. Port 4179 was untouched.

### Exact generated-file accounting

Copied authored files are excluded; every resulting generated file is included. Tool execution logs are outside the compared `transpile/` trees.

| Scope | Files | Equal |
|---|---:|---:|
| Outside `.tmp` | 2,529 | 2,529 |
| `.tmp/menu/*.asm.txt` | 10 | 10 |
| `.tmp/menu/evidence.json` | 1 | 1 |
| `.tmp/{report,water,castle}-evidence.json` | 3 | 3 |
| Total | 2,543 | 2,543 |

The 2,529 outside count is **not** the withdrawn earlier 2,529 count repeated without checking. It is 2,525 outputs under the fix report's counting convention **plus the four tracked provenance files regenerated here instead of copied**. That accounts exactly for the difference from its 2,539 total. The full path/hash inventory is `generated-inventory.json`; no generated payloads were silently excluded.

### Listings and byte checks

- All 11 `analysis/render/*.asm.txt`, 17 `assets/startup/*.asm.txt` and 10 `.tmp/menu/*.asm.txt` match as complete files across distinct absolute snapshot paths.
- The focused header test runs all three inspectors in two further temporary source paths and verifies 38 full listing texts equal raw objdump output with only the first exact known file-header path changed to the wrapper basename. It also checks each inert wrapper's addressed section against the pinned EXE slice. Instruction text is not normalized or filtered.
- The independent comparison additionally verifies 13,250 emitted `.text` instruction lines against original EXE bytes at their FILE offsets, across those 38 listings. Non-code `.shstrtab` output is not mistaken for instructions.
- Existing world/control evidence readers also completed their own byte assertions in both full recipes. For example, startup spans include FILE `0xfb90..0x103be`; menu spans include `0x10ce3..0x11a05`. Original resource indices and member hashes remain in the regenerated manifests; focused build tests verify those records reach app consumers without repacking.

### App, PCM and pixels

`app/data.json` SHA256 in both snapshots:

```text
066edada0ea12b065463a5494827f727498e9fab3d3dd740f964e5bd9693c93a
```

Exact PCM SHA256 values, under `assets/audio/`:

| File | SHA256 |
|---|---|
| `welcome.pcm` | `bf3583bc217ccd01e40d291a38d55f094e6529cf2f8ed2e90c544e4c66478a2b` |
| `toobad.pcm` | `dcbcf4afacb589a6febe47b9284a5e30df57143c973a42851d228ce19bc012dc` |
| `congrats.pcm` | `76b0365ff1be4ab506f00c4e8268bca3d45c4fc15b9e746a0c68fb81dd9f3730` |
| `ready.pcm` | `9062799428cd1bb6137b5b610f697c7d23b4b1a0f74d201834d8981098817214` |

All 1,343 `.indices`/`.indices.data` pixel files match individually. `pixel-inventory.json` records every path/hash. SHA256 of sorted `path + NUL + hash + newline` inventory text: `4a72c9308a5677103446662e7823d7878dea627cf2e13919ed24e6ea83d50711`. This is an inventory digest, not a claim that all images share one pixel hash.

## Durable evidence and limitations

- `source-manifest.json`: copied source path/hash inventory; all copied source bytes remain unchanged in both successful snapshots and main.
- `commands.json`: exact commands, return codes, durations and per-command log paths; `run-{1,2}-{01..18}.log` retain execution output.
- `comparison.json`, `generated-inventory.json`, `pixel-inventory.json`: exact comparison results and hashes.
- Initial harness attempts stopped before completing a build: one overbroad guard accidentally matched `tools/assets/`; the next made tracked generated provenance read-only. Corrected only the authored experiment runner, excluded the four generated inputs, retained the abandoned snapshot as `aborted-readonly-provenance/`, and created both successful snapshots anew. No snapshot source patch was made. Comparison harness checks were also narrowed to generated `transpile/` files (excluding automatic execution logs) and `.text` sections (excluding objdump's non-code string table).
- No main patch, commit, push, delegation, wiki/task operations, server lifecycle changes, original executable/driver/script execution, or browser run occurred.
- This checks local fresh-input regeneration with existing Python/Node/objdump availability, not clean dependency installation, other platforms, audible equivalence or original-machine behavior. The separately reported 309 Node / 45 Python / 42 Chrome full-suite result was not rerun or independently claimed here. This report proves reproducibility and the bounded header/build checks only.
