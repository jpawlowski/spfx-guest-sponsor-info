#!/usr/bin/env -S pwsh -NoLogo -NoProfile

<#
.SYNOPSIS
    Downloads the Guest Sponsor Info infra package and runs the deployment wizard.

.DESCRIPTION
    Downloads the infra release package from GitHub, extracts it to a temporary
    directory, and runs deploy-azure.ps1. All parameters are forwarded to the
    wizard. The temporary directory is removed when the wizard exits.

    This script is the recommended iwr entry point:

      & ([scriptblock]::Create((iwr 'https://raw.githubusercontent.com/workoho/spfx-guest-sponsor-info/v1.2.1/azure-function/infra/install.ps1').Content))

.PARAMETER Version
    Release tag to download (e.g. "v1.2.0"). Defaults to "latest".

.PARAMETER AzdEnvironmentName
    Forwarded to deploy-azure.ps1.

.PARAMETER ResourceGroupName
    Forwarded to deploy-azure.ps1.

.PARAMETER AzureLocation
    Forwarded to deploy-azure.ps1.

.PARAMETER AzureTenantId
    Forwarded to deploy-azure.ps1.

.PARAMETER TenantName
    Forwarded to deploy-azure.ps1.

.PARAMETER FunctionAppName
    Forwarded to deploy-azure.ps1.

.PARAMETER DeployAzureMaps
    Forwarded to deploy-azure.ps1.

.PARAMETER AppVersion
    Forwarded to deploy-azure.ps1.

.PARAMETER EnableMonitoring
    Forwarded to deploy-azure.ps1.

.PARAMETER EnableFailureAnomaliesAlert
    Forwarded to deploy-azure.ps1.

.PARAMETER MaximumFlexInstances
    Forwarded to deploy-azure.ps1.

.PARAMETER AlwaysReadyInstances
    Forwarded to deploy-azure.ps1.

.PARAMETER InstanceMemoryMB
    Forwarded to deploy-azure.ps1.

.PARAMETER SkipGraphRoleAssignments
    Forwarded to deploy-azure.ps1.

.PARAMETER PreflightOnly
    Forwarded to deploy-azure.ps1.

.EXAMPLE
    & ([scriptblock]::Create((iwr 'https://raw.githubusercontent.com/workoho/spfx-guest-sponsor-info/v1.2.1/azure-function/infra/install.ps1').Content))

.EXAMPLE
    & ([scriptblock]::Create((iwr 'https://raw.githubusercontent.com/workoho/spfx-guest-sponsor-info/v1.2.1/azure-function/infra/install.ps1').Content)) -Version v1.2.0 -ResourceGroupName rg-gsi -TenantName contoso

.NOTES
    Copyright 2026 Workoho GmbH <https://workoho.com>
    Author: Julian Pawlowski <https://github.com/jpawlowski>
    Licensed under PolyForm Shield License 1.0.0
    <https://polyformproject.org/licenses/shield/1.0.0>
#>

#Requires -Version 5.1
[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'Medium')]
param(
  [string]$Version = 'latest',
  [string]$AzdEnvironmentName,
  [string]$ResourceGroupName,
  [string]$AzureLocation,
  [string]$AzureTenantId,
  [string]$TenantName,
  [string]$FunctionAppName,
  [bool]$DeployAzureMaps = $true,
  [string]$AppVersion = 'latest',
  [bool]$EnableMonitoring = $true,
  [bool]$EnableFailureAnomaliesAlert = $false,
  [int]$AlwaysReadyInstances = 0,
  [int]$MaximumFlexInstances = 10,
  [ValidateSet(512, 2048)]
  [int]$InstanceMemoryMB = 512,
  [bool]$SkipGraphRoleAssignments = $false,
  [switch]$PreflightOnly
)

$ErrorActionPreference = 'Stop'

function Get-HttpStatusCodeFromException {
  param([System.Exception]$Exception)

  $response = $Exception.Response
  if ($null -eq $response) {
    return $null
  }

  try {
    return [int]$response.StatusCode
  }
  catch {
    return $null
  }
}

function Get-ReleaseAssetSha256 {
  param(
    [string]$Version,
    [string]$AssetName
  )

  $_apiUrl = if ($Version -eq 'latest') {
    'https://api.github.com/repos/workoho/spfx-guest-sponsor-info/releases/latest'
  }
  else {
    "https://api.github.com/repos/workoho/spfx-guest-sponsor-info/releases/tags/$Version"
  }

  try {
    $_release = Invoke-RestMethod \
    -Uri $_apiUrl \
    -Headers @{
      'Accept'               = 'application/vnd.github+json'
      'X-GitHub-Api-Version' = '2022-11-28'
      'User-Agent'           = 'gsi-installer'
    } \
    -UseBasicParsing
  }
  catch {
    $_statusCode = Get-HttpStatusCodeFromException -Exception $_.Exception
    if ($_statusCode -eq 404) {
      if ($Version -eq 'latest') {
        throw "GitHub API lookup for the latest release returned 404. Cannot resolve checksum fallback."
      }

      throw "GitHub API lookup for release '$Version' returned 404. Cannot resolve checksum fallback."
    }

    throw "GitHub API lookup for release asset checksum failed: $($_.Exception.Message)"
  }

  $_asset = @($_release.assets) | Where-Object { $_.name -eq $AssetName } | Select-Object -First 1
  if ($null -eq $_asset) {
    throw "Asset '$AssetName' not found in GitHub release metadata. Cannot resolve checksum fallback."
  }

  $_digest = [string]$_asset.digest
  if ([string]::IsNullOrWhiteSpace($_digest)) {
    throw "Asset '$AssetName' has no digest in GitHub release metadata. Cannot resolve checksum fallback."
  }

  if ($_digest -notmatch '^sha256:') {
    throw "Asset '$AssetName' digest is not SHA256 ('$_digest'). Cannot verify download."
  }

  return $_digest.Substring(7).ToUpperInvariant()
}

# ── Resolve download URLs ─────────────────────────────────────────────────────
# "latest" resolves via the GitHub "latest" redirect; a specific tag uses
# the direct download path.
$_baseUrl = 'https://github.com/workoho/spfx-guest-sponsor-info/releases'
$_zipUrl = if ($Version -eq 'latest') {
  "$_baseUrl/latest/download/guest-sponsor-info-infra.zip"
}
else {
  "$_baseUrl/download/$Version/guest-sponsor-info-infra.zip"
}
$_checksumsUrl = if ($Version -eq 'latest') {
  "$_baseUrl/latest/download/checksums.txt"
}
else {
  "$_baseUrl/download/$Version/checksums.txt"
}

# ── Temporary paths ───────────────────────────────────────────────────────────
$_tempBase = [System.IO.Path]::GetTempPath()
$_tempSuffix = [System.Guid]::NewGuid().ToString('n')
$_zipFile = Join-Path $_tempBase "gsi-infra-$_tempSuffix.zip"
$_checksumsFile = Join-Path $_tempBase "gsi-infra-$_tempSuffix-checksums.txt"
$_extractDir = Join-Path $_tempBase "gsi-infra-$_tempSuffix"

Write-Host ''
Write-Host '  Guest Sponsor Info  ·  Installer' -ForegroundColor DarkCyan
Write-Host ('  ' + ('─' * 58)) -ForegroundColor DarkGray
Write-Host "  Downloading infra package ($Version)..." -ForegroundColor DarkGray
Write-Host "  Source: $_zipUrl" -ForegroundColor DarkGray
Write-Host ''

try {
  # Download the infra ZIP to a temp file.
  try {
    Invoke-WebRequest -Uri $_zipUrl -OutFile $_zipFile -UseBasicParsing
  }
  catch {
    $_statusCode = Get-HttpStatusCodeFromException -Exception $_.Exception
    if ($_statusCode -eq 404) {
      if ($Version -eq 'latest') {
        throw (
          "Infra package for the latest release was not found (404).`n" +
          "The release may not be fully published yet.`n" +
          "Retry in a few minutes, or run again with -Version vX.Y.Z."
        )
      }

      throw (
        "Infra package for release '$Version' was not found (404).`n" +
        "Verify the release tag and check that release assets are published.`n" +
        "URL: $_zipUrl"
      )
    }

    throw
  }

  # ── SHA256 integrity check ──────────────────────────────────────────────────
  # Primary source: checksums.txt from the same release.
  # Fallback source: GitHub release asset digest (sha256) from the API.
  # This catches truncated downloads or CDN-level tampering.
  Write-Host '  Verifying SHA256 checksum...' -ForegroundColor DarkGray
  $_checksumsDownloaded = $false
  try {
    Invoke-WebRequest -Uri $_checksumsUrl -OutFile $_checksumsFile -UseBasicParsing
    $_checksumsDownloaded = $true
  }
  catch {
    $_statusCode = Get-HttpStatusCodeFromException -Exception $_.Exception
    if ($_statusCode -eq 404) {
      Write-Warning (
        "checksums.txt was not found (404). Falling back to GitHub release asset digest for integrity verification.`n" +
        "URL: $_checksumsUrl"
      )
    }
    else {
      throw
    }
  }

  $_expectedHash = $null

  if ($_checksumsDownloaded) {
    # Parse "hash  filename" lines; find the entry for guest-sponsor-info-infra.zip.
    foreach ($_line in (Get-Content $_checksumsFile)) {
      $_parts = $_line -split '\s+', 2
      if ($_parts.Length -eq 2 -and $_parts[1].Trim() -eq 'guest-sponsor-info-infra.zip') {
        $_expectedHash = $_parts[0].Trim().ToUpperInvariant()
        break
      }
    }
  }

  if (-not $_expectedHash) {
    if ($_checksumsDownloaded) {
      Write-Warning 'guest-sponsor-info-infra.zip entry was not found in checksums.txt. Falling back to GitHub release asset digest.'
    }

    $_expectedHash = Get-ReleaseAssetSha256 -Version $Version -AssetName 'guest-sponsor-info-infra.zip'
    Write-Host '  Using checksum source: GitHub release asset digest' -ForegroundColor DarkGray
  }

  $_actualHash = (Get-FileHash -Path $_zipFile -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($_actualHash -ne $_expectedHash) {
    throw (
      "SHA256 mismatch for guest-sponsor-info-infra.zip.`n" +
      "  Expected: $_expectedHash`n" +
      "  Actual:   $_actualHash`n" +
      "Download may be corrupt or tampered with. Aborting."
    )
  }
  Write-Host '  checksum verified.' -ForegroundColor DarkGreen
  Write-Host ''

  # Extract the ZIP (hash verified above).
  Expand-Archive -Path $_zipFile -DestinationPath $_extractDir -Force

  # Locate deploy-azure.ps1 inside the extracted tree.
  # The infra ZIP is flat — all files land at the ZIP root, so deploy-azure.ps1
  # is directly inside the extract directory (no azure-function/infra/ prefix).
  $_deployScript = Join-Path $_extractDir 'deploy-azure.ps1'
  if (-not (Test-Path $_deployScript)) {
    throw "deploy-azure.ps1 not found in the downloaded package. Expected: $_deployScript"
  }

  # Forward all parameters except Version to the wizard.
  # Build the forwarded params hash from PSBoundParameters, skipping Version.
  $_forwardParams = @{}
  foreach ($_key in $PSBoundParameters.Keys) {
    if ($_key -ne 'Version') {
      $_forwardParams[$_key] = $PSBoundParameters[$_key]
    }
  }
  $_forwardParams['InstallerVersion'] = $Version

  & $_deployScript @_forwardParams
}
finally {
  # Always remove temp files, even when the wizard throws or the user aborts.
  Remove-Item -Path $_zipFile -Force -ErrorAction SilentlyContinue
  Remove-Item -Path $_checksumsFile -Force -ErrorAction SilentlyContinue
  Remove-Item -Path $_extractDir -Recurse -Force -ErrorAction SilentlyContinue
}
