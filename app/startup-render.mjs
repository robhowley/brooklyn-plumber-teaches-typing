// Indexed startup rendering only. No DOM, clock, lesson renderer or old app.
import { updateSprite } from '../recovered/render/render.mjs';

// FILE 0x10018..0x10174. Each new raster samples its predecessor, skipping
// AFTER output columns/rows divisible by 7 (including zero), not nearest scaling.
export function startupZoomFrames(small) {
  const frames=[small];
  for(let i=1;i<20;i++) {
    const source=frames[i-1],w=Math.trunc(source.sprite.width*7/8),h=Math.trunc(source.sprite.height*7/8);
    if(w<0||h<0||source.pixels.length!==source.sprite.width*source.sprite.height)
      throw new RangeError('Startup zoom source dimensions');
    const pixels=new Uint8Array(w*h);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++)
      pixels[y*w+x]=source.pixels[(y+Math.ceil(y/7))*source.sprite.width+x+Math.ceil(x/7)];
    frames.push({sprite:{headerWords:[0,0,w,h],width:w,height:h},pixels});
  }
  return frames;
}

// FILE 0x14bc4..0x14d02: write source, then j=0..steps-1, then exact target.
// Signed division truncates toward zero, so falling channels must not floor.
export function startupFade(from,to,steps=12) {
  if(from.length!==768||to.length!==768||!Number.isInteger(steps)||steps<1||steps>32767)
    throw new RangeError('Startup palette fade');
  const result=[Uint8Array.from(from)];
  for(let j=0;j<steps;j++) result.push(Uint8Array.from(from,(v,i)=>(v+Math.trunc(((to[i]-v)*j)/steps))&255));
  result.push(Uint8Array.from(to));return result;
}

// Inputs come from assets/startup/manifest.json, hydrated by the host into
// scenes[name]={pixels,palette}, sprites[family]={name:{sprite,pixels}}.
// Rendering returns palette writes so even unpaced fades retain source order.
export function createStartupRenderer({front,background,scenes,sprites,letters,letterX}) {
  if(front.length!==64000||background.length!==64000||front.buffer===background.buffer)
    throw new RangeError('Distinct startup rasters required');
  if(letters?.length!==13||letterX?.length!==13) throw new RangeError('Original letter bindings required');
  const small=sprites.GREET?.smario_1;
  if(!small) throw new Error('Missing GREET resource smario_1');
  const zoom=startupZoomFrames(small);
  let previous=null;
  const palettes={black:new Uint8Array(768),purple:Uint8Array.from({length:768},(_,i)=>[29,0,45][i%3])};
  for(const [name,scene] of Object.entries(scenes)) {
    if(scene.pixels.length!==64000||scene.palette.length!==768) throw new RangeError('Startup scene dimensions');
    palettes[name]=scene.palette;
  }
  function palette(name) {if(!palettes[name]) throw new Error(`Missing startup palette ${name}`);return palettes[name];}
  return {apply(event) {
    if(event.type==='scene') {
      const scene=scenes[event.name];if(!scene) throw new Error(`Missing startup scene ${event.name}`);
      front.set(scene.pixels);background.set(scene.pixels);previous=null;
    } else if(event.type==='palette') return [Uint8Array.from(palette(event.name))];
    else if(event.type==='fade') return startupFade(palette(event.from),palette(event.to),event.steps);
    else if(event.type==='sprite'||event.type==='letter') {
      const letter=event.type==='letter';
      const record=letter?sprites.GREET?.[`greettxt_${letters[event.index]}`]
        :event.family==='zoom'?zoom[event.name]:sprites[event.family]?.[event.name];
      if(!record) throw new Error('Missing startup sprite binding');
      // Original generated miniature19 has height0. Its compositor call has no
      // visible rectangle; do not invent a minimum one-pixel image.
      if(record.sprite.width===0||record.sprite.height===0) {previous=null;return [];}
      const x=letter?letterX[event.index]:event.x-(event.center?Math.trunc(record.sprite.width/2):0);
      const y=letter?7:event.y-(event.center?Math.trunc(record.sprite.height/2):0);
      const current={...record,x,y};
      // Letters and eyes are separate source calls with null previous pointers.
      updateSprite(front,background,current,event.family==='zoom'||event.name==='lmario_1'?previous:null);
      if(event.family==='zoom') previous=current;
      if(event.name==='lmario_1') {
        // 0x10303..0x10320 remembers scaled frame6 and its computed center,
        // NOT the lmario raster/coordinates actually drawn on iteration6.
        previous={...zoom[6],x:76-Math.trunc(zoom[6].sprite.width/2),
          y:34-Math.trunc(zoom[6].sprite.height/2)};
      }
    } else throw new Error(`Not a drawing event: ${event.type}, route to the host/controller`);
    return [];
  }};
}
