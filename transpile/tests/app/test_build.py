"""Integration resources are data, never original code execution."""
import base64
import hashlib
import json
from pathlib import Path
import runpy
import struct
import sys
import unittest
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/render'))
from decode import decode_ban

class AppDataTests(unittest.TestCase):
    def test_rebuild_is_identical(self):
        paths = [ROOT / 'app/data.json', *sorted((ROOT / 'assets/app').glob('*.indices'))]
        before = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
        runpy.run_path(str(ROOT / 'tools/build-app-data.py'), run_name='__main__')
        self.assertEqual(before, {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths})

    def test_all_bonus_backgrounds_are_persistent_decoded_packets(self):
        data = json.loads((ROOT / 'app/data.json').read_text())
        packets = json.loads((ROOT / 'assets/render/ban-packets.json').read_text())
        raw = ROOT / 'assets/original/raw/MarioTea/MARIO'
        for char in 'MLP':
            animation = data['bonusAnimations'][char.lower()]
            frames = (ROOT / animation['backgroundsPath']).read_bytes()
            background = bytearray((ROOT / 'assets/original/backgrounds/OUTSKY.indices.data').read_bytes())
            ban = (raw / (char + 'OUT.BAN.data')).read_bytes()
            ani = (raw / (char + 'OUT.ANI.data')).read_bytes()
            self.assertEqual(len(frames), len(animation['frames']) * 64000)
            for i, (packet, frame) in enumerate(zip(packets[char+'OUT.BAN'], animation['frames'], strict=True)):
                decode_ban(ban[packet['offset']:packet['end']] + b'\xff\xff', background)
                self.assertEqual(frames[i*64000:(i+1)*64000], background)
                self.assertEqual(struct.unpack_from('<hhI', ani, i*8), (frame['x'], frame['y'], frame['rasterOffset']))
                sprite = frame['sprite']
                start = frame['rasterOffset'] + 8
                self.assertEqual(base64.b64decode(sprite['pixels']), ani[start:start+sprite['width']*sprite['height']])

    def test_source_bindings_and_practice_font_map(self):
        exe = (ROOT / 'assets/original/raw/MarioTea/MARIO/MARIO.EXE.data').read_bytes()
        self.assertEqual(hashlib.sha256(exe).hexdigest(), '6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e')
        for offset, expected in [(0x12631,'b8c44f'), (0x12643,'b8b54f'), (0x14185,'c41ec04f'),
                                 (0x1a7ba,'c41ea55826c45f0b'), (0xb2f0,'c6060c2e0fc6060d2e00'),
                                 (0xb2fe,'c6060d2e01')]:
            self.assertEqual(exe[offset:offset+len(bytes.fromhex(expected))], bytes.fromhex(expected))
        self.assertEqual(exe[0x21ae9:0x21b02], b'outsky\x00mout.ban\x00mout.ani\x00')
        data = json.loads((ROOT / 'app/data.json').read_text())
        self.assertEqual(len(data['lessons']), 15)
        for name, sprite in data['sprites'].items():
            if name.startswith('FONT5H/'):
                self.assertTrue(set(base64.b64decode(sprite['pixels'])) <= {0,1})
                self.assertEqual(sprite['width'], 8)

if __name__ == '__main__': unittest.main()
