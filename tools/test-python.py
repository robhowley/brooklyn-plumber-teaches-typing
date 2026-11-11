"""Run all static decoder/build suites, failing if any suite fails."""
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
for suite in ('assets', 'render', 'app', 'audio', 'build'):
    result = subprocess.run([sys.executable, '-B', '-m', 'unittest', 'discover', '-s', f'tests/{suite}', '-p', 'test_*.py'], cwd=root)
    if result.returncode:
        sys.exit(result.returncode)
