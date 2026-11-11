"""Pinned, inert source data and trusted static disassembler. Never run archive code."""
import hashlib
import os
from pathlib import Path
import shutil
import sys
import time
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'Mario_Teaches_Typing_1992.zip'
URL = 'https://archive.org/download/msdos_Mario_Teaches_Typing_1992/' + NAME
SHA256 = 'b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'
EXE_MEMBER = 'MarioTea/MARIO/MARIO.EXE'
EXE_SHA256 = '6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e'
MAX_BYTES = 32 * 1024 * 1024


def verify_archive(path):
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f'Missing archive: {path}. Run npm run build to obtain the pinned source.')
    if path.stat().st_size > MAX_BYTES or hashlib.sha256(path.read_bytes()).hexdigest() != SHA256:
        raise ValueError(f'Archive SHA-256 mismatch: {path}')
    # Do not parse even the ZIP directory until the entire archive hash matches.
    with zipfile.ZipFile(path) as archive:
        if hashlib.sha256(archive.read(EXE_MEMBER)).hexdigest() != EXE_SHA256:
            raise ValueError('MARIO.EXE member SHA-256 mismatch')
    return path.resolve()


def archive_path():
    """Local override, friendly Downloads default, then ignored download cache. No network."""
    override = os.environ.get('MTT_ARCHIVE')
    local = Path.home() / 'Downloads' / NAME
    return verify_archive(Path(override) if override else local if local.exists() else ROOT / '.cache/source' / NAME)


def ensure_archive():
    """Only the build entrypoint downloads. Invalid explicit/local inputs fail closed."""
    if os.environ.get('MTT_ARCHIVE') or (Path.home() / 'Downloads' / NAME).exists():
        return archive_path()
    cache = ROOT / '.cache/source' / NAME
    cache.parent.mkdir(parents=True, exist_ok=True)
    partial = cache.with_suffix('.zip.part')
    partial.unlink(missing_ok=True)
    if cache.exists():
        try:
            return verify_archive(cache)
        except (ValueError, zipfile.BadZipFile):
            cache.unlink()
    for attempt in range(3):
        try:
            deadline = time.monotonic() + 30
            with urllib.request.urlopen(URL, timeout=15) as response, partial.open('wb') as output:
                size = 0
                while chunk := response.read(64 * 1024):
                    size += len(chunk)
                    if size > MAX_BYTES or time.monotonic() > deadline:
                        raise ValueError('Archive download exceeded size/time limit')
                    output.write(chunk)
            verify_archive(partial)
            partial.replace(cache)
            return verify_archive(cache)
        except Exception:
            partial.unlink(missing_ok=True)
            if attempt == 2:
                raise
            time.sleep(1)


def objdump():
    selected = os.environ.get('MTT_OBJDUMP') or shutil.which('llvm-objdump')
    if not selected and sys.platform == 'darwin':
        selected = '/usr/bin/objdump'  # Apple ships LLVM's code16-capable disassembler.
    if not selected:
        raise RuntimeError('Install LLVM and put llvm-objdump on PATH (or set MTT_OBJDUMP). GNU objdump is unsupported.')
    return selected


if __name__ == '__main__':
    print(ensure_archive())
