"""Pinned artwork acquisition and pixel-exact crop contracts, offline fixtures."""
import hashlib
import io
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch
import zlib

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
import source
import site_art


class ArtworkTests(unittest.TestCase):
    def setUp(self):
        self.source_hash = source.TITLE_SHA256
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        width, height = source.TITLE_SIZE
        self.pixels = bytes(value for y in range(height) for x in range(width)
                            for value in (x % 256, y % 256, (x + y) % 256))
        self.data = site_art.rgb_png(width, height, self.pixels)
        for p in (patch.object(source, 'ROOT', self.root),
                  patch.object(source, 'TITLE_SHA256', hashlib.sha256(self.data).hexdigest()),
                  patch.object(source.urllib.request, 'urlopen', side_effect=lambda *a, **kw: io.BytesIO(self.data))):
            mock = p.start(); self.addCleanup(p.stop)
            if p.attribute == 'urlopen':
                self.network = mock
        self.cache = self.root / '.cache/source/readme-title.png'

    def test_source_pin_geometry_and_crop(self):
        # Check authored provenance independently of acquisition fixtures.
        self.assertEqual(self.source_hash, 'a6eca993e16a9b0f4043c085f662829d8e8a2d8576be8f681f91ec6c7b0fa089')
        self.assertEqual(source.TITLE_SIZE, (720, 450))
        self.assertEqual(site_art.MARIO_CROP, (36, 96, 184, 184))
        self.assertIn('1e1bfce9e17d57a6e443704387ba471072c8fcfc/src/assets/title/title.png', source.TITLE_URL)

    def test_fresh_generation_exact_preview_and_square_pixel_crop_then_cache(self):
        site_art.generate(self.root)
        target = self.root / 'assets/site'
        self.assertEqual((target / 'social-preview.png').read_bytes(), self.data)
        favicon = (target / 'favicon.png').read_bytes()
        self.assertEqual(struct.unpack('>IIBBBBB', favicon[16:29]), (184, 184, 8, 2, 0, 0, 0))
        expected = b''.join(self.pixels[(y * 720 + 36) * 3:(y * 720 + 220) * 3]
                            for y in range(96, 280))
        self.assertEqual(site_art.read_rgb(favicon, (184, 184)), expected)
        site_art.generate(self.root)
        self.network.assert_called_once_with(source.TITLE_URL, timeout=15)
        self.assertEqual(self.cache.read_bytes(), self.data)

    def test_wrong_hash_never_decoded_or_cached(self):
        self.network.side_effect = lambda *a, **kw: io.BytesIO(b'wrong PNG')
        with patch.object(site_art, 'read_rgb') as decode:
            with self.assertRaisesRegex(ValueError, 'SHA-256 mismatch'):
                site_art.generate(self.root)
            decode.assert_not_called()
        self.assertFalse(self.cache.exists())
        self.assertFalse(list(self.root.rglob('*.part')))
        self.assertFalse((self.root / 'assets/site').exists())

    def test_corrupt_cache_rejected_without_network(self):
        self.cache.parent.mkdir(parents=True)
        self.cache.write_bytes(b'bad cache')
        with self.assertRaisesRegex(ValueError, 'SHA-256 mismatch'):
            source.ensure_title()
        self.network.assert_not_called()

    def test_download_limits_and_network_failure_cleanup(self):
        for mode in ('size', 'time', 'network'):
            with self.subTest(mode=mode):
                with patch.object(source, 'TITLE_MAX_BYTES', 1 if mode == 'size' else 1024 * 1024), \
                        patch.object(source.time, 'monotonic', side_effect=[0, 31] if mode == 'time' else None, return_value=0):
                    if mode == 'network':
                        self.network.side_effect = TimeoutError('bounded timeout')
                    with self.assertRaises((ValueError, TimeoutError)):
                        source.ensure_title()
                self.assertFalse(self.cache.exists())
                self.assertFalse(list(self.root.rglob('*.part')))

    def test_rgb_decoder_handles_each_png_filter(self):
        # Encode a two-row image independently of the decoder, including Paeth ties.
        width, height = 4, 2
        pixels = bytes((n * 31) % 256 for n in range(width * height * 3))
        for kind in range(5):
            scan = bytearray()
            for y in range(height):
                scan.append(kind)
                for i in range(width * 3):
                    index = y * width * 3 + i
                    left = pixels[index - 3] if i >= 3 else 0
                    up = pixels[index - width * 3] if y else 0
                    corner = pixels[index - width * 3 - 3] if y and i >= 3 else 0
                    p = left + up - corner
                    paeth = min((left, up, corner), key=lambda v: abs(p - v))
                    scan.append((pixels[index] - (0, left, up, (left + up) // 2, paeth)[kind]) % 256)
            def chunk(tag, payload):
                return struct.pack('>I', len(payload)) + tag + payload + struct.pack('>I', zlib.crc32(tag + payload))
            data = (site_art.SIGNATURE + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
                    + chunk(b'IDAT', zlib.compress(scan)) + chunk(b'IEND', b''))
            with self.subTest(filter=kind):
                self.assertEqual(site_art.read_rgb(data, (width, height)), pixels)


if __name__ == '__main__':
    unittest.main()
