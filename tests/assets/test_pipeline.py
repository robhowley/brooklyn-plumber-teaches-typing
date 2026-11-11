import sys
from pathlib import Path as _Path
sys.path.insert(0, str(_Path(__file__).resolve().parents[2] / 'tools'))
from source import archive_path
"""Newly authored tests. All archive reads are data-only."""
import hashlib
import io
import json
import os
from pathlib import Path
import stat
import struct
import sys
import tempfile
import unittest
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'tools/assets'))
import pipeline as p


class FixtureTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=Path(__file__).parent)
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def archive(self, entries):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as z:
            for name, data in entries:
                z.writestr(name, data)
        data = buffer.getvalue()
        target = self.root/'fixture.zip'
        target.write_bytes(data)
        return target, p.sha(data)

    def test_traversal_and_ambiguous_names_rejected(self):
        for name in ['../bad', '/bad', 'C:/bad', 'a/../bad', 'a\\bad', 'a//bad', './bad', 'a./b', 'a /b', 'bad\nname']:
            with self.subTest(name=name):
                path, digest = self.archive([(name,b'x')])
                with self.assertRaises(ValueError):
                    p.read_archive(path,digest)

    def test_duplicate_and_case_collision(self):
        path, digest = self.archive([('A',b'a'),('a',b'b')])
        with self.assertRaisesRegex(ValueError,'colliding'):
            p.read_archive(path,digest)

    def test_symlink_zip_rejected(self):
        info = zipfile.ZipInfo('link')
        info.create_system = 3
        info.external_attr = (stat.S_IFLNK | 0o777) << 16
        path,digest = self.archive([(info,b'/elsewhere')])
        with self.assertRaisesRegex(ValueError,'non-regular'):
            p.read_archive(path,digest)

    def test_identity_and_crc(self):
        path,digest = self.archive([('a',b'payload')])
        with self.assertRaisesRegex(ValueError,'SHA-256'):
            p.read_archive(path,'0'*64)
        raw = path.read_bytes().replace(b'payload',b'payloae',1)
        path.write_bytes(raw)
        with self.assertRaises(zipfile.BadZipFile):
            p.read_archive(path,p.sha(raw))

    def test_member_limit(self):
        path,digest = self.archive([('a',b'x'*100)])
        old = p.MAX_MEMBER
        try:
            p.MAX_MEMBER = 99
            with self.assertRaisesRegex(ValueError,'size limit'):
                p.read_archive(path,digest)
        finally:
            p.MAX_MEMBER = old

    def test_every_file_inert(self):
        path,digest = self.archive([('run.EXE',b'MZ'),('run.BAT',b'echo a'),('unknown',b'#!')])
        files, manifest = p.read_archive(path,digest)
        self.assertEqual(len(files),3)
        self.assertTrue(all(r['path'].endswith('.data') for r in manifest['members']))

    def test_output_symlinks_hardlinks_and_permissions(self):
        out = p.Output(self.root/'out')
        out.put('a.data',b'abc')
        self.assertEqual((out.root/'a.data').stat().st_mode & 0o777,0o600)
        (out.root/'link').symlink_to(self.root,target_is_directory=True)
        with self.assertRaisesRegex(ValueError,'symlink'):
            out.put('link/escape',b'x')
        os.link(out.root/'a.data',out.root/'hard')
        with self.assertRaisesRegex(ValueError,'unsafe existing'):
            out.put('hard',b'x')
        with self.assertRaises(ValueError):
            out.put('../escape',b'x')

    def test_lzss_literal_and_overlapping_copy(self):
        # Flag bit 0 literal A, then copy 5 bytes from ring offset 4078.
        output,tokens = p.lzss(b'\x01A\xee\xf2',0,6)
        self.assertEqual(output,b'AAAAAA')
        self.assertEqual(tokens,[[0,1,1,2],[1,6,2,4]])
        for data,expected in [(b'\0\0\0',3),(b'\0\x01',3),(b'\1A',2),(b'\1A',0),(b'\1',1)]:
            with self.subTest(data=data,expected=expected), self.assertRaises(ValueError):
                p.lzss(data,0,expected)

    def test_palette_and_png(self):
        palette = bytes([0,32,63])*256
        rgb = p.palette(palette)
        self.assertEqual(rgb[:3],bytes([0,130,255]))
        image = p.png(2,1,b'\x00\xff',rgb)
        self.assertEqual(image[:8],b'\x89PNG\r\n\x1a\n')
        with self.assertRaises(ValueError):
            p.palette(bytes([64])*768)

    def test_sprite_bounds_checksum_and_index(self):
        data = struct.pack('<4H',1,2,2,1)+b'\x03\x04'+struct.pack('<H',7)
        records = list(p.sprite_records(b'frame:0\r\n',data))
        self.assertEqual(records[0][0]['width'],2)
        self.assertEqual(records[0][1],b'\x03\x04')
        for index,raw in [(b'../bad:0',data),(b'frame:999',data),(b'frame:0',data[:-1]),(b'frame:0',data[:-2]+b'\0\0')]:
            with self.subTest(index=index),self.assertRaises(ValueError):
                list(p.sprite_records(index,raw))

    def test_text_exactness(self):
        raw = b'~ Hello  \r\n~a`B! \x1a'
        records = p.lessons(raw)
        reconstructed = b''.join(b'~'+r['rawText'].encode('ascii') for r in records)+b'\x1a'
        self.assertEqual(reconstructed,raw)
        for raw in [b'no tilde\x1a',b'~no eof',b'~\x1a~\x1a']:
            with self.assertRaises(ValueError):
                p.lessons(raw)

    def test_msd_bounds_and_termination(self):
        raw = struct.pack('<4H',1,3,12,0)+b'Hi\0'
        self.assertEqual(p.messages(raw)['records'][0]['text'],'Hi')
        for raw in [b'',raw[:-1],raw[:-1]+b'x',struct.pack('<4H',1,3,12,3)+b'Hi\0']:
            with self.assertRaises(ValueError):
                p.messages(raw)

    def test_ani_table_and_raster_bounds(self):
        raw = struct.pack('<hhI',5,-2,16)+bytes(8)+struct.pack('<4H',0,0,2,1)+b'\x02\x03'
        table,frames = p.animation_records(raw)
        self.assertEqual(table[0]['word1Signed'],-2)
        self.assertEqual(frames[0][1],b'\x02\x03')
        for raw in [raw[:-1],raw[:8],b'\0'*20]:
            with self.assertRaises(ValueError):
                p.animation_records(raw)

    def test_mz_and_voc_malformed(self):
        for raw in [b'MZ',b'MZ'+bytes(100)]:
            with self.assertRaises(ValueError):
                p.mz_metadata(raw)
        with self.assertRaises(ValueError):
            p.voc_metadata(b'Creative Voice File\x1a'+bytes(10))


class GeneratedBundleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = ROOT/'assets/original'
        cls.manifest = json.loads((cls.base/'manifest.json').read_text())
        cls.inventory = json.loads((cls.base/'archive-manifest.json').read_text())

    def test_complete_inventory_and_inert_raw(self):
        self.assertEqual(self.inventory['archiveSha256'],p.EXPECTED_SHA256)
        self.assertEqual(len(self.inventory['members']),177)
        for record in self.inventory['members']:
            if record['directory']:
                continue
            path = self.base/record['path']
            raw = path.read_bytes()
            self.assertEqual(len(raw),record['size'])
            self.assertEqual(p.sha(raw),record['sha256'])
            self.assertFalse(path.stat().st_mode & 0o111)

    def test_all_png_pixels_and_palettes(self):
        for record in self.manifest['backgrounds']+self.manifest['sprites']:
            raw = (self.base/record['path']).read_bytes()
            pos, compressed, palette = 8,bytearray(),None
            while pos < len(raw):
                length = int.from_bytes(raw[pos:pos+4],'big')
                kind = raw[pos+4:pos+8]
                data = raw[pos+8:pos+8+length]
                crc = int.from_bytes(raw[pos+8+length:pos+12+length],'big')
                self.assertEqual(zlib.crc32(kind+data)&0xffffffff,crc)
                if kind == b'IHDR':
                    self.assertEqual(struct.unpack('>IIBBBBB',data),(record['width'],record['height'],8,3,0,0,0))
                if kind == b'PLTE': palette = data
                if kind == b'IDAT': compressed.extend(data)
                pos += 12+length
            scan = zlib.decompress(compressed)
            width = record['width']
            self.assertEqual(len(scan),(width+1)*record['height'])
            pixels = b''.join(scan[y*(width+1)+1:(y+1)*(width+1)] for y in range(record['height']))
            self.assertEqual(p.sha(pixels),record['pixelSha256'])
            self.assertEqual(pixels,(self.base/record['indicesPath']).read_bytes())
            pal = json.loads((self.base/'palettes'/ (record['palette']+'.json')).read_text())
            self.assertEqual(palette,bytes(pal['rgb8']))

    def test_counts_and_corpus_roundtrip(self):
        self.assertEqual(len(self.manifest['backgrounds']),20)
        self.assertEqual(len(self.manifest['sprites']),567)
        self.assertEqual(len(self.manifest['fonts']),4)
        self.assertEqual(len(self.manifest['lessons']),15)
        self.assertEqual(len(self.manifest['animations']),9)
        for lesson in self.manifest['lessons']:
            parsed = json.loads((self.base/lesson['path']).read_text())
            reconstructed = b''.join(b'~'+r['rawText'].encode() for r in parsed['records'])+b'\x1a'
            self.assertEqual(reconstructed,(self.base/lesson['rawPath']).read_bytes())
        for message in self.manifest['messages']:
            parsed = json.loads((self.base/message['path']).read_text())
            raw = (self.base/message['rawPath']).read_bytes()
            for record in parsed['records']:
                a,b = record['byteSpan']
                self.assertEqual(record['text'].encode(),raw[a:b])

    def test_rebuild_byte_identical_from_fresh_archive(self):
        archive = archive_path()
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as temporary:
            rebuilt = Path(temporary)/'bundle'
            p.build(archive,rebuilt)
            expected = {f.relative_to(self.base): p.sha(f.read_bytes()) for f in self.base.rglob('*') if f.is_file()}
            actual = {f.relative_to(rebuilt): p.sha(f.read_bytes()) for f in rebuilt.rglob('*') if f.is_file()}
            self.assertEqual(actual,expected)

    def test_animation_rasters_and_references(self):
        for animation in self.manifest['animations']:
            parsed = json.loads((self.base/animation['path']).read_text())
            raw = (self.base/animation['rawPath']).read_bytes()
            for frame in parsed['frames']:
                pixels = (self.base/frame['indicesPath']).read_bytes()
                self.assertEqual(pixels,raw[frame['offset']+8:frame['end']])
            for row in parsed['table']:
                self.assertEqual(row['rasterOffset'],parsed['frames'][row['frameIndex']]['offset'])


if __name__ == '__main__':
    unittest.main()
