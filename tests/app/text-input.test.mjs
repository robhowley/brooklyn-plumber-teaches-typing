import test from 'node:test';
import assert from 'node:assert/strict';
import { bindTextInput } from '../../app/text-input.mjs';
import { dosKey } from '../../app/session.mjs';

class Textarea extends EventTarget {
  value = '';
  selectionStart = 0;
  selectionEnd = 0;
  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }
  fire(type, properties = {}, cancelable = true) {
    const event = new Event(type, { cancelable });
    Object.assign(event, properties);
    this.dispatchEvent(event);
    return event;
  }
  // Simulate the browser's default edit, only if beforeinput was not cancelled.
  edit(inputType, text = '', { before = true, cancelable = true } = {}) {
    if (before && this.fire('beforeinput', { inputType, data: text }, cancelable).defaultPrevented) return;
    if (inputType === 'deleteContentBackward') this.value = this.value.slice(0, -1);
    else if (inputType === 'deleteContentForward') this.value = this.value.slice(1);
    else if (inputType === 'insertLineBreak' || inputType === 'insertParagraph') this.value += '\n';
    else this.value += text;
    this.fire('input', { inputType, data: text }, false);
  }
}
function fixture() {
  const element = new Textarea(), keys = [];
  const cleanup = bindTextInput(element, key => keys.push(key));
  const sentinel = element.value;
  const reset = () => {
    assert.equal(element.value, sentinel);
    assert.equal(element.selectionStart, sentinel.length);
    assert.equal(element.selectionEnd, sentinel.length);
  };
  return { element, keys, cleanup, sentinel, reset };
}
const codes = text => [...text].map(character => character.charCodeAt(0));

test('commits case, spaces and multiple ASCII characters from the value, not input.data', () => {
  const { element, keys, sentinel, reset } = fixture();
  assert.equal(sentinel.length, 1);
  element.fire('beforeinput', { inputType: 'insertText', data: 'not committed yet' });
  assert.deepEqual(keys, []);
  element.value += 'a B!';
  element.fire('input', { inputType: 'insertText', data: 'different metadata' });
  assert.deepEqual(keys, codes('a B!'));
  reset();
  element.edit('insertText', 'z');
  assert.deepEqual(keys, codes('a B!z'));
  reset();
});

test('input works without beforeinput, inputType, or printable keydown', () => {
  const { element, keys, reset } = fixture();
  element.edit('insertText', 'AB', { before: false });
  element.value += ' C';
  element.fire('input');
  assert.deepEqual(keys, codes('AB C'));
  reset();
});

test('hardware printable keydown and Android unidentified events never double-score text', () => {
  const { element, keys } = fixture();
  for (const properties of [{ key: 'a' }, { key: 'Unidentified', keyCode: 229 }, { key: 'Process', keyCode: 229 }, { key: 'ArrowLeft', keyCode: 229 }]) {
    assert.equal(element.fire('keydown', properties).defaultPrevented, false);
    assert.deepEqual(keys, []);
  }
  element.edit('insertText', 'a');
  assert.deepEqual(keys, [97]);
});

for (const type of ['deleteContentBackward', 'deleteContentForward', 'insertLineBreak', 'insertParagraph']) {
  for (const options of [{}, { cancelable: false }, { before: false }]) {
    test(`${type} repeats after reset with ${JSON.stringify(options)}`, () => {
      const { element, keys, reset } = fixture();
      for (let index = 0; index < 3; index++) {
        element.edit(type, '', options);
        reset();
      }
      const code = { deleteContentBackward: 8, deleteContentForward: 0x153, insertLineBreak: 13, insertParagraph: 13 }[type];
      assert.deepEqual(keys, [code, code, code]);
    });
  }
}

test('noncancelable beforeinput supplies edit metadata when input omits it', () => {
  const { element, keys, reset } = fixture();
  for (const inputType of ['deleteContentBackward', 'insertParagraph']) {
    element.fire('keydown', { key: 'Unidentified', keyCode: 229 });
    element.fire('beforeinput', { inputType }, false);
    element.value = inputType === 'deleteContentBackward' ? '' : '\n';
    element.fire('input');
    reset();
  }
  assert.deepEqual(keys, [8, 13]);
});

test('hardware Backspace and Enter defer to their single native edit', () => {
  const { element, keys } = fixture();
  for (const [key, inputType] of [['Backspace', 'deleteContentBackward'], ['Enter', 'insertLineBreak']]) {
    assert.equal(element.fire('keydown', { key }).defaultPrevented, false);
    element.edit(inputType);
  }
  assert.deepEqual(keys, [8, 13]);
});

test('actual newlines map to Enter and unsupported characters are discarded without transliteration', () => {
  const { element, keys, reset } = fixture();
  element.edit('insertText', 'a\r\nb\rc\né中🙂\t\u007f\u0000Z');
  assert.deepEqual(keys, [97, 13, 98, 13, 99, 13, 90]);
  reset();
});

test('control keydown reuses DOS mapping and leaves clipboard/browser shortcuts alone', () => {
  const { element, keys, reset } = fixture();
  for (const key of ['Escape', 'Tab', 'Delete', 'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'F1', 'F10']) {
    assert.equal(element.fire('keydown', { key }).defaultPrevented, true);
    assert.equal(keys.at(-1), dosKey({ key }));
    reset();
  }
  const count = keys.length;
  for (const modifier of ['ctrlKey', 'metaKey']) {
    for (const key of ['a', 'c', 'v', 'x', 'z']) {
      assert.equal(element.fire('keydown', { key, [modifier]: true }).defaultPrevented, false);
    }
  }
  for (const key of ['Insert', 'Delete']) {
    assert.equal(element.fire('keydown', { key, shiftKey: true }).defaultPrevented, false);
  }
  assert.equal(keys.length, count);
  assert.equal(element.fire('keydown', { key: 'x', altKey: true }).defaultPrevented, true);
  assert.equal(keys.at(-1), 0x12d);
});

for (const order of ['input-before-end', 'input-after-end', 'from-composition-after-end', 'composition-text-after-end', 'composing-input-after-end']) {
  test(`composition commits once with ${order}, never partial syllables`, () => {
    const { element, keys, sentinel, reset } = fixture();
    element.fire('compositionstart');
    for (const text of ['A', 'Ab']) {
      element.value = sentinel + text;
      element.fire('input', { inputType: 'insertCompositionText', data: text, isComposing: true });
    }
    assert.equal(element.fire('keydown', { key: 'Enter' }).defaultPrevented, false);
    assert.deepEqual(keys, []);
    if (order === 'input-before-end') {
      element.fire('input', { inputType: 'insertText', data: 'Ab', isComposing: false });
    }
    element.fire('compositionend', { data: 'Ab' });
    if (order === 'input-after-end') {
      // The native value mutation preceded compositionend; notification follows.
      element.fire('input', { inputType: 'insertText', data: 'Ab', isComposing: false });
    } else if (order === 'from-composition-after-end') {
      element.edit('insertFromComposition', 'Ab');
    } else if (order === 'composition-text-after-end') {
      element.edit('insertCompositionText', 'Ab', { before: false });
    } else if (order === 'composing-input-after-end') {
      element.value += 'Ab';
      element.fire('input', { inputType: 'insertText', data: 'Ab', isComposing: true });
    }
    assert.deepEqual(keys, codes('Ab'));
    reset();
    // An immediately repeated character or composition is new input, not a duplicate.
    element.edit('insertText', 'b');
    element.fire('compositionstart');
    element.value += 'Ab';
    element.fire('compositionend', { data: 'Ab' });
    assert.deepEqual(keys, codes('AbbAb'));
    reset();
  });
}

test('cancelled and unsupported compositions do not score intermediate ASCII', () => {
  const { element, keys, reset } = fixture();
  for (const data of ['', 'é中🙂']) {
    element.fire('compositionstart');
    element.value += 'pinyin';
    element.fire('input', { inputType: 'insertCompositionText', isComposing: true });
    element.fire('compositionend', { data });
    assert.deepEqual(keys, []);
    reset();
  }
  element.edit('insertText', 'A');
  assert.deepEqual(keys, [65]);
});

for (const type of ['insertFromPaste', 'insertFromDrop', 'insertReplacementText', 'insertFromYank', 'historyUndo', 'deleteWordBackward', 'deleteByCut']) {
  for (const options of [{}, { cancelable: false }, { before: false }]) {
    test(`discards ${type} with ${JSON.stringify(options)}`, () => {
      const { element, keys, reset } = fixture();
      element.edit(type, 'free words', options);
      assert.deepEqual(keys, []);
      reset();
      element.edit('insertText', 'x');
      assert.deepEqual(keys, [120]);
    });
  }
}

test('noncancelable beforeinput rejection survives missing or less precise input metadata', () => {
  const { element, keys, reset } = fixture();
  for (const properties of [{}, { inputType: 'insertText' }]) {
    element.fire('beforeinput', { inputType: 'insertReplacementText' }, false);
    element.value += 'autocompleted';
    element.fire('input', properties);
    assert.deepEqual(keys, []);
    reset();
  }
});

test('paste/drop are prevented without hijacking shortcut keydown', () => {
  const { element, keys, reset } = fixture();
  for (const type of ['paste', 'drop']) {
    assert.equal(element.fire(type).defaultPrevented, true);
    assert.deepEqual(keys, []);
    reset();
  }
});

test('noncancelable paste/drop with no input metadata is discarded', () => {
  const { element, keys, reset } = fixture();
  for (const type of ['paste', 'drop']) {
    for (const properties of [{}, { inputType: 'insertText' }]) {
      element.fire(type, {}, false);
      element.value += 'words';
      element.fire('input', properties);
      assert.deepEqual(keys, []);
      reset();
    }
  }
});

test('noncancelable paste remains rejected through a less precise beforeinput', () => {
  const { element, keys, reset } = fixture();
  element.fire('paste', {}, false);
  assert.equal(element.fire('beforeinput', { inputType: 'insertText' }).defaultPrevented, true);
  assert.deepEqual(keys, []);
  reset();
  element.edit('insertText', 'a');
  assert.deepEqual(keys, [97]);
});

test('replacement during composition and blur cannot commit stale text', () => {
  const { element, keys, reset } = fixture();
  element.fire('compositionstart');
  element.edit('insertReplacementText', 'word', { cancelable: false });
  element.fire('compositionend', { data: 'word' });
  assert.deepEqual(keys, []);
  reset();
  element.fire('compositionstart');
  element.value += 'unfinished';
  element.fire('blur');
  element.fire('compositionend', { data: 'unfinished' });
  assert.deepEqual(keys, []);
  reset();
  element.fire('compositionstart');
  element.fire('compositionend', { data: 'new' });
  assert.deepEqual(keys, codes('new'));
});

test('host flush cancels composition and the remainder of a screen-changing commit', () => {
  const { element, keys, cleanup, reset } = fixture();
  element.fire('compositionstart');
  element.value += 'stale';
  cleanup.flush();
  element.fire('compositionend', { data: 'stale' });
  assert.deepEqual(keys, []);
  reset();
  element.edit('insertText', 'new');
  assert.deepEqual(keys, codes('new'));
  const other = new Textarea(), delivered = [];
  const binding = bindTextInput(other, key => { delivered.push(key); binding.flush(); });
  other.edit('insertText', 'wBOB');
  assert.deepEqual(delivered, [119]);
});

test('cleanup removes every listener and clears the adapter value', () => {
  const { element, keys, cleanup } = fixture();
  cleanup();
  cleanup();
  assert.equal(element.value, '');
  element.fire('keydown', { key: 'Escape' });
  assert.equal(element.fire('beforeinput', { inputType: 'insertLineBreak' }).defaultPrevented, false);
  assert.equal(element.fire('paste').defaultPrevented, false);
  assert.equal(element.fire('drop').defaultPrevented, false);
  element.fire('compositionstart');
  element.value = 'unchanged';
  element.fire('compositionend', { data: 'text' });
  element.fire('input', { inputType: 'insertText' });
  element.fire('blur');
  assert.deepEqual(keys, []);
  assert.equal(element.value, 'unchanged');
});
