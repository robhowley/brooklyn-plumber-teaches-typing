"""Read-only byte verification for the authored Castle controller. Never executes archive code."""
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[1]))
from source import archive_path, objdump

import hashlib
import json
from pathlib import Path
import re
import struct
import zipfile

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = archive_path()
MEMBER = 'MarioTea/MARIO/MARIO.EXE'
ZIP_HASH = 'b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'
EXE_HASH = '6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e'

def inspect():
    assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() == ZIP_HASH
    with zipfile.ZipFile(ARCHIVE) as archive:
        exe = archive.read(MEMBER)
    assert hashlib.sha256(exe).hexdigest() == EXE_HASH
    count = 0
    for line in (ROOT / 'analysis/worlds/castle.asm.txt').read_text().splitlines():
        match = re.match(r'\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} )+)', line)
        if not match:
            continue
        offset = int(match[1], 16)
        data = bytes.fromhex(match[2])
        assert exe[offset:offset + len(data)] == data, hex(offset)
        count += 1
    assert count > 3000
    # DS:431e and 4322 are separate static observed-second values, not entry resets.
    base = 0x1f270
    return {'member': MEMBER, 'sha256': EXE_HASH, 'verifiedInstructions': count,
            'bonusXs': list(struct.unpack_from('<3h', exe, base + 0x2144)),
            'rockSecond': struct.unpack_from('<i', exe, base + 0x431e)[0],
            'sandSecond': struct.unpack_from('<i', exe, base + 0x4322)[0],
            'padding': list(exe[base + 0x2208:base + 0x2211])}

if __name__ == '__main__':
    print(json.dumps(inspect()))
