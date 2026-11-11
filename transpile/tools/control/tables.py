"""Decode only inert tables and extract focused, byte-verified assembly."""
from pathlib import Path
import zipfile, struct, json, hashlib, re
R=Path(__file__).resolve().parents[2]; O=R/'analysis/control'
with zipfile.ZipFile(Path.home()/'Downloads/Mario_Teaches_Typing_1992.zip') as z:
 b=z.read('MarioTea/MARIO/MARIO.EXE'); m=z.read('MarioTea/MARIO/ENGLISH.MSD')
assert hashlib.sha256(b).hexdigest()=='6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e'
n,size=struct.unpack_from('<HH',m); start=4+n*4; assert start+size==len(m)
messages={}
for i in range(n):
 id,off=struct.unpack_from('<HH',m,4+i*4); a=start+off; e=m.index(0,a)
 messages[id]={'fileOffset':hex(a),'text':m[a:e].decode('ascii')}
(O/'messages.json').write_text(json.dumps({'member':'MarioTea/MARIO/ENGLISH.MSD','sha256':hashlib.sha256(m).hexdigest(),'resources':messages},indent=2)+'\n')
def words(a,n): return list(struct.unpack_from('<'+'H'*n,b,a))
keys=words(0x103b0+0x1687,46); targets=words(0x103b0+0x1687+92,46)
tables={'mainMenuKeyDispatch':[{'key':hex(k),'target':hex(t+0x103b0)} for k,t in zip(keys,targets)],'mainMenuRects': [dict(zip(['x0','y0','x1','y1'],words(0x1f270+0x2498+i*8,4))) for i in range(6)],'studentOpcodes':[{'opcode':hex(0xaf1+i),'target':hex(t+0xe120)} for i,t in enumerate(words(0xe120+0x511,21))], 'gamestatOpcodes':[{'opcode':k,'target':hex(t+0x15960)} for k,t in zip(words(0x15960+0xb4c,12),words(0x15960+0xb64,12))]}
tables['resultsKeyDispatch']=[{'key':hex(k),'target':hex(t+0x15960)} for k,t in zip(words(0x167bb,14),words(0x167d7,14))]
tables['lessonGroupTargets']=[hex(t+0x9280) for t in words(0x9485,6)]
tables['durationRects']=[dict(zip(['x','y','width','height'],words(0x1f270+0x256+i*8,4))) for i in range(4)]
(O/'tables.json').write_text(json.dumps(tables,indent=2)+'\n')
lines=(O/'verified-disassembly.txt').read_text().splitlines()
ranges={'student':(0xe14e,0xfb90),'menu':(0x103be,0x12244),'score':(0x15965,0x15d77),'results':(0x164dc,0x167bb),'startup':(0x12380,0x12720),'routing':(0x9160,0x9430),'progression':(0x13ae9,0x13e26),'castle-progression':(0xda20,0xdaf0),'water-progression':(0x17e03,0x17eb0)}
for name,(a,e) in ranges.items():
 out=[f'; Verified against MarioTea/MARIO/MARIO.EXE SHA256 6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e', '; Addresses are FILE offsets, not runtime addresses. 98/99 mean CBW/CWD in code16.', '; Embedded jump tables are data, linear disassembly there is not code.']
 for l in lines:
  match=re.match(r'\s*([0-9a-f]+):',l)
  if match and a<=int(match[1],16)<e: out.append(l)
 (O/(name+'.asm.txt')).write_text('\n'.join(out)+'\n')
print(json.dumps(tables,indent=2))
print('HOTKEY MESSAGES', {k:v['text'] for k,v in messages.items() if 10000<=k<=10016})
