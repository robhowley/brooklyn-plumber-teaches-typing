# Browser typing-game implementation brief

Build a browser-based single-page app (SPA) recreating the original DOS typing course, not the NES campaign or CD-ROM story. Players open a public URL and play, with no native application or installation.

## Implemented policy and validation status

Phases 1–5 independently pass; Phase 6 production verification is in progress. Delegated choices D1–D8 and evidence/review status are in [Fidelity decisions](../docs/FIDELITY-DECISIONS.md); they were made under the instruction to use best judgment, not selected one by one by the user. G1–G4 remain historically open within their scoped browser alternatives. All early deaths remain disabled. [Validation](../docs/VALIDATION.md) records current behavior, exact coverage and remaining evidence; human review was not performed.

**D1, implemented hard cutover and save treatment:** use one new ruleset, with no old playable mode or dual engine. Preserve the original v1 save and all profiles, settings, results, certificates and provenance. Archive the old course position and start fresh at 5 WPM/home row. Never overwrite the only copy; corruption or unavailable storage does not authorize discard.

**D8, implemented archive-asset direction:** use suitable static archive screens, sprites and fonts as primary assets, with minimal browser/accessibility adaptations. Convert selected resource data offline into local browser assets. Never execute, emulate, source, import, or load archive members as code; ship no EXEs, drivers, installers, scripts, DOS decoder, or runtime archive reader. Public redistribution rights are unverified. The eight files in `references/images/` remain references, not production assets. The old screenshot-derived title is no longer a runtime dependency. The welcome now uses static 320×200 archive artwork; 20 backgrounds and 166 sprites/glyphs are selected. Archive audio remains excluded; sound is synthesized. See [Scene art](../docs/ART.md) for actual assets and adaptations.

## Preserve
- Four modes: outdoor character targets, underwater words, castle sentences, and plain practice.
- Correct characters advance the target and trigger movement/actions; wrong characters count as errors without advancing.
- Character selection, finger hints, live statistics, results, certificates, and the 50-WPM castle graduation milestone.
- Treat `README.md`, the manual, and the eight screenshot files under `references/images/` as references, not as production art. The current runtime artwork and its provenance are listed in [the asset checklist](../docs/FIDELITY-ASSET-CHECKLIST.md) and [Scene art](../docs/ART.md). Current screen composition follows the static archive-asset policy above, with per-asset provenance and disclosed adaptations.

## Implemented delegated browser choices

- **D2, scoring and time:** use net-error WPM `floor(max(0, correct-errors)*182/ticks)` and integer accuracy `floor(100*correct/attempts)`. Approximate ticks from cumulative active seconds as `floor(seconds*182/10)`; use active seconds for expiry, safe numeric state, and pause browser clocks during Escape, blur/hidden tab and pipe transitions. G1 remains historically open; disclose the approximation.
- **D3, eligibility and progression:** keep timeout, attempts>0, integer WPM≥goal, accuracy≥90%, and no failure as a conservative browser fallback. Preserve the first successful pending result; explicit Next commits once and returns to menu. Keep transition certificates and goal-50 graduation as browser policies; offer a 50-WPM assessment rather than skipping it on an overshoot. Original advancement occurs before results, original Next routes rather than commits, and original certificate equality differs. Do not describe these browser rules as recovered behavior.
- **D4, lesson text:** review every learner string before shipping, preserve historical ASCII wording, display a notice for outdated claims and war/slavery/assassination/disaster content, and offer generated practice. Do not modernize the original wording.
- **D5, lesson selection:** use source-order deterministic replay and retries; all-keyboard uses H→T→B→N→S, a browser alternative to original random starts. Correct proven LETTERS membership. Prefer original records where their key requirements fit; generated practice is limited to incompatible required-key records/groups and unresolved practice scored-wrap gaps. Publish an exact mode/group/record coverage list.
- **D1/D6, students and saves:** local New/Load/Edit slots are non-destructive. Preserve the v1 save/history/provenance, archive the old position, and begin the new course at 5 WPM/home row. No dual ruleset.
- **D7, failures and results:** keep all early deaths disabled because G4 does not prove browser state/terminal mapping. Show timeout reason and actual active elapsed time; process due buffered contact before timeout and accept no new key at expiry.
- **D8, access and flow:** guided water/castle access starts at 10/30 WPM. Label any unrestricted custom activity access as a browser practice option. Retain scrolling/contact, reduced motion, pause/resume and custom/practice isolation. Use welcome→menu with no invented loading screen. Keep archive audio out until reviewed and rights unverified.

These are delegated recreation choices, not claims about original behavior. Read the decision log for evidence, caveats and end-review status.

### Implementation addendum, 2026-11-09

The requested scrolling revision supersedes stationary-only movement: action worlds travel with active time. Outdoor exact keys resolve at nearby contact, with one early/late key buffered for the same returning target. Misses add no penalties. Reduced motion remains stationary and immediate. Custom outdoor goals scale speed without changing scoring, course or persistence. Short overrides can expire before first contact. These are user-requested recreation rules, not newly verified DOS behavior; details are in `../docs/SCROLLING-BEHAVIOR.md`.

### Gameplay feedback addendum, 2026-11-09

A partial quicksand pose existed; it now has actual active-time sinking, raised-arm struggle and recovery, with foreground sand occlusion. Normal motion sinks at 3 scene px/s, recovers at 12 px/s while a correct-key lift interval lasts (`elapsed + 4 / goal` seconds), and clamps depth to 0–22 px. Keys refresh rather than accumulate lift; stale cumulative WPM does not prevent idle sinking. Arms alternate at three phase changes/s above 5 px depth. Reduced motion stays static between correct keys, using `22 × max(0, 1 − WPM / goal)` depth, initially 22. Paused and finished animation uses frozen active time.

Practice expressions for all three characters use WPM only: neutral at elapsed zero, sad below 75% of goal, neutral below goal, happy at/above goal. Results retain all metrics/actions, add pass-only victory styling and a discrete accessible announcement, and explain no-input, low-speed or low-accuracy failures.

These animation rates, thresholds and presentation choices are not recovered DOS rules. No death timers are asserted. The current runtime retains no early pass/death, the 90% timeout rule, outdoor ASCII case folding/exact input elsewhere, scrolling and explicit pause/resume. Original-first reviewed text now replaces generated-only selection, with exact generated gaps disclosed. Save v2 preserves v1 history, archives its course position and starts a new 5-WPM/home-row course. Deferred Next uses achieved-speed increments and resets to home row on world entry. Historical evidence, conflicts, corpus findings and unknowns are in [the fidelity audit](../docs/GAMEPLAY-FIDELITY.md); delegated choices are in [the decision log](../docs/FIDELITY-DECISIONS.md).

## Delivery
- Deliver a static HTML/CSS/JavaScript build deployable to a standard web host, with deployment instructions. All screens and gameplay run within the SPA.
- Keyboard-first gameplay; save profile, settings, course position, and results in localStorage. No accounts or backend.
- Build one complete outdoor play-to-results loop first, then other modes, progression, and persistence.
- Automated implementation completion requires passing production-HTTP input, scoring, pass/fail, full-course Next/graduation, pause and reload evidence. Human full-flow/visual/accessibility/print review remains separately recorded as not performed, not silently satisfied by automation. This is not a public-release or human-playtested claim.
