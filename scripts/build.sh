#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
# SPDX-FileCopyrightText: 2026 Julian Pawlowski <https://github.com/jpawlowski>
# SPDX-License-Identifier: AGPL-3.0-only
#
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

# shellcheck source=scripts/colors.sh
source "$(dirname "${BASH_SOURCE[0]}")/colors.sh"

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
