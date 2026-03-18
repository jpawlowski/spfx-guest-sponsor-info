#!/usr/bin/env bash
# Run all linters (TypeScript/ESLint, SCSS, Markdown).
#
# Usage:
#   scripts/lint.sh

set -euo pipefail

EXIT=0

echo "[ 1/3 ] ESLint (TypeScript)..."
if npm run lint:ts; then
    echo "  ✓ ESLint passed"
else
    echo "  ✗ ESLint found issues"
    EXIT=1
fi

echo ""
echo "[ 2/3 ] Stylelint (SCSS)..."
if npm run lint:scss; then
    echo "  ✓ Stylelint passed"
else
    echo "  ✗ Stylelint found issues"
    EXIT=1
fi

echo ""
echo "[ 3/3 ] Markdownlint (Docs)..."
if npm run lint:md; then
    echo "  ✓ Markdownlint passed"
else
    echo "  ✗ Markdownlint found issues"
    EXIT=1
fi

echo ""
if [[ $EXIT -eq 0 ]]; then
    echo "✓ All linters passed."
else
    echo "✗ One or more linters reported issues — see above."
fi

exit $EXIT
