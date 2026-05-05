#!/usr/bin/env pwsh
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

$ErrorActionPreference = 'Stop'

$_invocationPath = (Get-Location).Path

function Get-AzdProjectRoot {
  if ($env:AZD_PROJECT_PATH -and (Test-Path -Path (Join-Path -Path $env:AZD_PROJECT_PATH -ChildPath 'azure.yaml'))) {
    return $env:AZD_PROJECT_PATH
  }

  if (Test-Path -Path (Join-Path -Path $_invocationPath -ChildPath 'azure.yaml')) {
    return $_invocationPath
  }

  $_candidate = $PSScriptRoot
  while ($_candidate) {
    if (Test-Path -Path (Join-Path -Path $_candidate -ChildPath 'azure.yaml')) {
      return $_candidate
    }

    $_parent = Split-Path -Path $_candidate -Parent
    if (-not $_parent -or $_parent -eq $_candidate) {
      break
    }
    $_candidate = $_parent
  }

  throw 'azure.yaml not found for azd pre-provision hook.'
}

Set-Location -Path (Get-AzdProjectRoot)

$infraRoot = Split-Path -Path $PSScriptRoot -Parent

function Get-AzdEnvSnapshot {
  return @(azd env get-values 2>$null)
}

function Get-AzdEnvValue {
  param([Parameter(Mandatory)][string]$Name)

  $_pattern = '^{0}="?([^\"]*)"?' -f [regex]::Escape($Name)
  $_match = ((Get-AzdEnvSnapshot) | Select-String $_pattern).Matches
  if ($_match -and $_match.Count -gt 0) {
    return $_match[0].Groups[1].Value
  }

  return ''
}

function Set-AzdEnvValue {
  [CmdletBinding(SupportsShouldProcess)]
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][string]$Value
  )

  if ($PSCmdlet.ShouldProcess('azd environment', "set $Name")) {
    azd env set $Name $Value | Out-Null
  }
}

function Initialize-DirectAzdEntraContext {
  $tenantId = Get-AzdEnvValue -Name 'AZURE_TENANT_ID'
  if (-not $tenantId) {
    $tenantId = az account show --query tenantId -o tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $tenantId -or $tenantId -eq 'null') {
      throw @(
        'AZURE_TENANT_ID is not set and could not be derived from the active Azure CLI context.',
        'Run az login first or set it manually with: azd env set AZURE_TENANT_ID <tenant-guid>'
      ) -join ' '
    }

    Set-AzdEnvValue -Name 'AZURE_TENANT_ID' -Value $tenantId
  }

  $resourceGroupName = Get-AzdEnvValue -Name 'AZURE_RESOURCE_GROUP'
  $location = Get-AzdEnvValue -Name 'AZURE_LOCATION'
  if (-not $resourceGroupName -or -not $location) {
    throw @(
      'AZURE_RESOURCE_GROUP and AZURE_LOCATION must be set before azd can run the Azure-only template.',
      'Use deploy-azure.ps1 or set them manually with: azd env set AZURE_RESOURCE_GROUP <name> and azd env set AZURE_LOCATION <region>'
    ) -join ' '
  }

  $functionAppName = Get-AzdEnvValue -Name 'AZURE_FUNCTION_APP_NAME'
  if (-not $functionAppName) {
    $existingFunctionAppName = az functionapp list `
      --resource-group $resourceGroupName `
      --query "[?tags.application=='guest-sponsor-info'].name | [0]" `
      -o tsv 2>$null

    if ($LASTEXITCODE -eq 0 -and $existingFunctionAppName -and $existingFunctionAppName -ne 'null') {
      $functionAppName = $existingFunctionAppName
    }
    else {
      $functionAppName = az deployment sub create `
        --name 'gsi-resolve-function-app-name' `
        --location $location `
        --template-file (Join-Path -Path $infraRoot -ChildPath 'resolve-function-app-name.bicep') `
        --parameters "resourceGroupName=$resourceGroupName" `
        --query 'properties.outputs.effectiveFunctionAppName.value' `
        -o tsv 2>$null
    }

    if ($LASTEXITCODE -ne 0 -or -not $functionAppName -or $functionAppName -eq 'null') {
      throw @(
        'Could not determine the Function App name for the Azure-only deployment.',
        'Set it manually with: azd env set AZURE_FUNCTION_APP_NAME <function-app-name>'
      ) -join ' '
    }

    Set-AzdEnvValue -Name 'AZURE_FUNCTION_APP_NAME' -Value $functionAppName
  }

  $webPartClientId = Get-AzdEnvValue -Name 'AZURE_WEB_PART_CLIENT_ID'
  if (-not $webPartClientId) {
    try {
      $appRegUniqueName = "guest-sponsor-info-proxy-$functionAppName"
      $webPartClientId = (az ad app list --filter "uniqueName eq '$appRegUniqueName'" --query '[0].appId' -o tsv 2>$null).Trim()
      if ($LASTEXITCODE -ne 0 -or $webPartClientId -eq 'null') {
        $webPartClientId = $null
      }
    }
    catch {
      $webPartClientId = $null
    }

    if (-not $webPartClientId) {
      $resourceGroupExists = (az group exists --name $resourceGroupName 2>$null)
      if ($LASTEXITCODE -ne 0) {
        $resourceGroupExists = 'false'
      }

      if ($resourceGroupExists -ne 'true') {
        Write-Host ''
        Write-Host "Preparing resource group '$resourceGroupName' for the Entra auth bootstrap..."
        az group create --name $resourceGroupName --location $location --output none | Out-Null
      }

      $webPartClientId = az deployment group create `
        --name 'gsi-entra-auth-pre' `
        --resource-group $resourceGroupName `
        --template-file (Join-Path -Path $infraRoot -ChildPath 'entra-auth.bicep') `
        --parameters "functionAppName=$functionAppName" `
        --query 'properties.outputs.webPartClientId.value' `
        -o tsv 2>$null
    }

    if ($LASTEXITCODE -ne 0 -or -not $webPartClientId -or $webPartClientId -eq 'null') {
      throw @(
        'Could not prepare the EasyAuth App Registration before azd provision.',
        'Ensure the signed-in account can create/update Entra applications, or set the client ID manually with: azd env set AZURE_WEB_PART_CLIENT_ID <app-client-id>'
      ) -join ' '
    }

    Set-AzdEnvValue -Name 'AZURE_WEB_PART_CLIENT_ID' -Value $webPartClientId
  }
}

$envValues = Get-AzdEnvSnapshot

# ── 0a. Check Azure RBAC permission ─────────────────────────────────────────
# Contributor (or Owner) on the subscription is needed to register resource
# providers and to deploy Bicep resources.  The check is informational — a
# missing role does not abort the script, but it surfaces the gap early so
# the operator can activate a PIM role or request access before the actual
# deployment runs.
Write-Host ''
Write-Host 'Checking Azure role assignment...'
$_subIdMatch = ($envValues | Select-String '^AZURE_SUBSCRIPTION_ID="?([^"]+)"?').Matches
$_subId = if ($_subIdMatch -and $_subIdMatch.Count -gt 0) { $_subIdMatch[0].Groups[1].Value } else { $null }
if ($_subId) {
  try {
    $_userId = az ad signed-in-user show --query id -o tsv 2>$null
    if ($LASTEXITCODE -eq 0 -and $_userId) {
      $_rbacRaw = az role assignment list `
        --scope "/subscriptions/$_subId" `
        --assignee "$_userId" `
        --include-inherited `
        --query "[?contains(['Owner','Contributor'], roleDefinitionName)].roleDefinitionName" `
        -o tsv 2>$null
      if ($LASTEXITCODE -eq 0) {
        $_rbacList = @($_rbacRaw -split "`n" | Where-Object { $_ } | Select-Object -Unique)
        if ($_rbacList.Count -gt 0) {
          Write-Host "  + Azure RBAC: $($_rbacList -join ', ') on subscription."
        }
        else {
          Write-Host '  ! Azure RBAC: no Contributor or Owner role found on this subscription.'
          Write-Host '    Both are required for resource provider registration and Bicep deployment.'
          Write-Host '    Contact your subscription owner to request Contributor access or activate'
          Write-Host '    an eligible role via Azure PIM before re-running azd provision.'
          Write-Host '    Azure PIM: https://portal.azure.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade/~/azurerbac'
        }
      }
      else {
        Write-Host '  ! Azure RBAC: role listing failed — continuing anyway.'
        Write-Host '    Required: Contributor or Owner on the subscription.'
      }
    }
    else {
      Write-Host '  ! Azure RBAC: could not identify the signed-in user — skipping check.'
      Write-Host '    Required: Contributor or Owner on the subscription.'
    }
  }
  catch {
    Write-Host '  ! Azure RBAC: check encountered an error — continuing anyway.'
    Write-Host '    Required: Contributor or Owner on the subscription.'
  }
}
else {
  Write-Host '  ! Azure RBAC: AZURE_SUBSCRIPTION_ID not yet set — skipping role check.'
  Write-Host '    Required: Contributor or Owner on the subscription.'
}
Write-Host ''

# ── 0. Validate required Azure resource providers ───────────────────────────
# Read from azd env — set by deploy-azure.ps1 via 'azd env set' before running
# provision. Fall back to the same defaults used by main.bicep when running azd
# directly without the wizard.
function Get-AzdEnvBooleanFlag {
  param(
    [Parameter(Mandatory)][string[]]$EnvValues,
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][bool]$DefaultValue
  )

  $_flagPattern = '^{0}="?([^"]+)"?' -f [regex]::Escape($Name)
  $_flagMatch = ($EnvValues | Select-String $_flagPattern).Matches
  if (-not $_flagMatch -or $_flagMatch.Count -eq 0) {
    return $DefaultValue
  }

  $_rawValue = $_flagMatch[0].Groups[1].Value.Trim()
  if ($_rawValue -match '^(?i:true)$') {
    return $true
  }
  if ($_rawValue -match '^(?i:false)$') {
    return $false
  }

  return $DefaultValue
}

$deployAzureMaps = Get-AzdEnvBooleanFlag -EnvValues $envValues -Name 'AZURE_DEPLOY_AZURE_MAPS' -DefaultValue $true
$enableMonitoring = Get-AzdEnvBooleanFlag -EnvValues $envValues -Name 'AZURE_ENABLE_MONITORING' -DefaultValue $true
$enableFailureAnomaliesAlert = Get-AzdEnvBooleanFlag -EnvValues $envValues -Name 'AZURE_ENABLE_FAILURE_ANOMALIES_ALERT' -DefaultValue $false

# Native Flex deployment uses Microsoft.Web plus the deployment storage
# container
# Microsoft.App is intentionally omitted: this template does not configure
# Flex Consumption VNet integration or subnet delegation.
$requiredProviders = @(
  'Microsoft.Authorization',
  'Microsoft.ManagedIdentity',
  'Microsoft.Resources',
  'Microsoft.Storage',
  'Microsoft.Web'
)

if ($enableMonitoring) {
  $requiredProviders += @(
    'Microsoft.Insights',
    'Microsoft.OperationalInsights'
  )
}

if ($enableMonitoring -and $enableFailureAnomaliesAlert) {
  $requiredProviders += 'Microsoft.AlertsManagement'
}

if ($deployAzureMaps) {
  $requiredProviders += 'Microsoft.Maps'
}

$requiredProviders = $requiredProviders | Sort-Object -Unique
$missingProviders = @()

Write-Host 'Checking required Azure resource providers...'
foreach ($provider in $requiredProviders) {
  $state = az provider show --namespace $provider --query registrationState -o tsv 2>$null

  switch ($state) {
    'Registered' {
      Write-Host "  + $provider is registered."
    }
    'Registering' {
      Write-Host "  ! $provider is still registering. Deployment can usually continue."
    }
    'NotRegistered' {
      Write-Host "  ! $provider is not registered."
      $missingProviders += $provider
    }
    'Unregistered' {
      Write-Host "  ! $provider is not registered."
      $missingProviders += $provider
    }
    '' {
      Write-Host "  ! $provider returned no state."
      $missingProviders += $provider
    }
    default {
      Write-Host "  ! $provider returned state: $state"
      $missingProviders += $provider
    }
  }
}

if ($missingProviders.Count -gt 0) {
  Write-Host 'Registering missing Azure resource providers...'
  foreach ($provider in $missingProviders) {
    Write-Host "  -> az provider register --namespace $provider --wait"
    try {
      az provider register --namespace $provider --wait | Out-Null
      Write-Host "  + $provider registered."
    }
    catch {
      throw @(
        "Could not register $provider.",
        'This usually means your account lacks subscription-level register permission.',
        'Minimum built-in role: Contributor. Owner also works.'
      ) -join ' '
    }
  }
}
else {
  Write-Host '  + All required resource providers are ready.'
}

# ── 1. Detect or prompt for SharePoint tenant name ──────────────────────────
if ($envValues -notmatch 'AZURE_SHAREPOINT_TENANT_NAME=') {
  $derived = $null
  try {
    $raw = az rest `
      --method GET `
      --url 'https://graph.microsoft.com/v1.0/organization?$select=verifiedDomains' `
      --query 'value[0].verifiedDomains[?isInitial].name | [0]' `
      -o tsv 2>$null
    $derived = $raw -replace '\.onmicrosoft\.com$', ''
  }
  catch {
    # az rest for tenant detection is best-effort; failure is handled by the
    # Read-Host prompt below.
    Write-Verbose "Tenant name detection via az rest failed: $_"
  }

  if ($derived) {
    Write-Host "Detected SharePoint tenant name: $derived"
    azd env set AZURE_SHAREPOINT_TENANT_NAME $derived
  }
  else {
    $tenantName = Read-Host "Enter your SharePoint tenant name (e.g. 'contoso' for contoso.sharepoint.com)"
    azd env set AZURE_SHAREPOINT_TENANT_NAME $tenantName
  }
}

if ($envValues -notmatch 'AZURE_DEPLOY_AZURE_MAPS=') {
  azd env set AZURE_DEPLOY_AZURE_MAPS 'true'
}

if ($envValues -notmatch 'AZURE_TAG_ENVIRONMENT=') {
  azd env set AZURE_TAG_ENVIRONMENT ''
}

if ($envValues -notmatch 'AZURE_TAG_CRITICALITY=') {
  azd env set AZURE_TAG_CRITICALITY ''
}

if ($envValues -notmatch 'AZURE_APP_VERSION=') {
  azd env set AZURE_APP_VERSION 'latest'
}

if ($envValues -notmatch 'AZURE_ENABLE_MONITORING=') {
  azd env set AZURE_ENABLE_MONITORING 'true'
}

if ($envValues -notmatch 'AZURE_ENABLE_FAILURE_ANOMALIES_ALERT=') {
  azd env set AZURE_ENABLE_FAILURE_ANOMALIES_ALERT 'false'
}

if ($envValues -notmatch 'AZURE_ALWAYS_READY_INSTANCES=') {
  azd env set AZURE_ALWAYS_READY_INSTANCES '0'
}

if ($envValues -notmatch 'AZURE_MAXIMUM_FLEX_INSTANCES=') {
  azd env set AZURE_MAXIMUM_FLEX_INSTANCES '10'
}

if ($envValues -notmatch 'AZURE_INSTANCE_MEMORY_MB=') {
  azd env set AZURE_INSTANCE_MEMORY_MB '512'
}

Initialize-DirectAzdEntraContext

# ── 3. Entra role check ──────────────────────────────────────────────────────
# The Azure-only azd phase deploys the hosting resources. The Entra bootstrap
# runs before azd provision, and Microsoft Graph role assignment runs after the
# Azure phase when automatic assignment is enabled.
Write-Host ''
Write-Host 'Entra phase status...'
$_skipRoleAssignments = $env:AZURE_SKIP_GRAPH_ROLE_ASSIGNMENTS -eq 'true'
Write-Host '  + EasyAuth App Registration is prepared before azd provision.'
if ($_skipRoleAssignments) {
  Write-Host '  + Microsoft Graph role assignments remain deferred to setup-graph-permissions.ps1.'
}
else {
  Write-Host '  + Microsoft Graph role assignments run in deploy-azure.ps1 after azd provision.'
}
Write-Host ''
