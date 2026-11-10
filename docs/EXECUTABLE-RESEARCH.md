# What the 1992 executable establishes

Static inspection of this DOS package confirms rules that differ materially from the browser recreation.
No original program was run, emulated, imported, or loaded as code. This report changes no gameplay rules.

- Scoring subtracts errors from correct characters before calculating WPM; its multiplier is **182**.
- At the nominal BIOS timer rate, that implies **six net characters per word**, not five correct characters.
- Outdoor input is uppercased before comparison. This is not evidence that every mode ignores case.
- After keyboard lesson 6, eligible progression uses **achieved WPM +2 outdoors**, **+5 underwater/castle**.
- Entering water or castle from another routed mode resets the keyboard lesson to 1.
- Castle has a conditional **50-attempt / below-70%-accuracy** failure path, plus an inactivity path.
- Default durations are **120 / 300 / 300 / 600 seconds**. `LOAD.CRX` is a **Load a Student** dialog.

The manual's 50-WPM graduation milestone remains unresolved against a special executable branch at 45.
Neither that branch nor the castle failure threshold establishes a universal graduation or passing rule.

## Source and confidence

The source is the local `~/Downloads/Mario_Teaches_Typing_1992.zip`.
Its SHA-256 is `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`.
The archive contains a `Mario Teaches Typing, V1.1` string in `MarioTea/MARIO/MARIO.EXE` at decimal offset 142140.
That executable is 151,024 bytes; its SHA-256 is `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e`.
Its MZ header is 11,776 bytes, with entry at file offset `0x2e00` and no appended overlay bytes.

**Confirmed static facts** below mean bytes, decoded artwork, or inspected instructions support the statement.
**Inferred meaning** identifies a runtime interpretation of those facts, not an observed play session.
**Unknown** means the bounded inspection did not establish the behavior.
All executable offsets are hexadecimal file offsets in `MarioTea/MARIO/MARIO.EXE`, not runtime addresses.
Other resource offsets are decimal, zero-based, half-open spans unless stated otherwise.

Evidence lives in the ignored, local-only [artifact directory](../research/executable-1992/INDEX.md).
Links to those artifacts work only in a checkout retaining that directory; the copyrighted material is not shipped.

## Recovered screens, not runtime screenshots

These PNGs decode original background artwork. They do **not** capture text overlays, animated sprites,
transitions, or a running game. Their 320×200 pixels are shown without original display aspect correction.

| Menu and student loading | Results and congratulations |
|---|---|
| ![Decoded main-menu background](../research/executable-1992/screens/decoded/MAINMENU.png) | ![Decoded blackboard background](../research/executable-1992/screens/decoded/BLACKBRD.png) |
| ![Decoded Load a Student dialog](../research/executable-1992/screens/decoded/LOAD.png) | ![Decoded congratulations banner](../research/executable-1992/screens/decoded/ENDF.png) |

The [20-screen contact sheet](../research/executable-1992/screens/decoded/screens-contact.png) also includes
Interplay's logo, greeting art, keyboard/hands, lesson times, student information, report card and practice.
`BLACKBRD.CRX` contains NEXT/MENU and graduation-costume Mario, but no statistics or pass/fail wording.
`CERTIF.CRX` says “CERTIFICATE PRINTING”; it is a selection panel, not a populated certificate.
`LESSTIME.CRX` contains no numeric durations. Those come from code, not the image.

For each `MarioTea/MARIO/*.CRX`, palette bytes occupy `[0,768)` and compressed pixels follow.
Examples: `LOAD.CRX` payload `[768,9713)`, `MAINMENU.CRX` `[768,19096)`,
`BLACKBRD.CRX` `[768,14480)`, and `ENDF.CRX` `[768,12400)`.
Full ranges, image hashes and compressed-token provenance are in [screen evidence](../research/executable-1992/screens/evidence.json).

## Menu, start, gameplay and results flow

The inventory worker timed out, but its saved resource extraction is usable and was checked against ZIP bytes.
`MarioTea/MARIO/MARIO1.HLP` `[25,899)` describes four activities, Report Card, Next and goal-based access.
Its `[1271,1369)` describes Student > New, Load and Edit. Load explicitly means loading a student from disk.
`ENGLISH.MSD` `[1855,1920)` adds New, Load, Edit, Lesson Times and Certificates menu labels.
These are interface resources, not proof that every menu command was traced.

The supported flow is:

1. **Menu setup:** create/load a student, edit the goal, select a keyboard lesson or choose Next.
2. **Activity access:** help specifies no minimum for Outside/Practice, 10 WPM for Water, 30 for Underground.
3. **Outdoor start:** orchestration calls initialization, drawing, READY, a music helper, then the gameplay loop.
4. **Outdoor typing:** an active target receives input; correct keys change its action and clear its character.
5. **Completion:** cleanup precedes the results routine, which requests the blackboard and updates statistics.
6. **Results navigation:** `MARIO2.HLP` `[29,203)` describes reviewing the last lesson, Next, and Menu.

Step 3 is visible at `0x13dc3–0x13e25`: init `0x1272e`, READY wrapper `0x14f58`,
gameplay `0x1397c`, cleanup `0x12cc3`, then results `0x164dc`.
Results reference `blackbrd` at `0x16536–0x16545` and update statistics at `0x16598–0x165a6`.
Under additional profile/mode gates, `0x165ec–0x16608` compares result WPM with the previous goal
and calls CONGRATS or TOOBAD wrappers. This does not prove a separate victory image precedes the blackboard.

READY/TOOBAD/CONGRATS wrappers at `0x14f58–0x14fab` pass resource names to a common helper.
The corresponding VOC containers have valid headers and approximately 2.246/2.602/1.904 seconds of samples.
No audio was played; spoken content and whether a call waits for playback remain unknown.

**Loading is not Load Student.** The decoded `LOAD.CRX` visibly says “LOAD A STUDENT”, with CANCEL/DONE.
Logo/greeting assets and executable resource names exist, but exact startup order, loading-progress presentation,
and transition duration were not established. Do not turn a resource filename into a startup-screen claim.
See [inventory text runs](../research/executable-1992/inventory/artifacts/ui-flow/text-member-runs.tsv).

## Scoring and input

The inspected statistics structure has attempts at `+0x05`, errors at `+0x07`, correct at `+0x09`,
accumulated timer ticks at `+0x2f`, WPM at `+0x37`, and accuracy at `+0x39`.
Outdoor increments at `0x13c73`, `0x13c9b`, and `0x13cfe` establish the counter meanings.

| Static calculation | Evidence |
|---|---|
| Accuracy starts at zero; for positive attempts, integer `100 × correct / attempts` | `0x15c8f–0x15cda` |
| Nonpositive accumulated ticks produce zero WPM | `0x15cda–0x15cf6` |
| Subtract errors from correct; clamp negative net count to zero | `0x15cf8–0x15d2e` |
| Multiply net count by `0xb6` (182), divide by accumulated ticks, store WPM | `0x15d2e–0x15d74` |
| Convert ticks to elapsed seconds using `ticks × 10 / 182` | `0x15c2f–0x15c59` |

The multiply/divide helpers are at `0x330c` and `0x339f`; the timer reader at `0x19317–0x1935a`
requests BIOS interrupt `0x1a`, function zero. At approximately 18.2 ticks/second,
`182 / (18.2 × 60) = 1/6`, giving net characters divided by six per active minute.
The six-character interpretation is inferred from the arithmetic and timer source, not a recovered design comment.
Integer truncation and finite-width counters mean this is not an unlimited-precision formula.

At `0x13c8c–0x13c96`, outdoor input calls `0x3a3c` before comparing the stored target.
That helper tests classification bit 8 and subtracts 32; its table at file `0x22b73`
marks ASCII `a–z` for conversion. Thus lowercase and uppercase input converge for uppercase ASCII targets.
A mismatch increments errors without clearing the target; a match increments correct, sets object action 6,
and clears the target character (`0x13c98–0x13d1a`). Contact timing and buffering were not recovered.
See [scoring](../research/executable-1992/logic/scoring.asm.txt) and [input](../research/executable-1992/logic/outdoor-input-progression.asm.txt).

## Progression, limits and failure conditions

The global statistics base is `DS:0x51b7` (for example `0x164f2`), so `DS:0x51ee` is its WPM field.
This supports **achieved WPM**, rather than old goal WPM, as the input to the increments below.
Eligibility flags and result-versus-goal comparisons precede advancement; these are not unconditional updates.

| Branch | Confirmed assignments and comparisons |
|---|---|
| Outdoor `0x13d61–0x13da3` | If lesson <6, increment lesson; otherwise set goal to achieved WPM +2, capped at 10 |
| Water `0x17e24–0x17e8b` | If lesson <6, increment lesson; otherwise achieved WPM +5, capped at 30 |
| Castle `0xda44–0xdadc` | Failure flag blocks advancement; lesson increments below 6, otherwise achieved WPM +5 |
| Routing `0x10412–0x10457` | Outside below 10, Water below 30, otherwise Castle; mode 4 is exempt |
| Routing `0x10436`, `0x1044b` | Set lesson to 1 when changing into Water or Castle |

Castle compares the **new goal** against 45 (`0xdaad`), with a one-time flag and different calls to `0xdf46`.
That routine references `endf` and `endf.ban`; it is also called on earlier castle advancement.
Calling this “graduation at 45 achieved WPM” would be wrong: the comparison follows the +5 assignment,
and the final-graduation meaning remains unproven. The manual's **finish castle at 50 WPM** statement stands
as a separate source claim, not overturned by this branch. Certificate eligibility was not fully traced.

Default seconds are assigned at `0x12cb6` (120), `0x16d34` (300), `0xd96f` (300), and `0xb20c` (600).
Nearby branches multiply nonzero configured lesson times by 60 instead. Resource text also labels minutes.

Castle handler operation 2 checks attempts ≥50 and accuracy <70 at `0xbc7e–0xbca6`.
It sets `DS:0x46e2`; independently, a last-input interval **greater than 20** sets the same flag at `0xbca6–0xbcd0`.
The flag dispatches to scene-exit routines (`0xc902–0xc912`, `0xce50–0xce5b`) and blocks advancement (`0xda4e–0xda57`).
These are **failure conditions in a particular handler**, not a universal “70% passes” rule.
Water has a similar inactivity/state-change path at `0x176e6–0x17736`, with advancement blocked at `0x17e2b`.
The time helper calls DOS date/time routines (`0x39b8–0x3a0d`); seconds are plausible, but the conversion's
full behavior, handler cadence, visible death timing, key exemptions and restart/lives rules remain unverified.

## Recovered lesson corpus

All 15 `MarioTea/MARIO/*.LEE` members total **24,090 bytes and 136 tilde-delimited records**:
78 LETTERS, 41 WORDS and 17 SENTENC records. Each ends in DOS EOF byte `0x1a`.
The extraction preserves case, spaces, punctuation, CRLF and backticks without normalization.
Worker token counts are 1,653 WORDS tokens (574 case-folded forms), and 1,568 SENTENC tokens (664 forms),
using `[A-Za-z0-9]+(?:'[A-Za-z0-9]+)*`; these are corpus counts, not evidence of runtime selection frequency.

| Exact short excerpt | Member and containing record span |
|---|---|
| `fad fad fad sad sad sad dad dad dad` | `HWORDS.LEE` `[1,301)` |
| `Stop! Stop! Wait! Wait! !@#% !@#%` | `SWORDS.LEE` `[122,299)` |
| `320 33 340` and `460 470 44 480` | `NWORDS.LEE` `[1,335)` |

Read the [full corpus](../research/executable-1992/text/evidence/generated/lesson-corpus.txt),
[exact spans/hex/hashes](../research/executable-1992/text/evidence/generated/lesson-corpus.json),
and [statistics](../research/executable-1992/text/evidence/generated/corpus-statistics.json).
`ENGLISH.MSD` contains 177 indexed strings; its table is `[4,712)` and payload is 2,724 bytes.
Keyboard labels at `[1920,2010)` identify six selections, Home Row Only through All Keyboard.
H/T/B/N/S filename-to-key-group mapping is inferred, not an explicit resource keymap.
All HWORDS records contain letters outside the inferred home row; five of seven TWORDS records exceed Home+Top.
That does not prove the game presents those whole records unchanged in those lessons.
Sentence text includes dated claims about Washington's teeth and Pluto, plus war-related passages.
Tilde/backtick learner-input roles, runtime ordering and transformations remain unknown.

## What remains deliberately different in the recreation

The [implementation brief](../references/IMPLEMENTATION.md) still governs the browser game.
This report neither requests nor implements a historical-rules migration.

| Browser recreation choice | Static evidence or unresolved original behavior |
|---|---|
| Correct characters /5 per minute; exact case | Net-error arithmetic and outdoor uppercasing differ |
| Uniform +5 after all keyboard, retain keys across worlds | +2/+5 from achieved WPM and world-entry lesson resets differ |
| Timeout-only pass, attempts >0, goal met, accuracy ≥90% | Conditional castle/inactivity failure exists; universal pass rule not recovered |
| No early death; explicit Escape/blur/pipe pause | Original full pause, lives and hazard timing not established |
| Generated selected-key text | Original corpus has out-of-group characters under inferred filename mapping |
| Castle all-keyboard 50-WPM graduation | Manual supports 50; executable's special new-goal ≥45 branch remains unresolved |

## Validation and reproduction bounds

The verifier read all nine retained inspection scripts before running any of them.
They read bytes, parse data, write evidence, or invoke trusted `unzip`, hashing tools and static `objdump`.
None executes archive code. No emulator, installer, unpacking stub, network, package install or upload was used.
The ELF wrapper is an inert disassembly input, not a program that was loaded for execution.

Independent checks recomputed the archive hash, checked all manifest member hashes, matched the extracted EXE,
and compared **2,839 focused disassembly instruction byte sequences** with ZIP source bytes.
Selected arithmetic, input, routing, progression, duration and failure branches were read manually;
byte equality alone is not a proof of all control-flow interpretations.
The verifier also checked every corpus record span/hash, the ASCII lowercase table, and all **567 sprite checksums/boundaries**.
The reviewed CRX decoder was rerun: all **20** backgrounds produce **64,000 pixels**, consume the payload,
and never reference undefined initial dictionary data. Palette channels are six-bit; sprite palette binding remains inferred.
The contact sheet was visually inspected; sprite behavior and practice-expression thresholds were not inferred from pictures.

Reproduction commands, original absolute paths, old-to-new artifact mapping and script limitations are in
[INDEX.md](../research/executable-1992/INDEX.md); machine-readable independent results are in
[verification.json](../research/executable-1992/verification.json). No application tests or playtests were run for this documentation-only work.
