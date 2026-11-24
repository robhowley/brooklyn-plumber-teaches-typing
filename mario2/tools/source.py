"""Pinned inert ISO reads. No download, mount, installer or executable invocation."""
import hashlib
import os
from pathlib import Path
import struct

DEFAULT_ISO = Path.home() / 'Downloads/Mario Teaches Typing 2 (1997)(Interplay)[Mac-PC].iso'


def check(data, pin, label):
    if len(data) != pin['size'] or hashlib.sha256(data).hexdigest() != pin['sha256']:
        raise ValueError(f'{label}: size/hash pin mismatch')
    return data


class Source:
    def __init__(self, pins, path=None):
        self.path = Path(path or os.environ.get('MARIO2_ISO', DEFAULT_ISO))
        self.file = self.path.open('rb')
        try:
            digest = hashlib.file_digest(self.file, 'sha256').hexdigest()
            if self.path.stat().st_size != pins['iso']['size'] or digest != pins['iso']['sha256']:
                raise ValueError('ISO: size/hash pin mismatch')
        except BaseException:
            self.file.close()
            raise

    def read(self, pin):
        result = bytearray()
        for extent in pin['image_extents']:
            offset, length = extent['image_offset'], extent['length']
            if offset < 0 or length < 0 or length > pin['size']:
                raise ValueError('invalid source extent')
            self.file.seek(offset)
            result.extend(self.file.read(length))
        return check(bytes(result), pin, pin['path'])

    def close(self):
        self.file.close()


def expand_szdd(data):
    if data[:9] != b'SZDD\x88\xf0\x27\x33A':
        raise ValueError('SZDD signature')
    expected = struct.unpack_from('<I', data, 10)[0]
    if not 0 < expected <= 65536:
        raise ValueError('SZDD output bound')
    ring = bytearray(b' ' * 4096)
    dst, p, out = 4080, 14, bytearray()
    while len(out) < expected:
        flags = data[p]
        p += 1
        for bit in range(8):
            if len(out) == expected:
                break
            if flags & (1 << bit):
                value = data[p]
                p += 1
                out.append(value)
                ring[dst] = value
                dst = (dst + 1) & 4095
            else:
                lo, hi = data[p:p+2]
                p += 2
                src, count = lo | ((hi & 240) << 4), (hi & 15) + 3
                if len(out) + count > expected:
                    raise ValueError('SZDD output overrun')
                for _ in range(count):
                    value = ring[src]
                    src = (src + 1) & 4095
                    out.append(value)
                    ring[dst] = value
                    dst = (dst + 1) & 4095
    if p != len(data):
        raise ValueError('SZDD trailing data')
    return bytes(out)


def normalize_lesson(data):
    # WINMARIO lesson loader/normalizer, analyzed as data in WINDATA.
    out, offsets = bytearray(), []
    for p, value in enumerate(data):
        value &= 127
        if value == 126:
            continue
        if value in (9, 10, 13):
            value = 32
        if value == 32 and out[-1:] == b' ':
            continue
        out.append(value)
        offsets.append(p)
    return bytes(out), offsets
