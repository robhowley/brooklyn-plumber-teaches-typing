# Mario 2: build, test and serve

Build the Windows startup and ordinary Expert Express assets from the pinned disc, without running original software. This standalone pipeline does not call or modify the Mario 1 pipeline.

## Commands

From the repository root, using Python 3.13+ and its standard library:

```sh
python3 -B mario2/tools/build.py
python3 -B -m unittest discover -s mario2/tests -v
MARIO2_TEST_ISO="$HOME/Downloads/Mario Teaches Typing 2 (1997)(Interplay)[Mac-PC].iso" python3 -B -m unittest discover -s mario2/tests -v
node --test mario2/tests/*.test.mjs
npm ci --ignore-scripts --no-audit --no-fund
PLAYWRIGHT_CHANNEL=chrome TRANSLATION_PORT=4287 PLAYWRIGHT_JUNIT_OUTPUT_FILE=mario2/.tmp/browser.xml ./node_modules/.bin/playwright test --config=mario2/playwright.config.mjs --project=root --project=pages-prefix --reporter=junit
python3 -B mario2/tools/serve.py --port 4187
```

Open http://127.0.0.1:4187/ for Express typing, setup media and renderer fixtures. The same build works at `/brooklyn-plumber-teaches-typing/`. Use `structured_return` for build/tests, with `unittest-text`, `node-test-text` and `junit-xml` respectively. Browser tests launch their own dist-only server, refuse reuse and isolate storage for each test. Choose an unused port; do not replace a user server. Install locked root dependencies only in this checkout if missing. Chrome is used above; omit `PLAYWRIGHT_CHANNEL` if Playwright Chromium is installed.

The default disc is `~/Downloads/Mario Teaches Typing 2 (1997)(Interplay)[Mac-PC].iso`. Override with `MARIO2_ISO=/absolute/path.iso` or `build.py --iso /absolute/path.iso`. An explicit missing/wrong source fails, without fallback or download. `--pins` supports negative pin tests, not alternate game editions.

Build output is `mario2/dist/`, with JSON summary counts. Each build removes the previous dist before checking pins, verifies the whole ISO and executable, reads only pinned inert member extents, regenerates assets, and checks every artifact against the authored hash/size pins before publishing. A failure leaves no dist; rerun after correcting the input. Do not run two builds in the same checkout concurrently. No extracted executable, ISO, installer, listing or research report is published.

## Verification recipe

- Unit tests need no disc and cover wrong/missing source, incomplete pins, row padding/orientation, RLE runs, odd-length literals, row changes and retained delta pixels, SZDD overlap/bounds and lesson source offsets.
- Disc tests build twice into temporary outputs, inject a stale file, compare every file hash, independently reconstruct every bitmap from ISO bytes and compare all 4,541 movie frames and frame palettes byte-for-byte with a test-only bottom-up RLE8 interpreter and palette reader. Its separate RIFF walk reads the pinned AVI members directly, not the production frame metadata. Coverage requires runs, literals, row changes and delta commands. Failures cite the member hash and AVI FILE payload offset.
- Startup tests compare all 314 native MSVC planes, palettes and PCM with independent source hashes. Built-browser natural playback checks all 314 emitted planes and every displayed opaque pixel at root and prefix, followed by the existing Welcome. Startup lifecycle tests cover ordered skips, single-pass palette alias, repaint, failed/blocked holds, retry without early menu audio, stale callbacks, focus/hidden gates and reentry. The alias test reads pinned executable operands as inert data, never executes them.
- Negative tests reject missing assets and wrong member, selector, font and decoded-output pins, including swapped movie members with otherwise valid hashes and artifacts and swapped selectors with valid slice hashes.
- Build conversion matches decoded artifact pins for storage integrity. Separately, movie joins resolve each filename far pointer through the executable's inert NE segment fixup chain and require the pinned member path and selector ID to match.
- To verify independence from research, run these commands from a fresh checkout with only the pinned ISO available. No research path is read or imported. Only `mario2/tools/` authored Python is executed.
- Before publication: `git status --short --untracked-files=all` and `git check-ignore mario2/dist/assets.json`. Only authored tools, tests, pins, instructions and build/play documentation belong in Git.

Ignored paths are `mario2/dist/`, `mario2/.build-*/`, `mario2/.tmp/` and Python bytecode. Temporary build directories are removed on success and ordinary failures. The ISO stays outside the checkout. Source art/audio is not MIT-licensed.

## Evidence and ownership

`mario2/pins.json` is the reviewed input/decode allowlist, not a generated asset table. It records disc/member hashes, ISO byte ranges, all 81 identities (the original 77 Express assets plus four startup assets), executable FILE offsets, selector-slice hashes, decoded artifact pins and lesson normalization pins. It contains no glyphs, palettes, lesson text or other raw game bytes. Original members are never loaded as code.

The authored decoder is adapted from the static research readers, reduced to the required Windows DIB/RLE8 and indexed8 MSVC AVI, PCM, MIDI events and Win16 UI formats. No research output or Mario 1 implementation is copied into the runtime. Research claim IDs in pins identify the earlier Express evidence; source hashes and FILE ranges are the reproducible proof.

The entrypoint composes the indexed backdrops, source overlay atlases, font and hand cues through [PLAYING.md](PLAYING.md)'s `mario2-assets.v1` contract. The staged allowlist explicitly includes `index.html`, `main.js`, `startup.js`, `styles.css`, `setup.js`, `storage.js`, `assets.js`, `render.js`, `typing.js`, `media.js`, `selection.js`, `report.js`, `presentation.json`, `assets.json`, `font.bin` and the pinned converted artifacts. No original raw members are published.

Setup enters live state21 typing. Expiry enters report10 with calculated fields, report speech and music, then applies guarded progression once. Repeat and Welcome Continue use the in-memory record. A qualifying keyset4 stops with an explicitly labeled browser certificate-unavailable notice, preserving pre-call speed changes without post-call certificate or mode mutations. Manual Express does not write report history or autosave: the existing browser persistence adaptation applies to setup selections, separately from recovered in-memory report progression. Fixtures still supply rows and report strings independently. Pure tests exercise source arithmetic and supplied media vectors; browser tests exercise live typing, focus-event bindings, expiry, visible media failures, and separately labeled transport/composition vectors. Full-disc tests independently check all source frames, palettes, original selector placements/keys, the setup-list hash and all38 member identities against a separate joins pin. Browser checks compare the integrated original movie14 frame palette and original movie40/51 key pixels against their own frame palettes and saved DIB background. Synthetic transport vectors remain separate, not observations of all38 real movie playbacks. Browser checks cover all 15 setup combinations, indexed hotspots, name editing, duplicate alternatives, reload, persistence/load refusals and fixtures at root and prefix. Pixel tests independently compare glyph bits and every displayed typing/report pixel; overlay tests cover gates, wrap and restore. Screenshots and JUnit evidence stay ignored under `mario2/.tmp/`.

Existing Mario 1 storage and all three protected save keys remain untouched. Mario2 uses only `mtt2-static-translation.students.v1`, preserving opaque bytes in each 292-byte record. Malformed or inaccessible data visibly refuses persistence rather than resetting it.
