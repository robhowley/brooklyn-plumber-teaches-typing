# Water indexed presentation

Water now has controller-independent indexed drawing helpers and pixel tests, integrated by Phase2. **The core palette export is corrected: BITER.GPO replaces slots48..63 after the character splice.** The prompt uses FONT9H, not FONT5H or FONT7H. Bonus punctuation uses FONT7H.

## Integration contract

Owned code: `app/water-render.mjs`. It imports only `recovered/render/render.mjs`, owns no timers, scoring, input, DOM or Session, and never imports the parallel controller.

Run from checkout root:

```sh
python3 -B transpile/tools/render/water-bindings.py
node --test transpile/tests/worlds/water-render.test.mjs
```

The supplemental builder reads the original ZIP and the existing render manifests. It writes only ignored `assets/render/water/bindings.json`, leaving the core decoder and shared app builder unchanged. Existing decoder functions were inspected before reuse; no original code is executed.

### Required data-builder mappings

| Consumer | Supply |
|---|---|
| `resources.water[0..36]` | Render manifest `sprites`, family WATER, indexed by original `index`; each `{sprite: record, pixels: Uint8Array}` |
| `resources.bubbles[0..1]` | Same, family WATER_INLINE |
| `resources.bonus` | `waterBonusSprite(resources.water[33], font7[bonusCode-32])`; make once per assigned punctuation code, not per animation tick |
| `font9[0..95]` | Original manifest FONT9H records, code32..127, decoded pixels; add this family to the shared builder |
| `font7[0..95]` | Existing original manifest FONT7H records, code32..127 |
| Scene | Render manifest `worlds.water.background.indicesPath`, 64,000 bytes; retain untouched scene pixels separately from the movie's writable background |
| Final palette | Supplemental `palettes.m/l/p.rgb8`, flatten to768 components; or `waterPalette(baseRGB6, characterGPO, biterGPO)` then host RGB8 expansion |
| Movie | Supplemental `animations.m/l/p.frames[i]`: `writes[]` has `{offset,pixels}` with base64 pixels; decode each to Uint8Array. `ani` has signed x/y and raster metadata/path from existing ANI table |
| ANI frame | `{x: ani.x, y: ani.y, sprite: ani, pixels: decodedRaster}`; raster paths resolve against `assets/render/`, not the supplement's directory |
| Scheduling | Supplemental `playback.tickWaitsPerPacket=2` and `sound7OneBasedFrames`; controller owns packet index and waiting |

Do not derive BAN writes by comparing successive background images. A literal write equal to the old background still overwrites a visible ANI pixel; repeated-zero commands do not write. The supplement preserves actual command writes by passing a write collector to the existing `decode_ban`, not by creating a second decoder.

### APIs and source-semantic state

- `waterActorOperations(resources, after, before)` returns ordered `{actor,current,previous}` records for `drawWaterOperations(front,background,operations,clip?)`.
- Snapshots contain `character` (1/2/3), `swimmer:{x,y,frame,failed,failurePhase}`, `pursuer:{resourceIndex,drawnX,y}`, `bubbles[10]:{active,x,y,large}`, and `bonus:{mode,x,y}`. Missing actors are null.
- These are **draw-time snapshots**, not arbitrary end-of-loop controller objects. Capture swimmer phase when its call executes, before the pursuer can change phase1 to2. Preserve the previous swimmer's actual drawn phase/frame and the pursuer's selected resource index. Recomputing previous art from the latest failure flag or mode would erase the wrong rectangle.
- The pursuer numeric helper already exposes `resourceIndex` and `drawnX`; use those, not its post-toggle `mode` or unadjusted `x`.
- Pass bonus mode3 at its erase call, before the controller resets it to0. A post-routine mode0 at the old visible y does not describe the erase operation.
- Capture `before.bubbles` after source allocations and before pool movement. A newly allocated bubble's first call uses its initial small raster as previous even though it was not visibly drawn yet. Only slots active before movement invoke the compositor; newly inactive slots erase their old image.
- Do not call actor drawing for a pending-input iteration that skips source updates. Text redraw remains a separate controller event, including forced sixth deferred redraw.
- `drawWaterText(front,background,font9,window,targetIndex)` accepts only source windows20/target5 or40/target10. It does not alter corpus bytes or advance the cursor.
- `drawWaterBonusPacket(front,movieBackground,writes,current,previous,clip?)` applies writes to both buffers, then dirty-composites ANI. Return value is the current ANI record to retain for the next packet. Start previous=null, begin both buffers with the Water background, and present without inventing an Outside callback interval.
- `restoreWaterScene(front,scene,font9,window,targetIndex)` copies the scene and redraws the prompt. Restore final Water palette externally. Retain prior ordinary actor draw snapshots; the source does not immediately repaint actors on return.

The original BAN driver edits the scene background itself. Independently parsed packets establish that **all three complete 56-packet Water movies restore every background pixel to the original Water scene**. A separate writable movie copy is a memory-ownership adaptation with the same complete-playback result. Early movie cancellation is not supported; do not claim the original return state for an arbitrary partial packet sequence.

## Recovered drawing behavior

All addresses below are MARIO.EXE **FILE offsets**.

| Behavior | Evidence and result |
|---|---|
| Swim/sunk selection | `0x16893..0x16914`, `0x173cf..0x17433`: six swim frames per character, WATER0..5/6..11/12..17; sunk34/35/36 only when failed and phase2 |
| Pursuer | `0x171d9..0x17291`: bite18..22 and octo23..32; numeric helper selects frame before mode toggle at `0x17293..0x172ba`; use its draw coordinates without a second offset |
| Draw order | `0x179d5..0x17a04`: stats, swimmer, pursuer, bubble pool ascending slot, bonus; dirty restoration can erase earlier actors, unlike alpha layering |
| Origins and transparency | `0x7a47..0x7f11`, `0x9e5f..0x9e91`: additive signed origins, inclusive clip, index0 transparent; delegated to indexed primitives |
| Waterline | Pool deactivation checks x0..317/y79..197 at `0x17058..0x17075`; these are pool lifetime bounds, **not a universal actor clip**. No extra waterline overlay or y79 clip is invented |
| Bubble rasters | FILE `0x21d0c` header `[0,0,2,2]`, pixels `[0,0,0,15]`; FILE `0x21d18` header `[0,0,3,3]`, pixels `[0,15,0,15,0,15,0,15,0]`; selection/erasure `0x17077..0x170c7` |
| Bonus bubble | `0x16c60..0x16cdb`: clone WATER33 `bonbub_1`, stamp FONT7H at raster-local(8,7), map `[0,15,9]`, skip source0; callee `0x1cbe9..0x1ccdd` ignores glyph origins and clips to destination raster |
| Bonus disappearance | `0x17616..0x17643`: below80 resets mode0 and current y200 but still calls the compositor; `0x1764e..0x17679`: mode3 supplies null current and erases old image |
| Failure | `0x17404..0x17433` uses sunk raster through bottom-of-screen clipping; `0x17eab..0x17eba` has no further failure movie |
| Prompt font | Startup `0x12650..0x12659` binds descriptor DS:4fa6 to string FILE `0x21976`=`font9h`; `0x16e2f..0x16e34` selects that descriptor |
| Prompt coordinates | `0x16eac..0x16ebb`: column1,row5 then subtract5 from y; `0x1a9ec..0x1aa21` multiplies by font metrics8×13, producing(0,47). Width advancement at `0x1a8eb` is8; font service ignores raster origins |
| Prompt sanitation | `0x16e56..0x16e88`: bytes outside32..127 display SPACE, without changing corpus |
| Prompt cursor | `0x16ece..0x16f38`: prefix color12, target color1 on opaque background15, suffix color10. Shadow remains8 from font initialization `0x1ac80`. Prefix/suffix zero pixels restore scene via `0x1a814..0x1a85d` and `0x9edf..0x9f36`; target maps zero to15. No cursor sprite/blink is called here |
| Final palette correction | Character splice `0x16ac7`; `0x16ace..0x16b14` opens FILE string `0x21d91`=`biter.gpo`, reads768 bytes; `0x16b38..0x16b74` copies slots48 through63 into Water palette. This supersedes BGS.md's Water no-second-splice claim |
| Bonus entry/return | `0x17f12..0x17f34` redraws background and restores scene palette before BAN; `0x17831..0x1786b` redraws background, prompt and palette after BAN. Timing/input/statistics remain controller responsibilities |
| Movie frame order | `0x82af..0x82de` BAN writes persistent and visible buffers, `0x82e9..0x834a` ANI dirty update, then callback |
| Movie cadence | Water-specific callback `0x17ebb..0x17ef8` calls `0x14725`, which waits for two changed ticks at `0x14733..0x14738`; sound7 on one-based packets3,8,13,20,21,25,28,32,35,41,46 from FILE `0x21d29` |

`clip` is an explicit inherited source clip, defaulting to full physical screen. No Water normal-play clip change was found in the traced loop. The separate later presentation at `0x17c26/0x17c6e` changes clips, but is not silently applied to swimming or this bonus. It remains unsupported here.

## Identities and verification

ZIP: `/Users/roberthowley/Downloads/Mario_Teaches_Typing_1992.zip`, SHA-256 `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`. Original names below are prefixed `MarioTea/MARIO/`.

| Member | SHA-256 |
|---|---|
| MARIO.EXE | `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e` |
| WATER.GSO | `1d61258b81c917bfd48a7bd7d22905ae8181e114d1154389853b63bd06836aae` |
| WATER.GSK | `5bdd499152114e541dcbc1f3636c334f9eb5c6f513245b4e20ab65becfe96edb` |
| WATER.CRX | `49cf8c922e2b195395b31bdc7866acd68119c3b58aa0e5282c827627c8d2e0c7` |
| BITER.GPO | `f82b0c1c9846dc2b55330dd023c9043a7610ee0e4e6841393ea21ecfaf7107e2` |
| FONT9H.FNT | `405f17b73b45a04e077088b89d462f4a74ca8b2e7038df10eab58145d10a72e0` |
| MSWM.BAN | `3ec24b2801d79f2ff75d7a83c4dc515dd4c277d43ddd803595618cda7f831809` |
| MSWM.ANI | `56104e5f8e64672f81fea028cf3e23441e881e8b790afb6d827c39afb4f088ad` |
| LSWM.BAN | `835f8040cf1fe46e6c0403a10c6a37b224f92115ce22b618279d696e7a124a77` |
| LSWM.ANI | `be3160728bcadcaf8bd78a97205909270ada0a5805eff46c4ab0ef65c1651928` |
| PSWM.BAN | `5cb7ab78e714054a1a65ee107f17d794d5a4b9aaf45cc9f77a358d52ec7f0bff` |
| PSWM.ANI | `a5f4d4ee48c6febe65250cf8a232fcfa7c581c4a2cf100fa0411b3033214df04` |

Existing original/render manifests retain remaining per-member identities, decoded resource indices, offsets and raster hashes. Tests read the ZIP afresh, verify all2251 Water listing instruction byte sequences, compare every Water/FONT9H/FONT7H decoded raster against independently indexed original GSO bytes, and compare every Water ANI raster/table entry and all168 BAN packets against fresh member bytes.

Validation through `structured_return`:

- `python3 -B transpile/tools/render/water-bindings.py`: succeeded, supplement generated locally.
- `node --test transpile/tests/worlds/water-render.test.mjs`: 11 tests passed.
- `node --test transpile/tests/worlds/water-render.test.mjs transpile/tests/render/render.test.mjs`: 22 tests passed (11 Water and 11 indexed primitive regression tests).
- Tests assert exact indexed buffers, original frame indices, all three characters, sink/border erasure, source order, bubble slot order, glyph zero/shadow mappings, palette ranges and all movie restoration pixels. Expectations use independent pixel loops and a separate test-only BAN parser, not screenshot comparisons or production compositor calls.

## Phase2 background and host integration

`app/render.mjs` consumes ordered controller effects and retains draw-time snapshots; `Session.stepWaterHost` owns pending input and explicit tick/bonus acknowledgments. The controller bubble event now includes pre-update allocations, so the first draw restores the source small-raster rectangle.

FILE `0x9cab..0x9d3f` increments DS:0302, resets exactly at50, and starts at floor(counter/2). It writes twenty16×14 tiles across rows65..78. Tile records start at DS:0456 (FILE0x1f6c6), stride228; each has224 raster bytes, followed by the next record's four-byte width/height header. Index wraps at25. Nonzero pixels overwrite the visible buffer; zero restores the unchanged background (the pointer's +4 skips its header). The counter has only this traced writer and initializes to-1 (FILE0x1f572=`ffff`), so the first update selects phase0 and the counter survives entries. Supplemental bindings export these25 rasters; producer and real Renderer tests compare them directly with executable data. No generic animated water texture substitutes for this call.

Phase2 wires all three movies, source text, palette, failure, results and Next. Numeric HUD, sound, intermediate fades and optional Phase5 progression animation remain omitted. See `reports/PHASE-2.md` for integrated checks. The worker-only limits below describe its original handoff, not current enablement.

## Worker handoff limits (superseded where noted above)

- Shared app/data builder, Session, controller adaptation and browser rendering are intentionally untouched; no Chrome integration was tested.
- Shared numeric statistics/HUD rendering, result/progression presentations and the later Water presentation are not implemented in this module. No guessed HUD placement is added.
- Sound requests are exported as evidence only, not synthesized audio. Intermediate palette fades, planar VGA transfer rounding/timing, original-runtime differential comparison and wall-clock browser cadence remain unsupported.
- Rendering tests prove decoded indexed-memory behavior, not DOS execution equivalence. No archive program, script, driver, installer or machine code was run or emulated.
- Generated palette/BAN records and imagery remain local-only original material, not MIT-licensed project code and not for publication.
