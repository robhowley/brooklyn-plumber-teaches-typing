# Coverage of the integrated two-activity slice

**Outside and Practice are playable through results and Next. Water and Castle remain disabled.** “Implemented” below means used by this browser app; “recovered-only” means evidence or tested helpers exist but the feature is not exposed. “Unknown” means a consequential detail is not established, not permission to invent it.

## Evidence map

All FILE offsets refer to `MarioTea/MARIO/MARIO.EXE`, SHA256 `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e`. Archive SHA256 is `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`. Original member hashes and resource indices are retained in the linked manifests/tables.

- **C**: [control report](analysis/control/MECHANICS.md), [menu assembly](analysis/control/menu.asm.txt), [messages](analysis/control/messages.json), [identity](analysis/control/identity.json).
- **O**: [Outside report](analysis/outdoor/MECHANICS.md), [tables/resource indices](analysis/outdoor/tables.json), [mechanic evidence](analysis/outdoor/mechanics.json).
- **W**: [Water/Castle/Practice report](analysis/worlds/MECHANICS.md), [resource indices](analysis/worlds/sprites.json), [numeric tables](analysis/worlds/tables.json).
- **A**: [resource formats](analysis/assets/RESOURCE-FORMATS.md), [asset manifest](assets/original/manifest.json), [archive manifest](assets/original/archive-manifest.json).

- **R**: [render report](analysis/render/RENDERING.md), [BGS/world contracts](analysis/render/BGS.md), [decoded bindings](assets/render/manifest.json), indexed compositor/ground/idle/BAN/ANI evidence.
- **T**: [runtime report](analysis/runtime/RUNTIME.md), [reentry contracts](analysis/runtime/REENTRY.md), exact RNG/corpus/Practice/bonus APIs and byte spans. These supersede historical BGS, font-binding and retained-counter gaps; [Phase 1 checks](reports/PHASE-1.md) cover current integration.

## Boot, menu and student UI

| Original area | Status in app | Evidence and remaining limit |
|---|---|---|
| DOS/C startup, config, devices, command line | Recovered-only/unknown | C `0x1d89d`, `0x125b9`; no hardware/driver execution |
| Logo, title, greeting sequence | Recovered-only/unknown | C `0xfb90`; decoded LOGO/GREET/GREETBG (A), timing omitted; direct MAINMENU entry is host adaptation |
| Main-menu background | Implemented | A MAINMENU.CRX, indexed pixels and embedded palette |
| Main-menu top labels/font | Implemented, partial drawing | C `0x105cc..0x106f9`; FONT5H at DS:4fc4, resource IDs1100/1110/1120; dropdowns disabled |
| Welcome/student greeting | Implemented, provisional color | C `0x10979..0x10adf`, IDs1150/1250..1254; original slot88 unresolved, host red substitute |
| Six right-side hit boxes | Implemented | C `0x11121..0x11167`, half-open rectangles; no added source selection |
| Pixel-color interception and Mario click region | Recovered-only/unknown | C `0x110ce..0x1111a`, pixel88 neighborhood and x50..75/y47..66; omitted |
| Menu hotkeys and world eligibility | Implemented for supported actions | C `0x111d8..0x114ce`; unsupported keys report disabled in host status |
| Dropdown keyboard navigation | Recovered-only | `flow.mjs:menuNavigation`; no pretend dropdown event pump |
| Dropdown pointer/layout/full commands | Recovered-only/unknown | C `0x10eea..0x110c7`; visibly disabled |
| Next routing | Implemented | C `0x10412..0x10457`; group preserved when descending to Outside, reset only on change to Water/Castle; unsupported destination stops with notice |
| New student/defaults | Implemented data, adapted UI | C `0xe39c`, `0xee28..0xee83`; eight ASCII characters, goal5/group1/character1/durations2,5,5,10 |
| Student name collision | Implemented | C `0xed97..0xedbd`; browser name store loads existing profile, does not reset it |
| Group selection | Implemented data, adapted UI | C `0x11668..0x11696`, groups1..6 and MSD300..305; browser select replaces disabled dropdown |
| Goal/character editor | Implemented fields, adapted UI | C student offsets +17/+1d; goal editor bounds not fully translated, host positive-word validation; character1..3 |
| Duration editor | Implemented Outside/Practice fields, adapted UI | C `0x90e1..0x90f5`, `0x12c90`; clamp1..60, zero default and signed multiplication retained; Practice uses field+36/default600s; inactive-world durations remain stored without an editor |
| Save/load structure | Implemented, host transport | C 260-byte .STU offsets and save magic; namespaced localStorage, no filesystem I/O or old app saves |
| Last-used student | Adapted | C carryon op identified; browser `current` pointer, not original carryon file |
| Delete/load chooser/original text cursor widgets | Recovered-only/unknown | C `0xf653`, student op0xb05; host selector only, no delete |
| Demo/attract loop | Recovered-only | C demo flag, O synthetic10..19 countdown; disabled, guest is not demo |
| Report card | Recovered-only | C `0xe65b`, A RCARD.CRX; command5 disabled |
| Help/keyboard/about | Recovered-only | C entrypoints, A HELP/KEYBOARD/HLP; disabled |
| Music/sound/speech menu options | Recovered-only | C DS:5038 XOR bits1/2/4; disabled, no misleading toggle state |
| Quit/Alt-X/OS error dialogs | Recovered-only | C conditional helper and MSD errors; disabled rather than closing tab |
| Lesson customization/advanced reporting | Unknown UI integration | MSD20000..20201 labels retained; no functional claims |

## Outside

| Original area | Status in app | Evidence and remaining limit |
|---|---|---|
| Resource initialization and start | Implemented subset | O `0x1272e`, `0x13dc3`; no fabricated ready duration; audio omitted |
| Lesson files and groups | Implemented | C `0x928b..0x9355`, O `0x093f6..0x0946b`; exact H/T/B/N/S LETTERS bytes, tilde/CR/EOF rules |
| Group6 and random segment | Implemented shared activity stream | T `lessonPrefix`, `selectCorpusSegment`, O `makeBonus`; current-host low16 seed or query entry seed; omitted title/menu/fireworks draw callers remain explicit |
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
| Bonus cinematic | Implemented, host cadence | O `0x14298..0x1436b`, R BAN/ANI decoder and two-wait callback; OUTSKY + character OUT files, timer310/300, discarded input, scene restore; fades/audio omitted |
| Progress celebration/fireworks | Recovered-only | O `0x13e29`, OCASTLE; numeric progression applied without animation |
| Sound requests | Recovered-only | O ordinary correct/wrong/destruction events; no playback, repeated jump sound not emitted |
| Activity reentry persistent counters | Implemented for supported activities | T REENTRY: cursor/stationary/distance/idle/ground counters survive; entry resets position/scroll/objects. Bonus observed-second clock survives intervening Practice; previous duration, RNG and Practice timestamp remain shared |

## Statistics, results and progression

| Original area | Status in app | Evidence and remaining limit |
|---|---|---|
| Active timer pause/resume/reset | Implemented | C `0x15afb..0x15bee`; caller supplies browser-converted18.2Hz ticks |
| Elapsed/WPM/accuracy arithmetic | Implemented | C `0x15bac..0x15d74`; signed casts, net-character formula, stale accuracy on zero attempts retained |
| HUD and result labels | Implemented, adapted positioning | C MSD10..13 and BLACKBRD; original operation210 text layout not fully translated |
| Per-key errors/ranking | Counters implemented; ranking recovered-only | C `0xe41c..0xe4ef`; no counterfeit report rendering |
| Eligible completion/goal update | Implemented for Outside | C `0x13d4a..0x13dac`; before results, exit gate honored, strict > cap preserved |
| Results image/buttons/keys | Implemented | C `0x164dc..0x167bb`; inclusive Next/Menu bounds, Enter pointer semantics, Next does not increment again |
| Result speech | Recovered-only | `resultSpeech`, previousGoal comparison; silent |
| Water/Castle advancement | Recovered-only | C `0x17e24`, `0xda44`; no enabled activity |
| Ending flags/ending art | Recovered-only/unknown playback | C `0xdf46`, A ENDF; not presented |
| Certificate queue | Recovered-only | C `0x103d0..0x103f0`; separate completion/printed/pending bytes retained; queue/print commands disabled |
| Printer and certificate output | Unknown transport | CERTIF artwork decoded, no browser print substitute |

## Water and Castle (visibly disabled), Practice (implemented)

| Original area | Status | Evidence and limit |
|---|---|---|
| Water words/window/input | Recovered-only | W `0x16a04`, `0x174b3`, `0x17892`; case-sensitive, normalized whitespace/window rules |
| Water swimmer/peak-WPM positioning | Recovered-only | W `0x172d9..0x17453`; tested arithmetic, no host loop |
| Water pursuer/bubbles | Recovered-only | W `0x1710a`, `0x16fd4`; scripted animation, no invented collision |
| Water inactivity/failure/sinking | Recovered-only | W `0x176e6`, >20 any-input inactivity; no playable failure UI |
| Water bonus/music/cutscenes | Recovered-only/unknown | W `0x17560`, `0x17ef9`; T shared key producer and R decoded ANI/BAN now available, but Water-specific scheduling/restore/audio remains unintegrated |
| Castle sentences/metadata queue | Recovered-only | W `0xbb06..0xbf47`; case-sensitive32..126 and completion flags |
| Castle rockfaces/movement | Recovered-only | W `0xc410..0xc921`; fixed tables, stage positions, no general collision engine |
| Castle pipes/scroll transitions | Recovered-only | W `0xc082`, `0xca14`, `0xd127`; timed/scripted segments |
| Castle sand/text progress/sinking | Recovered-only | W `0xcd7a`, `0xc36e`; WPM position and scripted failure |
| Castle timeout/accuracy/inactivity failure | Recovered-only | W `0xbc7e`, `0xbffb`; separate flags, no invented lives |
| Castle BGS/clipping/bonus bindings | Recovered-only, decoded/tested | R BGS: four320×129 scenes at y26, forty eight-pixel strips, inclusive clips, world palettes and exact frame/ANI bindings; controller-selected clips, transition scratch compositor and bonus restoration remain unintegrated |
| Practice corpus/expression/key acceptance | Implemented | T exact runtime cursor/input and W `practiceCorpus/practiceExpression`; all15 real corpora, case-sensitive32..127 or CR, no inactivity loss |
| Practice line wrap/prefill | Implemented | T `0xb3e1..0xb4d3`, exact10x33 buffer/nine fills, LF early return, partial-word rewind, NUL and repeated-overlong-word quirks preserved |
| Practice duration/exit/results | Implemented | W `0xb1e6`, `0xb5c2`, `0xb809`; default600s/configured field, Esc early exit, F10 ignored, no progression, mode4 Next preserved |

| Practice art/font/face | Implemented, partial presentation adaptation | PRACTICE.CRX/GSO indices0..2, FONT5H; face142,21, rows30,96+10*r; host HUD and static cursor replace unintegrated text callbacks |

### Why Water and Castle stay disabled

- Water has tested numeric motion/pursuer/bubble functions, but its main loop skips animation when input remains pending (`0x17943..0x1794c`). Full input-pump/update scheduling, random bubble draw sequence, failure-to-results orchestration and world-specific bonus restoration are not integrated. A fixed-rate generic loop would invent behavior.
- Castle requires the metadata text queue, operation2/3 separation, rockface stages,40-step scrolls, pipe delays with repeated random draws, sand entrance/exit, failure loops and repeated scene cycle (`0xbb06..0xde2d`). Numeric helpers are not a complete controller. CASTLE.BGS packing, visible strips and clip call sites are now recovered (R BGS); transition scratch-background/special-compositor integration and controller-selected ordering remain pending. No substitute backgrounds or scene schedule are fabricated.
- Shared RNG/corpus and BAN/ANI decoding resolve dependencies, not these activity controllers. Existing [worlds mechanics](analysis/worlds/MECHANICS.md), [coverage mapping](analysis/worlds/coverage.json) and [render limits](analysis/render/RENDERING.md) enumerate bounded evidence and gaps. This is not an exhaustive decompilation claim.

## Resources and proof limits

A independently validates20 CRX backgrounds,567 indexed GSO/font sprites,15 lesson files,177 messages, ANI tables and archive/member hashes. R additionally validates145 GCO idle frames,628 BAN packets, nine ANI coordinate tables, exact tile and palette splice/mask/origin rules. Phase 1 adds four BGS scenes and144 Water/Castle/inline sprite records (289 total in the render manifest), world palettes and decoded ANI rasters. These remain available to later world consumers without enabling their routes or enlarging app data. VOC metadata is not audio playback. No executable, driver or archive script was launched, interpreted or emulated.

The tests compare source-derived expectations and browser behavior, not an executed DOS reference. This matrix is bounded by the recovered reports; it is not a claim that every original routine has been decompiled.
