# Static translation workspace

- Never execute, emulate, load as code, or launch any program, script, driver, installer, or executable from the Mario archive. No DOSBox, Wine, CPU interpreter, emulator-based unpacking, or original-machine-code execution.
- Read archive members only as data. Static disassembly, byte parsing, decompression implemented from understood algorithms, image conversion, and newly authored JavaScript/tests are allowed.
- Keep all new project work beneath this `transpile/` directory. Existing `src/`, `tests/`, `research/`, and project configuration are read-only reference material.
- The original archive is `/Users/roberthowley/Downloads/Mario_Teaches_Typing_1992.zip`.
- Existing research is a lead, not proof. Verify findings against bytes from this archive.
- Cite executable FILE offsets (hex), original member names and hashes, and decoded resource indices for translated behavior.
- Distinguish directly recovered behavior, inference, browser adaptation, and unknown behavior. Never present an assumed timing, collision rule, or interaction as recovered.
- Favor one genuinely faithful playable slice over invented coverage. Document all identified mechanics, including unsupported ones.
- Use real extracted resources locally. Do not publish or push the original archive or derived resources. Do not apply the repository MIT license to original game material.
- The main agent may commit checkpoints and push only when the user explicitly authorizes it. Workers never commit or push. Before publication, audit the exact staged scope; never force-add the archive, original-derived resources, byte dumps, or local host artifacts. Worker outputs and scratch files belong in assigned directories. Do not write wiki pages from workers.
- Run only newly authored analysis, conversion, JavaScript, and verification code, after inspecting reused scripts for safety.
- Use `structured_return` for tests and builds. Record exact commands, results, and limits.
