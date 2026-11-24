"""Independent MSVC probes and compact native-data oracle commitments.

Oracle digests commit every frame/packet/palette and PCM chunk from independent
verify-codecs/video_check.py, compared with media-next/codecs_new.py on all314
LOGO/INTRO frames. No research reader/file is needed to reproduce these tests.
Source identity and selector FILE offsets are in pins.json.
"""
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
import wave
import zlib

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'tools'))
import build
import decode
from source import Source


def digest(value):
    return hashlib.sha256(json.dumps(value, separators=(',', ':')).encode()).hexdigest()


class CodecTests(unittest.TestCase):
    def test_solid_and_allowed_trailers(self):
        for trailer in (b'', b'\0\0'):
            self.assertEqual(decode.msvc8(b'\x25\x80'+trailer, 4, 4),
                             (bytes([37])*16, 2+len(trailer)))

    def test_two_color_inverse_flags_and_bottom_up_rows(self):
        # Bits describe bottom row first. Set means first color, not second.
        raw = bytes([0x21, 0x04, 11, 22])
        self.assertEqual(decode.msvc8(raw, 4, 4)[0], bytes([
            22,22,22,22, 22,22,11,22, 22,11,22,22, 11,22,22,22]))

    def test_eight_color_quadrants_and_inversion(self):
        # Top transmitted nibble 9 also identifies eight-color mode. Test its
        # two set flags as well as all four quadrant color pairs.
        self.assertEqual(decode.msvc8(bytes([0,0x90,10,11,20,21,30,31,40,41]),4,4)[0],
                         bytes([30,31,41,40, 31,31,41,41, 11,11,21,21, 11,11,21,21]))

    def test_retained_blocks_and_bottom_up_block_order(self):
        initial = decode.msvc8(bytes([1,128,2,128,3,128,4,128]),8,8)[0]
        self.assertEqual(initial, bytes([3]*4+[4]*4)*4+bytes([1]*4+[2]*4)*4)
        updated = decode.msvc8(bytes([2,132,9,128,1,132]),8,8,initial)[0]
        self.assertEqual(updated, bytes([9]*4+[4]*4)*4+bytes([1]*4+[2]*4)*4)
        self.assertEqual(initial, bytes([3]*4+[4]*4)*4+bytes([1]*4+[2]*4)*4)

    def test_refusals(self):
        for w,h,previous in ((0,4,None),(4,0,None),(3,4,None),(4,5,None),
                             (4096,4100,None),(4,4,b'bad')):
            with self.subTest(shape=(w,h)), self.assertRaises(decode.Invalid):
                decode.msvc8(b'\x01\x80',w,h,previous)
        for raw,previous in ((b'\x01\x84',None),(b'\0\x84',bytes(16)),
                             (b'\x02\x84',bytes(16)),(b'',None),(b'\0',None),
                             (b'\0\0\x01',None),(b'\0\x90'+bytes(7),None),
                             (b'\x01\x80\x01\0',None),(b'\x01\x80\0',None),
                             (b'\x01\x80\0\0\0',None)):
            with self.subTest(raw=raw), self.assertRaises(decode.Invalid):
                decode.msvc8(raw,4,4,previous)
        with self.assertRaises(decode.Invalid):
            decode.msvc8(b'\x01\x80',8,4)  # incomplete block coverage


@unittest.skipUnless(os.environ.get('MARIO2_TEST_ISO'), 'set MARIO2_TEST_ISO for native startup oracle')
class StartupDiscTests(unittest.TestCase):
    def test_all_native_data(self):
        pins = json.loads(build.PINS.read_text())
        source = Source(pins, os.environ['MARIO2_TEST_ISO'])
        old = decode.HERE
        try:
            with tempfile.TemporaryDirectory() as tmp:
                decode.HERE = Path(tmp)
                # Per-frame projection: index, FILE payload offset, packet size/hash,
                # top-down native index plane hash, RGB palette hash. Compact
                # commitments avoid checking generated numerical tables into Git.
                for selector,count,frames_hash,chunks_hash,pcm_hash in (
                    (0,48,'f86e76b82f0daa379ccae3884bcfaf34e5b8d7224ab9943a79eccd23a07df8ff',
                     'cff44c3000f3ac695d47d61831fc33cccf17180bbc5ef12034060df66d328d46',
                     '66dea79ba6c91597f9f36322231720e01962c6e2c9af51ff87f36503e35f6811'),
                    (1,266,'f6af163c9edd0552080dbf2c573728e392d5b6c3f60a2fceacdde5f9ce0876ea',
                     'c87d862c3e76e555396fea8b9ddafcfa2aef5e970284d27e3948bf7302cbf271',
                     '212bf7ba466991280affc6b2741c6dff96831b6872da0369297613997b4bfd9d')):
                    a = next(a for a in pins['assets'] if a['id']==f'movies-{selector}')
                    raw = source.read(a['source'])
                    out = decode.Outputs(a['source']['sha256'])
                    result = decode.decode_avi(raw,out)
                    self.assertEqual(result['status'],'decoded')
                    samples = [s for s in result['samples'] if s['tag'].endswith(('dc','db'))]
                    packed = (out.dir/'frames.zlib').read_bytes()
                    rows = []
                    for frame,sample in zip(result['decoded_frames'],samples,strict=True):
                        plane = zlib.decompress(packed[frame['output_offset']:frame['output_offset']+frame['compressed_bytes']])
                        rows.append([frame['frame'],sample['file_offset'],sample['size'],sample['sha256'],
                                     decode.sha(plane),decode.sha(bytes.fromhex(frame['palette_rgb_hex']))])
                    self.assertEqual(len(rows),count)
                    self.assertEqual(digest(rows),frames_hash,a['id'])
                    chunks = [s for s in result['samples'] if s['tag'].endswith('wb')]
                    self.assertEqual(digest([[s['file_offset'],s['size'],s['sha256']] for s in chunks]),chunks_hash)
                    with wave.open(str(out.dir/'stream-1-audio.wav'),'rb') as wav:
                        self.assertEqual(decode.sha(wav.readframes(wav.getnframes())),pcm_hash)
                    video = next(s for s in result['streams'] if s['type']=='vids')
                    self.assertEqual((video['length'],video['scale'],video['rate']),
                                     (count,66667 if selector==0 else 83333,1000000))
                for index,pixels_hash,palette_hash in (
                    (485,'5bf81437b922b7728dccda0391a923a6b4ed0766c87b2a730e63d53e6706bfb0',
                     '68dff72189a4c726ab8f9938c94e603838bae80208885317309574257851949d'),
                    (613,'7c9396bed759c383b2279966add4723a5e1ed2e576b15436e450ecf6df307de2',
                     'd18b129068ca42e3ce8a0c757c9dd7d26c804844c7a303633ae7fadfd2f225e6')):
                    a = next(a for a in pins['assets'] if a['id']==f'ne-2-{index}')
                    out = decode.Outputs(a['source']['sha256'])
                    result = decode.decode_dib(source.read(a['source']),out)
                    self.assertEqual(result['decoded_sha256'],pixels_hash)
                    self.assertEqual(decode.sha(bytes(x for rgb in result['image']['palette'] for x in rgb)),palette_hash)
                    self.assertEqual(result['trailing_bytes'],472)
        finally:
            source.close()
            decode.HERE = old
