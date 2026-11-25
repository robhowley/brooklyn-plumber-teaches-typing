#!/usr/bin/env python3
"""Standalone Express assets. Reads only pinned ISO ranges as inert bytes."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import tempfile

import decode
from presentation import decode_presentation
from source import Source, check, expand_szdd, normalize_lesson
from ne import resources, movie_member

ROOT = Path(__file__).resolve().parents[1]
PINS = ROOT / 'pins.json'
DIST = ROOT / 'dist'


def validate_pins(pins):
    assets = pins['assets']
    expected_ne = {(2, n) for n in (103, 485, 613, 619, 104, 105, 106, 107, 108, 119, 123, 112, 599, 600, 601, 608, 609, 610, *range(152, 164))}
    expected_ne |= {(5, 102), (5, 624), (5, 626), (12, 118), (1, 2), (14, 2), (3, 1)}
    expected_movies = {2,3,47,62,63,64,65,66,67,68,69,70,0,1,14,15,16,17,18,19,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,51,52,53,54,56,57,58,59,60,61}
    expected = {f'ne-{t}-{n}' for t,n in expected_ne} | {f'movies-{n}' for n in expected_movies} | {f'audio-{n}' for n in (1,2,5,7,8,10,11,16,17)}
    # Selected Outside closure, unioned with (never replacing) all82 prior assets.
    outside_bitmaps = {103,107,112,119,120,*range(142,327),*range(328,334),*range(335,381),*range(382,387),616,619,620}
    expected |= {f'ne-2-{n}' for n in outside_bitmaps}
    expected |= {f'ne-FULLSCREENANIM-{c}OUT.{ext}' for c in 'MPL' for ext in ('ANI','BAN')}
    if len(assets) != len(expected) or {a['id'] for a in assets} != expected:
        raise ValueError('missing, duplicate or unexpected asset pin')
    if len(pins['lessons']) != 5 or {l['id'] for l in pins['lessons']} != {'lesson-'+p for p in 'htbns'}:
        raise ValueError('missing, duplicate or unexpected lesson pin')
    for a in assets:
        if a['kind'] == 'resource' and a['id'] != f"ne-{a['type']}-{a['index']}":
            raise ValueError('resource identity mismatch')
        if not a['source']['sha256'] or 'expected_artifacts' not in a:
            raise ValueError('missing member/decode pin')


def convert(asset, data, out):
    if asset['kind'] == 'movies':
        result = decode.decode_avi(data, out)
        if result['status'] != 'decoded':
            raise ValueError(f"{asset['id']}: incomplete movie decode")
        return {k: result[k] for k in ('streams', 'decoded_frames')}
    if asset['kind'] == 'audio':
        fn = decode.decode_midi if data[:4] == b'MThd' else decode.decode_wave
        result = fn(data, out)
        return {k:v for k,v in result.items() if k not in ('chunks',)}
    if asset.get('type') == 'FULLSCREENANIM':
        return decode.decode_outside(data, out, asset['index'].rsplit('.', 1)[1])
    typ = asset['type']
    if typ == 2:
        return decode.decode_dib(data, out)
    if typ == 5:
        return decode.dialog(data)
    if typ in (12,14):
        return decode.group(data, cursor=typ == 12)
    if typ in (1,3):
        return decode.icon(data, out, cursor=typ == 1)
    raise ValueError('unsupported resource')


def build(iso=None, pins_path=PINS):
    if DIST.is_symlink():
        raise ValueError('refusing symlink output')
    if DIST.exists():
        shutil.rmtree(DIST)
    pins = json.loads(Path(pins_path).read_text())
    validate_pins(pins)
    # Failed builds leave no stale runtime. Only publish a fully validated stage.
    source = Source(pins, iso)
    try:
        executable = source.read(pins['executable'])
        directory = resources(executable)
        with tempfile.TemporaryDirectory(prefix='.build-', dir=ROOT) as temp:
            stage = Path(temp)
            decode.HERE = stage
            catalog = {'schema': 'mario2-assets.v1', 'assets': {}, 'lessons': {}}
            runtime = ('index.html', 'main.js', 'startup.js', 'styles.css', 'setup.js', 'storage.js', 'assets.js', 'render.js', 'typing.js', 'media.js', 'selection.js', 'report.js', 'outside.js', 'outside-render.js')
            allowed = {'assets.json', 'font.bin', 'presentation.json', *runtime}
            for name in runtime:
                shutil.copyfile(ROOT/name, stage/name)
            presentation_pins = json.loads((ROOT/'presentation-pins.json').read_text())
            decode.save_json(stage/'presentation.json', decode_presentation(executable, presentation_pins))
            catalog['presentation'] = {'url':'presentation.json'}
            font = pins['font']
            (stage/'font.bin').write_bytes(check(executable[font['file_offset']:font['file_offset']+font['size']], font, 'font'))
            catalog['font'] = {'url':'font.bin','glyphs':128,'width':8,'height':8,'sha256':font['sha256']}
            for a in pins['assets']:
                if 'join' in a:
                    j = a['join']
                    selector = check(executable[j['file_offset']:j['file_offset']+j['size']], j, a['id']+' selector')
                    if a['kind'] == 'movies':
                        if int.from_bytes(selector[:2], 'little') != int(a['id'].split('-')[1]):
                            raise ValueError(a['id']+': selector identity mismatch')
                        if movie_member(executable, j['file_offset']) != a['source']['path']:
                            raise ValueError(a['id']+': movie member join mismatch')
                data = source.read(a['source'])
                if 'executable_file_offset' in a:
                    key = (a['type'], a['index']) if a['kind'] == 'resource' else (a['resource_type'], a['resource_index'])
                    offset, size = directory[key]
                    if (offset, size) != (a['executable_file_offset'], len(data)) or executable[offset:offset+size] != data:
                        raise ValueError(a['id']+': NE resource join mismatch')
                output = decode.Outputs(a['source']['sha256'])
                result = convert(a, data, output)
                actual = {Path(x['path']).name:x for x in output.artifacts}
                if set(actual) != {x['name'] for x in a['expected_artifacts']}:
                    raise ValueError(a['id']+': artifact set mismatch')
                for expected in a['expected_artifacts']:
                    check((stage/actual[expected['name']]['path']).read_bytes(), {'size':expected['bytes'],'sha256':expected['sha256']}, a['id']+'/'+expected['name'])
                urls = {name:meta['path'] for name,meta in actual.items()}
                allowed.update(urls.values())
                catalog['assets'][a['id']] = {'files':urls,'data':result,'placement':a.get('placement'), 'source':{'member':a['source']['path'],'sha256':a['source']['sha256'],'executable_file_offset':a.get('executable_file_offset')}}
            for lesson in pins['lessons']:
                data = source.read(lesson['source'])
                if lesson['compressed']:
                    data = expand_szdd(data)
                if hashlib.sha256(data).hexdigest() != lesson['expanded_sha256']:
                    raise ValueError(lesson['id']+': expanded pin mismatch')
                normalized, offsets = normalize_lesson(data)
                if hashlib.sha256(normalized).hexdigest() != lesson['normalized_sha256']:
                    raise ValueError(lesson['id']+': normalized pin mismatch')
                tokens = [{'text':m[0].decode('ascii'),'raw_file_offsets':offsets[m.start():m.end()]} for m in re.finditer(rb'[^\x00-\x20]+', normalized)]
                catalog['lessons'][lesson['id']] = {'tokens':tokens,'normalized':normalized.decode('ascii'),
                    'bytes':list(data), 'starts':[0]+[i for i,b in enumerate(data) if b & 127 == 126][:-1],
                    'delimiter_count':sum(b & 127 == 126 for b in data),
                    'source_sha256':lesson['expanded_sha256']}
            decode.save_json(stage/'assets.json', catalog)
            actual_files = {str(p.relative_to(stage)) for p in stage.rglob('*') if p.is_file()}
            if actual_files != allowed:
                raise ValueError('runtime allowlist mismatch')
            # No copies from research or prior output, and no stale files survive.
            shutil.move(str(stage), DIST)
    finally:
        source.close()
    return {'assets':len(pins['assets']),'lessons':5,'files':len(allowed),'output':'mario2/dist'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--iso', type=Path)
    parser.add_argument('--pins', type=Path, default=PINS)
    args = parser.parse_args()
    print(json.dumps(build(args.iso, args.pins), sort_keys=True))
