// /MARIO/WINMARIO.EXE;1 SHA256
// 39a4fb53384afbfec13063c2f4c67d51013b1f8ea494788c88f1ac6c12f47f22.
// FILE 0x26c6..0x2b58: unsigned ranking, 32-bit arithmetic, signed %d.
const s16=n=>(n<<16)>>16;
export function calculateReport({counters:{total,errors,speed},elapsed,histogram}) {
  const ranked=Array.from({length:96},(_,i)=>i+32)
    .filter(i=>histogram[i]>0).sort((a,b)=>histogram[b]-histogram[a]||a-b).slice(0,3);
  const problem=ranked.length && ranked[0]>32 ? ' '+ranked.map(i=>String.fromCharCode(i)).join(',') : 'None!';
  const accuracy=total ? Math.floor((Math.imul(total-errors,100)>>>0)/total)&65535 : 0;
  const pad=(n,width)=>String(s16(n)).padStart(width,' ');
  return {speed,elapsed,accuracy,problem,reportStrings:[
    'Keys Typed: '+pad(total,4),'Errors:     '+pad(errors,4),'Word/Min:   '+pad(speed,4),
    'Accuracy:   '+pad(accuracy,3)+'%',
    'Lesson Time:'+pad(Math.floor(elapsed/60),2)+':'+String(elapsed%60).padStart(2,'0'),
    'Problem Keys:'+problem]};
}
// FILE 0x1ddbb signed JG; FILE 0x1dde1 unsigned JA against low-word minutes.
export function qualifies({speed,elapsed},threshold,minutes) {
  return s16(threshold)<=s16(speed) && minutes<=(Math.floor((elapsed>>>0)/60)&65535);
}
