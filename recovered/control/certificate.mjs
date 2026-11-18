import { sourceFormat } from './report.mjs';

// MarioTea/MARIO/MARIO.EXE SHA256
// 6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e.
// FILE 0xab14..0xab1d gates on profile presence; 0xac46/0xad23 on completed
// bytes only. Printed/pending never gate reprints (selector 0xaaf9..0xaea6).
export function certificateLevels(profile) {
  return profile.profilePresent?[1,2,3].filter(level=>Boolean(profile.completed[level-1])):[];
}

// Pure translation of FILE 0xb069..0xb0a5 and helpers. Inert art/messages are
// build inputs, with member hashes, resource indices and FILE offsets in data.
// ENGLISH.MSD IDs 4200..4205 (indices 96..101), 200..202 (indices 21..23).
// No print transport, profile mutation, flag transition or save belongs here.
export function certificateDocument(profile, level, {certificate, messages}) {
  if(!certificateLevels(profile).includes(level))throw new RangeError('Certificate level is not completed');
  // FILE 0xa903..0xa970: 60 rows of 80 spaces, excluding the private NUL.
  const rows=Array.from({length:60},()=>Array(80).fill(' '));
  // FILE 0xb001..0xb068: inclusive border x=2..77, y=2..57.
  for(let x=2;x<78;x++)rows[2][x]=rows[57][x]='*';
  for(let y=2;y<58;y++)rows[y][2]=rows[y][77]='*';
  // FILE 0xaa8b..0xaaf8: center minus floor(strlen/2), not (80-len)/2.
  const center=(text,y)=>{
    const x=40-Math.floor(text.length/2);
    for(let i=0;i<text.length;i++)rows[y][x+i]=text[i];
  };
  // FILE 0xaecf..0xaf15: 31 entries centered vertically around row 22.
  for(const row of certificate.art)center(row.text,7+row.index);
  // FILE 0xaf16..0xb000, start row 41, increments 2,3,2,2,2,2.
  center(messages[4200],41);
  center(messages[4201],43);
  center(messages[4202],46);
  center(profile.name,48);
  center(messages[4203],50);
  center(sourceFormat(messages[4204],messages[199+level]),52);
  center(messages[4205],54);
  // FILE 0xa9a3..0xa9f5, format at FILE 0x20dd2: %-80.80s\r\n.
  return rows.map(row=>row.join('')+'\r\n').join('');
}
