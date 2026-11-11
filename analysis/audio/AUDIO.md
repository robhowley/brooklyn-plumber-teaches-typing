# Audio recovery and integration contract

Four VOC clips decode to exact PCM and are now connected to Session/main through blocking continuations. Music, effects and RS speech remain silent because their synthesis is not translated. [PHASE-6](../../reports/PHASE-6.md) records integrated fake/native-Chrome proofs and remaining work; the worker checks below remain historical.

## Use after Phase5 integration

- Run `python3 -B transpile/tools/audio/decode.py` from the repository root. No dependency installation or external content is needed.
- Local output: `assets/audio/{congrats,ready,toobad,welcome}.pcm` and `assets/audio/manifest.json`, all ignored. These are original-derived resources, not MIT-licensed project material. Never stage them.
- `recovered/audio/audio.mjs` exports `SourceAudio`, `sourceRequest`, `AUDIO_BITS` and `SPEECH_NAMES`.
- `app/audio.mjs` exports `BrowserAudio`. The host supplies PCM bytes and their manifest clip records through `register(name, bytes, metadata)`. This module does not fetch anything.
- Supply explicit source option word, device selections and resolved availability. The browser cannot perform the DOS device detection. The hash-checked supplied MARIO.CNF actually selects speech3, music/effects4 and options7. `decode_config` binds those fields into app data; it does not apply missing-config RS defaults. Browser availability is explicit transport policy, not proof of DOS driver initialization.

```js
const source = new SourceAudio({
  options, musicDevice, effectsDevice, speechDevice,
  available: { music: musicAvailable, effects: effectsAvailable, speech: speechAvailable },
});
const browser = new BrowserAudio({ onState: state => showAudioState(state) });
browser.register('ready', readyPcm, audioManifest.clips.ready);
// Directly inside a trusted click/pointerdown/keydown/touchend handler:
const unlockResult = await browser.unlock(event);
```

At each source audio call boundary:

```js
const decision = source.request({ type: 'speech', name: 'ready' });
if (decision.blocking && decision.token === undefined) throw new Error('Caller advanced during speech');
const outcomes = await browser.perform(decision);
if (decision.blocking) {
  // Do not advance the world/controller, RNG or source command pump meanwhile.
  // For VOC, suppress lesson input delivery and drain pending input on return.
  // Do not pause an already running source timer just to exclude audio time.
  if (outcomes.some(o => o.status !== 'ended')) await acknowledgeAudioOmission(outcomes);
  source.complete(decision.token);
}
// Only now execute the source continuation, e.g. music3 then last-input sampling.
```

`acknowledgeAudioOmission` and `showAudioState` above are proposed host callbacks, not exports or implemented UI. For nonblocking effects/music, execute returned stop/request actions in order without pausing the controller. `perform` reports `unsupported-silent` for these actions, never manufactures a melody or delay.

**Required integration boundaries:** consuming an already-completed batch of effects cannot undo clock/input/RNG work that the controller performed after a synchronous call. Water currently emits ready/music and samples `lastInput` inside `createWater`; main must split or suspend that continuation at FILE `0x176c7`, then sample after ready returns (`0x176d7` onward). Preserve the earlier statistics/timer start (`0x16d06`), which precedes ready. Castle's first `operationTail` emits ready/music inside a larger step, so its caller must also hold subsequent stepping at `0xc060`. Outside explicitly requires its ordinary tick to start after ready; startup/menu/results must finish their speech call before continuing their original event pumps. No shared file was changed here.

`SourceAudio.request` returns a decision with `status`, `blocking` and ordered `actions`. Requested speech also has a monotonic `token` and `inputPolicy`. `complete(token)` rejects stale/double completions. A request made during speech returns `blocked`, it is not queued and does not interrupt or alter options/handles. `inputPolicy` is `drain-until-return` for VOC and `unchanged` for RS. The source's streaming VOC loop repeatedly drains keyboard input and drains again before returning (`0x18ba1`, `0x18be4`); there is no recovered key-to-skip speech path. The browser adapter does not own the lesson keyboard queue, so main must implement this delivery boundary.

### Existing event adapters

| Producer effect | Source request | Integration caution |
|---|---|---|
| `sound {id}` | `effect {id}` | Castle/Water/bonus callbacks already expose these |
| Outside `correct` / `wrong` | effect1 / effect11 | Dispatch once, not also from its `sound` property |
| `ready` | speech `ready` | Blocking call, not a countdown |
| `music {operation}` | music ID=operation | This operation is an audio ID, not a timer operation |
| `audio-reset` | stop music only | Do not stop every channel by assumption |
| `speech {name}` | named speech | Proposed explicit startup/results producer shape |
| `prompt`, `prompt-stop` | **no audio** | Existing names are misleading, see finger-hint correction below |

Practice currently returns `advance-one-byte`, `next-line`, `retain-target` rather than audio effects. Integrator must dispatch effect1 for its two successful acceptance paths and effect11 for accepted wrong input at the corresponding source sites. Outside's repeated jump sound2 is documented but not currently emitted by its ordinary controller. Add that source request at each actual jump-path update, not only once when a host animation begins.

## Static evidence and limits

All addresses below are executable **FILE offsets**, not segment offsets. Only inert ZIP bytes and trusted LLVM `objdump` disassembly were inspected. Every inspected listing instruction was checked against the original member bytes. No original executable, sound driver, installer or script was executed, loaded as code, emulated or used as an oracle. No network content was fetched.

| Input | SHA256 |
|---|---|
| Owner-supplied `Mario_Teaches_Typing_1992.zip` | `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd` |
| `MarioTea/MARIO/MARIO.EXE` | `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e` |
| `MarioTea/MARIO/CONGRATS.VOC` | `2a57a28b94ae6858fe74fd1defd121b4019ec9b9e3f8c44c45e79247fb13189f` |
| `MarioTea/MARIO/READY.VOC` | `38b01d0f3ac24f74f1931a9abfa2be039d301f918f5c9b75b5d434ef87dfe5e5` |
| `MarioTea/MARIO/TOOBAD.VOC` | `a9a2c471ac5dcce2fa860fc7c7313baa7662be0009aacd342b62abf49f44d0f2` |
| `MarioTea/MARIO/WELCOME.VOC` | `3f74e59c7f9d809610be67b2d61051febf83f0f395b8093166002fc1c05883ff` |

Generated manifest records original member names, complete member hashes and sizes for every sound resource, including unsupported inputs. It records per-clip source/block/sample spans and PCM hashes. The decoder pins both archive and executable hashes before writing. Authored Python tests independently prove the actual sample spans and key source instruction predicates, not just agreement between two calls to the decoder.

### Proven VOC layout

All four files contain exactly one type1 sound block and a final type0 terminator, with no trailing bytes:

- Member `0x00..0x13`: `Creative Voice File` signature ending in byte `0x1a`.
- Member `0x14`: little-endian data offset26; `0x16`: version `0x010a`; `0x18`: checksum `0x1129`, matching `(~version + 0x1234) & 0xffff`.
- Member `0x1a`: block type1; `0x1b..0x1d`: unsigned little-endian 24-bit payload length.
- Member `0x1e`: time constant200; `0x1f`: codec0, unsigned 8-bit mono PCM. Sample bytes begin at `0x20`.
- Nominal rate is exactly `1,000,000 / (256 - 200) = 125,000 / 7` samples/second. No decoder resampling, signed conversion or normalization is applied.

| Clip (decoded block index0) | Member bytes | Block payload bytes | Sample span [start,end) | Samples | Nominal seconds |
|---|---:|---:|---|---:|---:|
| congrats | 34,041 | 34,010 | `0x20..0x84f8` | 34,008 | 1.904448 |
| ready | 40,132 | 40,101 | `0x20..0x9cc3` | 40,099 | 2.245544 |
| toobad | 46,495 | 46,464 | `0x20..0xb59e` | 46,462 | 2.601872 |
| welcome | 37,718 | 37,687 | `0x20..0x9355` | 37,685 | 2.110360 |

The end offset is also the terminator's member offset. Total output is **158,254 samples/bytes** in four PCM files. The manifest preserves these bytes unchanged and records SHA256 for each PCM output. Browser conversion uses `(byte - 128) / 128` into a mono Float32 AudioBuffer with the nominal fractional rate. WebAudio/device resampling, latency, floating-point rate representation and browser scheduling are host adaptations, not recovered DOS driver output.

The decoder rejects every unproven layout instead of partially playing it: extra header bytes, other versions/rates/codecs, continuation blocks, silence/repeat/extended blocks, multiple sound blocks, missing terminators, overflow/truncation and trailing data. The one-million-byte input bound is an authored safety limit, not a DOS limit. Unsupported resources are inventoried, not sent through a speculative decoder.

### Actual archive completeness

| Members | Count | Result |
|---|---:|---|
| `CONGRATS/READY/TOOBAD/WELCOME.VOC` | 4 | Decoded |
| `CONGRATS/READY/TOOBAD/WELCOME.RS` | 4 | Unsupported, silent |
| `ATYP1..4.PC` | 4 | Unsupported IFF/XMID sequence containers, not PCM |
| `ATYP1..4.XMI`, `RTYP1..4.XMI` | 8 | Unsupported IFF/XMID sequence containers |
| `SFX01..10.{PCS,ADL,RLD}` | 30 | All three ten-effect sets present, unsupported synthesis |
| `ADLIB/MT32MPU/PASDIG/PASFM/PCSPKR48/SBDIG/SBFM/SBPDIG.ADV` | 8 | Inert drivers only, never loaded |
| `SAMPLE`, `SAMPLE.AD`, `SAMPLE.MT`, `SAMPLE.OPL` | 4 | Unsupported instrument banks |

All **62** sound-related members are accounted for: four decoded and **58 unsupported**. The three 702-byte banks SAMPLE/SAMPLE.AD/SAMPLE.OPL are byte-identical; SAMPLE.MT is32,514 bytes. `.PC`, `.PCS`, `.ADL`, `.RLD` share IFF `FORM/XDIR/INFO`, `CAT /XMID` headers with `.XMI`; suffixes do not imply sample data. RS has a `STEVE` header, a byte5 value2 and byte6 value72 in these four files; its payload is consumed by the source's software/hardware-dependent playback routine, not proven to be plain PCM. These observations do not implement timbres, synthesis or RS decoding.

## Recovered wrapper behavior

### Options, availability and resource selection

- Source option word is DS:`5038`: music bit1, effects bit2, speech bit4. Menu M/S/G XOR those bits (`0x11516`, `0x11583`, `0x1158a`). They are independent, not a master mute word.
- Effect IDs **1 and11 bypass effects bit2** (`0x18e26..0x18e48`), then11 aliases resource10 (`0x18e48..0x18e50`). Thus turning off Sound does not suppress correct/wrong typing feedback if the driver is available. Bit4 does not control those effects.
- Music checks bit1 then availability DS:`4e2a` (`0x188fb..0x18928`); effects check bit2 except the bypass, then DS:`4e29` (`0x18e32..0x18e67`); speech checks DS:`4e28` then bit4 (`0x18d3f..0x18d5e`). Availability is initialized once through `0x1837c`, based on config/devices and initialization success, not guessed in JavaScript.
- DS:`5032` selects music device; DS:`5034` effects; DS:`5036` speech. Speech0 is unavailable; speech1 selects `.RS`; speech2..5 use digital `.VOC` when their driver initialization succeeds. With speech1, musicDevice1 **or** effectsDevice1 suppresses the request even if that channel's option is disabled (`0x18d71..0x18d8b`). No automatic VOC fallback exists in the translated wrapper.
- Music resources1..4 are loaded by `0x185b0..0x18648`. Device1 selects `ATYPn.PC`; device5 changes the first character to `R`, selecting `RTYPn.XMI`; other devices select `ATYPn.XMI`. The source's device8 uses the PC-speaker driver but the filename branch still chooses `.XMI`, not `.PC`.
- Effects1..10 are loaded by `0x186df..0x187ad`. Suffix table FILE `0x18843` selects PCS for devices1/8, ADL for2/3/4/6/7, RLD for5. The resource index is the requested ID minus1, except request11 aliases10. All required file alternatives exist in this archive.
- KWD diagnostic mode can replace every effect ID using integer environment `KWD1` (`0x18de3..0x18e1a`, string FILE `0x22016`). `effectOverride` accepts an explicit already-parsed value; no browser environment variable or new default is invented.

### Stops, ordering and blocking

| Routine | Directly recovered behavior |
|---|---|
| Music request `0x188d9..0x18a48` | If enabled/available, stop existing selected music first; validate ID1..4; stop selected effect; initialize and start selected sequence; return without waiting for sequence end |
| Music stop `0x18a49..0x18a94` | End/release selected music handle when nonnegative; set handle DS:`4d5c` to-1 and flag DS:`4e27` to0; not an all-channel stop |
| Effect request `0x18dcd..0x18f8e` | Apply override/options/alias/availability/range; stop prior selected effect at `0x18e76`; start requested effect and retain its handle; no numeric priority comparison |
| Effect stop `0x18f8f..0x18fc8` | If flag DS:`4e26` set, clear it and end/release DS:`4d5a`; do not explicitly stop music |
| Speech request `0x18d22..0x18dcc` | Check speech availability/bit4/device conflicts; select name.RS or name.VOC; synchronous call; no explicit preceding music/effect stop |
| VOC playback `0x18a95..0x18bfb` | Prepare two driver buffers of at most `0x4000` bytes each; service completion/refill and drain keyboard repeatedly; return only when remaining bytes are0 and both driver-buffer statuses are3; drain keyboard again and free resource |
| RS playback `0x18c2a..0x18d21` | Read file, pass payload at member `0x20` and header byte5 to software/hardware-dependent routine FILE `0xa354`; free only after call returns; unsupported here |

This is wrapper call ordering, not a claim about audible mixing or hardware channel priorities. Drivers remain unimplemented, and music/effects can share a driver. The model stores **selected handles**, not fabricated sound durations or natural-completion timers. Last-effect replacement and music's explicit effect stop are recovered; a new speech request interrupting an old one is not. The source cannot execute that second call during its first synchronous speech call. Browser `busy`/source `blocked` statuses expose a caller error rather than inventing a queue.

Only menu M has immediate start/stop behavior: enabling starts music2, disabling calls music-stop (`0x11516..0x1153e`). S and G change future request gates without explicit stop (`0x11583..0x1158f`). Browser host mute is separate and deliberately labeled.

### Concrete source event map

Each call below is tied to the executable member/hash above. Effect arguments and far-call bytes are independently asserted by `tests/audio/test_decode.py`.

| Source event | Request / FILE call site |
|---|---|
| Process startup before startup presentation | music1 at `0x1d8e6` |
| Title actor iteration when no pending key | effect1 at `0xff37`; do not emit after a skipped iteration |
| Menu entry | stop music `0x10d7d`; first-entry welcome via `0x10d8b`→`0x14fac`; music2 `0x10d99` |
| Menu idle greeting trigger | welcome via `0x10eb2`→`0x14fac`, only on its source branch |
| Menu music toggle | music2 `0x11531` or stop music `0x11539` |
| Menu invalid/unhandled command path | effect10 `0x119fd` |
| Menu wrapper cleanup | stop music `0x11bb1` |
| Shared pointer pump old button bit0 clear/new bit0 set | effect8 `0x149bc`; use this transition, not every browser pointer event |
| Outside entry | stop music `0x13dd7`; ready `0x13e04`→`0x14f58`; music1 `0x13e0d`; ordinary loop follows |
| Outside jump-path update | repeated effect2 `0x13802` |
| Outside correct / wrong accepted input | effect1 `0x13ca3` / effect11 `0x13d14` |
| Outside block / turtle countdown expiration | effect4 `0x131f2` / effect3 `0x13206` |
| Outside exit | cleanup, stop music `0x13e1b`, results |
| Water entry | stop music `0x17e17`; ready `0x176c7`→`0x14f58`; music3 `0x176d0`; then last-input sample |
| Water swimmer bubble branch | effect5 `0x17493`, including when bubble pool is full |
| Water correct / wrong accepted input | effect1 `0x178b2` / effect11 `0x178c9` |
| Water exit | cleanup then stop music `0x17e9d`, results |
| Castle first operation tail | ready `0xc060`→`0x14f58`; music4 `0xc069`, once per entry |
| Castle correct / wrong accepted input | effect1 `0xbebc` / effect11 `0xbee3` |
| Castle rockface trigger | effect6 `0xc46b` |
| Castle pipe sequences | effect7 `0xca55`, `0xd168`, at each pipe sprite draw |
| Castle sand entry / landing / exit jump | effect2 `0xcca6`, effect9 `0xcd29`, effect2 `0xcf07` |
| Castle exit/save/results branches | music-stop calls `0xde0f`, `0xde20`, preserve branch order |
| Practice correct ordinary / wrong accepted input | effect1 `0xb7a3` / effect11 `0xb7d7`; no ready/music call in its entry wrapper `0xb807..0xb84f` |
| Outside/Water/Castle bonus callbacks | effect7 at `0x14284`, `0x17ee5`, `0xde58`; use decoded per-character one-based frame tables, not every packet |
| Results at/above previous goal / below | congrats `0x165fc`→`0x14f90` / toobad `0x16603`→`0x14f74`; returns before results input loop |

Shared speech wrappers: ready `0x14f58`, toobad `0x14f74`, congrats `0x14f90`, welcome `0x14fac`, each forwarding to `0x18d22`. Names are stored at FILE `0x21bb1`, `0x21bb7`, `0x21bbe`, `0x21bc7`. Results suppresses its speech for demo/report suppression, absent profile, Practice, Outside goal>10 or Water goal>30; its comparison is against the previous goal, not a newly raised goal (`0x165a9..0x16608`, existing `resultSpeech`). Integration must use that existing predicate rather than play congrats on every lesson completion. Other celebration animation calls are visual only unless their source callback explicitly requests an effect.

### Correction: finger hints are not speech

Water's `prompt-stop` and `prompt {code,argument:5}` events come from FILE `0x17524..0x17556`, calling service `0x18019` with operations1101/1103. That service dispatches1101 at `0x18070` to graphics blits through `0x07a47`, and1103 at `0x180b5` maps printable characters through the finger table to another graphics blit at `0x18126`. It does **not** call the audio wrapper. Argument5 is not a speech priority. Practice uses the same hint service. Existing Water/controller documentation calling these speech requests should be corrected by integration; this worker did not edit other owners' reports/modules. No per-letter speech corpus is recovered or invented.

## Browser adaptations and unsupported behavior

- Explicit trusted input event required for `unlock`. Nothing creates/resumes AudioContext during module load, registration or playback of a locked request. Autoplay rejection reports `denied`; another gesture may retry. No queued historical clips replay after unlock.
- Host mute stops active PCM and settles its promise as `muted`; unmute does not replay. This is not the source S or G command. Main must treat it as a host audio omission at the suspended call boundary.
- Context suspension/closure settles active playback visibly; no forever-busy source continuation. `close()` is host teardown, not a recovered quit device operation.
- Missing resources, denied start, locked audio and unsupported RS return visible outcomes. No substitute browser speech synthesis, beep oscillator, guessed music, fixed countdown or fabricated timing is provided.
- Native WebAudio is the only playback mechanism. Real browser/device latency, hardware synthesis, driver channel allocation, music looping/controller events/timbres, DOS timer compensation during RS output, original-runtime audio equivalence and perceived sound quality are unverified.
- Fake-transport tests verify the authored transport contract. New native-Chrome tests additionally schedule every decoded PCM sample, prove real ended completion, denial and no replay; neither proves audible device quality. Session/main/browser integration now holds each blocking boundary and drains VOC input. Full source synthesis, RS speech and hardware equivalence remain unimplemented.

## Checks

Exact commands from the worker checkout root:

```sh
python3 -B transpile/tools/audio/decode.py
python3 -B -m unittest discover -s transpile/tests/audio -p 'test_*.py'
node --test transpile/tests/audio/audio.test.mjs
node --test transpile/tests/{app,control,outdoor,worlds,runtime,render,audio}/*.test.mjs
git diff --check
git check-ignore transpile/assets/audio/manifest.json transpile/analysis/audio/core.asm.txt
```

- Decoder regeneration: four clips,158,254 samples,58 unsupported members, no drivers copied to output.
- Python:10 tests passed, including independent actual-member sample spans/hashes, instruction/call-site bytes, malformed/truncated formats, exact repeat rebuild and symlink/hash rejection.
- Node audio:18 tests passed, including every actual decoded sample through the browser buffer, option bypass/alias, exact device filenames, request/stop ordering, blocked reentry/stale completion, RS conflicts, gesture denial/retry, unsigned PCM conversion, mute/suspend/close and explicit omission completion.
- Combined existing Node suites plus audio:196 tests passed. No shared implementation files were changed.
- Checks are source-derived/static and newly authored JavaScript/Python only, not a DOS differential comparison or hardware playback test.
