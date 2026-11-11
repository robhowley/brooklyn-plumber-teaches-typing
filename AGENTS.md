# Static translation application

- Never execute, emulate, interpret, load as code, or launch archive programs, scripts, drivers or installers. No DOSBox, Wine or original-machine-code execution. Read original members only as inert data.
- Work at the repository root. There is one app in `app/` and `recovered/`, not a compatibility path. Ignored `research/` and historical `transpile/` worktrees, scratch, assets and dependency directories stay untouched.
- Run only authored analysis/conversion/JavaScript/tests and trusted LLVM static disassembly. `tools/source.py` owns source selection and archive/member pins; `tools/build.py` runs all 18 steps and publishes only its runtime allowlist to clean `dist`.
- Cite executable FILE offsets, member names/hashes and resource indices. Research supplies leads, never proof. Distinguish recovered behavior, inference, browser adaptations and unknowns; do not invent unsupported mechanics.
- Keep the original ZIP, extracted members, raw bytes, listings, numerical tables and other generated data ignored. Never force-add them or apply MIT to game material. Public deployment of the required runtime subset is authorized, not a copyright license. See NOTICE.
- Preserve the exact `mtt-static-translation.students.v1` save format. Leave `typing-kingdom-v1` and `typing-kingdom-v2` untouched; do not invent conversion or deletion.
- Only main may commit/push with explicit authorization. Workers never stage, commit or push. Audit exact changed paths and ignores before publication.
- Build/test with `docs/DEVELOPMENT.md` commands and `structured_return`. Browser checks target built dist at root and project prefix, using isolated contexts. Do not disturb a user server without explicit authorization.
- Keep working plans, research writeups and verification reports out of Git. Maintain only repository instructions and build/play documentation; retain source citations in code and machine-readable evidence.
