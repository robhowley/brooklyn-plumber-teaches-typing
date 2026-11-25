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


def msvc_frame(packet, rows, coverage):
    # Independent bottom-up row storage, not production top-down blit indices.
    width=len(rows[0]); blocks=width//4*len(rows)//4; block=cursor=0
    while block<blocks:
        low,high=packet[cursor:cursor+2];cursor+=2
        if 0x84<=high<=0x87:
            count=low+256*(high-0x84);assert count and block+count<=blocks
            coverage.add('msvc-skip');block+=count;continue
        if 0x80<=high<0x90:
            colors=[low];coverage.add('msvc-solid')
        else:
            count=2 if high<0x80 else 8
            colors=list(packet[cursor:cursor+count]);cursor+=count
            assert len(colors)==count;coverage.add('msvc-'+str(count))
        bx=4*(block%(width//4));by=4*(block//(width//4));flags=low+256*high
        for bit in range(16):
            x,y=bit%4,bit//4
            quadrant=(y//2)*2+x//2
            color=colors[0] if len(colors)==1 else colors[(2*quadrant if len(colors)==8 else 0)+(0 if flags&(1<<bit) else 1)]
            rows[by+y][bx+x]=color
        block+=1
    assert packet[cursor:] in (b'',b'\0\0')
    return b''.join(reversed(rows))


def frames(data, coverage):
    assert data[:4] == b'RIFF' and data[8:12] == b'AVI '
    rows = None
    for tag, offset, payload in chunks(data, 12, 8+struct.unpack_from('<I', data, 4)[0]):
        if tag == b'strf' and len(payload) >= 40:
            size, width, height, planes, bits, codec = struct.unpack_from('<IiiHHI', payload)
            assert (size, planes, bits) == (40, 1, 8)
            assert codec in (1,int.from_bytes(b'MSVC','little'),int.from_bytes(b'msvc','little'),int.from_bytes(b'CRAM','little'))
            assert width > 0 and height > 0
            rows = [bytearray(width) for _ in range(height)]
            count = struct.unpack_from('<I',payload,32)[0] or 256
            palette = [bytes((payload[40+i*4+2],payload[40+i*4+1],payload[40+i*4])) for i in range(count)]
        elif tag[2:] == b'pc':
            first, count = payload[:2]
            count = count or 256
            assert len(payload) == 4+count*4
            for i in range(count):
                palette[first+i] = payload[4+i*4:7+i*4]
        elif tag[2:] in (b'dc', b'db'):
            assert rows is not None
            if payload:
                pixels = rle_frame(payload, rows, coverage) if codec==1 else msvc_frame(payload,rows,coverage)
            else:
                coverage.add('empty')
                pixels = b''.join(reversed(rows))
            yield offset, pixels, b''.join(palette).hex()
