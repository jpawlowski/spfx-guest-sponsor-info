// SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
// SPDX-FileCopyrightText: 2026 Julian Pawlowski <https://github.com/jpawlowski>
// SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0

import { getVisualQaOverrides } from '../visualQa';

describe('visual QA overrides', () => {
  it('allows overrides on localhost', () => {
    const overrides = getVisualQaOverrides(
      '?gsi-qa-mock=1&gsi-qa-count=3&gsi-qa-viewport=phone',
      'https://localhost:4321/?gsi-qa-mock=1&gsi-qa-count=3&gsi-qa-viewport=phone'
    );

    expect(overrides.forceMockMode).toBe(true);
    expect(overrides.mockSponsorCount).toBe(3);
    expect(overrides.viewport?.widthClass).toBe('compact');
  });

  it('allows overrides on the hosted workbench when using the local SPFx debug manifest', () => {
    const overrides = getVisualQaOverrides(
      '?gsi-qa-mock=1&gsi-qa-hint=versionMismatch',
      'https://contoso.sharepoint.com/_layouts/15/workbench.aspx?debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fbuild%2Fmanifests.js&gsi-qa-mock=1&gsi-qa-hint=versionMismatch'
    );

    expect(overrides.forceMockMode).toBe(true);
    expect(overrides.mockSimulatedHint).toBe('versionMismatch');
  });

  it('ignores overrides on regular SharePoint pages', () => {
    const overrides = getVisualQaOverrides(
      '?gsi-qa-mock=1&gsi-qa-viewport=phone',
      'https://contoso.sharepoint.com/sites/hr/SitePages/home.aspx?gsi-qa-mock=1&gsi-qa-viewport=phone'
    );

    expect(overrides.forceMockMode).toBe(false);
    expect(overrides.viewport).toBeUndefined();
  });

  it('ignores overrides on workbench pages without the local SPFx debug manifest', () => {
    const overrides = getVisualQaOverrides(
      '?gsi-qa-mock=1&gsi-qa-hint=sponsorUnavailable',
      'https://contoso.sharepoint.com/_layouts/15/workbench.aspx?gsi-qa-mock=1&gsi-qa-hint=sponsorUnavailable'
    );

    expect(overrides.forceMockMode).toBe(false);
    expect(overrides.mockSimulatedHint).toBeUndefined();
  });
});
