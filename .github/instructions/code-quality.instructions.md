---
description: >
  Code quality rules for TypeScript and React changes in src/. Use when fixing
  bugs, changing UI behavior, or refactoring touched code. Emphasize naming,
  semantics, helper extraction, and readability in the touched slice.
applyTo: "src/**/*.{ts,tsx}"
---

# TypeScript and React Code Quality

## Naming and semantics

- Prefer names that describe stable meaning, domain concepts, or UI policy
  rather than incidental implementation details.
- If a touched identifier becomes misleading after the change, rename it when
  the rename is local and low risk.
- Do not encode transient interaction details into shared types or helpers
  unless that distinction is the real concept being modeled.

## Decision logic

- Avoid nested ternaries for breakpoint logic, layout policy, or state-derived
  rendering decisions.
- When logic has more than two branches or mixes multiple concerns, extract a
  small pure helper.
- Keep JSX declarative; compute policy above render and pass the result down.

## Local cleanup

- After a functional fix, do one cleanup pass on the touched slice before
  finishing.
- Remove misleading names, dense conditionals, duplicated policy values, and
  unnecessary per-render object creation when the change already touches that
  area.
- Improve the touched slice and its immediate neighborhood, but do not widen
  the change into unrelated refactors.

## Final self-check

Before finishing, verify:

- Are the names semantically correct for the behavior now implemented?
- Is the decision logic readable without mentally expanding nested operators?
- Would a small helper make the code easier to review and test?
- Is the touched code easier to understand than before this change?
