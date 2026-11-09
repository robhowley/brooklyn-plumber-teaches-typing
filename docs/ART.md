# Scene art

Gameplay uses synchronous Canvas 2D rendering at 640×280. Artwork combines traced/edited screenshot components and drawn reconstructions. The title is a separate 1540×968 raster exported from editable SVG.

## Sources and editing

The tracing pass was authorized for this task. It does not establish redistribution rights or claim recovered native DOS sprite data. Reference originals are preserved. Complete screenshots, source frames and creator overlays remain evidence only, outside the production build.

- `src/assets/title/`: editable title layers and a preloaded runtime PNG. Hidden desk, shoe and shadow details are inferred; shading remains flatter than the reference.
- `src/assets/characters/mario.json`: edited palette-indexed ground, jump, detached-cap, swim and portrait poses. The detached-cap frame is available but the unchanged scene sequence does not select it.
- `src/outdoor-assets/`: editable component PNGs, runtime indexed grids and readable case-sensitive glyphs. Occluded shell panels and small-cloud centers are reconstructed.
- `src/assets/underwater/`: preloaded component PNGs and an offline authoring script. Hidden reef contours are reconstructed; small rocks reuse scaled variants.
- `src/art.js`, `src/scene.js`: castle enemy/tile pixel data, silver pipe geometry and stepped quicksand. Alternate pipe routes are unsupported; sand texture and room repetition are approximations.
- `src/glove-hud.js`, texture SVGs and CSS: traced glove contours, brown grain, purple practice surround and results layout. Readable DOM fonts are not recovered DOS glyphs.

Luigi and Princess remain selectable unsupported gameplay stand-ins. Their title appearances do not validate gameplay animation. The teacher gown and props remain drawn approximations. Sound is synthesized.

## Rendering boundaries

JSON grids load before drawing; PNG requests begin at module initialization. Draw calls do not fetch, decode, schedule frames, mutate gameplay or own a clock. The shell supplies active time and owns text, HUD, controls and pause dialogs. See [the renderer contract](RENDERER-CONTRACT.md).

- Outdoor scrolls continuously; exact contact input triggers block debris or a flipped turtle. Its visual floor is y=252 without changing engine contact timing.
- Underwater scrolls plants/rocks and animates three fish and three squid poses. Existing performance-dependent chase and swimmer coordinates are preserved.
- Castle retains performance-driven enemies, engine-owned pipe pauses and quicksand lower-body occlusion. The silver route conceals the actor during transit.
- Practice remains plain, with a portrait and a denser DOM text preview below the hands.

Pause and reduced motion retain their existing behavior. No animation claims exact original frame durations.

## Evidence

[Integration report](../artifacts/integration/REPORT.md) records combined-build checks and image inspection. [Provenance index](../artifacts/integration/provenance-index.json) links all six bundles, their underlay proofs, two inspected passes, overlays, alternating views and motion evidence. Browser interactions and image inspections were performed by agents, not human manual play or human fidelity approval.
