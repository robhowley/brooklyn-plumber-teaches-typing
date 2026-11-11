# Build, test and deploy

## Requirements

- Node.js 24+, Python 3.13 and LLVM `llvm-objdump` on PATH (Ubuntu: `sudo apt-get install llvm`).
- macOS can use Apple's `/usr/bin/objdump`. GNU objdump is unsupported; set `MTT_OBJDUMP` to select another trusted LLVM binary.

## Build and serve

From the repository root:

```sh
npm ci
npm run build
npm run preview -- --port 4179
```

Open http://127.0.0.1:4179/. `npm run dev` builds and serves the same `dist/`; it does not watch files. Rebuild after editing sources. Controls and known limitations are in [PLAYING.md](PLAYING.md).

`tools/source.py` selects `MTT_ARCHIVE`, then `~/Downloads/Mario_Teaches_Typing_1992.zip`, then an ignored `.cache/source/` download from Archive.org. To use a local copy, run `MTT_ARCHIVE=/absolute/path/to/archive.zip npm run build`. Invalid explicit or Downloads inputs fail rather than being replaced silently.

The ZIP and MARIO.EXE hashes are pinned in `tools/source.py`. Downloads have bounded retries, time and size limits. The build reads original members only as inert data; never execute or emulate archive programs, scripts or drivers.

`tools/build.py` runs all 18 static conversion steps and publishes a runtime-only allowlist to `dist/`. Missing or stale generated inputs should be rebuilt, not copied from another checkout. Logs are in `.tmp/build/`. Source FILE offsets remain in code and generated evidence under `analysis/`; those are executable file offsets, not runtime addresses. Original-derived game material is not MIT-licensed: see [NOTICE](../NOTICE).

## Checks

Build first, then run:

```sh
npm test
npm run test:python
npx playwright install --with-deps chromium
npm run test:browser
```

Browser tests serve `dist/` on port 4199 and exercise both `/` and `/brooklyn-plumber-teaches-typing/`. Set `TRANSLATION_PORT` to use another unused port; tests never reuse an existing server. To use installed Chrome instead of bundled Chromium, set `PLAYWRIGHT_CHANNEL=chrome`.

## Deployment and storage

- GitHub Actions builds and tests pushes and pull requests. Only a push or manual workflow run on `main` publishes GitHub Pages.
- Deploy `dist/`, never the source checkout. Archives, raw resources, research and conversion tools are excluded. `CNAME` preserves `brooklynplumberteachestyping.dad`; domain and HTTPS settings are managed separately in GitHub Pages.
- Saves use `mtt-static-translation.students.v1` in browser localStorage. Legacy `typing-kingdom-v1` and `typing-kingdom-v2` keys are untouched, not imported. Changing the site's origin uses different browser storage.
- Keep generated assets, archives, byte listings, working notes and test reports out of Git. `AGENTS.md` contains the repository's safety and contribution instructions.
