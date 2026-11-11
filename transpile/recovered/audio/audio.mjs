// MarioTea/MARIO/MARIO.EXE SHA256
// 6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e.
// Addresses are executable FILE offsets. Drivers are unsupported and never run.
const i16 = n => (n << 16) >> 16;
export const AUDIO_BITS = Object.freeze({ music: 1, effects: 2, speech: 4 });
export const SPEECH_NAMES = Object.freeze(['ready', 'toobad', 'congrats', 'welcome']);

// These are selected driver handles, NOT a claim that a synthesized sound is
// still audible. The source flags survive driver completion until a stop call.
export class SourceAudio {
  constructor({ options, musicDevice, effectsDevice, speechDevice, available, effectOverride = null }) {
    if (![options, musicDevice, effectsDevice, speechDevice].every(Number.isInteger)
        || !available || !['music', 'effects', 'speech'].every(k => typeof available[k] === 'boolean')
        || (effectOverride !== null && !Number.isInteger(effectOverride))) {
      throw new TypeError('Explicit source options, device selections and availability required');
    }
    this.options = options & 0xffff;
    this.musicDevice = musicDevice;
    this.effectsDevice = effectsDevice;
    this.speechDevice = speechDevice;
    this.available = { ...available };
    this.effectOverride = effectOverride;
    this.musicHandle = null;
    this.effectHandle = null;
    this.blocked = null;
    this.serial = 0;
  }

  // Raw config write. S/G XORs at 11583/1158a do not stop current playback.
  setOptions(options) { this.options = options & 0xffff; }

  request(request) {
    if (!request || !['music', 'effect', 'speech', 'stop-music', 'stop-effects'].includes(request.type)) {
      throw new TypeError('Unknown source audio request');
    }
    // 18a95..18bfb waits synchronously for VOC playback. The source caller
    // cannot issue another request in that interval. No fabricated priority queue.
    if (this.blocked !== null) return { status: 'blocked', blocking: true, actions: [] };
    const actions = [];
    const stopEffects = () => {
      if (this.effectHandle !== null) actions.push({ type: 'stop', channel: 'effects', file: 0x18f8f });
      this.effectHandle = null;
    };
    const stopMusic = () => {
      if (this.musicHandle !== null) actions.push({ type: 'stop', channel: 'music', file: 0x18a49 });
      this.musicHandle = null;
    };
    const result = status => ({ status, blocking: false, actions });
    if (request.type === 'stop-music') { stopMusic(); return result('stopped'); }
    if (request.type === 'stop-effects') { stopEffects(); return result('stopped'); }
    if (request.type === 'effect') {
      let id = i16(this.effectOverride === null ? request.id : this.effectOverride);
      // 18e26..18e4e: correct1 and wrong11 bypass the Effects option;
      // wrong11 then aliases resource10. They do not require Speech or Music.
      if (id !== 1 && id !== 11 && !(this.options & AUDIO_BITS.effects)) return result('disabled');
      if (id === 11) id = 10;
      if (!this.available.effects) return result('unavailable');
      if (id < 1 || id > 10) return result('invalid');
      stopEffects(); // 18e74..18e88, always stop previous before starting new.
      this.effectHandle = id;
      const suffix = this.effectsDevice === 5 ? 'RLD' : [2, 3, 4, 6, 7].includes(this.effectsDevice) ? 'ADL' : 'PCS';
      actions.push({ type: 'request', channel: 'effects', id, resource: `SFX${String(id).padStart(2, '0')}.${suffix}`,
        playback: 'unsupported-silent', file: 0x18dcd });
      return result('requested');
    }
    if (request.type === 'music') {
      if (!(this.options & AUDIO_BITS.music)) return result('disabled');
      if (!this.available.music) return result('unavailable');
      stopMusic(); // 18928 precedes the 1..4 range test, even for invalid id.
      const id = i16(request.id);
      if (id < 1 || id > 4) return result('invalid');
      stopEffects(); // 18941, music preempts effects, not the reverse.
      this.musicHandle = id;
      const resource = this.musicDevice === 1 ? `ATYP${id}.PC`
        : this.musicDevice === 5 ? `RTYP${id}.XMI` : `ATYP${id}.XMI`;
      actions.push({ type: 'request', channel: 'music', id, resource,
        playback: 'unsupported-silent', file: 0x188d9 });
      return result('requested');
    }
    if (!SPEECH_NAMES.includes(request.name)) throw new TypeError('Unknown speech clip');
    if (!this.available.speech || this.speechDevice === 0) return result('unavailable');
    if (!(this.options & AUDIO_BITS.speech)) return result('disabled');
    // 18d71..18da8: RS software speech must not share the PC speaker device.
    if (this.speechDevice === 1 && (this.musicDevice === 1 || this.effectsDevice === 1)) {
      return result('device-conflict');
    }
    const token = ++this.serial;
    this.blocked = token;
    actions.push({ type: 'request', channel: 'speech', name: request.name,
      resource: request.name.toUpperCase() + (this.speechDevice === 1 ? '.RS' : '.VOC'),
      playback: this.speechDevice === 1 ? 'unsupported-silent' : 'pcm', file: 0x18d22 });
    // VOC streaming drains the keyboard inside its busy wait and on return
    // (18ba1,18be4). RS takes a different path with no such drain here.
    return { status: 'requested', blocking: true, token, actions,
      inputPolicy: this.speechDevice === 1 ? 'unchanged' : 'drain-until-return' };
  }

  complete(token) {
    if (this.blocked === null || token !== this.blocked) throw new Error('Stale speech completion');
    this.blocked = null;
  }

  // 11516..1158f. Only menu M immediately starts/stops music2.
  toggleMenuOption(bit) {
    if (![1, 2, 4].includes(bit)) throw new RangeError('Unknown audio option bit');
    if (this.blocked !== null) return { status: 'blocked', blocking: true, actions: [] };
    this.options ^= bit;
    if (bit === 1) return this.request(this.options & 1 ? { type: 'music', id: 2 } : { type: 'stop-music' });
    return { status: 'option-changed', blocking: false, actions: [] };
  }
}

// Existing world effect names are adapted here, but finger-hint operations
// 1101/1103 at 18019 are intentionally NOT audio. 'audio-reset' is music stop,
// not a guessed all-channel stop. Do not feed unrelated presentation effects.
export function sourceRequest(effect) {
  switch (effect.type) {
    case 'correct': return { type: 'effect', id: 1 };
    case 'wrong': return { type: 'effect', id: 11 };
    case 'sound': return { type: 'effect', id: effect.id };
    case 'music': return { type: 'music', id: effect.operation };
    case 'audio-reset': return { type: 'stop-music' };
    case 'ready': return { type: 'speech', name: 'ready' };
    case 'speech': return { type: 'speech', name: effect.name };
    default: return null;
  }
}
