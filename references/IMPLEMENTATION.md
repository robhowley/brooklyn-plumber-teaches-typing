# Browser typing-game implementation brief

Build a browser-based single-page app (SPA) recreating the original DOS typing course, not the NES campaign or CD-ROM story. Players open a public URL and play, with no native application or installation.

## Preserve
- Four modes: outdoor character targets, underwater words, castle sentences, and plain practice.
- Correct characters advance the target and trigger movement/actions; wrong characters count as errors without advancing.
- Character selection, finger hints, live statistics, results, certificates, and the 50-WPM castle graduation milestone.
- Use `README.md`, `images/`, and the manual as references; begin with newly drawn or placeholder pixel art and simple sound effects.

## Proposed defaults where evidence is incomplete
- Attempts last 2/5/5/10 active minutes respectively; allow duration overrides.
- Pass at timeout when WPM meets the goal and accuracy is at least 90%; otherwise offer retry without losing progress.
- WPM = correct characters / 5 / active minutes; accuracy = correct / attempted characters, including spaces. Zero attempts cannot pass.
- Start at 5 WPM with home row. Each course pass unlocks the next key group; after passing All Keyboard, retain it and raise the goal by 5 WPM.
- Guided mode switches to underwater at a 10-WPM goal and castle at 30. Passing an all-keyboard castle attempt at 50 WPM earns graduation; practice remains available afterward.
- Allow manual goal/mode selection; practice and off-course attempts do not advance the guided course.
- Hazards visibly reflect performance but do not end attempts early. No lives or inactivity death in the first version.
- Pause timer/input during pipe transitions, on Escape, and on lost browser focus; require explicit resume.
- Generate text using only the selected key set. Match case and punctuation; ignore modifier-only keys, Backspace, and held-key repeat.

These are recreation choices, not claims about the original.

### Implementation addendum, 2026-11-09

The requested scrolling revision supersedes stationary-only movement: action worlds travel with active time. Outdoor exact keys resolve at nearby contact, with one early/late key buffered for the same returning target. Misses add no penalties. Reduced motion remains stationary and immediate. Custom outdoor goals scale speed without changing scoring, course or persistence. Short overrides can expire before first contact. These are user-requested recreation rules, not newly verified DOS behavior; details are in `../docs/SCROLLING-BEHAVIOR.md`.

## Delivery
- Deliver a static HTML/CSS/JavaScript build deployable to a standard web host, with deployment instructions. All screens and gameplay run within the SPA.
- Keyboard-first gameplay; save profile, settings, course position, and results in localStorage. No accounts or backend.
- Build one complete outdoor play-to-results loop first, then other modes, progression, and persistence.
- Done means all four modes work; tests cover input, scoring, pass/fail, Next, graduation, pause, and reload; manually play the full flow and verify the production build loads and saves progress when served over HTTP(S).
