# Codex Agent Guide

Canonical repository guidance lives in `AGENTS.md`.
Use that file as the baseline policy for this repository.

If your Codex workflow supports this file, treat it as a thin adapter and then
apply the matching files under `.github/instructions/` when available.

Relevant instruction files:

- `.github/instructions/code-quality.instructions.md` for `src/**/*.{ts,tsx}`
- `.github/instructions/azure-function-code-quality.instructions.md` for `azure-function/src/**/*.ts`
- `.github/instructions/shell-code-quality.instructions.md` for `**/*.sh`
- `.github/instructions/infra-code-quality.instructions.md` for `azure-function/infra/**`
- `.github/instructions/fluent-ui.instructions.md` for `src/**`
- `.github/instructions/commit-message.instructions.md` when generating commit messages

If your Codex tooling does not automatically load `.github/instructions/`,
read the relevant files manually before editing.

Keep this file thin.
Update `AGENTS.md` first, and only change this adapter when Codex-specific
bootstrapping is needed.
