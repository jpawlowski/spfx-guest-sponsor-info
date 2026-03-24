#!/usr/bin/env bash
# Full production build — intended for CI and release.
#
# Usage:
#   scripts/build.sh
#
# Produces: sharepoint/solution/guest-sponsor-info.sppkg
#
# Runs npm ci (clean install) for both the SPFx web part and the Azure
# Function, then builds both. For the web part this compiles TypeScript,
# bundles assets, runs the Jest test suite, and creates the .sppkg package.
# For the Azure Function it compiles TypeScript to dist/. Fails with a
# non-zero exit code if the expected artifact is not produced.
#
# For local development, use 'npm run build' directly to skip the slow
# npm ci reinstall.

set -euo pipefail

# Always run from the repository root so paths resolve correctly.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Colours are disabled in CI, when NO_COLOR is set, or when stdout is not a TTY.
if [[ -t 1 && "${CI:-}" == "" && "${NO_COLOR:-}" == "" && "${TERM:-}" != "dumb" ]]; then
  C_RED=$'\033[0;31m'
  C_GRN=$'\033[0;32m'
  C_BLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_RST=$'\033[0m'
else
  C_RED=''
  C_GRN=''
  C_BLD=''
  C_DIM=''
  C_RST=''
fi

echo "${C_DIM}Installing web part dependencies…${C_RST}"
npm ci

echo "${C_BLD}Building solution (compile · bundle · test · package)…${C_RST}"
npm run build

PKG="sharepoint/solution/guest-sponsor-info.sppkg"
if [[ ! -f "$PKG" ]]; then
  echo "${C_RED}ERROR:${C_RST} Expected artifact not found: ${PKG}" >&2
  exit 1
fi

echo "${C_DIM}Installing Azure Function dependencies…${C_RST}"
npm ci --prefix azure-function

echo "${C_BLD}Building Azure Function…${C_RST}"
npm run build --prefix azure-function

echo "${C_GRN}✓${C_RST} Artifact ready: ${C_BLD}$(du -sh "$PKG" | cut -f1)${C_RST}  ${PKG}"
