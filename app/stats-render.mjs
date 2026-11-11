import { s16, s32 } from '../recovered/control/scoring.mjs';
import { sourceFormat } from '../recovered/control/report.mjs';
import { drawSourceText } from './report-render.mjs';

// FILE 0x15d88..0x16192, jump table0x164a4; modes1/2/3/4 use different
// resource IDs, palette slots, fonts and y overrides. All text is opaque.
export function numericHUDOperations(mode,stats,messages) {
  if(![1,2,3,4].includes(mode)) throw new RangeError('world mode');
  const water=mode===2, practice=mode===4;
  const font=water?'FONT3H':'FONT5H', bg=[0,13,86,0,1][mode];
  const y=water?8:(practice?8:168), lower=water?24:y+16;
  const time=s32(stats.elapsedSeconds), low=s16(time);
  const parts=[Math.trunc(low/3600),s16(Math.trunc(time/60))%60,low%60];
  const base=mode*10;
  const op=(id,x,y,color,...values)=>({font,text:sourceFormat(messages[id],...values),
    x,y,color,background:bg,shadow:8,opaque:true});
  return [op(base,water?232:256,y,water?11:10,stats.wpm),
    op(base+1,0,y,water?11:10,...parts),
    op(base+2,0,lower,mode===1?15:14,stats.attempts),
    op(base+3,water?232:240,lower,mode===1?15:14,stats.errors)];
}

// Statistics operation210 starts by refreshing score (0x16243..0x16251).
// Caller passes that refreshed structure; this presentation never owns a timer.
// FILE 0x16254..0x16445: BLACKBRD, FONT5H 8x8, transparent, shadow8.
export function statsOperations(stats,profile,messages) {
  const ops=[], text=(value,column,row,color)=>ops.push({font:'FONT5H',text:value,
    x:(column-1)*8,y:(row-1)*8,color,background:0,shadow:8,opaque:false});
  for(const [id,row] of [[5500,5],[5501,7],[5502,9],[5503,11],[5504,13],[5505,16]])
    if(id!==5503||profile.profilePresent) text(messages[id],6,row,11);
  text(sourceFormat('%4u',stats.attempts),18,5,10);
  text(sourceFormat('%4u',stats.errors),18,7,10);
  text(sourceFormat('%3u',stats.wpm),19,9,10);
  if(profile.profilePresent) text(sourceFormat('%3u',profile.goal),19,11,10);
  text(sourceFormat('%3u%%',stats.accuracy),18,13,10);
  const elapsed=s32(stats.elapsedSeconds);
  text(sourceFormat('%3u:%02u',Math.trunc(elapsed/60),elapsed%60),18,16,10);
  return ops;
}
export function drawNumericHUD(front,fonts,mode,stats,messages) {
  const ops=numericHUDOperations(mode,stats,messages);drawSourceText(front,fonts,ops);return ops;
}
export function drawStats(front,resources,stats,profile) {
  if(resources.background.length!==64000) throw new RangeError('BLACKBRD background');
  front.set(resources.background);
  const operations=statsOperations(stats,profile,resources.messages);
  drawSourceText(front,resources.fonts,operations,resources.background);
  return {palette:resources.palette,operations};
}
