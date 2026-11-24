import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {createMedia} from '../media.js';

const selectors = [14,15,16,17,18,19,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,51,52,53,54,56,57,58,59,60,61];
const parameter = () => ({values:[], setValueAtTime(value,time) { this.values.push([value,time]); }});
function fixture(t) {
  t.mock.timers.enable({apis:['setTimeout']});
  const nodes = [], requests = [], events = [], files = new Map();
  const context = {state:'running', currentTime:10, destination:{},
    async resume() { this.state = 'running'; },
    async decodeAudioData(buffer) {
      assert.equal(new TextDecoder().decode(buffer), 'PCM fixture');
      return {duration:0.8};
    },
    createBufferSource() { return node('pcm'); },
    createOscillator() { return node('osc'); },
    createGain() { return node('gain'); },
    createStereoPanner() { return node('pan'); },
  };
  function node(kind) {
    const n = {kind, starts:[], stops:[], frequency:parameter(), gain:parameter(), pan:parameter(),
      connect() {}, disconnect() { this.disconnected = true; },
      start(time) { this.starts.push(time); }, stop(time) { this.stops.push(time); }};
    nodes.push(n); return n;
  }
  const palette = Array.from({length:256}, (_,i) => [i,i,i]).flat().map(x=>x.toString(16).padStart(2,'0')).join('');
  const packed = [deflateSync(Uint8Array.of(245,10)),deflateSync(Uint8Array.of(245,11))];
  const manifest = {assets:{}};
  for (const selector of selectors) {
    manifest.assets[`movies-${selector}`] = {files:{'frames.zlib':`clips/${selector}.zlib`,'stream-1-audio.wav':`clips/${selector}.wav`},
      placement:{field_u16_2:selector === 40 ? 166 : selector < 51 ? 20 : 85,
        field_u16_4:selector === 40 ? 66 : 60,byte6:selector === 40 ? 77 : selector < 51 ? 245 : 10},
      data:{streams:[{index:0,type:'vids',scale:1,rate:2},{index:1,type:'auds',start:1,scale:1,rate:10}],
        decoded_frames:packed.map((p,i)=>({stream:0,frame:i,width:2,height:1,time:[i,2],
          output_offset:i ? packed[0].length : 0,compressed_bytes:p.length,decoded_bytes:2,palette_rgb_hex:palette}))}};
    files.set(`clips/${selector}.zlib`,Buffer.concat(packed));
    files.set(`clips/${selector}.wav`,'PCM fixture');
  }
  // Independently expected times: PPQ100 at 500000us gives tick100=.5s;
  // tempo1000000 on track0 gives tick200=1.5s, tick300=2.5s.
  const tracks = [{events:[{tick:0,status:255,meta_type:81,microseconds_per_quarter:500000},
    {tick:100,status:255,meta_type:81,microseconds_per_quarter:1000000},
    {tick:300,status:255,meta_type:47}]}, {events:[
    {tick:0,status:193,data:[2]}, {tick:0,status:177,data:[7,64]},
    {tick:100,status:145,data:[69,127]}, {tick:200,status:129,data:[69,0]},
    {tick:200,status:144,data:[60,64]}, {tick:300,status:128,data:[60,0]}]}];
  for (const selector of [1,5,7,8]) {
    manifest.assets[`audio-${selector}`] = {files:{'events.json':`music/${selector}.json`},data:{division:100,midi_format:1}};
    files.set(`music/${selector}.json`,JSON.stringify(tracks));
  }
  manifest.assets['audio-10'] = {files:{'audio.wav':'wave/499.wav'},data:{}};
  files.set('wave/499.wav','PCM fixture');
  const fetch = async (url, options) => {
    requests.push([url.href, options.signal]);
    const value = files.get(url.pathname.replace('/prefix/assets/',''));
    return {ok:value !== undefined,status:value === undefined ? 404 : 200,
      json:async()=>JSON.parse(value),arrayBuffer:async()=>Uint8Array.from(Buffer.from(value)).buffer};
  };
  const media = createMedia({manifest,manifestURL:'https://example.test/prefix/assets/assets.json',fetch,audioContext:context,emit:e=>events.push(e)});
  const advance = seconds => {context.currentTime += seconds; t.mock.timers.tick(10);};
  t.after(()=>media.dispose());
  return {media,context,events,nodes,requests,manifest,files,advance,fetch};
}

test('synthetic transport vectors load manifest-relative frames and WAV; supplied placement and indexed delta survive', async t => {
  const f = fixture(t);
  for (const selector of selectors) {
    const id = await f.media.playMovie(selector);
    const first = f.events.filter(e=>e.id===id && e.type==='frame');
    assert.equal(first.length,1);
    assert.deepEqual([...first[0].pixels],[245,10]);
    assert.equal(first[0].transparentIndex, selector === 40 ? 77 : selector < 51 ? 245 : 10);
    assert.equal(first[0].restoreBackground,true);
    assert.equal(first[0].x,selector === 40 ? 166 : selector < 51 ? 20 : 85);
    assert.equal(first[0].y,selector === 40 ? 66 : 60);
    f.advance(0.51);
    assert.deepEqual([...f.events.filter(e=>e.id===id && e.type==='frame')[1].pixels],[245,11]);
    f.advance(0.5);
    assert.equal(f.events.at(-1).type,'ended');
  }
  assert.equal(f.requests.length,76);
  assert.ok(f.requests.every(([url])=>url.startsWith('https://example.test/prefix/assets/clips/')));
  assert.equal(f.nodes.filter(n=>n.kind==='pcm').length,38);
  assert.equal(f.nodes[0].starts[0],10.1);
});

test('one audio timeline: JS delay and suspended audio cannot independently advance frames', async t => {
  const f = fixture(t); await f.media.playMovie(14);
  t.mock.timers.tick(10000);
  assert.equal(f.events.length,1);
  f.context.state = 'suspended'; f.advance(1);
  assert.equal(f.events.length,1);
  f.context.state = 'running'; f.advance(0);
  assert.deepEqual(f.events.map(e=>e.type),['frame','frame','ended']);
});

test('MIDI track merge, channel program/volume, tempo changes, note ends and success-only repeat', async t => {
  const f = fixture(t);
  for (const selector of [1,5,7,8]) {
    await f.media.audio(selector,3);
    const oscillators = f.nodes.filter(n=>n.kind==='osc').slice(-2);
    assert.equal(oscillators[0].type,'square');
    assert.deepEqual(oscillators[0].frequency.values,[[440,10.5]]);
    assert.deepEqual(oscillators[0].stops,[11.5]);
    assert.equal(oscillators[1].type,'sine');
    assert.deepEqual(oscillators[1].starts,[11.5]);
    const gain = f.nodes.find(n=>n.kind==='gain');
    assert.ok(Math.abs(gain.gain.values[0][0] - 64/127*0.12)<1e-10);
    await f.media.audio(0,0xc0);
  }
  await f.media.audio(5,3); f.advance(2.5);
  assert.equal(f.events.at(-1).type,'repeat');
  assert.equal(f.events.at(-1).notificationFlag,1);
  await f.media.audio(0,0xc0); const count=f.events.length;
  f.advance(100); assert.equal(f.events.length,count);
});

test('WAVE10 ends without MIDI repeat; focus operation32 closes all and restarts SELECT1', async t => {
  const f = fixture(t); await f.media.audio(10,3); f.advance(0.81);
  assert.equal(f.events.at(-1).type,'ended');
  await f.media.audio(5,3); const old=f.nodes.filter(n=>n.kind==='osc');
  await f.media.audio(0,32);
  assert.ok(old.every(n=>n.disconnected));
  assert.equal(f.media.snapshot().audio.length,1);
  assert.equal(f.media.snapshot().audio[0].selector,1);
});

test('explicit unlock, blocked/failed are not success, skip is separate and disposal is final', async t => {
  const f=fixture(t); f.context.state='suspended';
  await f.media.playMovie(14); assert.equal(f.events.at(-1).type,'autoplay-blocked');
  assert.equal(await f.media.unlock(),true);
  assert.equal(f.events.at(-1).type,'autoplay-blocked');
  await f.media.playMovie(14); assert.equal(f.media.skip(),true);
  f.advance(20); assert.equal(f.events.at(-1).type,'skipped');
  await f.media.playMovie(999); assert.equal(f.events.at(-1).type,'failed');
  assert.equal(f.media.skip(),true); assert.equal(f.events.at(-1).type,'skipped');
  f.media.dispose(); assert.equal(f.media.skip(),false);
  await assert.rejects(f.media.playMovie(14),/disposed/);
});

test('retired loading callbacks cannot start sound, emit, or revive a stopped open/play', async t => {
  const f=fixture(t); let release;
  const gate=new Promise(resolve=>release=resolve);
  const media=createMedia({manifest:f.manifest,manifestURL:'https://example.test/prefix/assets/assets.json',
    audioContext:f.context,emit:e=>f.events.push(e),fetch:async (...args)=>{await gate; return f.fetch(...args);}});
  const old=media.playMovie(14); media.skip();
  const sound=media.audio(5,3); await media.audio(0,0xc0);
  const newer=media.playMovie(51); media.dispose();
  release(); await Promise.all([old,sound,newer]);
  assert.deepEqual(f.events.map(e=>e.type),['skipped']);
  assert.equal(f.nodes.length,0);
});

test('open-only, play, stop and close are separate; replay gets a fresh identity', async t => {
  const f=fixture(t); const id=await f.media.audio(5,1);
  assert.equal(f.nodes.length,0);
  await f.media.audio(5,2); assert.ok(f.nodes.length>0);
  await f.media.audio(5,4); assert.ok(f.nodes.every(n=>n.disconnected));
  const next=await f.media.audio(5,2); assert.notEqual(next,id);
  await f.media.audio(5,8); assert.equal(f.media.snapshot().audio.length,0);
});

test('SMPTE ignores tempo and channel sustain/pan/bend are scheduled at event time', async t => {
  const f=fixture(t);
  f.manifest.assets['audio-5'].data.division = 0xe728; // -25fps, 40 ticks/frame = 1000 ticks/sec.
  f.files.set('music/5.json',JSON.stringify([{events:[
    {tick:0,status:255,meta_type:81,microseconds_per_quarter:999999},
    {tick:0,status:178,data:[64,127]}, {tick:0,status:178,data:[10,0]},
    {tick:100,status:146,data:[69,127]}, {tick:200,status:226,data:[0,96]},
    {tick:300,status:130,data:[69,0]}, {tick:500,status:178,data:[64,0]},
    {tick:600,status:255,meta_type:47}]}]));
  await f.media.audio(5,3);
  const osc=f.nodes.find(n=>n.kind==='osc');
  assert.deepEqual(osc.starts,[10.1]);
  assert.deepEqual(osc.stops,[10.5]); // note-off at .3 held until sustain release at .5
  assert.equal(osc.frequency.values[1][1],10.2);
  assert.ok(Math.abs(osc.frequency.values[1][0]-440*2**(1/12))<1e-9);
  assert.deepEqual(f.nodes.find(n=>n.kind==='pan').pan.values[0],[-1,10.1]);
});

test('fetch, PCM decode, audio-start and unlock failures never emit ended or repeat', async t => {
  const f=fixture(t);
  f.files.delete('clips/14.wav'); await f.media.playMovie(14);
  assert.equal(f.events.at(-1).type,'failed');
  f.context.decodeAudioData=async()=>{throw new Error('bad PCM');};
  await f.media.audio(10,3); assert.equal(f.events.at(-1).type,'failed');
  f.context.createOscillator=()=>{throw new Error('device failure');};
  await f.media.audio(5,3); assert.equal(f.events.at(-1).type,'failed');
  f.context.resume=async()=>{throw new Error('denied');};
  assert.equal(await f.media.unlock(),false);
  assert.equal(f.events.at(-1).type,'autoplay-blocked');
  f.advance(1000);
  assert.ok(!f.events.some(e=>e.type==='ended' || e.type==='repeat'));
});
