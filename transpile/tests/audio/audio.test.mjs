import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { SourceAudio, sourceRequest } from '../../recovered/audio/audio.mjs';
import { BrowserAudio } from '../../app/audio.mjs';

const source = (fields = {}) => new SourceAudio({ options: 7, musicDevice: 3, effectsDevice: 3,
  speechDevice: 3, available: { music: true, effects: true, speech: true }, ...fields });
const effect = id => ({ type: 'effect', id });
const music = id => ({ type: 'music', id });
const speech = name => ({ type: 'speech', name });
const actions = decision => decision.actions.map(a => [a.type, a.channel, a.id ?? a.name]);

class FakeContext {
  constructor() { this.state = 'suspended'; this.nodes = []; this.listeners = []; this.destination = {}; }
  addEventListener(type, listener) { assert.equal(type, 'statechange'); this.listeners.push(listener); }
  async resume() { if (this.rejectResume) throw new Error('NotAllowedError'); this.state = 'running'; }
  createBuffer(channels, count, rate) {
    assert.equal(channels, 1);
    const samples = new Float32Array(count);
    this.buffer = { channels, count, rate, getChannelData: channel => { assert.equal(channel, 0); return samples; } };
    return this.buffer;
  }
  createBufferSource() {
    const node = { connect() {}, disconnect() { this.disconnected = true; },
      start: () => { if (this.rejectStart) throw new Error('NotAllowedError'); },
      stop() { this.stopped = true; this.onended?.(); },
      end() { this.onended?.(); } };
    this.nodes.push(node);
    return node;
  }
  suspend() { this.state = 'suspended'; this.listeners.forEach(l => l()); }
  async close() { this.state = 'closed'; this.listeners.forEach(l => l()); }
}
const gesture = { type: 'pointerdown', isTrusted: true };
function transport() {
  const context = new FakeContext();
  let creates = 0;
  const player = new BrowserAudio({ createContext: () => { creates++; return context; } });
  const pcm = new Uint8Array([0, 127, 128, 255]);
  const metadata = { encoding: 'unsigned-8', channels: 1, sampleCount: 4, rateNumerator: 1_000_000, rateDenominator: 56 };
  player.register('ready', pcm, metadata);
  return { player, context, pcm, metadata, creates: () => creates };
}


for (const outcome of ['unlocked', 'denied', 'muted', 'suspended']) {
  test(`first gesture Ready waits for current unlock: ${outcome}`, async () => {
    const { player, context, creates } = transport();
    let resume, resumes = 0;
    context.resume = () => { resumes++; return new Promise(resolve => { resume = resolve; }); };
    // Natural startup's locked welcome is already omitted, not retained.
    const audio = source();
    const welcome = audio.request(speech('welcome'));
    assert.deepEqual(await player.perform(welcome), [{ channel: 'speech', status: 'locked' }]);
    audio.complete(welcome.token);
    const unlocking = player.unlock({ type: 'keydown', isTrusted: true });
    assert.equal(player.unlock(gesture), unlocking);
    assert.equal(creates(), 1); assert.equal(resumes, 1);
    const ready = audio.request(speech('ready'));
    let settled = false;
    const playback = player.perform(ready).then(result => { settled = true; return result; });
    await Promise.resolve(); assert.equal(settled, false); assert.equal(context.nodes.length, 0);
    if (outcome === 'muted') player.setMuted(true);
    if (outcome === 'suspended') context.suspend();
    if (['muted', 'suspended'].includes(outcome)) {
      assert.deepEqual(await playback, [{ channel: 'speech', status: outcome }]);
      audio.complete(ready.token); // Cancellation settles even if resume never resolves.
    }
    context.state = outcome === 'denied' ? 'suspended' : 'running'; resume();
    await unlocking; await Promise.resolve();
    if (outcome === 'unlocked') {
      assert.equal(settled, false); assert.equal(context.nodes.length, 1);
      context.nodes[0].end();
      assert.deepEqual(await playback, [{ channel: 'speech', status: 'ended' }]);
      audio.complete(ready.token);
    } else if (outcome === 'denied') {
      assert.deepEqual(await playback, [{ channel: 'speech', status: 'denied' }]);
      audio.complete(ready.token);
    }
    player.setMuted(false);
    assert.equal(context.nodes.length, outcome === 'unlocked' ? 1 : 0);
    assert.equal(player.unlockInFlight, null);
  });
}

const manifestUrl = new URL('../../assets/audio/manifest.json', import.meta.url);
test('actual decoder manifest and every output sample are accepted without resampling',
  { skip: !existsSync(manifestUrl) && 'run tools/audio/decode.py with owner-supplied archive' }, async () => {
    const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));
    assert.equal(manifest.format, 'mario-audio-pcm-v1');
    let total = 0;
    for (const [name, metadata] of Object.entries(manifest.clips)) {
      assert.equal(metadata.path, `${name}.pcm`);
      const pcm = new Uint8Array(readFileSync(new URL(`../../assets/audio/${metadata.path}`, import.meta.url)));
      const { player, context } = transport();
      player.register(name, pcm, metadata);
      await player.unlock(gesture);
      const done = player.play(name);
      assert.equal(context.buffer.rate, 1_000_000 / 56);
      assert.equal(context.buffer.count, metadata.sampleCount);
      const floats = context.buffer.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) assert.equal(floats[i] * 128 + 128, pcm[i]);
      total += floats.length; context.nodes[0].end();
      assert.equal((await done).status, 'ended');
    }
    assert.equal(total, 158254);
  });

test('source configuration is explicit, no fabricated hardware detection', () => {
  assert.throws(() => new SourceAudio({ options: 7 }), TypeError);
  assert.throws(() => source({ effectOverride: '1' }), TypeError);
});

test('effects1 and11 bypass bit2 for every option combination;11 aliases10', () => {
  for (let options = 0; options < 8; options++) {
    const audio = source({ options });
    assert.equal(audio.request(effect(1)).status, 'requested');
    const wrong = audio.request(effect(11));
    assert.deepEqual(actions(wrong), [['stop', 'effects', undefined], ['request', 'effects', 10]]);
    assert.equal(wrong.actions[1].resource, 'SFX10.ADL');
    assert.equal(audio.request(effect(2)).status, options & 2 ? 'requested' : 'disabled');
    assert.equal(audio.request(music(1)).status, options & 1 ? 'requested' : 'disabled');
    const spoken = audio.request(speech('ready'));
    assert.equal(spoken.status, options & 4 ? 'requested' : 'disabled');
    if (spoken.blocking) audio.complete(spoken.token);
  }
});

test('last effect stops its predecessor, music stops music then effects; no numerical priority', () => {
  const audio = source();
  audio.request(music(1)); audio.request(effect(9));
  assert.deepEqual(actions(audio.request(effect(1))), [['stop', 'effects', undefined], ['request', 'effects', 1]]);
  assert.equal(audio.musicHandle, 1); // No wrapper music-stop in effect routine.
  assert.deepEqual(actions(audio.request(music(3))), [
    ['stop', 'music', undefined], ['stop', 'effects', undefined], ['request', 'music', 3],
  ]);
  assert.equal(audio.effectHandle, null);
  assert.deepEqual(actions(audio.request({ type: 'stop-music' })), [['stop', 'music', undefined]]);
  assert.equal(audio.request({ type: 'stop-music' }).actions.length, 0);
});

test('invalid music stops prior music before range test but does not stop effects', () => {
  const audio = source(); audio.request(music(2)); audio.request(effect(4));
  const result = audio.request(music(5));
  assert.equal(result.status, 'invalid');
  assert.deepEqual(actions(result), [['stop', 'music', undefined]]);
  assert.equal(audio.effectHandle, 4);
  assert.equal(audio.request(effect(12)).status, 'invalid');
  assert.equal(audio.effectHandle, 4);
});

test('unavailable and disabled requests leave selected handles alone; KWD1 explicit override', () => {
  const audio = source(); audio.request(music(1)); audio.request(effect(4));
  audio.setOptions(0);
  assert.equal(audio.request(music(2)).status, 'disabled');
  assert.equal(audio.request(effect(4)).status, 'disabled');
  assert.equal(audio.musicHandle, 1); assert.equal(audio.effectHandle, 4);
  audio.available.effects = false;
  assert.equal(audio.request(effect(1)).status, 'unavailable');
  assert.equal(audio.effectHandle, 4);
  const override = source({ effectOverride: 11, options: 0 });
  assert.equal(override.request(effect(2)).actions[0].id, 10);
});

test('device selectors bind exact existing music and effect filenames, not decoded PCM', () => {
  for (const [device, track, suffix] of [[1, 'ATYP4.PC', 'PCS'], [2, 'ATYP4.XMI', 'ADL'],
    [3, 'ATYP4.XMI', 'ADL'], [4, 'ATYP4.XMI', 'ADL'], [5, 'RTYP4.XMI', 'RLD'],
    [6, 'ATYP4.XMI', 'ADL'], [7, 'ATYP4.XMI', 'ADL'], [8, 'ATYP4.XMI', 'PCS']]) {
    const audio = source({ musicDevice: device, effectsDevice: device });
    assert.equal(audio.request(music(4)).actions.at(-1).resource, track);
    assert.equal(audio.request(effect(6)).actions.at(-1).resource, `SFX06.${suffix}`);
  }
});

test('source speech is blocking and does not preempt synth handles or allow reentry', () => {
  const audio = source(); audio.request(music(2)); audio.request(effect(5));
  const ready = audio.request(speech('ready'));
  assert.equal(ready.blocking, true);
  assert.equal(ready.inputPolicy, 'drain-until-return');
  assert.deepEqual(actions(ready), [['request', 'speech', 'ready']]);
  assert.equal(ready.actions[0].resource, 'READY.VOC');
  for (const request of [music(1), effect(11), speech('welcome'), { type: 'stop-music' }]) {
    assert.equal(audio.request(request).status, 'blocked');
  }
  assert.equal(audio.toggleMenuOption(1).status, 'blocked');
  assert.equal(audio.options, 7);
  assert.equal(audio.musicHandle, 2); assert.equal(audio.effectHandle, 5);
  assert.throws(() => audio.complete(ready.token + 1), /Stale/);
  audio.complete(ready.token);
  const welcome = audio.request(speech('welcome'));
  assert.notEqual(welcome.token, ready.token);
  assert.throws(() => audio.complete(ready.token), /Stale/);
  audio.complete(welcome.token);
  assert.throws(() => audio.complete(welcome.token), /Stale/);
});

test('RS speech conflict gates PC speaker and remains explicitly unsupported otherwise', () => {
  for (const config of [{ musicDevice: 1 }, { effectsDevice: 1 }]) {
    assert.equal(source({ speechDevice: 1, ...config }).request(speech('ready')).status, 'device-conflict');
  }
  const result = source({ speechDevice: 1 }).request(speech('ready'));
  assert.equal(result.inputPolicy, 'unchanged');
  assert.equal(result.actions[0].resource, 'READY.RS');
  assert.equal(result.actions[0].playback, 'unsupported-silent');
  assert.equal(source({ speechDevice: 0 }).request(speech('ready')).status, 'unavailable');
  assert.equal(source({ available: { music: false, effects: false, speech: false } }).request(speech('ready')).status, 'unavailable');
});

test('menu M acts immediately; S and G only change future request gates', () => {
  const audio = source(); audio.request(music(1)); audio.request(effect(3));
  assert.deepEqual(actions(audio.toggleMenuOption(1)), [['stop', 'music', undefined]]);
  assert.equal(audio.effectHandle, 3);
  assert.deepEqual(actions(audio.toggleMenuOption(1)), [['stop', 'effects', undefined], ['request', 'music', 2]]);
  audio.request(effect(4));
  assert.equal(audio.toggleMenuOption(2).actions.length, 0);
  assert.equal(audio.effectHandle, 4);
  assert.equal(audio.toggleMenuOption(4).actions.length, 0);
  assert.throws(() => audio.toggleMenuOption(8), RangeError);
});

test('world adapter does not confuse finger drawing or music reset with speech/all-channel stop', () => {
  assert.deepEqual(sourceRequest({ type: 'correct' }), effect(1));
  assert.deepEqual(sourceRequest({ type: 'wrong' }), effect(11));
  assert.deepEqual(sourceRequest({ type: 'sound', id: 7 }), effect(7));
  assert.deepEqual(sourceRequest({ type: 'ready' }), speech('ready'));
  assert.deepEqual(sourceRequest({ type: 'music', operation: 4 }), music(4));
  assert.deepEqual(sourceRequest({ type: 'audio-reset' }), { type: 'stop-music' });
  assert.deepEqual(sourceRequest({ type: 'speech', name: 'congrats' }), speech('congrats'));
  assert.equal(sourceRequest({ type: 'prompt', code: 65 }), null);
  assert.equal(sourceRequest({ type: 'prompt-stop' }), null);
});

test('transport creates/resumes nothing until explicit trusted gesture, no backlog', async () => {
  const { player, creates, context } = transport();
  assert.deepEqual(await player.play('ready'), { status: 'locked' });
  for (const event of [undefined, { type: 'click', isTrusted: false }, { type: 'load', isTrusted: true }]) {
    assert.equal((await player.unlock(event)).status, 'gesture-required');
  }
  assert.equal(creates(), 0);
  assert.equal((await player.unlock(gesture)).status, 'unlocked');
  assert.equal(creates(), 1); assert.equal(context.nodes.length, 0);
});

test('PCM conversion preserves all samples at exact nominal rate and owns input bytes', async () => {
  const { player, context, pcm } = transport(); pcm.fill(128);
  await player.unlock(gesture);
  const done = player.play('ready');
  assert.equal(context.buffer.count, 4); assert.equal(context.buffer.rate, 1_000_000 / 56);
  assert.deepEqual([...context.buffer.getChannelData(0)], [-1, -1 / 128, 0, 127 / 128]);
  assert.equal((await player.play('ready')).status, 'busy'); // Never silently replace speech.
  context.nodes[0].end();
  assert.equal((await done).status, 'ended'); assert.equal(player.active, null);
  assert.equal(context.nodes[0].disconnected, true);
});

test('autoplay rejection is visible, retry requires another gesture and never replays', async () => {
  const { player, context } = transport(); context.rejectResume = true;
  assert.equal((await player.unlock(gesture)).status, 'denied');
  assert.equal((await player.play('ready')).status, 'denied');
  assert.equal(context.nodes.length, 0);
  context.rejectResume = false;
  assert.equal((await player.unlock(gesture)).status, 'unlocked');
  assert.equal(context.nodes.length, 0);
  context.rejectStart = true;
  assert.equal((await player.play('ready')).status, 'denied');
  assert.equal(player.active, null);
});

test('host mute cancels active speech and settles once, unmute never replays', async () => {
  const { player, context } = transport(); await player.unlock(gesture);
  const done = player.play('ready'); player.setMuted(true);
  assert.equal((await done).status, 'muted'); assert.equal(context.nodes[0].stopped, true);
  assert.equal((await player.play('ready')).status, 'muted');
  player.setMuted(false); assert.equal(context.nodes.length, 1);
  const next = player.play('ready'); context.nodes[1].end(); assert.equal((await next).status, 'ended');
});

test('host suspend/close settle speech rather than indefinitely blocking caller', async () => {
  const { player, context } = transport(); await player.unlock(gesture);
  const done = player.play('ready'); context.suspend();
  assert.equal((await done).status, 'suspended'); assert.equal(player.state, 'denied');
  await player.unlock(gesture);
  const next = player.play('ready'); await player.close();
  assert.equal((await next).status, 'closed'); assert.equal(player.state, 'closed');
});

test('missing clip and malformed registration are visible, no synthesized substitutes', async () => {
  const { player, pcm, metadata } = transport(); await player.unlock(gesture);
  assert.equal((await player.play('welcome')).status, 'missing');
  for (const changed of [{ channels: 2 }, { encoding: 'signed-16' }, { sampleCount: 3 }, { rateDenominator: 57 }]) {
    assert.throws(() => player.register('ready', pcm, { ...metadata, ...changed }), TypeError);
  }
  assert.throws(() => player.register('arbitrary', pcm, metadata), TypeError);
});

test('source and browser serialize ready before next music; denied/RS omission needs completion', async () => {
  const { player, context } = transport(); await player.unlock(gesture);
  const audio = source(); const ready = audio.request(speech('ready'));
  const playback = player.perform(ready);
  assert.equal(audio.request(music(3)).status, 'blocked');
  context.nodes[0].end();
  assert.deepEqual(await playback, [{ channel: 'speech', status: 'ended' }]);
  audio.complete(ready.token);
  assert.deepEqual(await player.perform(audio.request(music(3))), [{ channel: 'music', status: 'unsupported-silent' }]);
  const rsAudio = source({ speechDevice: 1 }); const rs = rsAudio.request(speech('ready'));
  assert.deepEqual(await player.perform(rs), [{ channel: 'speech', status: 'unsupported-silent' }]);
  assert.notEqual(rsAudio.blocked, null); rsAudio.complete(rs.token);
  const locked = new BrowserAudio(); const denied = audio.request(speech('ready'));
  assert.deepEqual(await locked.perform(denied), [{ channel: 'speech', status: 'locked' }]);
  assert.equal(audio.request(effect(1)).status, 'blocked'); audio.complete(denied.token);
});
