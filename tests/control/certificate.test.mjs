import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { certificateLevels, certificateDocument } from '../../recovered/control/certificate.mjs';
import { newStudent, readStudent } from '../../recovered/control/student.mjs';

const data=JSON.parse(readFileSync(new URL('../../app/data.json',import.meta.url)));
const bytes=newStudent('ADA');bytes.set([1,1,0,0,1,0,1,0,1],38);
const profile=readStudent(bytes);

test('only completed levels can print, including already printed and nonpending levels',()=>{
  const before=structuredClone(profile),raw=bytes.slice();
  assert.deepEqual(certificateLevels(profile),[1,2]);
  assert.deepEqual(certificateLevels({...profile,profilePresent:false}),[]);
  assert.deepEqual(certificateLevels({...profile,completed:[0,0,0]}),[]);
  for(const level of [0,3,4,1.5,NaN,'1'])
    assert.throws(()=>certificateDocument(profile,level,data),RangeError);
  assert.equal(certificateDocument(profile,2,data),certificateDocument(profile,2,data));
  assert.deepEqual(profile,before);assert.deepEqual(bytes,raw);
});

test('entire padded CRLF document matches independently decoded pinned source for every level/name',()=>{
  // Inert ZIP member reads only. Independent Python oracle, no app bundle or
  // recovered generator used to obtain original art/messages or expected rows.
  const expected=JSON.parse(execFileSync('python3',['-B','-c',`
import sys, json, struct, zipfile, hashlib
sys.path.insert(0,'tools')
from source import ensure_archive, EXE_MEMBER, EXE_SHA256
with zipfile.ZipFile(ensure_archive()) as z:
 b=z.read(EXE_MEMBER);m=z.read('MarioTea/MARIO/ENGLISH.MSD')
assert hashlib.sha256(b).hexdigest()==EXE_SHA256
assert hashlib.sha256(m).hexdigest()=='fd2168878e19b1b85ae0c6ce8e14ad4386a801e7c460ed134bde5f181cb29e15'
n=struct.unpack_from('<H',m)[0];messages={}
for i in range(n):
 key,offset=struct.unpack_from('<HH',m,4+i*4);start=4+n*4+offset
 messages[key]=m[start:m.index(0,start)].decode('ascii')
art=[]
for i in range(31):
 off,seg=struct.unpack_from('<HH',b,0x20d4e+4*i);p=0x2e00+16*seg+off
 art.append(b[p:b.index(0,p)].decode('ascii'))
result=[]
for name in ['A','ADA','12345678','ABCDEFGHIJK','<>&"']:
 for level in range(1,4):
  grid=[[' ']*80 for _ in range(60)]
  for y in range(2,58):
   for x in range(2,78):
    if y in (2,57) or x in (2,77):grid[y][x]='*'
  entries=list(enumerate(art,7))+[(41,messages[4200]),(43,messages[4201]),(46,messages[4202]),(48,name),(50,messages[4203]),(52,messages[4204]%messages[199+level]),(54,messages[4205])]
  for y,text in entries:
   x=40-len(text)//2;grid[y][x:x+len(text)]=text
  result.append(dict(name=name,level=level,text=''.join(''.join(row)+'\\r\\n' for row in grid)))
print(json.dumps(result))
`],{encoding:'utf8'}));
  for(const {name,level,text} of expected) {
    const p={...profile,name,completed:[1,1,1]};const before=structuredClone(p);
    const actual=certificateDocument(p,level,data);
    assert.equal(actual,text,`${name}/${level}`);
    assert.equal(actual.length,60*82);
    assert.equal(actual.split('\r\n').length,61);
    assert.ok(actual.split('\r\n').slice(0,60).every(row=>row.length===80));
    assert.equal(actual.replaceAll('\r\n','').includes('\n'),false);
    assert.deepEqual(p,before);
  }
});
