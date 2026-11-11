"""Authored decoder checks. Archive members are read only as bytes."""
from pathlib import Path
import hashlib
import importlib.util
import json
import struct
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('audio_decode', ROOT / 'tools/audio/decode.py')
audio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio)


def fixture(samples=bytes(range(256))):
    header = b'Creative Voice File\x1a' + struct.pack('<HHH', 26, 0x010A, 0x1129)
    return header + b'\x01' + (len(samples) + 2).to_bytes(3, 'little') + bytes([200, 0]) + samples + b'\x00'


class DecodeTests(unittest.TestCase):
    def test_pcm_unsigned_bytes_exact_and_rational_rate(self):
        source = fixture()
        pcm, metadata = audio.decode_voc(source)
        self.assertEqual(pcm, bytes(range(256)))
        self.assertEqual(metadata['sampleOffset'], 32)
        self.assertEqual(metadata['sampleEndExclusive'], 288)
        self.assertEqual(metadata['sampleCount'], 256)
        self.assertEqual(metadata['rateNumerator'], 1_000_000)
        self.assertEqual(metadata['rateDenominator'], 56)
        self.assertEqual(metadata['sampleRate'], 1_000_000 / 56)
        self.assertEqual(metadata['durationSeconds'], 256 * 56 / 1_000_000)
        self.assertEqual(metadata['pcmSha256'], hashlib.sha256(bytes(range(256))).hexdigest())
        self.assertEqual(metadata['sourceSha256'], hashlib.sha256(source).hexdigest())

    def test_every_truncation_rejected(self):
        source = fixture(bytes([0, 128, 255]))
        for end in range(len(source)):
            with self.subTest(end=end), self.assertRaises(audio.AudioFormatError):
                audio.decode_voc(source[:end])

    def test_malformed_header_and_size(self):
        source = fixture()
        variants = []
        for at, value in [(0, 0), (19, 0), (20, 25), (20, 27), (22, 9), (24, 0)]:
            changed = bytearray(source); changed[at] = value; variants.append(changed)
        for size in [0, 1, 2, len(source), 0xFFFFFF]:
            changed = bytearray(source); changed[27:30] = size.to_bytes(3, 'little'); variants.append(changed)
        variants.extend([source + b'\x00', source + b'arbitrary', b'\x00' * (audio.MAX_VOC_BYTES + 1)])
        for data in variants:
            with self.subTest(length=len(data)), self.assertRaises(audio.AudioFormatError):
                audio.decode_voc(data)

    def test_unproven_blocks_codecs_rates_never_silently_decode(self):
        source = fixture()
        for kind in [0, 2, 3, 4, 5, 6, 7, 8, 9, 255]:
            data = bytearray(source); data[26] = kind
            with self.subTest(kind=kind), self.assertRaises(audio.AudioFormatError):
                audio.decode_voc(data)
        for codec in [1, 2, 3, 4, 255]:
            data = bytearray(source); data[31] = codec
            with self.subTest(codec=codec), self.assertRaises(audio.AudioFormatError):
                audio.decode_voc(data)
        for rate in [0, 199, 201, 255]:
            data = bytearray(source); data[30] = rate
            with self.subTest(rate=rate), self.assertRaises(audio.AudioFormatError):
                audio.decode_voc(data)
        for kind in [1, 2, 8, 9]:
            with self.assertRaises(audio.AudioFormatError):
                audio.decode_voc(source[:-1] + bytes([kind]))


@unittest.skipUnless(audio.ARCHIVE.exists(), 'owner-supplied archive required')
class ArchiveProofTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        assert hashlib.sha256(audio.ARCHIVE.read_bytes()).hexdigest() == audio.ARCHIVE_SHA256
        cls.zip = zipfile.ZipFile(audio.ARCHIVE)
        cls.exe = cls.zip.read(audio.EXE_MEMBER)
        assert hashlib.sha256(cls.exe).hexdigest() == audio.EXE_SHA256

    @classmethod
    def tearDownClass(cls):
        cls.zip.close()

    def test_supplied_cnf_audio_fields_not_missing_config_defaults(self):
        data = self.zip.read('MarioTea/MARIO/MARIO.CNF')
        self.assertEqual(hashlib.sha256(data).hexdigest(), 'e3805d4f4692d3e70d0e9f3bcbaacbc859127cc175bf8447561682206a0aeacc')
        self.assertEqual(audio.decode_config(data), {'musicDevice': 4, 'effectsDevice': 4, 'speechDevice': 3, 'options': 7})
        for bad in [b'M4\nD3\n', b'M4\nM1\nD3\nF7', b'Mx\nD3\nF7']:
            with self.assertRaises(audio.AudioFormatError):
                audio.decode_config(bad)

    def test_all_four_source_sample_spans_and_independent_digests(self):
        # Counts and PCM hashes were obtained by direct member[32:-1], not decoder output.
        expected = {
            'CONGRATS': (34008, '76b0365ff1be4ab506f00c4e8268bca3d45c4fc15b9e746a0c68fb81dd9f3730'),
            'READY': (40099, '9062799428cd1bb6137b5b610f697c7d23b4b1a0f74d201834d8981098817214'),
            'TOOBAD': (46462, 'dcbcf4afacb589a6febe47b9284a5e30df57143c973a42851d228ce19bc012dc'),
            'WELCOME': (37685, 'bf3583bc217ccd01e40d291a38d55f094e6529cf2f8ed2e90c544e4c66478a2b'),
        }
        for name, (count, digest) in expected.items():
            with self.subTest(name=name):
                data = self.zip.read(f'MarioTea/MARIO/{name}.VOC')
                self.assertEqual(hashlib.sha256(data).hexdigest(), audio.VOC_HASHES[name])
                self.assertEqual(data[20:26], bytes.fromhex('1a000a012911'))
                self.assertEqual(data[26], 1)
                self.assertEqual(int.from_bytes(data[27:30], 'little'), count + 2)
                self.assertEqual(data[30:32], bytes([200, 0]))
                self.assertEqual(data[-1], 0)
                self.assertEqual(len(data), count + 33)
                pcm, metadata = audio.decode_voc(data)
                self.assertEqual(pcm, data[32:-1])
                self.assertEqual(hashlib.sha256(pcm).hexdigest(), digest)
                self.assertEqual(metadata['sampleCount'], count)

    def test_rebuild_inventory_and_outputs_exact(self):
        scratch = ROOT / '.tmp'; scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as tmp:
            out = Path(tmp) / 'audio'
            manifest = audio.recover(output=out)
            self.assertEqual(len(manifest['clips']), 4)
            self.assertEqual(len(manifest['unsupported']), 58)
            self.assertEqual(sum(c['sampleCount'] for c in manifest['clips'].values()), 158254)
            for clip in manifest['clips'].values():
                self.assertEqual((out / clip['path']).read_bytes(), self.zip.read(clip['member'])[32:-1])
            first = {p.name: p.read_bytes() for p in out.iterdir()}
            audio.recover(output=out)
            self.assertEqual(first, {p.name: p.read_bytes() for p in out.iterdir()})
            self.assertEqual(json.loads((out / 'manifest.json').read_text()), manifest)
            self.assertEqual(len(first), 5)  # Four PCM files plus metadata, no driver copies.

    def test_wrong_archive_and_linked_output_rejected(self):
        scratch = ROOT / '.tmp'; scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as tmp:
            tmp = Path(tmp); bad = tmp / 'bad.zip'; bad.write_bytes(b'not the archive')
            with self.assertRaisesRegex(audio.AudioFormatError, 'archive hash'):
                audio.recover(bad, tmp / 'unused')
            real = tmp / 'real'; real.mkdir(); link = tmp / 'link'; link.symlink_to(real)
            for output in [link, link / 'new']:
                with self.assertRaisesRegex(audio.AudioFormatError, 'symlink'):
                    audio.recover(output=output)
            self.assertEqual(list(real.iterdir()), [])

    def test_wrapper_option_alias_and_wait_bytes(self):
        # Small, independent instruction proofs of the translated branch predicates.
        self.assertEqual(self.exe[0x188FB:0x18901], bytes.fromhex('f70638500100'))  # Music bit1.
        self.assertEqual(self.exe[0x18D49:0x18D4F], bytes.fromhex('f70638500400'))  # Speech bit4.
        self.assertEqual(self.exe[0x18E26:0x18E38], bytes.fromhex('83fe01740583fe0b7502eb16f70638500200'))
        self.assertEqual(self.exe[0x18E48:0x18E50], bytes.fromhex('83fe0b7503be0a00'))
        self.assertEqual(self.exe[0x18BDF:0x18BE4], bytes.fromhex('7503e918ff'))  # Busy loop until both buffers done.
        self.assertEqual(self.exe[0x11583:0x1158F], bytes.fromhex('8336385002eb058336385004'))

    def test_concrete_calls_all_worlds_menu_and_startup(self):
        # Literal argument at call-4 and far target at call are checked against ZIP.
        effects = {0xB7A3: 1, 0xB7D7: 11, 0xBEBC: 1, 0xBEE3: 11,
                   0xC46B: 6, 0xCA55: 7, 0xCCA6: 2, 0xCD29: 9, 0xCF07: 2, 0xD168: 7,
                   0xDE58: 7, 0xFF37: 1, 0x119FD: 10, 0x131F2: 4, 0x13206: 3,
                   0x13802: 2, 0x13CA3: 1, 0x13D14: 11, 0x14284: 7, 0x149BC: 8,
                   0x17493: 5, 0x178B2: 1, 0x178C9: 11, 0x17EE5: 7}
        music = {0xC069: 4, 0x10D99: 2, 0x11531: 2, 0x13E0D: 1, 0x176D0: 3, 0x1D8E6: 1}
        for calls, target in [(effects, '9a8d0c3415'), (music, '9a99073415')]:
            for at, ident in calls.items():
                with self.subTest(file=hex(at)):
                    self.assertEqual(self.exe[at - 4:at], bytes([0xB8, ident, 0, 0x50]))
                    self.assertEqual(self.exe[at:at + 5], bytes.fromhex(target))

    def test_water_prompt_is_finger_drawing_not_speech(self):
        # 18019 dispatch 1101/1103 reaches graphics07a47, not audio18d22.
        self.assertEqual(self.exe[0x1803A:0x18047], bytes.fromhex('8b46063d4d04742e3d4f04746e'))
        self.assertEqual(self.exe[0x1808C:0x18091], bytes.fromhex('9a2702a204'))
        self.assertEqual(self.exe[0x18126:0x1812B], bytes.fromhex('9a2702a204'))


if __name__ == '__main__':
    unittest.main()
