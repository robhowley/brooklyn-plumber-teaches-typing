#!/usr/bin/env python3
"""Verify static listings against ZIP bytes, never load or execute archive code."""
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[1]))
from source import archive_path, objdump

from pathlib import Path
import hashlib
import json
import re
import struct
import zipfile

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = archive_path()
EXE = 'MarioTea/MARIO/MARIO.EXE'

def inspect():
    assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() == 'b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'
    with zipfile.ZipFile(ARCHIVE) as archive:
        data = archive.read(EXE)
        members = {name: hashlib.sha256(archive.read('MarioTea/MARIO/' + name)).hexdigest()
                   for name in ['WATER.GSO', 'WATER.GSK', 'WATER.CRX']}
    digest = hashlib.sha256(data).hexdigest()
    assert digest == '6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e'
    counts = {}
    for name in ['water.asm.txt', 'disassembly.txt']:
        count = 0
        for line in (ROOT / 'analysis/worlds' / name).read_text().splitlines():
            match = re.match(r'^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} )+)', line)
            if not match:
                continue
            offset = int(match[1], 16)
            code = bytes.fromhex(match[2])
            assert data[offset:offset + len(code)] == code, hex(offset)
            count += 1
        assert count > 2000
        counts[name] = count
    retained = {hex(ds): struct.unpack_from('<h', data, 0x1f270 + ds)[0]
                for ds in [0x4c1a, 0x4c1d, 0x4c33, 0x4c35, 0x4c37, 0x4c39]}
    result = {'member': EXE, 'sha256': digest, 'resourceHashes': members, 'verifiedInstructions': counts,
              'initializedRetainedWords': retained,
              'bubbleSources': list(struct.unpack_from('<20h', data, 0x21cdc))}
    destination = ROOT / '.tmp/water-evidence.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))

if __name__ == '__main__':
    inspect()
