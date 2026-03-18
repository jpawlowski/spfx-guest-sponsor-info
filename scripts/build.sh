#!/usr/bin/env bash
# Full production build — intended for CI and release.
#
# Usage:
#   scripts/build.sh
#
# Produces: sharepoint/solution/guest-sponsor-info.sppkg
#
# Runs npm ci (clean install) then a full production build: compiles
# TypeScript, bundles assets, executes the Jest test suite, and creates
# the .sppkg package. Fails with a non-zero exit code if the expected
# artifact is not produced.
#
# For local development, use 'npm run build' directly to skip the slow
# npm ci reinstall.

set -euo pipefail

echo "Installing dependencies..."
npm ci

echo "Building solution (compile · bundle · test · package)..."
npm run build

PKG="sharepoint/solution/guest-sponsor-info.sppkg"
if [[ ! -f "$PKG" ]]; then
  echo "ERROR: Expected artifact not found: ${PKG}" >&2
  exit 1
fi

echo "Artifact ready: $(du -sh "$PKG" | cut -f1)  ${PKG}"
