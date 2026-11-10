# Title image and lettering reveal

The title art is a 720×450 crop from a recorded game frame, not a redraw. The character composition appears as soon as the local images are ready, then the 13 subtitle letters fade in sequence. Completion leads directly to the reconstructed MAINMENU; Enter, Space or a click skips to that same menu.

## Image source

`src/assets/title/title.png` is the unchanged crop from frame 400 (16.0 seconds) of [NintendoComplete's 1992 PC playthrough](https://www.youtube.com/watch?v=r-LxHUgI2W0). The source frame is 720×480; the crop is `(x: 0, y: 14, width: 720, height: 450)`. It preserves the original characters, proportions, colors, lettering and copyright notice pixel-for-pixel.

`title-base.png` keeps the same crop except for the subtitle rectangle `(276, 2, 433, 78)`. That area is replaced with pixels from frame 285 (11.4 seconds), before the subtitle appears. This makes a clean layer for the letter reveal. The two frames come from compressed video, so small pixel differences remain in the replaced background. `title-layout.json` gives the 13 glyph rectangles as half-open image-coordinate boxes. `provenance.json` records source hashes and crop checks.

The source frame and before/after comparison are preserved under `artifacts/title-still/art/`; timing frames, contact sheets and pixel measurements are under `artifacts/title-still/timing/`. These ignored local artifacts are evidence, not runtime dependencies. The eight screenshots in `references/images/` are not loaded or shipped by the game.

## Timing and runtime behavior

The recording shows first subtitle visibility at frame 288 (11.52 seconds) and the last letter fully visible at frame 389 (15.56 seconds), for 4040 ms between those observations. Frames were sampled at 25 fps, so the timing has about 40 ms of uncertainty. The recording also shows a 120 ms hold between frame 285, where the small MARIO logo and character composition are present, and the first subtitle letter, plus a one-second gap between the two words.

`timing.json` records observed letter start offsets. Its `durationMs` values measure a gold-pixel threshold, not a consistent opacity curve: some are zero and adjacent glyph shadows can affect the measurement. The runtime therefore does not copy those durations or use zero-duration pops. It applies a uniform 120 ms opacity fade to each image glyph at its measured relative start offset. After the 120 ms initial hold and the last 120 ms fade, the complete title is shown after 4280 ms from asset readiness. The completed still holds for 800 ms, then the app enters MAINMENU directly. This timing and handoff are browser choices, not claims about the original game's alpha animation or startup transition.

The two PNGs preload outside drawing. The base is shown immediately; the animation uses `requestAnimationFrame`, stops after the final exact full image is drawn, and stops if its canvas is detached. Reduced motion skips the reveal and draws the complete still. Image failures skip the title artwork and continue to MAINMENU. The title does not pass through the old GREET/welcome page. The main menu keeps its 320×200 composition, fits uniformly at 8:5, and receives real buttons and disclosures as transparent hit regions over the raster. Menu text, focus and dropdown selection are painted at native pixel coordinates. The keyboard and pointer both operate the same controls.

## Rebuild and limits

From the repository root, rebuild the title files and source comparison with:

```sh
python3 src/assets/title/build-assets.py
```

The defaults use `artifacts/video-r-LxHUgI2W0/frames/frame-00000400.png` and `artifacts/title-still/timing/frames/frame-00285.png`. The source recordings and extracted frames are local, Git-ignored research artifacts, so a fresh clone needs those files restored first. Alternate frame locations can be supplied explicitly:

```sh
python3 src/assets/title/build-assets.py \
  --source /path/to/frame-00000400.png \
  --before /path/to/frame-00285.png
```

The builder uses only Python's standard library. It checks the exact final crop and confines base replacement to the subtitle rectangle. It does not redraw, vectorize or mask the source lettering.

This remains an unofficial fan recreation using copyrighted game imagery and names. The source copyright line is retained; that does not grant redistribution rights. The repository license does not grant rights to Nintendo, Interplay or other third-party material. The title capture is lossy video rather than a native DOS frame, and the fade timing is approximate within the sampling limits above.
