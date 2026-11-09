// Edited screenshot traces and drawn reconstructions. Provenance: artifacts/trace-*/.
import marioPixels from './assets/characters/mario.json' with { type: 'json' };
import { outdoorTile } from './outdoor-art.js';
import { letters } from './outdoor-assets/letters.js';
// Integer scanlines keep silhouettes crisp at the scene's 640 × 280 resolution.
export const ink = '#171824';
export function rect(c, x, y, w, h, color) {
  c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
export function oval(c, x, y, rx, ry, color) {
  for (let row = -Math.floor(ry); row <= ry; row++) {
    const span = Math.floor(rx * Math.sqrt(Math.max(0, 1 - row * row / (ry * ry))));
    rect(c, x - span, y + row, span * 2 + 1, 1, color);
  }
}
export function poly(c, points, color) {
  const low = Math.ceil(Math.min(...points.map(p => p[1]))), high = Math.floor(Math.max(...points.map(p => p[1])));
  for (let y = low; y <= high; y++) {
    const hits = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) hits.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) rect(c, Math.ceil(hits[i]), y, Math.floor(hits[i + 1]) - Math.ceil(hits[i]) + 1, 1, color);
  }
}
export function noise(x, y, seed = 0) {
  let n = Math.imul(x + seed * 71, 374761393) + Math.imul(y + seed * 37, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
const images = new Map();
export function cached(key, width, height, paint) {
  if (!images.has(key)) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    paint(canvas.getContext('2d')); images.set(key, canvas);
  }
  return images.get(key);
}
// A small quantized palette, lit from upper left. Used for rounded cloth and skin.
function round(c, x, y, rx, ry, colors) {
  oval(c, x, y, rx, ry, colors[0]);
  oval(c, x - 1, y - 1, rx - 1, ry - 1, colors[1]);
  oval(c, x - Math.max(1, rx / 5), y - Math.max(1, ry / 5), rx * .64, ry * .63, colors[2]);
  if (colors[3]) oval(c, x - rx / 3, y - ry / 3, Math.max(1, rx * .3), Math.max(1, ry * .23), colors[3]);
}
const skin = ['#914327', '#de8950', '#ffc586', '#ffe5b0'];
const glove = ['#38445b', '#a9b7cc', '#f1f5ee', '#ffffff'];
const blue = ['#101950', '#1835a0', '#255be2', '#639afa'];
const shoe = ['#281c20', '#693821', '#ae612c', '#e4a45c'];

// Palette-indexed rows remain directly editable. No image decoding or network work
// happens in draw calls; the existing canvas cache rasterizes each pose just once.
function tracedMario(c, frame, scale = 2) {
  const { rows, offset } = marioPixels.frames[frame];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length;) {
      const color = rows[y][x];
      let end = x + 1;
      while (rows[y][end] === color) end++;
      if (color !== '.') rect(c, (offset[0] + x) * scale, (offset[1] + y) * scale, (end - x) * scale, scale, marioPixels.palette[color]);
      x = end;
    }
  }
}

// Luigi and Princess below are unsupported gameplay reconstructions, not traced
// or validated playable sprites. They are separate from the title-only artwork.
function head(c, character, mood = 'neutral') {
  const luigi = character === 'Luigi', princess = character === 'Princess';
  if (princess) {
    round(c, 25, 23, 18, 23, ['#78411e', '#bf7b28', '#efb936', '#ffe685']);
    round(c, 30, 24, 12, 13, skin);
    oval(c, 36, 22, 3, 5, '#fff8e7'); rect(c, 37, 20, 2, 5, '#2162b8'); rect(c, 38, 20, 1, 3, ink);
    rect(c, 34, 17, 6, 2, '#6d4128');
    round(c, 40, 27, 4, 3, skin);
    oval(c, 33, 32, 3, 1, '#b13760');
    poly(c, [[12,17],[19,9],[33,9],[40,14],[32,20],[26,15],[22,23]], '#ffd45b');
    poly(c, [[18,10],[17,1],[23,5],[28,0],[32,5],[38,2],[36,11]], '#71411d');
    poly(c, [[20,9],[19,3],[24,7],[28,2],[31,7],[36,4],[34,10]], '#ffe876');
    rect(c, 27, 6, 3, 4, '#e63c63'); rect(c, 21, 8, 2, 2, '#28a4db');
    round(c, 22, 29, 3, 3, ['#144776','#2387c4','#69e9ff']);
    return;
  }
  const red = luigi ? ['#123e2b','#08793b','#1fb74e','#69e874'] : ['#651c2b','#b51b2e','#ef3438','#ff7462'];
  // Side profile: heavy brow, small far eye, long nose and squared moustache.
  poly(c,[[15,14],[34,13],[41,19],[42,29],[37,38],[26,41],[17,34],[12,23]],ink);
  poly(c,[[17,16],[34,15],[39,20],[40,29],[35,36],[27,38],[19,32],[14,23]],skin[1]);
  poly(c,[[23,17],[35,17],[39,23],[37,31],[29,35],[23,30]],skin[2]);
  poly(c,[[13,16],[22,15],[24,20],[20,22],[23,30],[18,31],[12,25]],'#43251c');
  round(c,17,25,5,6,skin);rect(c,16,24,3,4,'#aa542a');
  oval(c,34,21,4,6,'#fff7df');oval(c,41,20,2,4,'#fff7df');
  rect(c,35,19,3,5,'#244ba4');rect(c,37,20,2,4,ink);rect(c,42,19,2,4,ink);
  rect(c,30,15,9,3,'#30231c');rect(c,40,15,4,2,'#30231c');
  poly(c,[[26,28],[33,29],[35,26],[44,28],[46,32],[39,35],[30,34],[26,31]],'#25201b');
  round(c,43,26,9,5,skin);
  rect(c,30,35,8,2,'#fff3d4');
  if(mood==='sad')rect(c,31,36,7,2,'#6d3029');
  poly(c,[[10,17],[13,10],[19,5],[25,1],[36,1],[40,5],[42,13],[47,17],[44,19],[32,16],[20,18]],ink);
  poly(c,[[12,16],[17,9],[25,3],[35,2],[39,7],[40,13],[44,16],[32,14],[20,16]],red[1]);
  poly(c,[[15,13],[22,6],[28,3],[35,3],[38,8],[38,12],[27,11],[20,15]],red[2]);
  rect(c,25,4,9,1,red[3]);
  poly(c,[[21,15],[33,12],[42,14],[46,17],[43,18],[32,15],[23,17]],red[0]);
  oval(c, 28, 9, 6, 5, '#fff2cf');
  if (luigi) { rect(c, 26, 6, 2, 6, red[1]); rect(c, 26, 11, 5, 1, red[1]); }
  else { rect(c, 24, 7, 1, 5, red[1]); rect(c, 31, 7, 1, 5, red[1]); poly(c, [[25,7],[28,9],[31,7],[31,9],[28,11],[25,9]], red[1]); }
}

function portraitHead(c, character, mood) {
  if (character === 'Mario') {
    tracedMario(c, 'portrait', 1);
    // Retain the traced happy face. Closed mouth/frown are recreation edits.
    if (mood !== 'happy') {
      rect(c, 25, 46, 15, 5, marioPixels.palette['5']);
      if (mood === 'sad') poly(c, [[25,50],[29,46],[35,46],[39,50],[35,48],[29,48]], marioPixels.palette['1']);
      else rect(c, 26, 48, 12, 2, marioPixels.palette['1']);
    }
    return;
  }
  const princess=character==='Princess', luigi=character==='Luigi';
  const cap=luigi?['#17422e','#16813a','#33bf50','#81e76d']:['#651c2b','#b51b2e','#ef3438','#ff7462'];
  if(princess) round(c,32,38,28,36,['#78411e','#bf7b28','#efb936','#ffe685']);
  else oval(c,32,40,26,25,'#30251b');
  round(c,7,41,7,9,skin);round(c,57,41,6,8,skin);
  round(c,32,41,25,24,skin);oval(c,7,41,3,5,'#a65b2b');oval(c,57,41,3,4,'#a65b2b');
  poly(c,[[10,28],[16,26],[16,41],[12,43]],'#5c341b');poly(c,[[48,27],[54,29],[53,44],[48,41]],'#5c341b');
  oval(c,24,34,6,7,'#fff8e7');oval(c,40,34,6,7,'#fff8e7');
  for(const x of [25,39]){oval(c,x,35,4,5,'#3439b6');oval(c,x+1,36,2,4,'#10233b');rect(c,x,33,2,2,'#fffdf1');}
  poly(c,[[17,24],[22,21],[29,23],[29,26],[22,25],[17,27]],'#573327');
  poly(c,[[35,23],[42,21],[47,24],[47,27],[42,25],[35,26]],'#573327');
  if(mood==='sad'){poly(c,[[16,26],[28,20],[28,23],[18,28]],'#573327');poly(c,[[36,20],[48,26],[46,28],[36,23]],'#573327');}
  if(!princess){
    poly(c,[[11,48],[18,46],[25,48],[39,48],[46,46],[54,49],[51,53],[41,56],[22,56],[12,53]],'#24251f');
    for(let i=0;i<5;i++)oval(c,20+i*6,53,4,3,'#24251f');
  }
  round(c,32,44,princess?5:10,princess?5:6,skin);
  if(mood==='happy'){oval(c,32,58,10,6,'#65272a');oval(c,32,61,5,2,'#da745d');rect(c,25,54,14,3,'#fff4da');}
  else if(mood==='sad')poly(c,[[23,60],[27,56],[36,56],[41,60],[35,59],[28,59]],'#80352d');
  else {oval(c,32,58,7,2,'#8e4434');rect(c,27,57,10,1,'#ffe0ac');}
  if(princess){
    poly(c,[[7,26],[13,10],[34,5],[52,13],[57,27],[41,21],[33,13],[24,25],[18,22]],'#ffd461');
    poly(c,[[19,12],[17,1],[27,7],[32,0],[38,7],[48,1],[45,13]],'#9b681f');
    poly(c,[[21,11],[20,4],[27,10],[32,3],[38,10],[45,4],[43,11]],'#fff19b');
    oval(c,32,9,3,4,'#d33e71');for(const x of [10,54])round(c,x,47,4,5,['#164476','#2998ce','#9cf3ff']);
  }else{
    poly(c,[[1,24],[5,17],[16,7],[24,2],[37,1],[47,6],[58,17],[63,25],[60,30],[51,29],[41,23],[21,23],[9,30],[2,29]],'#451c19');
    poly(c,[[2,24],[6,17],[17,7],[25,3],[37,2],[47,7],[56,17],[61,25],[58,28],[48,24],[39,20],[21,21],[8,28],[3,28]],cap[1]);
    poly(c,[[3,23],[8,16],[18,7],[25,3],[37,3],[46,7],[55,17],[58,24],[44,18],[24,17],[11,24]],'#f52e16');
    poly(c,[[5,21],[11,13],[21,6],[28,4],[36,4],[40,6],[26,7],[16,12],[9,20]],'#ff9a72');
    poly(c,[[12,26],[20,20],[40,20],[52,27],[43,25],[20,24]],cap[0]);
    if(luigi){poly(c,[[3,23],[12,14],[23,6],[32,3],[41,6],[53,16],[57,23],[44,18],[24,17],[11,24]],cap[2]);}
    oval(c,32,12,10,7,'#fff1d6');
    if(luigi){rect(c,29,7,3,10,cap[1]);rect(c,29,15,8,2,cap[1]);}
    else {poly(c,[[26,17],[26,7],[29,7],[32,12],[35,7],[38,7],[38,17],[35,17],[35,12],[32,16],[29,12],[29,17]],cap[1]);}
  }
}

export function characterImage(character = 'Mario', pose = 0, mood = 'neutral', portrait = false) {
  character = ['Mario','Luigi','Princess'].includes(character) ? character : 'Mario';
  if (character === 'Mario' && !portrait) {
    // 0 is a held running frame, not an unverified DOS idle animation. Pose 4
    // exposes the traced cap-return frame without adding an independent clock.
    const frame = pose === 3 ? 'jump' : pose === 4 ? 'cap-return' : pose === 2 ? 'run-b' : pose === 1 ? 'run-a' : 'run-c';
    return cached(`mario:${frame}`, 96, 88, c => tracedMario(c, frame));
  }
  return cached(`character:${character}:${pose}:${mood}:${portrait}`, 64, 76, c => {
    const princess = character === 'Princess', luigi = character === 'Luigi';
    const shirt = princess ? ['#79265b','#c43f89','#fa7cbd','#ffbadf'] : luigi ? ['#123e2b','#08793b','#1fb74e','#69e874'] : ['#651c2b','#b51b2e','#ef3438','#ff7462'];
    if (!portrait) {
      const stride = pose === 1 ? 12 : pose === 2 ? 9 : pose === 3 ? 16 : 0;
      const lift = pose === 3 ? 3 : 0;
      const frontLift = pose === 3 ? 15 : 0;
      // Far arm and leg first, then torso, near arm and the head.
      round(c, 17, 47, 7, 10, shirt);
      round(c, 12, pose === 3 ? 37 : 53 - stride / 2, 5, 6, glove);
      const boot = princess ? shoe : ['#481b1b','#a52c20','#ed4a2b','#ffb36b'];
      poly(c,[[19,52],[30,56],[24-stride,67-lift],[Math.max(5,12-stride/2),69-lift],[Math.max(5,13-stride/2),60-lift/2]],ink);
      poly(c,[[20,54],[28,57],[22-stride/2,64-lift/2],[Math.max(7,14-stride/2),66-lift],[Math.max(7,15-stride/2),61-lift/2]],princess?shirt[1]:blue[1]);
      round(c,Math.max(10,20-stride),69-lift,10,5,boot);
      rect(c,Math.max(0,10-stride),73-lift,21,2,'#efbd76');
      poly(c,[[28,53],[39,54],[49+stride/2,60-frontLift],[45+stride/2,70-frontLift],[30,65]],ink);
      poly(c,[[29,55],[38,56],[47+stride/2,61-frontLift],[43+stride/2,67-frontLift],[30,63]],princess?shirt[2]:blue[2]);
      round(c,Math.min(52,39+stride),69-frontLift,11,5,boot);
      rect(c,Math.min(41,28+stride),73-frontLift,23,2,'#efbd76');
      round(c, 28, 48, luigi ? 11 : 14, 15, shirt);
      if (princess) {
        poly(c, [[20,42],[35,43],[47,65],[42,69],[12,69],[9,65]], '#69284f');
        poly(c, [[21,43],[34,43],[44,64],[39,67],[13,66]], '#db4b99');
        poly(c, [[23,44],[28,44],[30,65],[17,64]], '#ff9ed2');
        poly(c, [[31,47],[34,45],[40,63],[35,65]], '#f27bbb');
        rect(c, 15, 66, 25, 2, '#ffcee7'); round(c, 29, 43, 3, 3, ['#164476','#2998ce','#9cf3ff']);
      } else {
        round(c, 28, 56, luigi ? 12 : 14, 10, blue);
        poly(c, [[20,39],[24,39],[25,53],[33,53],[33,41],[37,42],[38,58],[18,59]], '#2146b9');
        rect(c, 21, 41, 2, 10, '#6598f5'); rect(c, 34, 44, 2, 8, '#5285e5');
        oval(c, 23, 51, 2, 2, '#ffe773'); oval(c, 35, 52, 2, 2, '#ffe773');
        rect(c, 25, 57, 7, 1, '#11358c');
      }
      const armY = pose === 3 ? 3 : 47 + stride / 3;
      round(c, 39, armY - 3, 6, 8, shirt);
      round(c, pose === 3 ? 48 : 43, armY + 4, 7, 6, glove);
      rect(c, 42, armY + 3, 1, 3, '#98a6b9'); rect(c, 45, armY + 2, 1, 3, '#98a6b9');
    }
    if(portrait) portraitHead(c,character,mood);
    else head(c, character, mood);
  });
}
// Sand poses reuse the trusted head/torso, never the walking leg cycle.
// Raised alternating gloves communicate effort without simulating collision/death.
export function struggle(c, x, floor, character, strained, phase = 0) {
  const sprite = characterImage(character, 0);
  const top = Math.round(floor) - sprite.height;
  const shoulder = top + (character === 'Mario' ? 51 : 45);
  const sleeve = character === 'Luigi' ? '#16813a' : character === 'Princess' ? '#db4b99' : '#bc2010';
  round(c,x,shoulder+9,13,18,[ink,sleeve,sleeve]);
  for (const side of [-1, 1]) {
    const handY = shoulder - (strained ? 15 + (side === 1 ? phase : 1-phase)*6 : 3);
    poly(c, [[x+side*13,shoulder+5],[x+side*29,handY+4],[x+side*32,handY-2],[x+side*20,shoulder-4]], sleeve);
    round(c,x+side*31,handY,5,6,glove);
  }
  // Crop before the old arms/legs. Sand will mask the remaining lower torso.
  c.drawImage(sprite,0,0,sprite.width,character==='Mario'?52:43,x-sprite.width/2,top,sprite.width,character==='Mario'?52:43);
}

export function runner(c, x, floor, character, pose = 0, swimming = false) {
  if (!swimming) {
    const sprite = characterImage(character, pose);
    c.drawImage(sprite, Math.round(x) - sprite.width / 2, Math.round(floor) - sprite.height);
    return;
  }
  if (character === 'Mario' || !['Luigi','Princess'].includes(character)) {
    const frame = pose === 2 ? 'swim-b' : 'swim-a';
    const sprite = cached(`mario:${frame}`, 104, 92, p => tracedMario(p, frame));
    // Fixed face/chest anchor across the two kicks, not each frame's bounding box.
    c.drawImage(sprite, Math.round(x) - 52, Math.round(floor) - 64);
    return;
  }
  // Unsupported Luigi/Princess swim reconstructions, retained as selectable stand-ins.
  const sprite=cached(`swimmer:${character}:${pose}`,96,64,p=>{
    const princess=character==='Princess',luigi=character==='Luigi';
    const cloth=princess?['#79265b','#c43f89','#fa7cbd','#ffbadf']:luigi?['#123e2b','#08793b','#1fb74e','#69e874']:['#651c2b','#b51b2e','#ef3438','#ff7462'];
    const kick=pose===2?10:0;
    const boot=princess?shoe:['#481b1b','#a52c20','#ed4a2b','#ffb36b'];
    poly(p,[[42,34],[27,33],[12,25+kick],[7,32+kick],[23,48],[44,48]],ink);
    poly(p,[[40,36],[26,35],[12,28+kick],[10,31+kick],[24,45],[43,46]],princess?cloth[1]:blue[1]);
    round(p,10,30+kick,7,4,boot);
    poly(p,[[47,35],[52,48],[35,55],[11,53-kick/2],[10,40-kick/2],[32,41]],ink);
    poly(p,[[47,37],[49,47],[35,52],[12,50-kick/2],[12,43-kick/2],[32,44]],princess?cloth[2]:blue[2]);
    poly(p,[[14,43-kick/2],[31,44],[40,40],[43,43],[32,48],[15,47-kick/2]],princess?cloth[3]:'#4977f0');
    poly(p,[[15,30+kick],[27,37],[35,37],[28,40],[19,36+kick/2]],princess?cloth[2]:'#2854cf');
    round(p,10,47-kick/2,5,9,boot);rect(p,5,41-kick/2,2,12,'#f5c47a');
    round(p,49,38,16,11,cloth);
    poly(p,[[34,30],[43,29],[45,43],[56,45],[47,50],[34,47]],princess?cloth[2]:blue[1]);
    rect(p,42,32,3,10,princess?'#ffd0ed':'#4c80ef');oval(p,44,42,2,2,'#ffe779');
    p.save();p.translate(37,-2);head(p,character);p.restore();
    round(p,57,40,7,6,cloth);round(p,65+(pose===2?5:0),45,7,5,glove);
    for(let i=0;i<3;i++)rect(p,64+(pose===2?5:0)+i*3,45,1,3,'#718298');
  });
  c.drawImage(sprite,Math.round(x)-48,Math.round(floor)-61);
}
export function star(c, x, y, radius = 10) {
  const width=Math.round(radius*2.36),height=Math.round(radius*1.82);
  c.drawImage(outdoorTile('star'),Math.round(x-width/2),Math.round(y-height/2),width,height);
}
export function turtle(c, x, floor, key, flipped = false) {
  const sprite=outdoorTile(flipped?'flipped-turtle':'turtle');
  c.drawImage(sprite,Math.round(x)-32,Math.round(floor)-sprite.height*2,sprite.width*2,sprite.height*2);
  if(!flipped && key!==undefined)targetLetter(c,key,x+9,floor-20,'#ffffff',23);
}
export function targetLetter(c, key, x, y, color = '#fff8cd', size = 18) {
  const rows=letters[key]||letters['?'],scale=Math.max(1,Math.round(size/11));
  const width=rows[0].length, left=Math.round(x-width*scale/2),top=Math.round(y-7*scale/2);
  // A one-native-pixel black contour stays crisp at all cabinet sizes.
  for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1],[0,0]]) {
    const fill=dx===0&&dy===0?color:'#000000';
    rows.forEach((row,ry)=>[...row].forEach((pixel,rx)=>{
      if(pixel==='1')rect(c,left+(rx+dx)*scale,top+(ry+dy)*scale,scale,scale,fill);
    }));
  }
}
export function thwomp(c, x, y) {
  // Palette-edited 40x46 tracing. A fixed top-center anchor keeps every fall frame stable.
  const sprite=cached('castle-blue-foe-trace',80,92,p=>{
    const palette=["#080b0d","#243344","#858d8d","#c1cece","#ffffff","#122b95","#2447d8","#3859ff","#156fba","#148dc9","#16b7c8","#42e4e5","#91ffff"];
    const rows=[".........000......000......000..........",".........03000...00300...000300.........",".........042200.0024200.0022420.........","........00444200024432000244430.........","....0000034443300444433004444300........","...004430044300004444320444444400000....","...04444300000.0444443200002330034400...","...04444330000.033333400..00330344440...","...0443320088000003023000000003344440...","...004030bb9b666000000005666650333440...","....00000a7bb7b760..00065bbb9bb232400...","..0000..0b77b7bb9000058b8cba9ba12020....","..0220000b87777b9895667b7baaaba10000....",".00443300b986979a7c6777b99bba9b1100000..",".04443400b8006bbb7b8b9799a5009b12334400.",".04444420c6101b97799b679ab1119b12434440.",".04444420778001b99777999b10159b12444440.",".000440007710001b679969b100019612440240.","...0000.079100031b977bb1310019612244000.",".00000000771013431b8bb134300157110000...",".03330220bbb0134422181244311577000......",".04443330baa013433181133431159912000000.",".04443320b880134231b9142431188b13334430.",".03444300ba11134428b9534421118b12334440.",".00444200cb9991331c99713315959b11444440.",".04444200069677001677710189595c11344400.",".0044400019b996999999675959955111344440.","..00000.017b9899b9bbbb75555575111244400.","..0000000bba89811111111118859501100000..","..0333200bb97111666baa88011688a100000...","..0444300a985156977ba967851559b1122200..","..04443008975877777b9669895589b1234420..",".004443001b99b777779777958959581134440..",".044443301cb9b7777757755556989012344400.",".0444400007bb67779775776957598013344440.",".0004004401c895555517575756981000044440.","...000044001699678101579559510144004000.",".....04332001111110000111111110440000...",".....044030033210000131010000003330.....",".....044000344300000342200333202440.....",".....0440.044430.033443300444300220.....",".....0330.044420.044443300334300000.....",".....0000.043200.04444330000330.........","..........02000..04444330..0000.........","..........000....00443000...............","..................00000................."];
    rows.forEach((row,y)=>[...row].forEach((index,x)=>{
      if(index!=='.')rect(p,x*2,y*2,2,2,palette[parseInt(index,16)]);
    }));
  });
  c.drawImage(sprite,Math.round(x-40),Math.round(y));
}
