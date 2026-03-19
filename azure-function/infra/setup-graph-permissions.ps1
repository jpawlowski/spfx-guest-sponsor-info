<#
.SYNOPSIS
    Grants the Function App's Managed Identity the required Microsoft Graph application roles
    and configures the App Registration so the SharePoint web part can silently acquire tokens.

.DESCRIPTION
    After deploying the Azure Function, run this script to:

      1. Assign Microsoft Graph application permissions to the Managed Identity:
           - User.Read.All     (read any user's profile and sponsors)
           - Presence.Read.All (read sponsor presence status; optional, requires Teams)

      2. Expose a 'user_impersonation' API scope on the EasyAuth App Registration and
         pre-authorize 'SharePoint Online Web Client Extensibility' to call it.
         This allows the SPFx web part to acquire tokens silently without prompting the
         user for consent or redirecting the page.

    The Managed Identity object ID is shown in the Azure Portal (Function App → Identity)
    and is also emitted as an output of the Bicep/ARM deployment.

.PARAMETER ManagedIdentityObjectId
    The object ID (not the client ID) of the Function App's system-assigned Managed Identity.

.PARAMETER TenantId
    The Entra tenant ID (GUID).

.PARAMETER FunctionAppClientId
    The client ID (application ID) of the EasyAuth App Registration created in the pre-step.
    Required to expose the API scope and pre-authorize the SharePoint client.

.EXAMPLE
    ./setup-graph-permissions.ps1 `
      -ManagedIdentityObjectId "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" `
      -TenantId "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy" `
      -FunctionAppClientId "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"
#>
param(
    [Parameter(Mandatory)][string]$ManagedIdentityObjectId,
    [Parameter(Mandatory)][string]$TenantId,
    [Parameter(Mandatory)][string]$FunctionAppClientId
)

$ErrorActionPreference = 'Stop'

# Ensure Microsoft.Graph module is available.
if (-not (Get-Module -ListAvailable -Name Microsoft.Graph.Authentication)) {
    Write-Host "Installing Microsoft.Graph.Authentication module..." -ForegroundColor Cyan
    Install-Module Microsoft.Graph.Authentication -Scope CurrentUser -Force
}
if (-not (Get-Module -ListAvailable -Name Microsoft.Graph.Applications)) {
    Write-Host "Installing Microsoft.Graph.Applications module..." -ForegroundColor Cyan
    Install-Module Microsoft.Graph.Applications -Scope CurrentUser -Force
}

Import-Module Microsoft.Graph.Authentication
Import-Module Microsoft.Graph.Applications

Connect-MgGraph -TenantId $TenantId -Scopes "AppRoleAssignment.ReadWrite.All", "Application.ReadWrite.All"

Write-Host "Resolving Microsoft Graph service principal..." -ForegroundColor Cyan
$graphSp = Get-MgServicePrincipal -Filter "appId eq '00000003-0000-0000-c000-000000000000'"
if (-not $graphSp) {
    throw "Could not find the Microsoft Graph service principal in tenant '$TenantId'."
}

# Resolve role IDs dynamically from the Graph service principal's app roles.
# This avoids hardcoded GUIDs and correctly detects unavailable permissions.
$requiredRoles = @(
    @{ Name = 'User.Read.All'; Optional = $false }
    @{ Name = 'Presence.Read.All'; Optional = $true }   # requires Microsoft Teams; function degrades gracefully without it
)

$assignedRoles = @()
$skippedRoles  = @()

foreach ($role in $requiredRoles) {
    Write-Host "Assigning $($role.Name) ..." -ForegroundColor Cyan

    $appRole = $graphSp.AppRoles | Where-Object { $_.Value -eq $role.Name -and $_.AllowedMemberTypes -contains 'Application' }
    if (-not $appRole) {
        if ($role.Optional) {
            Write-Host "  ⚠ $($role.Name) is not available as an Application permission in this tenant (Microsoft Teams may not be licensed). Skipping — sponsors will be shown without presence status." -ForegroundColor Yellow
            $skippedRoles += $role.Name
            continue
        } else {
            throw "Required permission '$($role.Name)' was not found on the Microsoft Graph service principal."
        }
    }

    try {
        $null = New-MgServicePrincipalAppRoleAssignment `
            -ServicePrincipalId $ManagedIdentityObjectId `
            -PrincipalId $ManagedIdentityObjectId `
            -ResourceId $graphSp.Id `
            -AppRoleId $appRole.Id `
            -ErrorAction Stop
        Write-Host "  ✓ $($role.Name) assigned." -ForegroundColor Green
        $assignedRoles += $role.Name
    } catch {
        if ($_.Exception.Message -like "*Permission being assigned already exists*") {
            Write-Host "  ✓ $($role.Name) already assigned — skipping." -ForegroundColor Yellow
            $assignedRoles += $role.Name
        } else {
            throw
        }
    }
}

Write-Host "`nConfiguring App Registration for silent token acquisition by the SharePoint web part..." -ForegroundColor Cyan

# The SharePoint Online Web Client Extensibility app is the MSAL client that SPFx uses
# internally to acquire tokens on behalf of the signed-in user. Pre-authorizing it on the
# EasyAuth App Registration allows silent token acquisition without user consent prompts
# or full-page redirects.
$spWebClientExtensibilityAppId = 'c58637bb-e2e1-4312-8a00-04b5ed6f3516'

$app = Get-MgApplication -Filter "appId eq '$FunctionAppClientId'" -ErrorAction Stop
if (-not $app) {
    throw "Could not find App Registration with client ID '$FunctionAppClientId'. Verify the -FunctionAppClientId parameter."
}

# Ensure the identifier URI is set — required for the api:// audience used by EasyAuth.
$expectedUri = "api://guest-sponsor-info-proxy/$FunctionAppClientId"
if ($app.IdentifierUris -notcontains $expectedUri) {
    Write-Host "  Setting identifier URI to $expectedUri ..." -ForegroundColor Cyan
    Update-MgApplication -ApplicationId $app.Id -IdentifierUris @($expectedUri) -ErrorAction Stop
    Write-Host "  ✓ Identifier URI set." -ForegroundColor Green
} else {
    Write-Host "  ✓ Identifier URI already set." -ForegroundColor Yellow
}

# Expose a 'user_impersonation' OAuth2 scope if not already present.
$existingScope = $app.Api.Oauth2PermissionScopes | Where-Object { $_.Value -eq 'user_impersonation' }
if (-not $existingScope) {
    Write-Host "  Adding 'user_impersonation' scope ..." -ForegroundColor Cyan
    $scopeId = [System.Guid]::NewGuid().ToString()
    $newScope = @{
        Id                      = $scopeId
        Value                   = 'user_impersonation'
        Type                    = 'User'
        AdminConsentDisplayName = 'Access Guest Sponsor Info proxy as the signed-in user'
        AdminConsentDescription = 'Allows the SharePoint web part to call the Azure Function proxy on behalf of the signed-in user.'
        UserConsentDisplayName  = 'Access Guest Sponsor Info proxy'
        UserConsentDescription  = 'Allows the app to call the Azure Function proxy on your behalf.'
        IsEnabled               = $true
    }
    $updatedScopes = @($newScope)
    Update-MgApplication -ApplicationId $app.Id -Api @{ Oauth2PermissionScopes = $updatedScopes } -ErrorAction Stop
    # Re-fetch to get the assigned scope ID (may differ from what we sent).
    $app = Get-MgApplication -Filter "appId eq '$FunctionAppClientId'" -ErrorAction Stop
    $existingScope = $app.Api.Oauth2PermissionScopes | Where-Object { $_.Value -eq 'user_impersonation' }
    Write-Host "  ✓ 'user_impersonation' scope added (id: $($existingScope.Id))." -ForegroundColor Green
} else {
    Write-Host "  ✓ 'user_impersonation' scope already exists (id: $($existingScope.Id))." -ForegroundColor Yellow
}

# Pre-authorize the SharePoint Online Web Client Extensibility app to call the scope.
# This is what makes token acquisition silent — no per-user consent prompt, no page redirect.
$alreadyPreAuthorized = $app.Api.PreAuthorizedApplications | Where-Object {
    $_.AppId -eq $spWebClientExtensibilityAppId -and
    $_.DelegatedPermissionIds -contains $existingScope.Id
}
if (-not $alreadyPreAuthorized) {
    Write-Host "  Pre-authorizing SharePoint Online Web Client Extensibility ($spWebClientExtensibilityAppId) ..." -ForegroundColor Cyan
    $existingPreAuthorized = $app.Api.PreAuthorizedApplications | Where-Object { $_.AppId -ne $spWebClientExtensibilityAppId }
    $newPreAuth = @{
        AppId                  = $spWebClientExtensibilityAppId
        DelegatedPermissionIds = @($existingScope.Id)
    }
    $updatedPreAuthorized = @($existingPreAuthorized) + @($newPreAuth)
    Update-MgApplication -ApplicationId $app.Id -Api @{ PreAuthorizedApplications = $updatedPreAuthorized } -ErrorAction Stop
    Write-Host "  ✓ SharePoint Online Web Client Extensibility pre-authorized." -ForegroundColor Green
} else {
    Write-Host "  ✓ SharePoint Online Web Client Extensibility already pre-authorized." -ForegroundColor Yellow
}

Write-Host "`nDone. The Managed Identity can now call Microsoft Graph with:" -ForegroundColor Green
foreach ($r in $assignedRoles) {
    Write-Host "  - $r" -ForegroundColor Green
}
if ($skippedRoles.Count -gt 0) {
    Write-Host "`nSkipped (not available in this tenant):" -ForegroundColor Yellow
    foreach ($r in $skippedRoles) {
        Write-Host "  - $r" -ForegroundColor Yellow
    }
}
Write-Host "`nThe App Registration is configured for silent token acquisition:" -ForegroundColor Green
Write-Host "  - Identifier URI: $expectedUri" -ForegroundColor Green
Write-Host "  - Scope 'user_impersonation' exposed and SharePoint pre-authorized." -ForegroundColor Green
Write-Host "`nThe SharePoint web part can now acquire tokens silently. No page reloads or consent prompts." -ForegroundColor Green
