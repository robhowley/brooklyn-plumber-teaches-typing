# Mario 2: setup and renderer fixtures

Build and serve with [DEVELOPMENT.md](DEVELOPMENT.md). This iteration implements setup, not typing.

## Controls and saves

1. Click New student on the source screen or the matching accessible button.
2. Choose Mario, Princess or Luigi. Type a name, up to eight accepted bytes. Backspace edits, Enter confirms; blank becomes NONAME.
3. If the name exists, OK replaces its record; Cancel returns to editing. These labels match RT_DIALOG626, not a guessed Yes/No dialog.
4. Choose lesson plan, Express, then Home, Top, Bottom, Numbers or Symbols.
5. State21 visibly stops here. Typing is unimplemented in this setup and renderer preview. No results, progression or terminal certificate are invented.

Reload retains the current student and setup selections. Continue resumes an ordinary Express handoff. This immediate selection persistence is a browser adaptation, not proof of original manual Express save timing. Saves use only `mtt2-static-translation.students.v1` with the `mario2-students.v1` envelope. The original app's three save keys are never read, changed, imported or deleted. A visible Persistence refused message means the setup was not saved; existing malformed data is not reset or overwritten.

Open Renderer fixtures for supplied typing rows, hand cues and report strings. These are presentation examples, not a playable lesson or calculated report. Deliver one overlay visit applies one source-table visit with gates open; some visits have no visible frame. Return to setup restores its screen. No autonomous timer, movie playback, audio or typing progression runs.

Indexed backdrops and atlases, source glyphs, overlay tables and hand maps come from pinned executable FILE ranges in `pins.json` and `presentation-pins.json`. Browser adaptations are explicit palette endpoints (10 low and 10 high Windows-style colors), nearest-neighbor scaling, accessible buttons and an HTML duplicate dialog. Historical OS palette equality is unsupported. Missing assets fail visibly, without replacement art.

## Runtime loading contract

The following IDs and shapes remain the asset contract for later media implementation.

## Load by ID, not filename resemblance

Fetch `assets.json` relative to the app's deployment base URL. It has `schema: "mario2-assets.v1"`, `assets`, `font` and `lessons`. Resolve every relative `files` URL against the manifest URL, never `/` or the page pathname. This supports both domain-root and project-prefix deployments. Non-OK fetches, missing IDs and wrong schema are load failures, not substitute artwork. The entrypoint displays load refusal on failure; it does not substitute missing assets.

Each asset entry has `files` (artifact name to relative URL), `data` (decoded metadata), `placement` and `source` (member name/hash and executable FILE offset where applicable). Files are deduplicated by member SHA256 under `decoded/<sha256>/`; callers must use the manifest, not construct those paths. No raw source members are served.

| IDs | Contents |
| --- | --- |
| `ne-2-103`, `ne-2-619` | Welcome without/with current name |
| `ne-2-104`, `ne-2-105`, `ne-2-106`, `ne-2-107` | Character, name, lesson-plan, mode backdrops |
| `ne-2-119`, `ne-2-123`, `ne-2-112` | Keyset, typing, report backdrops |
| `ne-2-599`, `ne-2-600`, `ne-2-601`, `ne-2-608`, `ne-2-609`, `ne-2-610` | Menu atlases |
| `ne-2-152` through `ne-2-163` | Ten finger cues, left hand, right hand |
| `ne-5-102`, `ne-5-624`, `ne-5-626` | Shell, quit, duplicate-name dialog metadata |
| `ne-12-118`, `ne-1-2` | Cursor group and cursor image/mask, hotspot (6,1) |
| `ne-14-2`, `ne-3-1` | Icon group and icon image/mask |
| `movies-14`, `movies-15`, `movies-16` through `movies-19`, `movies-21` through `movies-42` | All setup/welcome/quit selections, including every randomized setup choice |
| `movies-51` through `movies-54`, `movies-56` through `movies-61` | Ordinary report selections |
| `audio-1`, `audio-5`, `audio-7`, `audio-8` | MIDI events (menu, typing, report branches) |
| `audio-10` | Click PCM from WAVEFILE resource 499 |

There is no movie 20, 50 or 55 in this contract. Total: 34 NE resources, 38 movies, five audio selectors. Font and lessons are additional entries, not part of 77.

## Pixel and media data

- `pixels.zlib` inflates to one byte per indexed pixel, top-down, tightly packed without DIB padding. `data.image` retains width, height, signed source height, palette RGB and original BGR0 bytes. These are indices, not RGBA.
- Atlas/hand indices use the active backdrop palette. Do not recolor the scene using the atlas palette. Historical GDI system palette realization is not recovered by these data.
- Cursor/icon `and-mask.zlib` inflates to one byte per pixel (0 or 1). `pixels.zlib` is the XOR index plane. The cursor hotspot is in `data.hotspot`. Preserve AND/XOR semantics, not alpha inference.
- Movies have `files["frames.zlib"]`, `data.streams` and `data.decoded_frames`. Each frame has `output_offset`, `compressed_bytes`, `decoded_bytes`, `decoded_sha256`, width/height, `palette_rgb_hex` and rational `time: [numerator, denominator]` in seconds. Slice the compressed file first, then inflate that independent zlib stream. Never decompress the concatenated file as one image array.
- Frames remain indexed. Movie `placement.field_u16_2`/`field_u16_4` are destination x/y; `placement.byte6` is the transparent **index**, not an RGB color. Restore the bound background before compositing each frame. Movie 14 uses key 245, ordinary reports key 10.
- Movie PCM uses `stream-<index>-audio.wav`; stream metadata retains start, scale, rate and PCM format. WAV is uncompressed browser-loadable PCM. No synthesized speech or transcoded replacement video is supplied.
- MIDI `events.json` contains tracks with ordered tick/delta/status/data events and tempo metadata. `data.division` and `division_mode` describe timing. Events are decoded, not synthesized. A browser music implementation still needs an explicitly chosen instrument/playback adaptation.
- Dialog/group metadata retains native fields and resource references. No replacement browser UI behavior is implied.

## Font and lessons

`font.url` is `font.bin`, exactly 1,024 bytes from WINMARIO FILE `0x1fa00..0x1fe00` (segment 4 offset 0). It contains 128 glyphs, eight bytes per glyph, rows top-down, bit 7 leftmost. A glyph row is byte `character*8+row`. This is the game font, not an OS font. Controls and bytes 128..255 do not gain invented Unicode glyphs.

`lessons` has `lesson-h`, `lesson-t`, `lesson-b`, `lesson-n`, `lesson-s` in keyset order (home, top, bottom, numbers, symbols). Each contains `normalized`, `tokens` and `source_sha256`. Every token has `text` and `raw_file_offsets` into its expanded external `.LEE` member. Normalization clears bit 7, removes tilde markers, converts tab/CR/LF to spaces and collapses repeated spaces. Tokens exclude bytes 0..32. No row packing, RNG or lesson progression is invented here. The external files are the gameplay input; embedded LESSON resources are not substituted.

Native pixel/audio decoding is recovered behavior. Browser composition, palette endpoints and setup UI adaptations are described above. Media scheduling, playback errors and autoplay remain later work. The terminal Express certificate text is unknown due to the source's malformed far pointer; these assets do not invent a certificate or successful terminal outcome.
