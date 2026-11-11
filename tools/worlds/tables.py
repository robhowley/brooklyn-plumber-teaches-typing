"""Decode only numeric tables, strings and indexed raster metadata from inert ZIP."""
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[1]))
from source import archive_path, objdump

import zipfile,pathlib,struct,json,hashlib
root=pathlib.Path(__file__).resolve().parents[2]; out=root/'analysis/worlds'
archive=archive_path()
assert hashlib.sha256(archive.read_bytes()).hexdigest()=='b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'
z=zipfile.ZipFile(archive); b=z.read('MarioTea/MARIO/MARIO.EXE'); ds=0x1f270
spec=[('thwompX',0x213e,3,'h'),('thwompFrame',0x214d,33,'b'),('thwompY',0x216e,33,'b'),('pipeX',0x2190,10,'h'),('pipeY',0x21a4,10,'h'),('waterPursuerY',0x2a44,20,'h'),('waterBubbleSources',0x2a6c,20,'h')]
tables={name:{'ds':hex(at),'file':hex(ds+at),'format':fmt,'values':list(struct.unpack_from('<'+str(n)+fmt,b,ds+at))} for name,at,n,fmt in spec}
strings=[]
for lo,hi in [(0x2100,0x2300),(0x2a90,0x2b90)]:
 p=lo
 while p<hi:
  end=b.find(b'\0',ds+p); raw=b[ds+p:end]
  if raw and all(32<=v<127 for v in raw): strings.append({'ds':hex(p),'file':hex(ds+p),'text':raw.decode()})
  p=end-ds+1
sprites=[]
for stem in ['WATER','CASTLE','PRACTICE','MARIO','LUIGI','PEACH']:
 member=f'MarioTea/MARIO/{stem}.GSK'
 if member not in z.namelist():continue
 index=z.read(member); gso=member[:-3]+'GSO'; data=z.read(gso)
 entries=[(n,int(o)) for n,o in (l.split(':') for l in index.decode().splitlines())]
 for i,(name,off) in enumerate(entries):
  x,y,w,h=struct.unpack_from('<4H',data,off); end=off+8+w*h
  assert end+2==(entries[i+1][1] if i+1<len(entries) else len(data))
  assert sum(data[off+8:end])&65535==struct.unpack_from('<H',data,end)[0]
  sprites.append({'member':gso,'sha256':hashlib.sha256(data).hexdigest(),'indexMember':member,'index':i,'name':name,'fileOffset':hex(off),'origin':[x,y],'size':[w,h]})
(out/'tables.json').write_text(json.dumps(tables,indent=2)+'\n');(out/'strings.json').write_text(json.dumps(strings,indent=2)+'\n');(out/'sprites.json').write_text(json.dumps(sprites,indent=2)+'\n')
(root/'recovered/worlds').mkdir(parents=True,exist_ok=True)
(root/'recovered/worlds/tables.mjs').write_text('// Original numeric data, not MIT licensed. Source offsets in analysis/worlds/tables.json.\n'+''.join('export const '+name+' = Object.freeze('+json.dumps(t['values'])+');\n' for name,t in tables.items()))
print(json.dumps({'tables':len(tables),'sprites':len(sprites),'stringCandidates':len(strings),'allSpriteChecksumsValid':True}))
