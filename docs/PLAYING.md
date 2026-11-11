# Playing the static translation

## Play

- Startup plays LOGO, Mario zoom and title letters. Separate keys skip only the original polling sites, not an invented skip-all command. Menu idle shows text/blinking and never starts gameplay.
- **D** selects unsaved Demo; then choose a world. It synthesizes target keys at each world's source input site. Escape may be deferred behind synthetic keys. Guest never becomes Demo automatically.
- Click the canvas, then **1 Outside**, **2 Water**, **3 Castle** or **4 Practice**, or click their original right-side menu pictures.
- Outside accepts the marked target immediately, including lowercase equivalents. Type a displayed bonus punctuation key to play its recovered BAN/ANI sequence; lesson time stops during playback.
- Practice preserves case. Copy the second text row into the first; at the line end press **SPACE or Enter**. Nine source rows remain buffered. Wrapping uses the original cursor/rewind algorithm, including its overlong-word quirk, not conventional word wrap.
- Water matches case in the highlighted word window. Any input resets inactivity; strictly more than20 seconds starts the scripted chase and sink. Bonus punctuation stops lesson time during MSWM/LSWM/PSWM playback.
- Castle repeats rockfaces, pipe1, sand and pipe2. Match the colored FONT9H target; bonus punctuation plays MCAS/LCAS/PCAS with stopped lesson time. Escape exits; F10 is ignored. Advancement plays its source ending; first graduation repeats ENDF until a key. Music/effect synthesis and intermediate world fades remain unsupported.
- **Escape** ends any activity early; **F10** also ends Outside/Water but is ignored in Practice. There are no lives, countdown, contact typing gate or invented Practice failure.
- Results: **N Next**, **M / Escape Menu**. Enter activates the pointer position; Tab/arrows select the original button positions. Space does not activate results.
- Use the original dropdowns with pointer or arrows/Enter. **W / E / T / L** open original canvas New/Edit/Times/Load paths. Name fields uppercase letters/digits, accept8 characters, and consume ordinary keys instead of launching menu shortcuts. Home/End, Insert/Delete/Backspace work. Numeric fields clamp goal5..150 and each duration1..60.
- New clears the working profile even when cancelled. A duplicate New name loads the existing student. Rename Escape cancels before deletion; accepted rename deletes the old saved name then saves, without collision confirmation. In the chooser **D is Done/load, never delete**; **C / Escape** cancels.
- Student editor Escape outside a field saves and returns. The toolbar/native form remains a separately labeled browser fallback with native validation, not a replacement claim for original widgets.
- **5 / report picture** opens RCARD for a saved student; **H / F1** opens help, **K / F2** Keyboard, **A** About. Results F1 opens section2 and returns to the same results. Keyboard F1 stays open; other keys close it without reaching a lesson. Help supports paging, Home/End and its original pointer buttons.
- Focus loss pauses both motion and active lesson time. **Focus game** resumes. This is a host adaptation, not a recovered pause key.

Guest `Player` is unsaved and is not Demo. New students default to goal5, group1, Mario and durations2/5/5/10 minutes. Practice never advances the group; its Next stays in Practice. Next enters Water at goal10 and Castle at30. Practice Next stays in Practice; Castle completion does not invent a route to Practice.

## Fidelity boundaries

- Recovered: lesson bytes/cursors, shared activity RNG draws, low16 seed, Outside mechanics/order, bonus interception and timer stop/restart, Practice rows/input/expression, scoring/results/progression, sprite origins/index-zero mask, ground, final Outside palettes, decoded idle and bonus rasters.
- Host adaptations: epoch clocks, approximately18.2Hz scheduling, Outside/Practice single-key latch, Water/Castle unbounded FIFO, focus pause, full-scene Outside/Practice redraw, native fallback form, localStorage and safe short-help bounds. Original student caret inversion uses4/2 changed-low-tick waits, without catchup.
- Audio: four exact PCM VOC clips (158,254 samples), source request/stop/options and blocking continuations. Supplied CNF selects speech3, music/effects4 and options7. Browser availability and trusted-gesture unlock are explicit adaptations; skipped requests never replay later.
- **Enable browser audio** unlocks transport; **Mute browser audio** is separate from source M/S/G. VOC speech drains input until completion. Locked, denied, muted, missing, blurred or suspended playback is visibly omitted without a guessed delay. Water's already-running lesson timer includes Ready; only the explicit host focus policy pauses it.
- Unsupported: 58 music/effect/RS/driver/bank resources, certificate chooser/text output and actual printing, intermediate world/modal fades, DOS timezone/hardware behavior, original mouse imagery, finger-hint graphics and the Practice input blink. Startup/celebration fades preserve all source palette writes without guessed per-write delays. Welcome text still uses an explicit provisional color mapping.
- Alt-X queries signed KWD>=10, not audio bit0x10. With no browser KWD environment it is consumed without quit/abort outside the ordinary menu; menu Quit remains unconditional, notice only. Quit cannot terminate a browser process or close this tab. Storage/resource failures stay visible; no generic art or corpus is substituted.

`?seed=1` fixes the **process entry seed**, including startup and subsequent menu/world/firework draws. Natural seed1 startup consumes13 RNG draws and291 changed-low-tick observations; skipped title delays consume fewer. Menu callbacks also consume source-timed draws, so input timing changes later lessons. This is a static translation, not an executed DOS replay. State is retained across supported activities. There is no source-selector interstitial or three-second countdown.

Outside counters and its observed-second bonus clock now survive repeated entry and intervening Practice. Source contracts: [reentry/FONT7H](../analysis/runtime/REENTRY.md) and [decoded Water/Castle foundations](../analysis/render/BGS.md). Water retains its whitespace, animation counters and failure phase across other activities. Its controller drains pending keys before actor updates and waits on changed low ticks. See [Water controller](../analysis/worlds/WATER-CONTROLLER.md), [presentation](../analysis/render/WATER.md) and [Phase2 checks](../reports/PHASE-2.md). Phase2 passed independent review and was pushed as `aaf2975`. Castle retains separate rock/sand observed-second clocks, uses one pending key per source operation, and consumes ordered draw snapshots including transition scratch bias. [Controller](../analysis/worlds/CASTLE-CONTROLLER.md), [presentation](../analysis/render/CASTLE.md) and [Phase3 checks](../reports/PHASE-3.md) document the integration. Phase3 verification and publication are recorded in [PHASE-3-VERIFICATION](../reports/PHASE-3-VERIFICATION.md). Phase4 source contracts are [MENU](../analysis/control/MENU.md) and [REPORT-HELP](../analysis/control/REPORT-HELP.md). Source celebrations now complete before deferred saves/results. Water swimming/movie playback cannot be skipped; Castle graduation repeats until a key. Next queues eligible certificate pending bytes without marking them printed. See [startup evidence](../analysis/control/STARTUP.md) and [celebration evidence](../analysis/control/CELEBRATIONS.md).

See [coverage](../COVERAGE.md), [adaptations](../ASSUMPTIONS.md) and [Phase 1 results](../reports/PHASE-1.md). Missing assets stop visibly; blocked/corrupt storage produces a persistent memory-only warning. No generic art or generated corpus fallback is used.

## Files and evidence

| Path | Role |
|---|---|
| `app/main.mjs` | DOM input, focus, editor and host scheduling |
| `app/session.mjs` | Calls recovered control, outdoor, runtime and worlds routines |
| `app/render.mjs` | Calls recovered indexed renderer; isolates host drawing choices |
| `app/data.json`, `assets/app/` | Local generated resources, ignored by Git |
| `tools/build-app-data.py` | Bundles inert resources; applies tested Python BAN decoder |
| `recovered/{audio,control,outdoor,worlds,runtime,render}/` | Source-cited, tested APIs, including Phase 1 retained-state and world-render primitives |
| `assets/render/manifest.json` | Local next-phase world API: `worlds`, family/index sprite records, palettes, scenes and ANI paths; all paths relative to this manifest |
| `analysis/*/` | Executable FILE offsets, hashes, resource indices and limits |

The browser fetches only authored modules, JSON and decoded bonus backgrounds. It never fetches executable/archive/raw files or imports the old app. All analysis reads original bytes as inert data; no original machine code is executed, interpreted or emulated.
