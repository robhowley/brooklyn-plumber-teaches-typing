import { blitSprite, drawGround, characterFrame, updateSprite, spriteRect, clipRect } from '../recovered/render/render.mjs';
const bytes = text => Uint8Array.from(atob(text), c=>c.charCodeAt(0));
// Indexed full-scene redraw is a host adaptation; origins, masks, tile, palette
// ranges and resource selection use recovered APIs. No PNG palette guessing.
export class Renderer {
  constructor(canvas,data) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.data=data;
    this.front=new Uint8Array(64000); this.pixels={}; this.backgrounds={}; this.animations={};
    this.image=this.ctx.createImageData(320,200);
  }
  async load() {
    for(const [name,s] of Object.entries(this.data.sprites)) {
      const pixels=bytes(s.pixels);
      if(pixels.length!==s.width*s.height) throw new Error(`Invalid sprite: ${name}`);
      this.pixels[name]=pixels;
    }
    for(const [name,s] of Object.entries(this.data.backgrounds)) {
      this.backgrounds[name]=bytes(s.pixels);
      if(this.backgrounds[name].length!==64000) throw new Error(`Invalid background: ${name}`);
    }
    this.ground=bytes(this.data.ground);
    await Promise.all(Object.entries(this.data.bonusAnimations).map(async([char,a])=>{
      const response=await fetch('./'+a.backgroundsPath);
      if(!response.ok) throw new Error(`Missing bonus frames: ${a.backgroundsPath}`);
      const backgrounds=new Uint8Array(await response.arrayBuffer());
      if(backgrounds.length!==64000*a.frames.length) throw new Error(`Invalid bonus frames: ${char}`);
      this.animations[char]={backgrounds,frames:a.frames.map(f=>({...f,pixels:bytes(f.sprite.pixels)}))};
    }));
  }
  background(name,palette=name+'.CRX') {
    if(!this.backgrounds[name]) throw new Error(`Missing background: ${name}`);
    this.front.set(this.backgrounds[name]); this.palette=palette;
  }
  present() {
    const pal=this.data.palettes[this.palette];
    if(!pal || pal.length!==768) throw new Error(`Missing palette: ${this.palette}`);
    for(let i=0;i<64000;i++) {
      const p=this.front[i]*3;
      this.image.data.set([pal[p],pal[p+1],pal[p+2],255],i*4);
    }
    this.ctx.putImageData(this.image,0,0);
  }
  sprite(name,x,y) {
    const sprite=this.data.sprites[name], pixels=this.pixels[name];
    if(!sprite||!pixels) throw new Error(`Missing sprite: ${name}`);
    blitSprite(this.front,sprite,pixels,x,y);
  }
  text(value,x,y,{font='FONT5H',color=15,shadow=31,advance=8}={}) {
    const family=font==='FONT7H'?'font7':'font5';
    [...String(value)].forEach((ch,i)=>{
      const code=ch.charCodeAt(0);
      // Control bytes remain in the practice cursor. They have no decoded glyph;
      // do not replace the corpus or silently insert a '?' target.
      if(code<32||code>127)return;
      const name=`${font}/${family}_${code}`, sprite=this.data.sprites[name], raw=this.pixels[name];
      if(!sprite||!raw) throw new Error(`Missing font glyph: ${name}`);
      // Font recoloring is separate from sprite zero transparency: a nonzero
      // glyph pixel can map to visible black (palette index 0).
      const rect=spriteRect(sprite,x+i*advance,y), visible=clipRect(rect);
      if(!visible)return;
      for(let py=visible.top;py<=visible.bottom;py++)for(let px=visible.left;px<=visible.right;px++){
        const value=raw[(py-rect.top)*sprite.width+px-rect.left];
        if(value) this.front[py*320+px]=value===1?color:shadow;
      }
    });
  }
  menu(profile) {
    this.background('MAINMENU'); this.front.fill(14,0,320*8);
    for(const [id,x] of [[1100,16],[1110,104],[1120,224]]) this.text(this.data.messages[id],x,0,{color:0,shadow:0});
    // Welcome palette slot mapping still untraced, visibly isolated host choice.
    if(profile.profilePresent) {
      this.text(this.data.messages[1150],144,34,{color:12,shadow:55});
      this.text(profile.name+'!',136+Math.floor((8-profile.name.length)/2)*8,49,{color:12,shadow:55});
    } else for(let i=0;i<5;i++) this.text(this.data.messages[1250+i],136,24+i*10,{color:12,shadow:55});
    this.present();
  }
  setup(profile,duration=false) {
    this.background(duration?'LESSTIME':'PREFS');
    if(duration) {
      this.text(`Outside: ${profile.durations[0]} min`,64,76);
      this.text(`Practice: ${profile.durations[3]} min`,64,110);
    } else {
      this.text(`Student Name: ${profile.name}`,40,80);
      this.text(`Goal WPM: ${profile.goal}`,40,94);
      this.text(`Level: ${this.data.messages[299+profile.lesson]}`,40,108);
    }
    this.present();
  }
  outdoor(s,stats,bonus) {
    const prefix=['m','l','p'][s.character-1];
    this.background('OUTSIDE','outdoor-'+prefix);
    drawGround(this.front,this.ground,s.groundPhase);
    const ox=s.character===3?36:0, oy=s.character===3?30:0;
    const frame=characterFrame(s.character,s.frame.kind,s.frame.index,this.data.idleSchedules[prefix].thresholds);
    this.sprite(frame.family+'/'+frame.name,s.x,s.y);
    for(const o of s.obstacles) if(o.active) {
      const block=o.type===1, x=o.x+(block?ox:o.xOffset), y=o.y+(block?oy:0);
      this.sprite(`OUTSIDE/${block?'brick1_1':o.shell?'turt1_2':'turt1_1'}`,x,y);
      // FILE 0x1413d mapping; DS:4fc0 is FONT7H's glyph field+b (0x12643).
      if(o.code) this.text(String.fromCharCode(o.code),x+(block?6:15),y+3,{font:'FONT7H'});
    }
    for(const p of s.particles) this.sprite('OUTSIDE/expls1_1',p.x,p.y);
    if(s.targetIndex>=0) {
      const o=s.obstacles[s.targetIndex], block=o.type===1;
      this.sprite(`OUTSIDE/cursor_${s.cursorFrame+1}`,o.x+o.xOffset+10+(block?ox:0),o.y-12+(block?oy:0));
    }
    if(bonus?.mode===2) {
      this.sprite('OUTSIDE/brick1_1',bonus.x,bonus.y);
      this.text(String.fromCharCode(bonus.code),bonus.x+6,bonus.y+3,{font:'FONT7H'});
    }
    // HUD layout is host-side until shared text compositor is fully traced.
    this.text(`WPM: ${String(stats.wpm).padStart(3)}`,8,164);
    this.text(`${Math.floor(stats.elapsedSeconds/60)}:${String(stats.elapsedSeconds%60).padStart(2,'0')}`,248,164);
    this.text(`Typed:${String(s.attempts).padStart(3)}`,8,180);
    this.text(`Errors:${String(s.errors).padStart(3)}`,184,180);
    this.present();
  }
  practice(s,stats,expression,typed) {
    this.background('PRACTICE');
    // FILE 0xb365..0xb36d, face logical position (142,21).
    this.sprite(`PRACTICE/prac000${expression+1}_1`,142,21);
    // FILE 0xb2dd..0xb33f: 10 rows, 32 columns at (30,96), stride 10.
    for(let row=1;row<10;row++) {
      const text=Array.from(s.rows.subarray(row*33,row*33+32),c=>String.fromCharCode(c||32)).join('');
      this.text(text,30,96+row*10,{color:0,shadow:0});
    }
    this.text(typed,30,96,{color:1,shadow:1});
    // Host static cursor in place of shared blinking text-entry callback.
    const x=30+8*s.index;
    this.front.fill(1,103*320+x,103*320+Math.min(320,x+8));
    this.text(String(stats.wpm),48,24); this.text(String(s.attempts),48,43);
    this.text(String(s.errors),48,63);
    this.text(`${Math.floor(stats.elapsedSeconds/60)}:${String(stats.elapsedSeconds%60).padStart(2,'0')}`,236,30);
    this.present();
  }
  cinematic(character,index) {
    const char=['m','l','p'][character-1], a=this.animations[char], current=a.frames[index];
    if(!current) throw new Error('Missing bonus animation frame');
    const background=a.backgrounds.subarray(index*64000,(index+1)*64000);
    this.front.set(background); this.palette='OUTSKY.CRX';
    // Every BAN packet modifies background first. Recovered compositor adds ANI
    // signed coordinates and raster origins. Full background copy is host redraw.
    updateSprite(this.front,background,{...current,sprite:current.sprite},null);
    this.present();
  }
  results(result,profile,activity) {
    this.background('BLACKBRD');
    const lines=[profile.name,`WPM: ${result.wpm}`,`Typed: ${activity.attempts}`,`Errors: ${activity.errors}`,`Accuracy: ${result.accuracy}%`,`${Math.floor(result.elapsedSeconds/60)}:${String(result.elapsedSeconds%60).padStart(2,'0')}`];
    lines.forEach((line,i)=>this.text(line,40,38+i*14)); this.present();
  }
}
