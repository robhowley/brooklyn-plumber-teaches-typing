# Water, castle and practice: recovered routines and remaining gaps

The strongest additional recoveries are water's peak-relative speed positioning, alternating pursuer animation, castle's table-driven rockfaces and text-driven movement, and practice's goal-selected corpus and expression rules. These are numeric/state translations, not complete playable worlds.

## Read this first

- `../../recovered/worlds/routines.mjs` translates 14 small functions, with FILE-offset citations and explicit signed 16-bit arithmetic.
- `tables.json` contains original numeric tables and exact executable offsets; `../../recovered/worlds/tables.mjs` exposes them without dependencies.
- `sprites.json` verifies 55 indexed GSO records, including resource names, zero-based GSK indices, offsets, dimensions and original member hashes.
- `water.asm.txt`, `castle.asm.txt`, `practice.asm.txt`, and `corpus.asm.txt` retain instruction bytes and resolve far calls to FILE offsets. `disassembly.txt` provides supporting callees.
- No archive program, machine code, installer, driver or script was executed, emulated or interpreted. Only ZIP reads, numeric parsing, trusted static disassembly and newly authored JavaScript/tests ran.
- Original resources and numeric data remain local and are not covered by the repository MIT license. Do not publish these artifacts.

## Identity, method and interpretation

Original ZIP SHA256: `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`.

All executable offsets below refer to `MarioTea/MARIO/MARIO.EXE`, SHA256 `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e`. The MZ header occupies `0x2e00` bytes. A load-relative far call `(segment,offset)` maps to FILE `0x2e00 + 16*segment + offset`; DS data base is FILE `0x1f270`. `manifest.json` records all original archive member hashes.

`inspect.py` checks the ZIP hash, reads the EXE as bytes, places the code region in a non-launchable ELF data wrapper for Apple objdump, and compares every emitted instruction-byte sequence to the original ZIP member. This proves byte provenance, not that a linear disassembler correctly recognizes every function. Embedded jump tables appear as nonsensical instructions; use call/branch targets to identify executable ranges. LLVM's `cwde` and `cdq` labels for opcodes 98/99 mean **CBW/CWD** in these 16-bit routines.

**Recovered** below means directly supported branches/data. Asset visual names such as Thwomp and quicksand are interpretations of `rockface` sprites and scene behavior, not original symbol names. Browser scheduling is not recovered. No numerical update below is asserted to run once per second, BIOS tick or display frame.

## Shared input and corpus

| Mechanism | Recovered behavior | FILE evidence |
|---|---|---|
| Corpus filename | `%c%s.%s`; row prefixes h,t,b,n,s for lesson1..5; lesson6 selects another lesson1..5 through RNG; default h | `0x928b..0x935a`; jump table `0x9485`, strings `0x1f504..0x1f522` |
| Corpus kind | mode1=`letters`, mode2=`words`, mode3=`sentenc`; extension comes from `0x08b00`, not hardcoded here | `0x9307..0x9355` |
| File normalization | Allocate length+1; prepend `~`; drop CR; stop at DOS EOF byte26; count `~` boundaries | `0x93c9..0x946d` |
| Circular reader | Increment DS:40ae cursor, wrap at DS:40b0 length, skip `~`; byte return sign-extended | `0x9519..0x9560` |
| Water reader | Map LF, CR, TAB to SPACE; suppress consecutive spaces using DS:40aa | `0x9561..0x95a0`, called at `0x174c8` |
| Practice reader | Preserve linefeeds, skip backtick sentence delimiters | `0x95cf..0x95f1`, called at `0xb436` |
| Castle reader | Map LF/CR/TAB to SPACE without suppressing duplicates; collect until backtick, remove delimiter, reject >500 collected bytes | `0x95a1..0x95ce`, `0xdd93..0xddfa` |
| Random starting block | Repeatedly scan to `~`, count selected by RNG and boundary count | `0x964a..0x9692`; RNG distribution/seed not translated |

These byte streams differ. Do not normalize all three worlds into a single whitespace-split word list.

## Water

### Setup and text

- `0x167f3..0x169b1` loads character-selected six swimming frames, one sunk frame, five `bite%04u_1` frames and ten `octo%04u_1` frames. WATER.GSO indices: Mario0..5, Luigi6..11, Peach12..17, bite18..22, octo23..32, bonus bubble33, sunk34..36. Exact offsets/hashes are in `sprites.json`.
- `0x16a04..0x16a32`: DS:4fe4 chooses a 20-byte window with target index5 or a 40-byte window with target index10; clears 40 bytes. The meaning of the enabling option is not assigned here.
- `0x16a4c..0x16a76`: swimmer starts at x20/y112, frame0, peak-WPM0, horizontal delay0.
- `0x16e56..0x16e88`: display replaces bytes outside inclusive 32..127 with SPACE. It renders prefix, highlighted target, suffix separately (`0x16e8a..0x16f3d`). This is display sanitation, not corpus mutation.
- `0x174b3..0x174db`: shift visible buffer left one byte, append one normalized corpus byte, mark dirty. Redraw can be deferred while keys are pending; a count >5 forces it (`0x174e0..0x17507`).
- `0x176af..0x176c4`: prefill until the byte after the target is nonzero, then advance once more. Ready audio follows at `0x176c7`, music operation3 at `0x176cc`.
- Ordinary input `0x17892..0x178e5`: accept integer key32..127 inclusive; exact case comparison, no uppercase conversion. Attempts increment for each accepted key, correct increments and shifts one byte on match, otherwise errors increment and target stays. Sound IDs1/11 distinguish match/error.

### Swimmer position and animation (translated)

At `0x172d9..0x17453`, DS:4c9b keeps the maximum of previous peak,10,current WPM. Nonfailed target y is:

```
157 - trunc(signed16(WPM * 63) / peak)
```

The `IMUL; CWD; IDIV` sequence deliberately sign-extends the **low word** of the product, not the full 32-bit product. On ordinary valid scores, peak speed maps to y94 and zero speed to y157. Current y approaches target by one pixel per update. This is recovered screen positioning, not a swimming acceleration model.

DS:4c1a increments; even values advance swimmer frame, wrapping at6. DS:4c99 delay decrements; when negative, x increments by1 unless failed, then delay becomes `trunc(trunc((oldY-79)/16)/5)+1`. x>319 wraps to -55. The old y, not the newly approached y, sets the delay.

The actual loop updates stats, swimmer, pursuer, bubble pool and bonus bubble in that order (`0x179d5..0x17a04`). It skips this entire update block if more keyboard input is pending (`0x17943..0x1794c`). Therefore a generic fixed-rate animation loop is an adaptation unless the polling/scheduling behavior is also recovered.

### Pursuer (translated)

`0x1710a..0x172d8` uses DS:4c31 mode1=bite, mode2=octo. Zero initializes to1. The frame counter increments and wraps at10 or20. Both divide the counter by2 to select a sprite, hence each source sprite lasts two updates.

- Normal x=`playerX-48-trunc((160-playerY)/2)`; if x<-55, add368. Normal y=`playerY-5`.
- Bite draws x-2 except frame-pair3; octo adds the 20-entry y table at FILE `0x21cb4`.
- When `previousDrawnX-40 > newX`, toggle mode after selecting this update's sprite. This is coordinate-wrap-driven, not a timed random enemy replacement.
- Failure phase1 moves from previous drawn x by+3; at x>=playerX-35 set phase2. Failure y follows saved player y-5. In phase2 the swimmer target becomes200, uses sunk art, and sets DS:4c1f when old swimmer y>=199 (`0x17321..0x17352`, `0x17404..0x17415`).

No player/pursuer rectangle collision is present in these traced update routines. The contact-looking event is a scripted phase threshold after inactivity, not proof of a general collision system.

### Failure and termination

- `0x176e6..0x17733`: signed32 wall-time difference >20, with failure unset, invokes stats operation310, sets failure DS:4c23=1, phase DS:4c1d=1, saves swimmer y in DS:4c21.
- Timestamp DS:4c25 resets on any handled keyboard event, before command dispatch (`0x177d8..0x177ff`), and again after bonus playback (`0x1786d..0x17888`). Wrong ordinary keys therefore postpone inactivity failure too. This does not clear an already-set failure.
- Escape27 and key0x144 set abort/end flags. Key0x12d invokes shared option handling. Do not label these extended codes as browser keys without translating the shared keyboard reader (`0x177e4..0x178fd`).
- Elapsed>=limit ends the loop (`0x17923..0x1793f`); failed sinking completion also ends it (`0x17a09`). Failure path calls `0x17eab`; nonfailure path stops/finalizes stats at `0x17a2e`.
- Default limit300 seconds; nonzero DS:50c8 minutes uses signed16(minutes*60), sign-extended to32 (`0x16d0e..0x16d34`).
- Progression `0x17e24..0x17e8b` requires enabled profile DS:50c4, no DS:4c23 failure, eligibility gates and result>=goal. Lessons below6 increment; lesson6 sets goal=min(result+5,30), DS:50cf=1. Other outcome/end-mode flags are not translated.

### Bubble pool and bonus branch

- Pool allocation `0x16f4c..0x16fd3` chooses first inactive of ten 14-byte records; stores x/y, zero dx/dy and size flag, inline sprite pointer DS:2a9c.
- Pool update `0x16fd4..0x17109` computes x+=dx, y+=trunc(dy/8)-1, then decrements dy. Sets larger form when new dy<-10, changes pointer to DS:2aa8. Deactivates outside inclusive x0..317 or y79..197. These inline sprites are not GSK entries.
- Random bubbles can originate from ten recovered coordinate pairs at FILE `0x21cdc` or at swimmer+(38,15) (`0x17457..0x17498`, `0x1794f..0x179b5`). Exact RNG sequence is not translated.
- Bonus DS:5012 state1 activates at playerX>=240; state2 starts y200 with randomized x, drifts x by random +/-1 or zero clamped10..130, rises y by3, disappears/reset below80; state3 erases it (`0x17560..0x17682`). Resource WATER.GSO index33 `bonbub_1`.
- While bonus state2, matching DS:5014 takes a special branch **before ordinary scoring**: stats310, state3, `0x17ef9` animation playback, restore scene, reset idle time, stats300 (`0x17801..0x17890`). No attempts/correct increment in this branch. Assignment of DS:5014 and animation payload semantics remain a dependency.

## Castle

### Text queue, acceptance and segment events

- `0xbb06` operation1 clears a 4000-byte word queue, appends eight spaces and three sentences. Scene type DS:470f=0 marks each sentence end with high-byte flag4; scene type1 marks only the third end (`0xbb57..0xbc1d`). `0xb9e5` appends words containing low-byte text and high-byte metadata, with a 2000-word bounds check.
- Target is low byte at queue index DS:46db (`0xbc3a..0xbc4b`). Correct input sets bit0x100 on that word, increments DS:4689, and shifts 3998 bytes left (`0xbea9..0xbf2b`, `0xba96..0xbac4`). If metadata bit4 is present, set DS:46e1 completion event.
- Ordinary keys are **32..126**, unlike water/practice's inclusion of127. DS:46d9 locks typing; operation3 ignores ordinary typing altogether (`0xbdb1`, `0xbe83..0xbe9a`). Comparisons are case-sensitive. Wrong input increments errors without shifting.
- Operation2 alone checks low accuracy (attempts>=50 AND accuracy<70), or >20 wall-time units since any input, setting DS:46e2 (`0xbc7e..0xbcd0`). Operation3 runs during transition animations and omits this failure check.
- Escape sets DS:46e4 plus global abort; CR can set completion only through shared option gate, not ordinary scoring (`0xbd65..0xbdae`). Bonus-key handling again precedes scoring, invokes `0xde6c`, and freezes/resumes stats (`0xbdba..0xbe80`).
- Progress target DS:468b=`67+trunc(signed16(correctInSegment*160)/queuedLength)` when length nonzero (`0xbf30..0xbf47`). Do not replace this with floating-point fraction of a sentence.

### Rockface/Thwomp scene (numeric parts translated)

`0xc640..0xc921` sets scene type0. Three 18-byte records begin DS:469f. Initial x values are table[82,172,262]-29 => [53,143,233]; y40; state0. Resource starts at `rockface_1`, CASTLE.GSO index0 (`0xc692..0xc725`).

For each record, `0xc410..0xc573`:

1. If state0 and rockfaceX<=**previous** playerX, set state1 and sound6.
2. States1..32 select y=40+signed-byte table[state], resource table[state] mapped to `rockface_1..4`.
3. Increment state; >=33 becomes100. State100 never resets here, so the actor stays at the last location/art until scene reset.
4. Redraw only if x/y/sprite changed or force-redraw word+12 is set.

Exact frame table FILE `0x213bd`, y table `0x213de`; arrays are included. State1 starts y40; low point y101. There is no geometric collision test in this routine.

Sentence completion advances destination stages [20,120,210,279] (`0xc76a..0xc7c6`). On stage3, stats310 stops time and typing locks. Horizontal desired velocity is `trunc((target-x)/4)+1`, clamp[-5,5]; equality explicitly zeros velocity; current velocity approaches desired by1 and is added to x (`0xc7f3..0xc845`). The +1 makes backward correction asymmetric and is preserved. Walking uses frame counter modulo12 (`0xc84e..0xc86b`); standing uses shared animation selector0. Rockfaces update before player position is committed.

Scene succeeds only at stage3, player at destination, and last rockface state100 (`0xc8e1..0xc8fe`). Failure animation dispatch waits for player at current destination before calling `0xc27c` (`0xc902..0xc912`). That animation selects frames by a cumulative timing table, not by collision; precise shared table resource loading remains untraced.

### Pipe and quicksand segments

- Screen transition `0xc082..0xc27b`: normally40 iterations, scroll8 pixels each, player net movement -7/-6 alternating (subtract8, add1+(iteration&1)); total -260. Fast option DS:503a applies -320+60 directly. Both call operation3 and preserve abort/time-limit checks.
- After rockfaces, scene transitions to background1, actor walks right by4 until x>=48 (`0xc94f..0xc9fe`).
- Pipe bumps occur in two five-sprite sequences: `0xca14..0xcb14` uses `pip10002_bump1..5` and table indices0..4; `0xd127..0xd227` uses `pip20002_bump1..5` and table indices5..9 at the `pipeX`/`pipeY` tables. Draw, sound7, four operation3 updates, erase, then random delay before next. Delay comparison recalculates RNG in the loop, so this is not a single sampled uniform duration. No user typing gate is present in this animation sequence.
- Quicksand scene sets DS:470f=1 and background2 (`0xcbd2..0xcc01`), then uses explicit entrance steps before enabling typing (`0xcd2f..0xcd77`).
- Active sand loop `0xcd7a..0xce67`: x advances by1 only while x<DS:468b text progress target. y=70 for WPM>=40; else y=70+min(10,trunc((40-WPM)/4)). Five frame resources use trunc(counter/3)%5. Completion event stops stats and exits typing; failure invokes `0xc36e` and exits the scene sequence.
- Sinking failure `0xc36e..0xc40f`: a modulo10 counter, increment y on odd counter values, select five sprite frames by trunc(counter/2), keep x fixed, update bonus actor and operation3; continue until y>=95. This is a scripted failure sequence, not gradual accumulation of low-WPM depth to death.
- Post-sand escape starts with velocity -9, adds1 to velocity each update and adds velocity to y; x advances4; descending y>=36 clamps36 and ends that phase (`0xcefa..0xcf9e`). Later scripted walk, pipe traversal and return transitions continue through `0xd378`. Their draw/clipping details remain untranslated.
- `0xd378..0xd38a` returns to `0xc640` unless exit/time flags are set. Thus this is a repeating segment sequence, not a recovered finite level map.

### End, timers and orchestration

DS:46e3 time expiration, DS:46e4 explicit exit and DS:46e2 failure are separate flags. The first two are checked throughout transitions; failure is handled in active scene loops. `0xbffb..0xc017` compares signed32 elapsed against limit. Default limit300 seconds; DS:50ca override uses signed16(minutes*60) (`0xd949..0xd96f`).

`0xddfb..0xde2d`: set active world3, audio reset `0x18a49`, init `0xd535`, scene sequence `0xc574`, cleanup `0xd97d`, audio reset, results `0x164dc`. Progression at `0xda44..0xdadc` is gated by profile/failure/exit/result; lesson<6 increments, otherwise result+5 and 45 threshold select end modes. End-mode meanings are not established here.

## Practice

- **Corpus is selected by goal**, not by a separate practice text setting: goal<10 letters, <30 words, otherwise sentences. Setup temporarily assigns mode1/2/3, calls `0x928b`, then sets mode4 (`0xb10f..0xb138`). Row lesson still affects filename.
- Loads `prac%04u_1` for1..3, PRACTICE.GSO indices0..2, 53x60 each (`0xb0ce..0xb10d`). Background stem `practice` at `0xb153`.
- Default600 seconds, not300; DS:50cc minutes override uses same low-word product (`0xb1e6..0xb20c`).
- Ten display rows with33-byte stride, 32 visible bytes per row. `0xb285` renders10 rows or first row depending operation. Each NUL displays SPACE (`0xb2b8..0xb341`). Text begins x30, y96, row spacing10; cursor x=30+8*index (`0xb2dd..0xb2ed`, `0xb64e..0xb65b`).
- `0xb3e1`: shift rows2..9 to1..8, clear bottom row, build at most32 chars until LF. If full, peek an additional character and use rewind helper `0x94ce` to preserve a word fragment; trim leading spaces; copy into last row and clear input row/index. This has subtle length32/peek/long-word edge cases and is **not translated** rather than replaced with a conventional word-wrap algorithm.
- Startup calls this line fill nine times (`0xb3bb..0xb3e0`). Current target comes from second row DS:41e6+index. Target NUL is treated as CR for demo input (`0xb6af..0xb6c0`).
- Ordinary acceptance: key32..127 or CR13. At target NUL, either SPACE or CR advances line and counts correct. A later LF comparison exists but is unreachable through this acceptance gate. Otherwise only exact target match advances index; errors retain target (`0xb73d..0xb7e0`).
- Correct input alone resets DS:41b3 last-correct time (`0xb7b0..0xb7bb`). This differs from water/castle's any-input inactivity reset.
- Expression selection (`0xb4f6..0xb547`): elapsed since last correct >15 => resource101/index0. Else profile enabled AND WPM>goal =>103/index2. Otherwise102/index1. Equality with goal is **not** the happy branch. This is a visual response, not a failure condition.
- Practice timeout sets DS:41ae and causes loop termination (`0xb5c2..0xb5e3`, `0xb69e..0xb6a5`). Escape exits; key0x12d goes through shared option gate (`0xb712..0xb73a`). No accuracy or inactivity failure dispatch was found in the practice loop.
- Orchestration `0xb809..0xb899`: active world4; init, loop, cleanup, results. No separate ready/music call appears in this wrapper. Shared result behavior remains outside this translation.

## Integration limits and gap ledger

| Area | Status | Consequence / next evidence |
|---|---|---|
| Numeric water swimmer/pursuer/bubble updates | Translated and boundary-tested | Host must preserve update order and pending-key suppression; no real-time cadence claimed |
| Rockface path, castle approach, sand position, text target | Translated and boundary-tested | Not a collision engine or whole-scene implementation |
| Practice corpus, key acceptance, expression choice | Translated and boundary-tested | Line-wrap state machine still required for faithful practice |
| Shared keyboard decoding, option gates, actual pause key | Untranslated dependency | Calls `0x19241`, `0x15034`, `0x149fc`; do not invent pause UX |
| Clock units and hardware synchronization | Partially established through shared wall-time helper | >20/>15 comparisons recovered; no emulator timing validation; shared timer worker must supply units/scheduling |
| RNG | Call sites identified only | Seed and stream consumption unknown; no seeded browser approximation presented as recovered |
| Bonus-key assignment/activation | Consumers traced | DS:5014 producer and state1 triggers need shared logic trace |
| BAN/ANI cutscene payloads | Filenames/call sites only | Water `mswm/lswm/pswm`, castle `mcas/lcas/pcas`; no frame decoder or visible story claim |
| Character animation pointers | Resource family paths known, some shared tables unresolved | Castle walking/sand/failure use DS:4f66/4f1e/4e48 and shared loaders |
| Castle background BGS packing and clipping | Calls and screen indices traced | No independent BGS decoder here; decompression call `0xb905` |
| Practice line-wrap and initial expression timestamp | Partial | Initial last-correct timestamp assignment not found in setup; do not silently initialize it to now as recovered behavior |
| Profile/result advancement | Gates/offsets identified | End-mode semantics and full shared results are delegated integration dependencies, not implemented here |
| Collision/health/lives/recovery | No general system proven | Do not invent hitboxes, damage, retries, lives or recovery keys; traced failures exit activity rather than resume it |
| Exhaustiveness | Bounded static pass, not exhaustive decompilation | All major requested topics have evidence or an explicit gap; helpers and transition draw details remain |

## Reproduce and validate

From this worktree root:

```
python3 transpile/tools/worlds/inspect.py
python3 transpile/tools/worlds/tables.py
node --test transpile/tests/worlds/*.test.mjs
```

Inspection requires Python3 and Apple's code16-capable `objdump`; translations/tests need only Node. Scripts read the original ZIP and write only assigned subtrees. No reference-checkout script is run. Tests exercise authored JavaScript, not the original executable, so passing tests establish expected branch/arithmetic behavior but not dynamic equivalence to DOS.
