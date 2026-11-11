// Browser transport only. No fetches, oscillators, speech synthesis or drivers.
// The host supplies locally decoded unsigned-8 PCM and a trusted input event.
import { SPEECH_NAMES } from '../recovered/audio/audio.mjs';

export class BrowserAudio {
  constructor({ createContext = () => new globalThis.AudioContext(), onState = () => {} } = {}) {
    this.createContext = createContext;
    this.onState = onState;
    this.context = null;
    this.clips = new Map();
    this.active = null;
    this.muted = false;
    this.state = 'locked';
    this.unlockInFlight = null;
    this.waitingUnlock = null;
  }

  changeState(state) { this.state = state; this.onState(state); }

  // Call directly inside the browser's input handler, before any await.
  unlock(event) {
    if (!event?.isTrusted || !['pointerdown', 'click', 'keydown', 'touchend'].includes(event.type)) {
      return Promise.resolve({ status: 'gesture-required' });
    }
    if (this.unlockInFlight) return this.unlockInFlight;
    if (this.state === 'unlocked' && this.context?.state === 'running') {
      return Promise.resolve({ status: 'unlocked' });
    }
    const unlocking = (async () => {
      try {
        if (!this.context) {
          this.context = this.createContext();
          this.context.addEventListener('statechange', () => {
            if (this.context.state !== 'running') {
              this.stop('suspended');
              this.changeState(this.context.state === 'closed' ? 'closed' : 'denied');
            }
          });
        }
        await this.context.resume();
        if (this.context.state !== 'running') throw new Error('Audio context not running');
        this.changeState('unlocked');
        return { status: 'unlocked' };
      } catch {
        this.changeState('denied');
        return { status: 'denied' };
      }
    })();
    this.unlockInFlight = unlocking.then(result => {
      this.unlockInFlight = null;
      return result;
    });
    return this.unlockInFlight;
  }

  register(name, pcm, metadata) {
    if (!SPEECH_NAMES.includes(name) || !(pcm instanceof Uint8Array)
        || metadata?.encoding !== 'unsigned-8' || metadata.channels !== 1
        || metadata.rateNumerator !== 1_000_000 || metadata.rateDenominator !== 56
        || !Number.isInteger(metadata.sampleCount) || metadata.sampleCount < 1
        || metadata.sampleCount > 1_000_000 || pcm.length !== metadata.sampleCount) {
      throw new TypeError('Expected proven VOC mono unsigned-8 PCM and matching metadata');
    }
    this.clips.set(name, { pcm: pcm.slice(), sampleRate: 1_000_000 / 56 });
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.muted) this.stop('muted');
    // Host mute is separate from DOS option bits. Never replay missed requests.
  }

  stop(status = 'host-stopped') {
    this.waitingUnlock?.({ status });
    if (!this.active) return;
    const { node, finish } = this.active;
    finish(status); // Settle before stop(), which may synchronously emit ended in tests.
    try { node.stop(); } catch { /* Already ended/closed. */ }
  }

  play(name) {
    if (this.muted) return Promise.resolve({ status: 'muted' });
    if (this.state !== 'unlocked' || this.context?.state !== 'running') {
      return Promise.resolve({ status: this.state === 'denied' ? 'denied' : 'locked' });
    }
    const clip = this.clips.get(name);
    if (!clip) return Promise.resolve({ status: 'missing' });
    if (this.active) return Promise.resolve({ status: 'busy' }); // Not an interruption policy.
    return new Promise(resolve => {
      let node;
      const finish = status => {
        if (this.active?.node !== node) return;
        this.active = null;
        node.onended = null;
        node.disconnect();
        resolve({ status });
      };
      try {
        const buffer = this.context.createBuffer(1, clip.pcm.length, clip.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = (clip.pcm[i] - 128) / 128;
        node = this.context.createBufferSource();
        node.buffer = buffer;
        node.connect(this.context.destination);
        node.onended = () => finish('ended');
        this.active = { node, finish };
        node.start();
      } catch {
        if (this.active?.node === node) finish('denied');
        else resolve({ status: 'denied' });
        this.changeState('denied');
      }
    });
  }

  // Await this for a blocking SourceAudio decision, then call source.complete(token).
  // Even missing/denied/unsupported resources return a visible outcome, not a
  // fake source duration. Main must acknowledge that host omission explicitly.
  async perform(decision) {
    // Capture only the gesture already in flight at this blocking source call.
    // Earlier locked requests are omitted, never queued for a future gesture.
    const unlocking = decision.blocking && this.unlockInFlight;
    if (unlocking && !this.muted) {
      let finish;
      const result = await new Promise(resolve => {
        finish = resolve;
        this.waitingUnlock = finish;
        unlocking.then(finish);
      });
      if (this.waitingUnlock === finish) this.waitingUnlock = null;
      if (result.status !== 'unlocked') return [{ channel: 'speech', ...result }];
    }
    const outcomes = [];
    for (const action of decision.actions) {
      if (action.type === 'stop') {
        // Source stop actions target synth channels, which this transport omits.
        outcomes.push({ channel: action.channel, status: 'unsupported-silent' });
      } else if (action.playback === 'pcm' && action.channel === 'speech') {
        outcomes.push({ channel: 'speech', ...await this.play(action.name) });
      } else {
        outcomes.push({ channel: action.channel, status: 'unsupported-silent' });
      }
    }
    return outcomes;
  }

  async close() {
    this.stop('closed');
    try { await this.context?.close(); } finally { this.changeState('closed'); }
  }
}
