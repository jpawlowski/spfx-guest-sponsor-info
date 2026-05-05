#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
# SPDX-FileCopyrightText: 2026 Julian Pawlowski <https://github.com/jpawlowski>
# SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
#
# Post-provision hook for Azure Developer CLI (azd).
# Runs after the Azure-only Bicep deployment to:
#   - Sync the key outputs used by the deployment wizard.
#   - Print the web part configuration values.
#
# The Entra App Registration is prepared before azd provision. Direct azd runs
# finish the Microsoft Graph role-assignment phase here, while deploy-azure.ps1
# opts out because it manages that post-phase itself. Deferred deployments use
# setup-graph-permissions.ps1.
#
# Bicep outputs (functionAppUrl, webPartClientId) are available as environment
# variables via 'azd env get-values' after provisioning.
#
# All operations are idempotent — safe to re-run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

sync_azd_env_value() {
  local name="$1" value="$2"
  if [[ -z "${value}" ]]; then
    return
  fi
  export "${name}=${value}"
  azd env set "${name}" "${value}" >/dev/null
}

print_summary_line() {
  local label="$1" value="${2:-}"
  if [[ -z "${value}" ]]; then
    value="(not available)"
  fi
  printf '  %-28s: %s\n' "${label}" "${value}"
}

# shellcheck disable=SC1090  # process substitution: no static path to specify
source <(azd env get-values)

# azd writes Bicep output names verbatim (camelCase) to the .env file and
# preloads them into the hook process environment with the same casing.
# Create SCREAMING_SNAKE_CASE aliases so the rest of this script uses a
# consistent naming convention alongside the AZURE_* env vars.
FUNCTION_APP_URL="${functionAppUrl:-${FUNCTION_APP_URL:-}}"
if [[ -z "${FUNCTION_APP_URL:-}" && -n "${sponsorApiEndpointUrl:-}" ]]; then
  FUNCTION_APP_URL="$(printf '%s' "${sponsorApiEndpointUrl}" | sed 's#/api/getGuestSponsors$##')"
fi
if [[ -z "${FUNCTION_APP_URL:-}" && -n "${sponsorApiUrl:-}" ]]; then
  FUNCTION_APP_URL="$(printf '%s' "${sponsorApiUrl}" | sed 's#/api/getGuestSponsors$##')"
fi
WEB_PART_CLIENT_ID="${webPartClientId:-${AZURE_WEB_PART_CLIENT_ID:-${WEB_PART_CLIENT_ID:-}}}"
# functionAppName is exposed as a Bicep output (camelCase). Use the azd env
# value when that output is not present in the current hook environment.
FUNCTION_APP_NAME="${functionAppName:-${AZURE_FUNCTION_APP_NAME:-}}"
MANAGED_IDENTITY_OBJECT_ID="${managedIdentityObjectId:-${MANAGED_IDENTITY_OBJECT_ID:-}}"

if [[ -z "${FUNCTION_APP_URL:-}" && -n "${FUNCTION_APP_NAME:-}" && -n "${AZURE_RESOURCE_GROUP:-}" ]]; then
  if default_host_name="$(az functionapp show --name "${FUNCTION_APP_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" --query defaultHostName -o tsv 2>/dev/null)"; then
    if [[ -n "${default_host_name}" && "${default_host_name}" != "null" ]]; then
      FUNCTION_APP_URL="https://${default_host_name}"
      export FUNCTION_APP_URL
      export functionAppUrl="${FUNCTION_APP_URL}"
      sync_azd_env_value functionAppUrl "${FUNCTION_APP_URL}"
    fi
  fi
fi

if [[ -z "${MANAGED_IDENTITY_OBJECT_ID:-}" && -n "${FUNCTION_APP_NAME:-}" && -n "${AZURE_RESOURCE_GROUP:-}" ]]; then
  if principal_id="$(az functionapp identity show --name "${FUNCTION_APP_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" --query principalId -o tsv 2>/dev/null)"; then
    if [[ -n "${principal_id}" && "${principal_id}" != "null" ]]; then
      MANAGED_IDENTITY_OBJECT_ID="${principal_id}"
      export MANAGED_IDENTITY_OBJECT_ID
      export managedIdentityObjectId="${principal_id}"
      sync_azd_env_value managedIdentityObjectId "${principal_id}"
    fi
  fi
fi

# azd can retain a stale webPartClientId in the env file. Resolve the EasyAuth
# App Registration directly by its deterministic uniqueName and sync the azd
# environment so both this hook and deploy-azure.ps1 print the real client ID.
if [[ -n "${FUNCTION_APP_NAME:-}" ]]; then
  app_reg_unique_name="guest-sponsor-info-proxy-${FUNCTION_APP_NAME}"
  if resolved_client_id="$(az ad app list --filter "uniqueName eq '${app_reg_unique_name}'" --query '[0].appId' -o tsv 2>/dev/null)"; then
    if [[ -n "${resolved_client_id}" && "${resolved_client_id}" != "null" ]]; then
      WEB_PART_CLIENT_ID="${resolved_client_id}"
      export WEB_PART_CLIENT_ID
      export webPartClientId="${resolved_client_id}"
      export AZURE_WEB_PART_CLIENT_ID="${resolved_client_id}"
      sync_azd_env_value AZURE_WEB_PART_CLIENT_ID "${resolved_client_id}"
      sync_azd_env_value webPartClientId "${resolved_client_id}"
    fi
  fi
fi

# ── Graph post-phase and restart status ──────────────────────────────────────
# Direct azd runs finish the Microsoft Graph role-assignment phase here after
# the Managed Identity object ID is resolved. The deployment wizard opts out
# via a transient process env var and performs the same post-phase after azd
# returns.
SKIP_ROLE_ASSIGNMENTS="${AZURE_SKIP_GRAPH_ROLE_ASSIGNMENTS:-false}"
EXTERNAL_POST_PROVISION_ENTRA="${GSI_EXTERNAL_POST_PROVISION_ENTRA:-false}"
GRAPH_PERMISSION_STATUS='assigned during post-provision'
RESTART_STATUS='completed'

if [ "${SKIP_ROLE_ASSIGNMENTS}" = "true" ]; then
  GRAPH_PERMISSION_STATUS='managed separately in this mode'
  RESTART_STATUS='not run in this deployment mode'
  echo ""
  echo 'Skipping automatic Function App restart because Microsoft Graph permissions are managed separately in this deployment mode.'
elif [ "${EXTERNAL_POST_PROVISION_ENTRA}" = "true" ]; then
  GRAPH_PERMISSION_STATUS='handled in deploy-azure.ps1 after azd provision'
  RESTART_STATUS='handled in deploy-azure.ps1 after azd provision'
  echo ""
  echo 'Skipping automatic Function App restart during the Azure-only azd phase.'
  echo 'deploy-azure.ps1 performs the Graph permission assignment and restart after azd provision.'
else
  if [[ -z "${FUNCTION_APP_NAME:-}" || -z "${MANAGED_IDENTITY_OBJECT_ID:-}" || -z "${AZURE_RESOURCE_GROUP:-}" ]]; then
    echo 'ERROR: Managed Identity Object ID was not available after azd provision; Graph role assignments cannot continue.' >&2
    exit 1
  fi

  echo ""
  echo 'Assigning Microsoft Graph permissions...'
  if ! az deployment group create \
    --name 'gsi-graph-permissions' \
    --resource-group "${AZURE_RESOURCE_GROUP}" \
    --template-file "${INFRA_DIR}/assign-graph-permissions.bicep" \
    --parameters "managedIdentityObjectId=${MANAGED_IDENTITY_OBJECT_ID}" \
    --output none >/dev/null; then
    echo 'ERROR: Could not assign Microsoft Graph permissions in the post-provision phase.' >&2
    exit 1
  fi

  echo ""
  echo "Restarting Function App '${FUNCTION_APP_NAME}' to activate Graph permissions..."
  az functionapp restart --resource-group "${AZURE_RESOURCE_GROUP}" --name "${FUNCTION_APP_NAME}" --output none >/dev/null
fi

# ── Print concise post-provision summary ─────────────────────────────────────
echo ""
echo "Post-provision summary"
echo "----------------------"
print_summary_line "Function app restart" "${RESTART_STATUS}"
print_summary_line "Microsoft Graph permissions" "${GRAPH_PERMISSION_STATUS}"
print_summary_line "Guest Sponsor API Base URL" "${FUNCTION_APP_URL}"
print_summary_line "Guest Sponsor API Client ID" "${WEB_PART_CLIENT_ID}"

# ── Deferred Graph permissions reminder ───────────────────────────────────────
# deploy-azure.ps1 writes AZURE_SKIP_GRAPH_ROLE_ASSIGNMENTS to the azd env
# when Graph role assignment is deferred.
# Remind the operator to run the follow-up script.
if [ "${SKIP_ROLE_ASSIGNMENTS}" = "true" ]; then
  print_summary_line "Managed identity object ID" "${MANAGED_IDENTITY_OBJECT_ID}"
  print_summary_line "TenantId" "${AZURE_TENANT_ID:-}"
  print_summary_line "If needed, run this script" "setup-graph-permissions.ps1"
  print_summary_line "When to run it" "if the web part shows permission errors"
fi
echo ""
echo "Note: Storage role assignment propagation can take 1-2 minutes."
if [ "${SKIP_ROLE_ASSIGNMENTS}" = "true" ]; then
  echo "If the web part shows permission errors, run setup-graph-permissions.ps1 and then restart the Function App once."
elif [ "${EXTERNAL_POST_PROVISION_ENTRA}" = "true" ]; then
  echo 'If you are using deploy-azure.ps1, it finishes Graph permissions and restarts the Function App after azd provision.'
else
  echo 'Microsoft Graph permissions were assigned and the Function App was restarted automatically.'
fi
