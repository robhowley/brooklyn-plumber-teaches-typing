import { certificateLevels, certificateDocument } from '../recovered/control/certificate.mjs';

// Browser adaptation: native controls and window.print replace the DOS
// selector/printer transport. Selection and printing never alter the profile.
export function openCertificateSelector(profile, data, onClose) {
  const levels=certificateLevels(profile);
  const dialog=document.createElement('dialog');
  dialog.id='certificate-selector';
  dialog.setAttribute('aria-labelledby','certificate-title');
  dialog.innerHTML='<form method="dialog"><h2 id="certificate-title">Print certificate</h2><label>Completed level <select name="level"></select></label><p class="certificate-empty" hidden>No completed levels.</p><p><button type="button" name="print">Print</button> <button value="cancel">Cancel</button></p></form>';
  const select=dialog.querySelector('select'), print=dialog.querySelector('[name="print"]');
  for(const level of [1,2,3]) {
    const option=new Option(data.messages[199+level],String(level));
    option.disabled=!levels.includes(level);select.add(option);
  }
  select.value=levels.length?String(levels[0]):'';
  select.disabled=print.disabled=levels.length===0;
  dialog.querySelector('.certificate-empty').hidden=levels.length!==0;
  // Keep one frame until the selector closes, including after dialog cancel or
  // repeat print. No popup, export, PDF encoder or afterprint save transition.
  let frame=null;
  print.addEventListener('click',()=>{
    const text=certificateDocument(profile,Number(select.value),data);
    if(!frame) {
      frame=document.createElement('iframe');
      frame.title='Certificate print document';frame.className='certificate-print-frame';
      frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');document.body.append(frame);
      const doc=frame.contentDocument;
      doc.title='Certificate';doc.documentElement.lang='en';
      const style=doc.createElement('style');
      // 80 columns at 9pt Courier (6.0in), 60 lines at 11pt (9.17in),
      // inside Letter's 7.5 x 10in content box. No wrapping or app controls.
      style.textContent='@page { size: letter portrait; margin: 0.5in; } html, body { margin: 0; padding: 0; background: white; color: black; } pre { margin: 0; padding: 0; font: 9pt/11pt "Courier New", Courier, monospace; white-space: pre; overflow-wrap: normal; word-break: normal; width: 80ch; break-inside: avoid; }';
      doc.head.append(style);doc.body.append(doc.createElement('pre'));
    }
    frame.contentDocument.querySelector('pre').textContent=text;
    frame.contentWindow.print();
  });
  dialog.addEventListener('close',()=>{frame?.remove();dialog.remove();onClose();},{once:true});
  document.body.append(dialog);dialog.showModal();
}
