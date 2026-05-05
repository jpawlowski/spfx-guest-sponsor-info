// SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
// SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0

targetScope = 'resourceGroup'

@description('Explicit Function App name override. Leave empty to compute the same deterministic default used by main.bicep.')
param functionAppName string = ''

var effectiveFunctionAppName = empty(functionAppName) ? 'gsi-${uniqueString(resourceGroup().id)}' : functionAppName

@description('Function App name to use for both the pre-Azure Entra phase and the Azure deployment.')
output effectiveFunctionAppName string = effectiveFunctionAppName
