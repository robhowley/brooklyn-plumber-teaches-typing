"""Static celebration binder. Archive bytes are data, never executable input.
Run from checkout root. Outputs only ignored assets/render/celebration/.
"""
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[1]))
from source import archive_path, objdump

import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import struct
import zipfile

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('render_decode', ROOT/'tools/render/decode.py')
decode = importlib.util.module_from_spec(spec)
spec.loader.exec_module(decode)
EXE_SHA = '6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e'


def build():
    archive = archive_path()
    if hashlib.sha256(archive.read_bytes()).hexdigest() != decode.ARCHIVE_SHA:
        raise ValueError('archive hash')
    members = {}
    encode = lambda data: base64.b64encode(data).decode('ascii')
    with zipfile.ZipFile(archive) as z:
        def get(name):
            member = 'MarioTea/MARIO/'+name
            data = z.read(member)
            members[name] = {'member': member, 'sha256': hashlib.sha256(data).hexdigest()}
            return data
        exe = get('MARIO.EXE')
        if hashlib.sha256(exe).hexdigest() != EXE_SHA:
            raise ValueError('executable hash')
        # Reverify existing listing, which is only a lead until matched to ZIP bytes.
        ranges = [(0x7ff5,0x83b6),(0xa8f0,0xb0a6),(0xda44,0xdaeb),
                  (0xdf46,0xe128),(0x103be,0x10488),(0x13e29,0x1413d),
                  (0x1470c,0x149e0),(0x14a8c,0x14d8b),(0x14f74,0x14fac),
                  (0x15095,0x1513c),(0x164dc,0x167bb),(0x17aa3,0x17eab)]
        verified = 0
        listing = ROOT/'analysis/worlds/disassembly.txt'
        for line in listing.read_text().splitlines():
            m = re.match(r'\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} )+)',line)
            if not m: continue
            offset = int(m[1],16)
            if not any(a <= offset < b for a,b in ranges): continue
            data = bytes.fromhex(m[2])
            if exe[offset:offset+len(data)] != data: raise ValueError(hex(offset))
            verified += 1
        if verified < 1800: raise ValueError('regenerate worlds listing')
        names = {0x21580:b'endf\0',0x21585:b'endf.ban\0',0x21ad7:b'ocastle\0',
                 0x219de:b'firx.ban\0',0x21dd2:b'wcas0001\0',0x21ddb:b'wcas.ban\0'}
        for offset,name in names.items():
            if exe[offset:offset+len(name)] != name: raise ValueError('resource name')
        scenes = {}
        for name in ['OCASTLE','WCAS0001','ENDF']:
            raw = get(name+'.CRX'); pixels = decode.lzss(raw[768:])
            if len(pixels) != 64000: raise ValueError('scene size')
            palettes = {}
            for char in 'mlp':
                palette = bytearray(raw[:768])
                # Outside/Water call 14a8c; ENDF does not splice a character palette.
                if name != 'ENDF':
                    palette[96:144] = get(char.upper()+'PALLET.GPO')[96:144]
                palettes[char] = encode(palette)
            scenes[name] = {'pixels':encode(pixels), 'palettes':palettes,
                            'indicesSha256':hashlib.sha256(pixels).hexdigest()}
        actors, fonts = {}, {}
        for family in ['WALKING','WATER','FONT3H','FONT5H']:
            rows = decode.decode_gso(get(family+'.GSK'),get(family+'.GSO'),family)
            actors[family] = [{**record,'pixels':encode(pixels)} for record,pixels in rows]
            if family.startswith('FONT'):
                fields = {}
                for line in get(family+'.FNT').decode('ascii').splitlines():
                    if not re.fullmatch(r'[FNWH][0-9]+',line): raise ValueError('font config')
                    fields[line[0]]=int(line[1:])
                if fields != {'F':32,'N':96,'W':8,'H':10 if family=='FONT3H' else 8}:
                    raise ValueError('font metrics')
                fonts[family]={'first':fields['F'],'count':fields['N'],'width':fields['W'],'height':fields['H']}
        class Writes:
            def __init__(self): self.rows=[]
            def __setitem__(self,key,value):
                self.rows.append({'offset':key.start,'pixels':encode(value)})
        movies = {}
        for name in ['FIR1','FIR2','WCAS','ENDF']:
            raw=get(name+'.BAN'); frames=[]
            for packet in decode.decode_ban(raw):
                writes=Writes()
                decode.decode_ban(raw[packet['offset']:packet['end']]+b'\xff\xff',writes)
                frames.append({**packet,'writes':writes.rows})
            if not frames: raise ValueError('empty movie')
            movies[name]={'frames':frames,'ani':None}
        raw=get('ENGLISH.MSD'); count,length=struct.unpack_from('<HH',raw); start=4+count*4
        if start+length != len(raw): raise ValueError('MSD bounds')
        messages={}
        for i in range(count):
            ident,offset=struct.unpack_from('<HH',raw,4+i*4)
            end=raw.find(b'\0',start+offset)
            if not start <= start+offset <= end < len(raw): raise ValueError('MSD string')
            messages[ident]={'index':i,'resourceId':ident,'byteSpan':[start+offset,end],
                             'text':raw[start+offset:end].decode('ascii')}
        # Original lesson-name lookup 0xeece uses resource ID299+lesson.
        # Keep messages local so the consumer never embeds copied English prose.
    return {'members':members,'verifiedInstructions':verified,'scenes':scenes,'actors':actors,'fonts':fonts,
            'movies':movies,'messages':messages,
            'rights':'Local-only original-derived material. Not MIT. Do not publish.'}

if __name__ == '__main__':
    output=ROOT/'assets/render/celebration/bindings.json'
    output.parent.mkdir(parents=True,exist_ok=True)
    result=build(); output.write_text(json.dumps(result,separators=(',',':'))+'\n')
    print(json.dumps({'output':str(output.relative_to(ROOT)), 'members':len(result['members']),
                      'verifiedInstructions':result['verifiedInstructions'],
                      'frames':{k:len(v['frames']) for k,v in result['movies'].items()}}))
