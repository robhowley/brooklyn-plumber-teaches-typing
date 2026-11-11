"""Regenerate all static inputs, then publish only the browser runtime allowlist."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from source import ROOT, ensure_archive, objdump

STEPS = (
    'worlds/inspect.py', 'control/evidence.py', 'control/tables.py', 'worlds/tables.py',
    'outdoor/inspect.py', 'runtime/inspect.py', 'render/inspect.py', 'assets/pipeline.py',
    'render/decode.py', 'render/water-bindings.py', 'worlds/water-inspect.py',
    'worlds/castle-inspect.py', 'control/menu-inspect.py', 'control/report-inspect.py',
    'control/startup-inspect.py', 'control/celebration-inspect.py', 'audio/decode.py',
    'build-app-data.py',
)
BACKGROUND_FILES = tuple(f'assets/app/{char}OUT.backgrounds.indices' for char in 'LMP')


def runtime_files(root):
    files = ['index.html', 'app/data.json', *BACKGROUND_FILES, 'LICENSE', 'NOTICE', 'CNAME']
    files += [str(p.relative_to(root)) for p in sorted((root / 'app').glob('*.mjs'))]
    files += [str(p.relative_to(root)) for p in sorted((root / 'app').glob('*.css'))]
    files += [str(p.relative_to(root)) for p in sorted((root / 'recovered').rglob('*.mjs'))]
    if not (root / 'recovered/worlds/tables.mjs').is_file():
        raise FileNotFoundError('Missing generated recovered/worlds/tables.mjs')
    for name in files:
        path = root / name
        if not path.is_file() or path.is_symlink() or any(p.is_symlink() for p in path.parents):
            raise ValueError(f'Missing or unsafe runtime file: {name}')
    return files


def publish(root=ROOT):
    """A failed copy leaves the previous dist intact; stale files never survive."""
    root = Path(root).resolve()
    files = runtime_files(root)
    (root / '.tmp').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='publish-', dir=root / '.tmp') as temp:
        staging = Path(temp) / 'dist'
        for name in files:
            target = staging / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(root / name, target)
        previous = Path(temp) / 'previous-dist'
        dist = root / 'dist'
        if dist.exists():
            dist.rename(previous)
        try:
            staging.rename(dist)
        except BaseException:
            if previous.exists():
                previous.rename(dist)
            raise
    return files


def main():
    archive = ensure_archive()
    env = {**os.environ, 'MTT_ARCHIVE': str(archive), 'MTT_OBJDUMP': objdump(), 'PYTHONDONTWRITEBYTECODE': '1'}
    (ROOT / 'analysis/control').mkdir(parents=True, exist_ok=True)
    logs = ROOT / '.tmp/build'
    logs.mkdir(parents=True, exist_ok=True)
    for i, step in enumerate(STEPS, 1):
        print(f'[{i}/{len(STEPS)}] {step}', flush=True)
        output = ROOT / '.tmp/castle-evidence.json' if step == 'worlds/castle-inspect.py' else logs / (step.replace('/', '-') + '.log')
        with output.open('w') as log:
            subprocess.run([sys.executable, '-B', str(ROOT / 'tools' / step)], cwd=ROOT,
                           env=env, stdout=log, check=True, timeout=120)
    print(f'Published {len(publish())} runtime files to dist/')


if __name__ == '__main__':
    main()
