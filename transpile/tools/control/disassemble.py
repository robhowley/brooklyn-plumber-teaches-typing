"""Trusted LLVM static disassembly of inert byte slices at known entry points."""
import zipfile,struct,subprocess,hashlib
from pathlib import Path
O=Path(__file__).resolve().parents[2]/'analysis/control'
with zipfile.ZipFile(Path.home()/'Downloads/Mario_Teaches_Typing_1992.zip') as z: b=z.read('MarioTea/MARIO/MARIO.EXE')
assert hashlib.sha256(b).hexdigest()=='6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e'
for name,a,e in [('title-entry',0xfb90,0x103be),('startup-entry',0x1d89d,0x1d900),('startup-config',0x125b9,0x12720),('boot-menu',0x11afb,0x11be8),('timer-duration',0x12c90,0x12cc3),('lesson-duration-edit',0x8e59,0x9263),('corpus-loader',0x928b,0x9485),('ending',0xdf46,0xe120),('score-fresh',0x15965,0x15d77),('results-fresh',0x164dc,0x167bb)]:
 code=b[a:e]; names=b'\0.text\0.shstrtab\0'; noff=52+len(code); shoff=(noff+len(names)+3)&~3
 hdr=b'\x7fELF'+bytes([1,1,1])+bytes(9)+struct.pack('<HHIIIIIHHHHHH',1,3,1,0,0,shoff,0,52,0,0,40,3,2)
 sh=bytes(40)+struct.pack('<10I',1,1,6,a,52,len(code),0,0,1,0)+struct.pack('<10I',7,3,0,0,noff,len(names),0,0,1,0)
 p=O/(name+'.elf.data'); p.write_bytes(hdr+code+names+bytes(shoff-noff-len(names))+sh)
 r=subprocess.run(['objdump','-d','--triple=i386-unknown-unknown-code16','--x86-asm-syntax=intel',str(p)],capture_output=True,text=True,check=True)
 (O/(name+'.asm.txt')).write_text('; Static disassembly only. Addresses are executable FILE offsets.\n'+r.stdout)
 p.unlink()
print('Disassembled eleven inert slices; no archive code executed.')
