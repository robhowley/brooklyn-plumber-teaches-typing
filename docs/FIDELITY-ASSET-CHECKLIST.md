# Original asset checklist

Phase 1 records the approved asset policy and evidence. It does not select, copy, convert, or integrate any archive asset. The current runtime remains unchanged. The static archive assets are candidates only; suitability has not been established for every screen or sprite. Public redistribution rights are unverified.

## Policy and status

- **Approved future direction:** use suitable static original archive backgrounds, sprites, and fonts as primary visual assets, adapting only what browser use and accessibility require. Convert selected resource data offline into local browser assets. Keep pixel geometry, palettes, and composition as closely as evidence allows.
- **Not allowed:** execute, emulate, source, import, or load archive members as code; ship EXEs, drivers, installers, archive scripts, a DOS decoder, or a runtime archive reader. No external runtime asset service or download.
- **Not part of this approval:** the eight DOS screenshot references are not production assets. Preserving the old save preserves data, not old-rules play. This asset policy does not establish any individual asset's suitability. Gameplay, learner text/content, save conversion and student-slot policies are separately approved in [D1–D8](FIDELITY-DECISIONS.md). D1 preserves the old save and archives its course position, starting the new course at 5 WPM/home row without an old playable ruleset.

## Existing runtime art and provenance

| Current source paths | Existing source and provenance | Boundary |
|---|---|---|
| `src/assets/title/title.png`, `title-base.png`, `title-layout.json`, `timing.json`, `provenance.json`; `src/title-art.js` | Separate still from frame 400 (16.0 s) of [NintendoComplete's 1992 PC playthrough](https://www.youtube.com/watch?v=r-LxHUgI2W0); base uses frame 285. Details and pixel checks are in [`docs/TITLE-SCREEN.md`](TITLE-SCREEN.md). | Screenshot-derived title is already in the runtime. It is not one of the eight `references/images/` files and is not an archive asset. Its existence is not new approval to reuse other screenshots. Fade timing is an adaptation. |
| `src/assets/characters/mario.json`, `src/art.js`, `src/screen-art.js` | Mario trace evidence is indexed under ignored `artifacts/trace-characters/`; inputs and remaining gaps are summarized in `artifacts/integration/provenance-index.json`. Gameplay footage is [the dJP7FTvGETM recording](https://www.youtube.com/watch?v=dJP7FTvGETM). | Luigi and Princess gameplay poses and parts of the teacher art are drawn stand-ins, not recovered archive sprites. Character frame timing is not established. |
| `src/outdoor-assets/`, `src/outdoor-art.js` | Outdoor component traces and provenance are under ignored `artifacts/trace-outdoor/`; the integration index records source crops and edits. | Some occluded details and glyphs are reconstructed. These files are not the original archive assets. |
| `src/assets/underwater/`, `src/scene.js` | Component authoring is in `src/assets/underwater/build-assets.py`; evidence and provenance are under ignored `artifacts/trace-underwater/`. | Hidden reef contours and reused scaled rocks are approximations. Existing animation timing is not an original timing claim. |
| `src/art.js`, `src/scene.js`, `src/glove-hud.js`, `src/hud-texture.svg`, `src/practice-texture.svg`, `src/style.css` | Castle/HUD trace records are under ignored `artifacts/trace-castle/` and `artifacts/trace-hud/`; see `docs/ART.md` and the integration provenance index. | Readable DOM fonts are not DOS fonts; castle geometry, teacher props, and some effects are drawn or approximated. |

The eight files `references/images/{menu,profile,outdoors,underwater,castle,practice,results,report-card}.png` are reference-only, are not shipped by the current game, and are not authorized as production assets. Their external image sources and attribution are listed in [`references/README.md`](../references/README.md#7-original-dos-screenshots). The archive-asset approval does not cover copying these files or deriving new production art from them.

## Archive inventory: 20 screen backgrounds

The evidence is from the inspected v1.1 package, archive member prefix `MarioTea/MARIO/`. Each `.CRX` has a 768-byte palette followed by compressed pixel data; decoded backgrounds are 320×200. These are background images, not captured runtime screens. The inventory and hashes are in ignored `research/executable-1992/screens/evidence.json`; decoded previews are in `research/executable-1992/screens/decoded/`. The archive and static-inspection limits are documented in [`docs/EXECUTABLE-RESEARCH.md`](EXECUTABLE-RESEARCH.md).

| Screen family | Original archive members to review |
|---|---|
| Brand and welcome | `LOGO.CRX`, `GREET.CRX`, `GREETBG.CRX`, `MAINMENU.CRX` |
| Student, lesson setup, and help | `PREFS.CRX`, `LOAD.CRX`, `LESSTIME.CRX`, `HELP.CRX`, `KEYBOARD.CRX` |
| Outdoor | `OUTSIDE.CRX`, `OUTSKY.CRX` |
| Underwater | `WATER.CRX`, `WCAS0001.CRX` |
| Castle | `CASTLE.CRX`, `OCASTLE.CRX` |
| Practice | `PRACTICE.CRX` |
| Blackboard, report, and certificate | `BLACKBRD.CRX`, `RCARD.CRX`, `CERTIF.CRX`, `ENDF.CRX` |

Review every listed background for fit before use. `LOAD.CRX` is a “Load a Student” dialog, not a progress loader. Blank screen regions may require DOM text or controls. The correct ordering, runtime placement, transition, and use of each screen are not proved by the artwork.

## Archive inventory: 567 sprite records

The index and payload are `MarioTea/MARIO/<name>.GSK` and `<name>.GSO`; individual spans, dimensions, checksums, preview images, and palette notes are in `research/executable-1992/screens/evidence.json`.

| Sprite family | Index member | Records | Review coverage |
|---|---|---:|---|
| Castle pieces | `CASTLE.GSK` | 15 | Rock faces, pipe bumps, brick/block pieces |
| Finger cues | `FINGER.GSK` | 12 | Finger/hand guidance |
| Fonts | `FONT3H.GSK`, `FONT5H.GSK`, `FONT7H.GSK`, `FONT9H.GSK` | 96 each (384) | Four indexed character sets; compare to DOM text and use only where legible and suitable |
| Greeting | `GREET.GSK`, `GREET2.GSK` | 13, 5 | Character/greeting elements, lettering, bubble and eye records |
| Outdoor objects | `OUTSIDE.GSK` | 8 | Turtle, brick, and effect records |
| Practice moods | `PRACTICE.GSK` | 3 | Three distinct practice-face expressions; thresholds and selection timing are unknown |
| Character actions | `WALKING.GSK`, `WATER.GSK` | 90, 37 | Walking/jump and swimming/enemy records; record names do not prove action timing or selection |

**567 total.** Matching-name CRX/GPO palette associations are inferred, not runtime bindings. Font preview images use a fallback palette whose runtime association is unknown. Seven GPO palettes and six-bit channel values are documented in `research/executable-1992/screens/metadata.json`; preserve the source palette and verify every chosen binding rather than relying on preview color alone. Sprite records and checksums validate extraction boundaries, not animation cadence or scene placement.

## Checks before future asset integration

- [ ] Select assets by the family tables above; record exact archive member, source hash/span, `.GSK` record where applicable, palette source, and resulting local path. Record each conversion or minimal adaptation. Do not treat a decoded preview as a selected production asset.
- [ ] Compare decoded source pixels and dimensions with the local browser asset. Preserve native geometry and palette indices when possible; document any palette remap, crop, or scale. Use nearest-neighbor scaling for pixel art and check palette output in the target browser.
- [ ] Compare each composition with the decoded source and available reference evidence. Check layers and positions in the actual scene, but label placement, palette binding, sprite sequence, animation timing, and transitions as choices where source evidence does not establish them. Do not infer behavior from a filename or still frame.
- [ ] Put readable lesson text, labels, status, and interactive controls in accessible DOM, not only in Canvas. Use semantic headings, labeled controls, visible keyboard focus, screen-reader announcements for changing status, and focus return after dialogs. Canvas art must not be the sole way to understand or operate a screen.
- [ ] Verify all adapted screens at native and browser display sizes, with reduced motion and keyboard navigation. Save source-versus-output comparisons and describe remaining differences; do not claim pixel fidelity from a contact-sheet inspection alone.
- [ ] Keep source provenance and redistribution status with the shipped asset manifest. Rights are not established by archive hashes, local possession, or retained copyright text.
