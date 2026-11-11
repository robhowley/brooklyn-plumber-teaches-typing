#!/usr/bin/env python3
"""Static, stdlib-only archive conversion. Archive contents are NEVER code."""
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[1]))
from source import archive_path, objdump

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import struct
import sys
import zipfile
import zlib

EXPECTED_SHA256 = 'b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'
ROOT = Path(__file__).resolve().parents[2]
MAX_ARCHIVE = 32 * 1024 * 1024
MAX_MEMBER = 8 * 1024 * 1024
MAX_TOTAL = 64 * 1024 * 1024
PREFIX = 'MarioTea/MARIO/'


def require(ok, message):
    if not ok:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def safe_name(name):
    require(isinstance(name, str) and 0 < len(name) <= 240, 'invalid member name length')
    require(not any(ord(c) < 32 for c in name), 'control byte in member name')
    require('\\' not in name and ':' not in name and not name.startswith('/'), 'unsafe member path')
    parts = name.rstrip('/').split('/')
    require(all(p not in ('', '.', '..') and not p.endswith(('.', ' ')) for p in parts), 'unsafe path component')
    return '/'.join(parts)


def read_archive(path, expected=EXPECTED_SHA256):
    """Validate the entire archive before any output. zipfile verifies each CRC."""
    require(path.stat().st_size <= MAX_ARCHIVE, 'archive exceeds size limit')
    data = path.read_bytes()
    require(sha(data) == expected, 'archive SHA-256 mismatch')
    files, inventory, seen, total = {}, [], set(), 0
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        require(len(z.infolist()) <= 2048, 'too many members')
        for info in z.infolist():
            require(info.orig_filename == info.filename, 'NUL in ZIP filename')
            name = safe_name(info.filename)
            require(name.casefold() not in seen, 'duplicate/case-colliding member')
            seen.add(name.casefold())
            mode = info.external_attr >> 16
            require(stat.S_IFMT(mode) in (0, stat.S_IFREG, stat.S_IFDIR), 'non-regular ZIP member')
            require(not info.flag_bits & 1, 'encrypted member')
            require(info.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), 'unsupported ZIP compression')
            require(0 <= info.file_size <= MAX_MEMBER, 'member exceeds size limit')
            total += info.file_size
            require(total <= MAX_TOTAL, 'archive expansion exceeds limit')
            raw = z.read(info)
            require(len(raw) == info.file_size, 'member length mismatch')
            directory = info.is_dir()
            require(not directory or len(raw) == 0, 'nonempty directory')
            # All files, not just recognized executable extensions, get inert names.
            target = None if directory else 'raw/' + name + '.data'
            inventory.append({'member': info.filename, 'size': len(raw), 'compressedSize': info.compress_size,
                              'sha256': sha(raw), 'crc32': f'{info.CRC:08x}', 'directory': directory,
                              'path': target, 'originalMode': oct(mode)})
            if not directory:
                files[name] = raw
    return files, {'archiveSha256': sha(data), 'archiveSize': len(data), 'members': inventory}


class Output:
    """Writes only below the chosen root, rejects symlinks and executable modes."""
    def __init__(self, root):
        self.root = Path(os.path.abspath(root))
        for p in (self.root, *self.root.parents):
            require(not p.is_symlink(), f'symlink output ancestor: {p}')
        self.root.mkdir(parents=True, exist_ok=True)

    def put(self, relative, data):
        safe_name(relative)
        p = self.root / relative
        for ancestor in (p, *p.parents):
            require(not ancestor.is_symlink(), f'symlink output: {ancestor}')
            if ancestor == self.root:
                break
        p.parent.mkdir(parents=True, exist_ok=True)
        if p.exists():
            require(p.is_file() and p.stat().st_nlink == 1, 'unsafe existing output file')
        fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'wb') as f:
            os.fchmod(f.fileno(), 0o600)
            f.write(data)
        return relative

    def json(self, relative, data):
        return self.put(relative, (json.dumps(data, indent=2, ensure_ascii=True) + '\n').encode())


def palette(data):
    require(len(data) == 768 and max(data) <= 63, 'invalid VGA palette')
    return bytes(round(v * 255 / 63) for v in data)


def lzss(data, start=768, expected=64000):
    require(0 <= start < len(data), 'missing LZSS stream')
    ring, defined, out = bytearray(4096), bytearray(4096), bytearray()
    cursor, p, tokens = 4078, start, []
    def emit(value):
        nonlocal cursor
        require(len(out) < expected, 'LZSS output overflow')
        out.append(value)
        ring[cursor], defined[cursor] = value, 1
        cursor = (cursor + 1) & 4095
    while p < len(data):
        flags = data[p]
        p += 1
        require(p < len(data), 'empty LZSS flag group')
        for bit in range(8):
            if p == len(data):
                break
            begin, output_begin = p, len(out)
            if flags & (1 << bit):
                emit(data[p])
                p += 1
            else:
                require(p + 2 <= len(data), 'truncated LZSS reference')
                a, b = data[p:p+2]
                p += 2
                pos, count = a | ((b & 240) << 4), (b & 15) + 3
                for k in range(count):
                    index = (pos + k) & 4095
                    require(defined[index], 'unknown initial LZSS dictionary byte')
                    emit(ring[index])
            tokens.append([output_begin, len(out), begin, p])
    require(len(out) == expected, 'LZSS output size mismatch')
    return bytes(out), tokens


def png(width, height, pixels, pal):
    require(0 < width <= 4096 and 0 < height <= 4096 and width * height == len(pixels), 'PNG geometry')
    require(len(pal) == 768, 'PNG palette size')
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    scan = b''.join(b'\0' + pixels[y*width:(y+1)*width] for y in range(height))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 3, 0, 0, 0))
            + chunk(b'PLTE', pal) + chunk(b'IDAT', zlib.compress(scan, 9)) + chunk(b'IEND', b''))


def sprite_records(index, data):
    entries = []
    for line in index.decode('ascii').splitlines():
        match = re.fullmatch(r'([A-Za-z0-9_]+):([0-9]+)', line)
        require(match is not None, 'invalid GSK index line')
        entries.append((match[1], int(match[2])))
    require(entries and len(entries) <= 2048, 'invalid sprite count')
    require(len({e[0] for e in entries}) == len(entries), 'duplicate sprite name')
    for i, (name, off) in enumerate(entries):
        end = entries[i+1][1] if i+1 < len(entries) else len(data)
        require(0 <= off and off + 10 <= end <= len(data), 'sprite record bounds')
        x, y, w, h = struct.unpack_from('<4H', data, off)
        require(w > 0 and h > 0 and w <= 1024 and h <= 1024, 'sprite dimensions')
        require(off + 10 + w*h == end, 'sprite size mismatch')
        pixels = data[off+8:end-2]
        checksum = int.from_bytes(data[end-2:end], 'little')
        require(sum(pixels) & 65535 == checksum, 'sprite checksum mismatch')
        yield {'index': i, 'name': name, 'offset': off, 'offsetHex': hex(off), 'end': end,
               'headerWords': [x, y, w, h], 'width': w, 'height': h, 'checksum16': checksum}, pixels


def animation_records(data):
    """ANI table entries reference checksum-free, uncompressed indexed rasters."""
    require(len(data) >= 16, 'truncated ANI')
    first = struct.unpack_from('<I', data, 4)[0]
    require(16 <= first <= len(data) and first % 8 == 0, 'ANI table bounds')
    rows = list(struct.iter_unpack('<hhI', data[:first]))
    require(rows[-1] == (0, 0, 0), 'missing ANI table terminator')
    require(all(first <= row[2] < len(data) for row in rows[:-1]), 'ANI raster reference bounds')
    offsets = sorted({row[2] for row in rows[:-1]})
    require(offsets[0] == first, 'ANI raster start mismatch')
    frames = []
    for i, (offset, end) in enumerate(zip(offsets, offsets[1:] + [len(data)])):
        require(offset+8 <= end, 'truncated ANI raster')
        x, y, w, h = struct.unpack_from('<4H', data, offset)
        require(0 < w <= 1024 and 0 < h <= 1024 and offset+8+w*h == end, 'ANI raster geometry')
        frames.append(({'index': i, 'offset': offset, 'offsetHex': hex(offset), 'end': end,
                        'headerWords': [x,y,w,h], 'width': w, 'height': h}, data[offset+8:end]))
    lookup = {off: i for i, off in enumerate(offsets)}
    table = [{'index': i, 'tableOffset': i*8, 'word0Signed': a, 'word1Signed': b,
              'rasterOffset': offset, 'frameIndex': lookup[offset]} for i,(a,b,offset) in enumerate(rows[:-1])]
    return table, frames


def lessons(data):
    require(data.startswith(b'~') and data.endswith(b'\x1a') and all(v < 128 for v in data), 'invalid LEE framing/encoding')
    require(b'\x1a' not in data[:-1], 'interior LEE EOF')
    markers = [i for i, v in enumerate(data[:-1]) if v == 126]
    return [{'index': i, 'delimiterOffset': start, 'byteSpan': [start+1, end],
             'rawText': data[start+1:end].decode('ascii')}
            for i, (start, end) in enumerate(zip(markers, markers[1:] + [len(data)-1]))]


def messages(data):
    require(len(data) >= 4, 'truncated MSD header')
    count, length = struct.unpack_from('<HH', data)
    start = 4 + count * 4
    require(start + length == len(data), 'MSD payload bounds')
    records, ids, offsets = [], set(), set()
    for i in range(count):
        ident, offset = struct.unpack_from('<HH', data, 4+i*4)
        require(offset < length and ident not in ids and offset not in offsets, 'invalid MSD index')
        end = data.find(b'\0', start + offset)
        require(end >= 0, 'unterminated MSD string')
        ids.add(ident)
        offsets.add(offset)
        records.append({'index': i, 'resourceId': ident, 'tableOffset': 4+i*4,
                        'byteSpan': [start+offset, end], 'text': data[start+offset:end].decode('ascii')})
    return {'payloadOffset': start, 'payloadLength': length, 'records': records}


def mz_metadata(data):
    require(len(data) >= 28 and data[:2] == b'MZ', 'truncated/invalid MZ header')
    names = ['lastPageBytes', 'pages', 'relocationCount', 'headerParagraphs', 'minExtraParagraphs',
             'maxExtraParagraphs', 'initialSS', 'initialSP', 'checksum', 'initialIP', 'initialCS', 'relocationOffset', 'overlay']
    m = dict(zip(names, struct.unpack_from('<13H', data, 2)))
    header = m['headerParagraphs'] * 16
    image_end = (m['pages']-1)*512 + (m['lastPageBytes'] or 512)
    require(m['lastPageBytes'] < 512 and 28 <= header <= image_end <= len(data), 'invalid MZ declared bounds')
    reloc_start, count = m['relocationOffset'], m['relocationCount']
    require(28 <= reloc_start <= header and reloc_start + count*4 <= header, 'MZ relocation bounds')
    relocations = []
    for i in range(count):
        offset, segment = struct.unpack_from('<HH', data, reloc_start + i*4)
        target = header + segment * 16 + offset
        require(target + 2 <= image_end, 'MZ relocation target out of image')
        relocations.append({'tableFileOffset': hex(reloc_start+i*4), 'segment': segment, 'offset': offset, 'targetFileOffset': hex(target)})
    m.update({'headerBytes': header, 'declaredImageEnd': image_end, 'trailingBytes': len(data)-image_end,
              'entryFileOffset': hex(header + m['initialCS']*16 + m['initialIP']), 'relocations': relocations,
              'interpretation': 'DOS MZ structure only; no relocation applied and no instructions executed.'})
    return m


def voc_metadata(data):
    require(len(data) >= 26 and data[:20] == b'Creative Voice File\x1a', 'invalid VOC header')
    p, version, check = struct.unpack_from('<HHH', data, 20)
    require(26 <= p < len(data) and check == ((~version + 0x1234) & 65535), 'invalid VOC version/bounds')
    blocks = []
    while p < len(data):
        begin, kind = p, data[p]
        p += 1
        if kind == 0:
            blocks.append({'offset': begin, 'type': 0})
            break
        require(p+3 <= len(data), 'truncated VOC length')
        size = int.from_bytes(data[p:p+3], 'little')
        p += 3
        require(p+size <= len(data), 'truncated VOC block')
        block = {'offset': begin, 'type': kind, 'byteSpan': [p, p+size]}
        if kind == 1:
            require(size >= 2, 'truncated VOC sound header')
            tc, codec = data[p:p+2]
            block.update({'timeConstant': tc, 'codec': codec, 'sampleRateHz': 1000000/(256-tc), 'sampleSpan': [p+2, p+size]})
        blocks.append(block)
        p += size
    require(blocks and blocks[-1]['type'] == 0, 'missing VOC terminator')
    return {'version': version, 'blocks': blocks, 'unparsedTail': len(data)-p, 'playback': 'Never played; metadata only.'}


def build(archive, destination):
    files, inventory = read_archive(archive)
    out = Output(destination)
    completion = out.root / 'manifest.json'
    require(not completion.is_symlink(), 'symlink completion manifest')
    if completion.exists():
        completion.unlink()
    for record in inventory['members']:
        if not record['directory']:
            out.put(record['path'], files[record['member']])
    out.json('archive-manifest.json', inventory)
    manifest = {'schemaVersion': 1, 'archiveSha256': EXPECTED_SHA256,
                'pathBase': 'Directory containing this manifest',
                'rights': 'Original game material, local use only. Not covered by repository MIT license. Do not publish.',
                'backgrounds': [], 'sprites': [], 'palettes': [], 'fonts': [], 'lessons': [],
                'messages': [], 'help': [], 'executables': [], 'audio': [], 'animations': [], 'unresolved': []}
    def provenance(member):
        return {'member': member, 'memberSha256': sha(files[member]), 'rawPath': 'raw/'+member+'.data'}
    palettes = {}
    for member, data in files.items():
        suffix, stem = Path(member).suffix.upper(), Path(member).stem
        if suffix in ('.CRX', '.GPO'):
            raw = data[:768]
            pal = palette(raw)
            name = Path(member).name
            palettes[member] = pal
            path = out.json('palettes/'+name+'.json', {'name': name, **provenance(member), 'byteSpan': [0,768],
                            'rgb6': list(raw), 'rgb8': list(pal), 'conversion': 'round(channel * 255 / 63)', 'runtimeBinding': 'unproven'})
            manifest['palettes'].append({'name': name, 'path': path, **provenance(member)})
        if suffix == '.CRX':
            pixels, tokens = lzss(data)
            path = out.put('backgrounds/'+stem+'.png', png(320, 200, pixels, palettes[member]))
            indices = out.put('backgrounds/'+stem+'.indices.data', pixels)
            token_path = out.json('backgrounds/'+stem+'.tokens.json', tokens)
            manifest['backgrounds'].append({'name': stem, 'path': path, 'indicesPath': indices, 'tokenPath': token_path,
                'width': 320, 'height': 200, 'pixelSha256': sha(pixels), 'palette': Path(member).name,
                'paletteBinding': 'Embedded palette', **provenance(member)})
        if suffix == '.LEE':
            records = lessons(data)
            path = out.json('text/'+stem+'.json', {**provenance(member), 'records': records, 'eofOffset': len(data)-1})
            manifest['lessons'].append({'name': stem, 'path': path, 'recordCount': len(records), **provenance(member)})
        if suffix == '.MSD':
            parsed = messages(data)
            path = out.json('text/'+stem+'.json', {**provenance(member), **parsed})
            manifest['messages'].append({'path': path, 'recordCount': len(parsed['records']), **provenance(member)})
        if suffix == '.HLP':
            text = data.decode('ascii')
            # Preserve control tags and exact CRLF; tag interpretation is deliberately separate.
            tags = [{'offset': m.start(), 'text': m.group().decode()} for m in re.finditer(rb'<[0-9]+>', data)]
            path = out.json('text/'+stem+'.json', {**provenance(member), 'text': text, 'numericTags': tags,
                           'tagMeaning': 'Not established by resource bytes alone'})
            manifest['help'].append({'path': path, **provenance(member)})
        if data[:2] == b'MZ':
            path = out.json('metadata/'+Path(member).name+'.mz.json', {**provenance(member), **mz_metadata(data)})
            manifest['executables'].append({'path': path, **provenance(member)})
        if suffix == '.VOC':
            path = out.json('metadata/'+Path(member).name+'.json', {**provenance(member), **voc_metadata(data)})
            manifest['audio'].append({'path': path, **provenance(member)})
        elif suffix in ('.XMI', '.RS', '.PC', '.ADL', '.PCS', '.RLD', '.AD', '.MT', '.OPL') or stem == 'SAMPLE':
            manifest['audio'].append({**provenance(member), 'size': len(data), 'headerHex': data[:32].hex(), 'status': 'retained, synthesis/encoding unresolved'})
        if suffix in ('.BAN', '.BGS', '.GCO', '.GCK', '.CMP'):
            manifest['unresolved'].append({**provenance(member), 'size': len(data), 'headerHex': data[:32].hex(),
                                          'status': 'retained; decoding and runtime semantics unresolved'})
    for member, data in files.items():
        if member.endswith('.ANI'):
            table, frames = animation_records(data)
            stem = Path(member).stem
            # Export neutral index previews instead of asserting character palette binding.
            neutral = bytes(c for v in range(256) for c in (v,v,v))
            rasters = []
            for record, pixels in frames:
                base = 'animations/'+stem+'-'+str(record['index']).zfill(3)
                path = out.put(base+'.png', png(record['width'], record['height'], pixels, neutral))
                indices = out.put(base+'.indices.data', pixels)
                rasters.append({**record, 'path': path, 'indicesPath': indices, 'pixelSha256': sha(pixels)})
            path = out.json('animations/'+stem+'.json', {**provenance(member), 'table': table, 'frames': rasters,
                'terminatorOffset': len(table)*8, 'palette': 'synthetic index grayscale, not game colors',
                'interpretation': 'Exact table order and raster references. First two words retained without coordinate/timing semantics. Runtime ordering, speed and bindings unresolved.'})
            manifest['animations'].append({'name': stem, 'path': path, 'tableEntries': len(table), 'frameCount': len(frames), **provenance(member)})
    for member, index in files.items():
        if not member.endswith('.GSK'):
            continue
        source, stem = member[:-3]+'GSO', Path(member).stem
        require(source in files, 'missing GSO for GSK')
        data = files[source]
        pal_member = PREFIX + stem + '.CRX'
        if pal_member not in palettes:
            pal_member = PREFIX + stem + '.GPO'
        if pal_member not in palettes:
            pal_member = PREFIX + 'MPALLET.GPO'
        for record, pixels in sprite_records(index, data):
            name = stem + '-' + record['name']
            path = out.put('sprites/'+name+'.png', png(record['width'], record['height'], pixels, palettes[pal_member]))
            indices = out.put('sprites/'+name+'.indices.data', pixels)
            manifest['sprites'].append({**record, 'family': stem, 'path': path, 'indicesPath': indices,
                'pixelSha256': sha(pixels), 'palette': Path(pal_member).name, 'paletteBinding': 'Preview only, basename match or MPALLET fallback; runtime binding unproven',
                'transparency': 'None applied. Original mask semantics unresolved.', 'indexMember': member,
                'indexSha256': sha(index), **provenance(source)})
    for member, data in files.items():
        if member.endswith('.FNT'):
            fields = {}
            for line in data.decode('ascii').splitlines():
                match = re.fullmatch(r'([FNWH])([0-9]+)', line)
                require(match is not None and match[1] not in fields, 'invalid FNT metrics')
                fields[match[1]] = int(match[2])
            require(set(fields) == set('FNWH'), 'missing FNT metrics')
            family = Path(member).stem
            glyphs = [s for s in manifest['sprites'] if s['family'] == family]
            require(len(glyphs) == fields['N'], 'font glyph count mismatch')
            mapped = []
            for glyph in glyphs:
                match = re.fullmatch(r'font[0-9]+_([0-9]+)', glyph['name'])
                require(match is not None, 'unknown font glyph name')
                code = int(match[1])
                mapped.append({'code': code, 'spriteIndex': glyph['index'], 'path': glyph['path'], 'indicesPath': glyph['indicesPath'],
                               'width': glyph['width'], 'height': glyph['height']})
            require(sorted(g['code'] for g in mapped) == list(range(fields['F'], fields['F']+fields['N'])), 'font code range mismatch')
            path = out.json('fonts/'+family+'.json', {**provenance(member), 'metrics': fields, 'glyphs': mapped,
                           'interpretation': 'F/N match first code/count; W/H retained as nominal metrics, not proven advance/line-height.'})
            manifest['fonts'].append({'name': family, 'path': path, 'glyphCount': len(mapped)})
    require(len(manifest['backgrounds']) == 20 and len(manifest['sprites']) == 567, 'expected art inventory changed')
    manifest['counts'] = {k: len(v) for k,v in manifest.items() if isinstance(v,list)}
    summary = {'archiveSha256': EXPECTED_SHA256, 'members': len(inventory['members']),
               'files': len(files), 'sourceBytes': sum(map(len, files.values())), **manifest['counts'],
               'lessonRecords': sum(r['recordCount'] for r in manifest['lessons']),
               'messageRecords': sum(r['recordCount'] for r in manifest['messages']),
               'validation': ['ZIP hash and CRCs', 'all member sizes/hashes', 'CRX exact 64000 pixels and defined dictionary references',
                              'all GSK/GSO record boundaries and pixel checksums', 'font code coverage', 'MSD bounds/IDs', 'MZ relocation bounds'],
               'limits': ['No original code executed', 'Sprite preview palettes and transparency are not runtime bindings',
                          'ANI first-word semantics/runtime sequencing, BAN/GCO/BGS and audio synthesis remain unresolved']}
    out.json('evidence-summary.json', summary)
    out.json('manifest.json', manifest)  # Written last; absent after an incomplete build.
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, default=archive_path())
    parser.add_argument('--output', type=Path, default=ROOT/'assets/original')
    args = parser.parse_args()
    try:
        print(json.dumps(build(args.archive, args.output), indent=2))
    except (ValueError, OSError, zipfile.BadZipFile, UnicodeError, struct.error) as error:
        print(f'asset pipeline error: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
