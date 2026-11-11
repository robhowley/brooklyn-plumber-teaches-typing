# Recovered behavior and browser adaptations

**The app uses the recovered modules directly. Host clocks, scheduling, input delivery, persistence and presentation remain explicit adaptations.** Phase 1 integrates the source-backed runtime/render worker changes; [REENTRY](analysis/runtime/REENTRY.md) and [BGS](analysis/render/BGS.md) supersede earlier state/font/packing gaps.

## State and clocks

| Boundary | Current behavior | Evidence / limit |
|---|---|---|
| Entry | Direct original MAINMENU | Title/menu idle omitted; no source selector/countdown |
| Seed | `seedFromTime(floor(Date.now()/1000))` once, or low16 query seed | FILE0x126a0..0x126b3 and0x37f6; modern epoch input is a host adaptation, not DOS TZ/DST emulation |
| Shared RNG | Lesson6 prefix if needed, delimiter selection, four bonus draws plus prior-duration override, then obstacle draws | `runtime.lessonPrefix/selectCorpusSegment`, `outdoor.makeBonus/tick`; no reseeding on activity entry |
| First bonus | Prior duration0, potentially negative delay | Statistics reset ordering FILE0x12678 and0x12c07..0x12cbc retained; later entries use the previous activity duration |
| Omitted RNG callers | No title/menu/fireworks draws | These presentations are disabled. Seed is reproducible for this slice, not a recorded DOS session |
| Active clock | `floor(performance.now()*18.2/1000)` into recovered timer | Source scoring uses182/10; browser cadence is approximate, not measured DOS timing |
| Wall clock | Whole current host epoch seconds | Bonus counts observed second changes; Practice overdue face uses wall time, not active time |
| Update cadence | One update per roughly18.2Hz callback, no catchup | Outside changed-BIOS-tick wait FILE0x1470c; browser stalls may advance time farther than motion |
| Outside order | One recovered `tick`: old-scroll ground, bonus, player, obstacles, particles, target, timeout/key | FILE0x139c7..0x13d35; app samples supplied tick time atomically before the call, equivalent for its elapsed predicate; it does not insert a simulation update per DOM event |
| Focus | Freeze updates and active timer; resume explicitly | Host adaptation; pending keys discarded. Practice wall-time face may become overdue while paused |
| Bonus playback | Stop timer310, frame0 immediately, advance once per two observed host ticks, restore scene, resume300 | FILE0x13bb2..0x13c64 and0x1425a; keys discarded during playback, no attempts/correct increments; two-wait approximation is not exact BIOS timing |
| Reentry | Fresh Outside entry objects retain five counters; bonus observed-second clock survives Practice; RNG/previous duration/Practice last-correct persist | REENTRY: DS487e/4882/4884/4886/51ac and4888; positions, scroll1, targets/obstacles and score reset. Water previous whitespace has a tested runtime argument, but no Session Water producer exists until phase2 |
| Practice | Exact runtime10x33 rows, nine fills, signed case-sensitive input and separate typed display prefix | FILE0xb391..0xb4d3,0xb73d..0xb7e0; row0 memory remains blank, no generic wrapping repair |
| Practice expression | Original three faces and strict thresholds | FILE0xb502..0xb53f; last-correct starts0, persists on reentry; no inactivity failure |
| Practice timeout | Default600s or configured duration; Escape early exit | FILE0xb1e6..0xb20c,0xb5c2; F10 ignored, Alt-X option disabled |

## Input, student state and unsupported routes

- One pending ASCII/DOS-normalized key per update; additional DOM events before consumption are dropped. BIOS queue size/typematic is not claimed. Modifiers, composition and non-ASCII input are ignored. `createPendingInput()` separately tests raw-byte pending/consume/flush and extended prefixes; it is not substituted for browser transport or claimed to emulate DOS queue capacity.
- Guest `Player` has profilePresent=false and never saves. It is not Demo and receives no synthetic input.
- Student layout/defaults/save magic and progression are recovered. Native editor widgets, positive-word goal bound, browser case-sensitive names and localStorage transport are adaptations.
- New-name dot truncation and existing-name load are preserved. Name edits accept printable ASCII1..8. Outside/Practice duration controls clamp1..60 using the recovered helper.
- Storage uses only `mtt-static-translation.students.v1`. Corrupt/unavailable reads produce a persistent visible warning and an in-memory guest; write failures leave the student in memory and show the same warning. Original DOS filesystem/carryon/rename semantics are not reproduced.
- Practice Next stays mode4 without advancement. Outside progression occurs before results; early exit withholds advancement; Next never advances a second time. Unsupported Water/Castle destinations leave the current screen with a notice.
- Original right-side menu and results hit regions/hotkeys are used. Dropdowns, report/help/keyboard/about/demo/audio/printer/quit remain visibly disabled. Original text-editor/pointer widgets are not impersonated.

## Rendering

`app/render.mjs` owns browser drawing. It imports `blitSprite`, `spriteRect`, `clipRect`, `drawGround`, `characterFrame` and `updateSprite` directly.

- **Indexed scene:** one320x200 buffer, converted to RGB8 only at presentation. Every sprite uses additive signed origins and transparent raw index0. Palette255 remains visible. There is no generic missing-image fallback.
- **Outside palette:** decoded final OUTSIDE palette with character slots32..47 and turtle slots48..63. No per-sprite preview palette is used. Background stays fixed; the exact20x16 executable tile at FILE0x1f582 occupies rows140..155 with old-scroll phase.
- **Idle:** all145 decoded GCO resources use the recovered schedules and names, without resizing or substituting a walking frame. Signed-distance overflow is not repaired with a fabricated wrap; unsupported frame state stops visibly.
- **Redraw:** full-scene redraw is deliberately a host adaptation, not an assertion that all original dirty-rectangle interactions are reproduced. Ordinary layers are drawn from post-update state rather than capturing every intermediate DOS screen write.
- **Bonus:** tested Python BAN decoder builds each persistent background from OUTSKY. Browser draws the matching ANI raster with recovered signed coordinates/origins and compositor. Only MOUT/LOUT/POUT play; matching frame count/order and outdoor callback cadence are proven. Palette fades, sound and all other presentations remain absent.
- **Practice:** original PRACTICE.CRX/GSO faces at logical142,21; source rows at30,96+10*row,32 columns, eight-pixel advances. Target row uses font foreground index0; typed prefix uses1. A static blue cursor substitutes for the shared blinking-input callback. HUD labels/positions remain host layout, not pixel-equivalence claims.
- **Fonts:** real FONT5H and FONT7H rasters. Startup loads FONT5H into DS:4fc4 (FILE0x1262c..0x12639), FONT7H into DS:4fb5 (0x1263e..0x1264c); glyph-pointer field+b proves Outside DS:4fc0 and codes32..127 map to FONT7H indices0..95 (REENTRY). Decoded fonts stay in the resource cache, with no per-entry font state object. FILE0x1a7ba loads that field and0x1a86e..0x1a87e maps glyph indices through DS:2e0c. Practice writes mapping[0]=15 and mapping[1]=0 (target) or1 (input) at0xb2f0..0xb303. Black/purple palette0 must remain visible after font recoloring, unlike raw sprite zero transparency. Full text-engine control codes and all activity/reentry font state are not reproduced.
- **Menu:** original background and FONT5H; welcome slot88 treatment remains untraced, so visible palette12 is an isolated host substitution. Host mouse cursor replaces DOS mouse imagery. HUD/results/editor formatting and some menu positions are approximate.

No original code, driver or script runs. No previous `src/` gameplay or save state is imported. Original-derived resources and numeric evidence are local-only, not MIT.

## Remaining integration work, not implicit behavior

Water's pending-key suppression/update cadence and Castle's complete scene orchestration remain unsupported. BGS packing, scene pixels, clip call sites and final world palettes are now decoded/tested; scratch transition compositing and controller-driven restoration remain pending. Next-phase consumers read `assets/render/manifest.json` directly, with paths relative to `assets/render/`, rather than a duplicate app schema. See the bounded ledger in [COVERAGE](COVERAGE.md) and [worlds report](analysis/worlds/MECHANICS.md). Do not turn their tested numeric routines into a generic collision/lives engine.

Title/menu idle, palette transitions, result speech/celebrations, audio, original widgets and DOS TZ/DST parsing are not added merely because decoded resources exist. Runtime/render worker reports contain newer recovery than the historical research handoffs; this document describes current app use.

`window.translationSnapshot()` returns copies for browser verification, never mutation commands. Tests use explicit supplied clocks in Node and Playwright host clock control. They prove authored integration, not a comparison with an executed original. See [Phase 1 integration report](reports/PHASE-1.md); [earlier integration](reports/INTEGRATION.md) is historical.
