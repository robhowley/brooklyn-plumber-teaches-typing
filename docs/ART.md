# Scene art

The app uses **20 decoded static archive backgrounds and 166 selected sprites/glyphs**, with browser controls and limited visual adaptations. Public redistribution rights remain **UNVERIFIED**. This is not a pixel/timing-exact DOS recreation.

## What runs

- `src/assets/original/rasters.json`: selected palette-indexed pixels, decoded offline from static resource data. `index.js` expands these static pixel arrays into cached Canvas images; it is not a DOS decoder or archive reader.
- `src/title-art.js` and `src/assets/title/`: the restored 720×450 screenshot-derived title with its measured letter reveal. The app hands it off directly to MAINMENU after the completed-title hold or when skipped; there is no GREET/welcome destination.
- `src/screen-art.js`: native 320×200 screen families and panel coordinates. MAINMENU keeps the decoded background and paints the runtime bar, greeting and dropdowns on the same raster; transparent HTML buttons and disclosures share its native hit regions. The composition is uniformly fitted at 8:5. Practice, student fields, load, lesson times, instructions, results, report and certificate content use readable DOM inside the original panel geometry; long content scrolls instead of shrinking. PREFS Done reuses its original static art, and the unchanged LOAD Cancel crop is placed beside it as a browser adaptation. Transparent DOM actions provide submit/cancel semantics, visible focus and 44px minimum targets. Their hit regions, pressed states and exact original timing are not claimed. GREETBG remains for the Help-only guided/custom source chooser. Normal MAINMENU activities 1–4 start original-first gameplay after an approximately 200 ms outgoing-menu fade; reduced motion skips it, with no chooser or black hold. LOGO/GREET/GREETBG, MAINMENU, PREFS/LOAD, LESSTIME, HELP/KEYBOARD, OUTSIDE/OUTSKY, WATER/WCAS0001, CASTLE/OCASTLE, PRACTICE, BLACKBRD/RCARD and CERTIF/ENDF are retained.
- `src/scene.js` and `src/art.js`: 640×400 activities using 2× native backgrounds, recovered Mario/Luigi/Princess action poses, outdoor targets, water enemies and castle blocks. Practice remains a plain panel with performance expressions rather than platform scenery.
- `src/glove-hud.js`: recovered finger/hand art with readable DOM target and guidance. Local `hud-texture.svg`, `practice-texture.svg` and CSS remain browser decoration, not recovered archive assets.
- `src/app.js`: direct title→menu handoff, direct normal activity entry, File/Student/Lessons commands, local student/time/help/report/certificate forms, focus/announcements and source disclosures. File → Help carries the historical notice and explains the generated-practice route. Synthetic oscillator cues remain optional; **no archive audio** is loaded or played.

All runtime assets are local. Static rasters and reviewed lesson text are bundled by Vite. Offline importers, source recordings, reference screenshots and research metadata are not runtime dependencies. Build output is generated in CI, not committed.

## Provenance and adaptations

Local `research/provenance/original-assets.json` records each selection's source member, byte span, member/index/palette hashes, decoded-reference hash, pixel hash and final raster hash. Archive SHA-256: `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`. `scripts/import-static-assets.mjs` is a repository-authored offline data converter, never imported by the app. Identity checks do not establish copyright permission.

- All 20 backgrounds retain native 320×200 geometry. Normal tests pin the shipped raster content; optional local tests compare source members and decoded references.
- Character GPO palette bindings and index-zero transparency are inferred, not proven DOS runtime bindings. FONT7H keeps its indexed geometry: index 1 is a white core and index 2 a black outline, matching screenshot/video appearance. These are browser colors, not a proved DOS runtime palette.
- Mario has three recovered practice faces. Luigi/Princess action sprites are recovered, but their practice faces remain browser-drawn adaptations because separate original sets were not found.
- Placement, animation cadence, browser aspect/scaling, scrolling/contact, castle sand masking and stationary pipe composition remain adaptations. Original OCASTLE/ENDF availability does not prove their invocation or graduation trigger.
- Practice mood bands (sad below 75% of goal, neutral below goal, happy at goal) are chosen browser thresholds. Quicksand, swimmer/chase and Thwomp feedback are nonterminal; every early death remains disabled.

## Rendering contract

Draw calls use cached images and supplied active time, never advance gameplay or own timers. Pause/finished/reduced-motion states keep their documented freezes. Sound settings cannot change art or timing. Accessible DOM targets and controls carry information independently of Canvas. See [renderer contract](RENDERER-CONTRACT.md) for ownership.

Source comparisons and historical validation reports live under ignored `research/`. Automated checks are not human or DOS runtime validation.

## Asset policy

Use selected static resource data only. Never execute or ship archive code, executables, drivers, scripts, DOS decoders or runtime archive readers. Archive audio remains excluded pending review. The eight screenshots under local `research/references/images/` are reference-only, not authorized production assets. Keep source attribution and copyright notices; the repository license grants no rights to Nintendo, Interplay or other third-party material.
