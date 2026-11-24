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
        # State6 switch entry -> 03:4406 -> DS:02c2, FILE 0x202c2.
        self.assertEqual(struct.unpack_from('<H',b,0x17584+2*6)[0],0x4406)
        self.assertEqual(b[0x17606:0x17609].hex(),'b8c202')
        self.assertEqual(struct.unpack_from('<6h',b,0x202c2),(30,410,253,468,1,0))
        # Original static operands: source scroll rectangles precede row division.
        self.assertEqual(b[0x3c87:0x3c93].hex(),'81fe4d027c2581fe64027f1f')
        self.assertEqual(struct.unpack_from('<6h',b,0x2008e),(216,115,378,171,39,28))
        self.assertEqual(b[0x17684:0x17697].hex(),'26837c0a1c750cc41e1e262683bfca0000741f')
        for key, start in [('characters',0x20eb6),('worlds',0x20ec2)]:
            for i, value in enumerate(result['students'][key]):
                p=0x13200+struct.unpack_from('<H',b,start+4*i)[0]
                self.assertEqual(value,b[p:b.index(0,p)].decode('ascii'))
        for pointer,value in result['students']['labels'].items():
            p=0x13200+int(pointer,16)
            self.assertEqual(value,b[p:b.index(0,p)].decode('ascii'))
        # Independent resource108 DIB identity and used palette index, not a setup substitute.
        import hashlib
        self.assertEqual(hashlib.sha256(b[0x1a1400:0x1a1400+308736]).hexdigest(),
                         '19c45e592c3bba834e87fb1afe699dcae735ffb35eba1d3b09c73f2e607c5cc7')
        self.assertEqual(struct.unpack_from('<IiiHH',b,0x1a1400),(40,640,480,1,8))
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
