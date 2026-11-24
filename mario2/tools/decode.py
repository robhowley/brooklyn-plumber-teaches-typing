"""Bounded inert Windows media readers, adapted from authored static research.
No source programs are imported or executed. Offsets are immediate-member FILE offsets.
Only Express DIB/RLE AVI, PCM, MIDI events and Win16 UI formats are supported.
"""
from pathlib import Path
import hashlib
import json
import struct
import wave
import zlib
HERE = Path(__file__).resolve().parent
MAX_PIXELS = 4096 * 4096
MAX_EVENTS = 2000000

class Invalid(ValueError):
    pass


class Unsupported(ValueError):
    pass


def need(ok, message):
    if not ok:
        raise Invalid(message)


def sl(b, p, n):
    need(isinstance(p, int) and isinstance(n, int) and p >= 0 and n >= 0 and p+n <= len(b),
         f'out of bounds FILE {p}+{n}, size {len(b)}')
    return b[p:p+n]


def u16(b, p=0, endian='>'):
    return struct.unpack(endian+'H', sl(b, p, 2))[0]


def u32(b, p=0, endian='>'):
    return struct.unpack(endian+'I', sl(b, p, 4))[0]


def sha(b):
    return hashlib.sha256(b).hexdigest()


def four(b):
    return b.decode('latin1')


def save_json(path, obj):
    # All filenames supplied by authored code, never input paths.
    path.parent.mkdir(exist_ok=True, parents=True)
    path.write_text(json.dumps(obj, ensure_ascii=True, indent=2, sort_keys=True)+'\n')


def tail(b, p):
    need(p <= len(b), 'consumption beyond member')
    return {'consumed_bytes': p, 'trailing_bytes': len(b)-p,
            'trailing_all_zero': not any(b[p:]), 'trailing_sha256': sha(b[p:])}


def chunks(b, start, end, endian='<', depth=0, containers=(b'RIFF', b'LIST')):
    need(depth < 20 and 0 <= start <= end <= len(b), 'chunk bounds/depth')
    result = []
    p = start
    while p < end:
        need(p+8 <= end, f'short chunk header FILE {p}')
        tag, n = b[p:p+4], u32(b, p+4, endian)
        stop = p+8+n
        need(stop <= end, f'chunk {four(tag)!r} FILE {p} ends {stop} > {end}')
        c = {'tag': four(tag), 'file_offset': p, 'payload_offset': p+8, 'size': n}
        if tag in containers:
            need(n >= 4, 'container without form type')
            c['form'] = four(b[p+8:p+12])
            c['children'] = chunks(b, p+12, stop, endian, depth+1, containers)
        result.append(c)
        p = stop + (n & 1)
        if n & 1 and stop < end:
            c['pad_byte'] = b[stop]
        elif n & 1:
            # These WAVE writers omit the pad after the final odd data chunk.
            # Preserve this nonconformance rather than consuming outside the FORM.
            c['missing_final_pad'] = True
            p = stop
    return result


def flatten(cs):
    for c in cs:
        yield c
        yield from flatten(c.get('children', []))


def payload(b, c):
    return sl(b, c['payload_offset'], c['size'])


def bytag(cs, tag):
    return [c for c in flatten(cs) if c['tag'] == tag]


def riff(b):
    need(b[:4] == b'RIFF', 'not RIFF')
    end = u32(b, 4, '<')+8
    need(12 <= end <= len(b), 'RIFF declared boundary')
    return chunks(b, 0, end), end


def pcm_info(b):
    tag, ch, rate, avg, align, bits = struct.unpack('<HHIIHH', sl(b, 0, 16))
    return dict(codec=tag, channels=ch, sample_rate=rate, byte_rate=avg,
                block_align=align, bits=bits, extension_hex=b[16:].hex())


def pcm_validate(info, raw):
    if info['codec'] != 1 or info['bits'] not in (8, 16, 24, 32):
        raise Unsupported(f"WAVE codec {info['codec']}, {info['bits']} bits")
    need(info['channels'] in (1, 2), 'PCM channels')
    align = info['channels'] * (info['bits']//8)
    need(info['block_align'] == align and len(raw) % align == 0, 'PCM block alignment')
    need(info['sample_rate'] > 0 and info['byte_rate'] == info['sample_rate']*align, 'PCM byte rate')
    return len(raw)//align


class Outputs:
    def __init__(self, key):
        need(len(key) == 64 and all(c in '0123456789abcdef' for c in key), 'output SHA filename')
        self.key = key
        self.dir = HERE / 'decoded' / key
        self.dir.mkdir(parents=True, exist_ok=True)
        self.artifacts = []

    def put(self, name, data):
        need('/' not in name and name not in ('.', '..'), 'output filename')
        p = self.dir / name
        p.write_bytes(data)
        a = {'path': str(p.relative_to(HERE)), 'bytes': len(data), 'sha256': sha(data)}
        self.artifacts.append(a)
        return a

    def audio(self, name, raw, channels, bits, rate):
        need(bits in (8, 16, 24, 32) and channels in (1, 2), 'WAV output shape')
        p = self.dir / name
        with wave.open(str(p), 'wb') as out:
            out.setnchannels(channels)
            out.setsampwidth(bits//8)
            out.setframerate(rate)
            out.writeframes(raw)
        a = {'path': str(p.relative_to(HERE)), 'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes()),
             'pcm_sha256': sha(raw)}
        self.artifacts.append(a)
        return a

    def frames(self):
        return FrameOutput(self)


class FrameOutput:
    """Independent zlib streams concatenated; index preserves exact byte boundaries."""
    def __init__(self, out):
        self.out = out
        self.file = (out.dir/'frames.zlib').open('wb')
        self.index = []

    def add(self, raw, **info):
        packed = zlib.compress(raw, 6)
        self.index.append(dict(info, output_offset=self.file.tell(), compressed_bytes=len(packed),
                               decoded_bytes=len(raw), decoded_sha256=sha(raw)))
        self.file.write(packed)

    def close(self):
        self.file.close()
        p = self.out.dir/'frames.zlib'
        self.out.artifacts.append({'path': str(p.relative_to(HERE)), 'bytes': p.stat().st_size,
                                   'sha256': sha(p.read_bytes())})
        return self.index


def decode_wave(b, out):
    cs, end = riff(b)
    need(b[8:12] == b'WAVE', 'not WAVE')
    fs, ds = bytag(cs, 'fmt '), bytag(cs, 'data')
    need(len(fs) == len(ds) == 1, 'WAVE requires exactly one fmt/data')
    info = pcm_info(payload(b, fs[0]))
    raw = payload(b, ds[0])
    frames = pcm_validate(info, raw)
    out.audio('audio.wav', raw, info['channels'], info['bits'], info['sample_rate'])
    return dict(status='decoded', chunks=cs, audio=info, sample_frames=frames,
                duration=[frames, info['sample_rate']], **tail(b, end))


def vlq(b, p, end):
    value = 0
    for _ in range(4):
        need(p < end, 'truncated MIDI VLQ')
        v = b[p]; p += 1
        value = (value << 7) | (v & 127)
        if not v & 128:
            return value, p
    raise Invalid('MIDI VLQ longer than four bytes')


def decode_midi(b, out):
    need(b[:4] == b'MThd' and u32(b, 4) == 6, 'MIDI header')
    fmt, tracks, division = struct.unpack('>HHH', sl(b, 8, 6))
    need(fmt <= 2 and tracks > 0, 'MIDI format/tracks')
    p = 14; result = []; total_events = 0
    for ti in range(tracks):
        need(sl(b, p, 4) == b'MTrk', 'MIDI track signature')
        n = u32(b, p+4); start = p+8; end = start+n; sl(b, start, n)
        p = start; tick = 0; running = None; events = []; ended = False
        while p < end:
            event_start = p
            delta, p = vlq(b, p, end); tick += delta
            need(p < end, 'MIDI missing event')
            status = b[p]
            if status & 128:
                p += 1
            else:
                need(running is not None, 'MIDI missing running status')
                status = running
            e = dict(file_offset=event_start, tick=tick, delta=delta, status=status)
            if status == 255:
                running = None
                need(p < end, 'MIDI missing meta type')
                e['meta_type'] = b[p]; p += 1
                ln, p = vlq(b, p, end)
                need(p+ln <= end, 'MIDI meta length')
                raw = sl(b, p, ln); p += ln; e['data_hex'] = raw.hex()
                if 1 <= e['meta_type'] <= 9:
                    e['text_latin1'] = four(raw)
                if e['meta_type'] == 0x51:
                    need(ln == 3, 'MIDI tempo length')
                    e['microseconds_per_quarter'] = int.from_bytes(raw, 'big')
                if e['meta_type'] == 0x2f:
                    need(ln == 0 and p == end, 'MIDI EOT must end declared track')
                    ended = True
            elif status in (0xf0, 0xf7):
                running = None
                ln, p = vlq(b, p, end); need(p+ln <= end, 'MIDI sysex bounds')
                e['data_hex'] = sl(b, p, ln).hex(); p += ln
            elif 0x80 <= status <= 0xef:
                running = status
                ln = 1 if status >> 4 in (12, 13) else 2
                raw = sl(b, p, ln); need(p+ln <= end and all(x < 128 for x in raw), 'MIDI channel data')
                p += ln; e['data'] = list(raw)
            else:
                raise Unsupported(f'MIDI status {status:#x}')
            e['consumed_bytes'] = p-event_start
            events.append(e); total_events += 1
            need(total_events < MAX_EVENTS, 'MIDI event bound')
        need(ended, 'MIDI track without EOT')
        result.append(dict(index=ti, payload_offset=start, bytes=n, end_tick=tick, events=events))
    save_json(out.dir/'events.json', result)
    out.artifacts.append(dict(path=str((out.dir/'events.json').relative_to(HERE)), bytes=(out.dir/'events.json').stat().st_size,
                              sha256=sha((out.dir/'events.json').read_bytes())))
    return dict(status='decoded-events-not-synthesized', midi_format=fmt, division=division,
                division_mode='SMPTE' if division & 0x8000 else 'ticks-per-quarter',
                tracks=[{k:v for k,v in t.items() if k != 'events'} for t in result], event_count=total_events, **tail(b, p))


def unpack_dib_header(b, offset=0):
    size = u32(b, offset, '<')
    if size != 40:
        raise Unsupported(f'DIB header size {size}')
    vals = struct.unpack('<IiiHHIIiiII', sl(b, offset, 40))
    _, w, h, planes, bits, compression, image_bytes, xp, yp, colors, important = vals
    need(0 < w <= 4096 and 0 < abs(h) <= 4096 and w*abs(h) <= MAX_PIXELS and planes == 1,
         'DIB dimensions/planes')
    entries = (colors or (1 << bits)) if bits <= 8 else 0
    need(entries <= 256, 'DIB palette count')
    palette_at = offset+size
    palette_raw = sl(b, palette_at, entries*4)
    palette = [list(palette_raw[k+2:k+3]+palette_raw[k+1:k+2]+palette_raw[k:k+1]) for k in range(0, len(palette_raw), 4)]
    return dict(width=w, height=abs(h), signed_height=h, bits=bits, compression=compression,
                declared_image_bytes=image_bytes, palette=palette, palette_bgr0_hex=palette_raw.hex(),
                palette_file_offset=palette_at, pixels_file_offset=palette_at+entries*4,
                x_pixels_per_meter=xp, y_pixels_per_meter=yp, colors_important=important)


def rle8(raw, width, height, previous=None, bits=8):
    need(width*height <= MAX_PIXELS and width > 0 and height > 0, 'RLE dimensions')
    # Output is top-down, delta-coded frames retain previous pixels.
    pixels = bytearray(previous if previous is not None else bytes(width*height))
    need(len(pixels) == width*height, 'RLE previous size')
    x = 0; y = height-1; p = 0; eob = False
    while p < len(raw):
        a, v = sl(raw, p, 2); p += 2
        if a:
            need(0 <= y < height and x+a <= width, 'RLE run bounds')
            run=bytes([v])*a if bits==8 else bytes((v >> (4 if i%2==0 else 0)) & 15 for i in range(a))
            pixels[y*width+x:y*width+x+a] = run; x += a
        elif v == 0:
            x = 0; y -= 1
            need(y >= -1, 'RLE row underflow')
        elif v == 1:
            eob = True; break
        elif v == 2:
            dx, dy = sl(raw, p, 2); p += 2; x += dx; y -= dy
            need(x <= width and -1 <= y < height, 'RLE delta bounds')
        else:
            need(0 <= y < height and x+v <= width, 'RLE literal bounds')
            nbytes=v if bits==8 else (v+1)//2
            data=sl(raw,p,nbytes)
            literals=data if bits==8 else bytes((data[i//2] >> (4 if i%2==0 else 0)) & 15 for i in range(v))
            pixels[y*width+x:y*width+x+v] = literals; x += v; p += nbytes
            if nbytes & 1:
                sl(raw, p, 1); p += 1
    need(eob, 'RLE missing end-of-bitmap')
    return bytes(pixels), p


def dib_pixels(b, h, start=None):
    w, height, bits = h['width'], h['height'], h['bits']
    p = h['pixels_file_offset'] if start is None else start
    if (h['compression'],bits) in ((1,8),(2,4)):
        pixels, consumed = rle8(b[p:], w, height,bits=bits)
        return pixels, p+consumed, 'indexed8-top-down'
    if h['compression'] != 0 or bits not in (1, 4, 8, 24, 32):
        raise Unsupported(f'DIB compression {h["compression"]}, bits {bits}')
    stride = ((w*bits+31)//32)*4
    raw = sl(b, p, stride*height)
    rows = [raw[i*stride:(i+1)*stride] for i in range(height)]
    if h['signed_height'] > 0:
        rows.reverse()
    if bits == 8:
        pixels = b''.join(row[:w] for row in rows)
    elif bits in (1, 4):
        pixels = bytes((row[x*bits//8] >> (8-bits-(x*bits % 8))) & ((1 << bits)-1)
                       for row in rows for x in range(w))
    else:
        step = bits//8
        pixels = b''.join(row[x*step:x*step+3][::-1] for row in rows for x in range(w))
    return pixels, p+len(raw), 'indexed8-top-down' if bits <= 8 else 'rgb24-top-down'


def decode_dib(b, out, bmp=False):
    offset = 14 if bmp else 0
    if bmp:
        need(b[:2] == b'BM', 'BMP magic')
        need(u32(b, 2, '<') <= len(b), 'BMP declared size')
    h = unpack_dib_header(b, offset)
    pixels, end, mode = dib_pixels(b, h, u32(b, 10, '<') if bmp else None)
    out.put('pixels.zlib', zlib.compress(pixels))
    return dict(status='decoded', image=h, pixel_format=mode, decoded_sha256=sha(pixels), **tail(b, end))


def decode_avi(b,out):
    cs,end=riff(b);need(b[8:12]==b'AVI ','not AVI')
    strls=[c for c in flatten(cs) if c.get('form')=='strl'];streams=[]
    for i,c in enumerate(strls):
        hs=[x for x in c['children'] if x['tag']=='strh'];fs=[x for x in c['children'] if x['tag']=='strf']
        need(len(hs)==len(fs)==1,'AVI stream header cardinality')
        h=payload(b,hs[0]);f=payload(b,fs[0]);need(len(h)>=48,'AVI strh')
        stream=dict(index=i,type=four(h[:4]),handler=four(h[4:8]),flags=u32(h,8,'<'),
                    initial_frames=u32(h,16,'<'),scale=u32(h,20,'<'),rate=u32(h,24,'<'),
                    start=u32(h,28,'<'),length=u32(h,32,'<'),sample_size=u32(h,44,'<'),
                    strh_file_offset=hs[0]['payload_offset'],strf_file_offset=fs[0]['payload_offset'])
        if h[:4]==b'vids':
            stream['bitmap']=unpack_dib_header(f)
            for field in ('palette_file_offset','pixels_file_offset'):
                stream['bitmap'][field]+=fs[0]['payload_offset']
        elif h[:4]==b'auds':stream['audio']=pcm_info(f)
        streams.append(stream)
    movis=[c for c in flatten(cs) if c.get('form')=='movi'];need(len(movis)==1,'AVI movi count')
    movi=movis[0];samples=[]
    for c in flatten(movi.get('children',[])):
        tag=c['tag']
        if len(tag)==4 and tag[:2].isdigit() and tag[2:] in ('dc','db','wb','pc'):
            index=int(tag[:2]);need(index<len(streams),'AVI stream chunk index')
            samples.append(dict(stream=index,tag=tag,file_offset=c['payload_offset'],chunk_file_offset=c['file_offset'],size=c['size'],sha256=sha(payload(b,c))))
    index_checks=[]
    for ix in bytag(cs,'idx1'):
        raw=payload(b,ix);need(len(raw)%16==0,'AVI idx1 alignment')
        for p in range(0,len(raw),16):
            tag=raw[p:p+4];flags,offset,size=struct.unpack('<III',raw[p+4:p+16]);matches=[]
            for base in (movi['payload_offset'],movi['payload_offset']+4,0):
                target=base+offset
                if 0<=target<=len(b)-8 and u32(b,target+4,'<')==size:
                    if b[target:target+4]==tag or (b[target:target+4]==b'LIST' and sl(b,target+8,4)==tag):
                        matches.append(target)
            index_checks.append(dict(record_file_offset=ix['payload_offset']+p,tag=four(tag),flags=flags,
                                     recorded_offset=offset,size=size,matching_chunk_offsets=sorted(set(matches))))
    frameout=out.frames();all_decoded=True
    for stream in streams:
        ss=[s for s in samples if s['stream']==stream['index']]
        stream['chunk_count']=len(ss)
        if stream['type']=='auds':
            raw=b''.join(sl(b,s['file_offset'],s['size']) for s in ss if s['tag'].endswith('wb'))
            try:
                count=pcm_validate(stream['audio'],raw)
                out.audio(f"stream-{stream['index']}-audio.wav",raw,stream['audio']['channels'],stream['audio']['bits'],stream['audio']['sample_rate'])
                stream['decode_status']='decoded-pcm';stream['decoded_sample_frames']=count
            except Unsupported as e:
                stream['decode_status']='unsupported-codec';stream['unsupported']=str(e);all_decoded=False
        elif stream['type']=='vids':
            h=stream['bitmap'];prev=None;palette=[rgb[:] for rgb in h['palette']];frame=0;failures=[]
            if h['compression'] not in (0,1,2):
                stream['decode_status']='unsupported-codec';all_decoded=False;continue
            for s in ss:
                raw=sl(b,s['file_offset'],s['size'])
                if s['tag'].endswith('pc'):
                    first,count,flags=struct.unpack('<BBH',sl(raw,0,4));count=count or 256
                    need(len(raw)==4+count*4 and first+count<=len(palette),'AVI palette change bounds')
                    for k in range(count):palette[first+k]=list(raw[4+k*4:7+k*4])
                    s['palette_change']=dict(first=first,count=count,flags=flags,rgb_hex=b''.join(bytes(x) for x in palette).hex());continue
                try:
                    if not raw:
                        need(prev is not None,'AVI empty initial frame');used=0
                    elif h['compression'] in (1,2):
                        prev,used=rle8(raw,h['width'],h['height'],prev,bits=h['bits'])
                        need(not any(raw[used:]),'AVI RLE trailing nonzero bytes')
                    else:
                        frame_header=dict(h,pixels_file_offset=0)
                        prev,used,mode=dib_pixels(raw,frame_header)
                    frameout.add(prev,stream=stream['index'],frame=frame,width=h['width'],height=h['height'],
                                 pixel_format='indexed8-top-down' if h['bits']<=8 else 'rgb24-top-down',
                                 time=[(stream['start']+frame)*stream['scale'],stream['rate']],
                                 palette_rgb_hex=b''.join(bytes(x) for x in palette).hex(),codec_consumed_bytes=used)
                except (Invalid,Unsupported) as e:
                    failures.append(dict(frame=frame,file_offset=s['file_offset'],error=str(e)));all_decoded=False
                    # Delta frames after failure cannot be claimed independently correct.
                    break
                frame+=1
            stream['decoded_frame_count']=frame;stream['failures']=failures
            stream['decode_status']='decoded' if not failures else 'decode-failed'
        else:
            stream['decode_status']='unsupported-stream-type';all_decoded=False
    return dict(status='decoded' if all_decoded else 'indexed-or-partially-decoded',chunks=cs,streams=streams,samples=samples,
                idx1=index_checks,idx1_unresolved_count=sum(not x['matching_chunk_offsets'] for x in index_checks),
                decoded_frames=frameout.close(), **tail(b,end))


def cstring(b,p):
    end=b.find(b'\0',p)
    need(end>=p,'unterminated resource string')
    return dict(file_offset=p,raw_hex=b[p:end].hex(),text_cp1252=b[p:end].decode('cp1252',errors='backslashreplace')),end+1


def win_field(b,p):
    v=sl(b,p,1)[0]
    if v==255:
        return dict(resource_ordinal=u16(b,p+1,'<'),file_offset=p),p+3
    return cstring(b,p)


def dialog(b):
    style=u32(b,0,'<');count=sl(b,4,1)[0];rect=list(struct.unpack('<4h',sl(b,5,8)));p=13
    menu,p=win_field(b,p);cls,p=win_field(b,p);title,p=cstring(b,p)
    result=dict(style=style,control_count=count,rect=rect,menu=menu,window_class=cls,title=title)
    if style & 0x40:
        point=u16(b,p,'<');p+=2;font,p=cstring(b,p);result['font']=dict(point_size=point,name=font)
    controls=[]
    for i in range(count):
        start=p;rect=list(struct.unpack('<4h',sl(b,p,8)));rid=u16(b,p+8,'<');style=u32(b,p+10,'<');p+=14
        v=sl(b,p,1)[0]
        if v & 0x80:
            cls=dict(standard_class=v,file_offset=p);p+=1
        else:cls,p=cstring(b,p)
        title,p=win_field(b,p);extra=sl(b,p,1)[0];p+=1;raw=sl(b,p,extra);p+=extra
        controls.append(dict(index=i,file_offset=start,rect=rect,control_id=rid,style=style,control_class=cls,title=title,extra_hex=raw.hex()))
    result['controls']=controls
    return dict(status='decoded',dialog=result,**tail(b,p))


def group(b,cursor=False):
    reserved,kind,count=struct.unpack('<HHH',sl(b,0,6))
    need(reserved==0 and kind==(2 if cursor else 1),'group resource signature')
    result=[];p=6
    for i in range(count):
        raw=sl(b,p,14)
        if cursor:
            w,h,planes,bits,size,rid=struct.unpack('<HHHHIH',raw)
            row=dict(width=w,height=h,planes=planes,bits=bits,declared_bytes=size)
        else:
            w,h,colors,reserved,planes,bits,size,rid=struct.unpack('<BBBBHHIH',raw)
            row=dict(width=w or 256,height=h or 256,color_count=colors,planes=planes,bits=bits,declared_bytes=size)
        result.append(dict(row,index=i,file_offset=p,resource_type=1 if cursor else 3,resource_id=rid));p+=14
    return dict(status='decoded-resource-bindings',entries=result,**tail(b,p))


def icon(b,out,cursor=False):
    start=4 if cursor else 0
    hot=list(struct.unpack('<HH',sl(b,0,4))) if cursor else None
    h=unpack_dib_header(b,start)
    need(h['height']%2==0,'icon double-height')
    h['stored_double_height']=h['height'];h['height']//=2;h['signed_height']//=2
    raw,end,mode=dib_pixels(b,h)
    maskstride=((h['width']+31)//32)*4
    maskraw=sl(b,end,maskstride*h['height'])
    mask=bytes((maskraw[y*maskstride+x//8] >> (7-x%8))&1
               for y in reversed(range(h['height'])) for x in range(h['width']))
    out.put('pixels.zlib',zlib.compress(raw));out.put('and-mask.zlib',zlib.compress(mask))
    return dict(status='decoded-xor-pixels-and-mask',image=h,pixel_format=mode,hotspot=hot,
                xor_pixels_sha256=sha(raw),and_mask_sha256=sha(mask),**tail(b,end+len(maskraw)))
