import { originalImage } from './assets/original/index.js';
const urls=new Map();
function imageUrl(id) {
  if(!urls.has(id))urls.set(id,originalImage(`FINGER-finger_${id}`).toDataURL());
  return urls.get(id);
}
export function gloveMarkup(hand) {
  const right=hand==='right';
  return `<span class="glove original-glove" data-hand="${right?'right':'left'}" aria-hidden="true"><img alt="" src="${imageUrl(right?12:11)}"><img class="original-finger" alt="" hidden></span>`;
}
export function updateGloves(container,hint) {
  const thumb=hint.startsWith('Either thumb'),[hand,finger]=hint.toLowerCase().split(' '),shifted=hint.includes('opposite Shift');
  const indices={little:1,ring:2,middle:3,index:4,thumb:5};
  container.querySelectorAll('.glove').forEach(glove=>{
    const same=glove.dataset.hand===hand,shift=shifted&&!same;
    const selected=thumb?'thumb':shift?'little':same?finger:null;
    const cue=glove.querySelector('.original-finger');
    if(!cue)return;
    cue.hidden=!indices[selected];
    if(!cue.hidden)cue.src=imageUrl(indices[selected]+(glove.dataset.hand==='right'?5:0));
    glove.classList.toggle('active',Boolean(selected));
    glove.classList.toggle('shift-finger',shift);
  });
}
