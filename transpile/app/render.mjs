import { CASTLE_CLIPS, drawCastleText, beginCastleTransition, stepCastleTransition,
  finishCastleTransition, drawCastleBonusActor, castleBonusBlock, beginCastleBonus,
  finishCastleBonus, drawCastleBonusPacket } from './castle-render.mjs';
import { blitSprite, drawGround, characterFrame, updateSprite, spriteRect, clipRect, drawCastleScene } from '../recovered/render/render.mjs';
import { waterActorOperations, drawWaterOperations, drawWaterText, waterBonusSprite, drawWaterBonusPacket } from './water-render.mjs';
import { drawMenuWidgets, drawStudentChooserNames, drawTextField } from './menu-render.mjs';
import { drawReport, drawSourceText } from './report-render.mjs';
import { drawHelp, drawKeyboard, drawAbout } from './help-render.mjs';
import { drawNumericHUD, drawStats } from './stats-render.mjs';
import { studentFieldPlacement } from '../recovered/control/menu.mjs';
import { readStudent } from '../recovered/control/student.mjs';
import { sourceFormat } from '../recovered/control/report.mjs';
const bytes = text => Uint8Array.from(atob(text), c=>c.charCodeAt(0));
// Indexed full-scene redraw is a host adaptation; origins, masks, tile, palette
// ranges and resource selection use recovered APIs. No PNG palette guessing.
export class Renderer {
  constructor(canvas,data) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.data=data;
    this.front=new Uint8Array(64000); this.pixels={}; this.backgrounds={}; this.animations={};
    this.image=this.ctx.createImageData(320,200);
    this.waveCounter=-1; // DS:0302 / FILE0x1f572 initial FFFF; retained across entries.
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
    const records=family=>Object.entries(this.data.sprites).filter(([,s])=>s.family===family)
      .sort((a,b)=>a[1].index-b[1].index).map(([name,sprite])=>({sprite,pixels:this.pixels[name]}));
    this.waterResources={water:records('WATER'),bubbles:records('WATER_INLINE')};
    this.font9=records('FONT9H'); this.font7=records('FONT7H');
    this.fonts={FONT3H:records('FONT3H'),FONT5H:records('FONT5H')};
    for(const [name,font] of Object.entries(this.fonts)) if(font.length!==96) throw new Error(`Missing decoded font ${name}`);
    if(!this.data.control?.help || !this.data.control?.teachers) throw new Error('Missing control resources, rebuild app data');
    this.castleScenes=this.data.castle.scenes.map(bytes);
    this.castleAnimations=Object.fromEntries(Object.entries(this.data.castle.animations).map(([char,a])=>[char,a.frames.map(f=>({
      writes:f.writes.map(w=>({offset:w.offset,pixels:bytes(w.pixels)})),
      current:{x:f.ani.x,y:f.ani.y,sprite:f.ani,pixels:bytes(f.ani.pixels)}
    }))]));
    this.waves=this.data.water.waves.map(bytes);
    this.waterAnimations=Object.fromEntries(Object.entries(this.data.water.animations).map(([char,a])=>[char,a.frames.map(f=>({
      writes:f.writes.map(w=>({offset:w.offset,pixels:bytes(w.pixels)})),
      current:{x:f.ani.x,y:f.ani.y,sprite:f.ani,pixels:bytes(f.ani.pixels)}
    }))]));
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
  resources(name) {
    if(!this.backgrounds[name] || !this.data.palettes[name+'.CRX']) throw new Error(`Missing control screen ${name}`);
    return {background:this.backgrounds[name],palette:this.data.palettes[name+'.CRX'],fonts:this.fonts,
      messages:this.data.messages,...this.data.control};
  }
  modal(state,student) {
    const names={report:'RCARD',help:'HELP',keyboard:'KEYBOARD',about:'GREETBG'};
    const name=names[state.kind], resources=this.resources(name);
    const result=state.kind==='report'?drawReport(this.front,resources,student):state.kind==='help'?drawHelp(this.front,resources,state):state.kind==='keyboard'?drawKeyboard(this.front,resources):drawAbout(this.front,resources);
    if(!result) throw new Error('Report requires a student');
    this.palette=name+'.CRX';this.operations=result.operations??[];this.present();
  }
  studentUI(state,inverted=false) {
    const p=readStudent(state.bytes), m=this.data.messages;
    this.background(state.kind==='times'?'LESSTIME':'PREFS');
    const ops=[], add=(text,x,y,font='FONT3H',color=15)=>ops.push({text,x,y,font,color,shadow:0,background:0,opaque:false});
    if(state.kind==='new') add(m[2200],56,110);
    else if(state.kind==='times') {
      // 0x8d97..0x8e54, resource labels and physical field origins.
      p.durations.forEach((n,i)=>{add(sourceFormat('%s:',m[100+i]),66,70+i*20,'FONT5H',0);add(sourceFormat('%2u',n),190,70+i*20,'FONT5H',1);add(m[5000],206,70+i*20,'FONT5H',0);});
    } else {
      add(sourceFormat(m[2210],p.name),64,70); add(sourceFormat(m[2220],p.goal),64,90);
      add(sourceFormat(m[2230],m[199+p.mode]),64,100); add(sourceFormat(m[2400],m[299+p.lesson]),64,110);
      // 0xf08c..0xf0c6, GREET2/prefbox_1 at table x, y130.
      this.sprite('GREET2/prefbox_1',this.data.control.menu.prefBoxXs[p.character-1],130);
    }
    drawSourceText(this.front,this.fonts,ops,this.backgrounds[state.kind==='times'?'LESSTIME':'PREFS']);
    if(state.field) {const placement=studentFieldPlacement(state);drawTextField(this.front,this.fonts[placement.font],state.field,{...placement,inverted});}
    this.operations=ops;this.present();
  }
  chooser(state) {this.background('LOAD');drawStudentChooserNames(this.front,this.fonts.FONT5H,state);this.present();}
  menu(profile,state) {
    this.background('MAINMENU'); this.front.fill(14,0,320*8);
    for(const [id,x] of [[1100,16],[1110,104],[1120,224]]) this.text(this.data.messages[id],x,0,{color:0,shadow:0});
    // Welcome palette slot mapping still untraced, visibly isolated host choice.
    if(profile.profilePresent) {
      this.text(this.data.messages[1150],144,34,{color:12,shadow:55});
      this.text(profile.name+'!',136+Math.floor((8-profile.name.length)/2)*8,49,{color:12,shadow:55});
    } else for(let i=0;i<5;i++) this.text(this.data.messages[1250+i],136,24+i*10,{color:12,shadow:55});
    if(state) drawMenuWidgets(this.front,this.fonts.FONT5H,this.data.messages,state,profile.lesson);
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
    this.operations=drawNumericHUD(this.front,this.fonts,1,{...s,...stats},this.data.messages);
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
    this.operations=drawNumericHUD(this.front,this.fonts,4,{...s,...stats},this.data.messages);
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
  water(effects,state) {
    const scene=this.backgrounds.WATER;
    for(const e of effects) {
      if(e.type==='scene') {
        this.background('WATER','water-'+['m','l','p'][e.character]);
        this.waterDraw={character:e.character+1};
        this.waterResources.bonus=waterBonusSprite(this.waterResources.water[33],this.font7[state.bonus.code-32]);
      } else if(e.type==='background-update') {
        // 0x9cab..0x9d3f: twenty16x14 tiles at y65, zero restores scene.
        this.waveCounter=(this.waveCounter+1)%50;
        for(let tile=0;tile<20;tile++) {
          const raster=this.waves[(Math.floor(this.waveCounter/2)+tile)%25];
          for(let y=0;y<14;y++) for(let x=0;x<16;x++) {
            const dest=(65+y)*320+tile*16+x;
            this.front[dest]=raster[y*16+x]||scene[dest];
          }
        }
      } else if(e.type==='stats') this.operations=drawNumericHUD(this.front,this.fonts,2,e,this.data.messages);
      else if(e.type==='text') drawWaterText(this.front,scene,this.font9,e.bytes,e.targetIndex);
      else if(['swimmer','pursuer','bubbles','bonus','bonus-erase'].includes(e.type)) {
        const actor=e.type==='bonus-erase'?'bonus':e.type;
        const before={character:this.waterDraw.character,[actor]:actor==='bubbles'?e.previous:this.waterDraw[actor]};
        const current=actor==='bubbles'?e.bubbles:e.type==='bonus-erase'?{...this.waterDraw.bonus,mode:3}:e;
        const after={character:this.waterDraw.character,[actor]:current};
        const operations=waterActorOperations(this.waterResources,after,before)
          .filter(op=>actor==='bubbles'?op.actor.startsWith('bubble-'):op.actor===actor);
        drawWaterOperations(this.front,scene,operations);
        this.waterDraw[actor]=current;
      } else if(e.type==='play-bonus') {
        this.front.set(scene); this.movieBackground=scene.slice(); this.moviePrevious=null;
      } else if(e.type==='water-packet') {
        const packet=this.waterAnimations[['m','l','p'][state.character]][e.frame];
        this.moviePrevious=drawWaterBonusPacket(this.front,this.movieBackground,packet.writes,packet.current,this.moviePrevious);
      } else if(e.type==='restore-scene') this.front.set(scene);
      else if(e.type==='restore-palette') this.palette='water-'+['m','l','p'][state.character];
      // Audio/fades and optional Phase5 presentation are explicitly disabled.
    }
    this.present();
  }
  castleActor(frame,x,y) {
    const entry=Object.entries(this.data.sprites).find(([,s])=>s.family===frame.family&&s.index===frame.index);
    if(!entry) throw new Error(`Missing Castle actor ${frame.family}/${frame.index}`);
    const [name,sprite]=entry; return {sprite,pixels:this.pixels[name],x,y};
  }
  castle(effects,state) {
    const rect=a=>({left:a[0],top:a[1],right:a[2],bottom:a[3]});
    for(const e of effects) {
      if(e.type==='scene') {
        this.castleBackground=this.backgrounds.CASTLE.slice();
        drawCastleScene(this.castleBackground,this.castleScenes[e.scene]);
        this.front.set(this.castleBackground); this.castleClip=CASTLE_CLIPS.full;
        this.castleBonus=null; this.palette='castle-'+['m','l','p'][state.character-1];
        this.castleBlock=castleBonusBlock(this.castleActor({family:'CASTLE',index:14},0,0),this.font7[state.bonus.code-32]);
      } else if(e.type==='statistics'&&e.operation===200) this.operations=drawNumericHUD(this.front,this.fonts,3,e.stats,this.data.messages);
      else if(e.type==='clip') this.castleClip=rect(e.rect);
      else if(e.type==='clip-save-full') this.castleClip=CASTLE_CLIPS.full;
      else if(e.type==='clip-restore') this.castleClip=rect(e.rect);
      else if(e.type==='rockface-init'||e.type==='rockface') {
        const rock=r=>this.castleActor({family:'CASTLE',index:r.resourceIndex},r.x,r.y);
        updateSprite(this.front,this.castleBackground,rock(e.current),e.previous?rock(e.previous):null,this.castleClip);
      } else if(e.type==='player') {
        const current=this.castleActor(e.frame,e.x,e.y), previous=this.castleActor(e.oldFrame,e.oldX,e.oldY);
        if(e.special) stepCastleTransition(this.front,this.castleBackground,this.castleTransition,current,previous,rect(e.clip));
        else updateSprite(this.front,this.castleBackground,current,previous,rect(e.clip));
      } else if(e.type==='player-erase') updateSprite(this.front,this.castleBackground,null,this.castleActor(e.frame,e.x,e.y),this.castleClip);
      else if(e.type==='scroll-begin') this.castleTransition=beginCastleTransition(this.castleBackground,this.castleScenes[e.scene],e.y);
      else if(e.type==='scroll-end') finishCastleTransition(this.front,this.castleBackground,this.castleTransition);
      else if(e.type==='text') drawCastleText(this.front,this.castleBackground,e.words,this.font9.map(g=>g.pixels));
      else if(e.type==='text-clear') this.front.set(this.castleBackground.subarray(0,26*320));
      else if(e.type==='pipe-draw'||e.type==='pipe-erase') {
        const actor=this.castleActor(e,e.x,e.y);
        updateSprite(this.front,this.castleBackground,e.type==='pipe-draw'?actor:null,e.type==='pipe-erase'?actor:null,this.castleClip);
      } else if(e.type==='bonus-actor') {
        const current={...this.castleBlock,x:e.x,y:e.y},previous={...this.castleBlock,x:e.oldX,y:e.oldY};
        drawCastleBonusActor(this.front,this.castleBackground,current,previous,state.sceneType,this.castleClip);
        this.castleBonus=current;
      } else if(e.type==='bonus-erase') {
        if(this.castleBonus) drawCastleBonusActor(this.front,this.castleBackground,null,this.castleBonus,state.sceneType,this.castleClip);
        this.castleBonus=null;
      } else if(e.type==='bonus-playback') {
        beginCastleBonus(this.front,this.castleBackground,state.sceneType,this.castleScenes[0]);
        this.castleMoviePrevious=null;
      } else if(e.type==='castle-packet') {
        const packet=this.castleAnimations[['m','l','p'][state.character-1]][e.frame];
        drawCastleBonusPacket(this.front,this.castleBackground,packet.writes,packet.current,this.castleMoviePrevious);
        this.castleMoviePrevious=packet.current;
      } else if(e.type==='bonus-restore') {
        finishCastleBonus(this.front,this.castleBackground,state.sceneType,this.castleScenes[2]);
        this.castleBonus=null; this.palette='castle-'+['m','l','p'][state.character-1];
      }
      // Fades, Ready audio and Phase5 endings remain omitted.
    }
    this.present();
  }
  results(result,profile,activity) {
    this.background('BLACKBRD');
    this.operations=drawStats(this.front,this.resources('BLACKBRD'),{...activity,...result},profile).operations;
    this.present();
  }
}
