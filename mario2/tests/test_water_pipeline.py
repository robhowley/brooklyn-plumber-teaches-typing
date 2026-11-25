"""Water inert-data extraction, independently expanded source words and run writes."""
import copy
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

class WaterPipeline(unittest.TestCase):
    def test_persistent_literal_zero_erase_skip_and_zero_repeat(self):
        header=lambda runs:struct.pack('<HH8x',0,runs)
        # Seed three bytes, retain first with skip, erase second with literal0,
        # retain third with zero-repeat. Empty record changes nothing.
        raw=header(1)+bytes([2,7,8,9])+b'\0\0\0\0'+header(3)+bytes([128,1,0,0,0,255,0])+b'\xff\xff'
        with tempfile.TemporaryDirectory() as d:
            old=decode.HERE
            try:
                decode.HERE=Path(d);out=decode.Outputs('a'*64)
                result=decode.decode_outside(raw,out,'BAN',persistent=True)
                planes=zlib.decompress((decode.HERE/out.artifacts[0]['path']).read_bytes())
                self.assertEqual(planes[:3],bytes([7,8,9]))
                self.assertEqual(planes[64000:64004],bytes([7,0,9,0]))
                self.assertTrue(result['frames'][1]['empty'])
            finally:decode.HERE=old

    @unittest.skipUnless(os.getenv('MARIO2_TEST_ISO'),'requires pinned ISO')
    def test_source_tables_and_all_special_planes(self):
        pins=json.loads(build.PINS.read_text());source=Source(pins,Path(os.environ['MARIO2_TEST_ISO']))
        try:
            exe=source.read(pins['executable']);pp=json.loads((build.ROOT/'presentation-pins.json').read_text())
            result=decode_presentation(exe,pp);animation=result['waterAnimation']
            for field,offset,count,stride,signed in [('swimSelectors',0x20c68,3,2,False),('pursuerY',0x20c98,10,4,True),('fingerX',0x20c40,10,2,False),('fingerY',0x20c54,10,2,False)]:
                expected=[int.from_bytes(exe[offset+i*stride:offset+i*stride+2],'little',signed=signed)for i in range(count)]
                self.assertEqual(animation[field],expected,field)
            self.assertEqual(animation['fingerMap'],list(exe[0x20bc0:0x20c40]))
            self.assertEqual(animation['bubblePositions'],[[int.from_bytes(exe[p:p+2],'little',signed=True),int.from_bytes(exe[p+2:p+4],'little',signed=True)]for p in range(0x20c70,0x20c98,4)])
            for pin in pp['waterSprites']:
                off=pin['table']['file_offset'];size=pin['table']['size'];values=[int.from_bytes(exe[p:p+2],'little')for p in range(off+2,off+size,2)]
                self.assertEqual(result['waterSprites'][str(pin['selector'])],values)
                self.assertEqual(animation['frameLengths'][str(pin['selector'])],len(values))
            for name in pp['slices']:
                if not name.startswith('water'):continue
                bad=copy.deepcopy(pp);bad['slices'][name]['file_offset']+=1
                with self.assertRaises(ValueError):decode_presentation(exe,bad)
            self.assertEqual(json.loads((build.DIST/'presentation.json').read_text())['waterAnimation'],animation)
            presentations=0
            for asset in pins['assets']:
                if 'SWM.' not in asset['id']:continue
                raw=source.read(asset['source']);built=json.loads((build.DIST/'assets.json').read_text())['assets'][asset['id']]
                actual=zlib.decompress((build.DIST/built['files']['planes.zlib']).read_bytes());expected=bytearray();p=0
                if asset['index'].endswith('ANI'):
                    while True:
                        pointer=int.from_bytes(raw[p+4:p+8],'little');p+=8
                        if not pointer:break
                        w,h=struct.unpack_from('<HH',raw,pointer+4);expected.extend(raw[pointer+8:pointer+8+w*h])
                else:
                    plane=[0]*64000
                    while raw[p:p+2]!=b'\xff\xff':
                        cursor,runs=struct.unpack_from('<HH',raw,p)
                        if cursor==runs==0:p+=4;continue
                        p+=12;presentations+=1
                        for _ in range(runs):
                            code=raw[p];p+=1
                            if code==128:cursor+=int.from_bytes(raw[p:p+2],'little');p+=2;continue
                            if code>128:
                                values=[raw[p]]*(257-code);p+=1
                                if not values[0]:cursor+=len(values);continue
                            else:values=list(raw[p:p+code+1]);p+=code+1
                            for value in values:plane[cursor]=value;cursor+=1
                        expected.extend(plane)
                self.assertEqual(actual,expected,asset['source']['path']+' '+asset['source']['sha256'])
            self.assertEqual(presentations,157)
        finally:source.close()
