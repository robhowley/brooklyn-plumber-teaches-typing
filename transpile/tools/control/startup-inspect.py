"""Static startup inputs. Never execute archive code. Generated output stays under assets/."""
import hashlib, importlib.util, json, pathlib, struct, subprocess, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[2]
ARCHIVE = pathlib.Path.home() / 'Downloads/Mario_Teaches_Typing_1992.zip'
ARCHIVE_SHA = 'b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd'
EXE_SHA = '6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e'
SPANS = {'presentation': (0xfb90,0x103be), 'menu-idle': (0x10b31,0x10ce3),
         'menu-entry': (0x10ce3,0x10e31), 'demo-profile': (0xe3bc,0xe3ed),
         'outdoor-demo': (0x13aaf,0x13ba1), 'water-demo': (0x17736,0x177ff),
         'castle-demo': (0xbcd0,0xbd8e), 'practice-demo-poll': (0xb59a,0xb5f1),
         'practice-demo-key': (0xb6af,0xb73d), 'fade': (0x14bb4,0x14d0b),
         'waits': (0x1927f,0x1935b), 'palette-write': (0x14d0b,0x14d8b),
         'menu-demo-entry': (0x11419,0x11434),
         'outdoor-countdown': (0x1272e,0x12770), 'water-countdown': (0x16803,0x16840),
         'castle-countdown': (0xd54f,0xd580), 'practice-countdown': (0xb0bc,0xb0e0)}

def main():
    assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() == ARCHIVE_SHA
    # Reuse the inspected, authored data decoders, not an original loader.
    spec = importlib.util.spec_from_file_location('render_decode', ROOT/'tools/render/decode.py')
    decoder = importlib.util.module_from_spec(spec); spec.loader.exec_module(decoder)
    out = ROOT/'assets/startup'; out.mkdir(parents=True,exist_ok=True)
    manifest = {'archiveSha256': ARCHIVE_SHA, 'members': {}, 'spans': {}, 'scenes': {}, 'sprites': {},
                'license':'Original-derived local-only material, not MIT.',
                'pathBase':'Resource paths are relative to this manifest.'}
    with zipfile.ZipFile(ARCHIVE) as z:
        def get(short):
            name = 'MarioTea/MARIO/'+short; data=z.read(name)
            manifest['members'][short]={'member':name,'sha256':hashlib.sha256(data).hexdigest(),'size':len(data)}
            return data
        exe=get('MARIO.EXE'); assert hashlib.sha256(exe).hexdigest()==EXE_SHA
        messages=get('ENGLISH.MSD'); count,size=struct.unpack_from('<HH',messages)
        start=4+count*4; assert start+size==len(messages)
        for i in range(count):
            key,offset=struct.unpack_from('<HH',messages,4+i*4)
            if key==2000:
                a=start+offset; end=messages.index(0,a)
                manifest['demoProfile']={'messageIndex':2000,'memberOffset':a,'name':messages[a:end].decode('ascii')}
        assert manifest['demoProfile']['name']=='Demo'
        for name,(a,e) in SPANS.items():
            manifest['spans'][name]={'start':a,'endExclusive':e,'sha256':hashlib.sha256(exe[a:e]).hexdigest()}
            code=exe[a:e]; names=b'\0.text\0.shstrtab\0'; noff=52+len(code); shoff=(noff+len(names)+3)&~3
            header=b'\x7fELF'+bytes([1,1,1])+bytes(9)+struct.pack('<HHIIIIIHHHHHH',1,3,1,0,0,shoff,0,52,0,0,40,3,2)
            sections=bytes(40)+struct.pack('<10I',1,1,6,a,52,len(code),0,0,1,0)+struct.pack('<10I',7,3,0,0,noff,len(names),0,0,1,0)
            inert=out/(name+'.elf.data'); inert.write_bytes(header+code+names+bytes(shoff-noff-len(names))+sections)
            try:
                result=subprocess.run(['objdump','-d','--triple=i386-unknown-unknown-code16','--x86-asm-syntax=intel',str(inert)],capture_output=True,text=True,check=True)
                (out/(name+'.asm.txt')).write_text(result.stdout)
            finally: inert.unlink()
        manifest['initialState']={}
        for ds,size in [(0x4833,4),(0x4837,4),(0x4e2c,2),(0x41ac,2)]:
            offset=0x1f270+ds
            manifest['initialState'][hex(ds)]={'fileOffset':offset,'size':size,
                'value':int.from_bytes(exe[offset:offset+size],'little')}
        for short in ['LOGO','GREETBG','GREET']:
            data=get(short+'.CRX'); pixels=decoder.lzss(data[768:]); assert len(pixels)==64000
            (out/(short+'.indices')).write_bytes(pixels); (out/(short+'.rgb6')).write_bytes(data[:768])
            manifest['scenes'][short]={'indicesPath':short+'.indices','palettePath':short+'.rgb6',
                'indicesSha256':hashlib.sha256(pixels).hexdigest()}
        for family in ['GREET','GREET2']:
            records=decoder.decode_gso(get(family+'.GSK'),get(family+'.GSO'),family)
            manifest['sprites'][family]=[]
            for record,pixels in records:
                path=out/record['indicesPath']; path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(pixels)
                manifest['sprites'][family].append(record)
        pointer,segment=struct.unpack_from('<HH',exe,0x1f270+0x2442)
        p=0x2e00+segment*16+pointer
        manifest['letters']=exe[p:p+13].decode('ascii')
        manifest['letterX']=list(struct.unpack_from('<13h',exe,0x1f270+0x2428))
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'scenes':len(manifest['scenes']),'sprites':{k:len(v) for k,v in manifest['sprites'].items()},'spans':len(SPANS),'letters':manifest['letters']}))

if __name__ == '__main__': main()
