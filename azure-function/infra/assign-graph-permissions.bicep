// SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
// SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0

targetScope = 'resourceGroup'

metadata name = 'Guest Sponsor Info Graph Permissions'
metadata description = 'Assigns the required Microsoft Graph application permissions to the Azure Function managed identity after the Function App exists.'
metadata repository = 'https://github.com/workoho/spfx-guest-sponsor-info'
metadata author = 'Workoho GmbH'
metadata license = 'PolyForm-Shield-1.0.0'

@description('Object ID (principalId) of the Function App system-assigned Managed Identity.')
param managedIdentityObjectId string

module graphPermissions './modules/graph-permissions.bicep' = {
  name: 'graphPermissions'
  params: {
    managedIdentityObjectId: managedIdentityObjectId
    skipRoleAssignments: false
  }
}
