# Startup and explicit Demo profile

**The source displays LOGO, a Mario zoom, and thirteen letter reveals before the menu. Menu inactivity displays a text panel, not an automatic gameplay demo.** Demo is an explicit profile command, followed by a world selection. Guest remains unsaved and is not Demo.

Phase5 integration now connects this component to Session, Renderer and the original menu bridge. The integration record is `reports/PHASE-5.md`; proposals below describe the original worker boundary, not remaining omission claims.

## Run and inspect

From this worktree's repository root:

```sh
python3 -B transpile/tools/control/startup-inspect.py
node --test transpile/tests/control/startup.test.mjs
node --test transpile/tests/{control,runtime,render}/*.test.mjs
```

- Static reader result: 3 indexed scenes, GREET13/GREET2 5 sprites, 17 executable spans.
- `structured_return`, `node-test-text`: startup24 passed; control/runtime/render72 passed.
- These tests run authored JavaScript and read ZIP bytes. They do not execute or emulate original code, compare against DOS execution, exercise browser integration, or establish a native hardware frequency.
- Generated inputs are required. A source-only clone must run the static reader before importing the startup test.
- `assets/startup/` is ignored. It contains original-derived resources, hashes and disassembly, not publishable assets or MIT material.
- The reader imports only the inspected authored `tools/render/decode.py`, reusing its GSO checksum/raster and CRX LZSS decoders. Trusted `objdump` reads temporary inert ELF wrappers; wrappers are deleted and never executed.

## Identity and source coordinates

All executable addresses below are **FILE offsets**, not load addresses. DS data maps to FILE `0x1f270 + DS`. ZIP SHA256: `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`.

Every member below has the prefix `MarioTea/MARIO/`:

| Original member | SHA256 |
|---|---|
| MARIO.EXE | `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e` |
| ENGLISH.MSD | `fd2168878e19b1b85ae0c6ce8e14ad4386a801e7c460ed134bde5f181cb29e15` |
| LOGO.CRX | `505414a551bfeaf27b0d02bbc0c9626ad8b7a7858389ce9c20ea378c519f38b2` |
| GREETBG.CRX | `0092d90b2cf4173dd2224d81e66960512f500cc5d5fd63d1c660b5dee28f944e` |
| GREET.CRX | `aec63e4a09f877e81b9b106ee3f3ce58f1c2b92608d556affc31f1704e265a1c` |
| GREET.GSK | `1eeac5507467bddf1f4ffa3fc362e4629235518b6e9e19aeb95fa935160997ad` |
| GREET.GSO | `457e68b10c33c8ac12f13fce155423610a2d414b3712f087062c22fbed0c5a31` |
| GREET2.GSK | `57aff92c9e1d58b6a626bb68f5dce90df49f84a05aca2fc5ab1e63a54368ebc7` |
| GREET2.GSO | `2cae0e3a843eb1efad570ec51f9e8ce64d5b174b3c9ce2b7f746419df9784e21` |

`assets/startup/manifest.json` records every span's start, exclusive end and SHA256. Tests hash fresh archive members and spans, pin the executable, presentation, idle and fade identities, and verify decoded pixel hashes. Relevant spans:

| Behavior | FILE span, exclusive end |
|---|---|
| Complete presentation | `0xfb90..0x103be` |
| Menu timer, flags, eye animation | `0x10b31..0x10ce3` |
| Menu entry and input flush | `0x10ce3..0x10e31` |
| Explicit Demo command, stays in menu | `0x11419..0x11434` |
| Demo student operation0xaf6 | `0xe3bc..0xe3ed` |
| Outside input/demo precedence | `0x13aaf..0x13ba1` |
| Water input/demo precedence | `0x17736..0x177ff` |
| Castle input/demo precedence and option10 guard | `0xbcd0..0xbd8e` |
| Practice callback and dispatch | `0xb59a..0xb5f1`, `0xb6af..0xb73d` |
| Palette interpolation and writes | `0x14bb4..0x14d8b` |
| Wait count, BIOS polling and tick sample | `0x1927f..0x1935b` |

Countdown30 initializers: Outside `0x12755`, Water `0x16815`, Castle `0xd558`, Practice `0xb0c8`. Generated evidence includes their enclosing spans. Initialized DS:4833/4837 (menu delay/last sample), DS:4e2c (wait service's prior low word) and DS:41ac (Practice prior low word) are all zero, verified from archive bytes.

## Recovered presentation ordering

`createStartup({rng,input,option10})` returns `{state,start,step}`. Call `start()` once. It and `step({completedWaits})` return ordered events, stopping at each blocking source wait. `state.phase` is `logo`, `zoom`, `letters`, `hold`, then `complete`; `state.done` marks return. Option10 bypasses the entire routine (`0xfbb6`). The shared RNG is never reseeded here.

| Order | Recovered behavior |
|---|---|
| Logo | Clear hardware palette; copy LOGO; fade black to LOGO over12 arithmetic steps (`0xfbe7..0xfc34`). |
| Logo hold | Up to57 calls of `0x1470c`, each one BIOS-change wait; check pending input AFTER each call (`0xfc3b..0xfc4f`). Consume one pending key after leaving the loop. |
| Background | Fade LOGO to uniform RGB6 `(29,0,45)`; explicitly set that palette; copy GREETBG; fade purple to GREETBG (`0xfc80..0xfd61`). |
| Mario zoom in | Build20 rasters, original small Mario then19 repeated7/8 reductions; draw indices19 down to0, centered at160,100. Check/consume input AFTER each compositor call and BEFORE its wait (`0x10193..0x10251`). Any key skips the rest of this subroutine, not all subsequent presentation. |
| Fixed hold | On unskipped zoom-in only, call wait-count19 (`0x10258`). Input does not interrupt this call. |
| Mario zoom out | Draw reduced indices1..5 at centers `(160-14*i,100-11*i)`; iteration6 draws large Mario at7,2. Each draw checks input then waits once. Final reduced index7 draws at7,3 without waiting (`0x10264..0x1038d`). |
| Title | Copy GREET and set its palette directly. Draw13 letters at y7, then release the13 loaded letter rasters (`0xfef8..0xff91`). |
| Letter delay | After EACH draw, check pending. If none: request sound1, consume one RNG draw for4..7 waits, then index6 adds12 fixed waits. Pending skips delay and RNG but DOES NOT skip remaining letter draws. After all13, consume at most one pending key (`0xff2a..0xffbe`). |
| Greeting hold | Up to114 waits. Check input BEFORE each wait. Ordinary key consumes and exits; Alt-X checks option10 and otherwise continues (`0xfdeb..0xfe26`). |
| Return | Fade GREET to black, release image (`0xfe28..0xfe6a`). No lesson timer is started by this routine. |

### Draw and random counts

| Path | Mario compositor calls | Letters | RNG draws | Source wait completions |
|---|---:|---:|---:|---|
| Natural, no pending input | 27 | 13 | 13 | `228 + sum(13 delays in4..7)`, range280..319 |
| Key already pending at first logo check | unchanged27 | 13 | unchanged13 | Logo1 instead of57, if no additional pending keys |
| Key pending at first zoom draw | 1 | 13 | unchanged13 | No zoom waits, no fixed19, no zoom-out waits |
| Key supplied during first zoom wait | 2 | 13 | unchanged13 | One zoom wait, then draw/check consumes it |
| Key supplied during fixed19 | 21 | 13 | unchanged13 | Complete19 waits, draw outgoing frame1, consume key, no outgoing waits |
| Key pending before first letter | unchanged | 13 | 0 | No random delays or fixed12; hold still runs if no second key |
| Key during first letter delay | unchanged | 13 | 1 | Current delay completes, remaining12 draws have no delays |
| Key during first hold wait | unchanged | 13 | unchanged | One hold wait instead of114 |
| Option10 at entry | 0 | 0 | 0 | 0 |

- Counts cover presentation-owned waits, excluding audio/resource-driver internals. Full path emits212 wait requests. Their `count` fields represent291 individual BIOS-change completions for seed1, not291 browser frames. Seed1 delays are `[4,4,5,4,5,4,6,4,6,7,5,5,4]`, ending seed234047114.
- There are4 fades. Each writes source once, interpolation j0..11 (including another source write), then exact target:14 writes each. Including initial black, explicit purple and direct GREET, full startup makes59 palette writes. Startup passes fade mode0, so **there are no explicit wait calls inside these fades** (`0x14ce1..0x14cf1`). Do not insert twelve guessed animation frames.
- Mario miniature19 has height0. Its compositor call draws nothing, so natural startup has27 Mario calls but26 nonempty rasters. Do not clamp it to a one-pixel sprite.
- The shrink loop skips a source column/row AFTER output index0,7,14,..., not conventional nearest-neighbor resizing (`0x10118..0x10165`).
- Iteration6 draws `lmario_1`, but records reduced frame6 and computed coordinates50,24 as its previous image (`0x10303..0x10320`). The final frame7 restores that rectangle, not the actual large image rectangle. The renderer and pixel regression preserve this oddity.

### Resources and rendering API

- GREET index0=`smario_1` (119x48); index1=`lmario_1` (308x120).
- GREET indices2..12 are `greettxt_T,E,A,C,H,S,Y,P,I,N,G`. Repeated letters reuse their original entries. The string `TEACHESTYPING` is reached through DS:2442's far pointer, not guessed from resource names.
- Letter X positions from FILE `0x21698`:124,138,152,169,183,198,213,233,247,262,276,282,298.
- GREET2 indices0..4 are bubble, preferences box, open eyes, closed eyes, halfway eyes. The preferences box belongs to Phase4, not startup.
- `startupZoomFrames(small)` produces the20 source rasters. `startupFade(from,to,steps=12)` returns exact ordered RGB6 writes, truncating signed interpolation toward zero.
- `createStartupRenderer({front,background,scenes,sprites,letters,letterX})` returns `apply(event)`. Hydrate scenes as `{pixels,palette}` and sprites as `{sprite,pixels}`, keyed by original family/name. It reuses the indexed `updateSprite` compositor.
- `apply` handles only `scene`, `sprite`, `letter`, `palette`, `fade`. It returns palette writes, mutates supplied rasters and throws for missing resources or non-render events. It neither silently ignores audio/waits nor invokes Session/DOM.

## Waits and source callbacks

- `0x1470c` calls `0x192a2` once. `0x1927f(n)` calls it n times.
- `0x192a2` repeatedly queries BIOS INT1A/AH0 until DX differs from persistent DS:4e2c, then stores DX. A late observation is ONE completion, not credit for every missed tick. No keyboard check is inside this wait.
- `createSourceWaitClock(lastLowTick=0)` supplies `sample(controller,lowTick,context={})` and `reset(lowTick)`. Each different observed low word completes at most one blocked wait. Equal samples do nothing. Wrap65535 to0 is one change. Reset is an explicit host-clock replacement, not gameplay elapsed time.
- Keep this adapter across startup and menu reentry. For menu waits, pass `{nowTicks}` in `context` as the independent full32-bit sample. The component does not choose a native tick frequency or convert RAF/milliseconds to BIOS ticks. Source wait acknowledgements are independent of wall seconds and lesson statistics.
- Menu uses `0x148aa`, whose indirect callback at `0x1497f` is `0x10b31`. That callback can run repeatedly while cursor position/buttons/keyboard remain unchanged. Call `menuIdle.step` for an explicitly sampled callback, not implicitly once per browser frame.
- Source menu pump resets its90-tick idle stopwatch at `0x10ddd` after processed keyboard/pointer events and presentations. Integration calls `restartPump(nowTicks)` after Phase4 handles such input. Completed blink and bubble returns reset it in this component.
- `createPendingInput()` is the existing authored FIFO adaptation. Source pending/read/flush remain separate. FIFO capacity, DOM key delivery, typematic and host loading duration are not recovered DOS hardware behavior.

## Menu idle and shared RNG

`createMenuIdleState()` returns persistent `{lastTicks:0,delayTicks:0}`. Keep it across worlds/menu entries. `createMenuIdle({rng,input,timer,nowTicks})` returns `{state,step,restartPump,rebaseClock}` and flushes pending raw keys as the original menu entry does at `0x10dd8`.

Callback ordering (`0x10b31..0x10c26`):

1. Compare signed32 `(nowTicks-lastTicks)>delayTicks`. On trigger, set blink flag, save now, then consume exactly one shared RNG draw for `19*(5+scaled(5))`, range95..171. Equality/negative difference consumes none.
2. Independently set bubble flag when idle difference is strictly>90, or Demo became active since the prior callback.
3. The outer loop services bubble BEFORE blink, and blink BEFORE keyboard (`0x10dfd..0x10e2c`). A simultaneous bubble leaves blink pending. `step` preserves that priority.
4. Blink waits1, draws halfway; waits1, draws closed; waits2, draws open, all at50,47 (`0x10c50..0x10cd9`). File menu dropdown open suppresses these3 draws and4 waits but does NOT refund the earlier RNG draw. Do not suppress for unrelated dropdown columns.

`menu-bubble-request` explicitly hands the recovered panel operation `0x1072f` to Phase4's menu/text renderer. That operation draws its border at6,142 with width180/height52, then chooses messages1200..1203 for Demo,1210..1213 for a saved profile, or1220..1223 for Guest (`0x108a9..0x108ed`). This startup renderer does not fake those text/widget services. No event here launches gameplay on a timeout.

`rebaseClock(oldTicks,newTicks)` shifts the persistent random timer and current idle timestamp equally. It preserves elapsed comparisons across an explicit host clock reset; it is a browser adaptation, not a DOS reset operation.

## Demo input, abort and return

`demoStudent(bytes)` translates operation0xaf6 after existing normalization: copy English message2000 `Demo` (ENGLISH.MSD member offset `0x576`, archive-verified) into the name; set demo=1/profilePresent=0; preserve mode/group/goal/durations and other bytes (`0xe3bc..0xe3ea`). It does not create `newStudent('Demo')` defaults. Saving remains denied. Source D selects this profile and returns to the menu loop; it does not start a fixed four-world tour. Next is disabled while Demo (`0x11502`).

`createDemo({student,rng,input,mode,lowTick=0,option10=false})` requires that explicit profile and a selected original mode1..4. For Practice, `lowTick` is the prior stored DS:41ac sample, initially0, carried across Practice entries through `state.lastLowTick`; it is not reset to the current tick. It returns `{state,poll,finish}`. `poll` is called at the selected world's original input-dispatch point, with its actual target and current low tick. Practice must also call it for each waiting-callback observation when no keyboard key is pending, because that callback owns the countdown. Other worlds call it once per source input dispatch. Missing target data throws before consuming input or RNG. This is synthetic target-key production, not a replacement game controller or AI.

| World | Countdown update | Synthetic key / new countdown | Physical-key order |
|---|---|---|---|
| Outside1 | Start30; decrement each dispatch when nonzero | When0 and actual active target exists, use obstacle's target; one draw for10..19 | Read first, then possibly overwrite with target (`0x13ae9..0x13b51`) |
| Water2 | Start30; decrement each dispatch when nonzero | When0, current target; one draw for1..5 | Synthesize first; only read pending if resulting key0 (`0x1774c..0x177d8`) |
| Castle3 | Start30; decrement each dispatch when nonzero | When0, caller's current target; one draw for1..3 | Synthesize first; only read pending if key0 (`0xbcd2..0xbd28`) |
| Practice4 | Start30; decrement ONCE when callback sees changed BIOS low word, not per sample or tick difference | At0, current target, NUL becomes CR; one draw for1..3 | Synthesize first; only read pending if key0 (`0xb59a..0xb5bd`, `0xb6af..0xb712`) |

- `poll` returns `{key,synthetic,physicalKeyRead,resetInactivity,abort,quitRequest}`. It consumes the shared RNG exactly at these source sites. Outside synthetic input alone does not refresh inactivity; physical reads do. Water/Castle processed synthetic or physical keys refresh it. Practice retains the existing correct-key clock service.
- Escape exits all four. F10 additionally exits Outside/Water; do not invent that branch for Castle/Practice. Alt-X is a conditional option10 quit request, not an unconditional abort.
- **Any key does not necessarily abort Demo.** Outside can overwrite an Escape at countdown0; Water/Castle/Practice can leave it queued behind a synthetic key. The tests prove these source-specific cases. No browser any-key abort override is enabled here.
- `finish()` must follow the world's actual terminal path. It emits `menu-return`, suppresses results (source `0x16507`), sets the selected mode in returned student bytes, clears demo as next menu entry does, and flushes queued input. It does not restore a fictional prior saved profile or choose another world.
- `resetHostClock:true` is an explicit browser handoff request: discard pending host frame accumulation on return. It does not alter source statistics clocks, synthesize a pause interval or grant lesson time. The source menu remains untimed by the lesson clock.

## Integration after Phase4

Minimal proposed integration, not implemented in shared files:

1. Add generated startup data to `tools/build-app-data.py` in the integration worker only:3 scene records, GREET/GREET2 records,13 letter bindings/X values and member identities. Do not ship binary resources in git. Hydrate them for `createStartupRenderer`.
2. Before the first menu, run `createStartup` with Session's existing shared RNG and raw FIFO. Drain ordered rendering/audio/resource events until a wait; acknowledge waits only through an explicit host tick adapter. Route `sound-request` to Phase6 or an explicit muted/unsupported handler. Do not hide unknown event types.
3. After startup done, enter Phase4's menu normally. Its FIFO flush prevents residual presentation keys entering a menu command or lesson. Retain the menu random timer and shared wait-clock state across activities. Menu idle callback must run BEFORE Phase4 consumes a pending menu key; return actions reset the pump stopwatch.
4. Route `menu-bubble-request` to Phase4's recovered widget/text operation. Wire `fileDropdownOpen` as the File-dropdown-open predicate only. Use `restartPump` after key/pointer handling and `rebaseClock` only when changing the host clock origin.
5. Preserve Guest bytes. Only the original Demo command invokes `demoStudent`, and only an explicit world choice creates `createDemo`. Never set `demo = !profilePresent`.
6. Add a narrow input-service hook to each translated world's ORIGINAL dispatch site, not a second host key queue or automatic typing loop. Supply its actual target, target-presence predicate, and Practice low-tick sample. Preserve Practice's previous `state.lastLowTick` across entries (separate from the wait service's low word). Do not call `poll` both before and after the same source dispatch. Continue using existing world/corpus/bonus RNG and timers; do not reserve all demo draws up front.
7. On source world exit call `finish` once, bypass results as requested, acknowledge host clock reset, then enter the ordinary menu. Existing progression already rejects profilePresent=false; no invented Demo progression or save path is needed.

These hooks and browser tests are now integrated. The reviewed Alt-X defect is fixed: FILE `0xbd71..0xbd8b` compares Alt-X, calls option service10, and branches around quit when false, matching Outside `0x13b64..0x13b77`. Regression tests pin those archive bytes and both option states for all4 modes. Required integration checks: full versus each skip through real events, simultaneous menu key/timer flag, repeated menu entry, all4 world input hooks, delayed Escape, return FIFO flush, and no stale host tick on lesson reentry.

## Limits and unresolved hardware behavior

- Recovered: executable branching, source loop/draw/wait counts, palette arithmetic, input precedence, exact sprite indices, shared RNG calls, Demo profile mutation and absence of automatic idle gameplay launch in this traced menu.
- Browser adaptations: raw FIFO transport, explicit tick observation/reset, resource lookup/hydration, visible exceptions for missing resources, clock-reset handoff. Fades preserve writes without claiming a native elapsed duration.
- Not implemented here: Phase4 menu bubble font/widget drawing, sound playback, DOS resource-allocation/file-error dialogs, mouse driver callbacks, printer/host quit behavior. Each has an explicit event or visible failure; none is represented by guessed art, silence disguised as playback, or an invented delay.
- Unknown: native CPU/DAC write and loader cadence, host scheduling/input delivery, hardware audio timing. BIOS wait observations are explicit; no millisecond or RAF-to-DOS conversion is claimed.
