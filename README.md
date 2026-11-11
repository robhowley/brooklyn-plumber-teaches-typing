# Brooklyn Plumber Teaches Typing

A static JavaScript translation of Mario Teaches Typing, with four source-backed activities. No original program runs. See [controls and fidelity limits](docs/PLAYING.md).

## Run locally

Requires Node 24+, Python 3.13 and LLVM `llvm-objdump` on PATH. macOS may use Apple's `/usr/bin/objdump`; Ubuntu: `sudo apt-get install llvm`.

```sh
npm ci
npm run build
npm run preview -- --port 4181
```

Open **http://127.0.0.1:4181/**. `npm run dev -- --port 4181` rebuilds then serves the same `dist`. Preview defaults to port 4179; choose another port if it is occupied. Only `dist` is served.

The build validates the archive hash before parsing, runs all 18 static regeneration steps, then copies only the runtime allowlist. Source selection: `MTT_ARCHIVE=/path/to/Mario_Teaches_Typing_1992.zip`, otherwise `$HOME/Downloads/Mario_Teaches_Typing_1992.zip`, otherwise a bounded download from [Archive.org](https://archive.org/download/msdos_Mario_Teaches_Typing_1992/Mario_Teaches_Typing_1992.zip) into ignored `.cache/source/`. Invalid explicit/local archives fail closed; corrupt download caches are replaced. Nothing from the archive executes.

## Verify

After building:

```sh
npm test
npm run test:python
npx playwright install --with-deps chromium
npm run test:browser
```

Browser checks serve built `dist` on port 4199, at `/` and `/brooklyn-plumber-teaches-typing/`. Set `TRANSLATION_PORT` if needed. Optional installed Chrome: `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. CI installs the bundled Chromium matching the lockfile.

## Source, storage and deployment

- [Full source pipeline and remaining recovery](PLAN.md), [coverage](COVERAGE.md), [browser adaptations](ASSUMPTIONS.md), [promotion decisions and checks](reports/PROMOTION.md).
- This root app replaces the previous recreation. Existing translated students keep the exact `mtt-static-translation.students.v1` format. Legacy `typing-kingdom-v1` / `typing-kingdom-v2` keys are untouched and are **not automatically imported**.
- Original art, audio, lessons and data remain copyrighted, not MIT. [NOTICE](NOTICE) distinguishes runtime publication from source/archive distribution. No original ZIP or generated resources are committed.
- Pages builds and tests pushes and PRs; only trusted `main` pushes or manual runs on `main` deploy. Custom domain remains `brooklynplumberteachestyping.dad`. Existing Pages configuration uses workflow builds and source `main`; HTTPS enforcement is currently off and is not changed here. No deployment was performed for this promotion.

Historical reports retain pre-promotion `transpile/` paths and commands as evidence. Their authored files now live at the root; ignored historical worktrees, assets and scratch remain in place and are inactive.
