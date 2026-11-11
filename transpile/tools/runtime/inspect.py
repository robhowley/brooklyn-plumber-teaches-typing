"""Read ZIP members as inert data; trusted objdump static disassembly only."""
from pathlib import Path
import hashlib, json, re, struct, subprocess, zipfile
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'analysis/runtime'
OUT.mkdir(parents=True, exist_ok=True)
ARCHIVE = Path.home() / 'Downloads/Mario_Teaches_Typing_1992.zip'
sha = lambda b: hashlib.sha256(b).hexdigest()
archive = ARCHIVE.read_bytes()
assert sha(archive) == 'b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'
with zipfile.ZipFile(ARCHIVE) as z:
    member = 'MarioTea/MARIO/MARIO.EXE'
    exe = z.read(member)
    assert sha(exe) == '6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e'
    corpora = {}
    for prefix in 'HTBNS':
        for kind in ['LETTERS', 'WORDS', 'SENTENC']:
            name = f'MarioTea/MARIO/{prefix}{kind}.LEE'
            data = z.read(name)
            corpora[name] = dict(sha256=sha(data), hex=data.hex(), size=len(data))
(OUT / 'corpora.json').write_text(json.dumps(corpora, indent=2) + '\n')
# Each span begins on an independently identified routine/instruction boundary.
spans = {
    'arithmetic': (0x3309, 0x344a), 'random': (0x37be, 0x382d),
    'time': (0x39b8, 0x3a10), 'calendar': (0x7030, 0x715a),
    'timezone': (0x735e, 0x7630), 'corpus': (0x928b, 0x9693),
    'practice': (0xb0a6, 0xb89a), 'practice-lines': (0xb391, 0xb4d4),
    'seed-startup': (0x12661, 0x126c7),
    'outdoor-init': (0x1272e, 0x12cc3), 'obstacle': (0x12dbb, 0x12ee4),
    'outdoor-input': (0x13afc, 0x13d1b), 'fireworks': (0x13fdd, 0x14023),
    'title-random': (0xfefc, 0xff77), 'menu-random': (0x10b31, 0x10c27),
    'bonus-init': (0x14e54, 0x14f3d), 'stats-init': (0x15965, 0x15afb),
    'stats-dispatch-table': (0x164ac, 0x164dc), 'stats-reset': (0x15b8f, 0x15bac),
    'castle-bonus-input': (0xbdba, 0xbe83), 'castle-bonus-init': (0xd839, 0xd8eb),
    'water-bonus-init': (0x16bf5, 0x16ca5), 'water-bonus-move': (0x17560, 0x17683),
    'water-bonus-input': (0x17801, 0x17892),
}
def disassemble(lo, hi):
    code = exe[lo:hi]
    names = b'\x00.text\x00.shstrtab\x00'
    noff = 52 + len(code)
    shoff = (noff + len(names) + 3) & ~3
    hdr = b'\x7fELF' + bytes([1,1,1]) + bytes(9) + struct.pack('<HHIIIIIHHHHHH',1,3,1,0,0,shoff,0,52,0,0,40,3,2)
    sh = bytes(40) + struct.pack('<10I',1,1,6,lo,52,len(code),0,0,1,0) + struct.pack('<10I',7,3,0,0,noff,len(names),0,0,1,0)
    # Relocatable data wrapper has no program entry or executable permission.
    p = OUT / 'code.elf.data'
    p.write_bytes(hdr + code + names + bytes(shoff-noff-len(names)) + sh)
    r = subprocess.run(['objdump','-D','--triple=i386-unknown-unknown-code16','--x86-asm-syntax=intel',str(p)],capture_output=True,text=True,check=True)
    lines = []
    for line in r.stdout.split('Disassembly of section .text:')[1].split('Disassembly of section')[0].splitlines():
        m = re.match(r'\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} )+)',line)
        if not m: continue
        at = int(m[1],16); raw = bytes.fromhex(m[2])
        assert exe[at:at+len(raw)] == raw
        m = re.search(r'lcall\s+0x([0-9a-f]+), 0x([0-9a-f]+)',line)
        if m: line += f' ; FILE 0x{0x2e00+int(m[1],16)*16+int(m[2],16):05x}'
        lines.append(line)
    return lines
for name, (lo,hi) in spans.items():
    (OUT / f'{name}.asm.txt').write_text('\n'.join(disassemble(lo,hi)) + '\n')
all_lines = disassemble(0x2e00, 0x1f270)
refs = [l for l in all_lines if re.search(r'FILE 0x0(?:37f6|3807)|\[0x(?:5014|3c34|3c36|41b3|41b5)\]', l)]
(OUT / 'references.asm.txt').write_text('\n'.join(refs) + '\n')
(OUT / 'code.elf.data').unlink()
evidence = dict(archiveSha256=sha(archive), member=member, memberSha256=sha(exe),
    method='Inert ZIP data, focused code16 static disassembly, every printed instruction byte compared to ZIP. No original code run.',
    spans={k:dict(start=hex(a), endExclusive=hex(b), hex=exe[a:b].hex(), sha256=sha(exe[a:b])) for k,(a,b) in spans.items()},
    data={hex(ds):dict(file=hex(0x1f270+ds), hex=exe[0x1f270+ds:0x1f270+ds+n].hex()) for ds,n in [(0x3c34,4),(0x3d1e,12),(0x3d4c,17),(0x40aa,14),(0x41b3,4),(0x41c3,332)]})
(OUT / 'evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
print(json.dumps(dict(verifiedSpans=len(spans), corpora=len(corpora), references=len(refs), memberSha256=sha(exe))))
