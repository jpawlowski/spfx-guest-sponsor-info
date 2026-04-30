---
description: >
  Code quality rules for infrastructure changes under azure-function/infra/.
  Use when editing Bicep, PowerShell, shell hooks, or other deployment files in
  that folder. Emphasize readability, validation, and fixing all reported
  warnings in the touched slice.
applyTo: "azure-function/infra/**"
---

# Infrastructure Code Quality

## Naming and structure

- Prefer names that describe deployment intent, resource purpose, or policy
  rather than incidental implementation details.
- Keep orchestration readable. Separate validation, policy, and deployment
  steps when the current block mixes concerns.
- Avoid duplicating resource policy values across the touched slice when a
  parameter, variable, or named helper makes intent clearer.

## Safety and reviewability

- Preserve idempotent deployment behavior and explicit prerequisites.
- Keep operator-facing messages and comments focused on decisions, caveats, and
  required inputs.
- Make risky or one-time operations obvious in the touched code.

## Validation

- Run the matching repository validation for the files you changed:
  `npm run lint:bicep`, `npm run lint:ps`, and/or `npm run lint:sh`.
- Fix all reported errors and warnings before finishing.
- Do not rely on pre-commit hooks or the user to discover remaining infra lint
  issues.

## Final self-check

Before finishing, verify:

- Is the deployment logic easy to review without tracing dense conditionals?
- Are prerequisites, side effects, and operator actions explicit?
- Did you run the matching infra validation and fix every warning?
