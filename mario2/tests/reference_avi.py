"""Test-only RIFF/RLE8 oracle, no production decoder imports.

Interpret Windows BI_RLE8 commands into bottom-up rows, then orient for the
runtime. Source offsets come from this RIFF walk, not the decoder's manifest.
Every yielded frame includes its immediate AVI member FILE payload offset.
"""
import struct


def chunks(data, start, stop):
    while start < stop:
        tag, size = struct.unpack_from('<4sI', data, start)
        payload = start+8
        assert payload+size <= stop
        if tag in (b'RIFF', b'LIST'):
            yield from chunks(data, payload+4, payload+size)
        else:
            yield tag, payload, data[payload:payload+size]
        start = payload+size+(size % 2)


def rle_frame(commands, rows, coverage):
    # Rows use native bottom-up order. Skipped cells retain their prior value.
    x = row = cursor = 0
    while cursor < len(commands):
        count, value = commands[cursor:cursor+2]
        cursor += 2
        if count:
            coverage.add('run')
            assert row < len(rows) and x+count <= len(rows[row])
            for column in range(x, x+count):
                rows[row][column] = value
            x += count
        elif value == 0:
            coverage.add('eol')
            row += 1
            x = 0
        elif value == 1:
            assert not any(commands[cursor:])
            return b''.join(reversed(rows))
        elif value == 2:
            coverage.add('delta')
            dx, dy = commands[cursor:cursor+2]
            cursor += 2
            x += dx
            row += dy
        else:
            coverage.add('literal')
            assert row < len(rows) and x+value <= len(rows[row])
            for column in range(value):
                rows[row][x+column] = commands[cursor+column]
            x += value
            cursor += value+(value % 2)
    raise AssertionError('missing RLE end marker')


def frames(data, coverage):
    assert data[:4] == b'RIFF' and data[8:12] == b'AVI '
    rows = None
    for tag, offset, payload in chunks(data, 12, 8+struct.unpack_from('<I', data, 4)[0]):
        if tag == b'strf' and len(payload) >= 40:
            size, width, height, planes, bits, codec = struct.unpack_from('<IiiHHI', payload)
            assert (size, planes, bits, codec) == (40, 1, 8, 1)
            assert width > 0 and height > 0
            rows = [bytearray(width) for _ in range(height)]
        elif tag[2:] in (b'dc', b'db'):
            assert rows is not None
            if payload:
                pixels = rle_frame(payload, rows, coverage)
            else:
                coverage.add('empty')
                pixels = b''.join(reversed(rows))
            yield offset, pixels
