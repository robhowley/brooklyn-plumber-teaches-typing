"""Static disassembly of hash-pinned archive bytes, never executable loading."""
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[1]))
from source import archive_path, objdump

import hashlib, json, pathlib, struct, subprocess, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[2]
ARCHIVE = archive_path()
SHA = 'b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'

def disassemble(data, start, end):
    code = data[start:end]
    names = b'\0.text\0.shstrtab\0'
    noff = 52 + len(code)
    shoff = (noff + len(names) + 3) & ~3
    header = b'\x7fELF' + bytes([1,1,1]) + bytes(9) + struct.pack('<HHIIIIIHHHHHH',1,3,1,0,0,shoff,0,52,0,0,40,3,2)
    sections = bytes(40) + struct.pack('<10I',1,1,6,start,52,len(code),0,0,1,0) + struct.pack('<10I',7,3,0,0,noff,len(names),0,0,1,0)
    tmp = ROOT / '.tmp/render-section.elf.data'
    tmp.parent.mkdir(parents=True, exist_ok=True)
    tmp.write_bytes(header + code + names + bytes(shoff-noff-len(names)) + sections)
    result = subprocess.run([objdump(),'-D','--triple=i386-unknown-unknown-code16','--x86-asm-syntax=intel',str(tmp)],capture_output=True,text=True,check=True)
    tmp.unlink()
    return result.stdout.replace(f'\n{tmp}:\tfile format ', f'\n{tmp.name}:\tfile format ', 1)

if __name__ == '__main__':
    assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() == SHA
    with zipfile.ZipFile(ARCHIVE) as z:
        data = z.read('MarioTea/MARIO/MARIO.EXE')
    out = ROOT / 'analysis/render'
    out.mkdir(parents=True, exist_ok=True)
    spans = [(0x73d0,0x8740),(0x9790,0x99fa),(0x9940,0xa800),(0x1a000,0x1b100),(0x1272e,0x12cc3),(0x1413d,0x143c1),(0x151f8,0x1532e),(0x14a8c,0x14b6d),(0x1470c,0x14741),(0x192a2,0x192e2),(0x1f304,0x1f30c),(0x1f582,0x1f6c2),(0x219e7,0x219f2),(0x21b91,0x21ba1),(0x1d610,0x1d814)]
    evidence = {'archiveSha256':SHA,'member':'MarioTea/MARIO/MARIO.EXE','sha256':hashlib.sha256(data).hexdigest(),'spans':[]}
    for start,end in spans:
        if start < 0x1f270:
            (out / f'{start:05x}.asm.txt').write_text(disassemble(data,start,end))
        evidence['spans'].append({'start':hex(start),'endExclusive':hex(end),'bytes':data[start:end].hex()})
    (out/'evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
