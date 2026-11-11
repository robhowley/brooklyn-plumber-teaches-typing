import { sourceFormat } from '../recovered/control/report.mjs';
import { drawSourceText } from './report-render.mjs';

// FILE 0x15608..0x15748: reset color1 at each repaint, tags only at a
// line's first byte, tabs expand to the NEXT multiple of4, 35-byte output.
export function helpOperations(state) {
  if(!state.available) return [{font:'FONT5H',text:'Unavailable',x:16,y:30,
    color:1,background:15,shadow:0,opaque:true,hostNotice:true}];
  const ops=[];let color=1;
  for(let row=0;row<18;row++) {
    let line=state.lines[state.top+row]??'';
    if(line.startsWith('<')) {
      const end=line.indexOf('>');
      if(end<0) throw new RangeError('Unterminated help color tag');
      color=(parseInt(line.slice(1),10)||0)&255;line=line.slice(end+1);
    }
    let expanded='';
    for(const ch of line) {
      if(ch==='\t') do {expanded+=' ';} while(expanded.length%4);
      else expanded+=ch;
    }
    if(expanded.length>40) break; // original does not draw this or later rows
    ops.push({font:'FONT5H',text:sourceFormat('%-35.35s',expanded),x:16,y:30+row*8,
      color,background:15,shadow:0,opaque:true});
  }
  return ops;
}
export function drawHelp(front,resources,state) {
  if(resources.background.length!==64000) throw new RangeError('HELP background');
  front.set(resources.background);
  const operations=helpOperations(state);
  drawSourceText(front,resources.fonts,operations);
  return {palette:resources.palette,operations,available:state.available};
}

// FILE 0x145df..0x14640: image alone, embedded CRX palette, no modern labels.
export function drawKeyboard(front,resources) {
  if(front.length!==64000||resources.background.length!==64000) throw new RangeError('KEYBOARD background');
  front.set(resources.background);return {palette:resources.palette};
}

// FILE 0x11e21..0x12184. GREETBG + FONT3H. Text stays in local decoded
// resources. These are DS string addresses, not embedded original text.
export function aboutOperations({messages,strings}) {
  const ops=[],text=(value,column,row,color=15,adjust=0)=>ops.push({font:'FONT3H',text:value,
    x:(column-1)*8,y:(row-1)*10+adjust,color,background:0,shadow:8,opaque:false});
  text(strings[0x25c7],8,1,14,5);
  for(const [key,col,row,heading] of [[50400,2,3,true],[0x25e2,3,4],
    [50401,2,6,true],[0x25f3,3,7],[0x2602,3,8],[50402,2,10,true],
    [0x260f,3,11],[0x261c,3,12],[0x2629,3,13],[0x2636,3,14],
    [50403,2,16,true],[0x2645,3,17],[50404,21,3,true],
    [0x2655,22,4],[0x2665,22,5],[0x2676,22,6],[50405,21,8,true],
    [0x2682,22,9],[50406,21,11,true],[0x2694,22,12],
    [50407,21,14,true],[0x26a3,22,15],[0x26b4,22,16]])
    text(heading?messages[key]:strings[key],col,row,heading?14:15);
  text(messages[50420],13,20,14,-5);
  return ops;
}
export function drawAbout(front,resources) {
  if(resources.background.length!==64000) throw new RangeError('GREETBG background');
  front.set(resources.background);
  const operations=aboutOperations(resources);
  drawSourceText(front,resources.fonts,operations,resources.background);
  return {palette:resources.palette,operations};
}
