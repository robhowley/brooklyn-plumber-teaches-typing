# Mario Teaches Typing browser recreation

## Source of truth
- Read `references/IMPLEMENTATION.md` and `references/README.md` before implementation.
- The implementation brief wins over historical uncertainty. Choose and document remaining low-risk gaps.
- Read the eight images in `references/images/` as visual references, never ship them as game assets.
- Manual is the scanned `references/manual-1992.pdf`; no searchable text extraction is available. Printed pages 8–20 correspond to PDF pages 9–21.

## Architecture and design
- New project: use Vite, vanilla JavaScript modules, CSS, Canvas 2D for newly drawn pixel scenes. No runtime framework/backend/accounts/external runtime assets.
- Separate the deterministic gameplay/course model from DOM, clock, storage, audio, and scene rendering. Keep the API small.
- Keyboard-first desktop game, responsive usable layout, visible focus, readable DOM targets/HUD, reduced-motion support. No decorative fake controls.
- Aim for the original DOS feel: saturated sky/cobalt, brick/grass/pipe scenery, warm yellow UI, purple menu accents, blackboard results. A cohesive pixel game cabinet, not a generic SaaS dashboard.
- Characters: Mario, Luigi, Princess. Newly drawn stand-in sprites and synthesized sound, label remaining placeholders and fan-recreation status.
- All four activities must feel distinct. Action worlds scroll continuously with active time; correct outdoor keys trigger nearby obstacle actions. Practice stays plain. Reduced motion uses stationary, immediately typable targets.

## Acceptance
- All four modes and defaults: outdoor 120s, underwater 300s, castle 300s, practice 600s. User duration overrides.
- Only correct characters advance. Normal-motion outdoor input accepts one exact key at contact (or buffers it until contact); missed targets return without penalties. Higher custom goals scale travel speed, without changing pass math. Incorrect printable characters count errors without advancing. Spaces count. Case/punctuation exact. Ignore modifier-only keys, Backspace, key repeat, composition and Ctrl/Meta shortcuts.
- WPM = correct / 5 / active minutes; accuracy = correct / attempted. At timeout pass requires attempts > 0, WPM >= goal and accuracy >= 90%. No early pass/death.
- Pause both input and timer for Escape, blur/hidden tab, and castle pipe transitions. Explicit resume. Background time must never be charged on resume.
- Guided course starts 5 WPM/home row. Six key selections: home row, add top, add bottom, add numbers, add symbols, all keyboard. Successful guided attempts enable Next; advancing is idempotent. After all keyboard, keep all keyboard and increment goal by 5.
- Guided mode is outdoor below 10 WPM, underwater from 10, castle from 30. Passing all-keyboard castle at 50 WPM graduates. Practice remains usable. Custom/off-course attempts never move course position.
- Profile, character, settings, course position, results, earned certificates survive reload via versioned/validated localStorage. Handle corrupt/unavailable storage without a crash. Failed/retried attempts preserve progress.
- Finger hints, live stats, target preview, results, retry/menu/Next, report card, world certificates and graduation.
- Generated text contains only the selected key set, including constrained words/sentences when full sentences are impossible. Document key mappings.
- Source, automated unit and browser gameplay tests, production `dist/`, README with run/build/deployment and assumptions/limitations.
- Browser tests must cover input, scoring/pass-fail, Next, graduation, pause/resume, reload. Test the production build over HTTP, not only dev.
- Play every mode through input/actions/results and the entire guided course; preserve screenshots and exact evidence. Distinguish automated browser interaction from human manual play.

## Worker discipline
- Stay within your assigned phase/files. No nested delegation or pushing.
- Use `structured_return` for tests/build, with compact reporters.
- Do not mutate another worker checkout. Return compact evidence with report/artifact paths, no raw diffs/logs.
- For substantive documentation, use the write-for-readers skill.
