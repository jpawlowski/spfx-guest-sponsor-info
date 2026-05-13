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

function Get-EasyAuthAppRegistrationIdentifierUri {
  param([Parameter(Mandatory)][string]$FunctionAppName)

  return "api://guest-sponsor-info-$FunctionAppName"
}

function Get-WebPartClientIdFromEntra {
  param([Parameter(Mandatory)][string]$FunctionAppName)

  try {
    $identifierUri = Get-EasyAuthAppRegistrationIdentifierUri -FunctionAppName $FunctionAppName
    $webPartClientId = (az ad app show --id $identifierUri --query appId -o tsv 2>$null).Trim()
    if ($LASTEXITCODE -eq 0 -and $webPartClientId -and $webPartClientId -ne 'null') {
      return $webPartClientId
    }
  }
  catch {
    Write-Verbose "Could not resolve EasyAuth App Registration client ID by identifier URI from Entra: $_"
  }

  try {
    $appRegUniqueName = "guest-sponsor-info-proxy-$FunctionAppName"
    $webPartClientId = (az ad app list --filter "uniqueName eq '$appRegUniqueName'" --query '[0].appId' -o tsv 2>$null).Trim()
    if ($LASTEXITCODE -eq 0 -and $webPartClientId -and $webPartClientId -ne 'null') {
      return $webPartClientId
    }
  }
  catch {
    Write-Verbose "Could not resolve EasyAuth App Registration client ID by uniqueName from Entra: $_"
  }

  return $null
}

function Test-EasyAuthUniqueNameConflict {
  param([AllowEmptyString()][string]$Message)

  return -not [string]::IsNullOrWhiteSpace($Message) -and
  $Message -match '(?i)uniqueName[^\r\n]*already exists'
}

function Test-AzureCliBicepAvailable {
  az bicep version 2>$null | Out-Null
  return $LASTEXITCODE -eq 0
}

function Initialize-ResourceGroup {
  param(
    [Parameter(Mandatory)][string]$ResourceGroupName,
    [Parameter(Mandatory)][string]$Location
  )

  $resourceGroupExists = az group exists --name $ResourceGroupName -o tsv 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "Could not verify whether resource group '$ResourceGroupName' already exists."
  }

  if ($resourceGroupExists -eq 'true') {
    return
  }

  az group create --name $ResourceGroupName --location $Location --output none 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Could not create resource group '$ResourceGroupName' in location '$Location'."
  }
}

function Initialize-DirectAzdEntraContext {
  if (-not (Test-AzureCliBicepAvailable)) {
    throw @(
      'Azure CLI cannot run Bicep templates in this session.',
      'Run: az bicep install',
      'Then re-run azd provision or use deploy-azure.ps1, which can install this interactively.'
    ) -join ' '
  }

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

  Initialize-ResourceGroup -ResourceGroupName $resourceGroupName -Location $location

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
      $functionAppName = az deployment group create `
        --name 'gsi-resolve-function-app-name' `
        --resource-group $resourceGroupName `
        --template-file (Join-Path -Path $infraRoot -ChildPath 'resolve-function-app-name.bicep') `
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
    $webPartClientId = Get-WebPartClientIdFromEntra -FunctionAppName $functionAppName

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

      $stderrFile = Join-Path ([System.IO.Path]::GetTempPath()) "gsi-entra-auth-pre-$([guid]::NewGuid().ToString('n')).log"
      $deploymentExitCode = 0
      $deploymentOutput = $null
      $deploymentErrorText = ''
      try {
        $deploymentOutput = @(az deployment group create `
            --name 'gsi-entra-auth-pre' `
            --resource-group $resourceGroupName `
            --template-file (Join-Path -Path $infraRoot -ChildPath 'entra-auth.bicep') `
            --parameters "functionAppName=$functionAppName" `
            --query 'properties.outputs.webPartClientId.value' `
            -o tsv 2>$stderrFile)
        $deploymentExitCode = $LASTEXITCODE
        if (Test-Path -Path $stderrFile) {
          $deploymentErrorText = (Get-Content -Path $stderrFile -Raw -ErrorAction SilentlyContinue).Trim()
        }
      }
      finally {
        Remove-Item -Path $stderrFile -Force -ErrorAction SilentlyContinue
      }

      if ($deploymentExitCode -eq 0) {
        $webPartClientId = ($deploymentOutput | Out-String).Trim()
      }
      elseif (Test-EasyAuthUniqueNameConflict -Message $deploymentErrorText) {
        $webPartClientId = Get-WebPartClientIdFromEntra -FunctionAppName $functionAppName
      }
      else {
        $webPartClientId = $null
      }
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

# ── 0a. Check Azure RBAC permissions ────────────────────────────────────────
# Deployments need two Azure permission buckets:
# - resource deployment rights (Contributor or Owner)
# - role-assignment rights because functionapp.bicep deploys storage RBAC
# The check is informational — a missing role does not abort the script, but it
# surfaces the gap early so the operator can activate PIM or request access
# before the actual deployment runs.
function Get-RelevantAzureRoleNamesForScope {
  param(
    [Parameter(Mandatory)][string]$Scope,
    [Parameter(Mandatory)][string]$AssigneeObjectId
  )

  $_roleNamesRaw = az role assignment list `
    --scope $Scope `
    --assignee $AssigneeObjectId `
    --include-inherited `
    --query "[?contains(['Owner','Contributor','User Access Administrator','Role Based Access Control Administrator'], roleDefinitionName)].roleDefinitionName" `
    -o tsv 2>$null

  if ($LASTEXITCODE -ne 0 -or -not $_roleNamesRaw) {
    return @()
  }

  return @($_roleNamesRaw -split "`n" | Where-Object { $_ } | Select-Object -Unique)
}

function Test-HasAnyAzureRoleName {
  param(
    [Parameter(Mandatory)][string[]]$RoleNames,
    [Parameter(Mandatory)][string[]]$AcceptedRoleNames
  )

  return ($RoleNames | Where-Object { $_ -in $AcceptedRoleNames }).Count -gt 0
}

Write-Host ''
Write-Host 'Checking Azure RBAC permissions...'
$_subIdMatch = ($envValues | Select-String '^AZURE_SUBSCRIPTION_ID="?([^"]+)"?').Matches
$_subId = if ($_subIdMatch -and $_subIdMatch.Count -gt 0) { $_subIdMatch[0].Groups[1].Value } else { $null }
if ($_subId) {
  try {
    $_userId = az ad signed-in-user show --query id -o tsv 2>$null
    if ($LASTEXITCODE -eq 0 -and $_userId) {
      $_resourceGroupName = Get-AzdEnvValue -Name 'AZURE_RESOURCE_GROUP'
      $_resourceGroupScope = $null
      $_resourceGroupExists = $false
      if ($_resourceGroupName) {
        $_resourceGroupScope = "/subscriptions/$_subId/resourceGroups/$_resourceGroupName"
        try {
          $_resourceGroupExists = ((az group exists --name $_resourceGroupName -o tsv 2>$null).Trim() -eq 'true')
        }
        catch {
          $_resourceGroupExists = $false
        }
      }

      $_subscriptionRoles = @(Get-RelevantAzureRoleNamesForScope -Scope "/subscriptions/$_subId" -AssigneeObjectId $_userId)
      $_resourceGroupRoles = if ($_resourceGroupExists -and $_resourceGroupScope) {
        @(Get-RelevantAzureRoleNamesForScope -Scope $_resourceGroupScope -AssigneeObjectId $_userId)
      }
      else {
        @()
      }
      $_allRelevantRoles = @($_subscriptionRoles + $_resourceGroupRoles | Select-Object -Unique)

      $_deploymentRoleNames = @('Owner', 'Contributor')
      $_roleAssignmentRoleNames = @('Owner', 'User Access Administrator', 'Role Based Access Control Administrator')

      $_hasSubscriptionDeploymentRole = Test-HasAnyAzureRoleName -RoleNames $_subscriptionRoles -AcceptedRoleNames $_deploymentRoleNames
      $_hasDeploymentRole = Test-HasAnyAzureRoleName -RoleNames $_allRelevantRoles -AcceptedRoleNames $_deploymentRoleNames
      $_hasSubscriptionRoleAssignmentRole = Test-HasAnyAzureRoleName -RoleNames $_subscriptionRoles -AcceptedRoleNames $_roleAssignmentRoleNames
      $_hasRoleAssignmentRole = Test-HasAnyAzureRoleName -RoleNames $_allRelevantRoles -AcceptedRoleNames $_roleAssignmentRoleNames

      if ($_hasDeploymentRole) {
        if ($_hasSubscriptionDeploymentRole) {
          Write-Host '  + Azure deployment role: Contributor/Owner visible on the subscription.'
        }
        else {
          Write-Host '  + Azure deployment role: Contributor/Owner visible on the target resource group.'
          Write-Host '    Routine deployments usually work with this scope.'
          Write-Host '    If provider registration is still needed, this run can still require'
          Write-Host '    Contributor or Owner on the subscription.'
        }
      }
      elseif ($_resourceGroupExists) {
        Write-Host '  ! Azure deployment role missing: Contributor or Owner on the target resource group.'
        Write-Host '    Subscription inheritance also satisfies this requirement.'
      }
      else {
        Write-Host '  ! Azure deployment role missing: Contributor or Owner on the subscription.'
        Write-Host '    This run still needs subscription scope for provider registration or'
        Write-Host '    initial resource-group creation.'
      }

      if ($_hasRoleAssignmentRole) {
        if ($_hasSubscriptionRoleAssignmentRole) {
          Write-Host '  + Azure role-assignment role: Owner/User Access Administrator/Role Based Access Control Administrator visible on the subscription.'
        }
        else {
          Write-Host '  + Azure role-assignment role: Owner/User Access Administrator/Role Based Access Control Administrator visible on the target resource group.'
          Write-Host '    This scope is sufficient for the storage role assignments in routine deployments.'
        }
      }
      elseif ($_resourceGroupExists) {
        Write-Host '  ! Azure role-assignment role missing: Owner, User Access Administrator, or Role Based Access Control Administrator on the target resource group.'
        Write-Host '    Subscription inheritance also satisfies this requirement.'
      }
      else {
        Write-Host '  ! Azure role-assignment role missing: Owner, User Access Administrator, or Role Based Access Control Administrator on the subscription.'
        Write-Host '    This run still needs subscription scope for the initial deployment path.'
      }

      if (-not $_hasDeploymentRole -or -not $_hasRoleAssignmentRole) {
        Write-Host '    Azure PIM: https://portal.azure.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade/~/azurerbac'
      }
    }
    else {
      Write-Host '  ! Azure RBAC: could not identify the signed-in user — skipping check.'
      Write-Host '    Required for deployment: Contributor or Owner.'
      Write-Host '    Required for role assignments: Owner, User Access Administrator, or'
      Write-Host '    Role Based Access Control Administrator.'
    }
  }
  catch {
    Write-Host '  ! Azure RBAC: check encountered an error — continuing anyway.'
    Write-Host '    Required for deployment: Contributor or Owner.'
    Write-Host '    Required for role assignments: Owner, User Access Administrator, or'
    Write-Host '    Role Based Access Control Administrator.'
  }
}
else {
  Write-Host '  ! Azure RBAC: AZURE_SUBSCRIPTION_ID not yet set — skipping role check.'
  Write-Host '    Required for deployment: Contributor or Owner.'
  Write-Host '    Required for role assignments: Owner, User Access Administrator, or'
  Write-Host '    Role Based Access Control Administrator.'
}
Write-Host ''

# ── 0. Validate required Azure resource providers ───────────────────────────
# ARM/Bicep can auto-register template-defined provider namespaces during
# deployment, but the resulting deployment failures are often opaque for admins.
# Pre-register the namespaces this stack can use so the operator gets a clear,
# early error that points to the missing provider and the required subscription
# permission. Keep the list aligned to actual resources in the current Bicep
# templates and conditional feature flags only.
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

# System-assigned identity on Microsoft.Web/sites does not require a separate
# Microsoft.ManagedIdentity resource registration. A past exception was
# Microsoft.ContainerInstance while Flex deployment still used deploymentScripts.
$requiredProviders = @(
  'Microsoft.Authorization',
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
  if ($null -ne $_resourceGroupExists -and $_resourceGroupExists) {
    # The RBAC check above may have indicated that resource-group scope is
    # sufficient for routine deployments, but unregistered providers require
    # Microsoft.Resources/subscriptions/providers/register/action, which is
    # only available at subscription scope. Warn before the attempt so the
    # operator can activate a PIM role and re-run rather than waiting for a
    # cryptic ARM deployment failure.
    Write-Host '  Note: unregistered providers detected. Provider registration requires'
    Write-Host '    subscription-scoped Contributor or Owner even though the resource'
    Write-Host '    group already exists. If your deployment role covers only the resource'
    Write-Host '    group, the step below will fail. Activate a PIM role at subscription'
    Write-Host '    scope if needed, then re-run.'
  }
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
