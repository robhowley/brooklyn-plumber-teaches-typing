import { actionImage, practiceFace, drawOriginal, drawOriginalGlyph } from './assets/original/index.js';
export const ink = '#171824';
export function rect(c,x,y,w,h,color) { c.fillStyle=color; c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); }
export function oval(c,x,y,rx,ry,color) {
  for(let row=-Math.floor(ry);row<=ry;row++) { const span=Math.floor(rx*Math.sqrt(Math.max(0,1-row*row/(ry*ry)))); rect(c,x-span,y+row,span*2+1,1,color); }
}
export function poly(c,points,color) {
  const low=Math.ceil(Math.min(...points.map(p=>p[1]))),high=Math.floor(Math.max(...points.map(p=>p[1])));
  for(let y=low;y<=high;y++) {
    const hits=[];
    for(let i=0;i<points.length;i++) { const a=points[i],b=points[(i+1)%points.length]; if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y)) hits.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1])); }
    hits.sort((a,b)=>a-b);
    for(let i=0;i+1<hits.length;i+=2) rect(c,Math.ceil(hits[i]),y,Math.floor(hits[i+1])-Math.ceil(hits[i])+1,1,color);
  }
}
export function noise(x,y,seed=0) { let n=Math.imul(x+seed*71,374761393)+Math.imul(y+seed*37,668265263); n=Math.imul(n^(n>>>13),1274126177); return ((n^(n>>>16))>>>0)/4294967295; }
const images=new Map();
export function cached(key,width,height,paint) {
  if(!images.has(key)) { const canvas=document.createElement('canvas'); canvas.width=width;canvas.height=height;paint(canvas.getContext('2d'));images.set(key,canvas); }
  return images.get(key);
}
export function characterImage(character='Mario',pose=0,mood='neutral',portrait=false) {
  if(!portrait) return actionImage(character,pose===3?'jmp':'run',pose);
  return cached(`portrait:${character}:${mood}`,64,76,c=>{
    if(character==='Mario') { c.drawImage(practiceFace(mood),5,8);return; }
    // No Luigi/Princess expression records were recovered. Retain the existing
    // browser face adaptation; gameplay now uses recovered character sprites.
    adaptedPortrait(c,character,mood);
  });
}
function round(c,x,y,rx,ry,colors) {
  oval(c,x,y,rx,ry,colors[0]);oval(c,x-1,y-1,rx-1,ry-1,colors[1]);
  oval(c,x-Math.max(1,rx/5),y-Math.max(1,ry/5),rx*.64,ry*.63,colors[2]);
  if(colors[3])oval(c,x-rx/3,y-ry/3,Math.max(1,rx*.3),Math.max(1,ry*.23),colors[3]);
}
function adaptedPortrait(c,character,mood) {
  const skin=['#914327','#de8950','#ffc586','#ffe5b0'],princess=character==='Princess';
  if(princess)round(c,32,38,28,36,['#78411e','#bf7b28','#efb936','#ffe685']);
  else oval(c,32,40,26,25,'#30251b');
  round(c,7,41,7,9,skin);round(c,57,41,6,8,skin);round(c,32,41,25,24,skin);
  oval(c,7,41,3,5,'#a65b2b');oval(c,57,41,3,4,'#a65b2b');
  poly(c,[[10,28],[16,26],[16,41],[12,43]],'#5c341b');poly(c,[[48,27],[54,29],[53,44],[48,41]],'#5c341b');
  oval(c,24,34,6,7,'#fff8e7');oval(c,40,34,6,7,'#fff8e7');
  for(const x of [25,39]){oval(c,x,35,4,5,'#3439b6');oval(c,x+1,36,2,4,'#10233b');rect(c,x,33,2,2,'#fffdf1');}
  poly(c,[[17,24],[22,21],[29,23],[29,26],[22,25],[17,27]],'#573327');poly(c,[[35,23],[42,21],[47,24],[47,27],[42,25],[35,26]],'#573327');
  if(mood==='sad'){poly(c,[[16,26],[28,20],[28,23],[18,28]],'#573327');poly(c,[[36,20],[48,26],[46,28],[36,23]],'#573327');}
  if(!princess){poly(c,[[11,48],[18,46],[25,48],[39,48],[46,46],[54,49],[51,53],[41,56],[22,56],[12,53]],'#24251f');for(let i=0;i<5;i++)oval(c,20+i*6,53,4,3,'#24251f');}
  round(c,32,44,princess?5:10,princess?5:6,skin);
  if(mood==='happy'){oval(c,32,58,10,6,'#65272a');oval(c,32,61,5,2,'#da745d');rect(c,25,54,14,3,'#fff4da');}
  else if(mood==='sad')poly(c,[[23,60],[27,56],[36,56],[41,60],[35,59],[28,59]],'#80352d');
  else {oval(c,32,58,7,2,'#8e4434');rect(c,27,57,10,1,'#ffe0ac');}
  if(princess){
    poly(c,[[7,26],[13,10],[34,5],[52,13],[57,27],[41,21],[33,13],[24,25],[18,22]],'#ffd461');
    poly(c,[[19,12],[17,1],[27,7],[32,0],[38,7],[48,1],[45,13]],'#9b681f');poly(c,[[21,11],[20,4],[27,10],[32,3],[38,10],[45,4],[43,11]],'#fff19b');
    oval(c,32,9,3,4,'#d33e71');for(const x of [10,54])round(c,x,47,4,5,['#164476','#2998ce','#9cf3ff']);
  }else{
    poly(c,[[1,24],[5,17],[16,7],[24,2],[37,1],[47,6],[58,17],[63,25],[60,30],[51,29],[41,23],[21,23],[9,30],[2,29]],'#17422e');
    poly(c,[[2,24],[6,17],[17,7],[25,3],[37,2],[47,7],[56,17],[61,25],[58,28],[48,24],[39,20],[21,21],[8,28],[3,28]],'#16813a');
    poly(c,[[3,23],[12,14],[23,6],[32,3],[41,6],[53,16],[57,23],[44,18],[24,17],[11,24]],'#33bf50');
    oval(c,32,12,10,7,'#fff1d6');rect(c,29,7,3,10,'#16813a');rect(c,29,15,8,2,'#16813a');
  }
}
export function runner(c,x,floor,character,pose=0,swimming=false) {
  const sprite=actionImage(character,swimming?'swm':pose===3?'jmp':'run',pose);
  c.imageSmoothingEnabled=false;c.drawImage(sprite,Math.round(x-sprite.width),Math.round(floor-sprite.height*2),sprite.width*2,sprite.height*2);
}
export function struggle(c,x,floor,character,strained,phase=0) {
  const sprite=actionImage(character,'sin',strained?phase:0);
  c.imageSmoothingEnabled=false;c.drawImage(sprite,Math.round(x-sprite.width),Math.round(floor-sprite.height*2),sprite.width*2,sprite.height*2);
}
export function star(c,x,y) {drawOriginal(c,'OUTSIDE-cursor_1',x-11,y-10,2);}
export function turtle(c,x,floor,key,flipped=false) {
  drawOriginal(c,`OUTSIDE-turt1_${flipped?2:1}`,x-30,floor-34,2);
  if(!flipped&&key!==undefined)targetLetter(c,key,x+5,floor-18);
}
export function targetLetter(c,key,x,y) {
  if(!key || !drawOriginalGlyph(c,key,x,y,2)) {
    // Space remains a browser cue, never a replacement for scored DOM text.
    rect(c,x-6,y+2,12,2,'#fff');rect(c,x-6,y-1,2,3,'#fff');rect(c,x+4,y-1,2,3,'#fff');
  }
}
export function thwomp(c,x,y) {drawOriginal(c,'CASTLE-rockface_1',x-49,y,2);}
