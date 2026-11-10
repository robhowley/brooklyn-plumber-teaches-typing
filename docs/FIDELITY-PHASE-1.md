# Phase 1: evidence and decisions

**Policy decisions are closed for implementation; historical gates G1–G4 remain open.** Delegated browser fallbacks now satisfy the Phase 1 implementation prerequisite for continuing Phases 2–6. The [decision log](FIDELITY-DECISIONS.md) records choices as delegated, not individually selected policies. Phase 1 exit is limited to decision consistency, asset-checklist completeness, and test-vector completeness; it does not require pretending G1–G4 are historically closed. Only documentation changed. No gameplay, save, corpus or asset integration occurred.

This is a corrected synthesis, not a replacement of the external worker reports. It supplements [Executable research](EXECUTABLE-RESEARCH.md) and the [adoption plan](ORIGINAL-FIDELITY-PLAN.md). Findings below preserve historical evidence and distinguish it from the approved browser choices. The final semantic reviewer returned LGTM and the mechanical verifier returned PASS for the prior documentation snapshot ([review](../../.pi/subagent-runs/20261110T030448Z-5ge9zdjj/01-second-opinion.md), [verifier](../../.pi/subagent-runs/20261110T030448Z-5ge9zdjj/02-verifier.md)); neither is a review of this decision update or a historical gate PASS.

## Gate status

| Gate | Established by static inspection | Still open / disposition |
|---|---|---|
| G1 clock | Integer BIOS-sample accumulation, pause/resume operations, net-error arithmetic and elapsed truncation | Exact sampling, all-mode pause coverage, midnight and setup/effect time remain unproved. D2 approves a cumulative active-clock browser approximation. |
| G2 eligibility/advancement | Direct guards, automatic course mutation before results, Next routing, certificate boundaries | Complete abort/configuration and award lifecycle remain incomplete. D3 approves a conservative 90%/positive-attempt fallback, immutable deferred Next, browser transition awards and a 50-WPM assessment safeguard. |
| G3 text | Prefix/mode selection, random initial selection, readers, outdoor uppercase targets; key mismatches corrected below | Practice wrap/scored separators and complete record compatibility remain unproved. D4–D5 approve full string review, deterministic browser replay, and narrow labeled fallback; historical runtime selection stays disabled. |
| G4 failure | Scoped castle 50/<70 predicate, independently traced water >20-second threshold, reset ordering | Browser chamber mapping, pause/grace/polling and terminal timing remain unresolved. D7 keeps **all early deaths disabled** and does not claim historical reproduction. |

## Provenance and checks

All hex offsets are **file offsets in `MarioTea/MARIO/MARIO.EXE`**, not runtime addresses; `DS:` denotes memory. Resource offsets are decimal, zero-based, half-open. Browser groups are 0–5; original lessons are 1–6.

- Source ZIP SHA-256: `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`; EXE: `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e` (151,024 bytes). See [source identity](EXECUTABLE-RESEARCH.md#source-and-confidence).
- Local evidence: [annotated disassembly](../research/executable-1992/logic/annotated.txt), [corpus spans/hex](../research/executable-1992/text/evidence/generated/lesson-corpus.json), [raw members](../research/executable-1992/text/evidence/raw/), [inventory](../research/executable-1992/INDEX.md). These ignored links require retained research; nothing from them was copied to runtime.
- External source reports: `/Users/roberthowley/.pi/subagent-runs/20261110T024435Z-t9nhg51t/01-worker-hard.md` (G1/G2), `02-worker-hard.md` (G3), `03-worker-hard.md` (G4), `04-worker-normal.md` (policy).
- Independent reviews: `/Users/roberthowley/.pi/subagent-runs/20261110T025428Z-xnns0gn7/01-second-opinion.md` accepted G1/G2/G4 evidence, not gate closure. `02-second-opinion.md` rejected G3 as written for omitted N/S membership mismatches and absent current-case contrast. Both are corrected here; the original report is unchanged and not relabeled PASS.
- Integration rechecked all 15 raw members against ZIP bytes and member hashes, all 136 record spans/hex/text, EXE equality with the ZIP, current `KEY_GROUPS`/comparison, and cited G3 selection/reader instructions. The corpus totals 24,090 bytes (78 LETTERS, 41 WORDS, 17 SENTENC records). **Individual record hashes are not fields in the existing JSON**; generating them remains future import work.
- Integration also recomputed the ZIP hash, matched 937 selected disassembly byte sequences to the inert EXE, and statically checked all six generated non-outdoor passages against their key strings; outdoor generation indexes its selected key string. This supports generated character membership across four modes × six groups, not executed browser coverage. Local link/anchor checks (57 links), allowed-file scope and whitespace checks passed. Worker byte checks (1,273 G1/G2, 544 G3, 1,613 G4 instruction sequences) are reported checks, not this worker's independently rerun counts. Byte equality is not proof of full control flow. No archived code/scripts were executed, emulated, sourced or imported; no audio was played. No application tests/builds ran.

## G1: clock and arithmetic

[Scoring](../research/executable-1992/logic/scoring.asm.txt) and [timer](../research/executable-1992/logic/timer.asm.txt): stats hold baseline `+0x23`, sample `+0x27`, accumulated ticks `+0x2f`, running byte `+0x3d`. Dispatch tables `0x164ac/0x164c4` map start 120→`0x15a58`, refresh 100→`0x15bac`, stop 130→`0x15a8e`, resume 300→`0x15afb`, pause 310→`0x15b20`, clear 320→`0x15b66`. Running updates add differences of integer BIOS samples; pause/stop add the last delta once; resume replaces baseline. No midnight correction appears in these operations.

Outdoor starts at `0x12c88`, refreshes through operation 200 at `0x13a79`, stops at `0x13d42`; modal pause/resume is `0x13bcf/0x13c56`. Escape sets an abort flag (`0x13b7a–0x13b84`), unlike browser Escape pause.

For ordinary nonoverflow inputs, `0x15c8f–0x15d74` gives `floor(max(0, correct-errors)*182/ticks)` (zero for nonpositive ticks), and `floor(100*correct/attempts)` (zero for no attempts). Elapsed is `floor(ticks*10/182)`, capped to duration (`0x15c2f–0x15c8b`); outdoor expiry uses that value (`0x13a8e–0x13aaa`). Six net characters per minute-word is a nominal-rate inference, not an alternative exact formula.

**D2 approved browser approximation:** `ticks=floor(cumulativeActiveSeconds*182/10)`, active-seconds display/expiry, no per-frame rounding, safe JS counts and rejected invalid state. Escape/blur/hidden/pipe pauses freeze all gameplay clocks; resume resets the wall baseline. This is not exact DOS timing. The evidence gate remains open.

## G2: original auto-advance versus browser deferred commit

[Outdoor](../research/executable-1992/logic/outdoor-input-progression.asm.txt) `0x13d61–0x13da3`, [water](../research/executable-1992/logic/water-progression.asm.txt) `0x17e24–0x17e8b`, and [castle](../research/executable-1992/logic/castle-progression.asm.txt) `0xda44–0xdadc` guard advancement with profile flag `DS:50c4`, achieved WPM ≥goal, failure flags where applicable and abort exceptions through `0x15034(10)`. That helper uses `KWD` (`0x15034–0x15094`), not accuracy; full configuration semantics remain unknown. The profile flag is set by load/new-student paths (`0xe2cd`, `0xee2b`), not a demonstrated pass flag. No universal 90% or attempts-positive guard occurs in these advancement blocks.

Original course mutation precedes blackboard results (outdoor results call `0x13e20`, water `0x17ea2`). Next message `0x2713` routes through `0x166a4–0x166bb` to `0x1670f`, setting `DS:4fe2`; `0x11b92–0x11ba3` consumes it to route, bypassing normal menu selection. Next does not commit the already-applied increment.

Below lesson 6, increment lesson only; at lesson 6 assign achieved+2 capped10 outdoors, achieved+5 capped30 in water, achieved+5 uncapped in castle. [Routing](../research/executable-1992/logic/world-routing.asm.txt) `0x10412–0x10457` uses <10/<30/otherwise, exempts practice and resets lesson to1 when entering water/castle.

Certificate flags have important equality differences: outdoor sets `DS:50ce` only for achieved+2 **>10** (`0x13d91–0x13d9e`); water sets `DS:50cf` only for achieved+5 **>30** (`0x17e79–0x17e86`). Castle sets `DS:50d0` at new goal **≥45** (`0xdaad–0xdacb`). [ENDF](../research/executable-1992/logic/endf.asm.txt) argument bit4 invokes certificate-print messages (`0xe072–0xe087`); certificate selection reads these flags (`0xabe2–0xac7b`). This establishes certificate availability, **not terminal graduation at 45**. Additional one-time flag lifecycle (`0x103be–0x103f5`) is incomplete.

**D3 approved browser contract:** timeout, attempts>0, WPM≥goal, accuracy≥90%, no failure; immutable first-success pending snapshot; explicit Next commits once and returns to menu. Retries/reloads/stale or duplicate results cannot replace or double-commit it; custom/practice cannot advance. Certificates on committed world transitions and graduation only on successful guided lesson6/goal50 are browser policies, not the original equality boundaries. Offer goal50 before an ungraduated castle increment overshoots it. G2 remains historically open; see the original auto-advance and certificate differences above.

## G3: selection, bytes and corrected coverage

| Static finding | EXE offsets |
|---|---|
| Lessons1–5 select H/T/B/N/S. Lesson6 chooses one prefix with `1+floor(rand15*5/32768)` at load, not S alone or concatenation. | `0x92af–0x9307`, table `0x9485–0x9491`, random helper `0x3807–0x382c` |
| Modes1/2/3 select LETTERS/WORDS/SENTENC. Practice temporarily selects that category by goal <10/<30/otherwise, then restores mode4. | `0x9307–0x9337`, strings `0x1f504–0x1f518`; `0xb10f–0xb138` |
| Loader prepends tilde, discards CR, stops before EOF `0x1a`, retains LF/spaces/backticks. Base reader skips tilde without adding a separator and wraps. | `0x93f6–0x946d`; `0x9519–0x9560` |
| Initial delimiter traversal count is `floor(rand15*(sourceTildes+1)/32768)` including synthetic tilde; subsequent traversal follows source order. Not proven uniform source-record selection. | `0x964a–0x9692`, `0x95f2–0x9649` |
| Outdoor skips bytes ≤space or ≥DEL, ASCII-uppercases target; input also uppercases. No Unicode folding. | `0x130b6–0x130d2`, `0x13c8c–0x13c96`, helper `0x3a3c`, table `0x22b73` |
| Water maps LF/CR/tab to space and collapses consecutive spaces. Castle maps them to spaces without collapse, then ends sentences at backtick, omitting it. | `0x9561–0x95a0`, consumer `0x174c8–0x174d7`; `0x95a1–0x95ce`, `0xddaf–0xddf1` |
| Practice skips backticks; line builder handles LF, 32-column wrapping/lookahead/rewind and leading-space trimming. Exact scored separators remain unproved. | `0x95cf–0x95f1`, `0xb436–0xb4c7` |

**Current implementation mismatch:** [`src/engine.js`](../src/engine.js) `KEY_GROUPS` lines1–7 and `typeKey` line100 use raw `event.key === target`, including outdoors. Current lowercase target `a` rejects `A`; recovered uppercase target `A` accepts either ASCII input. Historical targets cannot simply be connected to the existing comparison. Outdoor spaces are skipped historically, unlike current generated outdoor spaces. Other modes retain exact case pending their input-handler proof.

The following are **proven source membership**, not new approval questions. They correct the G3 report's incomplete list. Offsets identify first occurrences in the named raw member; punctuation is unchanged by outdoor folding.

| Source / current group | Missing from current key string | Exact resource evidence |
|---|---|---|
| BLETTERS / group2 | `,./` | comma `[175,176)`, period `[94,95)`, slash `[18,19)` |
| NLETTERS / group3 | `,./` | comma `[1179,1180)`, period `[1209,1210)`, slash `[1239,1240)` |
| SLETTERS / group4 | `@#$%^&*+<=>[]_{}` | `@`61, `#`121, `$`181, `%`241, `^`301, `&`361, `*`421, `<`602, `>`612, `[`667, `]`677, `{`687, `}`697, `_`867, `=`877, `+`892 (each one byte) |

HWORDS records1–6 exceed lowercase home-row membership; TWORDS records3–7 exceed home+top (1–2 fit). The loader/water reader does not filter those letters. This is a real **lesson-label/required-key policy conflict**, not uncertainty about H/T filename mapping. D5 prohibits silently filtering text: implement proven LETTERS membership, retain original records where their required keys fit, and use labeled generated fallback only for incompatible required-key records/groups or practice scored-wrap gaps. Phase 2 must list the exact mode/group/record coverage before runtime wiring; do not assume all combinations are generated or all historical records are usable.

**D5 approved deterministic policy:** source-order start and repeat, identical retry sequence; for all keyboard, start at H, consume each prefix's selected file in source order, then T→B→N→S and repeat the five-file cycle; retry restarts at H. This is deterministic browser replay, not original randomness. Specify mode/group/goal/corpus version/content choice, required characters and cursor `{recordIndex,characterIndex}` independent of raw offsets. Only correct acceptance advances. Generated coverage is restricted to incompatible required-key records/groups and practice scored-wrap gaps, with exact coverage listed by Phase 2; it is not historical-corpus completion or proof every key is exercised.

D4 delegates content policy, not string review: before shipping, review every learner string and show a notice naming outdated/inaccurate claims, war, slavery, assassination and disasters, with an obvious generated alternative. Examples: HSENTENC `[1,565)` Washington/war, `[566,1470)` Civil War/slavery, `[1471,1783)` assassination; NSENTENC `[613,1217)` Pluto/nine planets; TSENTENC `[1,275)` earthquake, `[276,1163)` WWII/atomic bombing, `[1164,1770)` presidential history. Preserve raw bytes; do not silently modernize and call it original.

## G4: known thresholds, unresolved terminal behavior

[Castle](../research/executable-1992/logic/castle-failure.asm.txt) `0xbc7e–0xbcd0` checks **only operation2**: attempts≥50 AND integer accuracy<70, or signed idle interval>20. Operation3 bypasses both. Two direct active-section callers (`0xc8d8–0xc8dd`, `0xce25–0xce2a`) do not yet prove mapping to browser thwomps/quicksand. Checks precede current-key reading. Failure latches `DS:46e2`; one section waits for destination before exit (`0xc902–0xc912`), the other dispatches after handler (`0xce50–0xce5b`). Polling waits for a changed BIOS tick through `0xc01c→0x1470c→0x192a2`, not guaranteed fixed latency.

The inactivity helper (`0x333f–0x3364`, `0x39b8–0x3a0c`, `0x7030–0x7159`) uses **whole calendar seconds**, omitting hundredths. Date/time are separate reads; midnight races, clock changes and DST exceptions remain unresolved. Negative differences bypass failure. Castle resets on initialization/section entry (`0xbb57–0xbb62`, `0xc74c–0xc757`, `0xcd5c–0xcd67`), every returned key before filtering (`0xbd28–0xbd33`), and modal return (`0xbe5d–0xbe68`). Wrong and returned non-scoring keys reset time, not the failure latch; modifier-only key returns are unproved.

**Water independently:** [water idle](../research/executable-1992/logic/water-idle.asm.txt) `0x176e6–0x17736` also tests signed difference **>20 seconds**, while `DS:4c23=0`. Initialization follows READY/music (`0x176c7–0x176e1`); resets precede filtering (`0x177d8–0x177e3`) and follow modal return (`0x1786d–0x17878`). Failure sets `4c23` and animation state1, not immediate results. State2 (`0x17184–0x17196`) sets terminal flag at vertical position≥199 (`0x17338–0x1734c`); loop exits at `0x17a09–0x17a29`. No water 50/70 predicate is established. Input can continue after latching; immediate freezing would be a browser adaptation.

Keep all early deaths disabled. Existing chase, 3px/s sinking and 40-key pipe switching are not historical terminal thresholds. **D7 approved browser event order, not a historical fact:** process chronological events, preserve already-buffered contact due at timeout, then close the attempt as timeout and reject new keydown at or after expiry. Early failures remain disabled. If later evidence and a separate decision enable a failure, prioritize an already-due failure before same-instant contact, timeout or new input. Accuracy polling, clock quantization, reset events, playable grace and immediate-versus-delayed termination remain unresolved and cannot be guessed into the browser.

## Literal vectors (NOT EXECUTED)

These are input/expected fixtures for later tests, not results. Historical predicates assume ordinary nonoverflow inputs; browser rows specify delegated policy and are still NOT EXECUTED. `c/e/t` mean correct/errors/ticks; attempts=c+e. Groups use 0–5.

| Kind | Literal input | Expected |
|---|---|---|
| Arithmetic | `c=0,e=0,t=0`; `c=30,e=0,t=1092`; `c=29,e=0,t=1092` | WPM/accuracy `0/0`; `5/100`; `4/100` |
| Arithmetic | `c=90,e=10,t=1092`; `c=89,e=11,t=1092`; `c=2,e=3,t=182` | `13/90`; `13/89`; `0/40` |
| Arithmetic | `c=1,e=0,t=1`; `c=30,e=0,t=0` | `182/100`; `0/100` |
| Accumulator | `start100,pause118,refresh500,resume600,stop618` | 36 ticks, stopped |
| Elapsed | `ticks=18`; `ticks=19` | reported seconds0;1 |
| Browser clock | active deltas `[0.03,0.03]`; active1s + paused100s + active1s | ticks1, not0; ticks36 |
| Loader | source ``"~a\r\nb`\x1a"`` | buffer ``"~~a\nb`"`` |
| Base reader | buffer `"~~a~b"`, start0 | first6 outputs `"ababab"`, no inserted separator |
| Outdoor | source `"~a z; \x1a"`; target `A`, input `a` or `A` | targets repeat `AZ;`; both inputs match historically |
| Water | source `"~a  b\r\nc\x1a"`, previous output non-space | first5 outputs `"a b c"` |
| Castle | source ``"~A.  B.`  C.`\x1a"`` | sentences `"A.  B."`, `"  C."` |
| Practice reader only | source ``"~A.`\r\nB`\x1a"`` | first4 outputs `"A.\nB"`; not a scored-wrap fixture |
| Original course, guards satisfied | outdoor/group5/goal5 achieved8 vs9 | both water/group0/goal10; original certificate0 vs1 |
| Original course, guards satisfied | water/group5/goal25 achieved25 vs26 | both castle/group0/goal30; original certificate0 vs1 |
| Original castle, group5 | goal39 achieved39; goal40 achieved40; goal45 achieved49 | new goals44/45/54; certificate0/1/1, initially unset |
| Browser eligibility | timeout, attempts100, WPM5, goal5, accuracy90, no failure | eligible; accuracy89, WPM4, attempts0, running or failure each blocks |
| Browser pending | outdoor/group5/goal5: pass R1 achieved6; retry R2 achieved9; failed retry; reload; Next twice | course unchanged until Next; retain R1; goal8 once, pending cleared |
| Browser isolation | custom/off-course pass or duplicate/stale result | cannot create/replace pending or advance twice |
| Browser graduation | castle/group5/goal45 achieved49; then eligible goal50 assessment delivered twice | offer goal50, not54; graduate/award once, clear pending |
| Castle predicate | op2: attempts49/accuracy69; 50/68; 50/70 | no failure; latch; no failure |
| Castle scope | op3, attempts100, accuracy0, idle21 | neither failure check runs |
| Historical idle | last100, now120/121/99 | no failure / latch / no failure |
| Historical ordering | last100, now121, queued wrong key | latch before timestamp reset; reset does not revive |
| Pending browser ties | buffered contact at timeout; new keydown at timeout; enabled failure due at same instant | contact counts then timeout; key rejected; proposed failure wins (failure remains disabled) |

## Decision status and Phase 1 exit

D1–D8 in the [running decision log](FIDELITY-DECISIONS.md) close the policy choices through delegated judgment. They authorize Phases 2–6 without another approval round. This is not historical closure of G1–G4: use the specified browser fallbacks and preserve the evidence limits above. Keep all early deaths disabled.

Phase 1 exit may pass only after the decisions are consistent, the asset checklist is complete for its stated review scope, and the test-vector set covers the adopted policies. The vectors above remain specifications, not executed tests. No application tests or build are claimed. Workers should send later decision-log/phase-ledger updates to the integration owner; do not edit that running document concurrently.
