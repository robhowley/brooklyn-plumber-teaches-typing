"""Convert pinned WINMARIO data only. No research artifacts are runtime inputs.
All offsets are executable FILE offsets; provenance is presentation-pins.json.
"""
import hashlib
import struct


def decode_presentation(executable, pins):
    if hashlib.sha256(executable).hexdigest() != pins['executable_sha256']:
        raise ValueError('presentation executable hash mismatch')

    def read(pin):
        off, size = pin['file_offset'], pin['size']
        raw = executable[off:off+size]
        if len(raw) != size or hashlib.sha256(raw).hexdigest() != pin['sha256']:
            raise ValueError(f'presentation slice mismatch at FILE {off:#x}')
        return raw

    slices = {k: read(p) for k, p in pins['slices'].items()}
    def words(raw):
        return list(struct.unpack('<'+'h'*(len(raw)//2), raw))
    overlays = {}
    for pin in pins['overlays']:
        raw = read(pin)
        rows = []
        for off in range(0, len(raw)-2, 54):
            w = words(raw[off:off+54])
            if w[0] < 0:
                break
            frames = []
            for i in range(6, 27, 3):
                if w[i+2] < 0:
                    break
                frames.append(dict(x=w[i], y=w[i+1], tick=w[i+2]))
            rows.append(dict(destination=w[:4], current=w[4], last=w[5], frames=frames))
        if words(raw[-2:])[0] >= 0:
            raise ValueError('overlay missing terminator')
        overlays[str(pin['state'])] = dict(bitmap=pin['bitmap'], rows=rows)
    hotspots = {}
    for pin in pins['hotspots']:
        raw = read(pin)
        rows = []
        for off in range(0, len(raw), 12):
            w = words(raw[off:off+12])
            rows.append(dict(rectangle=w[:4], selector=w[4], argument=w[5]))
        hotspots[str(pin['state'])] = rows
    # Report far-pointer offsets reference segment3 (FILE base 0x13200).
    formats = []
    string_pin = pins['slices']['reportStrings']
    for off in range(0, 24, 4):
        pointer = int.from_bytes(slices['reportPointers'][off:off+2], 'little') + 0x13200
        relative = pointer-string_pin['file_offset']
        if not 0 <= relative < len(slices['reportStrings']):
            raise ValueError('report string pointer outside pinned region')
        formats.append(slices['reportStrings'][relative:].split(b'\0', 1)[0].decode('ascii'))
    offsets = words(slices['fingerOffsets'])
    return dict(schema='mario2-presentation.v1', nameKeyFlags=list(slices['nameKeyFlags']),
                overlays=overlays, hotspots=hotspots,
                fingers=dict(mapping=list(slices['fingerMap']), dx=offsets[:10], dy=offsets[10:],
                             bitmaps=words(slices['handIds'])[1:]),
                report=dict(formats=formats, x=words(slices['reportX']), y=words(slices['reportY'])))
