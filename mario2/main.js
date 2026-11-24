import {loadAssets} from './assets.js';
import {createRenderer} from './render.js';
import {createSetup} from './setup.js';
import {createStudentStore} from './storage.js';

const canvas=document.querySelector('canvas'), status=document.querySelector('#status');
const error=document.querySelector('#error'), controls=document.querySelector('#controls');
const dialog=document.querySelector('#duplicate');
// Browser adaptation: explicit Windows-style endpoint colors, not historical OS pixel equality.
const low=[0,0,0,128,0,0,0,128,0,128,128,0,0,0,128,128,0,128,0,128,128,192,192,192,192,220,192,166,202,240];
const high=[255,251,240,160,160,164,128,128,128,255,0,0,0,255,0,255,255,0,0,0,255,255,0,255,0,255,255,255,255,255];
try {
  const assets=await loadAssets(new URL('./assets.json',import.meta.url));
  const setup=createSetup({store:createStudentStore(()=>window.localStorage),nameKeyFlags:assets.presentation.nameKeyFlags});
  const renderer=createRenderer(canvas,assets,{paletteEndpoints:{low,high}});
  let view, fixture=false;
  const choices={
    1:[['New student',2],['Continue',39]],
    2:[['Mario',3,0],['Princess',3,1],['Luigi',3,2]],
    3:[['Confirm name',4]],4:[['Choose lesson plan',5]],
    5:[['Express',14,3]],
    14:['Home','Top','Bottom','Numbers','Symbols'].map((s,i)=>[s,17,i]),
  };
  function display(next) {
    const reenter=!view || view.state!==next.state ||
      (next.state===1 && Boolean(view.name)!==Boolean(next.name));
    view=next;
    if(reenter) renderer.enter(view);
    else renderer.draw(view);
    status.textContent=fixture ? 'Renderer fixture only, no mechanics or statistics calculated.' :
      view.state===21 ? 'State 21: typing is not implemented in this setup and renderer preview.' :
      'Setup state '+view.state+' | Name: '+(view.name||'(blank)')+' | Character: '+view.character+' | Keyset: '+view.keyset;
    error.textContent=view.storageError ? 'Persistence refused: '+view.storageError.message : '';
    controls.replaceChildren();
    if (!fixture) for (const [label,selector,argument] of choices[view.state]??[]) {
      const button=document.createElement('button');
      button.textContent=label;
      button.onclick=()=>dispatch({type:'select',selector,argument});
      controls.append(button);
    }
    if (view.state===3 && !fixture) {
      const hint=document.createElement('p');
      hint.textContent='Type a name (8 bytes maximum). Backspace edits; Enter confirms. Blank becomes NONAME.';
      controls.append(hint);
    }
    if(view.duplicate && !dialog.open) dialog.showModal();
    else if(!view.duplicate && dialog.open) dialog.close();
  }
  function dispatch(action){if(!fixture) display(setup.dispatch(action));}
  dialog.querySelectorAll('button').forEach(b=>b.onclick=()=>dispatch({type:'duplicate-result',result:Number(b.value)}));
  dialog.addEventListener('cancel',event=>{event.preventDefault();dispatch({type:'duplicate-result',result:2});});
  window.addEventListener('keydown',event=>{
    if(fixture || view.state!==3 || view.duplicate || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if(event.key==='Enter'){event.preventDefault();dispatch({type:'confirm-name'});}
    else if(event.key==='Backspace'){event.preventDefault();dispatch({type:'name-key',key:8,byte:8});}
    else if(event.key.length===1 && event.key.charCodeAt(0)<=255){
      event.preventDefault();dispatch({type:'name-key',key:event.key.charCodeAt(0),byte:event.key.charCodeAt(0)});
    }
  });
  canvas.addEventListener('click',event=>{
    if(fixture || view.duplicate) return;
    const bounds=canvas.getBoundingClientRect();
    const x=(event.clientX-bounds.left)*640/bounds.width, y=(event.clientY-bounds.top)*480/bounds.height;
    const hit=(assets.presentation.hotspots[view.state]??[]).find(({rectangle:[l,t,r,b]})=>x>=l&&x<=r&&y>=t&&y<=b);
    if(hit) dispatch({type:'select',selector:hit.selector,argument:hit.argument});
  });
  document.querySelector('#typing').onclick=()=>{fixture=true;display({state:21,rows:['SOURCE RENDER FIXTURE','asdf jkl;'],expectedByte:74,cursorColumn:2});};
  document.querySelector('#report').onclick=()=>{fixture=true;display({state:10,reportStrings:['FIXTURE','0','0','0','0','0']});};
  document.querySelector('#overlay').onclick=()=>renderer.visitOverlay({state:view.state,transition:0,movie:0,timerDelivered:true});
  document.querySelector('#setup').onclick=()=>{fixture=false;display(setup.snapshot());};
  display(setup.snapshot());
} catch (failure) {
  status.textContent='Unable to start.';
  error.textContent='Load refused: '+failure.message;
}
