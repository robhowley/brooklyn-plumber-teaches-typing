// Repository-authored, data-only import. Never imports or executes source members.
// node scripts/import-static-assets.mjs /path/to/base-checkout
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
const base = resolve(process.argv[2] || '.');
const research = resolve(base, 'research/executable-1992/screens');
const raw = resolve(base, 'research/gameplay-mechanics-2026-11-09/dos-resources/extracted');
const evidence = JSON.parse(readFileSync(resolve(research, 'evidence.json')));
const hash = b => createHash('sha256').update(b).digest('hex');
const member = name => { if (!/^MarioTea\/MARIO\/[A-Z0-9]+\.(CRX|GSO|GSK|GPO)$/.test(name)) throw Error('Not static art'); return readFileSync(resolve(raw, name)); };
function expandScreen(bytes) {
  const ring = Buffer.alloc(4096), known = new Uint8Array(4096), out = [];
  let cursor = 4078, pos = 768;
  const emit = value => { if (out.length >= 64000) throw Error('Screen overflow'); out.push(value); ring[cursor] = value; known[cursor] = 1; cursor = (cursor + 1) & 4095; };
  while (pos < bytes.length) {
    const flags = bytes[pos++];
    for (let bit = 0; bit < 8 && pos < bytes.length; bit++) {
      if (flags & (1 << bit)) emit(bytes[pos++]);
      else {
        if (pos + 2 > bytes.length) throw Error('Truncated screen');
        const a = bytes[pos++], b = bytes[pos++], start = a | ((b & 240) << 4);
        for (let i = 0; i < (b & 15) + 3; i++) {
          const index = (start + i) & 4095;
          if (!known[index]) throw Error('Unknown dictionary byte');
          emit(ring[index]);
        }
      }
    }
  }
  if (out.length !== 64000) throw Error('Screen size');
  return Buffer.from(out);
}
// Existing research PNGs use RGB8, filter zero. Reject anything else, rather than guessing.
function pngPixels(bytes, width, height) {
  if (bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw Error('PNG signature');
  const chunks = []; let pos = 8;
  while (pos < bytes.length) {
    const n = bytes.readUInt32BE(pos), type = bytes.toString('ascii', pos+4, pos+8), data = bytes.subarray(pos+8,pos+8+n); pos += n+12;
    if (type === 'IHDR' && (data.readUInt32BE(0)!==width || data.readUInt32BE(4)!==height || data[8]!==8 || data[9]!==2)) throw Error('PNG geometry');
    if (type === 'IDAT') chunks.push(data);
  }
  const scan = inflateSync(Buffer.concat(chunks)), rgb = Buffer.alloc(width*height*3);
  for(let y=0;y<height;y++) { if(scan[y*(width*3+1)]!==0) throw Error('PNG filter'); scan.copy(rgb,y*width*3,y*(width*3+1)+1,(y+1)*(width*3+1)); }
  return rgb;
}
const assets = {}, records = [];
function add(id, pixels, width, height, source, paletteMember, transparent = null) {
  const paletteBytes = member(paletteMember).subarray(0,768);
  if(paletteBytes.length!==768 || Math.max(...paletteBytes)>63) throw Error('Palette');
  const palette = [...paletteBytes].map(v=>Math.round(v*255/63));
  const previewPalette = member(source.palette_member || paletteMember).subarray(0,768);
  const previewRGB = Buffer.from([...pixels].flatMap(v=>[...previewPalette.subarray(v*3,v*3+3)].map(c=>Math.round(c*255/63))));
  const png = readFileSync(resolve(research,source.image));
  if(!pngPixels(png,width,height).equals(previewRGB)) throw Error(`Decoded source mismatch: ${id}`);
  // Font colors follow the screenshot evidence, not a proved DOS runtime palette.
  const screenshotFont=id.startsWith('FONT7H-'), rasterPalette=palette.slice();
  if(screenshotFont) {
    rasterPalette.splice(3,3,255,255,255); // Index 1: white glyph core.
    rasterPalette.splice(6,3,0,0,0); // Index 2: black outline.
  }
  assets[id] = {width,height,palette:rasterPalette,pixels:pixels.toString('base64'),transparent};
  const bytes=member(source.member);
  records.push({id,member:source.member,memberSha256:hash(bytes),indexMember:source.index_member || null,indexSha256:source.index_member?hash(member(source.index_member)):null,record:source.name || null,span:source.offset===undefined?[768,bytes.length]:[source.offset,source.end],pixelSha256:hash(pixels),paletteMember,paletteSha256:hash(paletteBytes),decodedReference:source.image,decodedReferenceSha256:hash(png),width,height,transparentIndex:transparent,adaptation:screenshotFont?'Screenshot-informed browser colors: index 1 white core and index 2 black outline; original runtime palette unverified.':paletteMember!==source.palette_member && source.palette_member ? 'Matching character/object GPO replaces preview palette; inferred binding.' : transparent===null?'None.':'Index zero made transparent for compositing; inferred mask.',rasterSha256:hash(JSON.stringify(assets[id]))});
}
for(const s of evidence.screens) {
 const pixels=expandScreen(member(s.member)); if(hash(pixels)!==s.sha256) throw Error('Screen hash');
 add(basename(s.member,'.CRX'),pixels,320,200,s,s.member);
}
// Select useful poses, not every archived frame. Cadence/placement are browser choices.
const selected = s => {
 const family=basename(s.member,'.GSO');
 if(family==='OUTSIDE') return !/^cursor_[234]$/.test(s.name);
 if(['FINGER','PRACTICE'].includes(family)) return true;
 if(family==='GREET') return s.name.startsWith('greettxt_');
 if(family==='CASTLE') return ['rockface_1','brick1_cblock'].includes(s.name);
 if(family==='WALKING') return /^[mlp](run000[146]|jmp00(08|12|16)|sin000[13])_1$/.test(s.name);
 if(family==='WATER') return /^[mlp]swm000[135]_1$/.test(s.name)||/^(bite000[135]|octo000[159])_1$/.test(s.name);
 if(family==='FONT7H') return Number(s.name.split('_')[1])>=33 && Number(s.name.split('_')[1])<=126;
 return false;
};
for(const s of evidence.sprites.filter(selected)) {
 const b=member(s.member), [,,width,height]=s.header_words, pixels=b.subarray(s.offset+8,s.offset+8+width*height);
 if(s.end!==s.offset+10+width*height || b.readUInt16LE(s.end-2)!==([...pixels].reduce((a,v)=>a+v,0)&65535)) throw Error('Sprite checksum');
 const index=member(s.index_member).toString('ascii').split(/\r?\n/).find(line=>line.startsWith(s.name+':'));
 if(Number(index?.split(':')[1])!==s.offset) throw Error('Sprite index');
 let palette=s.palette_member;
 if(s.member.endsWith('/CASTLE.GSO')) palette='MarioTea/MARIO/CPALLET.GPO';
 if(s.member.endsWith('/OUTSIDE.GSO') && s.name.startsWith('turt')) palette='MarioTea/MARIO/TURTLE.GPO';
 if(s.name.startsWith('bite')) palette='MarioTea/MARIO/BITER.GPO';
 if(/^[mlp](run|jmp|sin|swm)/.test(s.name)) palette=`MarioTea/MARIO/${{m:'M',l:'L',p:'P'}[s.name[0]]}PALLET.GPO`;
 add(`${basename(s.member,'.GSO')}-${s.name}`,pixels,width,height,s,palette,0);
}
const destination=resolve('src/assets/original'); mkdirSync(destination,{recursive:true});
writeFileSync(resolve(destination,'rasters.json'),JSON.stringify(assets));
writeFileSync(resolve(destination,'provenance.json'),JSON.stringify({archiveSha256:evidence.archive_sha256,rights:'Public redistribution rights unverified.',method:'Repository-authored data conversion. All source PNG RGB pixels compared before palette/mask adaptation. No archive code executed.',paletteLimit:'Character GPO bindings and index-zero transparency are inferred. FONT7H index 1 white and index 2 black are screenshot-informed browser colors, not a proved DOS runtime palette.',review:'20 source backgrounds and selected sprite contact sheets inspected. All 20 browser background canvases matched decoded PNG RGBA pixels in Chrome 157.0.8103.50. Welcome and all four activities/three characters visually inspected in a browser contact sheet. Full integrated screen/DOM, narrow-layout, motion and production comparison remain Phase 6.',adaptations:['640x400 activity canvas uses integer 2x native backgrounds; scene placement and cadence are browser choices.','Luigi/Princess action sprites recovered; no separate practice-face sets found, so existing browser portrait adaptations remain.','Mario practice expression inset at native (142,21) matches the happy background RGB pixels exactly.','FONT7H index 1 is white for the glyph core and index 2 black for its outline, matching screenshot appearance; the DOS runtime palette remains unverified.','Index-zero sprite transparency and named GPO bindings are inferred, not proved runtime bindings.','Castle masonry tiles use a recovered block; sand masking and stationary pipe remain minimal browser adaptations.','OCASTLE/ENDF availability does not establish original invocation or graduation triggers.'],records},null,2)+'\n');
console.log(JSON.stringify({screens:20,sprites:records.length-20,sourcePixelComparisons:records.length}));
