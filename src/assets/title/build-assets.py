#!/usr/bin/env python3
"""Build exact title stills and comparison evidence from two source frames.

Requires only Python's standard library. Override the defaults when the reference
frames are stored elsewhere, for example:
  python3 src/assets/title/build-assets.py --source /path/frame-00000400.png \
    --before /path/frame-00285.png
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SOURCE = ROOT / "artifacts/video-r-LxHUgI2W0/frames/frame-00000400.png"
DEFAULT_BEFORE = ROOT / "artifacts/title-still/timing/frames/frame-00285.png"
CROP = (0, 14, 720, 464)  # x0, y0, x1, y1 in the original 720x480 frames.
PATCH_SOURCE = (276, 16, 709, 94)  # Includes a small margin for subtitle shadows.
GLYPHS = [
    ("T", 279, 312), ("E", 312, 345), ("A", 345, 381),
    ("C", 381, 418), ("H", 418, 455), ("E", 455, 488),
    ("S", 488, 523), ("T", 531, 563), ("Y", 563, 592),
    ("P", 592, 622), ("I", 622, 636), ("N", 636, 673),
    ("G", 673, 706),
]
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def decode_png(path: Path) -> tuple[int, int, bytearray]:
    """Decode non-interlaced 8-bit RGB/RGBA PNGs without external libraries."""
    raw = path.read_bytes()
    if not raw.startswith(PNG_SIGNATURE):
        raise ValueError(f"Not a PNG: {path}")
    pos, compressed = len(PNG_SIGNATURE), bytearray()
    width = height = color_type = bit_depth = interlace = None
    while pos < len(raw):
        size = struct.unpack_from(">I", raw, pos)[0]
        kind = raw[pos + 4:pos + 8]
        data = raw[pos + 8:pos + 8 + size]
        pos += size + 12
        if kind == b"IHDR":
            width, height, bit_depth, color_type, compression, filtering, interlace = struct.unpack(
                ">IIBBBBB", data
            )
            if compression or filtering:
                raise ValueError(f"Unsupported PNG encoding: {path}")
        elif kind == b"IDAT":
            compressed.extend(data)
        elif kind == b"IEND":
            break
    if width is None or bit_depth != 8 or color_type not in (2, 6) or interlace != 0:
        raise ValueError(f"Expected a non-interlaced 8-bit RGB/RGBA PNG: {path}")
    bpp = 3 if color_type == 2 else 4
    stride = width * bpp
    scanlines = zlib.decompress(compressed)
    pixels = bytearray(height * stride)
    src = 0
    for y in range(height):
        filter_type = scanlines[src]
        src += 1
        row = bytearray(scanlines[src:src + stride])
        src += stride
        prev_start = (y - 1) * stride
        for x in range(stride):
            left = row[x - bpp] if x >= bpp else 0
            above = pixels[prev_start + x] if y else 0
            upper_left = pixels[prev_start + x - bpp] if y and x >= bpp else 0
            if filter_type == 1:
                predictor = left
            elif filter_type == 2:
                predictor = above
            elif filter_type == 3:
                predictor = (left + above) // 2
            elif filter_type == 4:
                p = left + above - upper_left
                pa, pb, pc = abs(p - left), abs(p - above), abs(p - upper_left)
                predictor = left if pa <= pb and pa <= pc else above if pb <= pc else upper_left
            elif filter_type == 0:
                predictor = 0
            else:
                raise ValueError(f"Unsupported PNG filter {filter_type}: {path}")
            row[x] = (row[x] + predictor) & 255
        pixels[y * stride:(y + 1) * stride] = row
    if color_type == 6:
        rgb = bytearray(width * height * 3)
        for i in range(width * height):
            rgb[i * 3:i * 3 + 3] = pixels[i * 4:i * 4 + 3]
        pixels = rgb
    return width, height, pixels


def encode_png(path: Path, width: int, height: int, pixels: bytes) -> None:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + kind + data +
                struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff))

    stride = width * 3
    filtered = bytearray()
    for y in range(height):
        filtered.append(0)
        filtered.extend(pixels[y * stride:(y + 1) * stride])
    png = (PNG_SIGNATURE + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) +
           chunk(b"IDAT", zlib.compress(filtered, 9)) + chunk(b"IEND", b""))
    path.write_bytes(png)


def crop(width: int, pixels: bytearray, rect: tuple[int, int, int, int]) -> bytearray:
    x0, y0, x1, y1 = rect
    out = bytearray((x1 - x0) * (y1 - y0) * 3)
    for row, y in enumerate(range(y0, y1)):
        start = (y * width + x0) * 3
        end = (y * width + x1) * 3
        out[row * (x1 - x0) * 3:(row + 1) * (x1 - x0) * 3] = pixels[start:end]
    return out


def paste(dst: bytearray, dst_width: int, src: bytearray, src_width: int,
          rect: tuple[int, int, int, int], y_offset: int = 0) -> None:
    x0, y0, x1, y1 = rect
    for y in range(y0, y1):
        dst_start = ((y - y_offset) * dst_width + x0) * 3
        src_start = (y * src_width + x0) * 3
        length = (x1 - x0) * 3
        dst[dst_start:dst_start + length] = src[src_start:src_start + length]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(source_path: Path, before_path: Path) -> None:
    source_w, source_h, source = decode_png(source_path)
    before_w, before_h, before = decode_png(before_path)
    if (source_w, source_h) != (720, 480) or (before_w, before_h) != (720, 480):
        raise ValueError("Both reference frames must be 720x480 RGB screenshots")

    x0, y0, x1, y1 = CROP
    out_w, out_h = x1 - x0, y1 - y0
    final = crop(source_w, source, CROP)
    base = bytearray(final)
    # The crop has y=14 removed, so apply the same source-frame rectangle at y-14.
    px0, py0, px1, py1 = PATCH_SOURCE
    patch = (px0, py0 - y0, px1, py1 - y0)
    paste(base, out_w, before, before_w, (px0, py0, px1, py1), y0)

    out_dir = ROOT / "src/assets/title"
    evidence_dir = ROOT / "artifacts/title-still/art"
    out_dir.mkdir(parents=True, exist_ok=True)
    evidence_dir.mkdir(parents=True, exist_ok=True)
    final_path, base_path = out_dir / "title.png", out_dir / "title-base.png"
    encode_png(final_path, out_w, out_h, final)
    encode_png(base_path, out_w, out_h, base)

    # Validate encoded outputs and the exact replacement boundaries before recording evidence.
    final_check = decode_png(final_path)
    base_check = decode_png(base_path)
    assert final_check == (out_w, out_h, final)
    assert base_check == (out_w, out_h, base)
    assert final == crop(source_w, source, CROP)
    for y in range(out_h):
        for x in range(out_w):
            i = (y * out_w + x) * 3
            if patch[0] <= x < patch[2] and patch[1] <= y < patch[3]:
                src_i = (y + y0) * before_w * 3 + x * 3
                assert base[i:i + 3] == before[src_i:src_i + 3]
            else:
                assert base[i:i + 3] == final[i:i + 3]

    layout = {
        "width": out_w,
        "height": out_h,
        "sourceCrop": {"x": x0, "y": y0, "width": out_w, "height": out_h},
        "coordinateNote": "Glyph rectangles are half-open [x, x+width) × [y, y+height), relative to title.png.",
        "glyphs": [
            {"index": i, "character": char, "rect": {"x": gx, "y": 20 - y0,
             "width": right - gx, "height": 70}}
            for i, (char, gx, right) in enumerate(GLYPHS)
        ],
        "baseReplacementRect": {
            "x": px0, "y": py0 - y0, "width": px1 - px0, "height": py1 - py0,
            "sourceFrameRect": {"x": px0, "y": py0, "width": px1 - px0, "height": py1 - py0},
            "reason": "Clean background rectangle with a small margin around subtitle and shadow; source and pre-letter frames share the same composition.",
        },
    }
    (out_dir / "title-layout.json").write_text(json.dumps(layout, indent=2) + "\n")

    source_evidence = evidence_dir / "title-source-frame.png"
    before_evidence = evidence_dir / "title-preletter-frame.png"
    shutil.copyfile(source_path, source_evidence)
    shutil.copyfile(before_path, before_evidence)
    html = '''<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Title still source and before/after evidence</title>
<style>body{margin:24px;background:#17131d;color:#f7edc2;font:16px system-ui,sans-serif}main{max-width:1100px;margin:auto}section{margin:24px 0;padding:16px;background:#28212f}img{display:block;max-width:100%;height:auto;border:1px solid #93859c}h1{font-size:24px}h2{font-size:18px;margin:0 0 10px}p{line-height:1.5}</style>
<main><h1>Title still source and before/after</h1>
<p>The final still is a direct crop of the source frame. The base changes only the subtitle rectangle, using the earlier same-scene frame. The runtime fades 13 image glyph crops over that base.</p>
<section><h2>Source, frame 400 (16.0 s), 720 × 480</h2><img src="title-source-frame.png" alt="Unmodified source screenshot"></section>
<section><h2>Before, frame 285 (11.4 s), 720 × 480</h2><img src="title-preletter-frame.png" alt="Same-composition frame before subtitle reveal"></section>
<section><h2>After, clean title base, 720 × 450</h2><img src="../../../src/assets/title/title-base.png" alt="Source crop with subtitle rectangle replaced from pre-letter background"></section>
<section><h2>Final reveal, title.png, 720 × 450</h2><img src="../../../src/assets/title/title.png" alt="Exact cropped source title screenshot"></section>
</main></html>
'''
    (evidence_dir / "title-source-before-after.html").write_text(html)

    # Count changes introduced by substituting the earlier compressed frame.
    changed_pixels = 0
    max_delta = 0
    for y in range(py0, py1):
        for x in range(px0, px1):
            a = (y * source_w + x) * 3
            b = (y * before_w + x) * 3
            deltas = [abs(source[a + c] - before[b + c]) for c in range(3)]
            changed_pixels += any(deltas)
            max_delta = max(max_delta, *deltas)

    provenance = {
        "asset": "Mario Teaches Typing title still and clean base",
        "method": "Deterministic crop and rectangular pixel replacement; no redraw, vectorization, thresholding, or per-pixel lettering mask.",
        "source": {
            "path": str(source_path),
            "frame": "frame-00000400.png",
            "timestampSeconds": 16.0,
            "dimensions": [source_w, source_h],
            "sha256": sha256(source_path),
            "video": "https://www.youtube.com/watch?v=r-LxHUgI2W0",
            "outputCrop": {"x": x0, "y": y0, "width": out_w, "height": out_h},
            "copyright": "The source's 1992 Interplay Productions and Nintendo copyright line is retained unchanged in title.png and title-base.png.",
        },
        "before": {
            "path": str(before_path),
            "frame": "frame-00285.png",
            "timestampSeconds": 11.4,
            "dimensions": [before_w, before_h],
            "sha256": sha256(before_path),
            "use": "Supplies pixels only in baseReplacementRect; this earlier H.264 frame can differ from the final frame due to video compression.",
        },
        "baseReplacementRect": layout["baseReplacementRect"],
        "comparison": {
            "changedPixelsWithinReplacementRect": changed_pixels,
            "maxPerChannelDifferenceBetweenSourceAndBefore": max_delta,
            "verification": "title.png decodes pixel-identical to the source crop; title-base.png equals title.png outside the replacement rectangle and the pre-letter frame inside it.",
            "evidence": "artifacts/title-still/art/title-source-before-after.html",
        },
        "outputs": {
            "src/assets/title/title.png": {"sha256": sha256(final_path), "dimensions": [out_w, out_h]},
            "src/assets/title/title-base.png": {"sha256": sha256(base_path), "dimensions": [out_w, out_h]},
            "src/assets/title/title-layout.json": "Thirteen subtitle glyph rectangles and replacement geometry.",
        },
        "limitations": [
            "Video compression differences remain in the clean base because the source and pre-letter frame are from different moments of the same lossy video.",
            "The rectangle is intended for a full-title reveal; per-letter reveal code can use title-layout.json glyph boxes. The background letters within it may show compression/timing differences during intermediate reveal states.",
        ],
    }
    (out_dir / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print(json.dumps({"title": str(final_path), "base": str(base_path), "layout": str(out_dir / "title-layout.json"),
                      "provenance": str(out_dir / "provenance.json"),
                      "comparison": str(evidence_dir / "title-source-before-after.html"),
                      "changedPixelsInReplacement": changed_pixels, "maxChannelDelta": max_delta}, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="Original final-reveal frame")
    parser.add_argument("--before", type=Path, default=DEFAULT_BEFORE, help="Matching pre-letter frame")
    args = parser.parse_args()
    build(args.source, args.before)


if __name__ == "__main__":
    main()
