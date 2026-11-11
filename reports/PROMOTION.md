# Root promotion

The static translation replaces the previous root recreation in a hard cutover. Local checks pass; remote Ubuntu CI and deployment remain unverified until push.

## Scope and decisions

- The only active application is root `app/` and `recovered/`; README commands build and serve `dist`, not the historical `transpile/` tree.
- Saves retain the exact `mtt-static-translation.students.v1` format. `typing-kingdom-v1` and `typing-kingdom-v2` are untouched, with no import or deletion.
- Archive programs never execute. ZIPs, extracted members, raw resources, listings and generated data stay ignored. Historical ignored worktrees and scratch are not migrated.
- Publication permission covers the required runtime assets, not an MIT license for original game material. See `NOTICE`.
- CI tests pushes and PRs; deployment is restricted to trusted pushes or manual runs on `main`. The existing domain and HTTPS configuration are unchanged; HTTPS enforcement was off. No commit, push or deployment was performed here.
- An earlier worker was interrupted before producing its final report. This report records the completed checks, not an assumed earlier conclusion.

## Evidence and commands

- Independent `npm test` / explicit `node --test` verification: **309 passed**, including `npm --script-shell=/bin/dash test`. Evidence: `/Users/roberthowley/.pi/subagent-runs/20261111T191447Z-zank1thl/01-verifier.md`.
- `python3 -B tools/test-python.py`: **57 passed** after the new regression, across assets 19, render 6, app 9, audio 11 and build 12. The wrapper's structured parser reports only the final suite, not the total. Separate subprocess reruns and counts are recorded in `.tmp/promotion/checks/python-final.log`. Before this regression the total was 56, not 64.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` baseline: **86 passed**, root and project prefix, zero failures/errors/skips in `.tmp/promotion/checks/browser-final.xml`. This finish did not rerun browsers.
- Two prior fresh full builds matched **2,570 outputs**, recorded in `.tmp/promotion/checks/determinism.json`; `app/data.json` SHA-256 remains `066edada0ea12b065463a5494827f727498e9fab3d3dd740f964e5bd9693c93a` after the finish.
- The new archive was reverified with `source.verify_archive('.tmp/promotion/source-archive.zip')`: ZIP SHA-256 `b59886a6f7b48b0057c8db1c099ed598c8a3581245b0f8884316203de55784bd`; inert member `MarioTea/MARIO/MARIO.EXE` SHA-256 `6caed439b64dc3bad8de4f9df53b63ae5712bf3c54b0bbfc00603557e4720f5e`.
- The independent second opinion found only three broken documentation links in shipped HTML. They now use public repository `blob/main` URLs, intended to resolve after merge. The regression checks expected external URLs and that relative hrefs belong to the runtime publication list, without network access.
- After inspecting `tools/build.py`, `PYTHONPATH=tools python3 -B -c 'import build; print(len(build.publish()))'` republishes the unchanged **37-file** allowlist. The 18-step generation was not repeated for this HTML-only runtime change.
- `git diff --check` and explicit no-index whitespace checks cover the new test and report. Nothing was staged. The existing preview on port 4179 (PID 58702) was not stopped or restarted.

## Remaining verification

- Remote Ubuntu CI awaits push; local macOS/Chrome success does not establish its result.
- Repository documentation links depend on these files reaching `main`. No network test or deployment is claimed.
