"""Hash-pinned static UI inspection. Never executes any archive member."""
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.tmp/menu'
OUT.mkdir(parents=True, exist_ok=True)
archive = Path.home() / 'Downloads/Mario_Teaches_Typing_1992.zip'
assert hashlib.sha256(archive.read_bytes()).hexdigest() == 'b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'
with zipfile.ZipFile(archive) as z:
    b = z.read('MarioTea/MARIO/MARIO.EXE')
    members = {name: hashlib.sha256(z.read('MarioTea/MARIO/' + name)).hexdigest()
               for name in ('GREET2.GSO', 'GREET2.GSK', 'PREFS.CRX', 'LOAD.CRX', 'LESSTIME.CRX')}
assert hashlib.sha256(b).hexdigest() == '6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e'
ranges = {'text': (0x1aced, 0x1b41c), 'quit': (0x149fc, 0x14a8c),
          'delete': (0xe14e, 0xe65b), 'dropdown': (0x105cc, 0x1072f),
          'dropdown-draw': (0x11be8, 0x11d54), 'duration-draw': (0x8d66, 0x928b),
          'cursor-wait': (0x192a2, 0x192e2),
          'menu': (0x10ce3, 0x11a05), 'student': (0xebd2, 0xfb90),
          'pixel': (0x14fc8, 0x15000)}
for name, (a, e) in ranges.items():
    code = b[a:e]
    names = b'\0.text\0.shstrtab\0'
    noff = 52 + len(code)
    shoff = (noff + len(names) + 3) & ~3
    hdr = b'\x7fELF' + bytes([1, 1, 1]) + bytes(9) + struct.pack('<HHIIIIIHHHHHH', 1, 3, 1, 0, 0, shoff, 0, 52, 0, 0, 40, 3, 2)
    sh = bytes(40) + struct.pack('<10I', 1, 1, 6, a, 52, len(code), 0, 0, 1, 0) + struct.pack('<10I', 7, 3, 0, 0, noff, len(names), 0, 0, 1, 0)
    p = OUT / (name + '.elf.data')
    p.write_bytes(hdr + code + names + bytes(shoff - noff - len(names)) + sh)
    r = subprocess.run(['objdump', '-d', '--triple=i386-unknown-unknown-code16', '--x86-asm-syntax=intel', str(p)], capture_output=True, text=True, check=True)
    (OUT / (name + '.asm.txt')).write_text(r.stdout)
    p.unlink()
base = 0x1f270
tables = {name: list(struct.unpack('<' + 'h' * count, b[a:a + count * 2])) for name, a, count in [
    ('prefBoxXs', base + 0x231e, 3), ('durationRects', base + 0x256, 20), ('studentPointers', base + 0x2324, 12),
    ('chooserPointers', base + 0x233c, 4), ('studentKeys', 0xf583, 10),
    ('studentTargets', 0xf597, 10), ('chooserKeys', 0xfb64, 11),
    ('chooserTargets', 0xfb7a, 11), ('durationKeys', 0x9263, 10),
    ('durationTargets', 0x9277, 10), ('textKeys', 0x1b3c0, 23),
    ('textTargets', 0x1b3ee, 23)]}
(OUT / 'evidence.json').write_text(json.dumps({'exeSha256': hashlib.sha256(b).hexdigest(), 'members': members, 'tables': tables,
    'slices': {name: {'start': a, 'hex': b[a:e].hex()} for name, (a,e) in ranges.items()}}, indent=2) + '\n')
print(json.dumps(tables))
