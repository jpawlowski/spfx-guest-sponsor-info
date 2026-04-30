# Claude Agent Guide

Canonical repository guidance lives in `AGENTS.md`.
Use that file as the baseline policy for this repository.

When your Claude workflow supports file-scoped instruction files, also consult:

- `.github/instructions/code-quality.instructions.md` for `src/**/*.{ts,tsx}`
- `.github/instructions/azure-function-code-quality.instructions.md` for `azure-function/src/**/*.ts`
- `.github/instructions/shell-code-quality.instructions.md` for `**/*.sh`
- `.github/instructions/infra-code-quality.instructions.md` for `azure-function/infra/**`
- `.github/instructions/fluent-ui.instructions.md` for `src/**`
- `.github/instructions/commit-message.instructions.md` when generating commit messages

If your Claude tooling does not automatically load `.github/instructions/`,
read the relevant files manually before editing.

Keep this file thin.
Update `AGENTS.md` first, and only change this adapter when Claude-specific
bootstrapping is needed.
