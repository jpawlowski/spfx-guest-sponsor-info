#!/usr/bin/env bash
# Start the local development server.
#
# Usage:
#   scripts/start.sh
#
# The SharePoint tenant domain is read from a local .env file (not committed).
# Copy .env.example to .env and fill in your tenant domain:
#   cp .env.example .env
#
# The SPFx workbench then opens at:
#   https://localhost:4321/temp/workbench.html
#
# To test with real Microsoft Graph data, open the hosted workbench:
#   https://<your-tenant>.sharepoint.com/_layouts/15/workbench.aspx
#
# Prerequisites: accept the dev certificate warning in your browser the first
# time, or run: npx heft dev-cert trust

set -euo pipefail

# Load .env if present.
ENV_FILE="${BASH_SOURCE[0]%/*}/../.env"
if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck source=/dev/null
  set -a; source "${ENV_FILE}"; set +a
fi

SPFX_TENANT="${SPFX_TENANT:-}"

if [[ -z "${SPFX_TENANT}" ]]; then
  echo "WARNING: SPFX_TENANT is not set."
  echo "  Copy .env.example to .env and set your tenant domain."
  echo "  The local workbench will open but Graph API calls will not work."
  echo ""
else
  # Patch serve.json with the configured tenant domain, then restore the
  # original on exit so the {tenantDomain} placeholder stays intact in git.
  SERVE_JSON="config/serve.json"
  SERVE_ORIG=$(cat "${SERVE_JSON}")
  restore_serve() { printf '%s\n' "${SERVE_ORIG}" > "${SERVE_JSON}"; }
  trap restore_serve EXIT INT TERM

  TMP=$(mktemp)
  sed "s|{tenantDomain}|${SPFX_TENANT}|g" "${SERVE_JSON}" > "${TMP}"
  cp "${TMP}" "${SERVE_JSON}"
  rm "${TMP}"
  echo "Tenant: ${SPFX_TENANT}"
fi

echo "Starting local development server..."
echo "Local workbench: https://localhost:4321/temp/workbench.html"
[[ -n "${SPFX_TENANT}" ]] && echo "Hosted workbench: https://${SPFX_TENANT}/_layouts/15/workbench.aspx"
echo ""
echo "Press Ctrl+C to stop."
echo ""

npm start
