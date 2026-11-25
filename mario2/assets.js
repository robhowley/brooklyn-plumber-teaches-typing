// Indexed runtime assets only. URLs are relative to the manifest, including at a project prefix.
export async function loadAssets(manifestURL) {
  const base = new URL(manifestURL, globalThis.location?.href);
  async function get(url) {
    const response = await fetch(new URL(url, base));
    if (!response.ok) throw new Error(`Asset load failed: ${response.status} ${response.url}`);
    return response;
  }
  const manifest = await (await get(base)).json();
  if (manifest.schema !== 'mario2-assets.v1') throw new Error('Invalid assets schema');
  const font = new Uint8Array(await (await get(manifest.font.url)).arrayBuffer());
  if (font.length !== 1024) throw new Error('Invalid embedded font');
  const presentation = await (await get(manifest.presentation?.url ?? 'presentation.json')).json();
  if (presentation.schema !== 'mario2-presentation.v1') throw new Error('Invalid presentation schema');
  const bitmaps = new Map();
  const required = [...new Set([485,613,103,619,104,105,106,107,108,119,123,112,599,600,601,608,609,610,
    ...Array.from({length:12},(_,i)=>152+i),
    ...(presentation.outsideSprites?[120,616,620,...Object.values(presentation.outsideSprites).flat()]:[]),
    ...Object.keys(manifest.assets).filter(key=>key.startsWith('ne-2-')).map(key=>Number(key.slice(5)))])];
  await Promise.all(required.map(async id => {
    const entry = manifest.assets[`ne-2-${id}`];
    if (!entry?.files?.['pixels.zlib']) throw new Error(`Missing bitmap ${id}`);
    const {width, height, palette} = entry.data.image;
    const response = await get(entry.files['pixels.zlib']);
    const stream = response.body.pipeThrough(new DecompressionStream('deflate'));
    const pixels = new Uint8Array(await new Response(stream).arrayBuffer());
    if (pixels.length !== width*height || palette.length !== 256) throw new Error(`Invalid bitmap ${id}`);
    bitmaps.set(id, {width, height, pixels, palette:Uint8Array.from(palette.flat())});
  }));
  const outsideAnimations=new Map();
  await Promise.all(Object.entries(manifest.assets).filter(([key])=>key.startsWith('ne-FULLSCREENANIM-')).map(async ([key,entry])=>{
    const response=await get(entry.files['planes.zlib']);
    const planes=new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
    const frames=entry.data.frames.map(frame=>{
      if(frame.offset+frame.size>planes.length) throw new Error('Invalid Outside animation plane');
      return {...frame,pixels:planes.slice(frame.offset,frame.offset+frame.size)};
    });
    outsideAnimations.set(key.slice('ne-FULLSCREENANIM-'.length),frames);
  }));
  if(presentation.outsideAnimation) for(const c of 'MPL') for(const ext of ['ANI','BAN']) {
    if(!outsideAnimations.get(c+'OUT.'+ext)?.length) throw new Error('Missing Outside animation '+c+'OUT.'+ext);
  }
  return {manifest, font, bitmaps, presentation, outsideAnimations};
}
