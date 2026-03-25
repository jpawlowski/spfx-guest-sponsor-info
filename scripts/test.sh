#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
# SPDX-FileCopyrightText: 2026 Julian Pawlowski <https://github.com/jpawlowski>
# SPDX-License-Identifier: AGPL-3.0-only
#
# Run the Jest test suite.
#
# Usage:
#   scripts/test.sh
#
# Compiles TypeScript and runs all tests. Coverage report is written to
# jest-output/coverage/lcov-report/index.html

set -euo pipefail

# Always run from the repository root so npm scripts resolve correctly.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "Running tests..."
npm test

echo ""
echo "Coverage report: jest-output/coverage/lcov-report/index.html"
