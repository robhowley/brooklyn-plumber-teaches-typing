# Coverage of the integrated activities

**All four worlds, original command widgets, report/help/keyboard/About, numeric HUDs and BLACKBRD statistics are integrated.** Phase4 was verified/pushed as `2f9ad12` (parent status). Phase5 independently passed verification and was pushed as `764788a` (user-provided status). Phase6 bounded VOC playback and host corrections passed independent verification:309 Node +45 Python +42 Chrome and live4179 smoke; main checkpoint pending. Two fresh18-script bootstraps matched2,543 files, including38 listing headers. See [FINAL](reports/FINAL.md) and [FINAL-BOOTSTRAP](reports/FINAL-BOOTSTRAP.md). Six verified bundles do not mean full-game completion; remaining recoverable scope is ordered at the bottom of [PLAN](PLAN.md#remaining-recoverable-work-in-order). “Implemented” below means used by this browser app; “recovered-only” means evidence or tested helpers exist but the feature is not exposed. “Unknown” means a consequential detail is not established, not permission to invent it.

## Evidence map

All FILE offsets refer to `MarioTea/MARIO/MARIO.EXE`, SHA256 `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e`. Archive SHA256 is `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`. Original member hashes and resource indices are retained in the linked manifests/tables.

- **C**: [control report](analysis/control/MECHANICS.md), [menu assembly](analysis/control/menu.asm.txt), [messages](analysis/control/messages.json), [identity](analysis/control/identity.json).
- **O**: [Outside report](analysis/outdoor/MECHANICS.md), [tables/resource indices](analysis/outdoor/tables.json), [mechanic evidence](analysis/outdoor/mechanics.json).
- **W**: [Water/Castle/Practice report](analysis/worlds/MECHANICS.md), [resource indices](analysis/worlds/sprites.json), [numeric tables](analysis/worlds/tables.json).
- **A**: [resource formats](analysis/assets/RESOURCE-FORMATS.md), [asset manifest](assets/original/manifest.json), [archive manifest](assets/original/archive-manifest.json).

- **R**: [render report](analysis/render/RENDERING.md), [BGS/world contracts](analysis/render/BGS.md), [decoded bindings](assets/render/manifest.json), indexed compositor/ground/idle/BAN/ANI evidence.
- **T**: [runtime report](analysis/runtime/RUNTIME.md), [reentry contracts](analysis/runtime/REENTRY.md), exact RNG/corpus/Practice/bonus APIs and byte spans. These supersede historical BGS, font-binding and retained-counter gaps; [Phase 1 checks](reports/PHASE-1.md) cover current integration.

- **MENU**: [menu/student evidence](analysis/control/MENU.md), frozen worker imports plus integrated source composition/blink trace.
- **AUDIO**: [audio formats/call sites](analysis/audio/AUDIO.md), [host boundaries](analysis/control/HOST-GAPS.md) and [Phase6 proof](reports/PHASE-6.md). Four PCM clips and continuation boundaries, not hardware equivalence.
- **REPORT-HELP**: [report/help/HUD evidence](analysis/control/REPORT-HELP.md), original resource/font/palette bindings and exact operation200/210 layouts.

## Boot, menu and student UI

| Original area | Status in app | Evidence and remaining limit |
|---|---|---|
| DOS/C startup, config, devices, command line | Recovered-only/unknown | C `0x1d89d`, `0x125b9`; no hardware/driver execution |
| Logo, title, greeting sequence | Implemented | STARTUP `0xfb90..0x103be`; exact source waits/skips,13 natural RNG draws,27 Mario calls,13 letters and59 palette writes; browser tick observation is adapted |
| Main-menu background | Implemented | A MAINMENU.CRX, indexed pixels and embedded palette |
| Main-menu top labels/font | Implemented | C `0x105cc..0x106f9`; FONT5H at DS:4fc4, resource IDs1100/1110/1120; indexed source borders, selection colors and lesson marker |
| Welcome/student greeting | Implemented, provisional color | C `0x10979..0x10adf`, IDs1150/1250..1254; original slot88 unresolved, host red substitute |
| Six right-side hit boxes | Implemented | C `0x11121..0x11167`, half-open rectangles; no added source selection |
| Pixel-color interception and Mario click region | Interception implemented; animation omitted | MENU `0x10e66..0x10eb7`, `0x110ce..0x1111a`; low-word linear7x7 palette88 scan precedes all pointer routes; welcome VOC request blocks before the next pump; locked/muted playback is visibly omitted |
| Menu hotkeys and world eligibility | Implemented for supported actions | C `0x111d8..0x114ce`; unsupported keys report disabled in host status |
| Dropdown keyboard/pointer navigation | Implemented | MENU `0x10e1c..0x119f5`; source geometry, keyboard-before-pointer API, localized accelerators, row/column wrap and outside-click close without world fallthrough |
| Dropdown commands | Implemented or explicit omission | Bridge owns starts, group/save, students, report/help/keyboard/About and option bits; Demo explicitly selects an unsaved profile; audio/print/quit requests never start substitutes |
| Next routing | Implemented | C `0x10412..0x10457`; group preserved when descending to Outside, reset only on change to Water/Castle; all four supported modes retain source routing; Practice Next stays mode4 |
| New student/defaults | Implemented | MENU `0xe39c`, `0xed25..0xee83`; clears260 bytes before cancellable prompt; uppercase letters/digits only,8 characters; goal5/group1/character1/durations2,5,5,10 |
| Student name collision/rename | Implemented with host filename matching | MENU `0xede6..0xee26`, `0xf3d8..0xf420`; duplicate New loads existing, accepted rename deletes OLD then saves NEW, Escape cancels first, no confirmation; case-insensitive lookup reuses existing storage key |
| Group selection | Implemented | C `0x11668..0x11696`, groups1..6 via original dropdown, plus separate native fallback |
| Goal/character editor | Implemented | MENU `0xf1fb..0xf540`; source field/focus/hit rectangles, goal5..150, FONT3H labels, GREET2/prefbox_1 selection overlay |
| Duration editor | Implemented all four source fields | C `0x90e1..0x90f5`, `0x12c90`; clamp1..60, zero default and signed multiplication retained; Practice uses field+36/default600s; Water/Castle use fields+32/+34 and default300s |
| Save/load structure | Implemented, host transport | C 260-byte .STU offsets and save magic; namespaced localStorage, no filesystem I/O or old app saves |
| Last-used student | Adapted | C carryon op identified; browser `current` pointer, not original carryon file |
| Load chooser and text cursor | Implemented with host sampling | MENU `0xf653..0xfb19`, `0x1aced..0x1b41b`; max30 sorted names,3x10 bounds, source signed tick double-press, D Done/load, cancellation never deletes; full-cell4/2 tick inversion |
| Demo/menu idle | Implemented | STARTUP source-specific poll sites in all4 worlds, Alt-X option10 guard, abort/FIFO flush and no saved progression; idle text/blink never launches gameplay |
| Report card | Implemented | REPORT-HELP `0xe65b..0xe997`; RCARD, teacher pointers, original formats/coordinates and signed per-key ranking, including empty zero-error value |
| Help/keyboard/About | Implemented, fades omitted | REPORT-HELP `0x1537f..0x1592c`, `0x145df..0x1467f`, `0x11d54..0x121ea`; original text/font/palettes, paging/focus and caller raster/pointer return; closing keys consumed |
| Music/sound/speech menu options | Implemented, bounded transport | AUDIO DS:5038 XOR1/2/4; M starts/stops music2, S/G gate future calls, effects1/11 bypass S; browser mute separate, unsupported synthesis silent |
| Quit/Alt-X/OS errors | Source guards plus host notice | HOST-GAPS signed KWD>=10, not audio bit0x10; disabled Alt-X consumed across startup/worlds/Demo/modals/results, ordinary menu Quit unconditional; no tab closure or simulated filesystem/device success |
| Lesson customization/advanced reporting | Unknown UI integration | MSD20000..20201 labels retained; no functional claims |

## Outside

| Original area | Status in app | Evidence and remaining limit |
|---|---|---|
| Resource initialization and start | Implemented subset | O `0x1272e`, `0x13dc3`; Ready holds before the ordinary loop; exact PCM or acknowledged omission, no fabricated duration |
| Lesson files and groups | Implemented | C `0x928b..0x9355`, O `0x093f6..0x0946b`; exact H/T/B/N/S LETTERS bytes, tilde/CR/EOF rules |
| Group6 and random segment | Implemented shared activity stream | T `lessonPrefix`, `selectCorpusSegment`, O `makeBonus`; current-host low16 seed or query entry seed; startup/menu/fireworks callers share the same process stream, with source skip-dependent counts |
| Obstacle allocation/type/height | Implemented | O `0x12dbb..0x12ee3`, ten slots, x>220 spawn gate, only block height57 reachable |
| Target selection and input | Implemented | O `0x133f7..0x134cc`, `0x13ba1..0x13d1a`; immediate case-insensitive ordinary match, no contact gate, one key per update |
| Correct/wrong counters | Implemented | O same input path, unsigned counter wrapping; wrong key records expected target in profile |
| Motion/adaptive scrolling | Implemented | O `0x135dc..0x136a0`; signed low-word math, no-input stop, no lives/collision/health system |
| Run/jump frame selection | Implemented | O `0x135c9..0x13851`, WALKING indices0..23 for Mario, corresponding families for Luigi/Princess; R additive origins, zero mask and assembled activity palette |
| Idle timing/frame selection | Implemented timing and imagery | O tables FILE0x2260a/0x22639/0x22668; R all145 decoded IDLE frames selected through `characterFrame`, no walking substitute |
| Target glyph and cursor | Implemented, full-redraw adaptation | O `0x1413d..0x14259`, OUTSIDE indices4..7 and FONT7H target array; glyph offsets6,3 /15,3 and color mapping0,15,31 retained |
| Turtle/block removal | Implemented | O six-update countdown, OUTSIDE indices0..2; no independent enemy AI |
| Debris | Implemented | O `0x12f59..0x13057`, `0x13146..0x131f7`, OUTSIDE index3; gravity, pool/clipping and same-tick updates |
| Background and ground strip | Implemented exact indexed tile | O `0x1436c`, R `drawGround`, fixed OUTSIDE scene, strip y140..155, previous-scroll phase and FILE0x1f582 tile |
| Scrolling full landscapes | Not an ordinary mechanic | O OUTSKY/OCASTLE are special presentations, never cycled as normal scenery |
| Frame wait | Adapted | O `0x1470c`, BIOS changed-tick wait; browser18.2Hz no catchup, elapsed independently sampled |
| Duration/early exit | Implemented | O `0x13a8e..0x13b9e`; Escape/F10 abort, repeated-timeout ending semantics retained |
| Pause/keyboard queue | Adapted/unknown | No recovered P pause; blur suspends timer+updates; one-slot latch replaces unknown DOS queue capacity |
| Bonus placement/countdown/key intercept | Implemented | O `makeBonus`, `updateBonus`, `0x13852..0x13975`; five draws before duration reset, observed wall-second activation, exact punctuation intercept before ordinary score |
| Bonus cinematic | Implemented, host cadence | O `0x14298..0x1436b`, R BAN/ANI decoder and two-wait callback; OUTSKY + character OUT files, timer310/300, discarded input, scene restore; sound7 callback requests integrated, synthesis/fades omitted |
| Progress celebration/fireworks | Implemented | CELEBRATIONS `0x13e29..0x1413c`; OCASTLE,55 moves, source skip boundaries, up to10 low-bit RNG fireworks and two waits per packet |
| Sound requests | Implemented requests, synthesis silent | AUDIO correct/wrong1/11, destruction3/4, repeated jump2 at each actual update, bonus7; dispatch before later controller RNG/clocks, not replayed from a final batch |
| Activity reentry persistent counters | Implemented for supported activities | T REENTRY: cursor/stationary/distance/idle/ground counters survive; entry resets position/scroll/objects. Bonus observed-second clock survives intervening Practice; previous duration, RNG and Practice timestamp remain shared |

## Statistics, results and progression

| Original area | Status in app | Evidence and remaining limit |
|---|---|---|
| Active timer pause/resume/reset | Implemented | C `0x15afb..0x15bee`; caller supplies browser-converted18.2Hz ticks |
| Elapsed/WPM/accuracy arithmetic | Implemented | C `0x15bac..0x15d74`; signed casts, net-character formula, stale accuracy on zero attempts retained |
| HUD and result labels | Implemented source positions/formatting | REPORT-HELP `0x15d77..0x16445`; operation200 for all4 modes, distinct FONT3H Water and FONT5H others, exact palette indices/widths/clock quirks; BLACKBRD operation210 includes profile-gated goal |
| Per-key errors/ranking | Implemented | C `0xe41c..0xe4ef`; signed ties/wrap/space/DEL, max5, zero-error empty rendering; report does not rewrite saved counts |
| Eligible completion/goal update | Implemented for Outside | C `0x13d4a..0x13dac`; before results, exit gate honored, strict > cap preserved |
| Results image/buttons/keys | Implemented | C `0x164dc..0x167bb`; inclusive Next/Menu bounds, Enter pointer semantics, Next does not increment again |
| Result speech | Implemented bounded PCM | `resultSpeech` previousGoal predicate; congrats/toobad return before suppression reset/input initialization; muted/locked/missing acknowledged with no guessed wait |
| Water advancement | Implemented | C `0x17e24`; failure/abort gates, cached score, strict >30 completion; source WCAS progression presentation completes before results |
| Castle advancement | Implemented | C `0xda44`; failure/exit gates, cached WPM, lesson/goal and completion flags; ending suspends before save/results; completion follows the source presentation return |
| Ending flags/ending art | Implemented | CELEBRATIONS `0xdf46..0xe127`; all modes show ENDF,18 mandatory waits; bit4 repeats movie until key, then sets completed before save |
| Certificate queue | Queue implemented, printing unsupported | C `0x103d0..0x10475`; Next queues only completed/unprinted/nonpending worlds before save; printed bytes unchanged |
| Printer and certificate output | Unknown transport | CERTIF artwork decoded, no browser print substitute |

## Water, Castle and Practice

| Original area | Status | Evidence and limit |
|---|---|---|
| Water words/window/input | Implemented | W `0x16a04`, `0x174b3`, `0x17892`; case-sensitive, normalized whitespace/window rules |
| Water swimmer/peak-WPM positioning | Implemented | W `0x172d9..0x17453`; source-ordered controller, draw-time snapshots |
| Water pursuer/bubbles | Implemented | W `0x1710a`, `0x16fd4`; scripted animation, no invented collision |
| Water inactivity/failure/sinking | Implemented | W `0x176e6`, >20 any-input inactivity, chase/sink through results/Next |
| Water bonus | Implemented | W `0x17560`, `0x17ef9`; all three56-packet movies, two changed-tick waits, timer stop/restore/input flush |
| Water presentation | Implemented except synthesis/intermediate fades | FONT9H(0,47), FONT7H bonus, BITER slots48..63, ordered dirty actors and source wave tiles; WCAS progression presentation uses56 unskippable swim updates,48 unskippable movie packets, exact clipping/fades and final input flush |
| Castle sentences/metadata queue | Implemented | W `0xbb06..0xbf47`; case-sensitive32..126 and completion flags |
| Castle rockfaces/movement | Implemented | W `0xc410..0xc921`; fixed tables, stage positions, no general collision engine |
| Castle pipes/scroll transitions | Implemented | W `0xc082`, `0xca14`, `0xd127`; timed/scripted segments |
| Castle sand/text progress/sinking | Implemented | W `0xcd7a`, `0xc36e`; WPM position and scripted failure |
| Castle timeout/accuracy/inactivity failure | Implemented | W `0xbc7e`, `0xbffb`; separate flags, no invented lives |
| Castle BGS/clipping/bonus bindings | Implemented except synthesis/intermediate fades | R BGS and CASTLE: four320×129 scenes at y26, forty eight-pixel strips with scratch/bias and pre-scroll actor position, inclusive clips, final palettes, FONT9H metadata and exact BAN write/ANI operations for all3 movies; same-value writes preserved |
| Practice corpus/expression/key acceptance | Implemented | T exact runtime cursor/input and W `practiceCorpus/practiceExpression`; all15 real corpora, case-sensitive32..127 or CR, no inactivity loss |
| Practice line wrap/prefill | Implemented | T `0xb3e1..0xb4d3`, exact10x33 buffer/nine fills, LF early return, partial-word rewind, NUL and repeated-overlong-word quirks preserved |
| Practice duration/exit/results | Implemented | W `0xb1e6`, `0xb5c2`, `0xb809`; default600s/configured field, Esc early exit, F10 ignored, no progression, mode4 Next preserved |

| Practice art/font/face | Implemented, partial presentation adaptation | PRACTICE.CRX/GSO indices0..2, FONT5H; face142,21, rows30,96+10*r; source numeric HUD; static Practice input cursor remains a host adaptation |

### World integration and remaining gates

- Water now honors pending suppression (`0x17943..0x1794c`), conditional RNG order, source waits, failure/results and bonus restoration. [Controller](analysis/worlds/WATER-CONTROLLER.md), [render evidence](analysis/render/WATER.md) and [Phase2 report](reports/PHASE-2.md) define the integration. Browser scheduling/typematic/focus, synthesis and intermediate world fades remain explicit limits. Ready suspends before music3/lastInput, while the lesson timer already runs.
- Castle integrates the full metadata queue and repeating scene controller (`0xbb06..0xde2d`), operation2/3 separation, old-position rock triggers, typing locks, repeated pipe RNG comparisons, sand entry/active/exit and both failure loops. Clean stationary rocks do not redraw. Source-key Chrome tests run two cycles for each character; source/pixel tests check scratch restoration and all40 strips. [Phase3](reports/PHASE-3.md) records implementation; Phase3 independent review passed and checkpoint `465129e` was pushed. [Phase4](reports/PHASE-4.md) records current local UI/HUD checks.
- Water/Castle controllers reuse the shared RNG/corpus and BAN/ANI decoders; numeric helpers alone are not used as a substitute for their full source scene loops. Existing [worlds mechanics](analysis/worlds/MECHANICS.md), [coverage mapping](analysis/worlds/coverage.json) and [render limits](analysis/render/RENDERING.md) enumerate bounded evidence and gaps. This is not an exhaustive decompilation claim.

## Resources and proof limits

A independently validates20 CRX backgrounds,567 indexed GSO/font sprites,15 lesson files,177 messages, ANI tables and archive/member hashes. R additionally validates145 GCO idle frames,628 BAN packets, nine ANI coordinate tables, exact tile and palette splice/mask/origin rules. Phase 1 adds four BGS scenes and144 Water/Castle/inline sprite records (289 total in the render manifest), world palettes and decoded ANI rasters. Phase2 adds Water resources; Phase3 adds Castle scenes/sprites/palettes, source bonus-X words and exact52-packet BAN/ANI write runs for each character to ignored app data. Phase6 schedules all four VOC clips as real mono PCM buffers, 158,254 samples at 1,000,000/56 Hz. The supplied CNF is hash-checked and decoded, not replaced by RS defaults. All58 unsupported resources are inventoried and silent. Finger hints, mouse pixels, Practice cursor callbacks, certificate document/selector and intermediate palettes remain recoverable missing components. No executable, driver or archive script was launched, interpreted or emulated.

The tests compare source-derived expectations and browser behavior, not an executed DOS reference. This matrix is bounded by the recovered reports; it is not a claim that every original routine has been decompiled.
