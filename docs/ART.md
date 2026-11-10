# Scene art

The app uses **20 decoded static archive backgrounds and 166 selected sprites/glyphs**, with browser controls and limited visual adaptations. Public redistribution rights remain **UNVERIFIED**. This is not a pixel/timing-exact DOS recreation.

## What runs

- `src/assets/original/rasters.json`: selected palette-indexed pixels, decoded offline from static resource data. `index.js` expands these static pixel arrays into cached Canvas images; it is not a DOS decoder or archive reader.
- `src/title-art.js`: static 320×200 GREET composition with recovered greeting letters. No screenshot crop, timed letter fade, video dependency or fabricated loading progress. The old `src/assets/title/` and [title-tracing report](TITLE-SCREEN.md) are historical, not runtime dependencies.
- `src/screen-art.js`: native 320×200 screen families and panel coordinates. Practice, student/load, lesson times, instructions, results, report and certificate content uses readable DOM inside the original panel geometry; long content scrolls instead of shrinking. Welcome/menu and the keyboard diagram retain separate controls where overlaying prose would obscure art. LOGO/GREET/GREETBG, MAINMENU, PREFS/LOAD, LESSTIME, HELP/KEYBOARD, OUTSIDE/OUTSKY, WATER/WCAS0001, CASTLE/OCASTLE, PRACTICE, BLACKBRD/RCARD and CERTIF/ENDF are retained.
- `src/scene.js` and `src/art.js`: 640×400 activities using 2× native backgrounds, recovered Mario/Luigi/Princess action poses, outdoor targets, water enemies and castle blocks. Practice remains a plain panel with performance expressions rather than platform scenery.
- `src/glove-hud.js`: recovered finger/hand art with readable DOM target and guidance. Local `hud-texture.svg`, `practice-texture.svg` and CSS remain browser decoration, not recovered archive assets.
- `src/app.js`: welcome→menu, student/time/help/report/certificate forms, focus/announcements and source disclosures. Synthetic oscillator cues remain optional; **no archive audio** is loaded or played.

All assets are local. The production build contains HTML, JS, CSS and one SVG; static rasters and reviewed lesson text are embedded in JS, and the small practice SVG is inlined in CSS. The eight reference screenshots, old traced title/character/underwater assets, offline importers and raw research are outside the runtime dependency graph. An old title illustration in the repository README is a documentation image, not shipped application art.

## Provenance and adaptations

`src/assets/original/provenance.json` records each selection's source member, byte span, member/index/palette hashes, decoded-reference hash, pixel hash and final raster hash. Archive SHA-256: `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`. `scripts/import-static-assets.mjs` is a repository-authored offline data converter, never imported by the app. Identity checks do not establish copyright permission.

- All 20 backgrounds retain native 320×200 geometry. Source review compared decoded pixels; source-backed tests and the bundle audit bind the current selections to that review.
- Character GPO palette bindings and index-zero transparency are inferred, not proven DOS runtime bindings. Font7H ink is changed to white for legibility; glyph geometry is retained.
- Mario has three recovered practice faces. Luigi/Princess action sprites are recovered, but their practice faces remain browser-drawn adaptations because separate original sets were not found.
- Placement, animation cadence, browser aspect/scaling, scrolling/contact, castle sand masking and stationary pipe composition remain adaptations. Original OCASTLE/ENDF availability does not prove their invocation or graduation trigger.
- Practice mood bands (sad below 75% of goal, neutral below goal, happy at goal) are chosen browser thresholds. Quicksand, swimmer/chase and Thwomp feedback are nonterminal; every early death remains disabled.

## Rendering contract and evidence

Draw calls use cached images and supplied active time, never advance gameplay or own timers. Pause/finished/reduced-motion states keep their documented freezes. Sound settings cannot change art or timing. Accessible DOM targets and controls carry information independently of Canvas. See [renderer contract](RENDERER-CONTRACT.md) for ownership; older dimensional examples there are superseded by the 640×400 scene above.

[Current validation](VALIDATION.md) records the exact four-file build inventory, source hashes, 186 bundled raster comparisons, source-backed checks and generated-text coverage. [Phase ledger](FIDELITY-DECISIONS.md) links independent reviews. Historical screenshot-tracing evidence remains in `artifacts/integration/`, but does not validate this new asset set. Final integrated screenshots, full-course records, traces and component-bound assertions are in `.tmp/fidelity-validation/phase6-final/` (51 browser tests pass). Practice panel coordinates were corrected to native `[27,94,266,100]` after comparing the recovered white region; no pixels changed. The HUD reflows its hands above two statistics columns at narrow component widths. Independent Phase 6 visual verification remains pending. Human visual, accessibility, audio and print review were **not performed**; agent inspection and automated replay are not human or DOS runtime validation.
