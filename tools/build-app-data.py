"""Bundle inert decoded resources, never execute original code. Local-only, not MIT."""
import base64
import json
import struct
import hashlib
import re
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets/original'
RENDER = ROOT / 'assets/render'
sys.path.insert(0, str(ROOT / 'tools/render'))
from decode import decode_ban
manifest = json.loads((ASSETS / 'manifest.json').read_text())
render = json.loads((RENDER / 'manifest.json').read_text())
result = {'sprites': {}, 'palettes': {}, 'lessons': {}, 'messages': {}, 'backgrounds': {},
          'idleSchedules': render['idleSchedules'], 'bonusAnimations': {},
          'rights': 'Original-derived local-only material. Not MIT. Do not publish.'}

def b64(path):
    return base64.b64encode(path.read_bytes()).decode()

def sprite_record(sprite, root):
    return {**sprite, 'pixels': b64(root / sprite['indicesPath'])}

for sprite in manifest['sprites']:
    if sprite['family'] in ('WALKING', 'OUTSIDE', 'FONT3H', 'FONT5H', 'FONT7H', 'FONT9H', 'PRACTICE', 'FINGER') or (sprite['family'] == 'GREET2' and sprite['name'] == 'prefbox_1'):
        result['sprites'][sprite['family'] + '/' + sprite['name']] = sprite_record(sprite, ASSETS)
# Render sprites use decoded family indices, never flattened resource indices.
for sprite in render['sprites']:
    if sprite['family'] in ('IDLE', 'WATER', 'WATER_INLINE', 'CASTLE', 'CURSOR'):
        result['sprites'][sprite['family'] + '/' + sprite['name']] = sprite_record(sprite, RENDER)
for palette in manifest['palettes']:
    result['palettes'][palette['name']] = json.loads((ASSETS / palette['path']).read_text())['rgb8']
for char, palette in render['palettes'].items():
    result['palettes']['outdoor-' + char] = [c for rgb in palette['rgb8'] for c in rgb]
water = json.loads((RENDER / 'water/bindings.json').read_text())
result['water'] = {'waves': water['waves'], 'animations': {}, 'playback': water['playback']}
for char, palette in water['palettes'].items():
    result['palettes']['water-' + char] = [c for rgb in palette['rgb8'] for c in rgb]
for char, animation in water['animations'].items():
    result['water']['animations'][char] = {'frames': [
        {'writes': frame['writes'], 'ani': sprite_record(frame['ani'], RENDER)}
        for frame in animation['frames']]}
bg = render['worlds']['water']['background']
result['backgrounds']['WATER'] = {**bg, 'pixels': b64(RENDER / bg['indicesPath'])}
for bg in manifest['backgrounds']:
    if bg['name'] in ('MAINMENU', 'OUTSIDE', 'OUTSKY', 'PREFS', 'LOAD', 'LESSTIME', 'BLACKBRD', 'PRACTICE', 'RCARD', 'HELP', 'KEYBOARD', 'GREETBG'):
        result['backgrounds'][bg['name']] = {**bg, 'pixels': b64(ASSETS / bg['indicesPath'])}
for lesson in manifest['lessons']:
    result['lessons'][lesson['name']] = list((ASSETS / lesson['rawPath']).read_bytes())
result['ground'] = b64(RENDER / render['ground']['indicesPath'])
result['messages'] = {k: v['text'] for k,v in json.loads((ROOT / 'analysis/control/messages.json').read_text())['resources'].items()}
control = json.loads((ROOT / '.tmp/report-evidence.json').read_text())
result['control'] = {key: control[key] for key in ('teachers', 'strings', 'help', 'members')}
menu = json.loads((ROOT / '.tmp/menu/evidence.json').read_text())
result['control']['menu'] = {'members': menu['members'], 'prefBoxXs': menu['tables']['prefBoxXs']}
result['tables'] = json.loads((ROOT / 'analysis/outdoor/tables.json').read_text())['tables']
# 0x14298 selects OUTSKY + character OUT BAN/ANI. Decode BAN changes to persistent
# backgrounds here; browser uses recovered updateSprite for ANI erasure/overlay.
packets = json.loads((RENDER / 'ban-packets.json').read_text())
tables = json.loads((RENDER / 'ani-tables.json').read_text())
out = ROOT / 'assets/app'
out.mkdir(exist_ok=True)
for char in 'MLP':
    name = char + 'OUT'
    ani = json.loads((ASSETS / ('animations/' + name + '.json')).read_text())
    rasters = {frame['offset']: frame for frame in ani['frames']}
    ban = (ASSETS / ('raw/MarioTea/MARIO/' + name + '.BAN.data')).read_bytes()
    background = bytearray((ASSETS / 'backgrounds/OUTSKY.indices.data').read_bytes())
    backgrounds = bytearray()
    frames = []
    for packet, entry in zip(packets[name + '.BAN'], tables[name + '.ANI'], strict=True):
        decode_ban(ban[packet['offset']:packet['end']] + b'\xff\xff', background)
        backgrounds.extend(background)
        frame = rasters[entry['rasterOffset']]
        frames.append({**entry, 'sprite': sprite_record(frame, ASSETS)})
    path = 'assets/app/' + name + '.backgrounds.indices'
    (ROOT / path).write_bytes(backgrounds)
    result['bonusAnimations'][char.lower()] = {'frames': frames, 'backgroundsPath': path,
        'member': ani['member'], 'memberSha256': ani['memberSha256'], 'palette': 'OUTSKY.CRX',
        'source': 'MARIO.EXE FILE 0x14298..0x14360; 0x82e9..0x835b',
        'playback': {'callbackFileOffset': '0x1425a', 'tickWaitsPerPacket': 2,
                     'sound7OneBasedFrames': list((ASSETS / 'raw/MarioTea/MARIO/MARIO.EXE.data').read_bytes()[0x219e7:0x219f2])}}
# Castle FILE d6a4..d74a, d8a4..d91f, de6c..df45. Expose actual BAN
# writes, not frame differences: unchanged values still erase foreground art.
exe = (ASSETS / 'raw/MarioTea/MARIO/MARIO.EXE.data').read_bytes()
assert hashlib.sha256(exe).hexdigest() == '6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e'
# Certificate text, not CERTIF pixels. Pinned inert members only; original text
# and pointer data remain in ignored app/data.json and .tmp evidence.
from source import EXE_MEMBER, EXE_SHA256
msd_member = 'MarioTea/MARIO/ENGLISH.MSD'
msd = (ASSETS / ('raw/' + msd_member + '.data')).read_bytes()
msd_sha = 'fd2168878e19b1b85ae0c6ce8e14ad4386a801e7c460ed134bde5f181cb29e15'
assert hashlib.sha256(msd).hexdigest() == msd_sha
checked = 0
for line in (ROOT / 'analysis/control/verified-disassembly.txt').read_text().splitlines():
    match = re.match(r'\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} )*[0-9a-f]{2})(?:\s|$)', line)
    if match:
        offset = int(match[1], 16)
        if 0xa8f0 <= offset < 0xb0a6 or 0xeeed <= offset < 0xef0d:
            raw = bytes.fromhex(match[2])
            assert exe[offset:offset + len(raw)] == raw, hex(offset)
            checked += 1
assert checked > 800
art = []
for i in range(31):
    offset, segment = struct.unpack_from('<HH', exe, 0x20d4e + i*4)
    start = 0x2e00 + segment*16 + offset
    end = exe.index(0, start)
    art.append({'index': i, 'fileOffset': hex(start), 'text': exe[start:end].decode('ascii')})
assert [len(row['text']) for row in art] == [46]*30 + [0]
assert exe[0x20dd2:0x20ddd] == b'%-80.80s\r\n\0'
count, size = struct.unpack_from('<HH', msd)
text_start = 4 + count*4
assert text_start + size == len(msd)
resources = []
for i in range(count):
    resource_id, offset = struct.unpack_from('<HH', msd, 4 + i*4)
    if resource_id in (*range(4200, 4206), *range(200, 203)):
        start = text_start + offset
        text = msd[start:msd.index(0, start)].decode('ascii')
        assert result['messages'][str(resource_id)] == text
        resources.append({'id': resource_id, 'index': i, 'fileOffset': hex(start)})
assert [r['index'] for r in resources] == [21, 22, 23, 96, 97, 98, 99, 100, 101]
result['certificate'] = {
    'art': art, 'resources': resources, 'verifiedInstructionLines': checked,
    'members': {EXE_MEMBER: EXE_SHA256, msd_member: msd_sha},
    'source': {'selection': 'FILE 0xaaf9..0xaea6 (completed checks 0xac46/0xad23)',
               'rows': 'FILE 0xa903..0xa970; output 0xa9a3..0xa9f5; format 0x20dd2',
               'centering': 'FILE 0xaa8b..0xaaf8', 'art': 'FILE 0xaecf..0xaf15; table 0x20d4e indices 0..30',
               'text': 'FILE 0xaf16..0xb000; level resource 0xeeed..0xef0a',
               'border': 'FILE 0xb001..0xb068', 'constructor': 'FILE 0xb069..0xb0a5'}}
(ROOT / '.tmp/certificate-evidence.json').write_text(json.dumps(result['certificate'], indent=2) + '\n')
# FINGER service FILE 0x17fa4..0x18126: resources 10/11 are base hands,
# 0..9 highlights. Extract all 95 ASCII entries and signed position words,
# including the activity initializer immediates, not a modern keyboard chart.
# Member identities also travel with each decoded sprite in result['sprites'].
finger_members = {'FINGER.GSO': '2ff6f12ad9491f3e8f12060451ba2aec9de8b6cdf9695b4f07ea0a04ca0a1688',
                  'FINGER.GSK': '5959d392c045be861a95e28efb440d3945afb181588e6135e91e223db1f6bf7a'}
for name, sha in finger_members.items():
    assert hashlib.sha256((ASSETS / ('raw/MarioTea/MARIO/' + name + '.data')).read_bytes()).hexdigest() == sha
origins = []
for offset in (0x12a21, 0x16a34, 0xd7cd, 0xb1ad):
    for i, address in enumerate((0x51b4, 0x51b2, 0x51b0)):
        assert exe[offset + i*6:offset + i*6 + 4] == b'\xc7\x06' + struct.pack('<H', address)
    origins.append([struct.unpack_from('<h', exe, offset + i*6 + 4)[0] for i in range(3)])
result['fingers'] = {'lookup': list(exe[0x2258c:0x225eb]),
                     'x': list(struct.unpack_from('<10h', exe, 0x21df6)),
                     'y': list(struct.unpack_from('<10h', exe, 0x21e0a)), 'origins': origins,
                     'member': 'MarioTea/MARIO/MARIO.EXE', 'memberSha256': hashlib.sha256(exe).hexdigest(),
                     'members': finger_members,
                     'source': {'lookup': 'FILE 0x2258c..0x225ea (ASCII32..126)',
                                'x': 'FILE 0x21df6', 'y': 'FILE 0x21e0a',
                                'origins': ['FILE 0x12a21', 'FILE 0x16a34', 'FILE 0xd7cd', 'FILE 0xb1ad'],
                                'draw': 'FILE 0x18070..0x18126; compositor 0x7a47'}}
(ROOT / '.tmp/fingers-evidence.json').write_text(json.dumps(result['fingers'], indent=2) + '\n')
castle = render['worlds']['castle']
result['castle'] = {'bonusXs': list(struct.unpack_from('<3h', exe, 0x213b4)),
                    'scenes': [b64(RENDER / s['indicesPath']) for s in castle['scenes']],
                    'animations': {}, 'playback': castle['bonusPlayback']}
result['backgrounds']['CASTLE'] = {**castle['background'], 'pixels': b64(RENDER / castle['background']['indicesPath'])}
for char, palette in castle['palettes'].items():
    result['palettes']['castle-' + char] = [c for rgb in palette['rgb8'] for c in rgb]
class Writes:
    def __init__(self):
        self.rows = []
    def __setitem__(self, key, value):
        self.rows.append({'offset': key.start, 'pixels': base64.b64encode(value).decode()})
for char in 'MLP':
    name = char + 'CAS'
    ban = (ASSETS / ('raw/MarioTea/MARIO/' + name + '.BAN.data')).read_bytes()
    frames = []
    for packet, entry in zip(packets[name + '.BAN'], tables[name + '.ANI'], strict=True):
        writes = Writes()
        decode_ban(ban[packet['offset']:packet['end']] + b'\xff\xff', writes)
        frames.append({'writes': writes.rows, 'ani': sprite_record(entry, RENDER)})
    result['castle']['animations'][char.lower()] = {'frames': frames}
# Phase5 inputs are decoded locally, never copied from worker generated output.
startup_root = ROOT / 'assets/startup'
startup = json.loads((startup_root / 'manifest.json').read_text())
result['startup'] = {
    'scenes': {name: {'pixels': b64(startup_root / scene['indicesPath']),
                      'palette': b64(startup_root / scene['palettePath'])}
               for name, scene in startup['scenes'].items()},
    'sprites': {family: {s['name']: sprite_record(s, startup_root) for s in rows}
                for family, rows in startup['sprites'].items()},
    'letters': startup['letters'], 'letterX': startup['letterX'], 'members': startup['members']}
result['celebration'] = json.loads((RENDER / 'celebration/bindings.json').read_text())
audio_root = ROOT / 'assets/audio'
audio = json.loads((audio_root / 'manifest.json').read_text())
result['audio'] = {**audio, 'clips': {name: {**clip, 'pcm': b64(audio_root / clip['path'])}
                                      for name, clip in audio['clips'].items()}}
(ROOT / 'app/data.json').write_text(json.dumps(result, separators=(',', ':')) + '\n')
print('Built app/data.json and assets/app/* from inert resources; no original execution')
