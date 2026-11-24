// Browser transport adaptation. Source: /MARIO/WINMARIO.EXE;1 SHA256
// 39a4fb53384afbfec13063c2f4c67d51013b1f8ea494788c88f1ac6c12f47f22,
// FILE 0x4e72..0x541e (audio slots/operations), 0x1df6c..0x1e001
// (MIDI success-only repeat). Movie selector joins/placement and member hashes
// are preserved in manifest.assets. No original program is executed.
// Audio selectors 1/5/7/8 are MIDI; selector10 is WAVE resource499.
// MIDI uses Web Audio oscillators, NOT the historical device waveform/bank.

function midiTimeline(data, tracks) {
  if (data.midi_format === 2) throw new Error('Independent MIDI sequences unsupported');
  const division = data.division;
  const smpte = division & 0x8000;
  const fps = 256 - (division >>> 8);
  const ticksPerSecond = (fps === 29 ? 30000 / 1001 : fps) * (division & 255);
  if (!division || (smpte && !ticksPerSecond)) throw new Error('Invalid MIDI division');
  const events = tracks.flatMap((t, track) => t.events.map((e, order) => ({...e, track, order})))
    .sort((a, b) => a.tick - b.tick || a.track - b.track || a.order - b.order);
  let tick = 0, time = 0, tempo = 500000;
  for (const event of events) {
    time += (event.tick - tick) * (smpte ? 1 / ticksPerSecond : tempo / 1000000 / division);
    tick = event.tick;
    event.time = time;
    if (event.meta_type === 81) tempo = event.microseconds_per_quarter;
  }
  return {events, duration: time};
}

// A small, explicitly approximate synthesizer. Channel program, volume,
// expression, pan, bend, sustain and note release affect scheduled voices.
function synth(context, clip, timeline, origin) {
  const channels = Array.from({length:16}, () => ({program:0, volume:100, expression:127,
    pan:64, bend:8192, sustain:false, voices:[]}));
  function release(voice, time) {
    if (voice.stopped) return;
    voice.stopped = true;
    voice.gain.gain.setValueAtTime(0, time);
    voice.osc.stop(time);
  }
  const frequency = (note, bend) => 440 * 2 ** ((note - 69 + (bend - 8192) / 8192 * 2) / 12);
  const level = (channel, voice) => voice.velocity / 127 * channel.volume / 127 * channel.expression / 127 * 0.12;
  for (const event of timeline.events) {
    if (event.status < 128 || event.status >= 240) continue;
    const kind = event.status >> 4, channel = channels[event.status & 15];
    const [a,b] = event.data;
    const time = origin + event.time;
    if (kind === 9 && b) {
      const osc = context.createOscillator(), gain = context.createGain();
      const pan = context.createStereoPanner();
      const voice = {osc, gain, pan, note:a, velocity:b, released:false, stopped:false};
      osc.type = ['sine','triangle','square','sawtooth'][channel.program % 4];
      osc.frequency.setValueAtTime(frequency(a, channel.bend), time);
      gain.gain.setValueAtTime(level(channel, voice), time);
      pan.pan.setValueAtTime((channel.pan - 64) / 64, time);
      osc.connect(gain); gain.connect(pan); pan.connect(context.destination);
      clip.nodes.push(osc, gain, pan);
      channel.voices.push(voice);
      osc.start(time);
    } else if (kind === 8 || (kind === 9 && !b)) {
      const voice = channel.voices.find(v => v.note === a && !v.released && !v.stopped);
      if (voice) { voice.released = true; if (!channel.sustain) release(voice, time); }
    } else if (kind === 12) channel.program = a;
    else if (kind === 14) {
      channel.bend = a + b * 128;
      for (const voice of channel.voices.filter(v => !v.stopped))
        voice.osc.frequency.setValueAtTime(frequency(voice.note, channel.bend), time);
    } else if (kind === 11) {
      if (a === 7) channel.volume = b;
      if (a === 11) channel.expression = b;
      if (a === 10) channel.pan = b;
      if (a === 64) {
        channel.sustain = b >= 64;
        if (!channel.sustain) for (const voice of channel.voices.filter(v => v.released)) release(voice, time);
      }
      for (const voice of channel.voices.filter(v => !v.stopped)) {
        if (a === 120 || a === 123) release(voice, time);
        else {
          voice.gain.gain.setValueAtTime(level(channel, voice), time);
          voice.pan.pan.setValueAtTime((channel.pan - 64) / 64, time);
        }
      }
    }
  }
  for (const channel of channels) for (const voice of channel.voices) release(voice, origin + timeline.duration);
}

export function createMedia({manifest, manifestURL, fetch = globalThis.fetch,
  audioContext: context, emit = () => {}}) {
  const base = new URL(manifestURL, globalThis.location?.href);
  let serial = 0, movie = null, currentMidi = null, disposed = false;
  const slots = new Map();
  const live = clip => !disposed && !clip.retired;
  const event = (clip, type, extra = {}) => emit({type, id:clip.id, kind:clip.kind, selector:clip.selector, ...extra});
  function cancel(clip) {
    if (!clip) return;
    clip.retired = true;
    clip.abort.abort();
    clearTimeout(clip.timer);
    for (const node of clip.nodes) {
      try { node.stop?.(); } catch { /* Already stopped. */ }
      node.disconnect?.();
    }
    clip.nodes = [];
  }
  function terminal(clip, type, extra) {
    if (!live(clip)) return;
    cancel(clip);
    clip.state = type;
    event(clip, type, extra);
  }
  function make(selector, kind) {
    return {id:++serial, selector, kind, state:'loading', retired:false,
      abort:new AbortController(), nodes:[], timer:null, nextFrame:0};
  }
  async function get(clip, url, json = false) {
    if (!url) throw new Error('Missing media URL');
    const response = await fetch(new URL(url, base), {signal:clip.abort.signal});
    if (!response.ok) throw new Error(`Media load failed: ${response.status}`);
    return json ? response.json() : response.arrayBuffer();
  }
  async function load(clip) {
    const entry = manifest.assets[`${clip.kind === 'movie' ? 'movies' : 'audio'}-${clip.selector}`];
    if (!entry) throw new Error(`Unknown ${clip.kind} selector ${clip.selector}`);
    clip.entry = entry;
    clip.frames = [];
    clip.pcm = [];
    clip.duration = 0;
    if (clip.kind === 'movie') {
      const packed = new Uint8Array(await get(clip, entry.files['frames.zlib']));
      for (const frame of entry.data.decoded_frames) {
        if (!live(clip)) return;
        const stream = new Blob([packed.slice(frame.output_offset, frame.output_offset + frame.compressed_bytes)])
          .stream().pipeThrough(new DecompressionStream('deflate'));
        const pixels = new Uint8Array(await new Response(stream).arrayBuffer());
        if (pixels.length !== frame.decoded_bytes || pixels.length !== frame.width * frame.height)
          throw new Error('Invalid indexed movie frame');
        const video = entry.data.streams.find(s => s.index === frame.stream);
        const time = frame.time[0] / frame.time[1];
        clip.frames.push({...frame, pixels, time});
        clip.duration = Math.max(clip.duration, time + video.scale / video.rate);
      }
      for (const stream of entry.data.streams.filter(s => s.type === 'auds')) {
        const buffer = await context.decodeAudioData(await get(clip, entry.files[`stream-${stream.index}-audio.wav`]));
        const time = stream.start * stream.scale / stream.rate;
        clip.pcm.push({buffer, time});
        clip.duration = Math.max(clip.duration, time + buffer.duration);
      }
    } else if (entry.files['events.json']) {
      clip.midi = midiTimeline(entry.data, await get(clip, entry.files['events.json'], true));
      clip.duration = clip.midi.duration;
    } else {
      const buffer = await context.decodeAudioData(await get(clip, entry.files['audio.wav']));
      clip.pcm.push({buffer, time:0});
      clip.duration = buffer.duration;
    }
    if (!Number.isFinite(clip.duration) || clip.duration <= 0) throw new Error('Invalid media duration');
    clip.frames.sort((a,b) => a.time - b.time);
    if (live(clip)) clip.state = 'open';
  }
  function pulse(clip) {
    if (!live(clip) || clip.state !== 'playing') return;
    if (context.state === 'running') {
      const elapsed = context.currentTime - clip.origin;
      while (clip.nextFrame < clip.frames.length && clip.frames[clip.nextFrame].time <= elapsed) {
        const frame = clip.frames[clip.nextFrame++], placement = clip.entry.placement;
        event(clip, 'frame', {frame:frame.frame, width:frame.width, height:frame.height,
          pixels:frame.pixels.slice(), palette:Uint8Array.from(frame.palette_rgb_hex.match(/../g), x => parseInt(x,16)),
          x:placement.field_u16_2, y:placement.field_u16_4, transparentIndex:clip.selector===0||clip.selector===1 ? undefined : placement.byte6,
          restoreBackground:true, time:frame.time});
        if (!live(clip)) return; // emit may synchronously skip/start another movie.
      }
      if (elapsed >= clip.duration) {
        // Natural MIDI completion is notification flag1. Failed/blocked/retired
        // requests never enter this path. Movie completion does not repeat.
        if (clip.midi && currentMidi === clip) {
          for (const node of clip.nodes) node.disconnect?.();
          clip.nodes = [];
          // Notification delivery can be late. Seek/replay begins now, not
          // thousands of catch-up voices scheduled in the past.
          clip.origin = context.currentTime;
          synth(context, clip, clip.midi, clip.origin);
          event(clip, 'repeat', {notificationFlag:1});
        } else { terminal(clip, 'ended'); return; }
      }
    }
    if (live(clip)) clip.timer = setTimeout(() => {
      try { pulse(clip); }
      catch (error) { terminal(clip, 'failed', {message:error.message}); }
    }, 10);
  }
  function start(clip) {
    if (!live(clip)) return;
    if (context.state !== 'running') {
      clip.state = 'blocked';
      event(clip, 'autoplay-blocked');
      return;
    }
    clip.origin = context.currentTime;
    clip.nextFrame = 0;
    for (const {buffer,time} of clip.pcm) {
      const source = context.createBufferSource(); source.buffer = buffer;
      source.connect(context.destination); clip.nodes.push(source);
      source.start(clip.origin + time);
    }
    if (clip.midi) { currentMidi = clip; synth(context, clip, clip.midi, clip.origin); }
    clip.state = 'playing';
    pulse(clip);
  }
  async function prepare(clip, play) {
    try { await load(clip); if (live(clip) && play) start(clip); }
    catch (error) { if (live(clip)) terminal(clip, 'failed', {message:String(error.message ?? error)}); }
    return clip.id;
  }
  function stopSlots() {
    for (const clip of slots.values()) cancel(clip);
    slots.clear(); currentMidi = null;
  }
  return {
    // Returns the instance ID after loading, NOT after successful completion.
    // Await terminal emit events to continue Toon-style coordinator sequences.
    playMovie(selector) {
      if (disposed) return Promise.reject(new Error('Media disposed'));
      cancel(movie); movie = make(selector, 'movie');
      return prepare(movie, true);
    },
    // Source operation bits: 1=open,2=play,4=stop,8=close,16=device command.
    // 0xc0 stops/closes all. 0x20 stops/closes all then opens/plays SELECT(1).
    // Focus policy is coordinator-owned: dispatch these operations at the
    // recovered focus call sites, never suspend/rebase the shared audio clock.
    async audio(selector, flags = 3) {
      if (disposed) throw new Error('Media disposed');
      if (flags === 0xc0 || flags === 0x20) {
        stopSlots();
        if (flags === 0xc0) return null;
        selector = 1; flags = 3;
      }
      let clip = slots.get(selector);
      if (flags & 12) {
        if (clip) { cancel(clip); clip.state = 'stopped'; if (currentMidi === clip) currentMidi = null; }
        if (flags & 8) slots.delete(selector);
      }
      if (flags & 1) {
        if (!clip && [...slots.values()].filter(c => c.state !== 'failed').length >= 10)
          throw new Error('All audio slots allocated');
        cancel(clip); clip = make(selector, 'audio'); slots.set(selector, clip);
        await prepare(clip, false);
        if (!live(clip)) return clip.id;
      }
      if ((flags & 2) && clip && !['failed','loading'].includes(clip.state)) {
        if (clip.state === 'playing') cancel(clip);
        if (clip.retired) {
          clip = {...clip, ...make(selector, 'audio'), state:'open'};
          slots.set(selector, clip);
        }
        try { start(clip); } catch (error) { terminal(clip, 'failed', {message:error.message}); }
      }
      // Operation16 was an MCI device command, not an invented browser sound.
      return clip?.id ?? null;
    },
    closeMovie() { cancel(movie); },
    skip() {
      if (disposed || !movie || movie.state === 'ended' || movie.state === 'skipped') return false;
      if (movie.retired) { movie.retired = false; }
      terminal(movie, 'skipped');
      return true;
    },
    async unlock() {
      if (disposed) return false;
      try { await context.resume(); }
      catch (error) { emit({type:'autoplay-blocked', id:null, message:error.message}); return false; }
      return context.state === 'running'; // Explicit Retry, not automatic success/continuation.
    },
    snapshot() {
      const view = clip => clip && ({id:clip.id, selector:clip.selector, state:clip.state, kind:clip.kind});
      return {disposed, movie:view(movie), audio:[...slots.values()].map(view),
        synth:'browser Web Audio oscillator adaptation', audioState:context.state};
    },
    dispose() { if (!disposed) { cancel(movie); stopSlots(); disposed = true; } },
  };
}
