"""Read ZIP as inert data; verify freshly generated listing bytes, never execute game code."""
from pathlib import Path
import hashlib, json, re, zipfile
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'analysis/control'
ARCHIVE = Path.home() / 'Downloads/Mario_Teaches_Typing_1992.zip'
EXPECTED = 'b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'
source = ROOT / 'analysis/worlds/disassembly.txt'
if not source.is_file():
    raise SystemExit('Missing generated listing: ' + str(source) +
                     '\nRun python3 -B transpile/tools/worlds/inspect.py from the repository root first.')
OUT.mkdir(parents=True, exist_ok=True)
h = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
assert h == EXPECTED
with zipfile.ZipFile(ARCHIVE) as z:
    b = z.read('MarioTea/MARIO/MARIO.EXE')
    members = [{ 'name': n, 'size': len(z.read(n)), 'sha256': hashlib.sha256(z.read(n)).hexdigest() } for n in z.namelist() if not n.endswith('/')]
lines = source.read_text().split('Disassembly of section .shstrtab:')[0].splitlines()
checked = 0
for line in lines:
    m = re.match(r'\s*([0-9a-f]+): ((?:[0-9a-f]{2} )+)', line)
    if m:
        off = int(m[1], 16); raw = bytes.fromhex(m[2])
        if off < 0x2e00: continue
        assert b[off:off+len(raw)] == raw, hex(off)
        checked += 1
if not checked:
    raise SystemExit('Generated listing contains no instruction bytes; rerun transpile/tools/worlds/inspect.py.')
(OUT / 'verified-disassembly.txt').write_text('\n'.join(lines)+'\n')
(OUT / 'identity.json').write_text(json.dumps({'archiveSha256':h,'member':'MarioTea/MARIO/MARIO.EXE','exeSha256':hashlib.sha256(b).hexdigest(),'size':len(b),'verifiedInstructionLines':checked,'members':members},indent=2)+'\n')
# Keep only requested byte slices, not an executable or a loadable image.
ranges = {'scoring':(0x15965,0x164a0),'menu-student':(0xdaf0,0x11b00),'startup':(0x7000,0x8000),'progression-outdoor':(0x13d20,0x13e40),'progression-water':(0x17dd0,0x17ed0),'progression-castle':(0xd9e0,0xdaf0),'results':(0x164dc,0x167fb),'student-through-main-loop':(0xe120,0x12244),'corpus-routing':(0x9280,0x9491),'duration-editor':(0x8d66,0x9263),'startup-entry':(0x1d89d,0x1d900),'startup-config':(0x125b9,0x12720),'menu-rectangle-table':(0x21708,0x21738),'duration-table':(0x1f4c6,0x1f4ee)}
(OUT/'byte-slices.json').write_text(json.dumps({k:{'start':hex(a),'endExclusive':hex(e),'hex':b[a:e].hex()} for k,(a,e) in ranges.items()},indent=2)+'\n')
print(json.dumps({'archiveSha256':h,'exeSha256':hashlib.sha256(b).hexdigest(),'verifiedInstructionLines':checked,'members':len(members)}))
