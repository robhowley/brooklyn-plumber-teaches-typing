# Team implementation prompt

Build a working browser-based single-page app recreating the feel and gameplay of the original Mario Teaches Typing. Players should open a URL and play. Deliver a static build suitable for hosting online, not a native app, emulator, or mockup.

## Read these files
1. `IMPLEMENTATION.md`: build specification, including our deliberate assumptions.
2. `README.md`: detailed gameplay research, progression, win conditions, and historical uncertainties.
3. `images/`: eight screenshots for scene composition, menus, HUD, and results.
4. `manual-1992.pdf`: primary reference when needed, especially printed pages 8–20.

When the research and implementation brief differ, follow the brief: it intentionally resolves uncertain behavior. Make reasonable decisions for remaining gaps and document them rather than restarting the research.

## Build
- All four activities: outdoor character targets, underwater words, castle sentences, and plain practice.
- Make typing visibly drive character movement and obstacle interactions. This should feel like a game, not a typing form with a decorative background.
- Include character selection, finger guidance, live statistics, results, six keyboard selections, guided progression, certificates, and graduation.
- Follow the brief's scoring, pass/fail, timing, pause, and progression rules.
- Persist settings and progress in localStorage. No accounts or backend.
- Use the screenshots as visual references, not ready-made game assets. Start with newly drawn or placeholder pixel art and simple sound effects; identify remaining placeholders.
- Do not add the NES campaign, CD-ROM story, or sequel features.

## Execution and completion
Build the outdoor play-to-results loop first, then complete the other modes and course progression. Choose a simple stack that produces static web assets, following existing project conventions if present.

Deliver source code, automated gameplay tests, production build, and run/build/deployment instructions. Test input handling, scoring, pass/fail, Next, graduation, pause/resume, and saved progress after reload. Manually play each mode and the course flow; verify the production build served over HTTP(S), not just the development server.

Finish with what works, checks actually run, remaining limitations, and how to host it. Do not stop at a plan, screenshots, or one playable mode.
