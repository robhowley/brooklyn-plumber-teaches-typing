"""Outside data bounds and independent disc-to-output resource checks."""
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
import unittest
import zlib
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import build
import decode
from source import Source
from presentation import decode_presentation


class OutsidePipeline(unittest.TestCase):
    def test_ban_empty_skip_literal_repeat_clear_and_bounds(self):
        # Empty record then literal [63,0], repeat9 twice, skip one pixel.
        raw=struct.pack('<HH',0,0)+struct.pack('<HH8x',0,3)+bytes([1,63,0,255,9,128,1,0])+b'\xff\xff'
        with tempfile.TemporaryDirectory() as d:
            old=decode.HERE
            try:
                decode.HERE=Path(d);out=decode.Outputs('a'*64)
                result=decode.decode_outside(raw,out,'BAN')
                self.assertTrue(result['frames'][0]['empty'])
                pixels=zlib.decompress((decode.HERE/out.artifacts[0]['path']).read_bytes())
                self.assertEqual(len(pixels),64000)
                self.assertEqual(pixels[:6],bytes([63,0,9,9,0,0]))
                with self.assertRaises(ValueError):
                    decode.decode_outside(struct.pack('<HH8x',63999,1)+bytes([255,1])+b'\xff\xff',out,'BAN')
            finally:
                decode.HERE=old

    @unittest.skipUnless(os.getenv('MARIO2_TEST_ISO'),'requires pinned ISO')
    def test_animation_source_words_and_pin_refusals(self):
        pins=json.loads(build.PINS.read_text())
        source=Source(pins,Path(os.environ['MARIO2_TEST_ISO']))
        try:
            executable=source.read(pins['executable'])
        finally:source.close()
        presentation_pins=json.loads((build.ROOT/'presentation-pins.json').read_text())
        result=decode_presentation(executable,presentation_pins)['outsideAnimation']
        built=json.loads((build.DIST/'presentation.json').read_text())['outsideAnimation']
        self.assertEqual(built,result)
        vectors=[('outsideJumpY',result['jumpY'],0x2069c,24),
                 ('outsideIdleLength',result['idleLength'],0x207da,6)]
        for i,(name,offset,size) in enumerate([
                ('outsideIdleMario',0x206b8,94),('outsideIdlePeach',0x20774,102),
                ('outsideIdleLuigi',0x20716,94)]):
            vectors.append((name,result['idleThresholds'][i],offset,size))
        for name,values,offset,size in vectors:
            # Independent signed-byte-pair expansion, no production words helper.
            expected=[int.from_bytes(executable[p:p+2],'little',signed=True)
                      for p in range(offset,offset+size,2)]
            self.assertEqual(values,expected,f'{name} FILE {offset:#x}')
            bad=json.loads(json.dumps(presentation_pins))
            bad['slices'][name]['file_offset']+=2
            with self.assertRaisesRegex(ValueError,'slice mismatch'):
                decode_presentation(executable,bad)

    @unittest.skipUnless(os.getenv('MARIO2_TEST_ISO'),'requires pinned ISO')
    def test_all_six_source_resource_planes_independently(self):
        pins=json.loads(build.PINS.read_text())
        source=Source(pins,Path(os.environ['MARIO2_TEST_ISO']))
        try:
            with tempfile.TemporaryDirectory() as d:
                old=decode.HERE
                try:
                    decode.HERE=Path(d)
                    for a in pins['assets']:
                        if a.get('type')!='FULLSCREENANIM':continue
                        raw=source.read(a['source']);out=decode.Outputs(a['source']['sha256'])
                        result=decode.decode_outside(raw,out,a['index'][-3:])
                        actual=zlib.decompress((decode.HERE/out.artifacts[0]['path']).read_bytes())
                        expected=bytearray();p=0;count=0
                        if a['index'].endswith('ANI'):
                            for p in range(0,int.from_bytes(raw[4:8],'little'),8):
                                x,y,ptr=struct.unpack_from('<hhI',raw,p)
                                if not ptr:break
                                w,h=struct.unpack_from('<hh',raw,ptr+4)
                                expected.extend(raw[ptr+8:ptr+8+w*h]);count+=1
                        else:
                            while raw[p:p+2]!=b'\xff\xff':
                                start,runs=struct.unpack_from('<HH',raw,p);count+=1
                                if start==runs==0:p+=4;continue
                                p+=12;plane=[0]*64000;cursor=start
                                for _ in range(runs):
                                    code=raw[p];p+=1
                                    if code==128:
                                        cursor+=int.from_bytes(raw[p:p+2],'little');p+=2;continue
                                    if code>128:
                                        n=257-code;values=[raw[p]]*n;p+=1
                                    else:
                                        n=code+1;values=list(raw[p:p+n]);p+=n
                                    # Independent destination-list expansion, not production slices.
                                    for value in values:
                                        plane[cursor]=value;cursor+=1
                                expected.extend(plane)
                        self.assertEqual(len(result['frames']),count,a['id'])
                        self.assertEqual(actual,expected,a['source']['path']+' '+a['source']['sha256'])
                finally:decode.HERE=old
        finally:source.close()
