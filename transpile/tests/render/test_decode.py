import hashlib, json, pathlib, re, struct, sys, unittest, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/render'))
from decode import lzss, decode_idle, decode_ban, decode_bgs, decode_raster, decode_gso, ARCHIVE_SHA

class DecodeTests(unittest.TestCase):
    def test_lzss_overlap_and_spaces(self):
        self.assertEqual(lzss(bytes([1,65,0xee,0xf3])),b'A'*7)
        self.assertEqual(lzss(bytes([0,0,0])),b' '*3)
        with self.assertRaises(ValueError): lzss(bytes([0,0]))
        with self.assertRaises(ValueError): lzss(bytes([0,0xff,0xf0]))

    def test_ban_literal_zero_repeat_zero_and_skip(self):
        # Literal 0,7; skip repeated zeros (3); repeat 9 (2); long skip (4).
        packet=struct.pack('<6H',1,4,0,0,0,0)+bytes([1,0,7,254,0,255,9,128,4,0])+b'\xff\xff'
        screen=bytearray([5]*64000)
        frames=decode_ban(packet,screen)
        self.assertEqual(list(screen[:10]),[5,0,7,5,5,5,9,9,5,5])
        self.assertEqual(frames[0]['writtenPixels'],4)
        self.assertEqual(frames[0]['skippedPixels'],7)
        self.assertEqual(decode_ban(b'\0\0\0\0\xff\xff'),[{'offset':0,'end':4,'hold':True}])
        with self.assertRaises(ValueError): decode_ban(packet[:-1])
        with self.assertRaises(ValueError): decode_ban(packet+b'\0')

    def test_bgs_and_raster_bounds(self):
        with zipfile.ZipFile(pathlib.Path.home()/'Downloads/Mario_Teaches_Typing_1992.zip') as z:
            data=z.read('MarioTea/MARIO/CASTLE.BGS')
        for bad in [b'',data[:3],data[:-1],data+b'\0',struct.pack('<I',0)+data[4:],
                    struct.pack('<I',65536)+data[4:],struct.pack('<I',1)+data[4:]]:
            with self.subTest(size=len(bad)), self.assertRaises(ValueError): decode_bgs(bad)
        for data,start,end in [(bytes(8),0,8),(bytes(7),0,7),(bytes(12),-1,12),
                               (struct.pack('<hhHH',0,0,2,2)+bytes(3),0,11)]:
            with self.assertRaises(ValueError): decode_raster(data,start,end)
        good=struct.pack('<hhHH',-1,2,2,2)+bytes([0,1,2,3])+struct.pack('<H',6)
        self.assertEqual(decode_gso(b'test:0',good,'TEST')[0][1],bytes([0,1,2,3]))
        with self.assertRaises(ValueError): decode_gso(b'test:0',good[:-1]+b'\1','TEST')

    def test_world_sources_and_pixels(self):
        manifest=json.loads((ROOT/'assets/render/manifest.json').read_text())
        with zipfile.ZipFile(pathlib.Path.home()/'Downloads/Mario_Teaches_Typing_1992.zip') as z:
            exe=z.read('MarioTea/MARIO/MARIO.EXE')
            # Verify static listing byte provenance, never execute the listed instructions.
            for path in ['worlds/castle.asm.txt','worlds/water.asm.txt','render/1d610.asm.txt','render/09940.asm.txt']:
                for line in (ROOT/'analysis'/path).read_text().splitlines():
                    match=re.match(r'\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} )+)',line)
                    if match:
                        offset=int(match[1],16); raw=bytes.fromhex(match[2])
                        # ELF metadata sections are not executable-member spans.
                        if offset >= 0x2e00: self.assertEqual(exe[offset:offset+len(raw)],raw,(path,hex(offset)))
            # Scene0 starts with flag FF followed by eight literal source pixels.
            self.assertEqual(z.read('MarioTea/MARIO/CASTLE.BGS')[4:13],bytes([255,27,26,8,8,8,28,29,127]))
            expected_hashes=['88a8c7d7fc4cf87d3f541d2392e8f53ea48c4bbdea56d76c99dccc4d7407f0a5',
                '9f45ba040b171957b69ea59129e58accb280eec0e1a8526460c53bf8c50dd605',
                'be4825c68afd1975e4129e5798b3fec256f2a49dc6676f8673b5209206812bd4',
                '4af4d9c1070daa61fa513e15004fd63e437fe2108fedb104e860bbb732b7229b']
            for (record,pixels),offset,size,digest,first in zip(decode_bgs(z.read('MarioTea/MARIO/CASTLE.BGS')),
                    [0,0x280a,0x5cc9,0x8894],[10246,13499,11207,13272],expected_hashes,[27,16,23,7]):
                self.assertEqual((record['offset'],record['compressedSize'],len(pixels)),(offset,size,41280))
                self.assertEqual(hashlib.sha256(pixels).hexdigest(),digest)
                self.assertEqual(pixels[0],first)
                self.assertEqual((ROOT/'assets/render'/record['indicesPath']).read_bytes(),pixels)
                self.assertEqual(record,manifest['worlds']['castle']['scenes'][record['index']])
            for family,count in [('WATER',37),('CASTLE',15),('WALKING',90)]:
                records=decode_gso(z.read('MarioTea/MARIO/'+family+'.GSK'),z.read('MarioTea/MARIO/'+family+'.GSO'),family)
                self.assertEqual(len(records),count)
                for record,pixels in records:
                    self.assertIn(record,manifest['sprites'])
                    self.assertEqual((ROOT/'assets/render'/record['indicesPath']).read_bytes(),pixels)
            bubbles=[r for r in manifest['sprites'] if r['family']=='WATER_INLINE']
            for record,expected in zip(bubbles,[bytes([0,0,0,15]),bytes([0,15,0,15,0,15,0,15,0])]):
                self.assertEqual((ROOT/'assets/render'/record['indicesPath']).read_bytes(),expected)
                start=int(record['fileOffset'],16)
                self.assertEqual(exe[start+8:start+8+len(expected)],expected)
            for world in ['water','castle']:
                for char in 'mlp':
                    palette=bytearray(z.read('MarioTea/MARIO/'+world.upper()+'.CRX')[:768])
                    palette[96:144]=z.read('MarioTea/MARIO/'+char.upper()+'PALLET.GPO')[96:144]
                    if world=='water': palette[144:192]=z.read('MarioTea/MARIO/BITER.GPO')[144:192]
                    actual=manifest['worlds'][world]['palettes'][char]['rgb6']
                    self.assertEqual(bytes(v for rgb in actual for v in rgb),palette)

    def test_archive_and_all_outputs(self):
        archive=pathlib.Path.home()/'Downloads/Mario_Teaches_Typing_1992.zip'
        self.assertEqual(hashlib.sha256(archive.read_bytes()).hexdigest(),ARCHIVE_SHA)
        manifest=json.loads((ROOT/'assets/render/manifest.json').read_text())
        with zipfile.ZipFile(archive) as z:
            for item in manifest['members'].values():
                self.assertEqual(hashlib.sha256(z.read(item['member'])).hexdigest(),item['sha256'])
            entries=decode_idle(z.read('MarioTea/MARIO/IDLE.GCK'),z.read('MarioTea/MARIO/IDLE.GCO'))
            self.assertEqual(len(entries),145)
            self.assertEqual(sum(len(p) for r,p in entries),166926)
            for record,pixels in entries:
                self.assertEqual((ROOT/'assets/render'/record['indicesPath']).read_bytes(),pixels)
                self.assertEqual(record,manifest['sprites'][record['index']])
            packets=json.loads((ROOT/'assets/render/ban-packets.json').read_text())
            self.assertEqual(len(packets),13)
            for name,expected in packets.items():
                self.assertEqual(decode_ban(z.read('MarioTea/MARIO/'+name),bytearray(64000)),expected)
            tables=json.loads((ROOT/'assets/render/ani-tables.json').read_text())
            self.assertEqual(len(tables),9)
            for name,entries in tables.items():
                data=z.read('MarioTea/MARIO/'+name)
                self.assertEqual(len(entries),len(packets[name[:-4]+'.BAN']))
                for e in entries:
                    self.assertEqual(struct.unpack_from('<hhI',data,e['offset']),(e['x'],e['y'],e['rasterOffset']))
                    self.assertEqual(list(struct.unpack_from('<hhHH',data,e['rasterOffset'])),e['headerWords'])
                    start=e['rasterOffset']+8; pixels=data[start:start+e['width']*e['height']]
                    self.assertEqual((ROOT/'assets/render'/e['indicesPath']).read_bytes(),pixels)
                    self.assertEqual(hashlib.sha256(pixels).hexdigest(),e['indicesSha256'])
            exe=z.read('MarioTea/MARIO/MARIO.EXE')
            self.assertEqual((ROOT/'assets/render/ground.indices').read_bytes(),exe[0x1f582:0x1f6c2])
            for char in 'mlp':
                palette=bytearray(z.read('MarioTea/MARIO/OUTSIDE.CRX')[:768])
                palette[96:144]=z.read('MarioTea/MARIO/'+char.upper()+'PALLET.GPO')[96:144]
                palette[144:192]=z.read('MarioTea/MARIO/TURTLE.GPO')[144:192]
                self.assertEqual(bytes(v for rgb in manifest['palettes'][char]['rgb6'] for v in rgb),palette)
            evidence=json.loads((ROOT/'analysis/render/evidence.json').read_text())
            for span in evidence['spans']:
                self.assertEqual(exe[int(span['start'],16):int(span['endExclusive'],16)].hex(),span['bytes'])

if __name__=='__main__': unittest.main()
