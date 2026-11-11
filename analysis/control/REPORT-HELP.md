# Report, help and statistics presentation

Phase4 now integrates these components after verified/pushed Castle checkpoint `465129e`. RCARD, BLACKBRD, HELP, KEYBOARD and About use original decoded screens, their embedded palettes and original font rasters. The APIs remain independent of DOM/storage. Current checks: [PHASE-4](../../reports/PHASE-4.md). No original program was executed.

## Integration API

Paths are relative to `transpile/`.

| Module | Exports and inputs |
|---|---|
| `recovered/control/report.mjs` | `reportProblemKeys(studentBytes)`, `reportProfile(studentBytes)`, `sourceFormat(format,...values)` |
| same | `openHelp(section,returnTo,text)`, `helpLines(text)`, `helpInput(state,event)`, `helpPointer(state)` |
| same | `modalReturn(state,event)` for report/About; `keyboardInput(state,event)` for Keyboard |
| `app/report-render.mjs` | `reportOperations(studentBytes,resources)`, `drawReport(front,resources,studentBytes)`; shared `drawSourceText(front,fonts,operations,background=null)` |
| `app/help-render.mjs` | `helpOperations(state)`, `drawHelp(front,resources,state)`, `drawKeyboard(front,resources)`, `aboutOperations(resources)`, `drawAbout(front,resources)` |
| `app/stats-render.mjs` | `numericHUDOperations(mode,stats,messages)`, `drawNumericHUD(front,fonts,mode,stats,messages)`, `statsOperations(stats,profile,messages)`, `drawStats(front,resources,stats,profile)` |

`front` and `resources.background` are decoded 64,000-byte indexed rasters. `resources.palette` is that screen's embedded CRX palette, preferably the existing flat RGB8 array. Draw functions return the same palette plus their text operations, except Keyboard, which has no text operations. No function presents a Canvas, fetches assets, navigates a URL or saves a student. Original-derived inputs remain local.

Minimum resource objects:

```js
const fonts = {
  FONT5H: [/* 96 records, source indices 0..95, ASCII32..127 */],
  FONT3H: [/* same ordering */],
};
// Each record: {sprite: {width,height,...}, pixels: Uint8Array}.
// FONT5H cells are8x8; FONT3H cells are8x10. Never use GSO origins.
const report = {background, palette, fonts, messages, teachers};
const help = {background, palette, fonts};
const keyboard = {background, palette};
const about = {background, palette, fonts, messages, strings};
const results = {background, palette, fonts, messages};
```

`messages` is the existing numeric-ID-to-string map. `teachers` is the three decoded strings pointed to by executable DS:338c, not an assumed browser character label. `strings` maps the numeric DS addresses used by About to original NUL-terminated strings. `report-inspect.py` produces both maps locally.

`stats` requires `{attempts,errors,wpm,accuracy,elapsedSeconds}`. These are source statistics, not browser-calculated rates. `profile` requires `{profilePresent,goal}`. `statsOperations`/`drawStats` take the already refreshed score: operation210 first calls100, and the renderer does not own the clock. In the current Session, Outside and Practice require `{...session.activity,...session.stats()}` because `stats()` alone omits attempts/errors; Water supplies its controller's complete `stats`. Castle must supply its controller's complete structure after integration. No optional guessed values are filled here.

The builder owner needs only:

1. Add `FONT3H` to the existing font-family inclusion; retain `FONT5H`.
2. Include existing decoded backgrounds `RCARD`, `HELP`, `KEYBOARD`, `GREETBG`; BLACKBRD is already included. Retain each screen's embedded palette.
3. Add a local data section, for example `control: {teachers,strings,help}`, from `.tmp/report-evidence.json`. `help` maps section1/2 to original HLP text. Do not publish the output.
4. Construct the records above from existing base64 sprite/background data in the same way Water constructs decoded records. No new resource format or image conversion is required.
5. Render HUD after the world's scene updates. Replace the guessed Outside/Practice text and omitted Water/Castle HUD with `drawNumericHUD`; it uses the world palette already active. Use `drawStats` only on BLACKBRD results, with its separate palette.

## Routing and input ownership

- Source menu H/F1 calls help section1 at FILE `0x113d1..0x113de`; K/F2 calls Keyboard at `0x113e2..0x113eb`; A calls About at `0x1159b`; report requires a present student at `0x114d5..0x114ff`.
- Results F1 calls help section2 at `0x1671d..0x16726`; F2 calls Keyboard at `0x16729`. Returning restores that result screen, not the main menu. Neither helper invents a navigation stack: pass the actual caller in `returnTo`.
- Before any modal, the host retains the caller raster, palette, font/presentation state and pointer state. Closing returns `route: returnTo`. Restore the retained caller rather than starting another lesson or rebuilding a new result.
- `modalReturn({kind:'report'|'about',returnTo,...},event)` closes for any pending key or an enabled pointer-button change, matching callback `0x147f2..0x1482e`. Pointer movement alone is not a button change. The host consumes the closing event and clears pending input when `flushInput` is true (`0xe967`, `0x121a9`, `0x158d0` call flush `0x19221`). This prevents an Escape/F1 from leaking into a lesson.
- `keyboardInput` keeps Keyboard open for F1 (`0x14655..0x1467f`); any other pending key closes it. It consumes one key, rather than requesting a full input flush. Keyboard has a palette transition into/out of its CRX, but this module returns only the final palette.
- Help keys are decoded DOS values, not browser keycodes. Tab/right cycle button focus down/up/done; left cycles backward; Enter uses that focus. Initial focus is done. Up/down scroll one line, PageUp/PageDown17 lines, Home/End use endpoints. D/d/Escape close, Alt-X only requests the separately gated quit service. F1/F2 are not recursive help/keyboard commands inside this reader.
- Pointer left-button hit boxes are inclusive: y178..188, down x17..56, up x72..111, done x261..300. `helpPointer` returns the source focus destinations `(36,182)`, `(91,182)`, `(280,182)`. Reuse the UI worker's cursor drawing/transport; no modern links or buttons are added here.

## Recovered behavior and evidence

All addresses are executable **FILE offsets**, not CPU addresses. MZ image begins `0x2e00`; DS bytes use file base `0x1f270`.

### RCARD and error ranking

- Student errors occupy96 signed words at student+`0x44`, ASCII32..127. Increment at `0xe41c..0xe443` wraps16 bits. The existing student helper is reused.
- Ranking `0xe446..0xe4ef` finds the signed maximum including space, then scans counts downward while positive; within a count it scans ASCII ascending. Space is excluded, DEL included, at most5 keys. The translated sort is observationally equivalent without spending32,767 empty count iterations.
- The buffer starts empty; every result is a leading space followed by the key. `0xe4f1..0xe521` copies resource2100 when strlen is zero, but `0xe524..0xe527` writes NUL through the still-unadvanced output pointer. Thus no positive non-space key produces an **empty visible value**, not a visible fallback. This corrects the earlier uncertainty in MECHANICS. `reportProblemKeys` returns that visible string; it does not mutate the persisted bytes or reproduce irrelevant stale bytes beyond its terminator.
- The service normalizes group, accuracy and signed character before dispatch. `reportProfile` uses the existing normalizer; no profile means no report. Rendering does not persist this normalized copy, since storage remains the integration owner's responsibility.
- RCARD loading/palette at `0xe6e2..0xe748`; FONT5H at `0xe69e..0xe6ae`, transparent with foreground/background/shadow all0 at `0xe749..0xe753`.
- Name resource2110 is `(60,66)`; teacher2120 `(60,80)`; level2130 `(60,96)`; mode label100..103 `(178,96)`. The level row is the mode name, not the lesson-group name. Teacher pointer table is FILE `0x225fc..0x22608` (DS:338c), character clamped1..3.
- Goal label2240 `(60,108)`, value `(178,108)` uses `%3u`. Last-WPM label2250/value at y120 only when lastWpm!=0. Accuracy label2260/value at y132 only when normalized accuracy!=0, using `%3u%%`. Problem label2270 `(60,144)`, value FONT3H `(178,143)`, color14/shadow8. Source `0xe758..0xe92f`.

### BLACKBRD statistics and every world's HUD

The source dispatch distinguishes **operation200 (world HUD)** from **operation210 (BLACKBRD results)**. Both refresh operation100 first. Do not call210 for a world frame. The requested shared numeric presentation is implemented for both operations.

Operation200 branch table FILE `0x164a4..0x164ac` maps modes1..4 to `0x15d9c`, `0x15ea1`, `0x15fad`, `0x160a1`. All use opaque cells and shadow8:

| Mode | Font / background index | WPM / clock / typed / errors origins | Foreground WPM+clock / counters |
|---|---|---|---|
| Outside1 | FONT5H /13 | `(256,168)` / `(0,168)` / `(0,184)` / `(240,184)` |10 /15 |
| Water2 | FONT3H /86 | `(232,8)` / `(0,8)` / `(0,24)` / `(232,24)` |11 /14 |
| Castle3 | FONT5H /0 | `(256,168)` / `(0,168)` / `(0,184)` / `(240,184)` |10 /14 |
| Practice4 | FONT5H /1 | `(256,8)` / `(0,8)` / `(0,24)` / `(240,24)` |10 /14 |

Resource IDs10..13,20..23,30..33,40..43 preserve their exact spaces and minimum widths. Water explicitly overrides y to8/24 after setting its text coordinates. Field+`0x17` clock formatting is odd: hours and seconds operate on its signed low word, whereas minutes use the full signed dword division then the low-word remainder. Negative results are printed as unsigned16-bit values. This is recovered, not normalized to a conventional clock. Attempts above999 are not truncated.

Operation210 source `0x16243..0x16445` selects FONT5H, transparent, foreground11 for labels,10 for values, shadow8. Coordinates are column/row transformed by8x8 at `0x1a9ec..0x1aa21`:

| Data / MSD label | Label pixel origin | Value pixel origin / format |
|---|---|---|
| attempts /5500 | `(40,32)` | `(136,32)` / `%4u` |
| errors /5501 | `(40,48)` | `(136,48)` / `%4u` |
| WPM /5502 | `(40,64)` | `(144,64)` / `%3u` |
| goal /5503 | `(40,80)` | `(144,80)` / `%3u`, omit both for guest |
| accuracy /5504 | `(40,96)` | `(136,96)` / `%3u%%` |
| elapsed /5505 | `(40,120)` | `(136,120)` / `%3u:%02u` |

Results elapsed uses full signed dword quotient/remainder by60, then unsigned low-word arguments. It is not the HUD's hours/minutes/seconds path. Mode4 uses the same result layout; Practice's numeric HUD is the separate top-of-screen branch above.

### HLP and About

- Reader `0x1537f..0x1592c` loads HELP and formats `mario%u.hlp`. Only MARIO1/2 exist in this archive. Unknown section data is visibly marked `Unavailable`, a host notice using the real font, not invented help prose.
- `0x15507..0x155c4` counts CR bytes, NUL-terminates them, and advances two bytes. Only CR-terminated lines enter the table. The trailing SUB in MARIO2 is ignored because it is outside those lines.
- `0x15608..0x15748` paints18 rows at x16, y30+8*row, opaque background15, shadow0. Each repaint starts foreground1. A leading `<number>` changes foreground, not font. It persists down the current viewport only; offscreen tags are not replayed. Tabs expand to the next multiple of4 columns. Expanded lines longer than40 stop the page; accepted lines are padded/truncated to35 characters using the source format. No reflow or browser font metrics are substituted.
- Key/target tables FILE `0x1592d..0x15965`; pointer hit tests `0x1575f..0x157ab`; page/focus/return branches `0x15803..0x158c7`; focus coordinate table FILE `0x21bdc..0x21be8`.
- MARIO2 has9 CR-terminated lines. Source down/page/end can compute a negative top (`lineCount-18`) and index before the allocated line table. The translation bounds top to0 for short documents. This is an explicit host memory-safety adaptation, not a claimed recovered clamp.
- Keyboard FILE `0x145df..0x14640` displays the original KEYBOARD screen with no extra labels. About FILE `0x11d54..0x121ea` uses GREETBG and FONT3H, localized headings50400..50407, footer50420, original executable credit strings. Title `(56,5)`, footer `(96,185)`; the operation list preserves source order, original columns/rows and the half-cell vertical adjustments.
- FONT5H/FONT3H bindings are `0x12619..0x1263a`. Font service `0x1a775..0x1ac98` uses raw glyph width/height, ignores GSO origins, maps0/1/2 through background/foreground/shadow, and advances by glyph width. The renderer supports opaque cells and transparent zero restoration from the caller-supplied backing raster.

## Source identities

All members below are under original prefix `MarioTea/MARIO/`. Every hash is SHA256. The archive itself is `Mario_Teaches_Typing_1992.zip`, hash `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`.

| Member | SHA256 |
|---|---|
| MARIO.EXE | `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e` |
| ENGLISH.MSD | `fd2168878e19b1b85ae0c6ce8e14ad4386a801e7c460ed134bde5f181cb29e15` |
| RCARD.CRX | `ab3316a7c23f0e55119340a3166f42b05c82b12c7a22fb6f2f72a11527ed379f` |
| BLACKBRD.CRX | `46c8460d71078ad458349bde48fdcef272355eed6020f290da84e6165de3cfa2` |
| HELP.CRX | `88d441957d279142a6efc277a5b097f0a4bed3054c3db4442aec60dfbdb87fb8` |
| KEYBOARD.CRX | `e78ab753ff75965d9827401db97798c3cd4b5edbb2b3a7c5cb5a911439b23d68` |
| GREETBG.CRX | `0092d90b2cf4173dd2224d81e66960512f500cc5d5fd63d1c660b5dee28f944e` |
| MARIO1.HLP | `cba397d1225e52cfcaaa2c264d02b9468a1b48649041a3d6bb98ca89a26c44df` |
| MARIO2.HLP | `84434cc70f5f0398f2ac03fca881c39b4fe057f83c475ff296ed1c1d3b508719` |
| FONT3H.FNT | `211983fe788422b4202f5f2d1b7309e0b1c870cae364c48e05c92f2550dcb7f6` |
| FONT3H.GSO | `f7199c90c36d547d8d2f6ec464157cf529e3138cf0cd5d6714c027ffd6b9ba2f` |
| FONT3H.GSK | `d3ccfec083e604fa81226861dc8d783768ced9728f62c0ffe64873dbbe43fff4` |
| FONT5H.FNT | `ef34a85146592dfd325e7eb303c3da797cdbe9ff306fd209a1bb09824bf6514f` |
| FONT5H.GSO | `aa9b883273bf0997b4e128c4a72eb7028c534656d1c284948cf51cae74968464` |
| FONT5H.GSK | `583e44cc746eea226175ae3810d69f185c951236d206cb91d824558672837598` |

## Verification and limits

Commands run from the repository/worktree root:

- `python3 -B transpile/tools/control/report-inspect.py`: verified2,869 focused instruction lines against hash-pinned ZIP bytes; emitted ignored `.tmp/report-evidence.json`,15 member identities, original help and executable strings. Reads archive members as data only.
- `node --test transpile/tests/control/report.test.mjs transpile/tests/control/stats.test.mjs`:13 passed using `structured_return`, `node-test-text`.
- `node --test transpile/tests/control/*.test.mjs`:29 passed using the same parser.
- `node --test transpile/tests/{control,outdoor,worlds,runtime,render}/*.test.mjs`:128 passed using the same parser.
- `git diff --check`:passed. An independent whitespace/path scan covered all8 new authored files because untracked files are not included by that git command; all writes are beneath `transpile/`. `git check-ignore transpile/.tmp/report-evidence.json` confirmed the raw output stays ignored.

Tests compare source instruction immediates/table targets, original MSD strings at member byte offsets, decoded glyph pixels against independent GSO byte slices, exact coordinates/colors and output pixels. They cover signed ranking ties/wrap/DEL/space, hidden rows, guest results, all four HUD modes, unsigned formatting, long-clock low-word behavior, help color/tabs/page/focus bounds, caller returns and Keyboard F1. These are static-source and authored-JavaScript tests, not DOS differential tests.

The checks above are the frozen worker's results, not the current integration totals. Shared integration/browser reentry and full suites now run in Phase4. Water paints its `stats` snapshots; Castle operation200 now carries an immutable stats snapshot, while operation3/bonus packets do not invent HUD refreshes. Integration also corrected Keyboard pointer handling: FILE `0x14669..0x1467f` polls keys only, unlike Report/About's `0x147f2` callback. Pointer-only events cannot close Keyboard. Intermediate palette fades, original mouse raster drawing and quit/print transport remain unimplemented. Short-help negative indexing is deliberately bounded. Screen/font/palette restoration and input consumption/flushing must be wired by integration. No original text/resource, generated data or executable listing was added to tracked scope.
