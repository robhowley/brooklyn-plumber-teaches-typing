# Original menu and student widgets

**Phase4 integrates these controllers with the original indexed screens, source fields/selection overlay and shared changed-tick caret schedule.** The frozen worker's original API/evidence follows; current integration and checks are recorded in [PHASE-4](../../reports/PHASE-4.md). The storage layout is unchanged. A separately labeled native form remains a host fallback, not an original widget.

## Integration API

Paths are relative to `transpile/`.

| Export in `recovered/control/menu.mjs` | Contract |
|---|---|
| `createMenu({options})` | New menu entry: column1, closed row0, pointer308,94. Pass retained option bits; default0 is an API convenience, not a recovered process initializer. |
| `menuInput(state, {key,pointer,front,messages}, profile)` | Returns `{state,effects}`; decoded DOS keys, indexed 320x200 displayed raster and decoded MSD strings. A pending key wins over a pointer press. Pass the actual profile for mode/Next gates. |
| `createStudentUI(bytes, 'new' / 'edit' / 'times')` | Returns working 260-byte student state. New clears the structure immediately, including on subsequent cancellation. Existing service normalization is reused. |
| `studentUIInput(state, {key,pointer,messages}, names)` | Returns `{state,effects}`. `names` maps source student names to existing 260-byte records, supplied by the host. Edit is keyboard-first; duration is pointer-first. An active text field consumes only keys. |
| `studentFieldPlacement(state)` | Original field x/y/font and foreground/background, or null. New-name192,110; rename176,70; goal144,90; minutes190,70/90/110/130. |
| `createTextField(value,maxLength,flags)`, `textFieldInput(field,key)` | Source text state, cursor, insert flag, terminating key. Used by student controller; no DOM selection or guessed word navigation. |
| `createStudentChooser(names,ticks)`, `studentChooserInput(state,event)` | Source maximum30 names, sorted after enumeration truncation, 3 columns of10; pointer-first pump and source double-press threshold. Pass sampled BIOS ticks, not milliseconds. |
| `menuPixel`, `menuWelcomeHit` | Source low-word linear pixel addressing and palette88 interception, not RGB color matching. |

- `pointer` means a sampled pressed event. Main menu and PREFS require a fresh left-press edge; LOAD checks pressed level without the same previous-button gate. The browser adapter owns conversion and delivery.
- `messages` is an id-to-string object, such as existing `data.messages`, not the evidence JSON's `{text,...}` records. English fallback keys remain available. Main menu localized checks retain source order.
- Effects are ordered requests, not hidden mutations: `start`, `world-warning`, `set-lesson`, `save-student`, `new-student`, `load-student`, `edit-student`, `demo`, `report`, `help`, `keyboard`, `about`, `options`, `sound-request`, `quit-request`, `certificate-request` or `incomplete`.
- Menu `start` carries mode and, for Next, routed lesson. Apply it through existing Session APIs. `set-lesson` precedes `save-student`.
- Student effects include `created-student`, `loaded-student`, `delete-student` and `save-student`. Student state contains the working bytes; consuming only effects would miss immediate source changes such as New cancellation. Apply working state separately from storage transport.
- Save effects are student-service intents. Reuse `studentForSave` and the existing host save layout/transport. The source save operation denies profiles with `profilePresent=0`. Do not persist raw effects as a replacement format.
- No storage, deletion, filesystem access, migration, tab closure or printer operation happens in these modules. Host errors must remain visible through existing transport error handling. Source load chooser actions are not browser import/export actions.

`app/menu-render.mjs` exports `drawMenuWidgets(front,font5,messages,state,lesson)`, `drawStudentChooserNames(front,font5,state)` and `drawTextField(front,fonts,field,placement)`. Fonts use existing `{sprite,pixels}` decoded glyph records for ASCII32..127. Restore the original backing raster before composition. The helpers mutate only the indexed front buffer, retain source palette indices and perform no RGB conversion or DOM work. `drawTextField` accepts explicit `inverted` cursor phase, not a guessed millisecond blink period.

## Source identity and method

All executable addresses below are **FILE offsets**. The new `tools/control/menu-inspect.py` reads the ZIP as data, pins its hash and the executable hash, builds inert ELF byte slices, and asks trusted system `objdump` for static code16 disassembly. No archive program was executed, emulated, interpreted or loaded as code. Existing listings were leads; fresh slices and instruction bytes were checked against this ZIP.

| Original member | SHA256 |
|---|---|
| `Mario_Teaches_Typing_1992.zip` | `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd` |
| `MarioTea/MARIO/MARIO.EXE` | `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e` |
| `MarioTea/MARIO/ENGLISH.MSD` | `fd2168878e19b1b85ae0c6ce8e14ad4386a801e7c460ed134bde5f181cb29e15` |
| `MarioTea/MARIO/FONT5H.FNT` | `ef34a85146592dfd325e7eb303c3da797cdbe9ff306fd209a1bb09824bf6514f` |
| `MarioTea/MARIO/PREFS.CRX` | `aff25eaa9c084e28c4f0e61e4856b18a38ede57cf81930ab6c9b835a08a73132` |
| `MarioTea/MARIO/LOAD.CRX` | `217cc9c889b74625329eab8f3e7d359aea20edc7b36d54e17f551eab249ddd05` |
| `MarioTea/MARIO/LESSTIME.CRX` | `3e9e4880370563faa2f7074d1d44d64b2146b5bc5908ee52d81851d5a8429bd2` |

Additional font/GSK hashes and per-glyph source indices are retained in `assets/original/manifest.json` and `assets/original/fonts/{FONT3H,FONT5H}.json`. Font glyph index is ASCII minus32; FONT5H is8x8, FONT3H is8x10. These are original-derived local resources, not authored distributable assets.

## Recovered behavior

### Menu pump and pixels

- `0x10d16..0x10d34`: pointer308,94, column1, row0. `0x10e1c..0x10e46`: pending keyboard is consumed before pointer processing.
- `0x10e66..0x10eb7`: scan x offsets -3..3 and y offsets -3..3 for palette index88 before even the top bar. A hit requests `welcome` through `0x14fac`, whose resource name is EXE FILE `0x21bc7`. It is not a world, help or quit action.
- `0x110ce..0x1111a`: second identical palette scan on the closed-menu world path. `0x14fd6..0x14ff7` computes low-word `y*320+x`, accepts unsigned offsets below64000, and returns0 otherwise. Thus x=-1,y=1 addresses pixel319, rather than being independently clipped. Tests cover this unusual boundary.
- `0x10eba..0x10f35`: top bar y<8; x strictly inside(16,64), (104,184), (224,296). Outside closes any dropdown.
- `0x10f5d..0x110c7`: dropdown x strictly inside(24,128), (112,208), (200,352); rows are trunc(y/8), 1..8/5/6. Third column's upper bound352 really exceeds the physical screen. Closed world boxes reuse existing half-open `mainMenuHit`. Clicking outside an open dropdown closes it and never falls through to world boxes.
- `0x111d8..0x113b1`: localized initials checked before fallback key table, in About/Help/Demo/Keyboard/Music/Sound/Speech/Quit/New/Load/Edit/Times/Certificates/Next order. `0x15357` uppercases ASCII a..z only.
- `0x115b9..0x119f5`: Enter/Space open or activate; arrows wrap source columns/rows. Existing `menuNavigation`, `mainMenuCommand`, mode gates and `nextRoute` are reused. Keyboard activation of About/Edit can preserve the open menu, unlike their hotkey paths.
- `0x11516..0x11598`: XOR options1/2/4 and close dropdown. `0x115a7 -> 0x149fc` requests real process exit; browser effect explicitly cannot close a tab. Help operation1, keyboard, about, certificate and report stay separate routes. No guessed quit confirmation exists.

### Text editor, cancellation and deletion

- `0xed25..0xed4a`, `0xf39c..0xf3c1`: name limit8, flags0103; `0xf4c5..0xf4ea`: goal limit3, flags2002; `0x909d..0x90c2`: minutes limit2, flags2002.
- `0x1af30..0x1b3bf`: initial cursor0 unless flag1000, insertion on unless4000; Home/End, left/right, Insert, Delete and Backspace have explicit branches. No Tab, Ctrl-word motion, modern selection or pointer-to-caret navigation was found in this editor.
- `0x1b266..0x1b33d`: accepted key bytes32..126, cursor strictly below maximum. Name0103 permits letters and digits, uppercases letters, and rejects spaces, dots and other punctuation. First-dot truncation at `0xed97..0xedbd` still exists for an already supplied string, but is not permission to type dots. Numeric2002 permits digits only, clears old text on the first accepted character at cursor0, and rejects minus. Any prior editor key clears that first-key flag.
- `0x1b3c0..0x1b41b`: raw key/target table proves Enter, Escape, F1..F10, up/down and PageUp/PageDown terminate the field. Callers cancel only on Escape. Other terminators accept the current contents, not launch help inside the field.
- `0x1b06d..0x1b0ed`, `0x1aced..0x1af2f`: cursor draws the current character (or space at end), swapping full cell foreground/background. It is not an underline or one-pixel bar. FONT3H shadow index2 remains mapped0 in this student editor. Cursor service uses4/2 changed-low-tick waits, now traced through `0x192a2` and integrated below.
- `0xe39c`: New clears all260 bytes before its prompt. Escape/empty leaves that cleared state, not the prior profile. `0xede6..0xee26`: existing filename loads the student, rather than overwriting it with defaults. Host name lookup treats ASCII case-insensitively to match DOS pathname intent; this is a host filename adaptation, not a newly recovered directory implementation.
- `0xf3d8..0xf420`: rename Escape cancels before deletion. If accepted text differs, call student op0xb05 to delete OLD, copy NEW, then op0xaf3 to save. There is **no collision or delete confirmation dialog** in this path. Copy leaves bytes after the new NUL unchanged. The old file deletion is profile-gated at `0xe372..0xe391`.
- `0xf519..0xf540`: goal clamp5..150; `0x90e1..0x90f5`: minutes clamp1..60. Source `%-3u`/`%-2u` formatting includes trailing spaces in initial numeric fields; those spaces affect End/right cursor bounds. Values are initially unsigned16 formatting, not signed modern input rendering.
- `0xf1fb..0xf25d`: six editor focus slots (name, goal, three characters, Done), with Tab/right/down forward and left/up backward. Character boxes x[66,116), [132,182), [208,258), y(130,180). Name x>=176,y[70,79) has no upper x bound. Goal x[144,168),y[90,99] is inclusive at99. Whole-dialog Escape/Done saves existing changes; it is not rollback.
- `0x8fb0..0x9010`: minute rectangles are inclusive x190..214 at y70..80,90..100,110..120,130..140. Done x266..305,y177..187. Duration Enter dispatches the current pointer position. Defaults2/5/5/10 are restored together only if outdoor duration is zero.

### Load chooser, not a delete chooser

- `0xf77a..0xf8d7`: enumerate at most30 `*.stu` names, truncate bases to8, then sort using `strcmp`. No browser import/export semantics belong to this command.
- `0xf5ab..0xf652`: column x40+80*floor(index/10), row y64+8*(index%10), format ` %-8.8s `. Selected fg14/bg1, normal fg0/bg15, FONT5H.
- `0xf918..0xfa11`: pointer before keyboard; Cancel x181..234,y158..172; Done/load x246..285,y158..172, inclusive. Grid y[64,144); partial last column clicks clamp to last item.
- `0xf9f2..0xfa0e`: same selection loads on signed tick difference strictly below10. Initial time is chooser entry, so an early first click on initially selected index0 can load. Exactly10 does not.
- `0xfaa2..0xfb10`: up/down wrap individual indices, left subtracts10 only if possible, right adds10 only when selection<count-10. Tab switches Cancel/Done pointer locations. Enter checks current x only, without rechecking y. Escape/C cancels; **D is Done/load, not Delete**. Cancellation issues no load/delete/save effect.

### Proven indexed drawing

- `0x105cc..0x106f9`, `0x11be8..0x11d53`: FONT5H, header MSD1100/1110/1120, dropdown MSD2600..2607,2700..2704,2800..2805; selected fg14/bg1, normal fg0/bg14; current lesson '+' marker.
- `0x116e5..0x11870`: dropdown left/width14/108,102/100,190/124; top8; height count*8+2. Source writes two-pixel side borders and two bottom rows in palette8, without a top border. Text fills row interiors opaquely.
- `0x12619..0x12658`: student FONT3H at DS4fd3, menu/minute/chooser FONT5H at4fc4. Renderer tests compare decoded glyph pixels, not browser platform fonts.

## Integrated composition and cursor scheduling

- `0xec11..0xed01`: FONT3H, PREFS, new-name label MSD2200 at(56,110), field(192,110).
- `0xef0c..0xf042`: PREFS name/goal/level/group use MSD2210/2220/2230/2400 at(64,70/90/100/110). Mode labels are MSD200..202, group labels300..305. Source text-grid conversion is8x10 for FONT3H.
- `0xf120..0xf138`, `0xf08c..0xf0c6`: GREET2/prefbox_1, source index1,40x50 at y130; x66/132/208 comes from DS:231e. No modern highlight rectangle is substituted. GREET2.GSO SHA256 `2cae0e3a843eb1efad570ec51f9e8ce64d5b174b3c9ce2b7f746419df9784e21`, GSK `57aff92c9e1d58b6a626bb68f5dce90df49f84a05aca2fc5ab1e63a54368ebc7`.
- `0x8d66..0x8e58`: duration labels x66, values x190, suffix MSD5000 after the two-character number; y70/90/110/130. LOAD uses its actual CRX buttons and the source name cells.
- `0x1b0de..0x1b0ea` passes4/2 to the cursor service; `0x1ae93..0x1aef0` waits once per countdown step through `0x192a2`. `createTextCursor/textCursorTick` implements changed-low-word inversion, shared with the retained activity wait observation. Input restarts the noninverted cell; missed host ticks never cause catchup.
- Source background/font/palette records come through the existing decoder and new inspector outputs. Every generated resource remains ignored. Host return paths restore the logical pointer and flush pending lesson input.

## Gaps and integration limits

- Native form validation/selection, browser event timing, focus suspension, storage and mouse imagery remain explicit host adaptations. The original DOS pointer raster is not drawn. Main/PREFS use fresh left presses; LOAD additionally samples held-left level on host ticks.
- Menu idle greeting/character animation and its RNG scheduling remain separate from this input controller. The small portrait rectangle emits `incomplete: menu-character-animation`, not invented animation.
- Cursor phase accepts an explicit inversion flag; the recovered4/2 counts are applied to sampled changed BIOS-low ticks, not a claimed exact browser cadence. Browser focus pause, pointer coordinate scaling and typematic are adapters, not recovered navigation rules.
- Host storage denial, partial DOS file handling, OS deletion failures, printer/certificate completion and process-exit cleanup are not simulated. Existing storage format stays unchanged; no migration or replacement exists.
- The frozen worker tests below were not browser integration. Current Phase4 Chrome/source/pixel checks are recorded separately; no executed-original differential or full-machine-equivalence claim follows.

## Frozen worker checks

Run from the isolated worktree/repository root, after the existing local resource bootstrap:

```sh
python3 -B transpile/tools/control/menu-inspect.py
node --test transpile/tests/control/*.test.mjs
node --test transpile/tests/{control,runtime,outdoor,worlds,render,app}/*.test.mjs
git diff --check
```

- Inspector passed pinned ZIP/EXE hashes; generated listings, raw tables and byte slices stay exclusively under ignored `transpile/.tmp/menu/`. This extra inspector is required before the new tests, including after applying this worker's files elsewhere.
- `structured_return`, `node-test-text`: final control suite33 passed; final full suite154 passed (33 control, including17 new widget tests).
- Tests prove source byte/table constants, pointer/key command parity for all19 dropdown entries, strict/inclusive hit boundaries, palette88 linear-address interception, source text bounds/accepted bytes/navigation, collision/default behavior, rename cancellation/delete ordering, numeric clamps/padding, chooser cancellation/pump/timing and real font/palette/caret pixels.
- Two initial renderer assertions failed: a normal-row letter begins with a foreground pixel, not a blank; FONT3H has shadow index2. Tests/helper were corrected against real decoded glyphs. Final commands passed. No original programs, root configuration, localStorage transport, commits, pushes, delegation, wiki or task writes occurred.
