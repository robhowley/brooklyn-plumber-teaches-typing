"""Independent fixtures plus optional real-disc rebuild/audit (MARIO2_TEST_ISO)."""
import copy
import hashlib
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
import unittest
import wave
import zlib

TOOLS = Path(__file__).resolve().parents[1] / 'tools'
sys.path.insert(0, str(TOOLS))
import build
import decode
import reference_avi
from source import Source, check, expand_szdd, normalize_lesson

PINS = json.loads(build.PINS.read_text())


class UnitTests(unittest.TestCase):
    def test_pin_set(self):
        build.validate_pins(PINS)
        # Independent verify-express/joins.json projection: selector, consumer
        # FILE offset, exact member and member SHA256 for all 38 original joins.
        identities = sorted((int(a['id'].split('-')[1]),a['join']['file_offset'],
                             a['source']['path'],a['source']['sha256'])
                            for a in PINS['assets'] if a['kind']=='movies' and 14 <= int(a['id'].split('-')[1]) <= 61 and a['id']!='movies-47')
        self.assertEqual(len(identities),38)
        self.assertEqual(hashlib.sha256(json.dumps(identities,separators=(',',':')).encode()).hexdigest(),
                         'c75aba1876fd78c86f52a2fa72cf73dd8921dac48f439bb5c443fe3907a9b031')
        for identity in ('movies-0', 'movies-1', 'ne-2-485', 'ne-2-613'):
            pins = copy.deepcopy(PINS)
            pins['assets'] = [a for a in pins['assets'] if a['id'] != identity]
            with self.subTest(missing=identity), self.assertRaises(ValueError):
                build.validate_pins(pins)
        for field in ('assets', 'lessons'):
            pins = copy.deepcopy(PINS)
            pins[field].pop()
            with self.assertRaises(ValueError):
                build.validate_pins(pins)
        with self.assertRaises(ValueError):
            check(b'wrong', {'size':5,'sha256':'0'*64}, 'fixture')

    def test_source_failures(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'source.iso'
            with self.assertRaises(FileNotFoundError):
                Source(PINS, path)
            path.write_bytes(b'not the disc')
            with self.assertRaisesRegex(ValueError, 'ISO'):
                Source(PINS, path)

    def test_dib_orientation_padding_and_bits(self):
        for height in (2,-2):
            palette = bytes(256*4)
            raw = struct.pack('<IiiHHIIiiII',40,3,height,1,8,0,8,0,0,256,0)+palette+bytes([1,2,3,99,4,5,6,88])
            h = decode.unpack_dib_header(raw)
            pixels, end, mode = decode.dib_pixels(raw,h)
            self.assertEqual(pixels, bytes([4,5,6,1,2,3] if height>0 else [1,2,3,4,5,6]))
            self.assertEqual(end, len(raw))
            self.assertEqual(mode, 'indexed8-top-down')

    def test_rle_delta_and_key_indices(self):
        pixels, used = decode.rle8(bytes([0,2,1,0,2,77,0,1]),4,1,bytes([10,20,30,40]))
        self.assertEqual(pixels, bytes([10,77,77,40]))
        self.assertEqual(used,8)
        with self.assertRaises(ValueError):
            decode.rle8(bytes([5,77,0,1]),4,1)

    def test_rle_multiline_literal_padding_and_retention(self):
        # Bottom row literal (odd count plus pad), EOL, top row run, EOB.
        raw = bytes([0,3,1,2,3,0,0,0,3,4,0,1])
        expected = bytes([4,4,4,1,2,3])
        self.assertEqual(decode.rle8(raw,3,2)[0], expected)
        rows = [bytearray(3), bytearray(3)]
        self.assertEqual(reference_avi.rle_frame(raw,rows,set()), expected)
        # Skip to top row, overwrite one cell, retain all others across frames.
        delta = bytes([0,2,1,1,1,9,0,1])
        expected_delta = bytes([4,9,4,1,2,3])
        self.assertEqual(decode.rle8(delta,3,2,expected)[0], expected_delta)
        self.assertEqual(reference_avi.rle_frame(delta,rows,set()), expected_delta)

    def test_szdd_literal_overlap_and_invalid(self):
        # Three literal bytes then an overlapping ring copy: abcabcabc.
        data = b'SZDD\x88\xf0\x27\x33A\0'+struct.pack('<I',9)+b'\x07abc\xf0\xf3'
        self.assertEqual(expand_szdd(data), b'abcabcabc')
        with self.assertRaises(ValueError):
            expand_szdd(data+b'junk')
        with self.assertRaises(ValueError):
            expand_szdd(b'not szdd')

    def test_normalization_keeps_source_offsets(self):
        text, offsets = normalize_lesson(b'~a\t \r\nb\xe3')
        self.assertEqual(text,b'a bc')
        self.assertEqual(offsets,[1,2,6,7])


@unittest.skipUnless(os.environ.get('MARIO2_TEST_ISO'), 'set MARIO2_TEST_ISO for pinned-disc integration')
class DiscTests(unittest.TestCase):
    def test_clean_build_pins_and_independent_pixels(self):
        iso = os.environ['MARIO2_TEST_ISO']
        old = build.DIST
        with tempfile.TemporaryDirectory(dir=build.ROOT) as tmp:
            build.DIST = Path(tmp)/'dist'
            try:
                build.build(iso)
                def snapshot():
                    return {str(p.relative_to(build.DIST)):hashlib.sha256(p.read_bytes()).hexdigest() for p in build.DIST.rglob('*') if p.is_file()}
                first = snapshot()
                (build.DIST/'stale.exe').write_bytes(b'stale')
                build.build(iso)
                self.assertEqual(first,snapshot())
                manifest = json.loads((build.DIST/'assets.json').read_text())
                self.assertEqual(len(manifest['assets']),337)
                self.assertEqual(len(manifest['lessons']),5)
                runtime = {'index.html','main.js','startup.js','styles.css','setup.js','storage.js','assets.js','render.js','typing.js','media.js','selection.js','report.js','outside-render.js','outside.js'}
                for name in runtime:
                    self.assertEqual((build.DIST/name).read_bytes(), (build.ROOT/name).read_bytes())
                presentation = json.loads((build.DIST/manifest['presentation']['url']).read_text())
                self.assertEqual(presentation['schema'], 'mario2-presentation.v1')
                self.assertEqual(len(presentation['nameKeyFlags']), 256)
                self.assertEqual(set(first), runtime | {'assets.json','presentation.json','font.bin'} |
                                 {url for a in manifest['assets'].values() for url in a['files'].values()})
                self.assertFalse(any(Path(p).suffix.lower() in {'.exe','.iso','.lee','.dll'} for p in first))
                source = Source(PINS,iso)
                try:
                    executable = source.read(PINS['executable'])
                    # Independent FILE 0x20046 setup-list pin, not a supplied mock table.
                    setup = executable[0x20046:0x2005e]
                    self.assertEqual(hashlib.sha256(setup).hexdigest(),
                                     '7a504184809c203f29bce8bddf5b8a085bd3972dbe56ec3983ac56f48c7eacb9')
                    self.assertEqual(presentation['setupMovies'], list(setup))
                    coverage = set()
                    movie_frames = 0
                    beginning_frames = 0
                    for a in PINS['assets']:
                        entry = manifest['assets'][a['id']]
                        if a.get('type') == 2:
                            raw = source.read(a['source'])
                            size,w,h,planes,bits,compression = struct.unpack_from('<IiiHHI',raw)
                            self.assertEqual((size,planes,bits,compression),(40,1,8,0))
                            colors = struct.unpack_from('<I',raw,32)[0] or 256
                            start,stride = 40+colors*4, (w+3)//4*4
                            rows = [raw[start+y*stride:start+y*stride+w] for y in range(abs(h))]
                            expected = b''.join(rows[::-1] if h>0 else rows)
                            actual = zlib.decompress((build.DIST/entry['files']['pixels.zlib']).read_bytes())
                            self.assertEqual(actual,expected,a['id'])
                        if a['kind'] == 'movies':
                            # Read selector-specific placement/key from the original 13-byte
                            # record, independently of the production placement dictionary.
                            off = a['join']['file_offset']
                            selector,x,y,key = struct.unpack_from('<HHHB',executable,off)
                            self.assertEqual(a['id'], f'movies-{selector}')
                            self.assertEqual(entry['placement'],
                                             dict(field_u16_2=x,field_u16_4=y,byte6=key))
                            self.assertEqual(a['placement'],entry['placement'])
                            self.assertEqual(entry['source']['member'],a['source']['path'])
                            self.assertEqual(entry['source']['sha256'],a['source']['sha256'])
                            packed = (build.DIST/entry['files']['frames.zlib']).read_bytes()
                            if selector in (0, 1):
                                continue  # All startup native data is checked in test_startup_codec.
                            expected_frames = reference_avi.frames(source.read(a['source']), coverage)
                            for f, (offset, expected, palette) in zip(entry['data']['decoded_frames'], expected_frames, strict=True):
                                frame = zlib.decompress(packed[f['output_offset']:f['output_offset']+f['compressed_bytes']])
                                self.assertEqual(len(frame),f['width']*f['height'])
                                self.assertEqual(frame, expected, f"{a['id']} {a['source']['sha256']} AVI FILE {offset:#x}")
                                self.assertEqual(f['palette_rgb_hex'],palette,
                                                 f"{a['id']} {a['source']['sha256']} AVI FILE {offset:#x} palette")
                                if selector in (2,3,47,62,63,64,65,66,67,68,69,70): beginning_frames += 1
                                else: movie_frames += 1
                            for name,path in entry['files'].items():
                                if name.endswith('.wav'):
                                    with wave.open(str(build.DIST/path),'rb') as wav:
                                        self.assertGreater(wav.getnframes(),0)
                    self.assertEqual(movie_frames,4541)
                    self.assertGreater(beginning_frames,0)
                    self.assertTrue({'run','literal','eol','delta'} <= coverage, coverage)
                finally:
                    source.close()
                # Failed pins must not leave the preceding dist available.
                for mutation in ('missing','member','join','font','artifact','resource-offset','movie-member','movie-selector','lesson-expanded','lesson-normalized'):
                    pins = copy.deepcopy(PINS)
                    if mutation == 'missing': pins['assets'].pop()
                    if mutation == 'member': pins['assets'][0]['source']['sha256'] = '0'*64
                    if mutation == 'join': next(a for a in pins['assets'] if 'join' in a)['join']['sha256'] = '0'*64
                    if mutation == 'movie-member':
                        movies = [a for a in pins['assets'] if a['kind'] == 'movies']
                        movies[0]['source'] = copy.deepcopy(movies[1]['source'])
                        movies[0]['expected_artifacts'] = copy.deepcopy(movies[1]['expected_artifacts'])
                    if mutation == 'movie-selector':
                        movies = [a for a in pins['assets'] if a['kind'] == 'movies']
                        movies[0]['join'] = copy.deepcopy(movies[1]['join'])
                    if mutation == 'font': pins['font']['sha256'] = '0'*64
                    if mutation == 'artifact': pins['assets'][0]['expected_artifacts'][0]['sha256'] = '0'*64
                    if mutation == 'resource-offset': next(a for a in pins['assets'] if a['kind'] == 'resource')['executable_file_offset'] += 1
                    if mutation == 'lesson-expanded': pins['lessons'][0]['expanded_sha256'] = '0'*64
                    if mutation == 'lesson-normalized': pins['lessons'][0]['normalized_sha256'] = '0'*64
                    pinpath = Path(tmp)/'bad-pins.json'
                    pinpath.write_text(json.dumps(pins))
                    build.DIST.mkdir(exist_ok=True)
                    (build.DIST/'stale').touch()
                    message = {'movie-member':'movie member join mismatch', 'movie-selector':'selector identity mismatch'}.get(mutation, '.*')
                    with self.assertRaisesRegex(ValueError, message):
                        build.build(iso,pinpath)
                    self.assertFalse(build.DIST.exists())
            finally:
                build.DIST = old


if __name__ == '__main__':
    unittest.main()
