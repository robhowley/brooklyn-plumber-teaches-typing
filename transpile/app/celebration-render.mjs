// Indexed presentation only. No clocks, progression, keyboard, audio, or DOM.
import { updateSprite } from '../recovered/render/render.mjs';
import { drawWaterBonusPacket } from './water-render.mjs';

const bytes = encoded => {
  if (typeof encoded!=='string') throw new TypeError('Missing celebration bytes');
  return Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
};

// One transport conversion at the resource boundary. No fallback art or text.
export function hydrateCelebrationResources(raw) {
  const scenes={},actors={},movies={};
  for (const name of ['OCASTLE','WCAS0001','ENDF']) {
    const scene=raw.scenes?.[name];
    const pixels=bytes(scene?.pixels),palettes={};
    if(pixels.length!==64000) throw new RangeError(`${name} scene size`);
    for (const c of 'mlp') {
      palettes[c]=bytes(scene.palettes?.[c]);
      if(palettes[c].length!==768 || palettes[c].some(v=>v>63)) throw new RangeError(`${name} palette`);
    }
    scenes[name]={pixels,palettes};
  }
  for (const family of ['WALKING','WATER','FONT3H','FONT5H']) {
    if (!raw.actors?.[family]?.length) throw new Error(`Missing celebration family ${family}`);
    actors[family]=raw.actors[family].map(record=>{
      const {pixels:encoded,...sprite}=record;
      const pixels=bytes(encoded);
      if(pixels.length!==sprite.width*sprite.height || sprite.headerWords?.[2]!==sprite.width || sprite.headerWords?.[3]!==sprite.height)
        throw new RangeError(`${family} raster size`);
      return {sprite,pixels};
    });
  }
  for (const name of ['FIR1','FIR2','WCAS','ENDF']) {
    if(!raw.movies?.[name]?.frames?.length) throw new Error(`Missing celebration movie ${name}`);
    movies[name]={frames:raw.movies[name].frames.map(frame=>({
      writes:frame.writes.map(w=>{
        const pixels=bytes(w.pixels);
        if(!Number.isInteger(w.offset) || w.offset<0 || w.offset+pixels.length>64000) throw new RangeError('Celebration BAN write');
        return {offset:w.offset,pixels};
      })
    }))};
  }
  for(const font of ['FONT3H','FONT5H']) {
    const metrics=raw.fonts?.[font];
    if(!metrics || metrics.first!==32 || metrics.count!==96 || metrics.width!==8 ||
      metrics.height!==(font==='FONT3H'?10:8)) throw new Error(`Missing celebration font metrics ${font}`);
  }
  if(!raw.messages) throw new Error('Missing celebration messages');
  return {scenes,actors,movies,fonts:raw.fonts,messages:raw.messages};
}

// 0x14bb4..0x14d0a: initial palette, i=0..steps-1, exact final palette.
// Callers here pass wait=0. There is NO recovered frame/timer wait in this fade.
export function celebrationFade(from,to,steps=12) {
  if(from.length!==768 || to.length!==768 || !Number.isInteger(steps) || steps<1) throw new RangeError('celebration fade');
  const palettes=[Uint8Array.from(from)];
  for(let i=0;i<steps;i++) palettes.push(Uint8Array.from(from,(v,n)=>v+Math.trunc((to[n]-v)*i/steps)));
  palettes.push(Uint8Array.from(to));
  return palettes;
}

export class CelebrationRenderer {
  constructor(resources,character,{front=new Uint8Array(64000),background=new Uint8Array(64000),
    palette=new Uint8Array(768),clip={left:0,top:0,right:319,bottom:199},textState={}}={}) {
    if(![1,2,3].includes(character) || front.length!==64000 || background.length!==64000 || front===background || palette.length!==768)
      throw new RangeError('celebration renderer buffers/character');
    this.resources=resources; this.character=character; this.front=front; this.background=background;
    this.palette=palette; this.clip={...clip}; this.textState=textState; this.previous=null;
  }
  actor(a) {
    if(!a) return null;
    const frame=this.resources.actors[a.family]?.[a.index];
    if(!frame) throw new Error(`Missing celebration actor ${a.family}:${a.index}`);
    return {...frame,x:a.x,y:a.y};
  }
  message(e) {
    const record=this.resources.messages[e.id];
    if(!record) throw new Error(`Missing celebration message ${e.id}`);
    let text=record.text;
    if(e.lesson!=null) {
      // 0xeece adds 299 to lesson before the message lookup.
      const lesson=this.resources.messages[(e.lesson+299)&65535];
      if(!lesson) throw new Error(`Missing celebration lesson ${e.lesson}`);
      text=text.replace('%s',lesson.text);
    }
    for(const value of e.args??[]) text=text.replace('%u',String(value&65535));
    const glyphs=this.resources.actors[this.textState.font];
    if(!glyphs?.length) throw new Error(`Missing celebration font ${this.textState.font}`);
    const {width,height}=this.resources.fonts[this.textState.font];
    let x=(e.column-1)*width, y=(e.row-1)*height;
    for(const ch of text) {
      const code=ch.charCodeAt(0),glyph=glyphs[code-32];
      if(!glyph) throw new Error(`Missing celebration glyph ${code}`);
      for(let gy=0;gy<glyph.sprite.height;gy++) for(let gx=0;gx<glyph.sprite.width;gx++) {
        const px=x+gx,py=y+gy,value=glyph.pixels[gy*glyph.sprite.width+gx];
        if(value>2) throw new RangeError('celebration glyph mapping');
        if(value && px>=0 && px<320 && py>=0 && py<200) this.front[py*320+px]=value===1?15:0;
      }
      x+=glyph.sprite.width;
    }
  }
  apply(effects) {
    const paletteWrites=[];
    for(const e of effects) {
      if(e.type==='palette-black') {this.palette.fill(0);paletteWrites.push(this.palette.slice());}
      else if(e.type==='scene') {
        const scene=this.resources.scenes[e.name];
        if(!scene) throw new Error(`Missing celebration scene ${e.name}`);
        this.front.set(scene.pixels);this.background.set(scene.pixels);this.previous=null;
      } else if(e.type==='palette-scene') {
        this.palette.set(this.resources.scenes[e.name].palettes['mlp'[this.character-1]]);paletteWrites.push(this.palette.slice());
      } else if(e.type==='palette-fade') {
        const scene=this.resources.scenes[e.name].palettes['mlp'[this.character-1]],black=new Uint8Array(768);
        const writes=celebrationFade(e.from==='black'?black:scene,e.to==='black'?black:scene,e.steps);
        paletteWrites.push(...writes);this.palette.set(writes.at(-1));
      } else if(e.type==='text-save') {
        this.savedText={...this.textState};
        this.textState={font:e.font,foreground:15,shadow:0,opaque:false};
      } else if(e.type==='text-restore') {this.textState=this.savedText;this.savedText=null;}
      else if(e.type==='text') this.message(e);
      else if(e.type==='clip') this.clip={...e.clip};
      else if(e.type==='actor') {
        const current=this.actor(e),previous=this.actor(e.previous);
        updateSprite(this.front,this.background,current,previous,this.clip);this.previous=current;
      } else if(e.type==='actor-remove') {
        updateSprite(this.front,this.background,null,this.previous,this.clip);this.previous=null;
      } else if(e.type==='movie-packet') {
        const frame=this.resources.movies[e.name]?.frames[e.frame];
        if(!frame) throw new Error(`Missing celebration packet ${e.name}:${e.frame}`);
        // No ANI argument at any of these source callers. Reuse exact BAN writes.
        drawWaterBonusPacket(this.front,this.background,frame.writes,null,null,this.clip);
      } else if(e.type==='clear-high-bit') {
        for(let i=0;i<64000;i++) this.front[i]&=127;
      } else if(e.type==='clear-screen') {
        this.front.fill(e.color);
        this.textState={...this.textState,column:1,row:1,background:e.color};
      }
    }
    return paletteWrites;
  }
}
