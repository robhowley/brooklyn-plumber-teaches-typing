"""Read original resources only as data. Outputs remain local original-derived material."""
import hashlib, json, pathlib, struct, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[2]
ARCHIVE_SHA = 'b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'

def lzss(stream):
    # MARIO.EXE FILE 0x1a020..0x1a0fb. Last 18 ring bytes are not initialized.
    ring = bytearray(b' ' * 4078 + bytes(18))
    known = bytearray([1]*4078 + [0]*18)
    pos, cursor, output = 0, 4078, bytearray()
    def emit(value):
        nonlocal cursor
        output.append(value)
        if len(output) > 64000:
            raise ValueError('output limit')
        ring[cursor] = value
        known[cursor] = 1
        cursor = (cursor+1) & 4095
    while pos < len(stream):
        flags = stream[pos]; pos += 1
        for bit in range(8):
            if pos == len(stream):
                return bytes(output)
            a = stream[pos]; pos += 1
            if flags & (1 << bit):
                emit(a)
            else:
                if pos == len(stream):
                    raise ValueError('truncated copy')
                b = stream[pos]; pos += 1
                source = a | ((b & 240) << 4)
                for i in range((b & 15)+3):
                    index = (source+i)&4095
                    if not known[index]:
                        raise ValueError('uninitialized dictionary read')
                    emit(ring[index])
    return bytes(output)

def decode_bgs(data):
    """FILE 0xd483..0xd4f6: four u32-sized streams; 0xb905 uses LZSS.

    Each expands to 320*129 opaque indices, placed at screen row 26.
    The supplied member ends with an unused zero dword (not a fifth scene).
    """
    pos, entries = 0, []
    for index in range(4):
        if pos+4 > len(data): raise ValueError('BGS size header')
        size = struct.unpack_from('<I', data, pos)[0]
        end = pos+4+size
        if not 0 < size <= 65535 or end > len(data): raise ValueError('BGS stream bounds')
        pixels = lzss(data[pos+4:end])
        if len(pixels) != 320*129: raise ValueError('BGS pixel count')
        entries.append(({'family':'CASTLE.BGS','index':index,'offset':pos,'end':end,
                        'compressedSize':size,'width':320,'height':129,
                        'originX':0,'originY':26,'headerWords':[0,26,320,129],
                        'sourceRect':{'left':0,'top':0,'right':319,'bottom':128},
                        'destinationRect':{'left':0,'top':26,'right':319,'bottom':154},
                        'indicesPath':f'castle/scene-{index}.indices',
                        'indicesSha256':hashlib.sha256(pixels).hexdigest()}, pixels))
        pos = end
    if data[pos:] != bytes(4): raise ValueError('BGS trailer')
    return entries

def decode_raster(data, offset, end):
    if not 0 <= offset < offset+8 <= end <= len(data): raise ValueError('raster bounds')
    x,y,w,h = struct.unpack_from('<hhHH',data,offset)
    if not 0 < w <= 320 or not 0 < h <= 200 or offset+8+w*h != end:
        raise ValueError('raster dimensions')
    return {'headerWords':[x,y,w,h],'originX':x,'originY':y,'width':w,'height':h}, data[offset+8:end]

def decode_gso(index, data, family):
    rows = [line.split(':') for line in index.decode('ascii').splitlines()]
    entries = []
    for i,(name,start) in enumerate(rows):
        offset = int(start)
        end = int(rows[i+1][1]) if i+1 < len(rows) else len(data)
        record,pixels = decode_raster(data,offset,end-2)
        checksum = struct.unpack_from('<H',data,end-2)[0]
        if sum(pixels)&65535 != checksum: raise ValueError('GSO checksum')
        record.update(family=family,index=i,name=name,offset=offset,end=end,checksum16=checksum,
                      indicesPath=f'{family.lower()}/{name}.indices',indicesSha256=hashlib.sha256(pixels).hexdigest())
        entries.append((record,pixels))
    return entries

def decode_idle(index, data):
    entries = []
    lines = index.decode('ascii').splitlines()
    for i,line in enumerate(lines):
        name, offset = line.split(':'); offset = int(offset)
        x,y,w,h,size,unused = struct.unpack_from('<hh4H',data,offset)
        end = offset + 12 + size
        expected_end = int(lines[i+1].split(':')[1]) if i+1<len(lines) else len(data)
        if end != expected_end or unused != 0 or not (0 < w <= 50 and 0 < h <= 50):
            raise ValueError('invalid GCO record')
        pixels = lzss(data[offset+12:end])
        if len(pixels) != w*h:
            raise ValueError('pixel count')
        entries.append(({'family':'IDLE','index':i,'name':name,'offset':offset,'end':end,'headerWords':[x,y,w,h],'originX':x,'originY':y,'width':w,'height':h,'compressedSize':size,'indicesPath':f'idle/{name}.indices','indicesSha256':hashlib.sha256(pixels).hexdigest()},pixels))
    return entries

def decode_ban(data, framebuffer=None):
    """FILE 0x81f0..0x8222, 0x9f37..0x9f8b; changes are persistent.

    Return packet metadata. Optionally apply chunky-mode writes to a 64000-byte
    framebuffer. Literal zero writes zero; repeated zero SKIPS existing pixels.
    """
    pos, frames = 0, []
    while True:
        if pos+2 > len(data): raise ValueError('missing BAN terminator')
        start=pos
        dest=struct.unpack_from('<H',data,pos)[0]
        if dest == 65535:
            if pos+2 != len(data): raise ValueError('BAN trailing bytes')
            return frames
        if pos+4 > len(data): raise ValueError('BAN header')
        count=struct.unpack_from('<H',data,pos+2)[0]
        if dest == 0 and count == 0:
            pos+=4; frames.append({'offset':start,'end':pos,'hold':True}); continue
        if pos+12 > len(data): raise ValueError('BAN packet header')
        header=list(struct.unpack_from('<6H',data,pos)); pos+=12
        written=skipped=0
        for _ in range(count):
            if pos>=len(data): raise ValueError('BAN command')
            code=data[pos];pos+=1
            if code==128:
                if pos+2>len(data): raise ValueError('BAN skip')
                length=struct.unpack_from('<H',data,pos)[0];pos+=2
                skipped+=length;dest+=length
            else:
                length=code+1 if code<128 else 257-code
                if code<128:
                    values=data[pos:pos+length];pos+=length
                    if len(values)!=length: raise ValueError('BAN literals')
                else:
                    if pos>=len(data): raise ValueError('BAN repeat')
                    value=data[pos];pos+=1
                    if value==0:
                        dest+=length;skipped+=length;continue
                    values=bytes([value])*length
                if dest+length>64000: raise ValueError('BAN framebuffer bounds')
                if framebuffer is not None: framebuffer[dest:dest+length]=values
                dest+=length;written+=length
            if dest>65535: raise ValueError('BAN destination wrap unsupported')
        frames.append({'offset':start,'end':pos,'headerWords':header,'writtenPixels':written,'skippedPixels':skipped})

def main():
    archive = pathlib.Path.home()/'Downloads/Mario_Teaches_Typing_1992.zip'
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == ARCHIVE_SHA
    out = ROOT/'assets/render'; (out/'idle').mkdir(parents=True,exist_ok=True)
    members = {}
    with zipfile.ZipFile(archive) as z:
        def get(name):
            member = 'MarioTea/MARIO/'+name; data=z.read(member)
            members[name]={'member':member,'sha256':hashlib.sha256(data).hexdigest(),'size':len(data)}
            return data
        exe=get('MARIO.EXE')
        records=decode_idle(get('IDLE.GCK'),get('IDLE.GCO'))
        sprite_bindings=[]
        for family in ['WALKING','OUTSIDE']:
            data=get(family+'.GSO')
            for i,line in enumerate(get(family+'.GSK').decode('ascii').splitlines()):
                name,offset=line.split(':');offset=int(offset)
                sprite_bindings.append({'family':family,'index':i,'name':name,'offset':offset,'headerWords':list(struct.unpack_from('<hhHH',data,offset))})
        schedules={}
        for char,offset,count,period in [('m',0x2260a,47,90),('l',0x22639,47,124),('p',0x22668,51,104)]:
            schedules[char]={'fileOffset':hex(offset),'thresholds':list(exe[offset:offset+count]),'halfTickPeriod':period}
        scenes=decode_bgs(get('CASTLE.BGS'))
        for family in ['WATER','CASTLE','WALKING']:
            records.extend(decode_gso(get(family+'.GSK'),get(family+'.GSO'),family))
        for i,(offset,end) in enumerate([(0x21d0c,0x21d18),(0x21d18,0x21d29)]):
            record,pixels=decode_raster(exe,offset,end)
            record.update(family='WATER_INLINE',index=i,name=['small','large'][i],fileOffset=hex(offset),
                          indicesPath=f'water/bubble-{i}.indices',indicesSha256=hashlib.sha256(pixels).hexdigest())
            records.append((record,pixels))
        for record,pixels in records+scenes:
            path=out/record['indicesPath']; path.parent.mkdir(parents=True,exist_ok=True)
            path.write_bytes(pixels)
        animations={}
        for name in z.namelist():
            if name.startswith('MarioTea/MARIO/') and name.endswith('.BAN'):
                short=name.rsplit('/',1)[1]
                data=get(short)
                animations[short]=decode_ban(data)
        (out/'ban-packets.json').write_text(json.dumps(animations,indent=2)+'\n')
        ani_tables={}
        for name in z.namelist():
            if name.startswith('MarioTea/MARIO/') and name.endswith('.ANI'):
                short=name.rsplit('/',1)[1]; data=get(short)
                table_end=struct.unpack_from('<I',data,4)[0]
                entries=[]
                for offset in range(0,table_end,8):
                    x,y,raster=struct.unpack_from('<hhI',data,offset)
                    if raster==0:
                        assert offset+8==table_end
                        break
                    assert table_end<=raster<len(data)-8
                    w,h=struct.unpack_from('<HH',data,raster+4)
                    record,pixels=decode_raster(data,raster,raster+8+w*h)
                    record.update(offset=offset,x=x,y=y,rasterOffset=raster,
                                  indicesPath=f'ani/{short}/{raster}.indices',indicesSha256=hashlib.sha256(pixels).hexdigest())
                    path=out/record['indicesPath']; path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(pixels)
                    entries.append(record)
                assert len(entries)==len(animations[short[:-4]+'.BAN'])
                ani_tables[short]=entries
        (out/'ani-tables.json').write_text(json.dumps(ani_tables,indent=2)+'\n')
        base=get('OUTSIDE.CRX')[:768]
        turtle=get('TURTLE.GPO')
        palettes={}
        for char in 'MLP':
            character=get(char+'PALLET.GPO')
            palette=bytearray(base)
            palette[32*3:48*3]=character[32*3:48*3]
            palette[48*3:64*3]=turtle[48*3:64*3]
            palettes[char.lower()]={'rgb6':[list(palette[i:i+3]) for i in range(0,768,3)],'rgb8':[[round(c*255/63) for c in palette[i:i+3]] for i in range(0,768,3)]}
        worlds={}
        for world in ['WATER','CASTLE']:
            data=get(world+'.CRX'); pixels=lzss(data[768:])
            if len(pixels)!=64000: raise ValueError('world background pixel count')
            path=f'{world.lower()}/background.indices'; (out/path).write_bytes(pixels)
            world_palettes={}
            for char in 'MLP':
                palette=bytearray(data[:768]); palette[96:144]=get(char+'PALLET.GPO')[96:144]
                world_palettes[char.lower()]={'rgb6':[list(palette[i:i+3]) for i in range(0,768,3)],
                    'rgb8':[[round(c*255/63) for c in palette[i:i+3]] for i in range(0,768,3)],
                    'baseMember':world+'.CRX','characterMember':char+'PALLET.GPO','replacedSlots':[32,47]}
            worlds[world.lower()]={'background':{'width':320,'height':200,'indicesPath':path,
                'indicesSha256':hashlib.sha256(pixels).hexdigest()},'palettes':world_palettes,
                'bonus':{c:{'ban':c.upper()+('SWM' if world=='WATER' else 'CAS')+'.BAN',
                            'ani':c.upper()+('SWM' if world=='WATER' else 'CAS')+'.ANI'} for c in 'mlp'}}
        for world,callback,table in [('water',0x17ebb,0x21d29),('castle',0xde2e,0x21430)]:
            worlds[world]['bonusPlayback']={'callbackFileOffset':hex(callback),'tickWaitsPerPacket':2,
                'sound7OneBasedFrames':list(exe[table:table+11]),'soundTableFileOffset':hex(table)}
        worlds['castle']['scenes']=[r for r,p in scenes]
        worlds['castle']['clipChanges']=[{'fileOffset':hex(offset),'clip':dict(zip(['left','top','right','bottom'],bounds))}
            for offset,bounds in [(0xc96f,[0,0,46,199]),(0xca0c,[0,0,319,199]),
                (0xcb23,[272,0,319,199]),(0xcbca,[0,0,319,199]),(0xcc95,[0,0,319,91]),
                (0xcfac,[0,0,319,199]),(0xd07f,[0,0,44,199]),(0xd11f,[0,0,319,199]),
                (0xd23f,[269,0,319,199]),(0xd2e0,[0,0,319,199]),(0xd39b,[0,0,319,199])]]
        worlds['castle']['temporaryClips']=[{'saveFileOffset':'0xbb27','setFileOffset':'0xbb3c',
            'clip':{'left':0,'top':0,'right':319,'bottom':199},'restoreFileOffset':'0xc02d'},
            {'saveFileOffset':'0xdb87','setFileOffset':'0xdb9b','replaceTop':69,'restoreFileOffset':'0xdbee'},
            {'saveFileOffset':'0xdcab','setFileOffset':'0xdcbf','replaceTop':37,'restoreFileOffset':'0xdd54'}]
        worlds['water']['frames']={'swim':{c:list(range(i*6,i*6+6)) for i,c in enumerate('mlp')},
            'sunk':dict(zip('mlp',[34,35,36])),'bite':list(range(18,23)),'octo':list(range(23,33)),'bonus':33}
        worlds['castle']['frames']={'rockface':list(range(4)),'pipe1':list(range(4,9)),
            'pipe2':list(range(9,14)),'bonus':14,
            'failureIdle':{c:list(range(start,start+count)) for c,start,count in [('m',0,47),('l',47,47),('p',94,51)]},
            'run':{c:list(range(i*30,i*30+12)) for i,c in enumerate('mlp')},
            'jump':{c:list(range(i*30+12,i*30+25)) for i,c in enumerate('mlp')},
            'sink':{c:list(range(i*30+25,i*30+30)) for i,c in enumerate('mlp')}}
        # DS:0312 is the raw 20x16 tile used by FILE 0x994d (no header).
        tile=exe[0x1f582:0x1f582+320]
        (out/'ground.indices').write_bytes(tile)
        manifest={'archiveSha256':ARCHIVE_SHA,'members':members,'spriteBindings':sprite_bindings,'idleSchedules':schedules,'aniTablePath':'ani-tables.json','banPacketPath':'ban-packets.json','sprites':[r for r,p in records],'worlds':worlds,'palettes':palettes,'ground':{'fileOffset':'0x1f582','width':20,'height':16,'indicesPath':'ground.indices','indicesSha256':hashlib.sha256(tile).hexdigest()},'license':'Original-derived local-only material, not MIT.','pathBase':'All indicesPath values relative to this manifest.'}
        (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'sprites':len(records),'castleScenes':len(scenes),'pixels':sum(len(p) for r,p in records),'palettes':list(palettes)}))

if __name__=='__main__':
    main()
