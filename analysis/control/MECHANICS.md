# Control, students, scoring and progression

Recovered routines are runnable in `../../recovered/control/`. This is a partial static translation, not a complete UI implementation. The strongest new findings are strict completion thresholds, persisted student offsets, exact main-menu/result hit boxes, corpus routing, and the distinction between advancing a lesson and pressing Next.

## Integration entrypoint

- `scoring.mjs`: integer scoring and active-tick pause/resume/reset.
- `flow.mjs`: mode gates, Next routing, progression, certificate eligibility, corpus filenames, menu commands/navigation/hit boxes.
- `student.mjs`: 260-byte student structure, recovered defaults, normalization, save preparation, per-key errors.
- `results.mjs`: result buttons/keys, speech conditions, duration clamping/conversion.
- Call `progression` at activity completion, BEFORE results. Next does not increment the lesson again.
- Use `nextRoute` on a Next action. It may change the world and reset the group to 1.
- Never substitute conventional five-character WPM. This executable uses net characters times 182 divided by active BIOS ticks.
- `mainMenuCommand` accepts DOS decoded key values, not browser keycodes. Map browser events explicitly.
- `mainMenuHit` translates the six right-side boxes only. It does not implement the surrounding dropdown or pixel-color interception logic.
- Original resources and derived evidence remain local and are not covered by the repository MIT license.

## Identity and method

| Source | SHA256 |
|---|---|
| `Mario_Teaches_Typing_1992.zip` | `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd` |
| `MarioTea/MARIO/MARIO.EXE` | `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e` |

`identity.json` records every member name/hash, including `MarioTea/MARIO/ENGLISH.MSD`, screens and lesson files. `messages.json` independently decodes that MSD member with original resource IDs and byte offsets. `tables.json` contains independently decoded executable jump/rectangle tables. `byte-slices.json` stores original instruction/table bytes as hex. No original code was executed, interpreted, emulated or loaded as code.

Prior research was used to find code. The supplied archive was hash-checked, and 44,994 disassembly byte lines were compared against its executable. Focused new LLVM disassembly starts at known function boundaries. `verified-disassembly.txt` is self-contained reference material; linear disassembly can misdecode embedded tables and the first instruction after them. In particular, the old listing loses the `0xfb90` title entry alignment. `title-entry.asm.txt` corrects that. Automatically attached `DS string` comments are search aids, not proof that a constant is a string pointer. LLVM prints `cwde/cdq` for bytes 98/99; in this 16-bit code they mean CBW/CWD.

All addresses below are executable FILE offsets. MZ load image begins at `0x2e00`; DS file base is `0x1f270`. Far-call mapping: `0x2e00 + segment*16 + offset`.

## End-to-end flow

```text
DOS entry 0x2e00 -> C runtime -> application 0x1d89d
  -> host/config/resource setup 0x125b9, 0x8aeb, 0x96e5, 0x125d8
  -> sound/resource setup -> 0x1d03c -> main loop 0x121eb
  -> title/greeting 0xfb90 (once at main-loop entry)
  -> menu wrapper 0x11afb
       DS:4fe2 != 0: clear flag, route Next (0x103f8), bypass displayed menu
       otherwise: load MAINMENU, run 0x10ce3 menu event loop, unload
  -> save student if present (0x12202)
  -> dispatch DS:4fee:
       1 outdoor 0x13dc3
       2 water   0x17e03
       3 castle  0xddfb
       4 practice 0xb809
  -> activity exit / progression / save / results
  -> repeat menu wrapper (0x12240 -> 0x121fe)
```

Recovered call ordering is direct. Host initialization internals, command-line behavior, logo timing and title animation sequencing are not fully translated. The title is not a newly invented Start-button screen.

### Menu actions and state

Main menu loader at `0x10488` requests resource stem `mainmenu` at `0x104b7`. Input loop exits only when local `bp-5` becomes nonzero (`0x11a05`). Selecting an allowed world sets both profile mode DS:50b7 and dispatch mode DS:4fee, then sets that exit flag (`0x11465..0x114d2`).

| Input | Action | FILE evidence |
|---|---|---|
| 1, 2, 3, 4 | Outdoor, water, castle, practice | `0x11465..0x114ce` |
| 5 | Student report if profile present | `0x114d5..0x114ff` |
| 6 or N | Next; ignored while demo flag DS:50c3 is set | `0x11502..0x11513` |
| W | New student, clear structure then edit | `0x113ee`, student op `0xaf5` |
| L | Load student chooser | `0x11410`, op `0xaf4` |
| D | Demo name/flags | `0x11419`, op `0xaf6` |
| E | Edit only if profile present | `0x11448`, op `0xaf7` |
| T | Lesson durations; initialize defaults if first duration is zero | `0x11434` |
| C | Certificate service | `0x1145d -> 0xaaf9` |
| A | About | `0x1159b -> 0x11d54` |
| H / F1 (`0x13b`) | Help operation 1 | `0x113d1` |
| K / F2 (`0x13c`) | Keyboard screen | `0x113e2` |
| M, S, G | XOR sound option bits 1, 2, 4 in DS:5038 | `0x11516`, `0x11583`, `0x1158a` |
| Q / Alt-X (`0x12d`) | Quit helper | `0x115a7` |
| Escape | Close dropdown, NOT quit | `0x115ac` |
| Enter / Space | Open dropdown if closed, otherwise activate selected row | `0x115b9` |
| arrows | Navigate dropdowns, not world boxes | `0x1169e..0x119f5` |

Letters accept both cases. Before the fallback table at `0x11a37`, code compares uppercase key to first byte of localized MSD resources 10003..10016. English messages include resource 10004 `W for neW student`, 10009 `Demo`, 10015 `T edit lesson Times`. These are not inferred from the old browser.

Dropdown column DS:4871 ranges 1..3; row DS:486f is zero when closed. Column 1 has eight entries (About, Help, Demo, Keyboard, Music, Sound, Speech, Quit); column 2 has five (New, Load, Edit, Times, Certificates); column 3 has six lesson groups. Up wraps 1 to last only while open; down opens at 1 and wraps last to 1. Left/right wrap columns, and an open dropdown resets to row 1 (`0x10f2c`). Lesson activation accepts 1..6, updates DS:50c1, redraws, and saves (`0x11668..0x11696`). Dropdown pointer hit logic at `0x10eea..0x110c7` is mapped in assembly but not fully translated.

### Main-menu pointer bounds

Table FILE `0x21708` (DS:2498), comparisons `0x11121..0x11167`. Bounds are **half-open**, x in `[236,299)` for all six:

| Index | y range | Action |
|---|---|---|
| 0 | `[12,39)` | outdoor |
| 1 | `[43,70)` | water |
| 2 | `[74,101)` | castle |
| 3 | `[105,132)` | practice |
| 4 | `[136,163)` | report |
| 5 | `[167,183)` | Next |

Before these comparisons, `0x110ce..0x1111a` scans a 7x7 neighborhood around the pointer for pixel value `0x58` and may route elsewhere. Do not claim the box helper alone implements every original pointer behavior. Additional inclusive rectangle x=50..75,y=47..66 sets DS:483b/483c and calls `0x10c27`; its visible meaning remains unassigned.

### Mode gating / Next

| Condition | Action | FILE |
|---|---|---|
| no persisted profile | all four world choices allowed | `0x11473`, `0x11494` |
| profile, goal <10 | water rejected, student warning op `0xb00(2)` | `0x1147a..0x114aa` |
| profile, goal <30 | castle rejected, warning op `0xb00(3)` | `0x1149b..0x114aa` |
| Next with mode=4 | preserve practice and group | `0x10412` |
| Next goal <10 | set mode 1; DO NOT reset group | `0x10419..0x10426` |
| Next goal 10..29 | set mode 2; reset group to 1 only if changed | `0x10428..0x10442` |
| Next goal >=30 | set mode 3; reset group to 1 only if changed | `0x10444..0x10451` |

These are signed 16-bit comparisons. Warning resources 2350..2370 explicitly describe goal WPM required for underwater and underground worlds.

## Students and persistence

Student service entry `0xe14e`; dispatch table `0xe631`. `tables.json` records all 21 opcode slots, including unsupported slots routed to the fatal unknown-opcode branch. Key operations:

| Opcode | Routine/action |
|---|---|
| `0xaf1` | Build `<student name>.stu` pathname (`0xe218`) |
| `0xaf2` | Read 260 bytes; on successful open set demo=0/profile=1 (`0xe25d`) |
| `0xaf3` | Save only if profile flag nonzero (`0xe2df`) |
| `0xaf4` | Load chooser `0xf653` |
| `0xaf5` | Zero 260 bytes, new-name editor `0xebd2(1)` |
| `0xaf6` | Copy message 2000 `Demo`, demo=1/profile=0 |
| `0xaf7` | Edit existing student `0xebd2(0)` |
| `0xaf9` | Clear 96 error counters and problem-key text |
| `0xafa` | Increment error counter for code 32..127 |
| `0xafb` | Build up-to-five problem-key text |
| `0xafc` | Report `0xe65b` |
| `0xafe` / `0xaff` | Save/load last-used name in `carryon` |
| `0xb00` | World-gating warning `0xe99f` |
| `0xb05` | Delete named student file |

Raw student structure starts at DS:50a8:

| Relative offset | Meaning / type |
|---|---|
| +00..03 | Save writes `1a 53 54 55` (`SUB STU`) |
| +04 | NUL-terminated name; editor limit eight; reserved span before +0f preserved |
| +0f | mode, signed word |
| +11/+13 | last WPM / accuracy, signed words |
| +15/+17 | previous goal / goal, signed words |
| +19 | lesson group 1..6, signed word |
| +1b/+1c | demo / persisted-profile-present bytes |
| +1d | character selector 1..3, signed-byte normalization |
| +1e/+20/+22/+24 | outdoor/water/castle/practice minutes, signed words |
| +26..28 | completion bytes per world |
| +29..2b | certificate printed bytes |
| +2c..2e | certificate pending bytes |
| +2f..43 | problem-key text and preserved reserved bytes |
| +44..103 | 96 signed 16-bit error counters for codes 32..127 |

Save (`0xe31f..0xe35a`) clears demo and writes exactly 260 bytes. No sample STU member exists in the archive. Read-open success, not an independently verified length/magic validator, controls profile presence in the inspected load branch. The JS reader rejects non-260-byte buffers as a host safety adaptation, and does not claim to duplicate malformed DOS-file handling.

Every student service first clamps group to 1..6, accuracy to 0..100, character to 1..3 (`0xe184..0xe1cb`). This occurs BEFORE dispatch, therefore loading bytes can replace those just-normalized values until the next service call. New-student defaults at `0xee28..0xee83`: goal=5, mode=1, lesson=1, character=1, profile=1, demo=0, completion/printed arrays cleared. `0xeb91` sets minutes `[2,5,5,10]`. Name input Escape/empty exits (`0xed62`,`0xed90`); first dot truncates the base name (`0xed97..0xedbd`); if that .stu exists, it is loaded rather than replacing it with fresh defaults. The helper requires an already accepted name and is not a text editor.

Per-key error counts wrap at 16 bits. Ranking is descending signed count, ASCII ascending on ties; omit space, include DEL, at most five. No positive non-space entries yields an empty translated result, leaving presentation fallback explicit. Original message 2100 is `None!`; the original text-buffer termination path needs care before reproducing that fallback.

Duration editor clamps parsed signed values to 1..60 (`0x90e1..0x90f5`), not 0..60. Rectangle table DS:0256 uses x,y,width,height with inclusive endpoints, unlike the main menu. Defaults are used for zero durations at world initialization. Outdoor `0x12c90`, water `0x16d0e`, castle `0xd949`, practice `0xb1e6`; nonzero values multiply by 60 with low signed-word result sign-extended to the 32-bit limit. Main-menu T initializes all four defaults if outdoor duration is zero.

## Corpus routing

Direct filename selection at `0x928b..0x9355`, not just character-set inference:

| Lesson group | Prefix | MSD label IDs |
|---|---|---|
| 1 | H | group-name helper `0xeece` requests `299 + group` |
| 2 | T | same |
| 3 | B | same |
| 4 | N | same |
| 5 | S | same |
| 6 | randomly choose 1..5 | same |

Mode 1 uses `letters`, mode 2 `words`, mode 3 `sentenc`; other modes default to `letters` in this routine. Language extension comes from `0x8b00`, English resolves to `.LEE`. Format string FILE `0x1f51a` is `%c%s.%s`. Group 6 computes `floor(rand()*5/32768)+1`, then re-enters the group switch. The RNG implementation and call timing are not translated; caller must supply the 15-bit random value. The decoded jump table at `0x9485` proves H,T,B,N,S,random ordering. Loader rejects resource size >32000 (`0x93ae`). Corpus record iteration is not translated here; do not normalize text or use the browser recreation as a corpus source.

## Timer and exact scoring

Game statistics at DS:51b7, size 0x3e, signature GST:

| Offset | Meaning |
|---|---|
| +05/+07/+09 | signed-word attempts/errors/correct |
| +17 | signed dword displayed elapsed seconds |
| +1f | signed dword lesson limit seconds |
| +23 | previous BIOS tick sample |
| +27 | current BIOS tick sample |
| +2f | signed dword accumulated active ticks |
| +37/+39 | signed-word WPM/accuracy |
| +3d | running byte |

Timer operations: 120 start with wall timestamp; 130 stop with wall timestamp; 300 resume; 310 pause; 320 clear active ticks/elapsed/running; 100 refresh; 210 report; 10 initialize/20 validate. Dispatch table FILE `0x164ac`. Reader `0x19317` calls BIOS interrupt 1a function 0. JS receives tick counts directly; browser millisecond conversion is a separate explicit adaptation.

```text
paused --300--> running (lastTicks = now)
running --100--> running (ticks += now-lastTicks; lastTicks=now)
running --310--> paused (ticks += now-lastTicks)
paused --100--> paused (lastTicks=now; ticks unchanged)
any --320--> paused (ticks=0; elapsed=0)
```

Arithmetic `0x15c2f..0x15d74`:

1. `elapsed = signed32(ticks * 10) / 182`, quotient truncates toward zero; clamp only above signed lesson limit.
2. Set structure accuracy=0. If signed attempts>0, store low-word `signed(correct)*100/attempts` and copy it to profile accuracy DS:50bb. Otherwise the profile accuracy is LEFT UNCHANGED, not set to zero.
3. If signed ticks<=0, WPM=0. Otherwise subtract individually sign-extended correct and errors, clamp net to zero, multiply by 182, divide by ticks, STORE LOW WORD, then clamp negative signed-word WPM to zero.
4. Copy WPM to DS:50b9.

The WPM formula corresponds approximately to net characters per six-character word per minute if 18.2 ticks/sec is assumed. The integer constants are recovered; that verbal interpretation is inference. BIOS midnight rollover repair is not visible in this path. Tests include overflow and stale-profile-accuracy cases, not only normal typing sessions.

## Completion, results and certificates

Progression gates: profile present; result WPM >= signed goal; per-scene early-exit flag absent or helper `0x15034(10)` true; additionally no water failure DS:4c23 or castle failure DS:46e2. Outdoor gate compares the game-stat WPM; goal assignment reads DS:51ee, the same +37 field of the global stats object in normal orchestration.

| World | group<6 | group>=6 | FILE |
|---|---|---|---|
| outdoor | increment group | previousGoal=goal; goal=result+2; only if goal>10, clamp 10 and set completion | `0x13d61..0x13da3` |
| water | increment group | previousGoal=goal; goal=result+5; only if goal>30, clamp 30 and set completion | `0x17e54..0x17e8b` |
| castle | increment group, ending flag 1 | previousGoal=goal; goal=result+5; if >=45 ending 4 first time, otherwise 1; set completion; below45 ending 2 | `0xda7e..0xdadc` |

Important correction to earlier summaries: outdoor/water completion uses STRICT `>` after adding the increment. A new goal exactly 10 or 30 does not set the completion flag, although Next can already route to the next world. Castle goal is not capped at45. Arithmetic additions wrap as signed 16-bit values.

Results entry `0x164dc` skips the report when demo DS:50c3 is nonzero. Otherwise loads `blackbrd` at `0x16537`, renders stats operation210, and conditionally plays congrats/toobad by comparing WPM with PREVIOUS goal. Suppress speech when DS:51b6 set, no profile, practice mode, outdoor goal>10 or water goal>30. Result screen resets DS:51b6 afterward.

Result buttons have **inclusive** bounds: Next x=55..102,y=177..191; Menu x=135..180,y=177..191 (`0x16648..0x16680`). N selects Next, M/Escape selects Menu. Enter dispatches the current pointer position. Tab/right/down cycle two button positions; left/up cycle backward. Space is not a result-screen activation key. F1 calls help operation2; F2 keyboard; Alt-X uses conditional quit helper. Next sets DS:4fe2=1; next menu-wrapper invocation clears it and directly calls `0x103f8`, bypassing menu display (`0x11b92..0x11ba3`).

Castle ending routine `0xdf46` tests bit flags 1,2,4, not an opaque enumeration. Bit4 takes a distinct final animation path at `0xe0ca..0xe0f0`; flags1/2 display group/goal-related text. See `ending.asm.txt` and corresponding MSD IDs. Exact ending animation timing is not implemented.

Certificate queue `0x103be`: for each of three worlds, if profile present && completed && !printed && !pending, set pending. Main-menu C routes to `0xaaf9`; printer transport and printed-flag mutation are not translated. Completion is not proof a certificate was printed. All three arrays are separately preserved.

## Gameplay input / pause / demo scope

Outdoor dispatch `0x13ae9..0x13c66`: read key; update last-input timestamp; demo may replace it with target character and a random 10..19 countdown. Escape or decoded F10 `0x144` sets report-suppression/early-exit flags (`0x13b7a`), inhibiting ordinary progression. Alt-X `0x12d` is conditional quit. Only codes32..127 reach normal target counting. No target index means no attempt counted. Correct uppercase comparison increments correct; wrong input increments errors and leaves target intact (`0x13c70..0x13d1a`).

At `0x13bbc`, a special pending character condition pauses timer via op310, performs scene/resource work, resumes via op300, flushes keyboard. This is not evidence for an arbitrary P-key pause command. Shared timer pause behavior is translated; user pause-key behavior across worlds remains unverified. World-specific input and gameplay remain assigned to the outdoor/worlds lanes.

## Coverage and unknowns

| Area | Status | Remaining limit |
|---|---|---|
| archive/source identity | verified | no archive code run |
| C startup / title / main loop | call flow recovered | host init and title timing not translated |
| main menu world boxes/hotkeys/arrows | translated helpers | dropdown drawing, pointer interception, full event pump absent |
| student persistence/defaults | field layout + helpers | complete editor/chooser/delete UI, malformed DOS I/O behavior absent |
| lesson durations | clamp/conversion recovered | text editor and cursor behavior not translated |
| corpus group/world filename routing | translated | original RNG and corpus cursor iteration absent |
| mode gating / Next | translated | browser integration must apply them in recovered order |
| timers/accuracy/WPM | translated | BIOS interrupt scheduling and midnight rollover unspecified |
| progression / ending choice | translated | visual victory animation absent |
| result menu/Next/speech choice | translated | drawing/layout only represented by original resources |
| certificates | pending predicate recovered | print transport and printed-flag changes not translated |
| help / keyboard / about | entrypoints/resources identified | modal UI implementation absent |
| demo | entry flag changes + outdoor injection mapped | full attract-loop timing and other worlds unimplemented |
| pause / quit | timer pause + outdoor exits mapped | full modal/input policies, OS exit not translated |
| audio / printer / OS | documented boundaries | no simulated support claimed |

Do not silently enable unsupported commands. A browser implementation can expose only recovered flows and clearly label omitted UI. None of these helpers constructs invented menu artwork.

## Reproduction and checks

From the isolated worktree root:

```sh
python3 transpile/tools/control/evidence.py
python3 transpile/tools/control/tables.py
python3 transpile/tools/control/disassemble.py
node --test transpile/tests/control/*.test.mjs
```

The Python programs are newly authored data parsing/static-disassembly tools. `evidence.py` can use bundled verified-disassembly when prior research is unavailable. LLVM `objdump` is required only for the fresh focused assembly. Tests use only newly authored JavaScript. Exact test results are recorded in `checks.json`; no browser or original-program equivalence test was performed.
