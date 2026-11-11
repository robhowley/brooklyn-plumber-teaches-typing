import hashlib, json, pathlib, struct, sys, unittest, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/render'))
from decode import lzss, decode_idle, decode_ban, ARCHIVE_SHA

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
