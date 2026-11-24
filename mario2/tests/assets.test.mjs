import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync,inflateSync} from 'node:zlib';
import {existsSync,readFileSync} from 'node:fs';
import {loadAssets} from '../assets.js';

test('loads exact indices and palette, resolving all URLs at the manifest prefix', async () => {
  const original=globalThis.fetch, requested=[];
  const ids=[485,613,103,619,104,105,106,107,108,119,123,112,599,600,601,608,609,610,
    ...Array.from({length:12},(_,i)=>152+i)];
  const palette=Array.from({length:256},(_,i)=>[i,255-i,7]);
  const manifest={schema:'mario2-assets.v1',font:{url:'font.bin'},assets:Object.fromEntries(ids.map(id=>
    [`ne-2-${id}`,{files:{'pixels.zlib':`decoded/${id}.zlib`},data:{image:{width:2,height:1,palette}}}]))};
  globalThis.fetch=async url => {
    requested.push(String(url));
    const path=new URL(url).pathname;
    if (path.endsWith('assets.json')) return Response.json(manifest);
    if (path.endsWith('font.bin')) return new Response(new Uint8Array(1024));
    if (path.endsWith('presentation.json')) return Response.json({schema:'mario2-presentation.v1'});
    return new Response(deflateSync(Uint8Array.of(77,245)));
  };
  try {
    const assets=await loadAssets('https://example.test/project/assets.json');
    assert.equal(assets.bitmaps.size,30);
    assert.deepEqual([...assets.bitmaps.get(103).pixels],[77,245]);
    assert.deepEqual([...assets.bitmaps.get(152).palette],palette.flat());
    assert.ok(requested.every(url=>url.startsWith('https://example.test/project/')));
    delete manifest.assets['ne-2-103'];
    await assert.rejects(loadAssets('https://example.test/project/assets.json'),/Missing bitmap 103/);
    globalThis.fetch=async ()=>new Response('missing',{status:404});
    await assert.rejects(loadAssets('https://example.test/project/assets.json'),/404/);
  } finally {globalThis.fetch=original;}
});


test('loads every built indexed bitmap and the original embedded font without substitution',
  {skip:!existsSync(new URL('../dist/presentation.json',import.meta.url))},async()=>{
  const base=new URL('../dist/',import.meta.url),original=globalThis.fetch;
  globalThis.fetch=async url=>new Response(readFileSync(new URL(new URL(url).pathname.replace('/project/',''),base)));
  try {
    const assets=await loadAssets('https://example.test/project/assets.json');
    assert.deepEqual(assets.font,new Uint8Array(readFileSync(new URL('font.bin',base))));
    for (const [id,bitmap] of assets.bitmaps) {
      const entry=assets.manifest.assets[`ne-2-${id}`];
      assert.deepEqual(bitmap.pixels,new Uint8Array(inflateSync(readFileSync(new URL(entry.files['pixels.zlib'],base)))));
      assert.deepEqual([...bitmap.palette],entry.data.image.palette.flat());
    }
  } finally {globalThis.fetch=original;}
});
