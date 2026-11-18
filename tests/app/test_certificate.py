"""Certificate extraction and layout evidence, original members are inert data."""
import hashlib
import json
from pathlib import Path
import struct
import sys
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from source import ensure_archive, EXE_MEMBER, EXE_SHA256


class CertificateTests(unittest.TestCase):
    def test_bundled_art_messages_and_evidence_match_pinned_members(self):
        with zipfile.ZipFile(ensure_archive()) as archive:
            exe = archive.read(EXE_MEMBER)
            msd = archive.read('MarioTea/MARIO/ENGLISH.MSD')
        self.assertEqual(hashlib.sha256(exe).hexdigest(), EXE_SHA256)
        data = json.loads((ROOT / 'app/data.json').read_text())
        cert = data['certificate']
        self.assertEqual(cert, json.loads((ROOT / '.tmp/certificate-evidence.json').read_text()))
        self.assertEqual(cert['members'][EXE_MEMBER], EXE_SHA256)
        self.assertEqual(hashlib.sha256(msd).hexdigest(), cert['members']['MarioTea/MARIO/ENGLISH.MSD'])
        self.assertEqual(len(cert['art']), 31)
        for i, row in enumerate(cert['art']):
            offset, segment = struct.unpack_from('<HH', exe, 0x20d4e + i*4)
            start = 0x2e00 + 16*segment + offset
            self.assertEqual(row, dict(index=i, fileOffset=hex(start), text=exe[start:exe.index(0, start)].decode('ascii')))
        count = struct.unpack_from('<H', msd)[0]
        for resource in cert['resources']:
            key, offset = struct.unpack_from('<HH', msd, 4 + resource['index']*4)
            start = 4 + count*4 + offset
            self.assertEqual(resource['id'], key)
            self.assertEqual(resource['fileOffset'], hex(start))
            self.assertEqual(data['messages'][str(key)], msd[start:msd.index(0, start)].decode('ascii'))
        self.assertEqual([r['index'] for r in cert['resources']], [21,22,23,96,97,98,99,100,101])
        # Verified FILE instructions: completed-only gates, row count, border
        # endpoints, 31 art entries, center 40/22, text start 41 and level id+199.
        for offset, raw in [(0xac46,'80bcce5000'),(0xad23,'80bcce5000'),
                            (0xa96d,'83fe3c'),(0xa9ec,'83fe3c'),
                            (0xaedf,'bf1f00'),(0xb036,'83fe4e'),(0xb061,'83fe3a'),
                            (0xb085,'b81600'),(0xb089,'b82800'),(0xb093,'b82900'),
                            (0xeefe,'05c700'),(0xaaae,'d1e8')]:
            self.assertEqual(exe[offset:offset+len(bytes.fromhex(raw))], bytes.fromhex(raw), hex(offset))
        self.assertGreater(cert['verifiedInstructionLines'], 800)
