"""Static-only ZIP byte inspection. Never loads or runs archive code."""
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[1]))
from source import archive_path, objdump

import pathlib, zipfile, hashlib, struct, subprocess, json, re
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'analysis/worlds'; OUT.mkdir(parents=True,exist_ok=True)
zpath=archive_path()
sha=lambda b: hashlib.sha256(b).hexdigest()
assert sha(zpath.read_bytes())=='b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'
with zipfile.ZipFile(zpath) as z:
    name=next(n for n in z.namelist() if n.endswith('/MARIO.EXE'))
    b=z.read(name)
    manifest=[{'member':n,'sha256':sha(z.read(n)),'size':len(z.read(n))} for n in z.namelist() if not n.endswith('/')]
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
start=struct.unpack_from('<H',b,8)[0]*16
assert start==0x2e00
end=0x1f270; code=b[start:end]; names=b'\x00.text\x00.shstrtab\x00'; off=52; noff=off+len(code); shoff=(noff+len(names)+3)&~3
hdr=b'\x7fELF'+bytes([1,1,1])+bytes(9)+struct.pack('<HHIIIIIHHHHHH',1,3,1,0,0,shoff,0,52,0,0,40,3,2)
sh=bytes(40)+struct.pack('<10I',1,1,6,start,off,len(code),0,0,1,0)+struct.pack('<10I',7,3,0,0,noff,len(names),0,0,1,0)
p=OUT/'code.elf.data'; p.write_bytes(hdr+code+names+bytes(shoff-noff-len(names))+sh)
r=subprocess.run([objdump(),'-D','--triple=i386-unknown-unknown-code16','--x86-asm-syntax=intel',str(p)],capture_output=True,text=True,check=True)
notes={
 0xb10f:'PRACTICE: temporarily select corpus by goal thresholds10/30 before restoring mode4.',
 0xb502:'PRACTICE: subtract last CORRECT time, not last keyboard time; >15 chooses resource101.',
 0xb73d:'PRACTICE: accept32..127 or CR13. Later LF test is unreachable through this gate.',
 0xbc7e:'CASTLE: only operation2 checks accuracy/inactivity failure.',
 0xbe83:'CASTLE: printable range32..126; DS:46d9 suppresses scoring while locked.',
 0xbf30:'CASTLE: text progress target; IMUL then CWD discards high product before IDIV.',
 0xc451:'ROCKFACE: state0 starts when actorX<=old playerX; no hitbox test.',
 0xc49b:'ROCKFACE: signed byte y table DS:216e, indexed by state1..32.',
 0xc7f3:'CASTLE MOVEMENT: desired=trunc((target-x)/4)+1; clamp and approach by1.',
 0xcd7a:'SAND: speed-derived y position and one-pixel forward approach to text target.',
 0x17013:'BUBBLE: x+=dx; y+=trunc(dy/8)-1; decrement dy AFTER calculating y.',
 0x1715b:'PURSUER: gap=trunc((160-playerY)/2), signed16 division toward zero.',
 0x17293:'PURSUER: toggle mode on backwards coordinate jump; new mode affects NEXT sprite selection.',
 0x17356:'SWIMMER: yTarget=157-trunc(signed16(WPM*63)/peak); use low16 product.',
 0x1739c:'SWIMMER: delay decrements; expiration advances x and resets delay from OLD y.',
 0x17724:'WATER INACTIVITY: set failure and phase1; saved swimmer y feeds pursuer failure animation.',
 0x17892:'WATER: ordinary input32..127; exact compare, unlike outdoor uppercase behavior.',
 0x17943:'WATER: pending keyboard input skips stats/movement/render update block.'
}
lines=[]
for line in r.stdout.split('Disassembly of section .text:')[1].split('Disassembly of section')[0].splitlines():
    m=re.match(r'\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} )+)',line)
    if m:
        at=int(m[1],16); raw=bytes.fromhex(m[2]); assert b[at:at+len(raw)]==raw
        if at in notes: line += ' ; NOTE: '+notes[at]
    m=re.search(r'lcall\s+0x([0-9a-f]+), 0x([0-9a-f]+)',line)
    if m: line+=f' ; FILE {start+int(m[1],16)*16+int(m[2],16):05x}'
    lines.append(line)
(OUT/'disassembly.txt').write_text('\n'.join(lines)+'\n')
for label,lo,hi in [('castle',0xb89a,0xe14e),('water',0x167f3,0x17fa4),('practice',0xb0a6,0xb89a),('corpus',0x09280,0x09710)]:
    selected=[l for l in lines if (m:=re.match(r'\s*([0-9a-f]+):',l)) and lo<=int(m[1],16)<hi]
    (OUT/f'{label}.asm.txt').write_text('\n'.join(selected)+'\n')
identity={'archiveSha256':sha(zpath.read_bytes()),'member':name,'sha256':sha(b),'headerBytes':start,'dsFileBase':'0x1f270','instructionsByteVerified':True,'method':'ZIP byte read and static code16 disassembly only; linear data is not proven executable'}
(OUT/'identity.json').write_text(json.dumps(identity,indent=2)+'\n')
print(json.dumps(identity))
