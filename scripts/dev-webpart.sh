#!/usr/bin/env bash
# Start the local development server (hot-reload dev mode).
#
# Usage:
#   scripts/dev.sh
#
# Requires SPFX_TENANT to be set — either in a local .env file or as an
# environment variable. Copy .env.example to .env and fill in your tenant:
#   cp .env.example .env
#
# NOTE: The local workbench (/temp/workbench.html) was removed in SPFx 1.17.
# The dev server only serves the JS bundle; testing requires the hosted
# workbench on a real SharePoint Online tenant.
#
# The hosted workbench URL is printed on startup:
#   https://<your-tenant>.sharepoint.com/_layouts/15/workbench.aspx
#
# Prerequisites: accept the dev certificate warning in your browser the first
# time by navigating to https://localhost:4321 and confirming the certificate.

set -euo pipefail

# Load .env if present.
ENV_FILE="${BASH_SOURCE[0]%/*}/../.env"
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
  set +a
fi

SPFX_TENANT="${SPFX_TENANT:-}"

if [[ -z "${SPFX_TENANT}" ]]; then
  echo "ERROR: SPFX_TENANT is not set."
  echo "  The local workbench was removed in SPFx 1.17."
  echo "  A SharePoint Online tenant is required to test the web part."
  echo ""
  echo "  Copy .env.example to .env and fill in your tenant domain:"
  echo "    cp .env.example .env"
  exit 1
fi

# Patch serve.json with the configured tenant domain, then restore the
# original on exit so the {tenantDomain} placeholder stays intact in git.
SERVE_JSON="config/serve.json"
SERVE_ORIG=$(cat "${SERVE_JSON}")
restore_serve() {
  printf '%s\n' "${SERVE_ORIG}" > "${SERVE_JSON}"
  git update-index --no-skip-worktree "${SERVE_JSON}" 2>/dev/null || true
}
trap restore_serve EXIT INT TERM
TMP=$(mktemp)
sed "s|{tenantDomain}|${SPFX_TENANT}|g" "${SERVE_JSON}" > "${TMP}"
cp "${TMP}" "${SERVE_JSON}"
rm "${TMP}"
# Hide the patched file from git so accidental staging is impossible.
git update-index --skip-worktree "${SERVE_JSON}" 2>/dev/null || true

echo "Tenant: ${SPFX_TENANT}"
echo "Starting local development server..."
echo "Hosted workbench: https://${SPFX_TENANT}/_layouts/15/workbench.aspx"
echo "  → Accept the certificate at https://localhost:4321 first (once per browser)"
echo ""
echo "Press Ctrl+C to stop."
echo ""

# Node ≥17 resolves 'localhost' to ::1 (IPv6) by default, but the devcontainer
# port-forwarding tunnel binds to 127.0.0.1 (IPv4). Force IPv4-first DNS
# ordering so the dev server listens on 127.0.0.1:4321 where VS Code can reach it.
# This only affects this process and its children — no global IPv6 changes.
export NODE_OPTIONS="${NODE_OPTIONS:+${NODE_OPTIONS} }--dns-result-order=ipv4first"

npm start
