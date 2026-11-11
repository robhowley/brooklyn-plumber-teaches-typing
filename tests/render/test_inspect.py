import sys
from pathlib import Path as _Path
sys.path.insert(0, str(_Path(__file__).resolve().parents[2] / 'tools'))
from source import archive_path
"""Check exact listing headers, bytes and provenance in distinct checkout paths."""
import hashlib
import pathlib
import runpy
import shutil
import struct
import subprocess
import tempfile
import unittest
import zipfile
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[2]
ARCHIVE = archive_path()


class InspectTests(unittest.TestCase):
    def test_listings_are_path_independent_without_changing_disassembly(self):
        self.assertEqual(hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
                         'b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd')
        with zipfile.ZipFile(ARCHIVE) as archive:
            exe = archive.read('MarioTea/MARIO/MARIO.EXE')
        self.assertEqual(hashlib.sha256(exe).hexdigest(),
                         '6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e')
        real_run = subprocess.run
        trees = []
        with tempfile.TemporaryDirectory(dir=ROOT / '.tmp') as temp:
            for checkout in ['first-checkout', 'different/second-checkout']:
                root = pathlib.Path(temp) / checkout
                for name in ['source.py', 'render/inspect.py', 'render/decode.py',
                             'control/startup-inspect.py', 'control/menu-inspect.py']:
                    dest = root / 'tools' / name
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(ROOT / 'tools' / name, dest)
                raw = []

                def objdump(args, **kwargs):
                    wrapper = pathlib.Path(args[-1])
                    data = wrapper.read_bytes()
                    section = struct.unpack_from('<I', data, 32)[0] + 40
                    address, offset, size = struct.unpack_from('<III', data, section + 12)
                    self.assertEqual(data[offset:offset + size], exe[address:address + size])
                    result = real_run(args, **kwargs)
                    header = f'\n{wrapper}:\tfile format '
                    self.assertEqual(result.stdout.count(header), 1)
                    raw.append(result.stdout.replace(header, f'\n{wrapper.name}:\tfile format ', 1))
                    return result

                with patch('subprocess.run', side_effect=objdump):
                    for name in ['render/inspect.py', 'control/startup-inspect.py', 'control/menu-inspect.py']:
                        runpy.run_path(str(root / 'tools' / name), run_name='__main__')
                listings = {str(p.relative_to(root)): p.read_text() for p in root.rglob('*.asm.txt')}
                self.assertEqual(len(listings), 38)
                self.assertEqual(sum(not p.startswith('.tmp/') for p in listings), 28)
                # Exact full text equals objdump output with only its known header replaced.
                self.assertCountEqual(listings.values(), raw)
                trees.append({str(p.relative_to(root)): p.read_bytes() for p in root.rglob('*')
                              if p.is_file() and not str(p.relative_to(root)).startswith('tools/')})
            self.assertEqual(trees[0], trees[1])


if __name__ == '__main__':
    unittest.main()
