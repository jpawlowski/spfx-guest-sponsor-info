---
description: >
  Code quality rules for TypeScript changes in azure-function/src/. Use when
  fixing bugs, changing API behavior, or refactoring touched code. Emphasize
  naming, semantics, helper extraction, and readability in the touched slice.
applyTo: "azure-function/src/**/*.ts"
---

# Azure Function TypeScript Code Quality

## Naming and semantics

- Prefer names that describe stable API meaning, domain concepts, or policy
  rather than incidental implementation details.
- If a touched identifier becomes misleading after the change, rename it when
  the rename is local and low risk.
- Do not encode transient transport or implementation details into shared
  types or helpers unless that distinction is the real concept being modeled.

## Decision logic

- Avoid nested ternaries for routing, normalization, response mapping, or
  state-derived decisions.
- When logic has more than two branches or mixes validation, policy, and I/O
  concerns, extract a small pure helper.
- Keep handlers and orchestration readable; compute policy in named helpers
  before crossing I/O boundaries.

## Local cleanup

- After a functional fix, do one cleanup pass on the touched slice before
  finishing.
- Remove misleading names, dense conditionals, duplicated policy values, and
  unnecessary inline decision logic when the change already touches that area.
- Improve the touched slice and its immediate neighborhood, but do not widen
  the change into unrelated refactors.

## Final self-check

Before finishing, verify:

- Are the names semantically correct for the behavior now implemented?
- Is the decision logic readable without mentally expanding nested operators?
- Would a small helper separate policy from I/O or response wiring?
- Is the touched code easier to understand than before this change?
