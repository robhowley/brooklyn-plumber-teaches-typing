"""Static data extraction and disassembly only. Never loads original code."""
import hashlib,json,pathlib,struct,subprocess,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[2]/'analysis'/'outdoor'
zpath=pathlib.Path.home()/'Downloads/Mario_Teaches_Typing_1992.zip'
archive=zpath.read_bytes(); sha=hashlib.sha256(archive).hexdigest()
assert sha=='b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'
with zipfile.ZipFile(zpath) as z: b=z.read('MarioTea/MARIO/MARIO.EXE')
ROOT.mkdir(parents=True,exist_ok=True)
start,end=0x2e00,0x1f270
code=b[start:end]; names=b'\0.text\0.shstrtab\0'; off=52; noff=off+len(code); shoff=(noff+len(names)+3)&~3
hdr=b'\x7fELF'+bytes([1,1,1])+bytes(9)+struct.pack('<HHIIIIIHHHHHH',1,3,1,0,0,shoff,0,52,0,0,40,3,2)
sh=bytes(40)+struct.pack('<10I',1,1,6,start,off,len(code),0,0,1,0)+struct.pack('<10I',7,3,0,0,noff,len(names),0,0,1,0)
p=ROOT/'static.elf.data';p.write_bytes(hdr+code+names+bytes(shoff-noff-len(names))+sh)
r=subprocess.run(['objdump','-D','--triple=i386-unknown-unknown-code16','--x86-asm-syntax=intel',str(p)],capture_output=True,text=True,check=True)
(ROOT/'all.asm.txt').write_text(r.stdout)
lines=[];edges=[]
import re
for line in r.stdout.splitlines():
 m=re.match(r'\s*([0-9a-f]+):',line)
 if not m:continue
 a=int(m[1],16)
 if 0x1272e<=a<0x143c1 or 0x3a3c<=a<0x3a68:
  f=re.search(r'lcall\s+0x([0-9a-f]+), 0x([0-9a-f]+)',line)
  if f:
   target=0x2e00+int(f[1],16)*16+int(f[2],16)
   line+=f' ; FILE 0x{target:05x}'
   edges.append({'from':hex(a),'to':hex(target),'kind':'far'})
  else:
   f=re.search(r'\bcall\s+0x([0-9a-f]+)',line)
   if f:edges.append({'from':hex(a),'to':hex(int(f[1],16)),'kind':'near'})
  lines.append(line)
(ROOT/'outdoor.asm.txt').write_text('\n'.join(lines)+'\n')
spans=[{'start':hex(s),'endExclusive':hex(e),'hex':b[s:e].hex()} for s,e in [(0x11e00,0x14400),(0x3a3c,0x3a68),(0x1f270,len(b))]]
(ROOT/'evidence.json').write_text(json.dumps({'archiveSha256':sha,'member':'MarioTea/MARIO/MARIO.EXE','memberSha256':hashlib.sha256(b).hexdigest(),'loadFileOffset':'0x2e00','spans':spans,'callEdges':edges},indent=2)+'\n')
# Preserve directly referenced dependency bytes and disassembly separately.
dependencies=[(0x2e00,0x2e20),(0x330c,0x3480),(0x37be,0x382d),(0x39b8,0x3a68),(0x928b,0x9693),(0x994d,0x99fa),(0x1470c,0x14741),(0x149fc,0x14a1f),(0x14e54,0x15034),(0x1513c,0x1532e),(0x188d9,0x18980),(0x18d22,0x18dcd),(0x19221,0x192e2),(0x1d610,0x1d814)]
extra=[]
# Restart decoding at each known routine entry. Linear sweep across embedded
# tables otherwise consumes the first byte at 0x928b as preceding table data.
for s,e in dependencies:
 code=b[s:e];noff=52+len(code);shoff=(noff+len(names)+3)&~3
 hdr=b'\x7fELF'+bytes([1,1,1])+bytes(9)+struct.pack('<HHIIIIIHHHHHH',1,3,1,0,0,shoff,0,52,0,0,40,3,2)
 sh=bytes(40)+struct.pack('<10I',1,1,6,s,52,len(code),0,0,1,0)+struct.pack('<10I',7,3,0,0,noff,len(names),0,0,1,0)
 p.write_bytes(hdr+code+names+bytes(shoff-noff-len(names))+sh)
 out=subprocess.run(['objdump','-D','--triple=i386-unknown-unknown-code16','--x86-asm-syntax=intel',str(p)],capture_output=True,text=True,check=True).stdout
 extra.append(f'; Dependency FILE {s:#x}..{e:#x} (exclusive); embedded jump tables are DATA')
 for line in out.splitlines():
  m=re.match(r'\s*([0-9a-f]+):',line)
  if m and s<=int(m[1],16)<e: extra.append(line)
(ROOT/'dependencies.asm.txt').write_text('\n'.join(extra)+'\n')
evidence=json.loads((ROOT/'evidence.json').read_text())
evidence['spans'] += [{'start':hex(s),'endExclusive':hex(e),'hex':b[s:e].hex()} for s,e in dependencies]
(ROOT/'evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
ds=0x1f270
assert b[0x2e00:0x2e03]==bytes.fromhex('ba471c') and b[0x2e14:0x2e16]==bytes.fromhex('8eda')
tables={}
for name,a,n,fmt in [('cursorFrames',0x2734,6,'h'),('jumpY',0x2744,12,'h'),('blockHeights',0x2766,4,'h'),('marioIdle',0x339a,47,'B'),('luigiIdle',0x33c9,47,'B'),('peachIdle',0x33f8,51,'B')]:
 tables[name]={'dataOffset':hex(a),'fileOffset':hex(ds+a),'values':list(struct.unpack_from('<'+fmt*n,b,ds+a)),'confidence':'direct bytes'}
resources=[]
with zipfile.ZipFile(zpath) as z:
 for stem in ['OUTSIDE','WALKING','IDLE']:
  keyExt,dataExt=('GCK','GCO') if stem=='IDLE' else ('GSK','GSO')
  index=z.read('MarioTea/MARIO/'+stem+'.'+keyExt);data=z.read('MarioTea/MARIO/'+stem+'.'+dataExt)
  for i,line in enumerate(index.decode('ascii').splitlines()):
   name,off=line.split(':');off=int(off)
   if stem=='OUTSIDE' or 'run' in name.lower() or 'jmp' in name.lower() or 'std' in name.lower():
    resources.append({'name':name,'index':i,'member':'MarioTea/MARIO/'+stem+'.'+dataExt,'memberSha256':hashlib.sha256(data).hexdigest(),'indexMember':'MarioTea/MARIO/'+stem+'.'+keyExt,'indexSha256':hashlib.sha256(index).hexdigest(),'offset':hex(off),'header':list(struct.unpack_from('<4H',data,off))})
 members=[]
 for name in ['OUTSIDE.CRX','OUTSKY.CRX','OCASTLE.CRX','TURTLE.GPO','MOUT.ANI','MOUT.BAN','LOUT.ANI','LOUT.BAN','POUT.ANI','POUT.BAN','FIR1.BAN','FIR2.BAN','READY.RS','READY.VOC']:
  data=z.read('MarioTea/MARIO/'+name)
  members.append({'member':'MarioTea/MARIO/'+name,'sha256':hashlib.sha256(data).hexdigest(),'size':len(data),'interpretation':'identity only; no playback or scene decoding claimed'})
 lessons=[]
 for prefix in 'HTBNS':
  name=prefix+'LETTERS.LEE';data=z.read('MarioTea/MARIO/'+name)
  (ROOT/(name+'.data')).write_bytes(data)
  lessons.append({'member':'MarioTea/MARIO/'+name,'sha256':hashlib.sha256(data).hexdigest(),'localFile':name+'.data'})
(ROOT/'tables.json').write_text(json.dumps({'dataSegmentFileBase':hex(ds),'tables':tables,'resources':resources,'lessons':lessons,'otherReferencedMembers':members},indent=2)+'\n')
labels={0x1272e:'Initialize outdoor resources, object pools, player, lesson and duration',0x12cc3:'Free outdoor allocations/resources',0x12dbb:'Spawn first free 30-byte obstacle; RNG type and height',0x12ee4:'Allocate first free 9-byte debris record',0x12f59:'Debris movement and clipping',0x13058:'Spawn spacing, obstacle movement, six-tick removal and one-slot compaction',0x133f7:'Cursor animation and first live nonzero character selection (NOT contact gate)',0x135c9:'Player pursuit, scroll calculation, run/idle/jump animation',0x13852:'One-shot bonus visibility and pursuit',0x1397c:'Main outdoor update/input/end loop',0x13dc3:'Outdoor entry: init, ready, audio, loop, cleanup, report',0x13e29:'Progression castle/fireworks presentation, NOT normal scene cycling',0x1413d:'Compose obstacle glyph over block/turtle sprite',0x1425a:'Cinematic callback, selected frame sound',0x14298:'Bonus outsky + character OUT.BAN/ANI cinematic',0x1436c:'20-pixel ground tile phase, uses previous tick scroll'}
text=(ROOT/'outdoor.asm.txt').read_text();annotated=[]
for line in text.splitlines():
 m=re.match(r'\s*([0-9a-f]+):',line)
 if m and int(m[1],16) in labels: annotated.append('\n; '+labels[int(m[1],16)])
 annotated.append(line)
(ROOT/'outdoor.asm.txt').write_text('\n'.join(annotated)+'\n')
p.unlink()
(ROOT/'all.asm.txt').unlink()
print(json.dumps({'sha256':hashlib.sha256(b).hexdigest(),'lines':len(lines),'edges':len(edges),'resources':len(resources)}))
