// Static screen illustrations. The traced title is separate from gameplay art.
// Reference screenshots are comparison evidence only, never runtime assets.
import { characterImage, rect, oval, poly } from './art.js';
import { drawTitleIllustration } from './title-art.js';

export function drawPortrait(canvas, character) {
  canvas.width = 64; canvas.height = 76;
  canvas.getContext('2d').drawImage(characterImage(character, 0, 'happy', true), 0, 0);
}

export function drawTitle(canvas) {
  drawTitleIllustration(canvas);
}

export function drawTeacher(canvas) {
  canvas.width=180; canvas.height=280;
  const c=canvas.getContext('2d'); c.imageSmoothingEnabled=false;
  oval(c,99,267,69,8,'#7c7c7d');
  oval(c,75,260,25,10,'#8d4614'); oval(c,119,262,30,10,'#b1691b');
  poly(c,[[69,115],[120,112],[151,229],[139,256],[48,254],[40,232]],'#25272c');
  poly(c,[[73,119],[109,116],[134,244],[106,251],[91,154],[80,249],[57,245]],'#505156');
  poly(c,[[80,137],[86,158],[68,243],[59,244]],'#737477');
  poly(c,[[98,145],[106,149],[123,244],[111,246]],'#37383d');
  // Raised sleeve and white glove hold the classroom pointer.
  poly(c,[[76,125],[47,151],[21,111],[34,99],[56,123]],'#424449');
  poly(c,[[43,134],[25,107],[32,102],[52,130]],'#6d7074');
  poly(c,[[25,105],[8,49],[11,47],[30,104]],'#faf9e8');
  oval(c,27,105,10,15,'#222630'); oval(c,25,103,8,13,'#fffdf0');
  for(let y=99;y<113;y+=4) rect(c,20,y,8,1,'#8f969b');
  // Shared portrait stays owned by the character renderer. Gown and cap are static screen props.
  c.drawImage(characterImage('Mario',0,'happy',true),54,40,82,98);
  poly(c,[[52,75],[63,47],[111,42],[137,76],[116,69],[80,67]],'#36383d');
  poly(c,[[61,62],[75,45],[106,45],[119,65],[83,62]],'#55585d');
  poly(c,[[28,31],[105,17],[162,42],[83,55]],'#24262b');
  poly(c,[[33,30],[105,21],[154,42],[84,50]],'#55585d');
  poly(c,[[105,28],[132,57],[137,90],[134,92],[128,60]],'#d5b04f');
  rect(c,133,87,6,15,'#b58b2b');
  poly(c,[[113,197],[146,190],[164,237],[127,249],[111,230]],'#a56a37');
  poly(c,[[118,200],[143,196],[156,232],[128,241]],'#eeeade');
  poly(c,[[117,139],[138,158],[151,204],[135,213],[118,184]],'#3c3e43');
  oval(c,139,217,15,13,'#32353b'); oval(c,137,214,13,11,'#fffdf0');
  for(let x=130;x<148;x+=5) rect(c,x,214,1,11,'#888e94');
}
