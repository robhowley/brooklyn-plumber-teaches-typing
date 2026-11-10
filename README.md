# Brooklyn Plumber Teaches Typing

![Original Mario Teaches Typing title screen](src/assets/title/title.png)

Mario Teaches Typing, a 1992 MS-DOS classic, recreated as a single page web app.

**[Play in your browser](https://brooklynplumberteachestyping.dad)**

Static HTML, CSS and JavaScript. Four typing activities, guided lessons, report cards and certificates. Progress stays in your browser. No backend or accounts.

Ground up rebuild, not a emulator.

## Run locally

Requires Node.js with ES modules and JSON import attributes, plus npm.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Deploy the generated `dist/` directory to a static HTTP(S) host. Assets are local; no runtime downloads or backend are needed.

```sh
npm test
npx playwright install chromium # unless using an installed Chrome
npm run test:browser            # build first; tests serve dist/ over HTTP
```

Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` or `CHROME_PATH` for a local browser. Source-provenance checks additionally need the retained research files and environment variables documented in [validation](docs/VALIDATION.md).

## Fidelity and limits

- Static 1992 archive art: 20 backgrounds and 166 sprites/glyphs, with browser layout, palette/timing and missing-face adaptations. The app's welcome is a static 320×200 archive composition, not the historical screenshot shown above. [Art provenance](docs/ART.md).
- Original-first reviewed ASCII lessons include outdated claims and war, slavery, assassination and disaster content. A visible notice and generated alternative are provided. Incompatible records and practice use labeled generated text; [exact coverage](docs/VALIDATION.md#exact-original-first-coverage).
- Net-error scoring uses `floor(max(0, correct-errors)*182/ticks)` with browser active-clock ticks. Passing requires timeout, goal WPM and 90% accuracy. Next commits earned progress once; world entry resets to home row. Early deaths are disabled.
- Save v2 supports local New/Load/Edit students. Existing v1 saves and results/awards are retained as history; the new course starts fresh at 5 WPM/home row. Custom/practice cannot advance it. Browser storage is local, not an account or tamper-proof backup.
- Sound is synthesized, not archive audio. No original executable, archive scripts or runtime archive reader ships. **Public redistribution rights are unverified.**
- Historical clock, eligibility, practice wrapping and hazard-state gaps remain disclosed in [decisions](docs/FIDELITY-DECISIONS.md). Automated verification is not DOS runtime validation or human playtesting. **Human review was not performed**; all six automated phases are complete, with independent production (51 tests), visual and bundle/documentation reviews passing. The separate coordinator source-backed Node rerun passed 61 tests; the independent Node run passed 59 with two optional provenance skips. See [validation](docs/VALIDATION.md) for evidence and reproduction.
