# Static DOS-to-JavaScript translation

## Goal

Promote the source-backed translation to the root application with a hard cutover, not a parallel/compatibility app. The original Mario Teaches Typing program never runs. Preserve checkable mappings from inert original bytes to translated behavior.

## Acceptance

1. Root `app/`, `recovered/`, `tools/`, `tests/`, `analysis/`, docs and reports replace the previous recreation. Git history preserves deleted implementation files; ignored historical research/worktrees remain untouched.
2. Validate archive and MARIO.EXE member hashes before analysis. Use trusted LLVM code16 disassembly and retain instruction-byte comparisons. Extracted executable members remain inert `.data` files.
3. Clean-checkout builds run all 18 static regeneration steps. Publish only index, authored runtime modules/CSS, generated numerical modules, app JSON, three bonus backgrounds and legal/domain files. Never publish the ZIP/raw research tree.
4. Node/Python/browser checks cover translated behavior and build boundaries. Browser checks use built dist over HTTP at root and Pages prefix, including all activities, audio failures and unchanged storage keys.
5. Existing translated students keep their format. Legacy recreation profiles are untouched and not automatically imported.
6. CI tests every push and PR; only main push/manual runs may deploy Pages. Preserve the custom domain; do not alter remote settings or deploy during promotion.
7. No UI redesign, invented mechanics, full-game completion claim or copyright license claim. Document remaining fidelity limits separately from deployment requirements.

## Evidence hierarchy

- Executable instruction bytes and resource bytes from the hash-pinned ZIP.
- Verified disassembly and statically decoded tables/graphics/text.
- Existing manual/video research, explicitly secondary to byte evidence.
- Explicit minimal browser adaptations for unavailable host behavior.

Current commands: [README](README.md) and [PLAN](PLAN.md). Promotion evidence: [reports/PROMOTION.md](reports/PROMOTION.md). Historical reports retain their original `transpile/` paths; source FILE offsets are unchanged.
