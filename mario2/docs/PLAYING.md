# Mario 2 loading contract

This phase supplies assets, not a playable browser application. Build with [DEVELOPMENT.md](DEVELOPMENT.md). The following IDs and shapes are frozen for the upcoming renderer/media implementation.

## Load by ID, not filename resemblance

Fetch `assets.json` relative to the app's deployment base URL. It has `schema: "mario2-assets.v1"`, `assets`, `font` and `lessons`. Resolve every relative `files` URL against the manifest URL, never `/` or the page pathname. This supports both domain-root and project-prefix deployments. Non-OK fetches, missing IDs and wrong schema are load failures, not substitute artwork. Browser failure/skip policy is not implemented here.

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

Native pixel/audio decoding is recovered behavior. Browser composition, asynchronous scheduling, media errors/autoplay, palette endpoints and UI adaptation remain separate work. The terminal Express certificate text is unknown due to the source's malformed far pointer; these assets do not invent a certificate or successful terminal outcome.
