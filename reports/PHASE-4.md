# Phase4: original controls and numeric presentation

**Integrated locally: original dropdowns, supported student widgets/chooser, report/help/keyboard/About, all four numeric HUDs and BLACKBRD statistics. Checks:213 Node +32 Python +27 Chrome passed.** No commit/push or independent Phase4 review is claimed.

## Baseline and scope

- Parent baseline: Phase3 verified and pushed as `465129e`. Read the required Phase3/UI handoffs and `phase3/verification/02-second-opinion.md` (LGTM).
- Imported only13 declared authored files from frozen `p4-menu` and `p4-reports`, listed below. No asset directory, generated worker output or unrelated worktree change was copied.
- All mutations remain below `transpile/`. No archive executable, driver, script or installer was executed, emulated or interpreted. Only authored tools/tests/JavaScript and trusted static `objdump` ran.
- No commit, push, delegation, wiki access or task-management operation occurred.

## Behavior and source evidence

All addresses are executable FILE offsets. `MarioTea/MARIO/MARIO.EXE` SHA256 is `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e`; archive SHA256 is `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`.

| Area | Integrated behavior and source |
|---|---|
| Dropdowns | `menuInput` source geometry, localized accelerators, row/column wrap, keyboard-first API, palette88 linear7x7 interception before other pointer routing, no world fallthrough after outside-dropdown click. `0x10e1c..0x119f5`, pixel service `0x14fd6..0x14ff7`. |
| Command bridge | One main path applies ordered start/group/save/student/report/help/option effects. Unsupported demo/audio/certificate/quit requests remain visible and never start substitute lessons. Existing toolbar stays separate. |
| Student edit | Original name/numeric keys and bounds, source focus slots and pointer rectangles. Ordinary H/K/D/etc inside a field are text, not menu commands. New clears260 bytes even on cancellation; duplicate New loads the existing record. `0xed25..0xee83`, `0xf1fb..0xf540`, `0x1af30..0x1b41b`. |
| Rename/storage | Escape cancels before deletion. Accepted rename deletes OLD then saves NEW, without an invented collision dialog. Case-insensitive filename matching reuses an existing host key. The same `mtt-static-translation.students.v1` object/260-byte arrays remain; unrelated records are untouched, no migration. `0xf3d8..0xf420`. |
| Chooser | Source max30/sort/3x10 grid, partial-column clamp, arrows, signed tick double-press. D means Done/load, never delete; C/Escape cancel without storage effects. Main/PREFS use fresh left presses; chooser additionally samples held-left level on host ticks. `0xf653..0xfb19`. |
| Student composition | Real PREFS/LOAD/LESSTIME backgrounds/palettes, original text/field origins and FONT3H/FONT5H. GREET2/prefbox_1 source index1,40x50, y130; x66/132/208 is bundled from DS:231e, not guessed. `0xec11..0xed01`, `0xef0c..0xf138`, `0x8d66..0x8e58`. |
| Student caret | Full-cell inversion, source4/2 counts from `0x1b0de..0x1b0ea`, countdown `0x1ae93..0x1aef0`, changed-low-tick wait `0x192a2`. Shares `Session.lastWaitTick`; no millisecond guess or catchup after stalls. |
| Report | Real RCARD, original teacher pointers/labels/formats/coordinates and signed per-key ranking. Zero-error visible ranking is empty; ties/space/DEL/wrap remain source-derived. `0xe446..0xe527`, `0xe65b..0xe997`. |
| Help/Keyboard/About | Original HLP/HELP/KEYBOARD/GREETBG, fonts, controls and credits. Paging/focus, actual caller raster/palette/pointer restoration and consumed closing keys. Results F1 returns to results, not a new activity. `0x1537f..0x1592c`, `0x145df..0x1467f`, `0x11d54..0x121ea`. |
| Numeric presentation | Exact mode-specific FONT3H/FONT5H origins, colors, background slots, widths and unusual unsigned clock formatting. BLACKBRD operation210 remains distinct from HUD operation200, including guest-goal omission. `0x15d77..0x16445`. |
| Errors | Missing control fonts/screens fail visibly; stopped application does not continue lesson updates. Storage read/write failures retain a persistent memory-only warning. Quit explicitly cannot terminate a browser process or close its tab. |

### Integration corrections beyond frozen imports

- Added immutable Castle operation200 statistics snapshots. Water consumes its existing `stats` effect; both paint only at source statistics events, not every bonus/operation3 frame.
- Corrected Keyboard's pointer behavior: `0x14669..0x1467f` polls keys only. Pointer-only events keep it open, unlike Report/About's `0x147f2` callback. F1 stays open; another pending key closes.
- Added Home/End/PageUp/PageDown/Insert/F3..F9 and extended Delete normalization at the browser boundary.
- Normalized source student-service fields on activity start after cancelled New leaves zero bytes. This is not a storage migration.
- Added source-composition and cursor-wait evidence to `menu-inspect.py`; source overlay coordinates and hashes now reach the ignored app bundle.

## Files

### Declared frozen imports

- `recovered/control/menu.mjs`, `app/menu-render.mjs`, `tests/control/menu.test.mjs`, `tools/control/menu-inspect.py`, `analysis/control/MENU.md`.
- `recovered/control/report.mjs`, `app/report-render.mjs`, `app/help-render.mjs`, `app/stats-render.mjs`, `tests/control/report.test.mjs`, `tests/control/stats.test.mjs`, `tools/control/report-inspect.py`, `analysis/control/REPORT-HELP.md`.

Current amendments to these imports are identified above and in their evidence documents. Frozen worktrees were not edited.

### Integration files

- `app/main.mjs`: command effects, source widget ownership, modal return/flush, pointer routing, caret scheduling and visible failures.
- `app/render.mjs`: original widget/modal composition, source statistics rendering and resource bindings; removed guessed HUD/results/editor labels.
- `app/session.mjs`: DOS editor keys, cancelled-New normalization and case-insensitive save target matching, preserving layout/other records.
- `recovered/worlds/castle.mjs`: `refresh` adds draw-time stats snapshot only.
- `tools/build-app-data.py`: FONT3H, GREET2/prefbox_1 only, control backgrounds and ignored inspector text/provenance/selection coordinates.
- `index.html`: explicit source/native-fallback controls and current limitations.
- `tests/app/presentation.spec.mjs`, `tests/app/presentation.test.mjs`: actual bridge, original composition, source/palette/font pixel checks and failure cases.
- `tests/app/{browser.spec.mjs,castle-integration.test.mjs,session.test.mjs,test_build.py}`: current menu behavior, immutable HUD snapshots, key/storage contracts and producer/consumer transport.
- `README.md`, `COVERAGE.md`, `ASSUMPTIONS.md`, `PLAN.md`, this report: current behavior, bootstrap sequence, verified Phase3 publication and explicit gaps.

## Reproduction and checks

Run from the repository root through `structured_return`. Inspectors use only archive bytes as data:

```sh
python3 -B transpile/tools/control/menu-inspect.py
python3 -B transpile/tools/control/report-inspect.py
python3 -B transpile/tools/build-app-data.py
TMPDIR="$PWD/transpile/.tmp" node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs
TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/assets -p 'test_*.py'
TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/render -p 'test_*.py'
TMPDIR="$PWD/transpile/.tmp" python3 -B -m unittest discover -s transpile/tests/app -p 'test_*.py'
TMPDIR="$PWD/transpile/.tmp" TRANSLATION_PORT=4192 \
  PLAYWRIGHT_JUNIT_OUTPUT_FILE=transpile/reports/browser/phase4-results.xml \
  node_modules/.bin/playwright test -c transpile/playwright.config.mjs --reporter=junit
```

- Node:213 passed (`node-test-text`). Includes source byte/table constants, signed ranking ties/zero/wrap/DEL, selection bounds, editor cancellation/order, all-mode clock/overflow formats and indexed pixels.
- Python:19 assets +5 render +8 app =32 passed (`unittest-text`). App tests rebuild the ignored bundle and prove deterministic outputs and resource/font/palette/help transport.
- Installed Google Chrome:27 passed (`junit-xml`), including all existing world tests. New tests exercise real mouse/keyboard dropdown parity, source text keys, rename delete/cancel/collision, duplicate New, chooser D/cancel/bounds, four duration fields, caret phases, report persistence, help paging, modal return/input ownership, all4 HUD text/origin/palette/font pixels, operation210, palette88 interception, denied storage and broken resources.
- Browser used4192. Existing4179 listener PID59919 remained running. No root configuration changed.
- `git diff --check` passed. `git check-ignore` confirmed app bundle, assets, `.tmp/menu/` and report inspector output stay ignored. The existing `.tmp/` rule already covers new inspector outputs, so no redundant ignore pattern was added.
- Bootstrap documentation now runs both inspectors before the app builder. No original-derived resource, HLP/credit text output, numeric table or raw listing was added to tracked scope.

Initial integration checks caught a stale Delete-key expectation, an obsolete disabled-dropdown browser assertion and a chooser test clicking outside its source two-column bound. Those assertions were corrected against the source contract; final suites above pass.

## Explicit remaining gaps

- No executed-original differential comparison or full DOS/hardware equivalence claim.
- Title/demo/menu idle and associated RNG draws, optional celebrations/endings, palette fades, audio and certificate/printing transport remain omitted.
- Original mouse raster/driver behavior and Practice input blink remain unsupported. Welcome text still uses the pre-existing provisional color mapping; palette88 pointer interception itself is implemented.
- Native toolbar/form remain visibly separate fallbacks, with browser validation/selection. Browser scheduling, typematic/FIFO capacity and focus pause are host adaptations.
- Report/About's source button-change predicate is transported as a fresh browser press (any button), not emulated driver release polling. Keyboard accepts keys only. Short-help top is safely bounded at0 rather than reproducing negative memory indexing.
- Source option bits are tracked, but initial process/config defaults and audio output are not claimed recovered by Phase4.
- DOS filesystem errors, partial delete/save failures and carryon files are not simulated. Browser failures remain visible and memory-only.
- Independent post-integration Phase4 review is still pending; this report records implementation and automated checks, not publication approval.
