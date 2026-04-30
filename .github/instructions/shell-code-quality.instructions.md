---
description: >
  Code quality rules for shell script changes. Use when editing any .sh file.
  Emphasize readability, idempotency, explicit validation, and fixing all
  shellcheck warnings in the touched slice.
applyTo: "**/*.sh"
---

# Shell Script Code Quality

## Structure and semantics

- Prefer names that describe intent, side effects, or policy rather than the
  current implementation detail.
- Keep control flow readable. When conditionals start mixing setup, policy, and
  side effects, extract a small helper function.
- Comment non-obvious parameter expansion, fallback behavior, and destructive
  operations.

## Safety and idempotency

- Preserve `set -euo pipefail` and the repository `cd` boilerplate where this
  repository expects it.
- Keep scripts idempotent: guard file creation, avoid unconditional overwrite,
  and make repeated runs safe.
- Prefer explicit dry-run support for side-effecting scripts when that pattern
  already exists nearby.

## Validation

- After every shell script change, run `npm run lint:sh`.
- Fix all reported shellcheck errors and warnings; do not leave warnings behind
  for the user or the commit hook to discover later.
- If formatting changed, run the repository fix workflow that includes `shfmt`.

## Final self-check

Before finishing, verify:

- Are names and comments clear enough for a reviewer to follow quickly?
- Is the script still safe to run twice?
- Did you run the matching shell validation and fix every warning?
