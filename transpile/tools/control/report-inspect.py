"""Read inert ZIP bytes, verify focused listings, emit local-only report resources.
No archive code is executed. No generated numerical tables/text are publishable.
Run from any directory: python3 -B transpile/tools/control/report-inspect.py
"""
from pathlib import Path
import hashlib
import json
import re
import struct
import zipfile

ROOT=Path(__file__).resolve().parents[2]
ARCHIVE=Path.home()/'Downloads/Mario_Teaches_Typing_1992.zip'
EXPECTED='b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'
EXE='6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e'
SPANS=[(0xe446,0xe52b),(0xe65b,0xe997),(0x11d54,0x121eb),
       (0x125b9,0x12661),(0x1457b,0x146e0),(0x147f2,0x1482f),
       (0x1537f,0x15965),(0x15d77,0x1644a),(0x1a775,0x1ac9a)]

def inspect():
    assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()==EXPECTED
    with zipfile.ZipFile(ARCHIVE) as z:
        b=z.read('MarioTea/MARIO/MARIO.EXE')
        assert hashlib.sha256(b).hexdigest()==EXE
        checked=0
        for line in (ROOT/'analysis/control/verified-disassembly.txt').read_text().splitlines():
            m=re.match(r'\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} )*[0-9a-f]{2})(?:\s|$)',line)
            if not m: continue
            p=int(m[1],16)
            if any(a<=p<e for a,e in SPANS):
                raw=bytes.fromhex(m[2]);assert b[p:p+len(raw)]==raw,hex(p)
                checked+=1
        def string(ds):
            start=0x1f270+ds
            return b[start:b.index(0,start)].decode('ascii')
        addresses=[0x25c7,0x25e2,0x25f3,0x2602,0x260f,0x261c,0x2629,0x2636,
                   0x2645,0x2655,0x2665,0x2676,0x2682,0x2694,0x26a3,0x26b4,
                   0x23ac,0x23b0,0x23b4,0x23ba,0x29fa,0x29fe,0x2a02,0x2a06,0x2a0a,0x2a10]
        teachers=[]
        for i in range(3):
            off,seg=struct.unpack_from('<HH',b,0x1f270+0x338c+4*i)
            p=0x2e00+16*seg+off
            teachers.append(b[p:b.index(0,p)].decode('ascii'))
        members={}
        names=['MARIO.EXE','ENGLISH.MSD','RCARD.CRX','BLACKBRD.CRX','HELP.CRX','KEYBOARD.CRX','GREETBG.CRX',
               'MARIO1.HLP','MARIO2.HLP']
        names += [f'FONT{f}H.{ext}' for f in [3,5] for ext in ['FNT','GSO','GSK']]
        for name in names:
            member='MarioTea/MARIO/'+name;raw=z.read(member)
            members[member]={'sha256':hashlib.sha256(raw).hexdigest(),'size':len(raw)}
        result={'rights':'Original-derived local-only data. Not MIT. Do not publish.',
          'members':members,'verifiedInstructionLines':checked,
          'spans':[{'fileStart':hex(a),'fileEndExclusive':hex(e)} for a,e in SPANS],
          'strings':{str(a):string(a) for a in addresses},'teachers':teachers,
          'help':{str(i):z.read(f'MarioTea/MARIO/MARIO{i}.HLP').decode('ascii') for i in [1,2]},
          'helpKeys':list(struct.unpack_from('<14H',b,0x1592d)),
          'helpTargets':[hex(0x15370+x) for x in struct.unpack_from('<14H',b,0x15949)],
          'hudTargets':[hex(0x15960+x) for x in struct.unpack_from('<4H',b,0x164a4)]}
    out=ROOT/'.tmp/report-evidence.json';out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'output':str(out.relative_to(ROOT)),'verifiedInstructionLines':checked,'members':len(members)}))

if __name__=='__main__':inspect()
