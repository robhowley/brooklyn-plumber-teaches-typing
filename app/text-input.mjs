import { dosKey } from './session.mjs';

// Browser adaptation, not a recovered DOS text editor. The caller owns the
// visible textarea, mobile hints, focus and routing of the numeric DOS keys.
// https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event
// https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event
// https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event
export function bindTextInput(element, onKey) {
  // Keep one invisible character behind the caret so mobile Backspace still
  // changes the value after every reset. It is never sent to the DOS boundary.
  const sentinel = '\u200b';
  let composing = false;
  let compositionAllowed = true;
  let pendingType = '';
  let generation = 0;
  const reset = () => {
    element.value = sentinel;
    element.setSelectionRange(1, 1);
  };
  const emitText = text => {
    const current = generation;
    for (const character of text.replace(/\r\n?/g, '\n')) {
      if (current !== generation) break;
      const code = character.charCodeAt(0);
      if (character === '\n') onKey(13);
      else if (code >= 32 && code <= 126) onKey(code);
    }
  };
  const editKey = type => {
    if (type === 'deleteContentBackward') return 8;
    if (type === 'deleteContentForward') return 0x153;
    return type === 'insertLineBreak' || type === 'insertParagraph' ? 13 : 0;
  };
  // Without edit metadata a value change is treated as direct typing. Paste
  // and drop have their own guards; unlabelled autofill is indistinguishable.
  const allowed = type => !type || type === 'insertText' ||
    type === 'insertCompositionText' || type === 'insertFromComposition' ||
    type === 'deleteCompositionText' || !!editKey(type);

  const keydown = event => {
    // Printable hardware keys must reach input, just like virtual keyboards.
    // Enter/Backspace also use edits, avoiding keydown + input duplicates.
    if (composing || event.isComposing || event.keyCode === 229 || event.key === 'Enter' || event.key === 'Backspace') return;
    // Shift+Insert/Delete are clipboard commands, not DOS editor keys.
    if (event.shiftKey && (event.key === 'Insert' || event.key === 'Delete')) return;
    const key = dosKey(event);
    if (!key || (key >= 32 && key <= 126)) return;
    event.preventDefault();
    reset();
    onKey(key);
  };
  const beforeinput = event => {
    pendingType = !allowed(pendingType) ? pendingType : event.inputType || '';
    if (!allowed(pendingType)) {
      if (event.cancelable) {
        event.preventDefault();
        pendingType = '';
      } else if (composing) compositionAllowed = false;
      return;
    }
    if (composing || event.isComposing) return;
    const key = editKey(pendingType);
    if (key && event.cancelable) {
      event.preventDefault();
      pendingType = '';
      reset();
      onKey(key);
    }
  };
  const input = event => {
    const type = !allowed(pendingType) ? pendingType : event.inputType || pendingType;
    pendingType = '';
    if (!allowed(type)) {
      if (composing) compositionAllowed = false;
      else reset();
      return;
    }
    // The composition transaction owns all of its interim and final inputs.
    // In particular, a final input may arrive before compositionend.
    if (composing) return;
    if (event.isComposing || type === 'insertCompositionText' || type === 'insertFromComposition' || type === 'deleteCompositionText') {
      reset();
      return;
    }
    const text = element.value;
    reset();
    const key = editKey(type);
    if (key) onKey(key);
    else emitText(text);
  };
  const compositionstart = () => {
    composing = true;
    compositionAllowed = true;
    pendingType = '';
  };
  const compositionend = event => {
    composing = false;
    pendingType = '';
    // compositionend.data is the committed text (empty when cancelled).
    // Reset before any trailing input: its data is not another insertion.
    const text = event.data || '';
    reset();
    if (compositionAllowed) emitText(text);
    compositionAllowed = true;
  };
  const discard = event => {
    event.preventDefault();
    pendingType = event.defaultPrevented ? '' : 'insertFromPaste';
  };
  const blur = () => {
    generation++;
    composing = false;
    compositionAllowed = false;
    pendingType = '';
    reset();
  };
  const listeners = { keydown, beforeinput, input, compositionstart, compositionend, paste: discard, drop: discard, blur };
  reset();
  for (const [type, listener] of Object.entries(listeners)) element.addEventListener(type, listener);
  const cleanup = () => {
    for (const [type, listener] of Object.entries(listeners)) element.removeEventListener(type, listener);
    element.value = '';
  };
  cleanup.flush = blur;
  return cleanup;
}
