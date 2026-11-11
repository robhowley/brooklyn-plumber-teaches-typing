# Castle presentation

**Integration update:** Session/main/Renderer and the data builder now consume these ordered operations. FONT9H, Castle scenes/palettes/actors and all three exact BAN write streams are bundled locally. Controller pre-scroll oldX and stationary-rock redraw defects were corrected before enabling Castle. Numeric HUD layout, fades/audio and optional Phase5 endings remain omitted. See [Phase3](../../reports/PHASE-3.md). The following is the original isolated-worker record; its integration-pending statements are historical.

**The new module translates Castle's scratch transition compositor, FONT9H queue display, scene clips, actor ordering and bonus pixel operations. Castle remains disabled.** Integration must wait for Water and bridge the controller's ordered events to these functions. No Session, main renderer, builder, controller or shared decoder was changed.

## Integrator API

`app/castle-render.mjs` is dependency-free except for the existing indexed renderer. It has no DOM, clock, RNG or controller import. All buffers contain palette indices, not RGBA. Use the existing `worldPalette` or `manifest.worlds.castle.palettes.m/l/p`; all four scenes share the CASTLE.CRX palette with character slots32..47 replaced.

An actor is `{sprite,pixels,x,y}`; `sprite` is the existing manifest record, `pixels` its decoded `Uint8Array`, and x/y are logical coordinates before additive raster origins. An update is `{current,previous}`; null current erases, null previous has no old rectangle. An omitted update means no draw. Do not convert omitted updates into erasures.

| Export | Arguments and behavior |
|---|---|
| `castleFrame(manifest,character,kind,index)` | Character1..3; kind `run`, `jump`, `sink`, `idle`, `rockface`, `pipe1`, `pipe2`, `bonus`; index within that kind. Returns the original sprite record. Includes all13 jump frames. IDLE index is the controller-selected schedule slot, not a tick count. |
| `CASTLE_CLIPS` | Immutable full, pipe entrance/exit, sand rectangles. All edges inclusive. |
| `drawCastleText(front,background,words,glyphs)` | First40 queue words; glyphs are96 decoded FONT9H pixel arrays in code32..127 order. Writes only rows7..19. Metadata changes colors, not characters. |
| `drawCastleActors(front,background,{sceneType,failure,rockfaces,bonus,player},clip)` | sceneType0=rockfaces,1=sand. Changed rockface updates remain in original record order; null entries skip. Uses recovered active/failure draw order. Pipe bump/walk calls use existing `updateSprite` directly, under the selected clip. |
| `beginCastleTransition(background,nextScene,transitionY)` | Mutates background scratch rows and returns `{nextScene,step,backgroundOffset,finished}`. transitionY is92 for scene0/1,36 for scene2/3. No player or clock update. |
| `stepCastleTransition(front,background,transition,current,previous,clip?)` | One visible strip, shifted-background restoration, current actor overlay. Previous actor is **before** visible scrolling; current is the controller's **after** position update. Advances presentation step only. |
| `finishCastleTransition(front,background,transition)` | Copies next scene into background rows26..154, resets pointer bias, copies background rows0..154 to front. Also use for fast branch and interrupted transitions. Does not redraw player or bottom HUD. |
| `drawCastleBonusActor(front,background,current,previous,sceneType,clip)` | Active bonus replaces clip top with69/37. Erasure uses the original clip. Caller clip is unchanged. |
| `castleBonusBlock(block,glyph)` | Copies CASTLE index14 and composes FONT7H at raster offset(8,7), mapping source1→10,2→1. Returns `{sprite,pixels}`. This special callee ignores glyph origins. |
| `beginCastleBonus(front,background,sceneType,scene0)` | Sand substitutes scene0; then full background copy. |
| `drawCastleBonusPacket(front,background,runs,current,previous)` | Apply decoded BAN writes to both buffers, then ordinary ANI dirty update with full-screen clip. |
| `finishCastleBonus(front,background,sceneType,scene2)` | Sand restores scene2; rockfaces retain the post-BAN background. Full background copy removes last ANI actor. Controller marks all three rockfaces dirty. |

`runs` is the only proposed decoder/schema addition: an ordered array of `{offset,pixels}` describing actual BAN writes. Existing decoder already knows these bytes. Preserve literal zero and writes equal to existing background; omit skips, including repeated zero. **Diffing successive full background frames is insufficient:** a same-value write still erases foreground pixels. Integrator may expose the decoder's existing write operations without introducing another format decoder. Current `ban-packets.json` contains offsets/counts, not write bytes; `tools/build-app-data.py` does not yet provide Castle runs/fonts/resources to the browser.

The controller retains timing, frame selection, queue metadata, scene branching, previous actor records and clip selection. `stepCastleTransition` must run before the transition operation3 text update, not as a full-scene rebuild. Draw text against the unshifted normalized background, even during transitions.

## Directly recovered behavior

### Text, cursor and allocator detail

- Startup FILE `0x12650..0x12659` loads string `font9h` at FILE `0x21976` into descriptor DS:4fa6. Loader descriptor+11 supplies DS:4fb1, passed to `0x9a99` at `0xd784..0xd799`. FONT9H indices0..95 are codes32..127, 8×13 pixels.
- FILE `0x9ac8..0x9ad4` starts at visible offset0x8c0=(0,7), count40. The loop advances eight pixels, reading one queue word per cell. It does not use a general font layout service or glyph origins.
- FILE `0x9af6..0x9b38` gives cell8 priority over metadata. Nonzero source pixels become1 at cell8, otherwise15 for word bit0x200,14 for bit0x100,10 by default. Bit0x400 does not change color. The code writes another color variable that this chunky loop never reads; do not invent a second glyph layer from it.
- FILE `0x9b38..0x9b48` masks the low byte with127, maps values below32 to SPACE, then indexes code−32. DEL127 is displayable despite ordinary Castle input excluding127.
- FILE `0x9b80..0x9b95` treats **every nonzero font pixel as ink**, zero as background. It reads ES:[DI+4], using only the background segment DS:5a44. This is **not a four-pixel background shift**: the allocator returns offset4 (`0x45f5`, `0x4637`, `0x46b6`), while the visible buffer is normalized to offset0 (`0x12701`). Therefore the correct normalized JS read is `background[dest]`.
- Crucially, this text loop ignores DS:5a42, unlike sprite compositing. Transition pointer bias does not move text erasure. The background's top26 rows are never scratch-modified.
- Queue operation1 calls text at `0xbc21`; ordinary operation2/3 reaches `0xbf4a`; operation4 instead copies the original top26 rows (`0xbf5c..0xbf86`). There is no separate blinking cursor sprite in this recovered path: the target cell is recolored.

### Transition compositor and dynamic strips

FILE `0xc082..0xc27b` is not an ordinary dirty sprite update against a scrolling whole background:

1. Decode next scene to a separate320×129 buffer.
2. For exactly50 rows starting transitionY, copy old background x256..319 to x0..63, then next-scene x0..63 to background x64..127. Original source row is transitionY−26 (`0xc0bf..0xc14d`). Other columns retain their previous values.
3. Bias the background pointer by−256 (`0xc14f..0xc15d`). Each iteration scrolls visible rows26..154 left8, inserts next-scene columns8×step..8×step+7 at x312..319, subtracts8 from previous actor x, and advances background bias by8 (`0xc17b..0xc18b`). The controller computes new x=old x−8+1+(step&1).
4. Special callee `0x7f1f..0x7ff4` builds both actor rectangles using additive origins, unions them **even when disjoint**, rounds left down/right up to groups of4, and passes that rectangle as a synthetic previous image to ordinary compositor `0x7a47`. Restore this whole clipped union from the shifted background, then overlay the new actor. Ordinary `updateSprite(current,previous)` alone would miss the rounded edge pixels and disjoint gap.
5. After40 iterations, background bias is+64 and the actor has moved−260. On normal, fast, or early-exit finalization, copy next scene to background row26 and copy exactly0xc1c0=49,600 bytes from background to front (`0xc202..0xc248`). This is rows0..154, not a whole-screen redraw. The player is not redrawn by this copy.
6. Fast branch skips visible strips and applies its controller position change−320+60 (`0xc161..0xc173`); operation3 follows the final copy at `0xc252..0xc257`. Normal branch operation3 follows each actor draw. These are different callback positions, not interchangeable timings.

`drawCastleScene` and `scrollCastleStrip` are reused unchanged. All source reads remain indexed byte operations; no machine-code execution or segmented-memory emulation is used.

### Actor order, pipes, sand and failure

| Path | Recovered drawing order / resource |
|---|---|
| Rockface entry | Initialize three CASTLE index0 actors in record order (`0xc692..0xc725`); unchanged actors do not redraw. |
| Rockface active | Changed rockfaces in record order (`0xc887`), bonus (`0xc88c`), player (`0xc8a9`), operation2/text (`0xc8dd`). Replaying a later dirty update can erase earlier art, unlike alpha layering. |
| Rockface stages | CASTLE indices0..3 from FILE tables `0x213bd`, `0x213de`; numeric stage selection remains in existing/controller routines. No collision painter or crushed sprite invented. |
| Rockface failure | IDLE schedule-selected player (`0xc319`), bonus (`0xc33d`), rockfaces (`0xc34d`), operation3 (`0xc35b`). Controller temporarily adds60 to trigger x for rockface update, then restores it. Do not reverse this order to active layering. |
| Pipe1 | CASTLE indices4..8, draw `0xca49`, four operation3 calls, erase `0xcab2`, repeated RNG-delay comparison. The next bump is not a replacement for the last without erasure. |
| Pipe2 | CASTLE indices9..13, draw `0xd15c`, erase `0xd1c5`; same callback pattern with different coordinates. |
| Sand active | WALKING sink indices25..29 /55..59 /85..89, bonus `0xcdd9`, player `0xcdf6`, operation2. These are the five sink frames, not five jump frames. |
| Sand failure | Player `0xc3d4`, bonus `0xc3f6`, operation3 `0xc3fe`, continue through controller y≥95. Sand clip bottom91 hides the lower raster. No new failure movie is called here. |
| Sequence exit | Restore full-screen clip at `0xd39b`, stats operation130 at `0xd3ad`, then return. Results/end-mode presentation is a separate path, not a retry/lives screen. |

Clip sites retain the full Phase1 rectangles from [BGS.md](BGS.md): pipe1 entrance right46 (`0xc96f`), exit left272 (`0xcb23`); sand bottom91 (`0xcc95`); pipe2 entrance right44 (`0xd07f`), exit left269 (`0xd23f`). Full-screen restoration sites are `0xca0c`, `0xcbca`, `0xcfac`, `0xd11f`, `0xd2e0`, `0xd39b`. Use the controller's phase, never infer visibility from sprite position.

Operation `0xbb06` saves the caller clip (`0xbb27`), uses full screen (`0xbb3c`) for input/text/bonus work, then restores (`0xc02d`). The module passes clips explicitly so no global clip leaks. Active bonus saves/replaces only top/restores at `0xdb87..0xdbee` and `0xdcab..0xdd54`. State3 erasure follows restoration at `0xdc19`/`0xdd7f`, so it uses the original clip rather than the temporary top.

### Bonus composition and return

- CASTLE index14 `brick1_cblock` is copied before glyph insertion (`0xd8a4..0xd8cd`). FONT7H code−32 is resolved through DS:4fc0. Raster insertion is at(8,7), remap[0,10,1] (`0xd8d0..0xd91f`).
- **Special callee distinction:** `0x1cbe9..0x1ccdd` reads source/destination dimensions, ignores both raster origins, skips source0, clips coordinates to the destination raster, then remaps source values. It is not `blitSprite` and does not add glyph origins.
- Sand bonus temporarily decodes scene0 into background (`0xde7d..0xde9f`). Both paths blacken palette, copy all64,000 background bytes through `0x14b6d`/`0x638a`, restore final Castle palette, then play selected MCAS/LCAS/PCAS BAN+ANI (`0xde6c..0xdf45`).
- BAN writes persist in both buffers; ANI ordinary dirty erasure follows each packet (`0x82af..0x834a`). Exact zero behavior is unchanged from the shared decoder. All three supplied movies have52 packets/ANI entries.
- Callback `0xde2e` calls two-changed-tick wait `0x14725`; sound7 table at FILE `0x21430` uses one-based packet numbers. Use `worlds.castle.bonusPlayback`, not guessed frame milliseconds.
- Return marks all three rockfaces dirty (`0xbdea..0xbe07`), restores scene2 only for sand (`0xbe09..0xbe2b`), blackens palette, copies the postmovie background to visible, restores final palette (`0xbe2e..0xbe56`). Later operation text and caller-clip restoration still occur. Do not restore a prebonus screenshot or retain the last ANI sprite.

## Source identities and evidence

All executable citations are **FILE offsets**, from `MarioTea/MARIO/MARIO.EXE`, SHA-256 `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e`. Original ZIP SHA-256 is `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`.

The static pass compared8,129 instruction-byte spans from the existing listing to freshly read ZIP member bytes, covering allocator, copy, compositor, Castle and font callees. This verifies provenance, not original-runtime execution. Tests read ZIP members as data, independently unpack BGS, and compare original GSO pixel payloads with decoded resources.

All members below are under `MarioTea/MARIO/`; remaining BGS/CRX/WALKING/IDLE/font7 identities and all scene pixel hashes remain in [BGS.md](BGS.md), [RENDERING.md](RENDERING.md) and the local manifests.

| Member | SHA-256 |
|---|---|
| CASTLE.BGS | `b4674d24c215486663d5fe0fcf17f38672fc2c160e914c868d555a062a1450df` |
| CASTLE.CRX | `c295095534fdbb637e845a83adc7095950ce11b843fcaf56d1193cecda2835c7` |
| CASTLE.GSO | `dc62d4fcfbe8499ac6da2a6e78fcecbad0a0611f3774eae90351c9f8bd177a62` |
| FONT9H.FNT | `405f17b73b45a04e077088b89d462f4a74ca8b2e7038df10eab58145d10a72e0` |
| FONT9H.GSK | `31c5f7ce539abf9000572f896acb8233d3b5986056c2dad63f3c4e37143e2ba8` |
| FONT9H.GSO | `b2f13b6118d901f364713716b6180246572c5cd27cd8c26a2aebddb873c5ea0f` |
| MCAS.BAN | `c00755b4b2a9264b07113d4542716d7c7b369b6054226f4318632e737cd1aaef` |
| LCAS.BAN | `26dccfb9feff55fce5ca80ad8c8602f3c5f9bed04e1c5b5bb5a3538a8514257b` |
| PCAS.BAN | `ddd988ed0fe57e53049215ae998431c9776b6f894fa5905ed1252883d97fa967` |
| MCAS.ANI | `dbecdac386295105488d24d4867ec4c35bb66bf81402db5e8bb4ab6cdda383e0` |
| LCAS.ANI | `bd57afa5c1f15d6bd1dbe671d7bba0f2b308d27774203e3437379fe41887ba10` |
| PCAS.ANI | `eb5e21132447393818d5fa927e6497b9aa985f29d4135ddb8419140ea240b0ac` |

## Checks and limits

Commands from this isolated checkout root, run through `structured_return`:

- `node --test transpile/tests/worlds/castle-render.test.mjs transpile/tests/render/render.test.mjs`: 22 passed (11 new Castle tests, 11 existing render tests).
- `node --test transpile/tests/{app,control,outdoor,worlds,runtime,render}/*.test.mjs`: 104 passed.
- `git diff --check` and owned-file whitespace check: clean. Only the three assigned new files changed.
- Test-only independent BGS decoding matches all four scene arrays; original GSO payloads match all Castle, Walking, FONT9H and FONT7H records.
- Pixel tests cover every scene and character, metadata/target text, every clip boundary, all40 transition iterations, early/fast cleanup, active versus failure draw order, all rockface/pipe/sink frames, bonus glyph composition, all three full BAN/ANI movies and sand bonus return.
- Invalid current transition raster and invalid BAN runs fail before framebuffer changes; completed transitions reject reuse.

**Not a complete playable-world claim:** controller event integration, browser data transport and end-to-end browser tests remain pending. Shared HUD/statistics drawing through `0x15965` is not translated here; do not claim the module reproduces those labels/numbers. Final palettes are available, but intermediate fade behavior through `0x14d0b` remains outside this module. Result/progression/end-mode presentations remain Phase5 work; no substitute failure ending was invented. Sound requests/cadence metadata are recovered, audio playback is not implemented. The tests prove authored indexed operations and static resource bindings, not DOS execution equivalence, planar hardware timing or browser scheduling.

No original program, driver, installer or instruction interpreter was run. No generated original-derived resources, raw tables or screenshots were added. No peer mutable files were inspected. No commits, pushes or world enabling occurred.
