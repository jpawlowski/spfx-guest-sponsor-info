#!/usr/bin/env bash
# Run all linters (TypeScript/ESLint, SCSS, Markdown, Bicep, Shell) for both
# the SPFx web part and the Azure Function.
#
# Usage:
#   scripts/lint.sh

set -euo pipefail

# Always run from the repository root so npm scripts resolve correctly.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Colours are disabled in CI, when NO_COLOR is set, or when stdout is not a TTY.
if [[ -t 1 && "${CI:-}" == "" && "${NO_COLOR:-}" == "" && "${TERM:-}" != "dumb" ]]; then
  C_RED=$'\033[0;31m'
  C_GRN=$'\033[0;32m'
  C_BLD=$'\033[1m'
  C_RST=$'\033[0m'
else
  C_RED=''
  C_GRN=''
  C_BLD=''
  C_RST=''
fi

EXIT=0

echo "${C_BLD}[ 1/6 ] ESLint (TypeScript — web part)…${C_RST}"
if npm run lint:ts; then
  echo "  ${C_GRN}✓${C_RST} ESLint passed"
else
  echo "  ${C_RED}✗${C_RST} ESLint found issues"
  EXIT=1
fi

echo ""
echo "${C_BLD}[ 2/6 ] ESLint (TypeScript — Azure Function)…${C_RST}"
if npm run lint:ts:func; then
  echo "  ${C_GRN}✓${C_RST} ESLint passed"
else
  echo "  ${C_RED}✗${C_RST} ESLint found issues"
  EXIT=1
fi

echo ""
echo "${C_BLD}[ 3/6 ] Stylelint (SCSS)…${C_RST}"
if npm run lint:scss; then
  echo "  ${C_GRN}✓${C_RST} Stylelint passed"
else
  echo "  ${C_RED}✗${C_RST} Stylelint found issues"
  EXIT=1
fi

echo ""
echo "${C_BLD}[ 4/6 ] Markdownlint (Docs)…${C_RST}"
if npm run lint:md; then
  echo "  ${C_GRN}✓${C_RST} Markdownlint passed"
else
  echo "  ${C_RED}✗${C_RST} Markdownlint found issues"
  EXIT=1
fi

echo ""
echo "${C_BLD}[ 5/6 ] Bicep lint (Azure Function infra)…${C_RST}"
if npm run lint:bicep; then
  echo "  ${C_GRN}✓${C_RST} Bicep lint passed"
else
  echo "  ${C_RED}✗${C_RST} Bicep lint found issues"
  EXIT=1
fi

echo ""
echo "${C_BLD}[ 6/6 ] shellcheck (Shell scripts)…${C_RST}"
if npm run lint:sh; then
  echo "  ${C_GRN}✓${C_RST} shellcheck passed"
else
  echo "  ${C_RED}✗${C_RST} shellcheck found issues"
  EXIT=1
fi

echo ""
if [[ $EXIT -eq 0 ]]; then
  echo "${C_GRN}✓ All linters passed.${C_RST}"
else
  echo "${C_RED}✗ One or more linters reported issues — see above.${C_RST}"
fi

exit $EXIT
