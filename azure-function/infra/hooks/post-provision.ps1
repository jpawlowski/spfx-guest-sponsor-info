#!/usr/bin/env pwsh
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

$ErrorActionPreference = 'Stop'

function Sync-AzdEnvValue {
  param(
    [Parameter(Mandatory)][string]$Name,
    [AllowEmptyString()][string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return
  }

  [Environment]::SetEnvironmentVariable($Name, $Value)
  azd env set $Name $Value | Out-Null
}

function Write-SummaryLine {
  param(
    [Parameter(Mandatory)][string]$Label,
    [AllowEmptyString()][string]$Value
  )

  $_displayValue = if ([string]::IsNullOrWhiteSpace($Value)) { '(not available)' } else { $Value }
  Write-Host ('  {0,-28}: {1}' -f $Label, $_displayValue)
}

function Get-WebPartClientIdFromEntra {
  param([Parameter(Mandatory)][string]$FunctionAppName)

  try {
    $_identifierUri = "api://guest-sponsor-info-$FunctionAppName"
    $_resolvedClientId = (az ad app show --id $_identifierUri --query 'appId' -o tsv 2>$null).Trim()
    if ($_resolvedClientId -and $_resolvedClientId -ne 'null') {
      return $_resolvedClientId
    }
  }
  catch {
    Write-Verbose "Could not resolve EasyAuth App Registration client ID by identifier URI from Entra: $_"
  }

  try {
    $_appRegUniqueName = "guest-sponsor-info-proxy-$FunctionAppName"
    $_resolvedClientId = (az ad app list --filter "uniqueName eq '$_appRegUniqueName'" --query '[0].appId' -o tsv 2>$null).Trim()
    if ($_resolvedClientId -and $_resolvedClientId -ne 'null') {
      return $_resolvedClientId
    }
  }
  catch {
    Write-Verbose "Could not resolve EasyAuth App Registration client ID by uniqueName from Entra: $_"
  }

  return $null
}

# Load azd environment. azd writes Bicep output names verbatim (camelCase) to
# the .env file and preloads them into the hook process with the same casing.
foreach ($line in (azd env get-values)) {
  if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"'))
  }
}
# Create SCREAMING_SNAKE_CASE aliases for camelCase Bicep outputs so the rest of
# this script uses a consistent naming convention alongside the AZURE_* env vars.
if (-not $env:FUNCTION_APP_URL) {
  if ($env:functionAppUrl) {
    $env:FUNCTION_APP_URL = $env:functionAppUrl
  }
  elseif ($env:sponsorApiEndpointUrl) {
    $env:FUNCTION_APP_URL = $env:sponsorApiEndpointUrl -replace '/api/getGuestSponsors$', ''
  }
  elseif ($env:sponsorApiUrl) {
    $env:FUNCTION_APP_URL = $env:sponsorApiUrl -replace '/api/getGuestSponsors$', ''
  }
}
if (-not $env:WEB_PART_CLIENT_ID) {
  $env:WEB_PART_CLIENT_ID = if ($env:webPartClientId) { $env:webPartClientId } else { $env:AZURE_WEB_PART_CLIENT_ID }
}
# functionAppName is exposed as a Bicep output (camelCase). Use the azd env
# value when that output is not present in the current hook environment.
if (-not $env:FUNCTION_APP_NAME) {
  $env:FUNCTION_APP_NAME = if ($env:functionAppName) { $env:functionAppName } else { $env:AZURE_FUNCTION_APP_NAME }
}
if (-not $env:MANAGED_IDENTITY_OBJECT_ID) {
  $env:MANAGED_IDENTITY_OBJECT_ID = $env:managedIdentityObjectId
}
if (-not $env:GRAPH_PERMISSIONS_ASSIGNED_MANAGED_IDENTITY_OBJECT_ID) {
  $env:GRAPH_PERMISSIONS_ASSIGNED_MANAGED_IDENTITY_OBJECT_ID = $env:graphPermissionsAssignedManagedIdentityObjectId
}

if (-not $env:FUNCTION_APP_URL -and $env:FUNCTION_APP_NAME -and $env:AZURE_RESOURCE_GROUP) {
  try {
    $_defaultHostName = (az functionapp show --name $env:FUNCTION_APP_NAME --resource-group $env:AZURE_RESOURCE_GROUP --query defaultHostName -o tsv 2>$null).Trim()
    if ($_defaultHostName -and $_defaultHostName -ne 'null') {
      $env:FUNCTION_APP_URL = "https://$_defaultHostName"
      $env:functionAppUrl = $env:FUNCTION_APP_URL
      Sync-AzdEnvValue -Name 'functionAppUrl' -Value $env:FUNCTION_APP_URL
    }
  }
  catch {
    Write-Verbose "Could not resolve Function App base URL from Azure: $_"
  }
}

if (-not $env:MANAGED_IDENTITY_OBJECT_ID -and $env:FUNCTION_APP_NAME -and $env:AZURE_RESOURCE_GROUP) {
  try {
    $_principalId = (az functionapp identity show --name $env:FUNCTION_APP_NAME --resource-group $env:AZURE_RESOURCE_GROUP --query principalId -o tsv 2>$null).Trim()
    if ($_principalId -and $_principalId -ne 'null') {
      $env:MANAGED_IDENTITY_OBJECT_ID = $_principalId
      $env:managedIdentityObjectId = $_principalId
      Sync-AzdEnvValue -Name 'managedIdentityObjectId' -Value $_principalId
    }
  }
  catch {
    Write-Verbose "Could not resolve Managed Identity object ID from Azure: $_"
  }
}

# azd can retain a stale webPartClientId in the env file. Resolve the EasyAuth
# App Registration directly by its deterministic identifier URI and sync the
# azd environment so both this hook and deploy-azure.ps1 print the real client ID.
if ($env:FUNCTION_APP_NAME) {
  $_resolvedClientId = Get-WebPartClientIdFromEntra -FunctionAppName $env:FUNCTION_APP_NAME
  if ($_resolvedClientId) {
    $env:WEB_PART_CLIENT_ID = $_resolvedClientId
    $env:webPartClientId = $_resolvedClientId
    $env:AZURE_WEB_PART_CLIENT_ID = $_resolvedClientId
    Sync-AzdEnvValue -Name 'AZURE_WEB_PART_CLIENT_ID' -Value $_resolvedClientId
    Sync-AzdEnvValue -Name 'webPartClientId' -Value $_resolvedClientId
  }
}

# ── Graph post-phase and restart status ──────────────────────────────────────
# Direct azd runs finish the Microsoft Graph role-assignment phase here after
# the Managed Identity object ID is resolved. The deployment wizard opts out
# via a transient process env var and performs the same post-phase after azd
# returns.
$_skipRoles = $env:AZURE_SKIP_GRAPH_ROLE_ASSIGNMENTS -eq 'true'
$_externalPostProvisionEntra = $env:GSI_EXTERNAL_POST_PROVISION_ENTRA -eq 'true'
$graphPermissionStatus = 'assigned during post-provision'
$restartStatus = 'completed'
if ($_skipRoles) {
  $graphPermissionStatus = 'managed separately in this mode'
  $restartStatus = 'not run in this deployment mode'
  Write-Host ''
  Write-Host 'Skipping automatic Function App restart because Microsoft Graph permissions are managed separately in this deployment mode.'
}
elseif ($_externalPostProvisionEntra) {
  $graphPermissionStatus = 'handled in deploy-azure.ps1 after azd provision'
  $restartStatus = 'handled in deploy-azure.ps1 after azd provision'
  Write-Host ''
  Write-Host 'Skipping automatic Function App restart during the Azure-only azd phase.'
  Write-Host 'deploy-azure.ps1 performs the Graph permission assignment and restart after azd provision.'
}
else {
  if (-not $env:FUNCTION_APP_NAME -or -not $env:MANAGED_IDENTITY_OBJECT_ID -or -not $env:AZURE_RESOURCE_GROUP) {
    throw 'Managed Identity Object ID was not available after azd provision; Graph role assignments cannot continue.'
  }

  if ($env:GRAPH_PERMISSIONS_ASSIGNED_MANAGED_IDENTITY_OBJECT_ID -eq $env:MANAGED_IDENTITY_OBJECT_ID) {
    $graphPermissionStatus = 'already assigned for the current managed identity'
    $restartStatus = 'not needed (managed identity unchanged)'
    Write-Host ''
    Write-Host 'Skipping Microsoft Graph permission assignment because the current Managed Identity was already completed earlier.'
  }
  else {
    Write-Host ''
    Write-Host 'Assigning Microsoft Graph permissions...'
    az deployment group create `
      --name 'gsi-graph-permissions' `
      --resource-group $env:AZURE_RESOURCE_GROUP `
      --template-file (Join-Path -Path (Join-Path -Path $PSScriptRoot -ChildPath '..') -ChildPath 'assign-graph-permissions.bicep') `
      --parameters "managedIdentityObjectId=$($env:MANAGED_IDENTITY_OBJECT_ID)" `
      --output none | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw 'Could not assign Microsoft Graph permissions in the post-provision phase.'
    }

    $env:GRAPH_PERMISSIONS_ASSIGNED_MANAGED_IDENTITY_OBJECT_ID = $env:MANAGED_IDENTITY_OBJECT_ID
    $env:graphPermissionsAssignedManagedIdentityObjectId = $env:MANAGED_IDENTITY_OBJECT_ID
    Sync-AzdEnvValue -Name 'graphPermissionsAssignedManagedIdentityObjectId' -Value $env:MANAGED_IDENTITY_OBJECT_ID

    Write-Host ''
    Write-Host "Restarting Function App '$($env:FUNCTION_APP_NAME)' to activate Graph permissions..."
    az functionapp restart --resource-group $env:AZURE_RESOURCE_GROUP --name $env:FUNCTION_APP_NAME --output none | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Could not restart Function App '$($env:FUNCTION_APP_NAME)' after assigning Graph permissions."
    }
  }
}

# ── Print concise post-provision summary ─────────────────────────────────────
Write-Host ''
Write-Host 'Post-provision summary'
Write-Host '----------------------' -ForegroundColor DarkGray
Write-SummaryLine -Label 'Function app restart' -Value $restartStatus
Write-SummaryLine -Label 'Microsoft Graph permissions' -Value $graphPermissionStatus
Write-SummaryLine -Label 'Guest Sponsor API Base URL' -Value $env:FUNCTION_APP_URL
Write-SummaryLine -Label 'Guest Sponsor API Client ID' -Value $env:WEB_PART_CLIENT_ID

# ── Deferred Graph permissions reminder ───────────────────────────────────────
# deploy-azure.ps1 writes AZURE_SKIP_GRAPH_ROLE_ASSIGNMENTS to the azd env
# when Graph role assignment is deferred.
# Remind the operator to run the follow-up script.
if ($_skipRoles) {
  Write-SummaryLine -Label 'Managed identity object ID' -Value $env:MANAGED_IDENTITY_OBJECT_ID
  Write-SummaryLine -Label 'TenantId' -Value $env:AZURE_TENANT_ID
  Write-SummaryLine -Label 'If needed, run this script' -Value 'setup-graph-permissions.ps1'
  Write-SummaryLine -Label 'When to run it' -Value 'if the web part shows permission errors'
}
Write-Host ''
Write-Host 'Note: Storage role assignment propagation can take 1-2 minutes.'
if ($_skipRoles) {
  Write-Host 'If the web part shows permission errors, run setup-graph-permissions.ps1 and then restart the Function App once.'
}
elseif ($_externalPostProvisionEntra) {
  Write-Host 'If you are using deploy-azure.ps1, it finishes Graph permissions and restarts the Function App after azd provision.'
}
else {
  Write-Host 'Microsoft Graph permissions were assigned and the Function App was restarted automatically.'
}
