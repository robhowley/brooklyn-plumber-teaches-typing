# Static DOS-to-JavaScript translation

## Goal
Read the supplied Mario Teaches Typing DOS archive as inert data, recover its behavior and assets, and produce a separately runnable JavaScript app. Preserve a checkable mapping from original bytes to translated behavior. The original program must never run.

## Acceptance criteria
1. All deliverables, scratch work, reports, screenshots, and tests are under `transpile/`. Existing app files remain unchanged.
2. Archive manifest and executable identity are hash-verified; extraction rejects unsafe paths and gives executable files inert names.
3. Analysis maps startup/menu/student/lesson/activity/results/progression transitions, input semantics, timers, scoring, failure conditions, animation, motion, and resource usage. Unknowns and assumptions remain visible.
4. Implement a useful browser-playable slice using original decoded art and lesson data, not the previous recreation's invented gameplay. Translate concrete recovered routines into readable JavaScript with source citations.
5. Do not claim a full decompilation or byte-for-byte behavioral equivalence. Unsupported activities and menu commands must not silently pretend to work.
6. Test extracted-data integrity, arithmetic/branch boundaries, timing and input behavior, state transitions, and browser operation. Browser tests run only the new JavaScript app.
7. Provide reproducible local extraction/build/serve/test commands, a concise entrypoint, detailed behavior mapping, and an assumption/coverage ledger.

## Evidence hierarchy
- Executable instruction bytes and resource bytes from the supplied ZIP.
- Verified disassembly and statically decoded tables/graphics/text.
- Existing manual/video research, clearly identified as secondary to executable evidence.
- Explicit minimal browser adaptations where host behavior cannot be reproduced.

## Parallel work
- `outdoor`: outdoor control flow, target/contact handling, scrolling, character animation and motion; recovered JavaScript routines and fixtures where warranted.
- `worlds`: water, castle and practice control flow, movement/hazards/input, timers, outcomes; recovered routines and fixtures where warranted.
- `control`: startup/menu/student/lessons, scoring/results/progression, keyboard/mouse/pause behavior; recovered routines and fixtures where warranted.
- `assets`: safe inventory/extraction and independently verified resource conversion, source metadata and reproducible scripts.

Workers use separate worktrees located under `transpile/.worktrees/`, read existing research by absolute path, and write only their assigned `transpile/` subtrees. A later integration worker builds the app from these artifacts, followed by an independent verifier. Assumptions are resolved and documented without stopping for questions.
