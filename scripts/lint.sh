#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
# SPDX-FileCopyrightText: 2026 Julian Pawlowski <https://github.com/jpawlowski>
# SPDX-License-Identifier: AGPL-3.0-only
#
# Run all linters (TypeScript/ESLint, Markdown, Bicep, Shell) for both
# the SPFx web part and the Azure Function.
#
# Usage:
#   scripts/lint.sh

set -euo pipefail

# Always run from the repository root so npm scripts resolve correctly.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# shellcheck source=scripts/colors.sh
source "$(dirname "${BASH_SOURCE[0]}")/colors.sh"

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
echo "${C_BLD}[ 3/5 ] Markdownlint (Docs)…${C_RST}"
if npm run lint:md; then
  echo "  ${C_GRN}✓${C_RST} Markdownlint passed"
else
  echo "  ${C_RED}✗${C_RST} Markdownlint found issues"
  EXIT=1
fi

echo ""
echo "${C_BLD}[ 4/5 ] Bicep lint (Azure Function infra)…${C_RST}"
if npm run lint:bicep; then
  echo "  ${C_GRN}✓${C_RST} Bicep lint passed"
else
  echo "  ${C_RED}✗${C_RST} Bicep lint found issues"
  EXIT=1
fi

echo ""
echo "${C_BLD}[ 5/5 ] shellcheck (Shell scripts)…${C_RST}"
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
