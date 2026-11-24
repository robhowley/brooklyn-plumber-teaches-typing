"""Read the Win16 NE resource directory as data, never relocated or executed."""
import struct


def movie_member(executable, selector_offset):
    """Resolve the movie's far filename pointer through inert NE fixup chains.

    WINMARIO selector record: id:u16, x:u16, y:u16, key:u8,
    reserved:u16, filename offset:u16, filename segment:u16 (relocated).
    The on-disc segment word is a fixup-chain link, not a segment number.
    """
    ne = struct.unpack_from('<I', executable, 0x3c)[0]
    count, = struct.unpack_from('<H', executable, ne+0x1c)
    table, = struct.unpack_from('<H', executable, ne+0x22)
    shift, = struct.unpack_from('<H', executable, ne+0x32)
    segments = []
    for i in range(count):
        sector, size, flags, _ = struct.unpack_from('<4H', executable, ne+table+8*i)
        segments.append((sector << shift, size or 65536, flags))
    for base, size, flags in segments:
        if not base <= selector_offset < base+size or not flags & 0x100:
            continue
        relocations = base+size
        for i in range(struct.unpack_from('<H', executable, relocations)[0]):
            typ, kind, link, segment, reserved, target = struct.unpack_from('<BBHBBH', executable, relocations+2+8*i)
            # Internal, non-additive segment relocation. Follow without applying.
            if (typ, kind, reserved, target) != (2, 0, 0, 0):
                continue
            seen = set()
            while link != 0xffff:
                if link in seen or link+2 > size:
                    raise ValueError('invalid NE filename fixup chain')
                seen.add(link)
                if base+link == selector_offset+11:
                    target_base, target_size, _ = segments[segment-1]
                    offset, = struct.unpack_from('<H', executable, selector_offset+9)
                    end = executable.find(b'\0', target_base+offset, target_base+target_size)
                    if offset >= target_size or end < 0:
                        raise ValueError('invalid movie filename pointer')
                    name = executable[target_base+offset:end].decode('ascii')
                    return '/MARIO/'+name.upper()+';1'
                link, = struct.unpack_from('<H', executable, base+link)
    raise ValueError('missing movie filename segment fixup')


def resources(executable):
    ne = struct.unpack_from('<I', executable, 0x3c)[0]
    if executable[ne:ne+2] != b'NE':
        raise ValueError('missing NE signature')
    table = ne + struct.unpack_from('<H', executable, ne+0x24)[0]
    shift = struct.unpack_from('<H', executable, table)[0]
    if shift > 16:
        raise ValueError('NE resource alignment')
    p, result = table+2, {}
    def identity(value):
        if value & 0x8000:
            return value & 0x7fff
        start = table+value
        length = executable[start]
        return executable[start+1:start+1+length].decode('ascii')
    while True:
        typ = struct.unpack_from('<H', executable, p)[0]
        if not typ:
            return result
        count = struct.unpack_from('<H', executable, p+2)[0]
        p += 8
        for _ in range(count):
            offset, size, flags, index, handle, usage = struct.unpack_from('<6H', executable,p)
            p += 12
            key = identity(typ), identity(index)
            if key in result:
                raise ValueError('duplicate NE resource identity')
            result[key] = (offset << shift, size << shift)
            if sum(result[key]) > len(executable):
                raise ValueError('NE resource outside executable')
