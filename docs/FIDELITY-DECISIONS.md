# Fidelity decisions and phase ledger

This is the running record for Phases 1–6 and the end-of-project review. Decisions D1–D8 are delegated browser-policy choices made under the user's instruction to use best judgment on all open items. They are not claims that the original executable's incomplete behavior has been recovered, and they were not individually selected by the user. The evidence and remaining limits are in [Phase 1](FIDELITY-PHASE-1.md), the [adoption plan](ORIGINAL-FIDELITY-PLAN.md), and [executable research](EXECUTABLE-RESEARCH.md).

**Phase 1 policy prerequisite: satisfied.** G1–G4 remain historically open. Their scoped browser fallbacks below are approved for implementation; no worker should ask again before continuing Phases 2–6. Phase 1's final exit check is limited to decision consistency, asset-checklist completeness, and test-vector completeness. It does not require false closure of G1–G4 or application tests.

## Durable decisions

D1–D8 have been reviewed against automated implementation and final independent review evidence. All six automated implementation and verification phases are complete. This review does not mean individual user approval, historical resolution of G1–G4, human playtesting or public-release approval. See the [final review](#final-automated-review-2026-11-10).

### D1. One new ruleset, fresh course, preserve the old record

**Choice.** Use one active new ruleset, with no old playable mode, dual engine, or opt-in legacy migration. Preserve the original v1 save and all names, characters, settings, per-mode times, results, certificates and certificate provenance. Archive the old course position and start the new course at 5 WPM/home row. Keep old results read-only and labeled by ruleset. Never recompute old passes, mix old/new rankings, revoke awards, or overwrite the only old copy. Corrupt or unavailable storage is not consent to discard or replace it.

**Evidence and reason.** The old validator accepts a different course shape (multiples of five and later all-keyboard positions) than recovered progression (integer goals and world resets); old and new scoring are not comparable. An explicit mapping would invent equivalence. Fresh start plus archival preservation is the least misleading path.

**Boundary.** The old course position is retained as history, not used to authorize a new-rules advance. Any failed conversion or storage write must leave the original recoverable.

**End review: complete within automated scope**, against implementation and final review evidence.

### D2. Recovered arithmetic with an explicit browser clock

**Choice.** Use `floor(max(0, correct - errors) * 182 / accumulatedTicks)` for WPM and `floor(100 * correct / attempts)` for accuracy, with zero for nonpositive ticks or zero attempts. Approximate ticks from one cumulative active clock as `floor(activeSeconds * 182 / 10)`; do not round each frame delta. Use safe JavaScript numeric state, reject invalid state, display/expire by active seconds, and pause browser clocks during Escape, blur/hidden-tab and pipe pauses. Resume resets the wall-clock baseline.

**Evidence and reason.** Net-error arithmetic and the constant 182 are in the static scoring routine. Tick sampling, all-mode pause coverage, midnight handling and exact elapsed conversion remain unproved. Cumulative active seconds is a bounded browser approximation, not a DOS timing claim.

**Boundary.** Do not emulate DOS overflow or claim that elapsed display exactly matches `floor(ticks * 10 / 182)`. Keep gameplay clocks independent from rendering.

**End review: complete within automated scope**, against implementation and final review evidence.

### D3. Conservative timeout eligibility and deferred Next

**Choice.** Eligibility is timeout, at least one attempt, integer WPM at or above goal, accuracy at least 90%, and no failure. Reaching the goal early does not pass. On the first eligible guided result, store an immutable pending snapshot. Only explicit Next commits it once, saves, and returns to the menu. Retries, reloads, stale or duplicate results cannot replace or recommit it. Custom/practice/off-course results cannot create or replace pending progress. Phase 3 enforces the same result eligibility rule for pending transitions, graduation and saved awards: only original/generated guided lesson results qualify. Explicit custom text remains ineligible even with `guided: true`; selected generated alternatives remain eligible.

Keep browser transition certificates on committed outdoor-to-water and water-to-castle advances. Retain manual graduation at an eligible guided all-keyboard castle assessment at goal 50. If an ungraduated castle increment would pass 50, offer the goal-50 assessment rather than skipping it. Award graduation once and clear pending.

**Evidence and reason.** Original advancement guards are only partly traced: no universal 90% or attempts-positive check is established, and configuration/abort lifecycle remains incomplete. A 90% positive-attempt guard is a conservative browser fallback, not recovered DOS policy. The original mutates course state before results; its Next message routes through a flag rather than committing the advance. The browser's immutable deferred commit is intentionally different and avoids duplicate/retry corruption.

**Known differences.** Original world certificates use strict achieved-speed comparisons (`achieved + 2 > 10` outdoors and `achieved + 5 > 30` in water); the castle `new goal >=45` branch establishes certificate availability, not graduation at 45. Browser transition awards and the 50-WPM assessment/overshoot safeguard are chosen browser policy, not original equality behavior.

**End review: complete within automated scope**, against implementation and final review evidence.

### D4. Reviewed historical text, visible notice, generated alternative

**Choice.** After reviewing every learner-facing ASCII string, historical text may ship verbatim with a visible notice for outdated claims and war, slavery, assassination and disaster content, plus an obvious generated-practice alternative. Do not modernize, censor, normalize or silently rewrite the historical wording. Keep source bytes and provenance separate from learner strings.

**Evidence and reason.** The recovered corpus contains period-specific factual claims and violent themes. Exact text is evidence; changing it while calling it original would misrepresent the source. A generated alternative lets students avoid the material.

**Boundary.** Full string review is a shipping prerequisite. This decision is not itself that review and does not authorize unreviewed strings or executable archive content.

**End review: complete within automated scope**, against implementation and final review evidence.

### D5. Deterministic source order and narrow generated fallback

**Choice.** Prefer original lesson text wherever its scored characters are supported by the assigned key group. Use deterministic source-order selection and restart the same sequence on retry. For all-keyboard, cycle through prefixes **H → T → B → N → S**, consuming each selected file in source order. This replaces recovered random initial selection as an explicit browser choice. Correct historical LETTERS membership rather than trusting the current `KEY_GROUPS` strings unchanged.

Use generated text only where a required-key group is incompatible with a source record, or where practice's scored-wrap/separator behavior remains unproved. Do not use a blanket generated-only policy. Phase 2 must publish an exact mode/group/record coverage matrix showing which records remain historical and which specific combinations/records need labeled generated fallback. Already proven examples: HWORDS records 1–6 exceed inferred home-row membership; TWORDS records 3–7 exceed inferred home-plus-top membership (records 1–2 fit). Sentence and additional word coverage must be classified from reviewed record contents before runtime selection. Label every fallback “Generated practice, not original lesson text.”

**Evidence and reason.** The executable selects H/T/B/N/S for lessons 1–5, chooses a random prefix for lesson 6, then reads in source order. Recovered LETTERS members prove punctuation omitted by current groups: B/N add `,./`; S adds `@#$%^&*+<=>[]_{}`. The original start is random, so deterministic retry is reproducibility, not historical behavior. The loader does not filter out-of-group words; silently filtering or presenting unavailable keys is not justified. Practice line layout is not a scored-separator contract.

**Boundary.** Preserve ASCII case, punctuation and wording. Keep parsed record/character cursors independent of raw byte offsets. Only correct accepted input advances a cursor. Do not claim complete original coverage until Phase 2's matrix and fixtures prove it.

**End review: complete within automated scope**, against implementation and final review evidence.

### D6. Non-destructive local student slots

**Choice.** Provide local New/Load/Edit student slots. Selecting or editing one must not destroy another student's profile/history; preserve the original v1 save through migration and storage failures. No backend, fake DOS path picker, or overwrite of the current student without explicit choice.

**Evidence and reason.** Student selection is part of the recovered presentation, and the user asked to preserve all settings/history. Separate local slots are the smallest browser adaptation that supports that flow without losing data.

**End review: complete within automated scope**, against implementation and final review evidence.

### D7. No early deaths; explicit timeout results and event order

**Choice.** Keep every early death disabled. G4's operation scope, browser-chamber mapping, clock conversion, grace/polling and terminal timing remain incomplete. Do not guess a Thwomp or quicksand death mapping. Preserve current nonterminal hazard feedback. Results must expose the terminal reason and actual active elapsed time, distinct from configured duration.

Keep event handling chronological: a buffered contact already due at the timeout instant is processed before timeout; timeout then closes the attempt, and no new keydown is accepted at or after expiry. If future evidence and a separate decision ever enable an early failure, its already-due failure event precedes same-instant contact, timeout and new input. Freeze active time/counters at that terminal event.

**Evidence and reason.** Static evidence establishes scoped predicates but not their browser state mapping. The two inactivity paths are not enough to infer a fatal threshold for the existing browser hazards. Disabling the unsupported terminal mechanic avoids false historical claims.

**End review: complete within automated scope**, against implementation and final review evidence.

### D8. Static archive visuals and explicit browser flow

**Choice.** Use suitable static archive backgrounds, sprites and fonts as primary art; adapt missing or incompatible pieces minimally, including missing character-face adaptations. Never copy the eight reference screenshots into production assets. Do not reuse archive audio until provenance, format and content have been reviewed; retain synthesized sound meanwhile. Public redistribution rights remain unverified. Never execute or ship archive code, scripts or runtime readers.

Retain browser scrolling/contact, reduced-motion behavior, explicit pause/resume and custom/practice isolation. In the normal guided menu, water is available from 10 WPM and castle from 30 WPM. Any unrestricted custom activity access must be labeled as a browser practice option. Use welcome → menu as the screen order, with no fabricated loading-progress screen.

**Evidence and reason.** Decoded static backgrounds and sprite records provide visual source material, but runtime placement, palette bindings and animation cadence need per-asset review. The eight screenshots are separate references, not approved assets. `LOAD` is a student dialog, not a progress loader. Existing browser accessibility and scrolling/contact are deliberate adaptations, not recovered DOS mechanics.

**Boundary.** The reviewed 20 static backgrounds and 166 sprites/glyphs are adopted with recorded provenance and disclosed palette, mask, face, placement and animation adaptations. Static-asset review does not establish redistribution rights or authorize archive audio; rights remain **UNVERIFIED**, and sound remains oscillator synthesis.

**End review: complete within automated scope**, against implementation and final review evidence.

### D8 follow-up: direct title-to-main-menu handoff (user decision, 2026-11-10)

**Choice.** Replace `TITLE → GREET welcome → browser menu` with `TITLE → reconstructed MAINMENU`. There is no legacy welcome option. Automatic title completion, Enter/Space skip and click skip all enter the same menu once; the completed title keeps its 800 ms browser hold. This supersedes D8's earlier welcome→menu startup order only.

Recreate the DOS menu as one 320×200 composition uniformly fitted at 8:5 and centered on black. Draw the adopted MAINMENU raster unchanged, then paint the runtime bar, greeting and dropdowns on that native raster. Keep real transparent HTML buttons/disclosures over matching coordinates for pointer, keyboard and assistive technology. Do not add the cabinet, site chrome, prose, or stacked web menu. Keep title art, gameplay, saved data and their existing handlers unchanged.

Use File, Student and Lessons menus for the recovered commands. Disabled or unimplemented File commands remain visible but do not act; explain browser-only options in Help. Selecting a Lessons group changes and saves only the student's activity setting. It must not start a lesson, change the goal, reset or advance the course, or clear earned pending progress. Existing browser-deferred Next remains a one-time commit and returns to MAINMENU.

**Boundary.** This is an explicit user-selected interface and handoff, not evidence that the original runtime used these exact hitboxes, focus colors, shortcuts, greeting truncation or disabled treatments. Do not rewrite earlier validation entries as evidence for this decision. Record separate test and screenshot evidence for the reconstructed menu; keep the reference screenshots out of production assets.

### D8 follow-up: direct level entry and short fade (user decision, 2026-11-10)

**Choice.** Hard-cut normal MAINMENU activity entry 1–4 over to the existing original-first start. Fade the outgoing menu for about 200 ms, then start gameplay. Do not show a source chooser, loading screen or artificial black hold. Reduced motion skips the fade; there is no opt-in to the old normal-entry flow.

**Notice placement.** Keep the historical notice and generated alternative easy to find in File → Help. This placement is the coordinator's choice, not a separately selected user policy. Help's existing guided and custom browser routes retain their source chooser and generated alternative.

**Retained differences.** Preserve deterministic original-first selection, labeled generated fallback for incompatible records, generated practice where wrapping remains unresolved, exact guided matching, gates, NEXT and retry behavior. Direct entry is a bounded flow change, not a claim of full original gameplay parity.

## Historical gate status

| Gate | Historical status | Approved implementation path |
|---|---|---|
| G1 clock | Open: sampling, exact pause coverage and elapsed conversion incomplete | D2 active-clock approximation; disclose it |
| G2 eligibility/course | Open: complete guard lifecycle and award semantics incomplete | D3 conservative browser guard, immutable deferred Next and explicit browser awards |
| G3 corpus | Open: practice scored separators and full typed coverage incomplete | D5 exact coverage matrix plus narrow labeled fallback |
| G4 failure | Open: state mapping and terminal timing incomplete | D7 keep early deaths disabled and report timeout reason/actual elapsed |

No delegated choice changes historical gate status. Historical closure is optional for implementation only where the decision explicitly adopts a scoped browser fallback; do not rewrite recovered evidence to make a gate appear closed.

## Phase acceptance ledger

The integration owner maintains this ledger after collecting worker evidence. Workers must return proposed status/evidence updates to the integration owner and **must not edit this file concurrently**. The integration owner alone appends or changes ledger entries after integration.

| Phase | Acceptance scope | Current status | End-of-project review |
|---|---|---|---|
| 1. Evidence and decisions | D1–D8 recorded; G1–G4 accurately remain open; asset checklist and decision test vectors complete; no false runtime/test claims | PASS, independent verifier 20261110T032747Z-1e9w5vbj; historical gates remain open | Complete, automated scope |
| 2. Corpus tooling and reviewed data | Byte-preserving evidence, reviewed ASCII strings, deterministic selector/cursor, exact historical/generated coverage matrix, behavior fixtures | PASS, independent corpus verifier 20261110T040019Z-bhgb6f18 (22 focused tests) | Complete, automated scope |
| 3. Engine, course and saves | D1–D3, D6–D7 implemented; migration preserves v1 and history, pending Next idempotent, scoring/clock/result contracts tested | PASS, independent model recheck 20261110T040213Z-a3okibc7 (50 scoped tests) | Complete, automated scope |
| 4. Original assets and minimal adaptations | D8 static assets reviewed and provenance recorded; minimal adaptations, accessible overlays, reduced-motion and rendering checks | PASS, independent asset verifier 20261110T040019Z-bhgb6f18; 8 asset tests rechecked 20261110T040213Z-a3okibc7 | Complete, automated scope |
| 5. Integrated student-to-results flow | Welcome/menu order, slots, notices, activity gates, custom labels, historical/fallback text, outcomes and reports integrated | PASS, independent verifier and second opinion 20261110T043125Z-c8wng0kz (61 Node + 38 browser, zero skips) | Complete, automated scope |
| 6. Production verification and documentation | Production HTTP checks, full guided course, asset/bundle audit, screenshots and human review record; limits and all decisions rechecked | Independent PASS, reports 20261110T045947Z-zo1h2pya/{01-verifier,02-second-opinion,03-verifier}.md (linked below): 51 browser, 46 screenshots, bundle/docs; coordinator source-backed Node rerun 61 passed; human review NOT PERFORMED | Complete, automated scope; final evidence below |

### Phase 1 exit evidence

The independent verifier at `/Users/roberthowley/.pi/subagent-runs/20261110T032747Z-1e9w5vbj/02-verifier.md` returned PASS for decision consistency, checklist and vector completeness after the stale D1 wording was corrected. This is a Phase 1 documentation exit, not historical closure of G1–G4. The literal vectors in [Phase 1](FIDELITY-PHASE-1.md) are specifications, not evidence of execution. That docs-only closure ran no application tests, build, browser play, archive execution or audio playback.

### Phases 2/3/4 integration, 2026-11-10

**Candidates integrated; Phases 2/3/4 subsequently passed independent verification (see ledger and recovery entry below).** Only the corpus, model and static-art candidates from `/tmp/original-fidelity-implementation.shaIzq/{corpus,model,assets}` were copied. Existing documentation changes were preserved. No app, browser test, tracked build, README or research-source changes were made.

#### Corpus and cursor decision

- `selectLesson({mode,keyGroup,goal,content})` defaults to original-first selection; `content: 'generated'` is the explicit alternative. `KEY_GROUPS` now has the existing consumer shape `{name,keys}` and one definition, re-exported by the engine. `CORPUS_VERSION` also supplies profile defaults.
- `createAttempt({mode,group,goal,content,...})` calls that selector by default. It also accepts `lesson: selectLesson(...)`; `text` remains an explicitly labeled custom-text input, never a default fixture. The duplicate generator and `generated-model-fixture-v1` default were removed.
- Lesson `requiredKeys` is a sorted string. Records retain half-open scored `start/end` offsets, source/fallback metadata and sentence boundaries. No synthetic separator is inserted; no raw-byte offset drives typing.
- The engine alone owns `attempt.cursor = {recordIndex,characterIndex}`. Accepted input advances within the selected record bounds; wrong/ignored/buffered input does not. Exhaustion wraps the complete selection; retry starts record zero. There is no second selector cursor or cursor helper framework.
- Acceptance tests now feed actual selector output through the engine for all 24 mode/group combinations and both content choices, consuming two complete cycles, checking each record boundary, wrong keys, retry, exact separator acceptance and preserved metadata. Castle pipe pauses are explicitly resumed without consuming text.
- Coverage remains per-record: outdoor preserves all corresponding records; water preserves H none, T records 1–2, B/N/S all; castle preserves H/T/B none, N record 2, S all. All-keyboard consumes every historical member H→T→B→N→S. Practice uses labeled generated text while scored wrapping remains unresolved. Source review covers 136 records, 15 members and 24,090 bytes, including the historical-content notice.

#### First-earned result and saved order

- `recordResult` assigns each new-rules result an append-only `sequence` independent of timestamps and array placement. Save validation requires the stored order to match consecutive sequence values; pending validation uses that order to bind the first eligible success.
- Certificates also bind the first eligible success at the earning position; graduation additionally binds the current course revision. Faster retries, reordered genuine results and later/future-revision successes cannot replace the saved earning result through supported validation.
- Regression tests reject reordered/rebound pending progress and graduation certificates, preserve the original award across retry/save/reload, and exercise recovery on invalid saves. This checks structural save consistency, not cryptographic authenticity against someone rewriting all local JSON fields.

#### Static asset selection

- Retained 20 backgrounds and 166 sprites/glyphs (186 selections). Removed all three unused `run0009` sprites and unused `FONT7H-font7_32`; the three-frame run sequence and browser space cue already cover their roles. Importer, raster data, provenance and tests agree.
- `drawScreen(canvas,family)` draws at 320×200 and returns `SCREEN_LAYOUTS` overlay bounds; `drawScene` draws at 640×400. Rendering remains model-read-only, cached and independent of sound settings.
- Luigi/Princess practice faces remain browser adaptations; named palette bindings and index-zero masks remain inferred. FONT7H uses a white core (index 1) and black outline (index 2) based on screenshot appearance, not a proved DOS runtime palette. Castle sand/pipe, placement and animation cadence remain browser adaptations. OCASTLE/ENDF availability proves no original trigger. Rights remain unverified. No archive code or audio was executed or shipped.

#### Checks and later-phase handoff

- Source-backed command: `LESSON_RESEARCH_ROOT=/Users/roberthowley/src/github.com/brooklyn-plumber-teaches-typing/research/executable-1992 ORIGINAL_FIDELITY_SOURCE=/Users/roberthowley/src/github.com/brooklyn-plumber-teaches-typing node --test tests/lessons.test.js tests/engine.test.js tests/course.test.js tests/scrolling.test.js tests/storage.test.js tests/original-assets.test.js` returned **57 passed, no skips**. Log: `.pi/structured-returns/2a5a2f73-ac20-410e-8ea8-58714203ddeb.combined.log`.
- Both repository-authored offline importers were rerun against retained research data. Lesson regeneration matched all pinned evidence; asset regeneration compared all 186 source PNGs before documented adaptations. Logs: `.pi/structured-returns/93c1bc4e-2975-4514-8bcf-a366cf0ab143.combined.log` and `.pi/structured-returns/d9eb85a4-c6d6-4f38-bb78-14c419780e98.combined.log`. `git diff --check` passed.
- At this integration checkpoint, Phase 5 still needed to update `src/app.js` to pass `studentId: profile.id` and `courseRevision: profile.course.revision`, select/pass the chosen lesson or `content`, and use `recordResult` once at timeout and `advanceCourse` only on explicit Next. The old app currently omits identity, so completed lessons cannot yet be recorded. Use `loadStore/currentStudent/createStudent/selectStudent/editStudent/saveStore`, expose recovery/quota states, render historical/fallback notices, separate legacy/new rankings and reset wall-clock baselines on resume.
- Phase 5's assigned scope was welcome→menu, activity gates, semantic overlays/focus, `fingerHint(key,mode)`, actual elapsed/reason reporting, and updates to `tests/integration.test.js` and browser assertions. The old title browser test expects a 720×450 screenshot crop and timed fades; replace it with archive 320×200 static-welcome expectations and browser checks.
- Phase 6 owns rebuilding/auditing the stale tracked `dist/` screenshot bundle, production HTTP flows, screenshot evidence and final documentation. No browser/build/production acceptance is claimed by this integration run.

### Phase 5 recovery and validation, 2026-11-10

**Integrated flow independently PASS; Phase 6 remains.** The timed-out app implementation was retained and repaired, not restarted. Phases 2 and 4 passed in `/Users/roberthowley/.pi/subagent-runs/20261110T040019Z-bhgb6f18/{01-verifier,03-verifier}.md`; Phase 3 passed after its custom-source eligibility fix in `/Users/roberthowley/.pi/subagent-runs/20261110T040213Z-a3okibc7/02-verifier.md`. These exits do not close historical G1–G4 or the final D1–D8 review.

#### Integrated behavior and fixes

- App uses student IDs/course revisions, storage slots, source selection, one result recording at timeout and explicit Next. Browser checks cover New/Load/Edit and selected-student reload, normal activity gates and labeled custom bypass, historical notice/generated alternative, first-earned pending across failed retry/reload, corrupt-data preservation, session-only warnings and legacy reports/awards.
- Activity now has an explicit `label for` association. The helper selects its named combobox rather than relying on a wrapping label whose accessible name included option text.
- Lesson times display saved minutes. Editing minutes clears the seconds override; explicit seconds still take precedence and persist. Reload/reopen tests cover both, without manually clearing the old override first.
- Gameplay starts/resumes with focus on the typing surface. Space/Enter on focused buttons retain native activation instead of becoming typing attempts. Regression tests activate Keyboard help, Pause and Resume with Space, then verify that Space on the typing surface still counts.
- Mobile archive gloves are smaller at narrow widths. This fixes real HUD overflow at 390px without clipping statistics; all four scene widths and enlarged-menu checks pass.
- Report tables have separate accessible names. The legacy test now targets the legacy table rather than an ambiguous pair of `tbody` elements. Non-ASCII rejection dispatches a keyboard event because Playwright `keyboard.press('é')` rejects that key before reaching the browser; ordinary typing and certificate earning use real keyboard input.
- A valid lesson-six outdoor fixture earns a new award through 20 real keys spaced by 900ms of controlled active time, followed by timeout at 20 seconds (10 WPM). It verifies no award before Next, the committed water/home-row transition, reload, source-aware report, certificate provenance/download and both print actions. No result insertion or in-session course mutation is used. Print checks verify dispatch to `window.print`, not the native print dialog or paper layout.

#### Reproducible checks

Run from the repository root:

```sh
LESSON_RESEARCH_ROOT="$PWD/research/executable-1992" ORIGINAL_FIDELITY_SOURCE="$PWD" node --test tests/*.test.js
node_modules/.bin/vite build --outDir .tmp/phase5-dist --emptyOutDir
FIDELITY_DIST=.tmp/phase5-dist PLAYWRIGHT_PORT=4185 PLAYWRIGHT_JUNIT_OUTPUT_FILE=.tmp/phase5-recovery-3.xml node_modules/.bin/playwright test --workers=2 --max-failures=3 --timeout=15000 --reporter=junit
```

- Final Node suite: **61 passed, 0 failed, 0 skipped** with both source-verification variables set.
- Current temporary Vite build: **passed**. Playwright serves that exact output, with strict port binding and server reuse disabled; existing port-4173 processes were left alone. The worker's diagnostic port-4186 server was stopped.
- Final browser suite: **38 passed, 0 failed, 0 skipped**, JUnit `.tmp/phase5-recovery-3.xml`; screenshots in `.tmp/test-results/playwright/`.
- Earlier bounded runs: `.tmp/phase5-recovery-1.xml` had **2 passed, 3 failed, 33 not run** (mobile HUD overflow); `.tmp/phase5-recovery-2.xml` had **29 passed, 3 failed, 6 not run** (ambiguous report locator, unsupported Playwright key name, incorrect expected source wording). All resolved before the final complete run. Counts come from testcase elements because the compact JUnit parser incorrectly counted skipped cases as passed in failed runs.
- No model, asset, README or tracked `dist/` changes were needed for recovery. No archive execution or audio validation occurred.

#### Independent Phase 5 exit

`/Users/roberthowley/.pi/subagent-runs/20261110T043125Z-c8wng0kz/01-verifier.md` reports PASS (61 Node and 38 browser, zero skips). `02-second-opinion.md` in the same directory reports LGTM/Phase 5 PASS. Together with the Phase 1–4 paths above, Phases 1–5 have independent PASS evidence. Neither report claims complete-course or human review.

### Phase 6 static bundle and documentation audit, 2026-11-10

**Scoped audit PASS; full-course production evidence pending integration; human review NOT PERFORMED.** The integration owner supplied the rebuilt production `dist/` from `./node_modules/.bin/vite build`. This worker did not rebuild or modify runtime/tests/dist. HEAD `9a42074703b5f445240378d8ca033c4ef11e8143` has dirty source changes; commit identity alone does not identify this build.

- Evidence: `.tmp/fidelity-validation/bundle-audit.json`, reproducible by `.tmp/fidelity-validation/audit-bundle.mjs`; exact inventory/hashes and scope are in [Validation](VALIDATION.md). Four output files, 16 runtime dependencies and 22 hashed source/config/provenance files are recorded.
- Parsed production JS as data, including static JSON.parse payloads: all 186 raster objects match current source hashes and all 136 reviewed learner strings occur in the bundle. The actual graph excludes raw research, old screenshot/traced art, provenance manifests and offline importers. No archive EXE, driver, installer, script, runtime archive reader/DOS decoder or unreviewed archive payload was found in that scope.
- Local asset audit PASS. The SVG namespace URL is not an asset request; documentation/source links do not imply runtime downloads. Live HTTP identity/request evidence remains final integration work.
- Source-backed art/corpus recheck PASS: 21 tests, zero failures/skips, log `.pi/structured-returns/093c1f3a-37d6-4970-9823-51deed5cf838.combined.log`. Retained archive hash matches both provenance families. No archive code/scripts or audio was executed.
- Documentation now describes actual net-error formula, active-clock approximation, immutable deferred Next, world resets, save v2/fresh archived course, local student slots, content notice and exact original/mixed/generated selector coverage. Welcome is static 320×200 archive art; palette/mask bindings, missing practice faces, timing/placement and synthesis remain disclosed adaptations. Public redistribution rights remain **UNVERIFIED**.
- Completion reporting decision: after actual final automation passes, describe automated implementation completion with human play explicitly unperformed. Do not claim public-release approval, human-playtested status or DOS runtime validation. Agent visual inspection, automated keys, fake clocks and print-dispatch assertions are not human reviews.

**At this earlier audit checkpoint:** production HTTP/full-course reports and the D1–D8 integration review were pending. The following integration entry supplies that evidence without changing historical G1–G4 or the human-review record.

### Phase 6 integration and visual fixes, 2026-11-10

**At this integration checkpoint: automation PASS; independent Phase 6 verification was pending (completed below). Human review NOT PERFORMED.** Read all three workstream reports in `/Users/roberthowley/.pi/subagent-runs/20261110T043609Z-uv7srhwd/`. The initial full-course workstream passed but the independent visual review failed focus, HUD bounds and empty panel composition. Those findings were repaired in the base checkout, not hidden by replacing it with the worktree snapshot.

- Copied only `tests/browser/fidelity-course.spec.js` and `scripts/fidelity-validation.mjs`; preserved the entire private acceptance evidence under `.tmp/fidelity-validation/acceptance-before-visual-fixes/`. Root audit and `visual-review/` evidence remain intact.
- Focus choice: the app ignores typing from buttons, links, summaries and form/editable controls. Native Space/Enter remains browser-owned. Start/resume/help-close focus the actual typing surface; existing shortcut/form behavior remains covered. Four new mode tests verify letters, shifted letters, Space/Enter, zero counter changes and subsequent real typing.
- Layout choice: reuse `SCREEN_LAYOUTS` and one native-coordinate style function, not a new layout framework. Actual DOM content occupies PRACTICE, LESSTIME, BLACKBRD, PREFS, LOAD, HELP, RCARD, CERTIF and GREETBG panels. Scrollable panels preserve readable 14–16px text at narrow widths; decorative art is not replaced with a separate card or duplicate Canvas text. Practice bounds changed to `[27,94,266,100]` to fill the observed recovered white region. No raster, corpus or gameplay-model changes.
- HUD choice: zero-minimum grid tracks and wrapping labels prevent min-content overflow; at component widths below 540px the hand guide occupies its own row above two statistics columns. Assertions test each statistics component against cabinet bounds at 390/720/1280px, not just document overflow.
- Checks: bounded runner **51 passed**; complete final `node scripts/fidelity-validation.mjs` **51 passed, zero failures/skips** (38 existing + six acceptance + seven focus/geometry). Source-backed `LESSON_RESEARCH_ROOT="$PWD/research/executable-1992" ORIGINAL_FIDELITY_SOURCE="$PWD" node --test tests/*.test.js` **61 passed, zero failures/skips**. The preliminary environment-free 59-pass/two-skip run is not source proof.
- Tracked `dist/` rebuilt with Vite after final source edits; reviewed repository-authored static audit rerun into `phase6-final/bundle-audit.json`. All 186 raster hashes, 136 learner strings and payload-exclusion checks pass. One additional production-identity browser test passes against actual tracked output; every private/tracked output hash matches. Current HTTP at 4173 and 4175 matches final disk bytes. Stale Phase 5 preview at 4173 was replaced; unrelated historical worktree port 4189 was left alone.
- Evidence: `.tmp/fidelity-validation/phase6-final/` contains JSON/JUnit, command/build logs, all-test traces, complete route records, certificate downloads, source/browser/ruleset/corpus/build hashes, final audit and tracked-build HTTP identity. Screenshots include native-panel geometry and scrolled time/result content at 390/720/1280px. `phase6-first-full/` preserves the earlier complete integration run; the final run includes the compact time controls. Exact inventory is in [Validation](VALIDATION.md).

#### D1–D8 integration review (not an independent verdict)

| Decision | Actual integration evidence and remaining qualification |
|---|---|
| D1 | Existing migration/recovery/save tests pass; v1 history stays separate and new-course behavior unchanged. No migration change in this phase. |
| D2 | Full routes use controlled active time and net-error integer WPM; pause/resume tests pass. DOS sampling, pause coverage and elapsed conversion remain G1 approximations. |
| D3 | Normal/reduced fresh routes cover groups, goals 7/9, resets, immutable pending across failed retries/reloads, single Next, exact-50 success/retry and separate 48→50 overshoot. Browser 90%/positive-attempt timeout guards, deferred Next and award triggers remain deliberate differences (G2). |
| D4 | Historical notice and generated choice remain present; actual bundle contains all 136 reviewed strings. No historical text edited. |
| D5 | Coverage unchanged: outdoor all original; water H generated, T records 1–2 original/3–7 generated, B/N/S original; castle H/T/B generated, N only record 2 original, S original; all-keyboard action modes original; practice wholly generated because scored wrapping remains unresolved (G3). Explicit generated alternative stays available. Source-order/retry are deterministic browser choices. |
| D6 | New/load/edit, literal student strings, reload, session-only/recovery and separate history/certificates pass. Panel placement changes neither form values nor storage semantics. |
| D7 | Timeout reason and actual elapsed/configured limit remain in the blackboard DOM. Early deaths remain disabled; hazard-state/terminal mapping is still G4. |
| D8 | Original assets remain primary; no reference image enters production. FONT7H index 1 white cores and index 2 black outlines are screenshot-informed browser colors, not a proved DOS runtime palette. Character palette/index-zero masks, Luigi/Princess practice faces, placement/scaling/cadence, scrolling/contact, castle sand/pipe and practice mood bands remain adaptations. Browser keyboard/reflow checks pass; independent visual review was pending at this checkpoint and subsequently passed (see final review below). |

### Final automated review, 2026-11-10

**All six automated implementation and verification phases complete; D1–D8 reviewed against implementation and final evidence.** Independent reports under `/Users/roberthowley/.pi/subagent-runs/20261110T045947Z-zo1h2pya/`:

- [Production verifier](/Users/roberthowley/.pi/subagent-runs/20261110T045947Z-zo1h2pya/01-verifier.md): PASS, **51 browser tests, zero failures/skips**, all four tracked/served output hashes match. Evidence: [final-verifier/](../.tmp/fidelity-validation/final-verifier/).
- The independent verifier's Node run was **59 passed, zero failures, two optional provenance skips**, not 61. Separately, the coordinator subsequently reran `LESSON_RESEARCH_ROOT="$PWD/research/executable-1992" ORIGINAL_FIDELITY_SOURCE="$PWD" node --test tests/*.test.js` via `structured_return`: **61 passed, zero failures/skips**.
- [Independent visual review](/Users/roberthowley/.pi/subagent-runs/20261110T045947Z-zo1h2pya/02-second-opinion.md): LGTM/PASS, **46 fresh screenshots**, all four modes and three characters at desktop, 720px and 390px. Evidence: [final-visual/review.json](../.tmp/fidelity-validation/final-visual/review.json).
- [Bundle/documentation verifier](/Users/roberthowley/.pi/subagent-runs/20261110T045947Z-zo1h2pya/03-verifier.md): PASS. Evidence: [phase6-final/bundle-audit.json](../.tmp/fidelity-validation/phase6-final/bundle-audit.json); inventory, reproduction and limitations: [Validation](VALIDATION.md).

These reviews complete the automated scope, not individual user approval of D1–D8 or historical closure of G1–G4. Earlier checkpoint notes and pre-fix failures above remain provenance.

Public redistribution rights remain **UNVERIFIED**. Sound remains optional oscillator synthesis, not archive audio. No archive executable/script or audio was run. Human keyboard play, visual approval, native browser-zoom UI, screen-reader listening, audible sound and physical print review were **NOT PERFORMED**. Agent screenshots, fake clocks and print dispatch do not replace those reviews; no DOS runtime validation or public-release approval is claimed.
