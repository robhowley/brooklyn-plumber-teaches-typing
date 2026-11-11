"""Publication and source acquisition contracts. No network in these tests."""
import hashlib
from html.parser import HTMLParser
import io
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
import source
import build


class SourceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.home = self.root / 'home'
        self.home.mkdir()
        self.archive = self.root / 'input.zip'
        self.exe = b'inert fixture bytes, never code'
        with zipfile.ZipFile(self.archive, 'w') as archive:
            archive.writestr(source.EXE_MEMBER, self.exe)
        self.bytes = self.archive.read_bytes()
        for target, value in [('ROOT', self.root), ('SHA256', hashlib.sha256(self.bytes).hexdigest()),
                              ('EXE_SHA256', hashlib.sha256(self.exe).hexdigest())]:
            p = patch.object(source, target, value); p.start(); self.addCleanup(p.stop)
        for p in [patch.dict(os.environ, {}, clear=True), patch.object(Path, 'home', return_value=self.home),
                  patch.object(source.time, 'sleep'), patch.object(source.urllib.request, 'urlopen')]:
            mock = p.start(); self.addCleanup(p.stop)
            if getattr(p, 'attribute', None) == 'urlopen':
                self.network = mock

    def test_missing_or_corrupt_override_fails_before_processing_or_network(self):
        for data in [None, b'partial ZIP']:
            if data is not None:
                self.archive.write_bytes(data)
            else:
                self.archive.unlink()
            with patch.dict(os.environ, {'MTT_ARCHIVE': str(self.archive)}):
                with self.assertRaises((FileNotFoundError, ValueError)):
                    source.ensure_archive()
        self.network.assert_not_called()

    def test_archive_hash_is_checked_before_zip_parsing(self):
        self.archive.write_bytes(b'not a ZIP')
        with patch.object(source.zipfile, 'ZipFile') as parse:
            with self.assertRaisesRegex(ValueError, 'SHA-256 mismatch'):
                source.verify_archive(self.archive)
            parse.assert_not_called()

    def test_member_pin_is_retained(self):
        with patch.object(source, 'EXE_SHA256', '0' * 64):
            with self.assertRaisesRegex(ValueError, 'member SHA-256 mismatch'):
                source.verify_archive(self.archive)

    def test_download_repairs_corrupt_cache_and_partial_then_uses_valid_cache(self):
        cache = self.root / '.cache/source' / source.NAME
        cache.parent.mkdir(parents=True)
        cache.write_bytes(b'bad cache')
        partial = cache.with_suffix('.zip.part'); partial.write_bytes(b'interrupted')
        self.network.side_effect = lambda *a, **kw: io.BytesIO(self.bytes)
        self.assertEqual(source.ensure_archive(), cache.resolve())
        self.assertEqual(cache.read_bytes(), self.bytes)
        self.assertFalse(partial.exists())
        self.assertEqual(source.ensure_archive(), cache.resolve())
        self.network.assert_called_once_with(source.URL, timeout=15)

    def test_failed_download_has_bounded_retries_and_no_poisoned_cache(self):
        self.network.side_effect = lambda *a, **kw: io.BytesIO(b'corrupt response')
        with self.assertRaises(ValueError):
            source.ensure_archive()
        self.assertEqual(self.network.call_count, 3)
        self.assertFalse((self.root / '.cache/source' / source.NAME).exists())
        self.assertFalse(list(self.root.rglob('*.part')))

    def test_downloads_default_is_friendly_but_invalid_local_input_is_not_replaced(self):
        local = self.home / 'Downloads' / source.NAME
        local.parent.mkdir(); local.write_bytes(self.bytes)
        self.assertEqual(source.ensure_archive(), local.resolve())
        local.write_bytes(b'bad local input')
        with self.assertRaises(ValueError):
            source.ensure_archive()
        self.network.assert_not_called()

    def test_non_apple_hosts_require_llvm_not_gnu_objdump(self):
        with patch.object(source.sys, 'platform', 'linux'), patch.object(source.shutil, 'which', return_value=None):
            with self.assertRaisesRegex(RuntimeError, 'Install LLVM'):
                source.objdump()
        with patch.dict(os.environ, {'MTT_OBJDUMP': '/trusted/llvm-objdump'}):
            self.assertEqual(source.objdump(), '/trusted/llvm-objdump')


class PublishTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.expected = {'index.html', 'app/data.json', 'app/main.mjs', 'app/style.css',
                         'recovered/worlds/tables.mjs', 'LICENSE', 'NOTICE', 'CNAME', *build.BACKGROUND_FILES}
        for name in self.expected | {'assets/raw/MARIO.EXE', 'assets/app/unapproved.indices',
                                      'tools/private.py', 'research/notes.txt', 'app/private.json'}:
            p = self.root / name; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(name)

    def snapshot(self):
        return {str(p.relative_to(self.root / 'dist')): p.read_bytes()
                for p in (self.root / 'dist').rglob('*') if p.is_file()}

    def test_clean_allowlist_and_deterministic_output(self):
        self.assertEqual(set(build.publish(self.root)), self.expected)
        first = self.snapshot()
        (self.root / 'dist/leak.zip').write_bytes(b'stale output')
        build.publish(self.root)
        self.assertEqual(self.snapshot(), first)
        self.assertEqual(set(first), self.expected)

    def test_shipped_html_links_resolve_without_publishing_docs(self):
        root = Path(__file__).resolve().parents[2]
        expected_docs = {
            'https://github.com/robhowley/brooklyn-plumber-teaches-typing/blob/main/' + name
            for name in ('README.md', 'COVERAGE.md', 'ASSUMPTIONS.md')
        }
        hrefs = []

        class Links(HTMLParser):
            def handle_starttag(self, tag, attrs):
                hrefs.extend(value for key, value in attrs if key == 'href')

        Links().feed((root / 'index.html').read_text())
        self.assertTrue(expected_docs.issubset(hrefs))
        shipped = set(build.runtime_files(root))
        for href in hrefs:
            if href.startswith('data:'):
                continue
            if href.startswith('https:'):
                self.assertIn(href, expected_docs)
            else:
                self.assertIn(href.removeprefix('./'), shipped)
        self.assertTrue({'README.md', 'COVERAGE.md', 'ASSUMPTIONS.md'}.isdisjoint(shipped))

    def test_missing_runtime_input_preserves_previous_dist(self):
        build.publish(self.root); previous = self.snapshot()
        (self.root / build.BACKGROUND_FILES[0]).unlink()
        with self.assertRaises(ValueError):
            build.publish(self.root)
        self.assertEqual(self.snapshot(), previous)

    def test_symlink_input_is_not_published(self):
        path = self.root / 'app/main.mjs'; path.unlink(); path.symlink_to(self.root / 'NOTICE')
        with self.assertRaises(ValueError):
            build.publish(self.root)

    def test_all_eighteen_static_steps_are_part_of_every_build(self):
        self.assertEqual(len(build.STEPS), 18)
        self.assertEqual(build.STEPS[0], 'worlds/inspect.py')
        self.assertLess(build.STEPS.index('control/evidence.py'), build.STEPS.index('control/tables.py'))
        self.assertEqual(build.STEPS[-1], 'build-app-data.py')


if __name__ == '__main__':
    unittest.main()
