"""Decode the archive's proven single-block PCM VOC layout, never load drivers.

Run from any directory: python3 -B tools/audio/decode.py
Outputs are local original-derived data under ignored assets/audio/.
"""
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parents[1]))
from source import archive_path, objdump

from pathlib import Path
import argparse
import hashlib
import json
import struct
import zipfile

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = archive_path()
ARCHIVE_SHA256 = 'b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'
EXE_MEMBER = 'MarioTea/MARIO/MARIO.EXE'
EXE_SHA256 = '6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e'
VOC_HASHES = {
    'CONGRATS': '2a57a28b94ae6858fe74fd1defd121b4019ec9b9e3f8c44c45e79247fb13189f',
    'READY': '38b01d0f3ac24f74f1931a9abfa2be039d301f918f5c9b75b5d434ef87dfe5e5',
    'TOOBAD': 'a9a2c471ac5dcce2fa860fc7c7313baa7662be0009aacd342b62abf49f44d0f2',
    'WELCOME': '3f74e59c7f9d809610be67b2d61051febf83f0f395b8093166002fc1c05883ff',
}
SYNTH_SUFFIXES = {'.PC', '.XMI', '.PCS', '.ADL', '.RLD', '.ADV', '.RS'}
BANK_NAMES = {'SAMPLE', 'SAMPLE.AD', 'SAMPLE.MT', 'SAMPLE.OPL'}
MAX_VOC_BYTES = 1_000_000  # Host safety bound, not a recovered DOS allocation limit.


def sha256(data):
    return hashlib.sha256(data).hexdigest()


class AudioFormatError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise AudioFormatError(message)


def decode_voc(data):
    """Return exact unsigned 8-bit mono samples and source spans.

    Deliberately reject continuation, compression, silence, repeat, extended or
    multiple blocks. None occurs in the four hash-pinned VOCs. No resampling.
    """
    require(26 <= len(data) <= MAX_VOC_BYTES, 'VOC size outside bounds')
    require(data[:20] == b'Creative Voice File\x1a', 'invalid VOC signature')
    offset, version, checksum = struct.unpack_from('<HHH', data, 20)
    require(version == 0x010A, 'unsupported VOC version')
    require(checksum == ((~version + 0x1234) & 0xFFFF), 'invalid VOC checksum')
    require(offset == 26, 'unsupported VOC header extension')
    require(offset + 4 <= len(data), 'truncated VOC block header')
    require(data[offset] == 1, 'unsupported VOC block type')
    size = int.from_bytes(data[offset + 1:offset + 4], 'little')
    start, end = offset + 4, offset + 4 + size
    require(size >= 3, 'empty or truncated PCM sound header')
    require(end < len(data), 'truncated VOC sound data or terminator')
    time_constant, codec = data[start:start + 2]
    require(codec == 0, 'unsupported VOC compression')
    # All proven clips use 200. Other time constants are not enabled by analogy.
    require(time_constant == 200, 'unsupported VOC time constant')
    require(data[end] == 0, 'unsupported additional VOC block or missing terminator')
    require(end + 1 == len(data), 'trailing VOC bytes')
    pcm = bytes(data[start + 2:end])
    return pcm, {
        'encoding': 'unsigned-8', 'channels': 1, 'sampleCount': len(pcm),
        'rateNumerator': 1_000_000, 'rateDenominator': 256 - time_constant,
        'sampleRate': 1_000_000 / (256 - time_constant),
        'durationSeconds': len(pcm) * (256 - time_constant) / 1_000_000,
        'version': version, 'timeConstant': time_constant, 'codec': codec,
        'blockIndex': 0, 'blockOffset': offset, 'blockType': 1, 'blockSize': size,
        'sampleOffset': start + 2, 'sampleEndExclusive': end,
        'terminatorOffset': end, 'pcmSha256': sha256(pcm),
        'sourceSha256': sha256(data), 'sourceSize': len(data),
    }


def decode_config(data):
    """Supplied CNF ingress, FILE 0x96e5..0x97f7 (M also selects effects).

    Require the proven supplied format, not missing-config RS defaults.
    """
    values = {}
    for line in data.decode('ascii').splitlines():
        if not line:
            continue
        require(line[0] in 'ADE FIMTVZ'.replace(' ', '') and line[1:].isdigit(), 'unsupported CNF line')
        require(line[0] not in values, 'duplicate CNF selector')
        values[line[0]] = int(line[1:])
    require(all(k in values for k in 'MDF'), 'missing audio CNF selector')
    return {'musicDevice': values['M'], 'effectsDevice': values['M'],
            'speechDevice': values['D'], 'options': values['F']}


def recover(archive=ARCHIVE, output=ROOT / 'assets/audio'):
    archive = Path(archive)
    require(sha256(archive.read_bytes()) == ARCHIVE_SHA256, 'archive hash mismatch')
    clips, unsupported = {}, []
    # Read fixed member names only, never extract paths or launch archive contents.
    with zipfile.ZipFile(archive) as z:
        require(sha256(z.read(EXE_MEMBER)) == EXE_SHA256, 'executable hash mismatch')
        for name, expected in VOC_HASHES.items():
            member = f'MarioTea/MARIO/{name}.VOC'
            data = z.read(member)
            require(sha256(data) == expected, f'{member}: hash mismatch')
            pcm, metadata = decode_voc(data)
            clips[name.lower()] = {**metadata, 'member': member, 'path': name.lower() + '.pcm'}
        for item in z.infolist():
            path = Path(item.filename)
            if path.parent.as_posix() != 'MarioTea/MARIO':
                continue
            if path.suffix.upper() in SYNTH_SUFFIXES or path.name in BANK_NAMES:
                data = z.read(item)
                unsupported.append({'member': item.filename, 'size': len(data),
                                    'sha256': sha256(data), 'status': 'unsupported-silent'})
        require(sum(n.filename.upper().endswith('.VOC') for n in z.infolist()) == 4,
                'unexpected VOC inventory')
        config_member = 'MarioTea/MARIO/MARIO.CNF'
        config = z.read(config_member)
        require(sha256(config) == 'e3805d4f4692d3e70d0e9f3bcbaacbc859127cc175bf8447561682206a0aeacc', 'CNF hash mismatch')
        manifest = {'format': 'mario-audio-pcm-v1', 'archiveSha256': ARCHIVE_SHA256,
                    'config': {**decode_config(config), 'member': config_member, 'sha256': sha256(config)},
                    'executable': {'member': EXE_MEMBER, 'sha256': EXE_SHA256},
                    'clips': clips, 'unsupported': unsupported,
                    'license': 'Original-derived local data, not repository MIT material.'}
        output = Path(output)
        # Refuse symlink output paths before even creating child directories.
        require(not any(p.is_symlink() for p in [output, *output.parents]), 'symlink output directory')
        output.mkdir(parents=True, exist_ok=True)
        for name, metadata in clips.items():
            destination = output / metadata['path']
            require(not destination.is_symlink() and (not destination.exists() or destination.stat().st_nlink == 1),
                    'linked PCM output')
            destination.write_bytes(decode_voc(z.read(metadata['member']))[0])
        destination = output / 'manifest.json'
        require(not destination.is_symlink() and (not destination.exists() or destination.stat().st_nlink == 1),
                'linked manifest output')
        destination.write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, default=ARCHIVE)
    parser.add_argument('--output', type=Path, default=ROOT / 'assets/audio')
    args = parser.parse_args()
    manifest = recover(args.archive, args.output)
    print(json.dumps({'clips': len(manifest['clips']),
                      'samples': sum(c['sampleCount'] for c in manifest['clips'].values()),
                      'unsupported': len(manifest['unsupported'])}))
