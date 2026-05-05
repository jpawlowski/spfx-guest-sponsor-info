// SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
// SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0

extension microsoftGraphV1

targetScope = 'resourceGroup'

metadata name = 'Guest Sponsor Info Entra Auth'
metadata description = 'Bootstraps the EasyAuth App Registration used by the Azure Function EasyAuth configuration.'
metadata repository = 'https://github.com/workoho/spfx-guest-sponsor-info'
metadata author = 'Workoho GmbH'
metadata license = 'PolyForm-Shield-1.0.0'

@description('Name of the Azure Function App. Used as the stable suffix for the EasyAuth App Registration uniqueName and identifier URI.')
param functionAppName string

var repositoryUrl = 'https://github.com/workoho/spfx-guest-sponsor-info'
var docsUrl = 'https://guest-sponsor-info.workoho.cloud'
var appRegDescription = 'EasyAuth identity provider for the "Guest Sponsor Info" SharePoint Online web part (SPFx). Authenticates requests from the web part to the Azure Function proxy, which calls Microsoft Graph on behalf of signed-in guest users to retrieve their Entra sponsor information. Tokens are acquired silently via pre-authorized SharePoint Online Web Client Extensibility. Docs: ${docsUrl}'
var appRegNotes = 'Do not delete — the "Guest Sponsor Info" SharePoint web part depends on this for guest sponsor lookups via Microsoft Graph. The associated Azure Function uses a system-assigned Managed Identity for Graph API calls (User.Read.All, Presence.Read.All, MailboxSettings.Read, TeamMember.Read.All). Docs: ${docsUrl}'
var appRegInfo = {
  termsOfServiceUrl: '${repositoryUrl}/blob/main/docs/terms-of-use.md'
  privacyStatementUrl: '${repositoryUrl}/blob/main/docs/privacy-policy.md'
  supportUrl: '${repositoryUrl}/issues'
  marketingUrl: docsUrl
}
var appRegLogo = loadFileAsBase64('./assets/icon-300.png')
var userImpersonationScopeId = guid(functionAppName, 'user-impersonation')

resource appReg 'Microsoft.Graph/applications@v1.0' = {
  displayName: 'Guest Sponsor Info - SharePoint Web Part Auth'
  uniqueName: 'guest-sponsor-info-proxy-${functionAppName}'
  description: appRegDescription
  notes: appRegNotes
  signInAudience: 'AzureADMyOrg'
  info: appRegInfo
  logo: appRegLogo
  serviceManagementReference: '${repositoryUrl}/issues'
  web: {
    homePageUrl: repositoryUrl
  }
  identifierUris: [
    'api://guest-sponsor-info-${functionAppName}'
  ]
  api: {
    requestedAccessTokenVersion: 2
    oauth2PermissionScopes: [
      {
        id: userImpersonationScopeId
        adminConsentDescription: 'Allows the SharePoint web part to call the Azure Function proxy on behalf of the signed-in user.'
        adminConsentDisplayName: 'Access Guest Sponsor Info web part proxy as the signed-in user'
        isEnabled: true
        type: 'User'
        userConsentDescription: 'Allows the app to call the Azure Function proxy on your behalf.'
        userConsentDisplayName: 'Access Guest Sponsor Info web part proxy'
        value: 'user_impersonation'
      }
    ]
    preAuthorizedApplications: [
      {
        appId: '08e18876-6177-487e-b8b5-cf950c1e598c'
        delegatedPermissionIds: [
          userImpersonationScopeId
        ]
      }
    ]
  }
}

resource easyAuthSp 'Microsoft.Graph/servicePrincipals@v1.0' = {
  appId: appReg.appId
  tags: ['HideApp']
  appRoleAssignmentRequired: false
  description: appRegDescription
  notes: appRegNotes
}

@description('Client ID (appId) of the Entra App Registration used for EasyAuth. Paste this into the SPFx web part property pane (Application (client) ID field).')
output webPartClientId string = appReg.appId

@description('Deterministic uniqueName of the Entra App Registration. Useful for CLI lookups and troubleshooting.')
output appRegistrationUniqueName string = appReg.uniqueName
