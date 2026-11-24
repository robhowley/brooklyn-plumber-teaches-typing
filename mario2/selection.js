// WINMARIO.EXE hash and FILE slices verified by presentation-pins.json.
// FILE 0x19ef0..0x19ff5 (ordinary state21 comparison); no report progression.
export function reportMovie({speed, threshold, previous}, random) {
  const draw=n=>random.next()%n;
  if ((speed & 65535)>=(threshold & 65535)) return draw(2)===1 ? 51:52;
  if ((speed & 65535)<(previous & 65535)) return draw(2)===0 ? 61:60;
  if ((speed & 65535)>(previous & 65535)) return draw(2)===0 ? 54:53;
  return 56+draw(4);
}
export const welcomeMovie=random=>random.next()%2 ? 41:15;
export const setupMovie=(table,random)=>table[random.next()%24];
export function selectLesson(lesson,random) {
  if(lesson.starts.length!==lesson.delimiter_count) throw Error('Missing delimiter starts');
  return {bytes:lesson.bytes,startOffset:lesson.starts[random.next()%lesson.delimiter_count]};
}
