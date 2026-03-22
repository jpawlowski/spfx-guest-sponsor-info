#!/usr/bin/env bash
# Auto-fix all lint issues (TypeScript/ESLint, SCSS, Markdown) for both
# the SPFx web part and the Azure Function.
#
# Usage:
#   scripts/lint-fix.sh
#
# Applies auto-fixable corrections in-place. Issues that cannot be fixed
# automatically are reported but do not abort the run (exit 0 always).
# Run scripts/lint.sh afterwards to verify no issues remain.
#
# For CI use scripts/lint.sh instead — it never modifies files.

set -euo pipefail

echo "[ 1/4 ] ESLint --fix (TypeScript — web part)..."
npm run fix:ts
echo "  ✓ done"

echo ""
echo "[ 2/4 ] ESLint --fix (TypeScript — Azure Function)..."
node_modules/.bin/eslint azure-function/src --ext .ts --fix
echo "  ✓ done"

echo ""
echo "[ 3/4 ] Stylelint --fix (SCSS)..."
npm run fix:scss
echo "  ✓ done"

echo ""
echo "[ 4/4 ] Markdownlint --fix (Docs)..."
npm run fix:md
echo "  ✓ done"

echo ""
echo "✓ All fixers ran. Run scripts/lint.sh to verify no issues remain."
