"""Browser artwork from the hash-pinned README still, not reconstructed game art."""
from pathlib import Path
import struct
import zlib

from source import ROOT, TITLE_SIZE, ensure_title

# Source: source.TITLE_URL / TITLE_SHA256, 720x450, 8-bit RGB, non-interlaced.
# Browser adaptation: square around Mario's red cap and face, excluding Luigi.
# Rectangle uses (left, top, width, height), in source pixels.
MARIO_CROP = (36, 96, 184, 184)
SIGNATURE = b'\x89PNG\r\n\x1a\n'


def read_rgb(data, size=TITLE_SIZE):
    """Decode the pinned PNG's RGB8 format (all five PNG row filters)."""
    width, height = size
    header = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    if data[:8] != SIGNATURE or data[12:16] != b'IHDR' or data[16:29] != header:
        raise ValueError('Expected non-interlaced RGB8 PNG with pinned dimensions')
    compressed = bytearray()
    offset = 8
    while offset < len(data):
        length = int.from_bytes(data[offset:offset + 4], 'big')
        if data[offset + 4:offset + 8] == b'IDAT':
            compressed.extend(data[offset + 8:offset + 8 + length])
        offset += length + 12
    raw = zlib.decompress(compressed)
    stride = width * 3
    if len(raw) != (stride + 1) * height:
        raise ValueError('Unexpected PNG scanline size')
    pixels = bytearray()
    previous = bytearray(stride)
    for y in range(height):
        start = y * (stride + 1)
        kind = raw[start]
        if kind > 4:
            raise ValueError('Unknown PNG filter')
        row = bytearray(raw[start + 1:start + 1 + stride])
        for i in range(stride):
            left = row[i - 3] if i >= 3 else 0
            above = previous[i]
            corner = previous[i - 3] if i >= 3 else 0
            if kind == 4:
                p = left + above - corner
                distances = (abs(p - left), abs(p - above), abs(p - corner))
                prediction = (left, above, corner)[distances.index(min(distances))]
            else:
                prediction = (0, left, above, (left + above) // 2)[kind]
            row[i] = (row[i] + prediction) & 255
        pixels.extend(row)
        previous = row
    return bytes(pixels)


def rgb_png(width, height, pixels):
    # tools/assets/pipeline.py:png writes indexed palettes only, not this RGB still.
    def chunk(kind, payload):
        return (struct.pack('>I', len(payload)) + kind + payload
                + struct.pack('>I', zlib.crc32(kind + payload) & 0xffffffff))
    stride = width * 3
    if len(pixels) != stride * height:
        raise ValueError('PNG geometry')
    scanlines = b''.join(b'\0' + pixels[y * stride:(y + 1) * stride] for y in range(height))
    return (SIGNATURE + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(scanlines, 9)) + chunk(b'IEND', b''))


def generate(root=ROOT):
    data = ensure_title().read_bytes()  # Hash verified before decoding.
    pixels = read_rgb(data)
    x, y, width, height = MARIO_CROP
    stride = TITLE_SIZE[0] * 3
    crop = b''.join(pixels[row * stride + x * 3:row * stride + (x + width) * 3]
                    for row in range(y, y + height))
    favicon = rgb_png(width, height, crop)
    target = Path(root) / 'assets/site'
    target.mkdir(parents=True, exist_ok=True)
    (target / 'social-preview.png').write_bytes(data)  # Exact README PNG, no re-encoding.
    (target / 'favicon.png').write_bytes(favicon)
