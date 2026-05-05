#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
# SPDX-FileCopyrightText: 2026 Julian Pawlowski <https://github.com/jpawlowski>
# SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
#
# Pre-provision hook for Azure Developer CLI (azd).
# Runs before the Azure-only Bicep deployment to:
#   1. Validate the Azure-side prerequisites and required environment values.
#   2. Detect or prompt for the SharePoint tenant name when it is unset.
#
# deploy-azure.ps1 prepares the Entra App Registration before azd provision and
# writes the resolved Function App name plus EasyAuth client ID into the azd
# environment. When azd is run directly, this hook derives the same values so
# the Azure-only template can deploy end to end.
#
# All operations are idempotent — safe to re-run on 'azd provision' or 'azd up'.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INVOCATION_DIR="$(pwd)"

find_azd_project_root() {
  local candidate

  if [[ -n "${AZD_PROJECT_PATH:-}" && -f "${AZD_PROJECT_PATH}/azure.yaml" ]]; then
    printf '%s\n' "${AZD_PROJECT_PATH}"
    return 0
  fi

  if [[ -f "${INVOCATION_DIR}/azure.yaml" ]]; then
    printf '%s\n' "${INVOCATION_DIR}"
    return 0
  fi

  candidate="${SCRIPT_DIR}"
  while [[ "${candidate}" != '/' ]]; do
    if [[ -f "${candidate}/azure.yaml" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
    candidate="$(dirname "${candidate}")"
  done

  return 1
}

if ! PROJECT_ROOT="$(find_azd_project_root)"; then
  echo 'ERROR: azure.yaml not found for azd pre-provision hook.' >&2
  exit 1
fi

cd "${PROJECT_ROOT}"

INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

refresh_azd_env_values() {
  _ENV_VALUES="$(azd env get-values 2>/dev/null || true)"
}

get_azd_env_value() {
  local key="$1"

  printf '%s\n' "${_ENV_VALUES}" |
    grep "^${key}=" |
    head -1 |
    cut -d'=' -f2- |
    tr -d '"' || true
}

set_azd_env_value() {
  local key="$1"
  local value="$2"

  azd env set "${key}" "${value}" >/dev/null
  refresh_azd_env_values
}

ensure_resource_group_exists() {
  local resource_group_name="$1"
  local location="$2"
  local resource_group_exists=''

  resource_group_exists="$(az group exists --name "${resource_group_name}" -o tsv 2>/dev/null || true)"
  if [[ -z "${resource_group_exists}" ]]; then
    echo "ERROR: Could not verify whether resource group '${resource_group_name}' already exists." >&2
    exit 1
  fi

  if [[ "${resource_group_exists}" == 'true' ]]; then
    return 0
  fi

  if ! az group create --name "${resource_group_name}" --location "${location}" --output none >/dev/null 2>&1; then
    echo "ERROR: Could not create resource group '${resource_group_name}' in location '${location}'." >&2
    exit 1
  fi
}

prepare_direct_azd_entra_inputs() {
  local tenant_id=''
  local resource_group_name=''
  local location=''
  local function_app_name=''
  local existing_function_app_name=''
  local app_client_id=''

  refresh_azd_env_values

  if [[ -z "$(get_azd_env_value 'AZURE_TENANT_ID')" ]]; then
    tenant_id="$(az account show --query tenantId -o tsv 2>/dev/null || true)"
    if [[ -z "${tenant_id}" || "${tenant_id}" == 'null' ]]; then
      echo 'ERROR: AZURE_TENANT_ID is not set and could not be derived from the active Azure CLI context.' >&2
      echo 'Run az login first or set it manually with: azd env set AZURE_TENANT_ID <tenant-guid>' >&2
      exit 1
    fi

    set_azd_env_value 'AZURE_TENANT_ID' "${tenant_id}"
  fi

  resource_group_name="$(get_azd_env_value 'AZURE_RESOURCE_GROUP')"
  location="$(get_azd_env_value 'AZURE_LOCATION')"
  if [[ -z "${resource_group_name}" || -z "${location}" ]]; then
    echo 'ERROR: AZURE_RESOURCE_GROUP and AZURE_LOCATION must be set before azd can run the Azure-only template.' >&2
    echo 'Use deploy-azure.ps1 or set them manually with: azd env set AZURE_RESOURCE_GROUP <name> and azd env set AZURE_LOCATION <region>' >&2
    exit 1
  fi

  ensure_resource_group_exists "${resource_group_name}" "${location}"

  if [[ -z "$(get_azd_env_value 'AZURE_FUNCTION_APP_NAME')" ]]; then
    existing_function_app_name="$(az functionapp list \
      --resource-group "${resource_group_name}" \
      --query "[?tags.application=='guest-sponsor-info'].name | [0]" \
      -o tsv 2>/dev/null || true)"

    if [[ -n "${existing_function_app_name}" && "${existing_function_app_name}" != 'null' ]]; then
      function_app_name="${existing_function_app_name}"
    else
      function_app_name="$(az deployment group create \
        --name 'gsi-resolve-function-app-name' \
        --resource-group "${resource_group_name}" \
        --template-file "${INFRA_DIR}/resolve-function-app-name.bicep" \
        --query 'properties.outputs.effectiveFunctionAppName.value' \
        -o tsv 2>/dev/null || true)"
    fi

    if [[ -z "${function_app_name}" || "${function_app_name}" == 'null' ]]; then
      echo 'ERROR: Could not determine the Function App name for the Azure-only deployment.' >&2
      echo 'Set it manually with: azd env set AZURE_FUNCTION_APP_NAME <function-app-name>' >&2
      exit 1
    fi

    set_azd_env_value 'AZURE_FUNCTION_APP_NAME' "${function_app_name}"
  fi

  if [[ -z "$(get_azd_env_value 'AZURE_WEB_PART_CLIENT_ID')" ]]; then
    function_app_name="$(get_azd_env_value 'AZURE_FUNCTION_APP_NAME')"
    app_reg_unique_name="guest-sponsor-info-proxy-${function_app_name}"

    app_client_id="$(az ad app list \
      --filter "uniqueName eq '${app_reg_unique_name}'" \
      --query '[0].appId' \
      -o tsv 2>/dev/null || true)"

    if [[ -z "${app_client_id}" || "${app_client_id}" == 'null' ]]; then
      if [[ "$(az group exists --name "${resource_group_name}" 2>/dev/null || true)" != 'true' ]]; then
        echo ''
        echo "Preparing resource group '${resource_group_name}' for the Entra auth bootstrap..."
        az group create --name "${resource_group_name}" --location "${location}" --output none >/dev/null
      fi

      app_client_id="$(az deployment group create \
        --name 'gsi-entra-auth-pre' \
        --resource-group "${resource_group_name}" \
        --template-file "${INFRA_DIR}/entra-auth.bicep" \
        --parameters "functionAppName=${function_app_name}" \
        --query 'properties.outputs.webPartClientId.value' \
        -o tsv 2>/dev/null || true)"
    fi

    if [[ -z "${app_client_id}" || "${app_client_id}" == 'null' ]]; then
      echo 'ERROR: Could not prepare the EasyAuth App Registration before azd provision.' >&2
      echo 'Ensure the signed-in account can create/update Entra applications, or set the client ID manually with: azd env set AZURE_WEB_PART_CLIENT_ID <app-client-id>' >&2
      exit 1
    fi

    set_azd_env_value 'AZURE_WEB_PART_CLIENT_ID' "${app_client_id}"
  fi
}

# ── 0a. Check Azure RBAC permission ─────────────────────────────────────────
# Contributor (or Owner) on the subscription is needed to register resource
# providers and to deploy Bicep resources.  The check is informational — a
# missing role does not abort the script, but it surfaces the gap early so
# the operator can activate a PIM role or request access before the actual
# deployment runs.
echo ''
echo 'Checking Azure role assignment...'
# Use the env var set by azd (from the .env file) with fallback to parsing azd env.
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-$(azd env get-values 2>/dev/null | grep '^AZURE_SUBSCRIPTION_ID=' | cut -d'=' -f2 | tr -d '"' || true)}"
if [[ -n "${SUBSCRIPTION_ID:-}" ]]; then
  USER_ID="$(az ad signed-in-user show --query id -o tsv 2>/dev/null || true)"
  if [[ -n "${USER_ID:-}" ]]; then
    RBAC_ROLES="$(az role assignment list \
      --scope "/subscriptions/${SUBSCRIPTION_ID}" \
      --assignee "${USER_ID}" \
      --include-inherited \
      --query "[?contains(['Owner','Contributor'], roleDefinitionName)].roleDefinitionName" \
      -o tsv 2>/dev/null || true)"
    if [[ -n "${RBAC_ROLES:-}" ]]; then
      # Collapse newlines to a comma-separated list for display.
      RBAC_LIST="$(echo "${RBAC_ROLES}" | sort -u | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')"
      echo "  ✓ Azure RBAC: ${RBAC_LIST} on subscription."
    else
      echo '  ! Azure RBAC: no Contributor or Owner role found on this subscription.'
      echo '    Both are required for resource provider registration and Bicep deployment.'
      echo '    Contact your subscription owner to request Contributor access or activate'
      echo '    an eligible role via Azure PIM before re-running azd provision.'
      echo '    Azure PIM: https://portal.azure.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade/~/azurerbac'
    fi
  else
    echo '  ! Azure RBAC: could not identify the signed-in user — skipping check.'
    echo '    Required: Contributor or Owner on the subscription.'
  fi
else
  echo '  ! Azure RBAC: AZURE_SUBSCRIPTION_ID not yet set — skipping role check.'
  echo '    Required: Contributor or Owner on the subscription.'
fi
echo ''

# ── 0. Validate required Azure resource providers ───────────────────────────
# Read from azd env — set by deploy-azure.ps1 via 'azd env set' before running
# provision. Fall back to the same defaults used by main.bicep when running azd
# directly without the wizard.
get_azd_env_bool() {
  local env_values="$1"
  local key="$2"
  local default_value="$3"
  local raw_value

  raw_value="$(printf '%s\n' "${env_values}" | grep "^${key}=" | cut -d'=' -f2 | tr -d '"' || true)"

  case "${raw_value,,}" in
    true)
      printf 'true\n'
      ;;
    false)
      printf 'false\n'
      ;;
    *)
      printf '%s\n' "${default_value}"
      ;;
  esac
}

refresh_azd_env_values
DEPLOY_AZURE_MAPS="$(get_azd_env_bool "${_ENV_VALUES}" 'AZURE_DEPLOY_AZURE_MAPS' 'true')"
ENABLE_MONITORING="$(get_azd_env_bool "${_ENV_VALUES}" 'AZURE_ENABLE_MONITORING' 'true')"
ENABLE_FAILURE_ANOMALIES_ALERT="$(get_azd_env_bool "${_ENV_VALUES}" 'AZURE_ENABLE_FAILURE_ANOMALIES_ALERT' 'false')"

# Native Flex deployment uses Microsoft.Web plus the deployment storage
# container
# Microsoft.App is intentionally omitted: this template does not configure
# Flex Consumption VNet integration or subnet delegation.
REQUIRED_PROVIDERS=(
  'Microsoft.Authorization'
  'Microsoft.ManagedIdentity'
  'Microsoft.Resources'
  'Microsoft.Storage'
  'Microsoft.Web'
)

if [[ "${ENABLE_MONITORING}" == 'true' ]]; then
  REQUIRED_PROVIDERS+=(
    'Microsoft.Insights'
    'Microsoft.OperationalInsights'
  )
fi

if [[ "${ENABLE_MONITORING}" == 'true' && "${ENABLE_FAILURE_ANOMALIES_ALERT}" == 'true' ]]; then
  REQUIRED_PROVIDERS+=(
    'Microsoft.AlertsManagement'
  )
fi

if [[ "${DEPLOY_AZURE_MAPS,,}" == 'true' ]]; then
  REQUIRED_PROVIDERS+=(
    'Microsoft.Maps'
  )
fi

mapfile -t REQUIRED_PROVIDERS < <(printf '%s\n' "${REQUIRED_PROVIDERS[@]}" | sort -u)

echo 'Checking required Azure resource providers...'
MISSING_PROVIDERS=()
for provider in "${REQUIRED_PROVIDERS[@]}"; do
  state="$(az provider show --namespace "${provider}" --query registrationState -o tsv 2>/dev/null || true)"

  case "${state}" in
    Registered)
      echo "  ✓ ${provider} is registered."
      ;;
    Registering)
      echo "  ! ${provider} is still registering. Deployment can usually continue."
      ;;
    NotRegistered | Unregistered | '')
      echo "  ! ${provider} is not registered."
      MISSING_PROVIDERS+=("${provider}")
      ;;
    *)
      echo "  ! ${provider} returned state: ${state}"
      MISSING_PROVIDERS+=("${provider}")
      ;;
  esac
done

if [[ ${#MISSING_PROVIDERS[@]} -gt 0 ]]; then
  echo 'Registering missing Azure resource providers...'
  for provider in "${MISSING_PROVIDERS[@]}"; do
    echo "  -> az provider register --namespace ${provider} --wait"
    if az provider register --namespace "${provider}" --wait >/dev/null; then
      echo "  ✓ ${provider} registered."
    else
      echo "ERROR: Could not register ${provider}." >&2
      echo 'This usually means your account lacks subscription-level register permission.' >&2
      echo 'Minimum built-in role: Contributor. Owner also works.' >&2
      exit 1
    fi
  done
else
  echo '  ✓ All required resource providers are ready.'
fi

# ── 1. Detect or prompt for SharePoint tenant name ──────────────────────────
if ! azd env get-values | grep -q "^AZURE_SHAREPOINT_TENANT_NAME="; then
  # Try to derive from the default verified domain (e.g. contoso.onmicrosoft.com → contoso).
  DERIVED=$(az rest \
    --method GET \
    --url "https://graph.microsoft.com/v1.0/organization?\$select=verifiedDomains" \
    --query "value[0].verifiedDomains[?isInitial].name | [0]" \
    -o tsv 2>/dev/null | sed 's/\.onmicrosoft\.com//' || true)

  if [ -n "${DERIVED:-}" ]; then
    echo "Detected SharePoint tenant name: ${DERIVED}"
    azd env set AZURE_SHAREPOINT_TENANT_NAME "${DERIVED}"
  else
    read -rp "Enter your SharePoint tenant name (e.g. 'contoso' for contoso.sharepoint.com): " TENANT_NAME
    azd env set AZURE_SHAREPOINT_TENANT_NAME "${TENANT_NAME}"
  fi
fi

if ! azd env get-values | grep -q '^AZURE_DEPLOY_AZURE_MAPS='; then
  azd env set AZURE_DEPLOY_AZURE_MAPS 'true'
fi

if ! azd env get-values | grep -q '^AZURE_TAG_ENVIRONMENT='; then
  azd env set AZURE_TAG_ENVIRONMENT ''
fi

if ! azd env get-values | grep -q '^AZURE_TAG_CRITICALITY='; then
  azd env set AZURE_TAG_CRITICALITY ''
fi

if ! azd env get-values | grep -q '^AZURE_APP_VERSION='; then
  azd env set AZURE_APP_VERSION 'latest'
fi

if ! azd env get-values | grep -q '^AZURE_ENABLE_MONITORING='; then
  azd env set AZURE_ENABLE_MONITORING 'true'
fi

if ! azd env get-values | grep -q '^AZURE_ENABLE_FAILURE_ANOMALIES_ALERT='; then
  azd env set AZURE_ENABLE_FAILURE_ANOMALIES_ALERT 'false'
fi

if ! azd env get-values | grep -q '^AZURE_ALWAYS_READY_INSTANCES='; then
  azd env set AZURE_ALWAYS_READY_INSTANCES '0'
fi

if ! azd env get-values | grep -q '^AZURE_MAXIMUM_FLEX_INSTANCES='; then
  azd env set AZURE_MAXIMUM_FLEX_INSTANCES '10'
fi

if ! azd env get-values | grep -q '^AZURE_INSTANCE_MEMORY_MB='; then
  azd env set AZURE_INSTANCE_MEMORY_MB '512'
fi

prepare_direct_azd_entra_inputs

# ── 3. Entra role check ──────────────────────────────────────────────────────
# The Azure-only azd phase deploys the hosting resources. The Entra bootstrap
# runs before azd provision, and Microsoft Graph role assignment runs after the
# Azure phase when automatic assignment is enabled.
echo ''
echo 'Entra phase status...'
SKIP_ROLE_ASSIGNMENTS="${AZURE_SKIP_GRAPH_ROLE_ASSIGNMENTS:-}"
echo '  + EasyAuth App Registration is prepared before azd provision.'
if [[ "${SKIP_ROLE_ASSIGNMENTS}" == 'true' ]]; then
  echo '  + Microsoft Graph role assignments remain deferred to setup-graph-permissions.ps1.'
else
  echo '  + Microsoft Graph role assignments run in deploy-azure.ps1 after azd provision.'
fi
echo ''
