"""Bundle inert decoded resources, never execute original code. Local-only, not MIT."""
import base64
import json
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
    if sprite['family'] in ('WALKING', 'OUTSIDE', 'FONT5H', 'FONT7H', 'FONT9H', 'PRACTICE'):
        result['sprites'][sprite['family'] + '/' + sprite['name']] = sprite_record(sprite, ASSETS)
# Only Water is enabled; Castle resources remain outside the app bundle.
for sprite in render['sprites']:
    if sprite['family'] in ('IDLE', 'WATER', 'WATER_INLINE'):
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
    if bg['name'] in ('MAINMENU', 'OUTSIDE', 'OUTSKY', 'PREFS', 'LESSTIME', 'BLACKBRD', 'PRACTICE'):
        result['backgrounds'][bg['name']] = {**bg, 'pixels': b64(ASSETS / bg['indicesPath'])}
for lesson in manifest['lessons']:
    result['lessons'][lesson['name']] = list((ASSETS / lesson['rawPath']).read_bytes())
result['ground'] = b64(RENDER / render['ground']['indicesPath'])
result['messages'] = {k: v['text'] for k,v in json.loads((ROOT / 'analysis/control/messages.json').read_text())['resources'].items()}
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
        'source': 'MARIO.EXE FILE 0x14298..0x14360; 0x82e9..0x835b'}
(ROOT / 'app/data.json').write_text(json.dumps(result, separators=(',', ':')) + '\n')
print('Built app/data.json and assets/app/* from inert resources; no original execution')
