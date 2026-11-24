"""Independent original-byte checks. The disc is read as inert data only."""
import copy
import json
import os
from pathlib import Path
import struct
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'tools'))
from presentation import decode_presentation
from source import Source

PINS = json.loads((ROOT/'presentation-pins.json').read_text())


class PresentationTests(unittest.TestCase):
    def test_wrong_executable_refused(self):
        with self.assertRaisesRegex(ValueError, 'executable hash'):
            decode_presentation(b'not original code', PINS)

    @unittest.skipUnless(os.environ.get('MARIO2_TEST_ISO'), 'set MARIO2_TEST_ISO')
    def test_original_tables_independently(self):
        pins = json.loads((ROOT/'pins.json').read_text())
        source = Source(pins, Path(os.environ['MARIO2_TEST_ISO']))
        try:
            b = source.read(pins['executable'])
        finally:
            source.close()
        result = decode_presentation(b, PINS)
        self.assertEqual(bytes(result['nameKeyFlags']), b[0x2273f:0x2283f])
        self.assertEqual(bytes(result['fingers']['mapping']), b[0x20bc0:0x20c40])
        for pin in PINS['overlays']:
            off = pin['file_offset']
            rows = result['overlays'][str(pin['state'])]['rows']
            for row in rows:
                values = [int.from_bytes(b[off+i:off+i+2], 'little', signed=True) for i in range(0,54,2)]
                self.assertEqual(row['destination'], values[:4])
                self.assertEqual((row['current'],row['last']), tuple(values[4:6]))
                triples = []
                for i in range(6,27,3):
                    if values[i+2]<0:
                        break
                    triples.append(dict(x=values[i], y=values[i+1], tick=values[i+2]))
                self.assertEqual(row['frames'], triples)
                off += 54
            self.assertEqual(int.from_bytes(b[off:off+2], 'little', signed=True), -1)
        for i, text in enumerate(result['report']['formats']):
            pointer = struct.unpack_from('<H', b, 0x20808+4*i)[0]+0x13200
            self.assertEqual(text, b[pointer:b.index(0,pointer)].decode('ascii'))
        bad = copy.deepcopy(PINS)
        bad['slices']['fingerMap']['file_offset'] += 1
        with self.assertRaisesRegex(ValueError, 'slice mismatch'):
            decode_presentation(b,bad)
