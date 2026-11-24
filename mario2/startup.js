// /MARIO/WINMARIO.EXE;1 SHA256 39a4fb53384afbfec13063c2f4c67d51013b1f8ea494788c88f1ac6c12f47f22.
// FILE 0x13c64..0x13d9b, 0x153ea..0x155b2, 0x16974..0x169d0,
// 0x1702e..0x17098. Browser clip identities replace Win16 notification guards.
export function createStartup({backdrop,play,close,fade,restore,welcome}) {
  let phase='logo', stage=0, transition=0, count=0, generation=0;
  function launch(selector) {
    const identity=++generation;
    play(selector,()=>{if(identity===generation) skip();});
  }
  function skip() {
    if(phase!=='logo' && phase!=='intro') return false;
    ++generation; close();
    if(phase==='logo') {backdrop(485);phase='logo-transition';}
    else {stage=2;phase='intro-transition';}
    transition=1;
    return true;
  }
  function tick() {
    if(transition===1) {count=8;transition=2;return;}
    if(transition===2) {
      // FILE 0x18b19..0x18b6b: inclusive channel loop aliases DS:3b52
      // (the decremented counter). One subtraction pass zeros 7, not eight passes.
      const old=count; count--;
      if(old===0) {transition=3;return;}
      fade(75);count=Math.max(0,count-75);return;
    }
    if(transition===3) {
      restore();transition=0;
      if(phase==='logo-transition') {
        phase='intro';stage=1;backdrop(613);launch(1);
      }
      return;
    }
    if(phase==='intro-transition' && stage===2) {stage=3;return;}
    if(stage===3) {stage=4;phase='welcome';welcome();}
  }
  backdrop(485);launch(0);
  return {skip,tick,active:()=>stage!==4,snapshot:()=>({phase,stage,transition,count})};
}
