"""Supplement existing render exports without modifying the shared decoder.
Reads ZIP members as data only. Writes local-only assets/render/water/bindings.json.
"""
import base64
import hashlib
import json
import pathlib
import zipfile
from decode import ARCHIVE_SHA, ROOT, decode_ban


def build():
    archive = pathlib.Path.home() / 'Downloads/Mario_Teaches_Typing_1992.zip'
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == ARCHIVE_SHA
    render = ROOT / 'assets/render'
    manifest = json.loads((render / 'manifest.json').read_text())
    packets = json.loads((render / 'ban-packets.json').read_text())
    tables = json.loads((render / 'ani-tables.json').read_text())
    members = {}
    with zipfile.ZipFile(archive) as z:
        def get(name):
            member = 'MarioTea/MARIO/' + name
            data = z.read(member)
            members[name] = {'member': member, 'sha256': hashlib.sha256(data).hexdigest()}
            return data
        exe = get('MARIO.EXE')
        assert exe[0x21d91:0x21d9b] == b'biter.gpo\0'
        biter = get('BITER.GPO')
        assert len(biter) == 768
        palettes = {}
        for char in 'mlp':
            rgb6 = [rgb[:] for rgb in manifest['worlds']['water']['palettes'][char]['rgb6']]
            rgb6[48:64] = [list(biter[i:i+3]) for i in range(144,192,3)]
            palettes[char] = {'rgb6': rgb6, 'rgb8': [[round(v*255/63) for v in rgb] for rgb in rgb6],
                              'replacedSlots': [32,63], 'pursuerMember': 'BITER.GPO'}
        animations = {}
        class Writes:
            def __init__(self):
                self.rows = []
            def __setitem__(self, key, value):
                self.rows.append({'offset': key.start, 'pixels': base64.b64encode(value).decode()})
        for char in 'MLP':
            name = char + 'SWM'
            ban = get(name + '.BAN')
            get(name + '.ANI')
            frames = []
            for packet, entry in zip(packets[name+'.BAN'], tables[name+'.ANI'], strict=True):
                writes = Writes()
                decode_ban(ban[packet['offset']:packet['end']] + b'\xff\xff', writes)
                frames.append({'writes': writes.rows, 'ani': entry})
            animations[char.lower()] = {'frames': frames, 'ban': name+'.BAN', 'ani': name+'.ANI'}
    # 0x9cab: 25 records, stride228, first224 bytes are a16x14 raster.
    # DS:0456 maps to FILE0x1f6c6. Trailing four bytes are not drawn.
    waves = [base64.b64encode(exe[0x1f6c6+i*228:0x1f6c6+i*228+224]).decode() for i in range(25)]
    return {'members': members, 'palettes': palettes, 'animations': animations, 'waves': waves,
            'playback': manifest['worlds']['water']['bonusPlayback'],
            'rights': 'Local-only original-derived material. Not MIT. Do not publish.'}


if __name__ == '__main__':
    output = ROOT / 'assets/render/water/bindings.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(build(), separators=(',', ':')) + '\n')
    print('Wrote local Water palette correction and exact BAN write records:', output)
