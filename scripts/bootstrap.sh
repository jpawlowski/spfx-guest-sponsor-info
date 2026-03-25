#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
# SPDX-FileCopyrightText: 2026 Julian Pawlowski <https://github.com/jpawlowski>
# SPDX-License-Identifier: AGPL-3.0-only
#
# Bootstrap the development environment.
#
# Usage:
#   ./scripts/bootstrap.sh
#
# Installs web part dependencies (npm install) and creates .env from
# .env.example if .env does not already exist.
#
# In the devcontainer this script is called automatically by post-create.sh
# on every container start — you only need to run it manually when working
# outside the devcontainer (local Node.js setup).
#
# After bootstrapping, start a dev server:
#   ./scripts/dev-webpart.sh    # SPFx web part (hosted workbench)
#   ./scripts/dev-function.sh   # Azure Function (requires az login)

set -euo pipefail

# Always run from the repository root so paths resolve correctly.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# shellcheck source=scripts/colors.sh
source "$(dirname "${BASH_SOURCE[0]}")/colors.sh"

echo "${C_DIM}Installing web part dependencies…${C_RST}"
npm install

ENV_FILE=".env"
if [[ ! -f "${ENV_FILE}" ]]; then
  cp .env.example "${ENV_FILE}"
  echo ""
  echo "${C_GRN}✓${C_RST} Created .env from .env.example."
  echo "  ${C_CYN}→${C_RST} Edit ${C_BLD}.env${C_RST} and set ${C_BLD}SPFX_SERVE_TENANT_DOMAIN${C_RST}=<your-tenant>.sharepoint.com"
  echo "  ${C_DIM}(or export SPFX_SERVE_TENANT_DOMAIN on your host OS — see .devcontainer/devcontainer.json)${C_RST}"
else
  echo ""
  echo "${C_DIM}.env already exists — skipped.${C_RST}"
fi

echo ""
echo "${C_GRN}✓ Bootstrap complete.${C_RST} Next steps:"
echo "  ${C_BLD}./scripts/dev-webpart.sh${C_RST}    # start the SPFx dev server"
echo "  ${C_BLD}./scripts/dev-function.sh${C_RST}   # start the Azure Function locally"
