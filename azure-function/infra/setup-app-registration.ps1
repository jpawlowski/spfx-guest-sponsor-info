<#
.SYNOPSIS
    Creates or updates the Entra App Registration needed for the Azure Function
    proxy (EasyAuth).

.DESCRIPTION
    Idempotent script that ensures an App Registration named
    "Guest Sponsor Info Proxy" exists with the correct configuration:

      - Supported account types: single tenant (AzureADMyOrg)
      - App ID URI: api://guest-sponsor-info-proxy/<clientId>
      - Access token version: v2 (aud = bare clientId GUID)

    When the registration already exists the script verifies every setting and
    updates anything that drifted.  Re-running the script is always safe.

    The resulting Client ID must be provided as a parameter to the
    Bicep/ARM deployment.

.PARAMETER TenantId
    The Entra tenant ID (GUID).

.PARAMETER DisplayName
    Display name for the App Registration. Defaults to
    "Guest Sponsor Info Proxy".

.EXAMPLE
    ./setup-app-registration.ps1 -TenantId "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
#>
param(
    [Parameter(Mandatory)][string]$TenantId,
    [string]$DisplayName = 'Guest Sponsor Info Proxy'
)

$ErrorActionPreference = 'Stop'

# ── Module bootstrap ─────────────────────────────────────────────────────────
foreach ($module in @(
        'Microsoft.Graph.Authentication',
        'Microsoft.Graph.Applications'
    )) {
    if (-not (Get-Module -ListAvailable -Name $module)) {
        Write-Host "Installing $module module..." -ForegroundColor Cyan
        Install-Module $module -Scope CurrentUser -Force
    }
    Import-Module $module
}

Connect-MgGraph -TenantId $TenantId -Scopes "Application.ReadWrite.All"

# ── Desired state ─────────────────────────────────────────────────────────────
# We pin accessTokenAcceptedVersion to 2 (modern v2 tokens) so the aud
# claim in access tokens equals the bare clientId GUID.  ALLOWED_AUDIENCE
# and the EasyAuth allowedAudiences configuration must use the same GUID.
$desiredTokenVersion = 2

# ── Find or create ────────────────────────────────────────────────────────────
Write-Host "Checking for existing App Registration '$DisplayName'..." `
    -ForegroundColor Cyan
$app = Get-MgApplication -Filter "displayName eq '$DisplayName'" -Top 1

if ($app) {
    $clientId = $app.AppId
    $objectId = $app.Id
    Write-Host "App Registration already exists. Client ID: $clientId" `
        -ForegroundColor Yellow
}
else {
    Write-Host "Creating App Registration '$DisplayName'..." `
        -ForegroundColor Cyan
    $app = New-MgApplication -DisplayName $DisplayName `
        -SignInAudience 'AzureADMyOrg' `
        -Api @{ RequestedAccessTokenVersion = $desiredTokenVersion }
    $clientId = $app.AppId
    $objectId = $app.Id
    Write-Host "  Created — Client ID: $clientId" -ForegroundColor Green
}

# ── Converge to desired state (idempotent) ────────────────────────────────────
$changes = @()

# 1. SignInAudience
if ($app.SignInAudience -ne 'AzureADMyOrg') {
    throw ("Existing App Registration '$DisplayName' is not single-tenant " +
        "(SignInAudience=$($app.SignInAudience)). " +
        "Configure it to AzureADMyOrg before using this solution.")
}

# 2. Identifier URI
$expectedUri = "api://guest-sponsor-info-proxy/$clientId"
$currentUris = $app.IdentifierUris ?? @()
if ($currentUris -notcontains $expectedUri) {
    Write-Host "  Fixing IdentifierUris: adding $expectedUri" `
        -ForegroundColor Yellow
    Update-MgApplication -ApplicationId $objectId `
        -IdentifierUris @($expectedUri)
    $changes += 'IdentifierUris'
}

# 3. Access-token version (v1 so aud = identifierUri)
$currentVersion = $app.Api.RequestedAccessTokenVersion
if ($currentVersion -ne $desiredTokenVersion) {
    Write-Host ("  Fixing RequestedAccessTokenVersion: " +
        "$currentVersion -> $desiredTokenVersion") -ForegroundColor Yellow
    Update-MgApplication -ApplicationId $objectId `
        -Api @{ RequestedAccessTokenVersion = $desiredTokenVersion }
    $changes += 'RequestedAccessTokenVersion'
}

# ── Summary ───────────────────────────────────────────────────────────────────
if ($changes.Count -eq 0) {
    Write-Host "  All settings are correct — nothing to update." `
        -ForegroundColor Green
}
else {
    Write-Host ("  Updated: " + ($changes -join ', ')) `
        -ForegroundColor Green
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" `
    -ForegroundColor Cyan
Write-Host "Copy this Client ID and use it as the 'functionClientId'" `
    -ForegroundColor Cyan
Write-Host "parameter when deploying the ARM template, and in the SPFx" `
    -ForegroundColor Cyan
Write-Host "web part property pane." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" `
    -ForegroundColor Cyan
Write-Host ""
Write-Host "  Function Client ID: $clientId" `
    -ForegroundColor White -BackgroundColor DarkGreen
Write-Host ""
