// SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
// SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0

targetScope = 'subscription'

@description('Explicit Function App name override. Leave empty to compute the same deterministic default used by main.bicep.')
param functionAppName string = ''

@description('Target resource group name. Used to reproduce the same auto-generated Function App name as the resource-group-scoped deployment template.')
param resourceGroupName string

var resourceGroupResourceId = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${resourceGroupName}'
var effectiveFunctionAppName = empty(functionAppName) ? 'gsi-${uniqueString(resourceGroupResourceId)}' : functionAppName

@description('Function App name to use for both the pre-Azure Entra phase and the Azure deployment.')
output effectiveFunctionAppName string = effectiveFunctionAppName
