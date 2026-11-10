// Original static art with browser-owned scrolling/contact and hazard feedback.
// Rendering reads state only. No clocks, eligibility, audio or terminal transitions.
import { stats } from './engine.js';
import { originalImage, drawOriginal, actionImage, practiceFace } from './assets/original/index.js';
import { characterImage, rect, runner, struggle, star, turtle, targetLetter, thwomp } from './art.js';
const WIDTH=640, HEIGHT=400, FLOOR=280;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mod=(v,n)=>((v%n)+n)%n;
const number=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
function background(c,family,distance=0) {
  const image=originalImage(family),offset=Math.floor(mod(distance,WIDTH));
  c.drawImage(image,-offset,0,WIDTH,HEIGHT);
  if(offset)c.drawImage(image,WIDTH-offset,0,WIDTH,HEIGHT);
}
export function drawScene(canvas,state={}) {
  const c=canvas?.getContext?.('2d');if(!c)return;
  if(canvas.width!==WIDTH)canvas.width=WIDTH;if(canvas.height!==HEIGHT)canvas.height=HEIGHT;
  c.imageSmoothingEnabled=false;
  const correct=Math.max(0,Math.floor(number(state.correct))),elapsed=Math.max(0,number(state.elapsed)),errors=Math.max(0,number(state.errors));
  const metrics=stats({...state,correct,elapsed,errors});
  const s={...state,correct,elapsed,errors,wpm:metrics.wpm,
    time:state.reducedMotion?0:elapsed,
    distance:state.reducedMotion?0:number(state.travel?.distance,elapsed*48),
    text:typeof state.text==='string'&&state.text.length?state.text:'a',
    performance:clamp(.6*metrics.wpm/Math.max(1,number(state.goal,5))+.4*metrics.accuracy/100,0,1.25)};
  if(s.mode==='practice')practice(c,s);
  else if(s.mode==='underwater')water(c,s);
  else if(s.mode==='castle')castle(c,s);
  else outdoor(c,s);
}
function block(c,x,y,key) {drawOriginal(c,'OUTSIDE-brick1_1',x-20,y-16,2);targetLetter(c,key,x,y);}
function outdoor(c,s) {
  background(c,'OUTSIDE',s.distance);
  const obstacles=s.travel?.obstacles||Array.from({length:4},(_,i)=>({id:s.correct+i,x:330+i*120}));
  for(const {id,x,cleared} of obstacles) {
    if(cleared||x < -30||x>675)continue;
    const key=s.text[id%s.text.length];
    if(id%2===0) {block(c,x,151,key);if(id===s.correct)star(c,x,123);}
    else {turtle(c,x,FLOOR,key);if(id===s.correct)star(c,x-1,FLOOR-49);}
  }
  const action=s.travel?.action,age=action?Math.max(0,s.elapsed-action.at):10,moving=age<.6;
  const jump=moving&&!s.reducedMotion?Math.sin(age/.6*Math.PI)*(action.obstacle==='block'?42:22):0;
  const x=215+(moving&&!s.reducedMotion?(action.x-215)*Math.sin(age/.6*Math.PI):0);
  if(moving&&!s.reducedMotion) {
    const sprite=actionImage(s.character,'jmp',Math.floor(age*5));
    c.drawImage(sprite,Math.round(x-40),Math.round(FLOOR-jump-100),80,100);
  } else runner(c,x,FLOOR,s.character,s.reducedMotion?0:Math.floor(s.time*8)%3);
  if(moving) {
    const hitX=action.x-(s.distance-action.distance);
    if(action.obstacle==='turtle')turtle(c,hitX,FLOOR-10,undefined,true);
    else if(!s.reducedMotion)for(let i=0;i<6;i++)drawOriginal(c,'OUTSIDE-expls1_1',hitX+(i-3)*12,151-age*(70+i*8)+age*age*190,2);
  }
}
function water(c,s) {
  // WATER is the normal scene. WCAS0001 is available through drawScreen; no invented transition.
  background(c,'WATER',s.distance*.6);
  const performance=s.reducedMotion?.8:s.performance;
  const playerY=s.reducedMotion?230-s.correct%4*3:300-performance*59;
  drawOriginal(c,`WATER-bite000${[1,3,5][Math.floor(s.time*3)%3]}_1`,172-performance*75,playerY-100,2);
  drawOriginal(c,`WATER-octo000${[1,5,9][Math.floor(s.time*3)%3]}_1`,470,100+Math.round(Math.sin(s.time*.8)*16),2);
  const sprite=actionImage(s.character,'swm',Math.floor(s.time*5));
  c.drawImage(sprite,235,Math.round(playerY-sprite.height*2),sprite.width*2,sprite.height*2);
}
function castle(c,s) {
  background(c,'CASTLE');
  // CRX omits runtime masonry. Tile the recovered block rather than screenshot traces.
  for(let y=0;y<310;y+=50)for(let x=-Math.floor(mod(s.distance,50));x<640;x+=50)drawOriginal(c,'CASTLE-brick1_cblock',x,y,2);
  const quicksand=s.castleStage==='quicksand';
  if(quicksand) {
    // Existing nonterminal sand depth is model-owned; this flat masking band is an adaptation.
    rect(c,120,260,400,140,'#bd8428');
    struggle(c,235,300+number(s.sandDepth),s.character,number(s.sandDepth)>5,Math.floor(s.time*3)%2);
    rect(c,120,300,400,100,'#bd8428');
  } else {
    for(let i=0;i<4;i++) {
      const fall=s.reducedMotion?0:clamp(.5+Math.sin(s.time*1.3+i*2.1),0,1)*clamp((1-s.performance)*1.8,0,1)*139;
      thwomp(c,mod(206+i*180-s.distance,768)-40,32+fall);
    }
    runner(c,235,310,s.character,s.reducedMotion?s.correct%3:Math.floor(s.time*8)%3);
  }
  if(s.pipe) {
    // No complete recovered pipe raster. Minimal stationary browser pause illustration.
    rect(c,275,85,90,230,'#9a9a9a');rect(c,281,91,12,218,'#eee');rect(c,350,91,9,218,'#444');
    rect(c,260,80,120,24,'#c4c4c4');
  }
}
function practice(c,s) {
  background(c,'PRACTICE');
  // Existing browser WPM bands, not recovered historical mood thresholds.
  const goal=number(s.goal,5),mood=s.elapsed===0?'neutral':s.wpm>=goal?'happy':s.wpm<goal*.75?'sad':'neutral';
  // The expression is an inset, not a complete head. Its happy pixels match the
  // PRACTICE background at native (142,21), retaining the surrounding cap/ears.
  if(!s.character||s.character==='Mario')c.drawImage(practiceFace(mood),284,42,106,120);
  else {
    c.drawImage(originalImage('GREETBG'),0,0,320,100,0,0,640,200);
    c.drawImage(characterImage(s.character,0,mood,true),256,8,128,152);
  }
}
