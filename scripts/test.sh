#!/usr/bin/env bash
# Run the Jest test suite.
#
# Usage:
#   scripts/test.sh
#
# Compiles TypeScript and runs all tests. Coverage report is written to
# jest-output/coverage/lcov-report/index.html

set -euo pipefail

echo "Running tests..."
npm test

echo ""
echo "Coverage report: jest-output/coverage/lcov-report/index.html"
